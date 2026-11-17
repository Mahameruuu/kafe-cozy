// Random number generator dengan seed (mulberry32).
// Seed yang sama menghasilkan urutan pesanan yang sama di kedua versi.
(function (root) {
  const CC = (root.CC = root.CC || {});

  CC.createRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
