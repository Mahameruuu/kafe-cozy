// Logika inti game. Tidak bergantung pada tampilan, sehingga bisa dijalankan
// di browser maupun di simulasi Node (tools/simulate.js).
(function (root) {
  const CC = (root.CC = root.CC || {});

  const SKIN = ['#f5d0b5', '#e8b796', '#c98e6b', '#9c6644', '#f1c9a5'];
  const HAIR = ['#3b2a20', '#6b4226', '#1f1a17', '#a0522d', '#d9a066', '#5a5a5a'];
  const SHIRT = ['#e07a5f', '#81b29a', '#f2cc8f', '#3d405b', '#b5838d', '#6d9dc5', '#c9ada7'];

  function sameRecipe(cup, recipe) {
    if (cup.length !== recipe.length) return false;
    const a = [...cup].sort().join('|');
    const b = [...recipe].sort().join('|');
    return a === b;
  }

  class Game {
    constructor(opts = {}) {
      this.cfg = opts.cfg || CC.Config;
      this.mode = opts.mode === 'adaptive' ? 'adaptive' : 'baseline';
      this.seed = (opts.seed ?? 2026) >>> 0;
      this.duration = opts.duration || this.cfg.SESSION_DURATION;
      this.playerId = opts.playerId || '-';

      // Dua RNG terpisah: urutan pesanan identik di kedua mode untuk seed yang sama.
      this.orderRng = CC.createRng(this.seed);
      this.lookRng = CC.createRng(this.seed ^ 0x9e3779b9);

      this.spawner =
        this.mode === 'adaptive' ? new CC.AdaptiveSpawner(this.cfg) : new CC.FixedSpawner(this.cfg);
      this.metrics = new CC.Metrics();

      this.time = 0;
      this.score = 0;
      this.queue = [];
      this.cup = [];
      this.nextId = 1;
      this.spawnTimer = this.cfg.FIRST_CUSTOMER_DELAY;
      this.sampleTimer = 0;
      this.finished = false;
      this.feedback = [];
    }

    update(dt) {
      if (this.finished) return;
      dt = Math.min(dt, this.duration - this.time);
      this.time += dt;

      for (const c of this.queue) c.patienceLeft -= dt;
      const leaving = this.queue.filter((c) => c.patienceLeft <= 0);
      if (leaving.length) {
        this.queue = this.queue.filter((c) => c.patienceLeft > 0);
        for (const c of leaving) {
          this.score += this.cfg.SCORE_MISSED;
          this.resolve(c, 'missed', 1);
          this.say(`${c.name} pergi... ${this.cfg.SCORE_MISSED}`, 'bad');
        }
      }

      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0) {
        this.spawnCustomer();
        this.spawnTimer += this.spawner.interval;
      }

      this.spawner.update(this);

      this.sampleTimer += dt;
      while (this.sampleTimer >= 1) {
        this.sampleTimer -= 1;
        this.metrics.sample(this);
      }

      for (const f of this.feedback) f.age += dt;
      this.feedback = this.feedback.filter((f) => f.age < 1.6);

      if (this.time >= this.duration - 1e-9) this.finish();
    }

    spawnCustomer() {
      const menu = this.cfg.MENU;
      const order = menu[Math.floor(this.orderRng() * menu.length)];
      const pick = (arr) => arr[Math.floor(this.lookRng() * arr.length)];
      const customer = {
        id: this.nextId++,
        name: `Tamu #${this.nextId - 1}`,
        order,
        arrive: this.time,
        patience: this.cfg.PATIENCE,
        patienceLeft: this.cfg.PATIENCE,
        look: { skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT), hairStyle: Math.floor(this.lookRng() * 3) },
      };

      if (this.queue.length >= this.cfg.MAX_QUEUE) {
        this.score += this.cfg.SCORE_MISSED;
        this.resolve(customer, 'rejected', 1);
        this.say(`Antrean penuh! ${this.cfg.SCORE_MISSED}`, 'bad');
        return;
      }
      this.queue.push(customer);
    }

    addIngredient(id) {
      if (this.finished) return;
      if (this.cup.length >= this.cfg.CUP_CAPACITY) {
        this.say('Gelas sudah penuh', 'warn');
        return;
      }
      this.cup.push(id);
    }

    discardCup() {
      if (this.finished || !this.cup.length) return;
      this.cup = [];
      this.metrics.discards++;
      this.say('Gelas dibuang', 'warn');
    }

    serve() {
      if (this.finished) return;
      if (!this.queue.length) return this.say('Belum ada pelanggan', 'warn');
      if (!this.cup.length) return this.say('Gelas masih kosong', 'warn');

      const c = this.queue.shift();
      const waitRatio = Math.min(1, (this.time - c.arrive) / c.patience);
      if (sameRecipe(this.cup, c.order.recipe)) {
        const tip = Math.round((this.cfg.SCORE_TIP_MAX * c.patienceLeft) / c.patience);
        const gain = this.cfg.SCORE_CORRECT + tip;
        this.score += gain;
        this.resolve(c, 'correct', waitRatio);
        this.say(`${c.order.name} pas! +${gain}`, 'good');
      } else {
        this.score += this.cfg.SCORE_WRONG;
        this.resolve(c, 'wrong', waitRatio);
        this.say(`Pesanan salah ${this.cfg.SCORE_WRONG}`, 'bad');
      }
      this.cup = [];
    }

    resolve(c, outcome, waitRatio) {
      this.metrics.record({
        id: c.id,
        order: c.order.id,
        outcome,
        arrive: c.arrive,
        end: this.time,
        waitRatio,
      });
    }

    say(text, kind) {
      this.feedback.push({ text, kind, age: 0 });
    }

    finish() {
      this.finished = true;
      this.summary = this.metrics.summary(this);
    }
  }

  CC.Game = Game;
  CC.sameRecipe = sameRecipe;
})(typeof window !== 'undefined' ? window : globalThis);
