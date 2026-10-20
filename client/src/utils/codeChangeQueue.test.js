import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCodeChangeQueue } from './codeChangeQueue.js';

const fileChange = (fileId, overrides = {}) => ({
  roomId: 'room-1',
  fileId,
  project: 'project-1',
  filename: `${fileId}.js`,
  path: `${fileId}.js`,
  language: 'javascript',
  content: `${fileId}-initial`,
  version: 1,
  ...overrides
});

describe('createCodeChangeQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps an edit tied to its file when the active file changes', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { content: 'A1' }));
    queue.enqueue(fileChange('B', { content: 'B1' }));
    vi.advanceTimersByTime(120);

    expect(send.mock.calls.map(([payload]) => [payload.fileId, payload.content])).toEqual([
      ['A', 'A1'],
      ['B', 'B1']
    ]);
    expect(send.mock.calls[0][0]).toMatchObject({ roomId: 'room-1', project: 'project-1' });
    expect(send.mock.calls[1][0]).toMatchObject({ roomId: 'room-1', project: 'project-1' });
  });

  it('debounces A and B independently when both change before the delay', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { content: 'A1' }));
    vi.advanceTimersByTime(30);
    queue.enqueue(fileChange('B', { content: 'B1' }));
    vi.advanceTimersByTime(30);
    queue.enqueue(fileChange('A', { content: 'A2', version: 2 }));
    vi.advanceTimersByTime(89);

    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ fileId: 'B', content: 'B1' });

    vi.advanceTimersByTime(30);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({ fileId: 'A', content: 'A2', version: 2 });
  });

  it('coalesces one file and preserves an empty latest content value', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { content: 'first' }));
    vi.advanceTimersByTime(80);
    queue.enqueue(fileChange('A', { content: '' }));
    vi.advanceTimersByTime(119);
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ fileId: 'A', content: '' });
    expect(Object.prototype.hasOwnProperty.call(send.mock.calls[0][0], 'content')).toBe(true);
  });

  it('keeps the latest valid metadata while coalescing a patch', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { path: 'renamed.js', filename: 'renamed.js', content: 'text' }));
    queue.enqueue(fileChange('A', { path: '', filename: '', content: 'latest text' }));
    vi.advanceTimersByTime(120);

    expect(send.mock.calls[0][0]).toMatchObject({
      fileId: 'A',
      path: 'renamed.js',
      filename: 'renamed.js',
      content: 'latest text'
    });
  });

  it('cancels a deleted file and all queued work during workspace cleanup', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { content: 'A1' }));
    expect(queue.cancelFile('A')).toBe(true);
    vi.advanceTimersByTime(120);
    expect(send).not.toHaveBeenCalled();

    queue.enqueue(fileChange('A', { content: 'A2' }));
    queue.enqueue(fileChange('B', { content: 'B1' }));
    queue.cancelAll();
    vi.advanceTimersByTime(120);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not queue or late-send while disconnected', () => {
    const send = vi.fn();
    let connected = true;
    const queue = createCodeChangeQueue({ send, isConnected: () => connected });

    connected = false;
    expect(queue.enqueue(fileChange('A', { content: 'offline' }))).toBe(false);
    connected = true;
    vi.advanceTimersByTime(120);
    expect(send).not.toHaveBeenCalled();

    queue.enqueue(fileChange('A', { content: 'online-then-disconnected' }));
    connected = false;
    expect(queue.enqueue(fileChange('A', { content: 'offline-replacement' }))).toBe(false);
    connected = true;
    vi.advanceTimersByTime(120);
    expect(send).not.toHaveBeenCalled();
  });

  it('allows a rename to supersede pending text without a stale late send', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { content: 'current text', path: 'old.js', filename: 'old.js' }));
    expect(queue.updateMetadata('A', { path: 'renamed.js', filename: 'renamed.js', language: 'javascript' })).toBe(true);
    vi.advanceTimersByTime(120);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      fileId: 'A',
      content: 'current text',
      filename: 'renamed.js',
      path: 'renamed.js'
    });
  });

  it('drops a pending send if the socket disconnects before the timer fires', () => {
    const send = vi.fn();
    let connected = true;
    const queue = createCodeChangeQueue({ send, isConnected: () => connected });
    queue.enqueue(fileChange('A'));
    connected = false;
    vi.advanceTimersByTime(120);
    connected = true;
    vi.advanceTimersByTime(120);
    expect(send).not.toHaveBeenCalled();
  });

  it('cancels old text before a local rename and only sends the renamed snapshot', () => {
    const send = vi.fn();
    const queue = createCodeChangeQueue({ send });

    queue.enqueue(fileChange('A', { content: 'stale text', path: 'old.js', filename: 'old.js' }));
    queue.cancelFile('A');
    queue.enqueue(fileChange('A', { content: 'current text', path: 'renamed.js', filename: 'renamed.js', version: 2 }));
    vi.advanceTimersByTime(120);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ fileId: 'A', content: 'current text', path: 'renamed.js' });
  });
});
