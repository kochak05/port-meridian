// Port Meridian — the game's rules and state, with no drawing and no
// browser in it: the player on foot and in cars, traffic, pedestrians,
// police, missions, combat, wanted level and pickups. step() advances
// one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about
// screens at all.
import { BLOCK, CAR, MISSIONS, PALETTE, PED, PLAYER, POLICE, ROAD, TARGET_RADIUS, TRAFFIC, WORLD } from './config.js';
import { angleTo, clamp, dist, pick, range, shuffle } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_WANTED = 16;
export const EVENT_SHOOT = 32;

function overlapsCircleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}
function pushOutCircleRect(p, r, rect) {
  const nx = clamp(p.x, rect.x, rect.x + rect.w);
  const ny = clamp(p.y, rect.y, rect.y + rect.h);
  let dx = p.x - nx, dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 === 0) { p.y = rect.y - r; return true; }
  const d = Math.sqrt(d2);
  p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r;
  return true;
}

export function createWorld(random) {
  // --- city: one building (or park / car park) per block between roads ---
  const buildings = [];
  const roadX = []; for (let c = 160; c < WORLD.width; c += BLOCK) roadX.push(c);
  const roadY = []; for (let c = 160; c < WORLD.height; c += BLOCK) roadY.push(c);
  const colours = [PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC, PALETTE.buildingD, PALETTE.buildingE];
  for (let ix = 0; ix < roadX.length - 1; ix++) {
    for (let iy = 0; iy < roadY.length - 1; iy++) {
      const bx = roadX[ix] + ROAD / 2 + 14, by = roadY[iy] + ROAD / 2 + 14;
      const bw = BLOCK - ROAD - 28, bh = BLOCK - ROAD - 28;
      const roll = random();
      if (roll < 0.12) { buildings.push({ x: bx, y: by, w: bw, h: bh, kind: 'park', color: PALETTE.park }); continue; }
      if (roll < 0.2) { buildings.push({ x: bx, y: by, w: bw, h: bh, kind: 'lot', color: PALETTE.sidewalk }); continue; }
      buildings.push({ x: bx + 8, y: by + 8, w: bw - 16, h: bh - 16, kind: 'building', color: pick(random, colours), windows: 3 + Math.floor(random() * 4) });
    }
  }
  // Landmark labels, drawn by the renderer at fixed corners of the city.
  const landmarks = [
    { x: 416, y: 352, label: 'Harbor Diner' },
    { x: 2208, y: 352, label: 'Marina Tower' },
    { x: 1440, y: 1632, label: 'Stadium' },
    { x: 416, y: 1632, label: 'South Garage' },
    { x: 2208, y: 1632, label: 'Old Warehouse' },
    { x: 1440, y: 416, label: 'Rooftop' },
    { x: 1312, y: 992, label: 'Meridian Plaza' },
    { x: 672, y: 992, label: 'Bay Park' },
  ];

  const player = { x: 1280, y: 992, angle: -Math.PI / 2, health: PLAYER.health, money: 0, ammo: PLAYER.ammo, inCar: false, car: null, speed: 0, fireCd: 0, invuln: 0 };
  const state = {
    player, buildings, landmarks, roadX, roadY,
    cars: [], peds: [], police: [], guards: [], bullets: [], pickups: [], particles: [],
    wanted: 0, wantedTimer: 0, crimeTimer: 0,
    missionIndex: 0, missionStage: 'pickup', missionDone: false, allDone: false,
    message: '', messageTimer: 0, elapsed: 0, kills: 0, carsStolen: 0, score: 0,
    sirenTimer: 0, camera: { x: 1280, y: 992, zoom: 1 },
  };

  function spawnCar(x, y, angle, color, kind) {
    const car = { x, y, angle, speed: 0, color, kind: kind || 'traffic', lane: 0, axis: 'x', dir: 1, targetSpeed: TRAFFIC.speed };
    state.cars.push(car); return car;
  }
  function spawnTraffic() {
    for (let i = 0; i < TRAFFIC.count; i++) {
      const horizontal = random() < 0.5;
      const road = pick(random, horizontal ? roadY : roadX);
      const along = range(random, 100, (horizontal ? WORLD.width : WORLD.height) - 100);
      const car = spawnCar(horizontal ? along : road + (random() < 0.5 ? -16 : 16), horizontal ? road + (random() < 0.5 ? -16 : 16) : along, horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), pick(random, PALETTE.traffic));
      car.axis = horizontal ? 'x' : 'y'; car.dir = car.angle === 0 || car.angle === Math.PI / 2 ? 1 : -1;
      car.speed = range(random, 120, 200);
    }
    // Parked cars the player can steal, including the gold coupe for M2.
    // Every spot sits on a road (a road centre on one axis), never inside
    // a building block, so the player can actually reach and enter it.
    const spots = [[672, 992], [992, 672], [1696, 1312], [1952, 992], [992, 1696], [2240, 992]];
    shuffle(random, spots);
    for (const [x, y] of spots) spawnCar(x, y, random() < 0.5 ? 0 : Math.PI / 2, pick(random, PALETTE.traffic), 'parked');
    // Gold coupe on the stadium road (x = 1440 is a road centre), not
    // inside the stadium block where the player could not reach it.
    const gold = spawnCar(1440, 1632, 0, '#f2c94c', 'gold');
    gold.isGold = true;
  }
  function spawnPeds() {
    for (let i = 0; i < PED.count; i++) {
      state.peds.push({ x: range(random, 100, WORLD.width - 100), y: range(random, 100, WORLD.height - 100), angle: range(random, 0, Math.PI * 2), speed: PED.walkSpeed, color: pick(random, PALETTE.ped), panic: 0, change: range(random, 1, 4) });
    }
  }
  function spawnPickups() {
    // Pickups sit on roads (one coordinate on a road centre) so the
    // player can always walk/drive to them; a pickup buried inside a
    // building block would be unreachable.
    for (let i = 0; i < 10; i++) {
      const onVerticalRoad = random() < 0.5;
      const px = onVerticalRoad ? pick(random, roadX) : range(random, 200, WORLD.width - 200);
      const py = onVerticalRoad ? range(random, 200, WORLD.height - 200) : pick(random, roadY);
      state.pickups.push({ x: px, y: py, kind: i % 3 === 0 ? 'health' : 'cash', value: i % 3 === 0 ? 30 : 50, bob: random() * 6 });
    }
    state.pickups.push({ x: 672, y: 352, kind: 'cash', value: 100, bob: 0 });
  }
  function spawnGuards() {
    state.guards = [];
    const spots = [[2180, 1580], [2300, 1680], [2240, 1560]];
    for (const [x, y] of spots) state.guards.push({ x, y, angle: 0, health: 60, fireCd: range(random, 0.5, 1.5), alive: true });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) state.particles.push({ x, y, vx: range(random, -120, 120), vy: range(random, -120, 120), life: 0.5, color });
  }
  function setMessage(text, seconds) { state.message = text; state.messageTimer = seconds || 4; }
  function mission() { return MISSIONS[state.missionIndex]; } // the job Mara is on now
  function targetPos() {
    if (state.allDone) return null;
    const m = mission();
    return state.missionStage === 'pickup' ? m.pickup : m.dropoff;
  }
  function addWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    if (state.wanted > before) return EVENT_WANTED;
    return 0;
  }
  function startMission(index) {
    state.missionIndex = index; state.missionStage = 'pickup';
    const m = mission();
    if (m.wantedOnStart > state.wanted) state.wanted = m.wantedOnStart;
    if (m.id === 'heist') spawnGuards();
    setMessage(m.title + ' — ' + m.intro, 6);
  }
  function completeStage() {
    const m = mission();
    if (state.missionStage === 'pickup') {
      state.missionStage = 'dropoff';
      setMessage('Got it. Now get to ' + m.dropoff.label + '.', 4);
      return EVENT_MISSION;
    }
    player.money += m.reward; state.score += m.reward;
    setMessage(m.title + ' complete! +$' + m.reward, 5);
    if (state.missionIndex + 1 >= MISSIONS.length) {
      state.allDone = true; state.missionDone = true;
      setMessage('DEBT PAID. Mara is free — Port Meridian is hers. Final score $' + player.money, 8);
    } else startMission(state.missionIndex + 1);
    return EVENT_MISSION;
  }

  function reset() {
    player.x = 1280; player.y = 992; player.angle = -Math.PI / 2; player.health = PLAYER.health;
    player.money = 0; player.ammo = PLAYER.ammo; player.inCar = false; player.car = null; player.speed = 0; player.fireCd = 0; player.invuln = 0;
    state.cars = []; state.peds = []; state.police = []; state.guards = []; state.bullets = []; state.pickups = []; state.particles = [];
    state.wanted = 0; state.wantedTimer = 0; state.crimeTimer = 0; state.missionIndex = 0; state.missionStage = 'pickup';
    state.missionDone = false; state.allDone = false; state.elapsed = 0; state.kills = 0; state.carsStolen = 0; state.score = 0;
    spawnTraffic(); spawnPeds(); spawnPickups();
    setMessage(MISSIONS[0].title + ' — ' + MISSIONS[0].intro, 6);
  }

  function collideBuildings(p, r) {
    for (const b of buildings) {
      if (b.kind !== 'building') continue;
      pushOutCircleRect(p, r, b);
    }
    p.x = clamp(p.x, 24, WORLD.width - 24); p.y = clamp(p.y, 24, WORLD.height - 24);
  }
  function nearestCar(maxDist) {
    let best = null, bestD = maxDist;
    for (const car of state.cars) {
      if (car === player.car) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
  function enterCar() {
    const car = nearestCar(70);
    if (!car) return 0;
    player.inCar = true; player.car = car; car.kind = 'player';
    // The gold coupe is identified by its isGold flag, not by kind:
    // kind was just overwritten to 'player' above.
    if (!car.stolen) {
      car.stolen = true; state.carsStolen += 1;
      if (state.missionIndex === 1 && state.missionStage === 'pickup' && car.isGold) {
        setMessage('That is the one. Drive it to the South Garage — fast.', 4);
        return EVENT_MISSION;
      }
      return addWanted(CAR.stealWanted);
    }
    return 0;
  }
  function exitCar() {
    const car = player.car; if (!car) return;
    player.inCar = false; player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.angle = car.angle;
  }
  function shoot(aimAngle) {
    if (player.fireCd > 0 || player.inCar) return 0;
    if (player.ammo <= 0) {
      // No ammo: punch anything close instead.
      for (const g of state.guards) {
        if (g.alive && dist(player.x, player.y, g.x, g.y) < PLAYER.punchRange + 14) { g.health -= PLAYER.punchDamage; burst(g.x, g.y, '#ffffff', 4); if (g.health <= 0) { g.alive = false; state.kills += 1; } }
      }
      player.fireCd = 0.35; return EVENT_SHOOT;
    }
    player.ammo -= 1; player.fireCd = PLAYER.fireInterval;
    state.bullets.push({ x: player.x + Math.cos(aimAngle) * 20, y: player.y + Math.sin(aimAngle) * 20, vx: Math.cos(aimAngle) * PLAYER.bulletSpeed, vy: Math.sin(aimAngle) * PLAYER.bulletSpeed, from: 'player', life: 1.2 });
    return EVENT_SHOOT;
  }

  function stepPolice(dt) {
    const want = state.wanted;
    while (state.police.length < want) {
      const a = range(random, 0, Math.PI * 2);
      const car = spawnCar(clamp(player.x + Math.cos(a) * 700, 60, WORLD.width - 60), clamp(player.y + Math.sin(a) * 700, 60, WORLD.height - 60), 0, PALETTE.police, 'police');
      car.speed = POLICE.chaseSpeed; state.police.push(car);
    }
    while (state.police.length > want) {
      const car = state.police.pop();
      const i = state.cars.indexOf(car); if (i >= 0) state.cars.splice(i, 1);
    }
    for (const car of state.police) {
      const tx = player.inCar && player.car ? player.car.x : player.x;
      const ty = player.inCar && player.car ? player.car.y : player.y;
      const a = angleTo(car.x, car.y, tx, ty);
      let da = a - car.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      car.angle += clamp(da, -2.4 * dt, 2.4 * dt);
      car.speed = POLICE.chaseSpeed;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      collideBuildings(car, 20);
      const d = dist(car.x, car.y, tx, ty);
      if (d < 46) {
        if (player.inCar && player.car) { player.car.speed *= 0.92; }
        else if (player.invuln <= 0) { player.health -= POLICE.ramDamage; player.invuln = 0.8; burst(player.x, player.y, '#ff5a4e', 6); }
      }
      // At 3+ stars the police shoot from the car.
      if (state.wanted >= 3 && d < POLICE.shootRange && random() < dt * 0.7) {
        state.bullets.push({ x: car.x, y: car.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, from: 'police', life: 1.4 });
      }
    }
  }

  function step(dt, input, aimAngle, shootPressed) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (player.fireCd > 0) player.fireCd -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (shootPressed) events |= shoot(aimAngle);
    state.crimeTimer += dt;
    if (state.wanted > 0 && state.crimeTimer > 25) { state.wanted -= 1; state.crimeTimer = 0; setMessage('The heat is cooling off. Wanted level down.', 3); }

    // --- player movement ---
    if (player.inCar && player.car) {
      const car = player.car;
      // W/up: accelerate. S/down: brake while moving forward, reverse
      // once stopped. No input: coast to a stop.
      if (input.y > 0 && car.speed > 0) car.speed = Math.max(0, car.speed - CAR.brake * dt);
      else if (input.y < 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
      else if (input.y > 0) car.speed = Math.max(-CAR.reverse, car.speed - CAR.accel * 0.6 * dt);
      else car.speed *= Math.max(0, 1 - 0.9 * dt);
      const steer = input.x * CAR.turn * clamp(Math.abs(car.speed) / 200, 0, 1) * (car.speed < 0 ? -1 : 1);
      car.angle += steer * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      car.x = nx; car.y = ny;
      let hit = false;
      for (const b of buildings) { if (b.kind === 'building' && overlapsCircleRect(car.x, car.y, 20, b)) { hit = true; pushOutCircleRect(car, 20, b); car.speed *= 0.4; } }
      if (hit && Math.abs(car.speed) > 120) { events |= EVENT_HIT; burst(car.x, car.y, '#ffb347', 6); }
      car.x = clamp(car.x, 24, WORLD.width - 24); car.y = clamp(car.y, 24, WORLD.height - 24);
      player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = car.speed;
      // Running over a pedestrian is a crime.
      for (const ped of state.peds) {
        if (dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 60) {
          ped.x = range(random, 200, WORLD.width - 200); ped.y = range(random, 200, WORLD.height - 200);
          events |= addWanted(1); burst(ped.x, ped.y, '#ffffff', 5);
        }
      }
    } else {
      const sprint = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const mx = input.x, my = input.y;
      const len = Math.hypot(mx, my) || 1;
      if (mx || my) {
        player.x += (mx / len) * sprint * dt;
        player.y += (my / len) * sprint * dt;
        player.angle = Math.atan2(my, mx);
        player.speed = sprint;
      } else player.speed = 0;
      collideBuildings(player, PLAYER.radius);
    }

    // --- traffic: follow the roads, wrap around the city ---
    for (const car of state.cars) {
      if (car.kind === 'player' || car.kind === 'police') continue;
      if (car.kind === 'parked' || car.kind === 'gold') continue;
      if (car.axis === 'x') { car.x += car.dir * car.speed * dt; if (car.x > WORLD.width + 40) car.x = -40; if (car.x < -40) car.x = WORLD.width + 40; }
      else { car.y += car.dir * car.speed * dt; if (car.y > WORLD.height + 40) car.y = -40; if (car.y < -40) car.y = WORLD.height + 40; }
    }

    // --- pedestrians: stroll the sidewalks, panic and run from gunfire ---
    for (const ped of state.peds) {
      ped.change -= dt;
      if (ped.change <= 0) { ped.angle = range(random, 0, Math.PI * 2); ped.change = range(random, 1.5, 5); }
      const sp = ped.panic > 0 ? PED.walkSpeed * 2.4 : PED.walkSpeed;
      ped.x += Math.cos(ped.angle) * sp * dt; ped.y += Math.sin(ped.angle) * sp * dt;
      if (ped.panic > 0) ped.panic -= dt;
      if (ped.x < 40 || ped.x > WORLD.width - 40) ped.angle = Math.PI - ped.angle;
      if (ped.y < 40 || ped.y > WORLD.height - 40) ped.angle = -ped.angle;
      ped.x = clamp(ped.x, 30, WORLD.width - 30); ped.y = clamp(ped.y, 30, WORLD.height - 30);
    }

    stepPolice(dt);
    if (state.wanted > 0) { state.sirenTimer -= dt; if (state.sirenTimer <= 0) { state.sirenTimer = 1.6; } }

    // --- guards (mission 3): shoot at the player on foot when close ---
    for (const g of state.guards) {
      if (!g.alive) continue;
      const d = dist(g.x, g.y, player.x, player.y);
      if (d < 420 && !player.inCar) {
        g.angle = angleTo(g.x, g.y, player.x, player.y);
        g.fireCd -= dt;
        // Guards fire every 1.6 s (was 1.1): at wanted 3 the police are
        // already shooting too, and the old rate killed Mara before she
        // could close in to return fire in M3.
        if (g.fireCd <= 0) { g.fireCd = 1.6; state.bullets.push({ x: g.x, y: g.y, vx: Math.cos(g.angle) * 480, vy: Math.sin(g.angle) * 480, from: 'guard', life: 1.4 }); }
      }
    }

    // --- bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
      if (!dead && b.from === 'player') {
        for (const g of state.guards) {
          if (g.alive && dist(b.x, b.y, g.x, g.y) < 18) {
            g.health -= PLAYER.bulletDamage; burst(g.x, g.y, '#ff5a4e', 6); dead = true;
            if (g.health <= 0) { g.alive = false; state.kills += 1; player.money += 50; events |= EVENT_COIN; }
            break;
          }
        }
        if (!dead) for (const car of state.police) {
          if (dist(b.x, b.y, car.x, car.y) < 26) { burst(car.x, car.y, '#5aa8ff', 6); dead = true; break; }
        }
      }
      if (!dead && b.from !== 'player' && !player.inCar && player.invuln <= 0 && dist(b.x, b.y, player.x, player.y) < 16) {
        player.health -= b.from === 'guard' ? 10 : 8; player.invuln = 0.5; burst(player.x, player.y, '#ff5a4e', 6); events |= EVENT_HIT; dead = true;
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // --- pickups ---
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      if (dist(player.x, player.y, pk.x, pk.y) < 30) {
        if (pk.kind === 'cash') { player.money += pk.value; state.score += pk.value; }
        else player.health = Math.min(PLAYER.health, player.health + pk.value);
        burst(pk.x, pk.y, '#f2c94c', 8); state.pickups.splice(i, 1); events |= EVENT_COIN;
      }
    }

    // --- mission target ---
    const target = targetPos();
    if (target && !state.allDone) {
      const d = dist(player.x, player.y, target.x, target.y);
      const isGoldStage = state.missionIndex === 1 && state.missionStage === 'pickup';
      if (isGoldStage) {
        if (player.inCar && player.car && player.car.isGold) events |= completeStage();
      } else if (d < TARGET_RADIUS) {
        if (state.missionIndex === 2 && state.missionStage === 'pickup') {
          const alive = state.guards.filter((g) => g.alive).length;
          if (alive > 0) { setMessage('Guards first! ' + alive + ' left. Shoot (F / click) or punch up close.', 2); }
          else events |= completeStage();
        } else events |= completeStage();
      }
    }

    // --- particles ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    if (player.health <= 0) { player.health = 0; events |= EVENT_OVER; }
    // Camera follows the player.
    state.camera.x = clamp(player.x, 640, WORLD.width - 640);
    state.camera.y = clamp(player.y, 360, WORLD.height - 360);
    return events;
  }

  function saveData() {
    return { money: player.money, health: player.health, ammo: player.ammo, missionIndex: state.missionIndex, missionStage: state.missionStage, x: player.x, y: player.y, wanted: state.wanted, score: state.score };
  }
  function loadData(data) {
    if (!data) return false;
    player.money = data.money || 0; player.health = data.health || PLAYER.health; player.ammo = data.ammo || PLAYER.ammo;
    state.score = data.score || 0; state.wanted = data.wanted || 0;
    if (typeof data.x === 'number') { player.x = clamp(data.x, 40, WORLD.width - 40); player.y = clamp(data.y, 40, WORLD.height - 40); }
    if (typeof data.missionIndex === 'number' && data.missionIndex < MISSIONS.length) {
      state.missionIndex = data.missionIndex; state.missionStage = data.missionStage || 'pickup';
      if (MISSIONS[state.missionIndex].id === 'heist') spawnGuards();
      setMessage(MISSIONS[state.missionIndex].title + ' — save loaded.', 4);
    }
    return true;
  }

  reset();
  return { state, reset, step, enterCar, exitCar, shoot, nearestCar, targetPos, mission, startMission, saveData, loadData, setMessage };
}
