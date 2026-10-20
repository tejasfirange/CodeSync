import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import CodeFile from '../models/CodeFile.model.js';
import Project from '../models/Project.model.js';
import Room from '../models/Room.model.js';
import {
  MAX_CONTEXT_CHARS,
  buildGeminiPrompt,
  buildRepositoryContext,
  generateAiResponse,
  generateWithGemini,
  isLikelySecretPath,
  redactSecrets
} from './ai.service.js';

const roomId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const projectId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const targetFileId = 'cccccccccccccccccccccccc';
const userId = 'dddddddddddddddddddddddd';

afterEach(() => mock.restoreAll());

describe('AI repository context safety', () => {
  it('excludes likely secret files and redacts obvious assignments', () => {
    assert.equal(isLikelySecretPath('.env'), true);
    assert.equal(isLikelySecretPath('config/server-private-key.pem'), true);
    assert.equal(isLikelySecretPath('src/index.js'), false);

    const secretValue = 'super-secret-value';
    const repository = buildRepositoryContext([
      { _id: targetFileId, path: 'src/index.js', language: 'javascript', content: `const API_KEY = "${secretValue}";\nconsole.log('safe');` },
      { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', path: '.env.local', language: 'dotenv', content: `API_KEY=${secretValue}` },
      { _id: 'ffffffffffffffffffffffff', path: 'README.md', language: 'markdown', content: '# CodeSync' }
    ], targetFileId);

    assert.equal(repository.targetFile, 'src/index.js');
    assert.deepEqual(repository.includedFiles, ['src/index.js', 'README.md']);
    assert.equal(repository.context.includes(secretValue), false);
    assert.equal(repository.context.includes('.env.local'), false);
    assert.match(repository.context, /\[REDACTED\]/);
  });

  it('keeps context bounded and prioritizes the target file', () => {
    const repository = buildRepositoryContext([
      { _id: targetFileId, path: 'target.js', language: 'javascript', content: 'target\n'.repeat(5000) },
      { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', path: 'other.js', language: 'javascript', content: 'other\n'.repeat(5000) },
      { _id: 'ffffffffffffffffffffffff', path: 'third.js', language: 'javascript', content: 'third\n'.repeat(5000) },
      { _id: '111111111111111111111111', path: 'fourth.js', language: 'javascript', content: 'fourth\n'.repeat(5000) },
      { _id: '222222222222222222222222', path: 'fifth.js', language: 'javascript', content: 'fifth\n'.repeat(5000) }
    ], targetFileId);

    assert.equal(repository.includedFiles[0], 'target.js');
    assert.ok(repository.context.length <= MAX_CONTEXT_CHARS);
    assert.match(repository.context, /truncated/i);
  });

  it('redacts bearer and common token formats', () => {
    const redacted = redactSecrets('Authorization: Bearer abc.def.ghi\nconst token = ghp_123456789012345678901234567890;\n{"apiKey": "json-secret", "AWS_SECRET_ACCESS_KEY": "aws-secret"}');
    assert.equal(redacted.includes('abc.def.ghi'), false);
    assert.equal(redacted.includes('ghp_123456789012345678901234567890'), false);
    assert.equal(redacted.includes('json-secret'), false);
    assert.equal(redacted.includes('aws-secret'), false);
  });
});

describe('Gemini request and response handling', () => {
  it('returns a configuration error when the API key is missing', async () => {
    await assert.rejects(
      generateWithGemini('prompt', { apiKey: '', fetchImpl: async () => { throw new Error('must not fetch'); } }),
      (error) => error.statusCode === 503 && /GEMINI_API_KEY/.test(error.message)
    );
  });

  it('rejects malformed provider JSON with a useful 502', async () => {
    await assert.rejects(
      generateWithGemini('prompt', {
        apiKey: 'test-key',
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })
        })
      }),
      (error) => error.statusCode === 502 && /malformed JSON/.test(error.message)
    );
  });

  it('maps the authenticated project request into a safe Gemini prompt and response', async () => {
    const project = { _id: projectId, room: roomId };
    const room = { _id: roomId };
    const file = {
      _id: targetFileId,
      project: projectId,
      room: roomId,
      path: 'src/index.js',
      filename: 'index.js',
      language: 'javascript',
      content: 'function greet() { return "hello"; }'
    };
    const request = {};

    mock.method(Project, 'findById', async () => project);
    mock.method(Room, 'findOne', async () => room);
    mock.method(CodeFile, 'find', async () => [file]);

    const result = await generateAiResponse(
      {
        roomId,
        projectId,
        fileId: targetFileId,
        intent: 'fix',
        prompt: 'Add a return type comment',
        selection: 'function greet()'
      },
      userId,
      {
        apiKey: 'test-key',
        baseUrl: 'https://example.test/v1beta',
        model: 'test-model',
        fetchImpl: async (url, options) => {
          request.url = url;
          request.options = options;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{
                    text: 'Here is the result:\n```json\n{"summary":"Fixed","explanation":"Small change","code":"```js\\nreturn true;\\n```","language":"javascript","filePath":"src/index.js","warnings":[]}\n```'
                  }]
                }
              }]
            })
          };
        }
      }
    );

    const body = JSON.parse(request.options.body);
    const sentPrompt = body.contents[0].parts[0].text;
    assert.match(request.url, /\/models\/test-model:generateContent\?key=test-key$/);
    assert.match(sentPrompt, /Intent: fix/);
    assert.match(sentPrompt, /Add a return type comment/);
    assert.match(sentPrompt, /src\/index\.js/);
    assert.deepEqual(result.context, {
      fileCount: 1,
      includedFiles: ['src/index.js'],
      targetFile: 'src/index.js'
    });
    assert.equal(result.assistant.summary, 'Fixed');
    assert.equal(result.assistant.code, 'return true;');
    assert.equal(result.assistant.filePath, 'src/index.js');
  });

  it('builds a prompt with the required JSON-only safety instructions', () => {
    const prompt = buildGeminiPrompt({
      intent: 'review',
      prompt: 'Review this function',
      selection: 'const value = 1;',
      repositoryContext: '--- FILE: src/index.js (language: javascript) ---'
    });

    assert.match(prompt, /valid JSON object/);
    assert.match(prompt, /minimal safe changes/);
    assert.match(prompt, /never invent file contents/);
    assert.match(prompt, /<repository-context>/);
  });
});
