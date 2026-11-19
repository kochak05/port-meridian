// Port Meridian: every tuning number for the open world in one place.
// The world is a fixed 2560x1920 city; the renderer shows a 1280x720 camera
// window of it, so nothing below depends on the browser window size.

export const WORLD = { width: 2560, height: 1920 };

// Road centre lines. Roads are 140 px wide, so a road band is centre +/- 70.
export const ROAD_X = [320, 960, 1600, 2240];
export const ROAD_Y = [320, 960, 1600];
export const ROAD_HALF = 70;

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  hp: 100,
  shootCooldown: 0.28,
  bulletSpeed: 620,
  bulletDamage: 34,
  ammoStart: 48,
};

export const CAR = {
  length: 54,
  width: 28,
  accel: 340,
  brake: 520,
  maxSpeed: 430,
  maxReverse: 140,
  steer: 2.6,
  drag: 0.9,
};

export const TRAFFIC = { count: 14, speed: 150 };
export const PEDS = { count: 18, speed: 55 };

export const COP = {
  maxSpeed: 470,
  accel: 380,
  ramDamage: 9,
  ramCooldown: 0.7,
  // Wanted decays after this many seconds with no cop within sight range.
  decayAfter: 9,
  sight: 820,
};

export const GUARD = { hp: 60, shootCooldown: 1.4, bulletSpeed: 420, range: 320 };

// Mission payouts. Three missions pay 350 + 500 + 950 = 1800 in total.
export const MISSIONS = [
  {
    id: 'courier',
    name: 'Courier Run',
    brief: 'Pick up the parcel at the north-east corner, then drop it at the south-west docks.',
    pickup: { x: 2240, y: 320, label: 'Parcel pickup' },
    dropoff: { x: 320, y: 1600, label: 'Parcel dropoff' },
    reward: 350,
  },
  {
    id: 'getaway',
    name: 'Getaway Car',
    brief: 'Steal the gold coupe in the north-west, then lose the cops and reach the east garage.',
    pickup: { x: 320, y: 320, label: 'Gold coupe' },
    dropoff: { x: 1600, y: 1600, label: 'East garage' },
    reward: 500,
    wantedOnSteal: 3,
  },
  {
    id: 'heist',
    name: 'Harbor Heist',
    brief: 'Break into the harbor warehouse, clear the guards, crack the safe, reach the rendezvous.',
    pickup: { x: 2240, y: 1600, label: 'Harbor warehouse' },
    dropoff: { x: 960, y: 320, label: 'Rendezvous' },
    reward: 950,
    wantedOnSteal: 2,
    guards: 3,
  },
];

export const PALETTE = {
  backdrop: '#0d1420',
  grass: '#2e5d3a',
  block: '#3a4a3f',
  road: '#2b2f36',
  roadLine: '#c8b45a',
  sidewalk: '#565d66',
  building: '#7a6a8c',
  buildingRoof: '#9a8ab0',
  water: '#1d5f8a',
  player: '#ffd23f',
  playerCar: '#e8b10c',
  goldCar: '#f2c94c',
  traffic: ['#c94f4f', '#4f7ec9', '#5fbf6a', '#c9c9c9', '#8a5fc9'],
  cop: '#2b4fd8',
  copLight: '#ff3b30',
  ped: '#e8e8e8',
  guard: '#3d2b1f',
  bullet: '#ffe066',
  text: '#f2f4f7',
  muted: '#9aa5b1',
  panel: '#141c28',
  star: '#ffd23f',
  hp: '#4fc94f',
  hpLow: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'port-meridian.save.v1';
export const BEST_KEY = 'port-meridian.best.v1';
