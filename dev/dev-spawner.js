// dev/dev-spawner.js — HANYA untuk pengembangan: interval konstan agar game bisa dicoba
// sebelum spawner sungguhan ada. Ini BUKAN baseline (baseline = rancangan dan tulisan Mahameru)
// dan tidak boleh dipakai untuk data evaluasi.
(function (root) {
  class DevSpawner {
    constructor() { this.interval = (root.CONFIG || require('../js/config.js')).spawn.initialInterval; }
    reset() {}
    update() {}
    getInterval() { return this.interval; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = DevSpawner;
  else root.DevSpawner = DevSpawner;
})(typeof window !== 'undefined' ? window : globalThis);