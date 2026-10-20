// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExecutionPanel from './ExecutionPanel.jsx';

const createProps = () => ({
  open: true,
  activeFile: { filename: 'index.js', path: 'index.js' },
  language: 'javascript',
  stdin: '',
  result: null,
  running: false,
  error: '',
  minimized: false,
  maximized: false,
  history: [],
  packages: [],
  canRun: true,
  onStdinChange: vi.fn(),
  onRunAgain: vi.fn(),
  onClear: vi.fn(),
  onClose: vi.fn(),
  onMinimize: vi.fn(),
  onMaximize: vi.fn(),
  onRestore: vi.fn(),
  onSelectHistory: vi.fn(),
  onInstallPackage: vi.fn(),
  onRemovePackage: vi.fn(),
  onCommand: vi.fn()
});

describe('ExecutionPanel controls', () => {
  afterEach(() => cleanup());

  it('exposes minimize, maximize, restore, and close controls', () => {
    const props = createProps();
    const { rerender } = render(<ExecutionPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Minimize terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maximize terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close terminal' }));
    expect(props.onMinimize).toHaveBeenCalledTimes(1);
    expect(props.onMaximize).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    rerender(<ExecutionPanel {...props} maximized />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore terminal' }));
    expect(props.onRestore).toHaveBeenCalledTimes(1);

    rerender(<ExecutionPanel {...props} minimized />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Restore terminal panel' }), { key: 'Enter' });
    expect(props.onRestore).toHaveBeenCalledTimes(2);
  });
});
