// tools/bot.js — bot pemain untuk simulasi (Node saja).
// Bot hanya memakai aksi yang sama dengan keyboard: addIngredient, serve, discardCup.
// Bot punya RNG sendiri, sehingga tidak mengganggu urutan pesanan game (lihat KONTRAK.md).
const RNG = require('../js/rng.js');

// Profil awal dari rancangan; belum disetel. pourMean = rata-rata detik per bahan,
// errRate = peluang salah memilih bahan, noticeP = peluang menyadari gelas salah lalu membuangnya.
const PROFILES = {
  pemula: { pourMean: 1.5, errRate: 0.15, noticeP: 0.30 },
  menengah: { pourMean: 0.95, errRate: 0.07, noticeP: 0.60 },
  ahli: { pourMean: 0.55, errRate: 0.02, noticeP: 0.90 },
};
const TIMES = { serve: 0.3, discard: 0.3, poll: 0.1 };

const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const x = [...a].sort(), y = [...b].sort();
  return x.every((v, i) => v === y[i]);
};

class Bot {
  // profile: objek profil, atau fungsi (t) => profil untuk kemampuan yang berubah di tengah sesi.
  constructor({ seed, profile }) {
    this.rng = RNG.createRng(seed);
    this.profileFn = typeof profile === 'function' ? profile : () => profile;
    this.wait = 0; this.pending = { type: 'poll' }; this.target = null; this.plan = [];
  }

  profile(t) { return this.profileFn(t); }

  normal() {
    const u1 = Math.max(1e-12, this.rng.next()), u2 = this.rng.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  pourTime(t) { return Math.max(0.2, this.profile(t).pourMean * (1 + 0.25 * this.normal())); }

  // Rencana tuang: tiap bahan resep bisa tertukar dengan bahan lain (peluang errRate).
  makePlan(game) {
    const cfg = game.config.ingredients, names = Object.values(cfg);
    const keyOf = (name) => Object.keys(cfg).find((k) => cfg[k] === name);
    const err = this.profile(game.time).errRate;
    return this.target.recipe.map((ing) =>
      this.rng.next() < err ? keyOf(this.rng.pick(names.filter((n) => n !== ing))) : keyOf(ing));
  }

  schedule(type, duration, extra) { this.pending = { type, ...extra }; this.wait += duration; }

  update(game, dt) {
    if (game.finished) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    if (this.pending) this.execute(game);
    this.decide(game);
  }

  execute(game) {
    const p = this.pending;
    if (p.type === 'pour') game.addIngredient(p.key);
    else if (p.type === 'discard') { game.discardCup(); if (this.target) this.plan = this.makePlan(game); }
    else if (p.type === 'serve') { game.serve(); this.target = null; }
  }

  decide(game) {
    const front = game.queue[0];
    if (this.target && (!front || front.id !== this.target.id)) {   // pelanggan target sudah pergi
      this.target = null; this.plan = [];
      if (game.cup.length) return this.schedule('discard', TIMES.discard);
    }
    if (!this.target) {
      if (!front) return this.schedule('poll', TIMES.poll);
      this.target = { id: front.id, recipe: front.recipe };
      this.plan = this.makePlan(game);
    }
    if (this.plan.length) return this.schedule('pour', this.pourTime(game.time), { key: this.plan.shift() });
    const mismatch = !sameSet(game.cup, this.target.recipe);
    if (mismatch && this.rng.next() < this.profile(game.time).noticeP) return this.schedule('discard', TIMES.discard);
    return this.schedule('serve', TIMES.serve);
  }
}

module.exports = { Bot, PROFILES };