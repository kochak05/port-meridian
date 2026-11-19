// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 view is scaled to fit the window and centred; the camera
// follows the player through Port Meridian. Flat shapes, canvas text for
// the HUD, panels and the minimap. No images, no external assets.
import { BLOCK, FONT, MISSIONS, PALETTE, ROAD, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function drawCar(ctx, x, y, angle, color, isPolice, isGold) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-26, -13, 52, 28);
  ctx.fillStyle = color; ctx.fillRect(-26, -13, 52, 26);
  ctx.fillStyle = '#1b2a3a'; ctx.fillRect(-8, -11, 18, 22);
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(22, -10, 4, 6); ctx.fillRect(22, 4, 4, 6);
  ctx.fillStyle = '#ff5a4e'; ctx.fillRect(-26, -10, 3, 6); ctx.fillRect(-26, 4, 3, 6);
  if (isGold) { ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2; ctx.strokeRect(-26, -13, 52, 26); }
  if (isPolice) {
    ctx.fillStyle = '#ff3b30'; ctx.fillRect(-4, -13, 8, 6);
    ctx.fillStyle = '#3b82ff'; ctx.fillRect(4, -13, 8, 6);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('POLICE', 0, 4);
  }
  ctx.restore();
}
function drawPerson(ctx, x, y, angle, color, isPlayer, invuln) {
  if (isPlayer && invuln > 0 && Math.floor(invuln * 10) % 2 === 0) return;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(0, 2, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(Math.cos(angle) * 5, Math.sin(angle) * 5, 6, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, (bold ? 'bold ' : '') + size + 'px ' + FONT);
    ctx.font = fonts.get(key); ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function panel(x, y, w, h, color) {
    ctx.fillStyle = color || 'rgba(20,26,38,0.88)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawCity(state, cam, zoom) {
    const s = state;
    // Grass base, then water strip at the top (the harbor) and the bay park.
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.water; ctx.fillRect(0, 0, WORLD.width, 96);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, 96, WORLD.width, 18);
    // Roads: dark strips with dashed centre lines, both directions.
    ctx.fillStyle = PALETTE.road;
    for (const cx of s.roadX) ctx.fillRect(cx - ROAD / 2, 0, ROAD, WORLD.height);
    for (const cy of s.roadY) ctx.fillRect(0, cy - ROAD / 2, WORLD.width, ROAD);
    ctx.strokeStyle = PALETTE.roadLine; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
    ctx.beginPath();
    for (const cx of s.roadX) { ctx.moveTo(cx, 0); ctx.lineTo(cx, WORLD.height); }
    for (const cy of s.roadY) { ctx.moveTo(0, cy); ctx.lineTo(WORLD.width, cy); }
    ctx.stroke(); ctx.setLineDash([]);
    // Sidewalk edges.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const cx of s.roadX) { ctx.moveTo(cx - ROAD / 2 - 4, 0); ctx.lineTo(cx - ROAD / 2 - 4, WORLD.height); ctx.moveTo(cx + ROAD / 2 + 4, 0); ctx.lineTo(cx + ROAD / 2 + 4, WORLD.height); }
    for (const cy of s.roadY) { ctx.moveTo(0, cy - ROAD / 2 - 4); ctx.lineTo(WORLD.width, cy - ROAD / 2 - 4); ctx.moveTo(0, cy + ROAD / 2 + 4); ctx.lineTo(WORLD.width, cy + ROAD / 2 + 4); }
    ctx.stroke();
    // Blocks: buildings with roofs and windows, parks with trees, car parks.
    for (const b of s.buildings) {
      if (b.kind === 'park') {
        ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#2f7d3a';
        for (let i = 0; i < 6; i++) { const tx = b.x + 24 + (i % 3) * 60, ty = b.y + 30 + Math.floor(i / 3) * 70; ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill(); }
        continue;
      }
      if (b.kind === 'lot') { ctx.fillStyle = '#6b7280'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#e8e8e8'; ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12); continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PALETTE.roof; ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = '#ffe9a8';
      const cols = Math.max(2, Math.floor(b.w / 42));
      for (let i = 0; i < b.windows; i++) { const wx = b.x + 16 + (i % cols) * 42, wy = b.y + 16 + Math.floor(i / cols) * 34; if (wx < b.x + b.w - 20 && wy < b.y + b.h - 20) ctx.fillRect(wx, wy, 18, 14); }
    }
    // Landmark labels.
    ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'center';
    for (const lm of s.landmarks) {
      ctx.fillStyle = 'rgba(20,26,38,0.85)'; const w = ctx.measureText(lm.label).width + 14; ctx.fillRect(lm.x - w / 2, lm.y - 52, w, 22);
      ctx.fillStyle = '#ffffff'; ctx.fillText(lm.label, lm.x, lm.y - 36);
    }
  }

  function drawWorld(state, cam, zoom) {
    const s = state, p = s.player;
    ctx.save();
    ctx.translate(VIEW.width / 2, VIEW.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);
    drawCity(s, cam, zoom);
    // Pickups: cash (gold coin) and health (green cross).
    for (const pk of s.pickups) {
      const bob = Math.sin((s.elapsed + pk.bob) * 3) * 3;
      if (pk.kind === 'cash') { ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7a5b00'; ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('$', pk.x, pk.y + bob + 5); }
      else { ctx.fillStyle = '#22c55e'; ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22); ctx.fillStyle = '#fff'; ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16); ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6); }
    }
    // Target marker: pulsing gold ring and beacon.
    const target = s._target;
    if (target) {
      const pulse = 26 + Math.sin(s.elapsed * 5) * 6;
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.moveTo(target.x, target.y - 52); ctx.lineTo(target.x - 10, target.y - 30); ctx.lineTo(target.x + 10, target.y - 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#141a26'; ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('★', target.x, target.y - 34);
    }
    for (const ped of s.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, false, 0);
    for (const car of s.cars) {
      if (car.kind === 'police') continue;
      drawCar(ctx, car.x, car.y, car.angle, car.color, false, !!car.isGold);
    }
    for (const g of s.guards) {
      if (!g.alive) continue;
      drawPerson(ctx, g.x, g.y, g.angle, '#c0392b', false, 0);
      ctx.fillStyle = '#ff5a4e'; ctx.fillRect(g.x - 14, g.y - 26, 28, 5); ctx.fillStyle = '#4ade80'; ctx.fillRect(g.x - 14, g.y - 26, 28 * Math.max(0, g.health / 60), 5);
    }
    for (const car of s.police) drawCar(ctx, car.x, car.y, car.angle, car.color, true, false);
    for (const b of s.bullets) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); }
    for (const pt of s.particles) { ctx.fillStyle = pt.color; ctx.globalAlpha = Math.max(0, pt.life * 2); ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    if (p.inCar && p.car) drawCar(ctx, p.car.x, p.car.y, p.car.angle, p.car.color, false, !!p.car.isGold);
    else drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, true, p.invuln);
    ctx.restore();
  }

  function drawMinimap(state) {
    const mw = 200, mh = 150, mx = VIEW.width - mw - 16, my = 16;
    panel(mx - 4, my - 4, mw + 8, mh + 8);
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.fillStyle = '#22442a'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2b2f36';
    for (const cx of state.roadX) ctx.fillRect(mx + cx * sx - 2, my, 4, mh);
    for (const cy of state.roadY) ctx.fillRect(mx, my + cy * sy, mw, 4);
    ctx.fillStyle = '#2e6f8e'; ctx.fillRect(mx, my, mw, 96 * sy);
    const target = state._target;
    if (target) { ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2); ctx.fill(); }
    for (const car of state.police) { ctx.fillStyle = '#3b82ff'; ctx.fillRect(mx + car.x * sx - 3, my + car.y * sy - 3, 6, 6); }
    // Armed guards (mission 3) show as red dots, so the player can
    // plan the approach on the minimap instead of walking into them.
    for (const g of state.guards) {
      if (!g.alive) continue;
      ctx.fillStyle = '#ff5a4e'; ctx.fillRect(mx + g.x * sx - 3, my + g.y * sy - 3, 6, 6);
    }
    ctx.fillStyle = PALETTE.player; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    text('PORT MERIDIAN', mx + mw / 2, my + mh + 20, 11, PALETTE.muted, 'center', true);
  }

  function drawHud(state, muted) {
    const s = state, p = s.player;
    ctx.textBaseline = 'alphabetic';
    panel(16, 16, 250, 108);
    text('MARA VOSS', 28, 40, 17, PALETTE.text, 'left', true);
    text('$' + p.money, 28, 66, 22, PALETTE.gold, 'left', true);
    text('Ammo ' + p.ammo, 150, 66, 16, PALETTE.text, 'left');
    // Health bar.
    ctx.fillStyle = '#3a3f4a'; ctx.fillRect(28, 78, 180, 14);
    ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ff5a4e'; ctx.fillRect(28, 78, 180 * Math.max(0, p.health / 100), 14);
    text('HP ' + Math.ceil(p.health), 214, 91, 13, PALETTE.text, 'left', true);
    text(p.inCar ? 'DRIVING  ' + Math.round(Math.abs(p.speed) * 0.12) + ' km/h' : 'ON FOOT', 28, 112, 13, PALETTE.muted, 'left', true);
    // Wanted stars.
    panel(16, 134, 250, 40);
    text('WANTED', 28, 160, 15, PALETTE.text, 'left', true);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i < s.wanted ? '#ff3b30' : '#3a3f4a'; ctx.font = '22px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('★', 110 + i * 26, 162); }
    // Mission objective.
    const m = s._mission;
    if (m && !s.allDone) {
      const tgt = s._target;
      panel(300, 16, 680, 62);
      text(m.title, 316, 40, 16, PALETTE.gold, 'left', true);
      text((s.missionStage === 'pickup' ? 'Go to: ' : 'Deliver to: ') + (tgt ? tgt.label : ''), 316, 64, 15, PALETTE.text, 'left');
    } else if (s.allDone) {
      panel(300, 16, 680, 62);
      text('DEBT PAID — Mara is free!', 316, 40, 16, PALETTE.green, 'left', true);
      text('Free roam Port Meridian. Collect cash, dodge the police.', 316, 64, 15, PALETTE.text, 'left');
    }
    drawMinimap(state);
    // Message banner.
    if (s.message && s.messageTimer > 0) {
      ctx.font = '16px ' + FONT;
      const w = Math.min(900, ctx.measureText(s.message).width + 28);
      panel((VIEW.width - w) / 2, VIEW.height - 108, w, 36);
      text(s.message, VIEW.width / 2, VIEW.height - 84, 16, PALETTE.text, 'center');
    }
    text('WASD drive / walk · E enter car · F / X / click shoot · Shift sprint · P pause · Q save · M sound ' + (muted ? '(muted)' : ''), VIEW.width / 2, VIEW.height - 16, 13, 'rgba(255,255,255,0.75)', 'center');
    // Crosshair when on foot.
    if (!p.inCar) {
      const mx = s._mouse ? s._mouse.x : VIEW.width / 2, my = s._mouse ? s._mouse.y : VIEW.height / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.lineTo(mx - 6, my); ctx.moveTo(mx + 6, my); ctx.lineTo(mx + 14, my); ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my - 6); ctx.moveTo(mx, my + 6); ctx.lineTo(mx, my + 14); ctx.stroke();
    }
  }

  function drawPanelScreen(title, lines, prompt, accent) {
    panel((VIEW.width - 640) / 2, (VIEW.height - 420) / 2, 640, 420);
    text(title, VIEW.width / 2, VIEW.height / 2 - 130, 44, accent || PALETTE.text, 'center', true);
    lines.forEach((line, i) => text(line, VIEW.width / 2, VIEW.height / 2 - 70 + i * 30, 18, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, VIEW.height / 2 + 160, 20, PALETTE.gold, 'center', true);
  }

  function draw(state, screen, best, muted, overview) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const zoom = overview ? 0.42 : 1;
    const cam = overview ? { x: WORLD.width / 2, y: WORLD.height / 2 } : state.camera;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // drawWorld centres on the camera, so for overview it is centred on
    // the city middle — exactly what we want.
    drawWorld(state, cam, zoom);
    if (screen === SCREEN_TITLE) {
      panel(0, 0, VIEW.width, VIEW.height, 'rgba(10,14,22,0.55)');
      text('PORT MERIDIAN', VIEW.width / 2, 150, 64, PALETTE.gold, 'center', true);
      text('An original open-world crime game, made from scratch', VIEW.width / 2, 190, 19, PALETTE.text, 'center');
      // Title panel content, drawn over the dimmed city.
      panel((VIEW.width - 640) / 2, 250, 640, 300);
      text('MARA VOSS OWES THE HARBOR KINGS', VIEW.width / 2, 300, 20, PALETTE.text, 'center', true);
      text('Three jobs. Steal cars, outrun the police,', VIEW.width / 2, 340, 18, PALETTE.muted, 'center');
      text('fight the guards, and buy your freedom.', VIEW.width / 2, 368, 18, PALETTE.muted, 'center');
      text('M1 Courier Run  ·  M2 The Getaway Car  ·  M3 Harbor Heist', VIEW.width / 2, 410, 17, PALETTE.gold, 'center', true);
      text('WASD move / drive · E enter car · F / click shoot', VIEW.width / 2, 448, 16, PALETTE.text, 'center');
      text('Press Space or click to start', VIEW.width / 2, 500, 20, PALETTE.gold, 'center', true);
      if (best > 0) text('Best score $' + best, VIEW.width / 2, 530, 16, PALETTE.muted, 'center');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) drawPanelScreen('Paused', ['The city waits for you.', 'Your progress is saved with Q.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) drawPanelScreen('Busted', ['Mara was caught. The Harbor Kings are not patient.', 'Score $' + state.player.money + '  ·  Best $' + best], 'Press Space or click to try again');
    else if (screen === SCREEN_WIN) drawPanelScreen('Debt Paid!', ['Mara finished all three jobs and is free.', 'Score $' + state.player.money + '  ·  Best $' + best], 'Press Space to keep roaming');
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
