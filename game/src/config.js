// Port Meridian — tuning, palette, city layout and mission script.
// Every number and colour in one place. The world is 2560 x 1920 px; the
// camera shows a 1280 x 720 window of it and follows the player.
export const WORLD = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const ROAD = 64; // road width
export const BLOCK = 256; // road centre spacing (road + block)
export const TARGET_RADIUS = 56; // how close the player must get to a mission target
export const SAVE_KEY = 'port-meridian.save.v1';
export const BEST_KEY = 'port-meridian.best';

export const PLAYER = {
  walkSpeed: 230, sprintSpeed: 330, radius: 14,
  // 48 rounds: enough for the 3 warehouse guards (2 hits each at 34
  // damage) plus police cars, with room for missed shots. The old 24
  // ran out before Mara could close the distance in M3.
  health: 100, ammo: 48, punchRange: 34, punchDamage: 20,
  bulletDamage: 34, bulletSpeed: 720, fireInterval: 0.22,
};
export const CAR = {
  accel: 420, brake: 700, reverse: 220, maxSpeed: 560,
  turn: 2.6, grip: 3.2, length: 52, width: 26, stealWanted: 1,
};
export const POLICE = { chaseSpeed: 500, ramDamage: 8, shootRange: 340 };
export const PED = { walkSpeed: 55, count: 26 };
export const TRAFFIC = { count: 14, speed: 170 };

export const PALETTE = {
  backdrop: '#0e1420', grass: '#3f7d4a', grass2: '#37703f',
  sidewalk: '#9aa0a8', road: '#2b2f36', roadLine: '#e8c84a',
  buildingA: '#c98a5a', buildingB: '#5a7fa8', buildingC: '#8a6fa8',
  buildingD: '#a85a6a', buildingE: '#5aa88a', roof: '#3a3f4a',
  water: '#2e6f8e', sand: '#d9c48a', park: '#2f6b3a',
  player: '#ffd23f', playerOutline: '#7a5b00',
  police: '#2f6fd0', policeLight: '#ff3b30',
  traffic: ['#e5534b', '#4fc3f7', '#f2c94c', '#9b7ede', '#e8e8e8', '#7ed07e'],
  ped: ['#ff9f43', '#ff6b9d', '#7ec8ff', '#c9f27e', '#e8a0ff'],
  text: '#f2f5f8', muted: '#b9c2cc', panel: '#141a26',
  gold: '#f2c94c', green: '#4ade80', red: '#ff5a4e', blue: '#5aa8ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The story: Mara Voss, a courier driver in Port Meridian, owes money to
// the Harbor Kings crew and works it off job by job. All names are invented.
// Mission targets sit on roads (one coordinate is a road centre), never
// inside a building block: the player on foot is pushed out of buildings,
// so a target buried in a block would be unreachable. Landmarks below
// stay at the named places; targets sit on the road beside them.
export const MISSIONS = [
  {
    id: 'courier', title: 'M1 · Courier Run',
    intro: 'Mara owes the Harbor Kings. First job: pick up a package at the Harbor Diner, deliver it to Marina Tower. No questions.',
    pickup: { x: 416, y: 352, label: 'Harbor Diner' },
    dropoff: { x: 2208, y: 352, label: 'Marina Tower' },
    reward: 300, wantedOnStart: 0,
  },
  {
    id: 'getaway', title: 'M2 · The Getaway Car',
    intro: 'The crew needs a fast car. Steal the gold coupe parked by the stadium and bring it to the South Garage. The police will notice.',
    pickup: { x: 1440, y: 1632, label: 'Gold coupe — steal it (E)' },
    dropoff: { x: 416, y: 1632, label: 'South Garage' },
    reward: 500, wantedOnStart: 2,
  },
  {
    id: 'heist', title: 'M3 · Harbor Heist',
    intro: 'Last job: walk into the old warehouse, take the cash from the safe, and get out. Guards are armed. Finish this and Mara is free.',
    pickup: { x: 2208, y: 1632, label: 'Warehouse safe' },
    dropoff: { x: 1440, y: 416, label: 'Rooftop rendezvous' },
    reward: 800, wantedOnStart: 3,
  },
];

export const STORY_BEATS = [
  'Mara Voss drove couriers for the Harbor Kings. One bad night, she owed them everything.',
  'Three jobs. No questions. Then the debt is gone — and Port Meridian is hers again.',
  'Drive, run, fight. The city never sleeps, and neither do the police.',
];

export function roadCentres(size) {
  const list = [];
  for (let c = 160; c < size; c += BLOCK) list.push(c);
  return list;
}
