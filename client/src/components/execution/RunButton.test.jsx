// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RunButton from './RunButton.jsx';

describe('RunButton terminal affordance', () => {
  afterEach(() => cleanup());

  it('communicates the terminal panel state for keyboard and assistive technology users', () => {
    const onRun = vi.fn();
    const { rerender } = render(<RunButton onRun={onRun} open={false} />);
    const button = screen.getByRole('button', { name: 'Terminal' });

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.title).toBe('Open terminal panel');

    rerender(<RunButton onRun={onRun} open />);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe('Collapse terminal panel');

    fireEvent.click(button);
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
