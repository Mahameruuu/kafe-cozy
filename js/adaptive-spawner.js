// adaptive-spawner.js — spawner versi adaptif (milik Aurel).
// Mengikuti antarmuka di KONTRAK.md: reset(game), update(game, dt), getInterval().
// Hanya MEMBACA state game. Semua parameter adalah TEBAKAN AWAL (belum disetel dengan data);
// ubah lewat argumen konstruktor, dan catat setiap perubahan beserta alasannya.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Engine = isNode ? require('./fuzzy-engine.js') : root.FuzzyEngine;
  const SYSTEM = isNode ? require('./fuzzy-system.js') : root.FuzzySystem;

  const DEFAULTS = {
    windowSize: 6,      // jumlah pelanggan selesai yang dinilai
    minFinished: 3,     // minimal pelanggan selesai agar evaluasi dilakukan
    warmupTime: 12,     // tidak ada penyesuaian sebelum detik ini
    evalPeriod: 5,      // evaluasi tiap sekian detik (bukan tiap frame)
    maxStep: 1.0,       // |delta| maksimum per evaluasi (detik)
    minInterval: 3.0,
    maxInterval: 9.0,
    queueGuard: 3,      // antrean >= ini: percepatan dibatalkan
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const n = (v, d) => (typeof v === 'number' ? v.toFixed(d) : '');

  class AdaptiveSpawner {
    constructor(params = {}, system = SYSTEM) {
      this.params = { ...DEFAULTS, ...params };
      this.system = system;
      this.interval = null; this.nextEvalAt = 0; this.log = []; this.last = null;
    }

    reset(game) {
      this.interval = game.config.spawn.initialInterval;
      this.nextEvalAt = this.params.warmupTime;
      this.log = []; this.last = null;
    }

    getInterval() { return this.interval; }

    update(game) {
      if (game.time < this.nextEvalAt) return;
      this.nextEvalAt += this.params.evalPeriod;
      this._evaluate(game);
    }

    _evaluate(game) {
      const p = this.params, patience = game.config.customerPatience;
      const finished = game.history.slice(-p.windowSize);
      const row = { t: game.time, n: finished.length, queue: game.queue.length, before: this.interval, after: this.interval, flags: [] };
      if (finished.length < p.minFinished) { row.flags.push('data_kurang'); return this._push(row); }

      // Input 1: proporsi dilayani benar. Input 2: waktu tunggu relatif rata-rata
      // (pergi atau ditolak bernilai 1) ditambah pelanggan yang masih mengantre.
      const rel = (h) => (h.outcome === 'left' || h.outcome === 'rejected' ? 1 : Math.min(1, h.wait / patience));
      const waits = finished.map(rel).concat(game.queue.map((c) => clamp((game.time - c.arrivedAt) / patience, 0, 1)));
      row.akurasi = finished.filter((h) => h.outcome === 'correct').length / finished.length;
      row.waktu = mean(waits);

      const fz = Engine.mamdani(this.system, { akurasi: row.akurasi, waktu: row.waktu });
      row.fuzzy = fz; row.deltaFuzzy = fz.output;

      // Guardrail, berurutan: batas langkah -> pembatalan percepatan bila antrean padat -> batas interval.
      let delta = fz.output;
      if (Math.abs(delta) > p.maxStep) { delta = Math.sign(delta) * p.maxStep; row.flags.push('batas_langkah'); }
      if (delta < -1e-9 && game.queue.length >= p.queueGuard) { delta = 0; row.flags.push('antrean'); }
      row.deltaUsed = delta;
      let next = this.interval + delta;
      if (next < p.minInterval || next > p.maxInterval) { next = clamp(next, p.minInterval, p.maxInterval); row.flags.push('batas_interval'); }
      this.interval = next; row.after = next;
      this._push(row);
    }

    _push(row) { this.log.push(row); this.last = row; }

    // ---- opsional, dipakai main.js ----
    debugLines(game) {
      const L = this.last;
      const lines = ['interval: ' + this.interval.toFixed(2) + ' s', 'evaluasi berikutnya: t=' + this.nextEvalAt.toFixed(0)];
      if (!L) { lines.push(game.time < this.params.warmupTime ? 'pemanasan...' : 'belum ada evaluasi'); return lines; }
      if (L.flags.includes('data_kurang')) { lines.push('data kurang (' + L.n + ' pelanggan selesai)'); return lines; }
      const d = L.fuzzy.dominant;
      lines.push('akurasi ' + n(L.akurasi, 2) + '  waktu ' + n(L.waktu, 2),
        'dominan: ' + (d ? d.then + ' (' + n(d.strength, 2) + ')' : '-'),
        'delta fuzzy ' + n(L.deltaFuzzy, 2) + ' -> dipakai ' + n(L.deltaUsed, 2),
        'guardrail: ' + (L.flags.length ? L.flags.join(', ') : 'tidak ada'));
      return lines;
    }

    logCsv(tester, game) {
      const head = 'tester,seed,mode,t,n_data,akurasi,waktu,delta_fuzzy,aturan_dominan,kekuatan,delta_dipakai,guardrail,interval_sebelum,interval_sesudah,antrean';
      const rows = this.log.map((r) => {
        const d = r.fuzzy && r.fuzzy.dominant;
        return [tester, game.seed, game.mode, n(r.t, 1), r.n, n(r.akurasi, 3), n(r.waktu, 3), n(r.deltaFuzzy, 3),
          d ? d.then : '', d ? n(d.strength, 3) : '', n(r.deltaUsed, 3), r.flags.join(';') || 'tidak_ada',
          n(r.before, 3), n(r.after, 3), r.queue].join(',');
      });
      return [head, ...rows].join('\n') + '\n';
    }
  }

  AdaptiveSpawner.DEFAULTS = DEFAULTS;
  if (isNode) module.exports = AdaptiveSpawner;
  else root.AdaptiveSpawner = AdaptiveSpawner;
})(typeof window !== 'undefined' ? window : globalThis);