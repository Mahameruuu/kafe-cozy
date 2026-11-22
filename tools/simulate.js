// tools/simulate.js — simulasi bot untuk banyak seed.
// Pemakaian: node tools/simulate.js [jumlahSeed=10] [--set=tuning|evaluation] [--params='{"maxStep":0.8}']
//
// ATURAN PENTING:
//  * Default memakai seed "tuning". Seed "evaluation" hanya dijalankan setelah parameter dibekukan.
//  * Pembanding diambil dari js/baseline-spawner.js (Mahameru). Jika belum ada, dipakai referensi interval
//    tetap HANYA untuk pengembangan; hasilnya berlabel "referensi_dev" dan TIDAK boleh dilaporkan sebagai baseline.
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const Game = require('../js/game.js');
const AdaptiveSpawner = require('../js/adaptive-spawner.js');
const { Bot, PROFILES } = require('./bot.js');

const args = process.argv.slice(2);
const opt = (name, def) => { const a = args.find((x) => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : def; };
const nSeeds = parseInt(args.find((a) => /^\d+$/.test(a)) || '10', 10);
const setName = opt('set', 'tuning');
const adaptiveParams = JSON.parse(opt('params', '{}'));
if (!CONFIG.seeds[setName]) { console.error('--set harus tuning atau evaluation'); process.exit(1); }
const seeds = CONFIG.seeds[setName].slice(0, nSeeds);

let Reference, refLabel;
try { Reference = require('../js/baseline-spawner.js'); refLabel = 'baseline'; } catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes('baseline-spawner')) throw e;
  Reference = require('../dev/dev-spawner.js'); refLabel = 'referensi_dev';
  console.warn('PERINGATAN: js/baseline-spawner.js (Mahameru) belum ada. Memakai referensi interval tetap');
  console.warn('            khusus pengembangan (mode "referensi_dev"). Jangan dilaporkan sebagai baseline.\n');
}
if (setName === 'evaluation') console.warn('CATATAN: seed evaluasi. Pastikan parameter sudah dibekukan sebelum data ini dilaporkan.\n');

const SCENARIOS = [
  { id: 'S1', label: 'pemula', profile: () => PROFILES.pemula },
  { id: 'S2', label: 'menengah', profile: () => PROFILES.menengah },
  { id: 'S3', label: 'ahli', profile: () => PROFILES.ahli },
  { id: 'S4', label: 'pemula(0-90s)->ahli', profile: (t) => (t < 90 ? PROFILES.pemula : PROFILES.ahli) },
];
const METRICS = [
  ['score', 'score'], ['serviceRate', 'service_rate'], ['accuracy', 'accuracy'], ['avgServiceTime', 'avg_service_time'],
  ['left', 'left'], ['rejected', 'rejected'], ['customersArrived', 'customers_arrived'],
  ['crowdedPct', 'crowded_pct'], ['avgQueueLen', 'avg_queue_len'], ['avgInterval', 'avg_interval'],
];

function runOne(sc, scIndex, version, seed) {
  const spawner = version === 'adaptif' ? new AdaptiveSpawner(adaptiveParams) : new Reference();
  const game = new Game({ config: CONFIG, seed, spawner, mode: version === 'adaptif' ? 'adaptif' : refLabel });
  const bot = new Bot({ seed: seed * 1000 + scIndex, profile: sc.profile });   // sama untuk kedua versi
  const dt = 0.05;
  while (!game.finished) { bot.update(game, dt); game.update(dt); }
  return { game, spawner, summary: game.getSummary() };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => (a.length < 2 ? 0 : Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)));
const f = (v, d = 4) => (typeof v === 'number' ? v.toFixed(d) : '');

const outDir = path.join(__dirname, '..', 'results', setName);
fs.mkdirSync(outDir, { recursive: true });
const sessionRows = [['scenario', 'mode', 'seed', ...METRICS.map((m) => m[1])].join(',')];
const aggRows = ['scenario,mode,n,metric,mean,sd'];
const diffRows = ['scenario,metric,n,mean_diff_adaptif_minus_pembanding,sd_diff'];
const versions = ['pembanding', 'adaptif'];

console.log(`Simulasi: ${seeds.length} seed (${setName}), pembanding = ${refLabel}, parameter adaptif = ${JSON.stringify(adaptiveParams)}\n`);

SCENARIOS.forEach((sc, si) => {
  const res = { pembanding: [], adaptif: [] };
  for (const seed of seeds) for (const v of versions) {
    const r = runOne(sc, si, v, seed);
    res[v].push(r.summary);
    sessionRows.push([sc.id, r.summary.mode, seed, ...METRICS.map(([k]) => f(r.summary[k]))].join(','));
    if (v === 'adaptif' && seed === seeds[0]) {
      fs.writeFileSync(path.join(outDir, `log_adaptasi_${sc.id}_seed${seed}.csv`), r.spawner.logCsv('sim', r.game));
    }
  }
  for (const v of versions) {
    const mode = v === 'adaptif' ? 'adaptif' : refLabel;
    METRICS.forEach(([k, name]) => {
      const vals = res[v].map((s) => s[k]);
      aggRows.push([sc.id, mode, vals.length, name, f(mean(vals)), f(sd(vals))].join(','));
    });
  }
  METRICS.forEach(([k, name]) => {
    const d = res.adaptif.map((s, i) => s[k] - res.pembanding[i][k]);   // seed sama -> selisih berpasangan
    diffRows.push([sc.id, name, d.length, f(mean(d)), f(sd(d))].join(','));
  });

  const show = (v, k, d = 3) => { const x = res[v].map((s) => s[k]); return `${mean(x).toFixed(d)} ± ${sd(x).toFixed(d)}`; };
  console.log(`${sc.id} ${sc.label}`);
  [['tingkat layanan', 'serviceRate', 3], ['pergi', 'left', 1], ['ditolak', 'rejected', 1], ['antrean padat %', 'crowdedPct', 1],
    ['pelanggan datang', 'customersArrived', 1], ['interval rata2', 'avgInterval', 2]].forEach(([label, k, d]) =>
    console.log(`  ${label.padEnd(18)} ${refLabel.padEnd(14)} ${show('pembanding', k, d).padEnd(16)} adaptif ${show('adaptif', k, d)}`));
  console.log('');
});

fs.writeFileSync(path.join(outDir, 'sim_sesi.csv'), sessionRows.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'sim_agregat.csv'), aggRows.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'sim_selisih.csv'), diffRows.join('\n') + '\n');
console.log('Hasil disimpan di', path.relative(process.cwd(), outDir) + '/');