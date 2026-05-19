import { describe, expect, it, vi } from 'vitest';
import { handleTitlebarMouseDown } from './titlebarDrag';

function makeWindow() {
  return {
    startDragging: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(undefined),
  };
}

function eventFor(target: Element, detail = 1): MouseEvent {
  return {
    buttons: 1,
    button: 0,
    detail,
    target,
  } as MouseEvent;
}

describe('handleTitlebarMouseDown', () => {
  it('starts dragging from inert toolbar space', async () => {
    const appWindow = makeWindow();
    const target = document.createElement('div');

    const handled = await handleTitlebarMouseDown(eventFor(target), appWindow);

    expect(handled).toBe(true);
    expect(appWindow.startDragging).toHaveBeenCalledTimes(1);
    expect(appWindow.toggleMaximize).not.toHaveBeenCalled();
  });

  it('toggles maximize on double click', async () => {
    const appWindow = makeWindow();
    const target = document.createElement('div');

    const handled = await handleTitlebarMouseDown(eventFor(target, 2), appWindow);

    expect(handled).toBe(true);
    expect(appWindow.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(appWindow.startDragging).not.toHaveBeenCalled();
  });

  it('ignores toolbar buttons', async () => {
    const appWindow = makeWindow();
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.appendChild(icon);

    const handled = await handleTitlebarMouseDown(eventFor(icon), appWindow);

    expect(handled).toBe(false);
    expect(appWindow.startDragging).not.toHaveBeenCalled();
    expect(appWindow.toggleMaximize).not.toHaveBeenCalled();
  });
});
