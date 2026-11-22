// rng.js: pengacak ber-seed (mulberry32).
// Seed yang sama selalu menghasilkan urutan yang sama.

(function (root) {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRng(seed) {
    const next = mulberry32(seed);
    return {
      next,                                    // 0 <= x < 1
      pick: (arr) => arr[Math.floor(next() * arr.length)],
    };
  }

  const API = { mulberry32, createRng };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.RNG = API;
})(typeof window !== 'undefined' ? window : globalThis);