// Drawing only: the world's state and the current screen in, pixels out.
// A camera follows the hero across the 2560x1920 city; the visible window is
// the 1280x720 playfield, scaled to the browser window. Flat vector art:
// roads and blocks, buildings, cars with headlights, pedestrians, police
// with flashing lights, a HUD with money, health, wanted stars and the
// mission objective, plus a minimap in the corner.

import { CAR, FONT, PALETTE, PLAYER, ROAD_HALF, ROAD_X, ROAD_Y, WORLD } from './config.js';

// The renderer's view is 1280x720 logical pixels, like the starter's field.
export const VIEW = { width: 1280, height: 720 };

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function drawCarShape(context, x, y, angle, length, width, color) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(-length / 2, -width / 2, length, width, 8);
  context.fill();
  context.fillStyle = 'rgba(20, 30, 45, 0.85)';
  context.beginPath();
  context.roundRect(-length / 6, -width / 2 + 4, length / 3, width - 8, 4);
  context.fill();
  context.fillStyle = '#fff8c0';
  context.fillRect(length / 2 - 3, -width / 2 + 4, 3, 6);
  context.fillRect(length / 2 - 3, width / 2 - 10, 3, 6);
  context.restore();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function camera(state) {
    const p = state.player;
    return {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2)),
    };
  }

  function drawCity(state, cam) {
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    // City blocks.
    context.fillStyle = PALETTE.block;
    for (const b of state.buildings) {
      if (b.x + b.w < cam.x || b.x > cam.x + VIEW.width || b.y + b.h < cam.y || b.y > cam.y + VIEW.height) continue;
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      context.fillStyle = 'rgba(255, 240, 160, 0.5)';
      for (let wx = b.x + 22; wx < b.x + b.w - 18; wx += 34) {
        for (let wy = b.y + 22; wy < b.y + b.h - 18; wy += 30) {
          context.fillRect(wx, wy, 10, 12);
        }
      }
    }
    // Harbor water along the south-east edge.
    context.fillStyle = PALETTE.water;
    context.fillRect(2280, 1680, WORLD.width - 2280, WORLD.height - 1680);
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const rx of ROAD_X) context.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD.height);
    for (const ry of ROAD_Y) context.fillRect(0, ry - ROAD_HALF, WORLD.width, ROAD_HALF * 2);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROAD_X) {
      for (let y = 0; y < WORLD.height; y += 80) context.fillRect(rx - 3, y, 6, 40);
    }
    for (const ry of ROAD_Y) {
      for (let x = 0; x < WORLD.width; x += 80) context.fillRect(x, ry - 3, 40, 6);
    }
  }

  function drawActors(state, cam, time) {
    // Mission marker: a pulsing gold ring over the objective.
    const obj = state._objective;
    if (obj) {
      const pulse = 26 + Math.sin(time * 4) * 6;
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(obj.x, obj.y, pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#ffd23f';
      context.beginPath();
      context.arc(obj.x, obj.y, 6, 0, Math.PI * 2);
      context.fill();
    }
    // Safe / warehouse marker for the heist.
    if (state.missionIndex === 2 && state.missionStage === 'pickup' && state.guards.length > 0) {
      context.fillStyle = '#ff9f1c';
      context.font = `bold 22px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('WAREHOUSE', 2240, 1560);
    }
    for (const ped of state.peds) {
      if (ped.x < cam.x - 30 || ped.x > cam.x + VIEW.width + 30) continue;
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#222';
      context.beginPath();
      context.arc(ped.x, ped.y - 3, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.x < cam.x - 80 || car.x > cam.x + VIEW.width + 80) continue;
      drawCarShape(context, car.x, car.y, car.angle, CAR.length, CAR.width, car.color);
      if (car.gold) {
        context.fillStyle = '#ffd23f';
        context.font = `bold 18px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('GOLD COUPE', car.x, car.y - 34);
      }
    }
    for (const guard of state.guards) {
      if (guard.hp <= 0) continue;
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ff5a5a';
      context.fillRect(guard.x - 14, guard.y - 24, 28, 5);
      context.fillStyle = '#7ee081';
      context.fillRect(guard.x - 14, guard.y - 24, 28 * Math.max(0, guard.hp / 60), 5);
    }
    for (const cop of state.cops) {
      drawCarShape(context, cop.x, cop.y, cop.angle, CAR.length, CAR.width, PALETTE.cop);
      const flash = Math.floor(time * 6) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      context.beginPath();
      context.arc(cop.x, cop.y - 8, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      context.beginPath();
      context.arc(cop.x, cop.y + 8, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const bullet of state.bullets) {
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    // The hero, on foot or in a car.
    const p = state.player;
    if (p.inCar) {
      // The car is already drawn; add a marker ring so the hero reads clearly.
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, 36, 0, Math.PI * 2);
      context.stroke();
    } else if (p.invulnerable <= 0 || Math.floor(time * 10) % 2 === 0) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
      context.stroke();
    }
  }

  function drawHud(state) {
    const p = state.player;
    context.fillStyle = 'rgba(10, 16, 26, 0.72)';
    context.fillRect(12, 12, 330, 92);
    text(`$${p.money}`, 24, 46, 30, PALETTE.text, 'left', 'bold');
    text(`HP ${Math.max(0, Math.ceil(p.hp))}`, 24, 78, 20, p.hp < 30 ? PALETTE.hpLow : PALETTE.hp, 'left', 'bold');
    context.fillStyle = '#222';
    context.fillRect(120, 64, 150, 14);
    context.fillStyle = p.hp < 30 ? PALETTE.hpLow : PALETTE.hp;
    context.fillRect(120, 64, 150 * Math.max(0, p.hp / 100), 14);
    text(`Ammo ${p.ammo}`, 284, 78, 18, PALETTE.text, 'left');
    // Wanted stars, on their own backing panel so they read over the city.
    context.fillStyle = 'rgba(10, 16, 26, 0.72)';
    context.fillRect(372, 12, 250, 92);
    text('WANTED', 384, 40, 18, PALETTE.muted, 'left', 'bold');
    for (let i = 0; i < 5; i += 1) {
      text('★', 384 + i * 30, 72, 28, i < state.wanted ? PALETTE.star : '#3a4552', 'left');
    }
    // Mission panel.
    context.fillStyle = 'rgba(10, 16, 26, 0.72)';
    context.fillRect(12, 116, 430, 66);
    const missionLabel = state.allDone
      ? '3/3  Complete!'
      : `${state.missionIndex + 1}/3  ${state.mission.name}`;
    text(missionLabel, 24, 142, 20, PALETTE.text, 'left', 'bold');
    const obj = state._objective;
    text(obj ? `► ${obj.label}` : 'All missions complete!', 24, 168, 18, '#ffd23f', 'left');
    // Message line.
    if (state.message) {
      context.fillStyle = 'rgba(10, 16, 26, 0.72)';
      const w = Math.min(760, 40 + state.message.length * 9);
      context.fillRect((VIEW.width - w) / 2, VIEW.height - 44, w, 32);
      text(state.message, VIEW.width / 2, VIEW.height - 22, 17, PALETTE.text, 'center');
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mw = 200;
    const mh = 150;
    const mx = VIEW.width - mw - 12;
    const my = 12;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10, 16, 26, 0.78)';
    context.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    context.fillStyle = '#2e5d3a';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#2b2f36';
    for (const rx of ROAD_X) context.fillRect(mx + rx * sx - 3, my, 6, mh);
    for (const ry of ROAD_Y) context.fillRect(mx, my + ry * sy, mw, 6);
    const obj = state._objective;
    if (obj) {
      context.fillStyle = '#ffd23f';
      context.beginPath();
      context.arc(mx + obj.x * sx, my + obj.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.cops) {
      context.fillStyle = '#3b82ff';
      context.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
    }
    const p = state.player;
    context.fillStyle = '#ffd23f';
    context.beginPath();
    context.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.stroke();
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 44, PALETTE.text, 'center', 'bold');
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 122 + i * 34, 20, PALETTE.muted, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 32, 22, '#ffd23f', 'center');
  }

  function draw(state, screen, best) {
    const cam = camera(state);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.translate(-cam.x, -cam.y);
    drawCity(state, cam);
    drawActors(state, cam, state.time);
    context.restore();
    if (screen === SCREEN_TITLE) {
      drawPanel('PORT MERIDIAN', [
        'An open-world crime game: steal cars, outrun the cops,',
        'run three missions across the city and make $1,800.',
        'WASD / arrows — move or drive · E — enter / exit car',
        'Space — shoot · P — pause · M — mute',
        best > 0 ? `Best take: $${best}` : 'No take yet — the city is waiting.',
      ], 'Press Enter or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for no one — except right now.'], 'Press P to keep playing');
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED', [
        `You made $${state.player.money} of $1,800.`,
        `Mission ${state.missionIndex + 1}: ${state.mission.name}`,
      ], 'Press Enter to try again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('PORT MERIDIAN — COMPLETE', [
        `All three missions done. You made $${state.player.money}.`,
        'Mara Voss owns this city now.',
      ], 'Press Enter to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
