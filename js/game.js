// game.js: logika inti Cozy Cafe, TANPA tampilan.
// Dipakai bersama oleh game di browser (main.js) dan simulasi di Node.
// Game tidak tahu cara kerja spawner; ia hanya mengikuti antarmuka di KONTRAK.md.

(function (root) {
  const RNGlib = (typeof module !== 'undefined' && module.exports) ? require('./rng.js') : root.RNG;

  // Dua gelas sama jika isinya sama persis (urutan tidak penting, jumlah penting).
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const x = [...a].sort(), y = [...b].sort();
    return x.every((v, i) => v === y[i]);
  }
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

  class Game {
    constructor({ config, seed, spawner, mode }) {
      this.config = config;
      this.seed = seed;
      this.spawner = spawner;
      this.mode = mode || 'unknown';
      this.reset();
    }

    reset() {
      // RNG ini HANYA untuk memilih pesanan, satu kali per pelanggan (lihat KONTRAK.md).
      this.orderRng = RNGlib.createRng(this.seed);
      this.time = 0;
      this.finished = false;
      this.score = 0;
      this.queue = [];      // pelanggan yang sedang mengantre (indeks 0 = terdepan)
      this.cup = [];        // isi gelas saat ini
      this.history = [];    // hasil tiap pelanggan yang sudah selesai
      this.samples = [];    // sampel per detik
      this.orders = [];     // urutan pesanan menurut nomor pelanggan
      this.nextId = 1;
      this.nextSampleAt = 1;
      this.spawnTimer = this.config.spawn.firstCustomerAt;
      this.spawner.reset(this);
    }

    // ---- aksi pemain ----
    addIngredient(key) {
      const name = this.config.ingredients[key];
      if (this.finished || !name || this.cup.length >= this.config.cupCapacity) return false;
      this.cup.push(name);
      return true;
    }

    discardCup() { this.cup = []; }

    serve() {
      if (this.finished) return { ok: false, reason: 'finished' };
      if (this.queue.length === 0) return { ok: false, reason: 'no_customer' };
      if (this.cup.length === 0) return { ok: false, reason: 'empty_cup' };
      const c = this.queue[0];
      const correct = sameSet(this.cup, c.recipe);
      this.cup = [];
      if (correct) {
        const { tipMax } = this.config.score;
        const tip = Math.round(tipMax * Math.max(0, c.patienceLeft) / this.config.customerPatience);
        this._finish(c, 'correct', tip);
        return { ok: true, outcome: 'correct', tip };
      }
      this._finish(c, 'wrong');   // salah sajikan: pelanggan pergi dengan kecewa
      return { ok: true, outcome: 'wrong' };
    }

    // ---- waktu berjalan (dt dalam detik) ----
    update(dt) {
      if (this.finished) return;
      const end = this.config.sessionSeconds;
      const prev = this.time;
      this.time = Math.min(end, prev + dt);
      const step = this.time - prev;

      // 1. kesabaran berkurang; yang habis pergi
      for (const c of [...this.queue]) {
        c.patienceLeft -= step;
        if (c.patienceLeft <= 0) this._finish(c, 'left');
      }

      // 2. spawner membaca state, lalu pelanggan baru muncul bila waktunya
      this.spawner.update(this, step);
      this.spawnTimer -= step;
      while (this.spawnTimer <= 0) {
        this._spawnCustomer();
        this.spawnTimer += Math.max(0.1, this.spawner.getInterval());
      }

      // 3. sampel per detik untuk metrik
      while (this.time >= this.nextSampleAt) {
        this.samples.push({
          t: this.nextSampleAt,
          queueLen: this.queue.length,
          interval: this.spawner.getInterval(),
          score: this.score,
        });
        this.nextSampleAt += 1;
      }

      if (this.time >= end) this.finished = true;
    }

    // ---- internal ----
    _spawnCustomer() {
      const item = this.orderRng.pick(this.config.menu);   // selalu 1x per pelanggan, termasuk yang ditolak
      const c = {
        id: this.nextId++,
        order: item.name,
        recipe: item.recipe,
        arrivedAt: this.time,
        patienceLeft: this.config.customerPatience,
      };
      this.orders.push(item.name);
      if (this.queue.length >= this.config.queueCapacity) { this._finish(c, 'rejected'); return; }
      this.queue.push(c);
    }

    _finish(c, outcome, tip = 0) {
      const sc = this.config.score;
      const delta = outcome === 'correct' ? sc.correct + tip : outcome === 'wrong' ? sc.wrong : sc.lost;
      this.score += delta;
      const idx = this.queue.indexOf(c);
      if (idx >= 0) this.queue.splice(idx, 1);
      this.history.push({
        id: c.id, order: c.order, outcome,
        arrivedAt: c.arrivedAt, endedAt: this.time, wait: this.time - c.arrivedAt,
        tip, scoreDelta: delta,
      });
    }

    // ---- ringkasan metrik (definisi mengikuti rancangan evaluasi) ----
    getSummary() {
      const h = this.history, s = this.samples;
      const count = (o) => h.filter((x) => x.outcome === o).length;
      const correct = count('correct'), wrong = count('wrong');
      const left = count('left'), rejected = count('rejected');
      const total = correct + wrong + left + rejected;
      const served = h.filter((x) => x.outcome === 'correct' || x.outcome === 'wrong');
      return {
        mode: this.mode, seed: this.seed, score: this.score,
        correct, wrong, left, rejected,
        customersArrived: this.orders.length,
        serviceRate: total ? correct / total : null,
        accuracy: correct + wrong ? correct / (correct + wrong) : null,
        avgServiceTime: mean(served.map((x) => x.wait)),
        crowdedPct: s.length ? (100 * s.filter((x) => x.queueLen >= 4).length) / s.length : null,
        avgQueueLen: mean(s.map((x) => x.queueLen)),
        avgInterval: mean(s.map((x) => x.interval)),
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);