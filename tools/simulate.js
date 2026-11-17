#!/usr/bin/env node
// Simulasi pemain bot untuk menguji versi Baseline dan Adaptif
// dengan skenario dan seed yang sama.
//
// Pemakaian:
//   node tools/simulate.js [jumlah_seed] [--mode=baseline|adaptive|both]
//                          [--skenario=S1,S2,...] [--out=folder]
// Default: 10 seed, kedua mode, semua skenario, folder results/.
// Contoh uji baseline saja: node tools/simulate.js 5 --mode=baseline --skenario=S1,S2,S3 --out=results/baseline

const fs = require('fs');
const path = require('path');

for (const f of ['config', 'rng', 'fuzzy', 'difficulty', 'metrics', 'game']) {
  require(path.join(__dirname, '..', 'js', `${f}.js`));
}
const CC = globalThis.CC;

const PROFILES = {
  pemula: { action: [1.5, 0.4], serve: 0.8, error: 0.15, notice: 0.3 },
  menengah: { action: [0.95, 0.25], serve: 0.5, error: 0.07, notice: 0.6 },
  ahli: { action: [0.55, 0.12], serve: 0.3, error: 0.02, notice: 0.9 },
};

// Skenario: tiap skenario memberi profil bot sesuai waktu permainan.
const SCENARIOS = {
  S1_pemula: () => PROFILES.pemula,
  S2_menengah: () => PROFILES.menengah,
  S3_ahli: () => PROFILES.ahli,
  S4_pemula_ke_ahli: (t) => (t < 90 ? PROFILES.pemula : PROFILES.ahli),
};

class Bot {
  constructor(profileAt, seed) {
    this.profileAt = profileAt;
    this.rng = CC.createRng(seed * 31 + 7);
    this.busy = 0.5;
  }

  gauss(mu, sd) {
    const u = 1 - this.rng();
    const v = this.rng();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0.15, mu + sd * z);
  }

  step(game, dt) {
    this.busy -= dt;
    if (this.busy > 0) return;

    const front = game.queue[0];
    if (!front) {
      this.busy = 0.1;
      return;
    }

    const p = this.profileAt(game.time);
    const recipe = front.order.recipe;

    if (game.cup.length < recipe.length) {
      let pick = recipe[game.cup.length];
      if (this.rng() < p.error) {
        const others = CC.Config.INGREDIENTS.map((i) => i.id).filter((id) => id !== pick);
        pick = others[Math.floor(this.rng() * others.length)];
      }
      game.addIngredient(pick);
      this.busy = this.gauss(p.action[0], p.action[1]);
      return;
    }

    if (!CC.sameRecipe(game.cup, recipe) && this.rng() < p.notice) {
      game.discardCup();
      this.busy = p.serve;
      return;
    }
    game.serve();
    this.busy = p.serve;
  }
}

function runOnce(scenario, mode, seed) {
  const game = new CC.Game({ mode, seed, playerId: `bot_${scenario}` });
  const bot = new Bot(SCENARIOS[scenario], seed);
  const dt = 1 / 30;
  while (!game.finished) {
    bot.step(game, dt);
    game.update(dt);
  }
  return game;
}

function stats(values) {
  const n = values.length;
  const m = values.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) : 0;
  return { m, sd };
}

const args = process.argv.slice(2);
const opt = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const nSeeds = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 10;
const MODES = !opt('mode') || opt('mode') === 'both' ? ['baseline', 'adaptive'] : [opt('mode')];
const SCENARIO_KEYS = opt('skenario')
  ? Object.keys(SCENARIOS).filter((k) => opt('skenario').split(',').some((p) => k.startsWith(p + '_')))
  : Object.keys(SCENARIOS);
const outDir = path.resolve(opt('out') || path.join(__dirname, '..', 'results'));
fs.mkdirSync(outDir, { recursive: true });

const runs = [];
for (const scenario of SCENARIO_KEYS) {
  for (const mode of MODES) {
    for (let seed = 1; seed <= nSeeds; seed++) {
      const game = runOnce(scenario, mode, seed);
      runs.push({ skenario: scenario, ...game.summary });
      if (seed === 1 && mode === 'adaptive') {
        fs.writeFileSync(
          path.join(outDir, `sim_adaptasi_${scenario}.csv`),
          CC.toCSV(CC.adaptationRows(game.spawner.log))
        );
        fs.writeFileSync(path.join(outDir, `sim_timeline_${scenario}_adaptive.csv`), CC.toCSV(game.metrics.timeline));
      }
      if (seed === 1 && mode === 'baseline') {
        fs.writeFileSync(path.join(outDir, `sim_timeline_${scenario}_baseline.csv`), CC.toCSV(game.metrics.timeline));
      }
    }
  }
}
fs.writeFileSync(path.join(outDir, 'sim_semua_run.csv'), CC.toCSV(runs));

const METRICS = [
  'skor',
  'tingkat_layanan',
  'akurasi_pesanan',
  'rata_waktu_layanan_s',
  'pergi_kehabisan_sabar',
  'ditolak_antrean_penuh',
  'rata_panjang_antrean',
  'persen_waktu_antrean_padat',
  'pelanggan_datang',
  'interval_rata_s',
];

const agg = [];
for (const scenario of SCENARIO_KEYS) {
  for (const metric of METRICS) {
    const row = { skenario: scenario, metrik: metric };
    for (const mode of MODES) {
      const vals = runs.filter((r) => r.skenario === scenario && r.mode === mode).map((r) => r[metric]);
      const { m, sd } = stats(vals);
      row[`${mode}_rata`] = +m.toFixed(3);
      row[`${mode}_sd`] = +sd.toFixed(3);
    }
    agg.push(row);
  }
}
fs.writeFileSync(path.join(outDir, 'sim_agregat.csv'), CC.toCSV(agg));

console.log(
  `Simulasi selesai: ${runs.length} run (${nSeeds} seed x ${SCENARIO_KEYS.length} skenario x ${MODES.length} mode)\n`
);
const fmt = (m, sd) => `${m.toFixed(2)} ± ${sd.toFixed(2)}`.padEnd(18);
for (const scenario of SCENARIO_KEYS) {
  console.log(`== ${scenario}`);
  for (const r of agg.filter((x) => x.skenario === scenario)) {
    const cols = MODES.map((mode) => `${mode} ${fmt(r[`${mode}_rata`], r[`${mode}_sd`])}`).join(' ');
    console.log(`  ${r.metrik.padEnd(28)} ${cols}`);
  }
}
console.log(`\nFile CSV tersimpan di ${outDir}`);
