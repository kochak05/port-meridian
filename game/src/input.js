// Keyboard and mouse input. Held keys steer the player; one-shot
// presses (start, pause, enter car, shoot, mute, save) are queued as
// flags and taken once, so a press between two frames is never lost
// and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const SHOOT_KEY = new Set(['KeyF', 'KeyJ', 'KeyX']); // F, J or X all shoot
const MUTE = new Set(['KeyM']);
const SAVE = new Set(['KeyQ']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;

  function onKey(event, down) {
    const code = event.code;
    if (down) {
      if (CONFIRM.has(code) && !event.repeat) actions |= ACTION_CONFIRM;
      else if (PAUSE.has(code) && !event.repeat) actions |= ACTION_PAUSE;
      else if (ENTER.has(code) && !event.repeat) actions |= ACTION_ENTER;
      else if (SHOOT_KEY.has(code) && !event.repeat) actions |= ACTION_SHOOT;
      else if (MUTE.has(code) && !event.repeat) actions |= ACTION_MUTE;
      else if (SAVE.has(code) && !event.repeat) actions |= ACTION_SAVE;
      keys.add(code);
    } else keys.delete(code);
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code) || CONFIRM.has(code) || code === 'Space') event.preventDefault();
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
  });
  // A pointer press both starts the game (ACTION_CONFIRM) and, in play,
  // fires a shot (ACTION_SHOOT). main.js clears the queued shot when a
  // game starts, so a click on the title screen never fires a stray shot.
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
    mouseDown = true; actions |= ACTION_CONFIRM | ACTION_SHOOT;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  const has = (set) => { for (const c of set) if (keys.has(c)) return true; return false; };
  return {
    axis() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    sprint() { return has(SPRINT); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
