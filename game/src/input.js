// Keyboard and pointer input for Port Meridian. Held keys give a steering
// vector; one-shot presses (enter/exit a car, pause, confirm, mute) are
// queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.

export const ACTION_ENTER = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const ENTER = new Set(['KeyE']);
const SHOOT = new Set(['Space', 'KeyX']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Enter']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let shoot = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (SHOOT.has(event.code)) shoot = true;
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SHOOT.has(event.code)) shoot = false;
  });
  // A key released while the tab is hidden never sends keyup.
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false; shoot = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The steering vector for this frame: mx -1..1, my -1..1 (up is -1). */
    vector() {
      return { mx: (right ? 1 : 0) - (left ? 1 : 0), my: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    shooting() { return shoot; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
