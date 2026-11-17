// Pengatur laju kedatangan pelanggan.
//  - FixedSpawner    : versi Baseline (Non-AI), interval selalu tetap.
//  - AdaptiveSpawner : versi Adaptif, interval diatur oleh fuzzy Mamdani
//                      berdasarkan performa pemain.
(function (root) {
  const CC = (root.CC = root.CC || {});
  const { trapmf, trimf, mamdani } = CC.Fuzzy;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

  // Input 1: akurasi layanan = pelanggan dilayani benar / pelanggan selesai (0..1)
  // Input 2: waktu tunggu relatif = lama menunggu / kesabaran (0..1)
  // Output : perubahan interval kedatangan (detik).
  //          Negatif = pelanggan datang lebih cepat (lebih sulit),
  //          positif = pelanggan datang lebih lambat (lebih mudah).
  const SYSTEM = {
    inputs: {
      akurasi: {
        range: [0, 1],
        sets: {
          rendah: (x) => trapmf(x, 0, 0, 0.5, 0.7),
          sedang: (x) => trimf(x, 0.5, 0.75, 0.9),
          tinggi: (x) => trapmf(x, 0.75, 0.9, 1, 1),
        },
      },
      waktu: {
        range: [0, 1],
        sets: {
          cepat: (x) => trapmf(x, 0, 0, 0.15, 0.3),
          normal: (x) => trimf(x, 0.2, 0.4, 0.6),
          lambat: (x) => trapmf(x, 0.5, 0.7, 1, 1),
        },
      },
    },
    output: {
      range: [-1.5, 1.5],
      sets: {
        percepat_banyak: (y) => trapmf(y, -1.5, -1.5, -1.2, -0.6),
        percepat: (y) => trimf(y, -1.2, -0.6, 0),
        tetap: (y) => trimf(y, -0.4, 0, 0.4),
        perlambat: (y) => trimf(y, 0, 0.6, 1.2),
        perlambat_banyak: (y) => trapmf(y, 0.6, 1.2, 1.5, 1.5),
      },
    },
    rules: [
      { if: { akurasi: 'tinggi', waktu: 'cepat' }, then: 'percepat_banyak' },
      { if: { akurasi: 'tinggi', waktu: 'normal' }, then: 'percepat' },
      { if: { akurasi: 'tinggi', waktu: 'lambat' }, then: 'tetap' },
      { if: { akurasi: 'sedang', waktu: 'cepat' }, then: 'percepat' },
      { if: { akurasi: 'sedang', waktu: 'normal' }, then: 'tetap' },
      { if: { akurasi: 'sedang', waktu: 'lambat' }, then: 'perlambat' },
      { if: { akurasi: 'rendah', waktu: 'cepat' }, then: 'tetap' },
      { if: { akurasi: 'rendah', waktu: 'normal' }, then: 'perlambat' },
      { if: { akurasi: 'rendah', waktu: 'lambat' }, then: 'perlambat_banyak' },
    ],
    resolution: 200,
  };

  // waiting = rasio tunggu pelanggan yang masih di antrean, supaya antrean
  // yang mulai menumpuk langsung terdeteksi (tidak menunggu pelanggan selesai).
  function summarizeOutcomes(recent, waiting = []) {
    const correct = recent.filter((r) => r.outcome === 'correct').length;
    const ratios = recent.map((r) => r.waitRatio).concat(waiting);
    return {
      akurasi: correct / recent.length,
      waktu: clamp(mean(ratios), 0, 1),
    };
  }

  class FixedSpawner {
    constructor(cfg) {
      this.cfg = cfg;
      this.interval = cfg.BASE_SPAWN_INTERVAL;
      this.log = [];
      this.lastEval = null;
    }

    get label() {
      return 'Baseline (Non-AI)';
    }

    update() {}
  }

  class AdaptiveSpawner {
    constructor(cfg) {
      this.cfg = cfg;
      this.interval = cfg.BASE_SPAWN_INTERVAL;
      this.nextEval = cfg.ADAPT_WARMUP;
      this.log = [];
      this.lastEval = null;
    }

    get label() {
      return 'Adaptif (Fuzzy)';
    }

    update(game) {
      if (game.time < this.nextEval) return;
      this.nextEval += this.cfg.ADAPT_PERIOD;

      const recent = game.metrics.recentOutcomes(this.cfg.ADAPT_WINDOW);
      if (recent.length < this.cfg.ADAPT_MIN_SAMPLES) return;

      const waiting = game.queue.map((c) => Math.min(1, (game.time - c.arrive) / c.patience));
      const inputs = summarizeOutcomes(recent, waiting);
      const result = mamdani(SYSTEM, inputs);
      if (result.value === null) return;

      const step = this.cfg.ADAPT_MAX_STEP;
      let delta = clamp(result.value, -step, step);

      // Guardrail: jangan mempercepat kedatangan ketika antrean sudah padat.
      const guarded = delta < 0 && game.queue.length >= this.cfg.ADAPT_QUEUE_GUARD;
      if (guarded) delta = 0;
      const before = this.interval;
      this.interval = clamp(before + delta, this.cfg.MIN_SPAWN_INTERVAL, this.cfg.MAX_SPAWN_INTERVAL);

      const strongest = result.firing.reduce((a, b) => (b.strength > a.strength ? b : a));
      this.lastEval = {
        t: game.time,
        samples: recent.length,
        akurasi: inputs.akurasi,
        waktu: inputs.waktu,
        fuzzyOutput: result.value,
        delta,
        guarded,
        queue: game.queue.length,
        intervalBefore: before,
        intervalAfter: this.interval,
        rule: `${strongest.rule.if.akurasi}+${strongest.rule.if.waktu} -> ${strongest.rule.then}`,
        ruleStrength: strongest.strength,
      };
      this.log.push(this.lastEval);
    }
  }

  CC.DifficultySystem = SYSTEM;
  CC.summarizeOutcomes = summarizeOutcomes;
  CC.FixedSpawner = FixedSpawner;
  CC.AdaptiveSpawner = AdaptiveSpawner;
})(typeof window !== 'undefined' ? window : globalThis);
