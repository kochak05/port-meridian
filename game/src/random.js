// Seeded randomness (mulberry32): the same seed gives the same city, the
// same traffic and the same screenshot scenes, every time.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(random, list) { return list[Math.floor(random() * list.length)]; }
export function range(random, min, max) { return min + random() * (max - min); }
// Fisher-Yates shuffle, in place, driven by the seeded generator so the
// result is deterministic for a given seed.
export function shuffle(random, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
