// A small seeded generator (a 32-bit linear congruential generator): the same
// seed always deals the same city, the same traffic and the same pedestrians,
// which is what makes the screenshots repeatable and the play-test deterministic.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Pick one element of an array with the given generator.
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

// A number in [min, max) from the given generator.
export function range(random, min, max) {
  return min + random() * (max - min);
}
