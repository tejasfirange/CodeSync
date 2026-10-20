// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAiRequest } from '../../api/ai.api.js';
import AIAssistantPanel from './AIAssistantPanel.jsx';

vi.mock('../../api/ai.api.js', () => ({ generateAiRequest: vi.fn() }));

const activeFile = {
  _id: 'file-1',
  filename: 'index.js',
  path: 'src/index.js',
  language: 'javascript'
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const mountPanel = (props = {}) => render(
  <AIAssistantPanel
    roomId="room-1"
    projectId="project-1"
    activeFile={activeFile}
    onApplyCode={vi.fn()}
    onClose={vi.fn()}
    {...props}
  />
);

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('submits intent, prompt, and optional selection while showing loading and the result', async () => {
    const request = deferred();
    generateAiRequest.mockReturnValueOnce(request.promise);
    mountPanel();

    fireEvent.change(screen.getByLabelText('AI intent'), { target: { value: 'fix' } });
    fireEvent.change(screen.getByLabelText('AI prompt'), { target: { value: 'Fix the null check' } });
    fireEvent.change(screen.getByLabelText('Selected text (optional)'), { target: { value: 'const value = item.name;' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate with CodeSync AI' }));

    expect(generateAiRequest).toHaveBeenCalledWith({
      roomId: 'room-1',
      projectId: 'project-1',
      fileId: 'file-1',
      intent: 'fix',
      prompt: 'Fix the null check',
      selection: 'const value = item.name;'
    });
    expect(screen.getByRole('button', { name: 'Generating with CodeSync AI' }).disabled).toBe(true);

    await act(async () => {
      request.resolve({
        assistant: {
          summary: 'Added a safe null check.',
          explanation: 'The guard prevents access before the item exists.',
          code: 'const value = item?.name;',
          language: 'javascript',
          filePath: 'src/index.js',
          warnings: ['Confirm the fallback value with your team.']
        },
        context: { fileCount: 3, includedFiles: ['src/index.js'], targetFile: 'src/index.js' }
      });
    });

    expect(screen.getByText('Added a safe null check.')).toBeTruthy();
    expect(screen.getByText('The guard prevents access before the item exists.')).toBeTruthy();
    expect(screen.getByText(/Confirm the fallback value with your team/)).toBeTruthy();
    expect(screen.getByText('3 files in context')).toBeTruthy();
    expect(screen.getByText('const value = item?.name;')).toBeTruthy();
  });

  it('shows a friendly error when generation fails', async () => {
    generateAiRequest.mockRejectedValueOnce(new Error('AI service unavailable'));
    mountPanel();
    fireEvent.change(screen.getByLabelText('AI prompt'), { target: { value: 'Explain this file' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate with CodeSync AI' }));
    });

    expect(screen.getByRole('alert').textContent).toContain('AI service unavailable');
    expect(screen.queryByLabelText('Generating with CodeSync AI')).toBeNull();
  });

  it('disables Apply when the generated file path differs from the active file', async () => {
    generateAiRequest.mockResolvedValueOnce({
      assistant: {
        summary: 'Suggested a change.',
        explanation: '',
        code: 'export default true;',
        language: 'javascript',
        filePath: 'src/other.js',
        warnings: []
      },
      context: { fileCount: 2, includedFiles: [], targetFile: 'src/other.js' }
    });
    const onApplyCode = vi.fn();
    mountPanel({ onApplyCode });
    fireEvent.change(screen.getByLabelText('AI prompt'), { target: { value: 'Review this file' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate with CodeSync AI' }));
    });

     const applyButton = screen.getByRole('button', { name: 'Apply generated file to editor' });
    expect(screen.getByRole('alert').textContent).toContain('Apply is disabled for safety');
    expect(applyButton.disabled).toBe(true);
    fireEvent.click(applyButton);
    expect(onApplyCode).not.toHaveBeenCalled();
  });

  it('keeps Apply disabled for an explanation without replacement code', async () => {
    generateAiRequest.mockResolvedValueOnce({
      assistant: {
        summary: 'The file exports a boolean value.',
        explanation: 'This is an explanation only.',
        code: '',
        language: 'javascript',
        filePath: 'src/index.js',
        warnings: []
      },
      context: { fileCount: 1, includedFiles: ['src/index.js'], targetFile: 'src/index.js' }
    });
    mountPanel();
    fireEvent.change(screen.getByLabelText('AI intent'), { target: { value: 'explain' } });
    fireEvent.change(screen.getByLabelText('AI prompt'), { target: { value: 'Explain this file' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate with CodeSync AI' }));
    });

     expect(screen.getByRole('button', { name: 'Apply generated file to editor' }).disabled).toBe(true);
    expect(screen.getByText(/does not include replacement code/)).toBeTruthy();
  });
});
