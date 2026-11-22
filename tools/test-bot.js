// tools/test-bot.js — uji bot. Jalankan: node tools/test-bot.js
const assert = require('assert');
const CONFIG = require('../js/config.js');
const Game = require('../js/game.js');
const DevSpawner = require('../dev/dev-spawner.js');
const { Bot, PROFILES } = require('./bot.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }

function play(profile, seed, { withBot = true, secs = 180 } = {}) {
  const g = new Game({ config: CONFIG, seed, spawner: new DevSpawner(), mode: 'dev' });
  const bot = new Bot({ seed: seed * 1000, profile });
  while (!g.finished && g.time < secs) { if (withBot) bot.update(g, 0.05); g.update(0.05); }
  return g;
}
const meanOver = (profile, key) => {
  const vals = CONFIG.seeds.tuning.map((s) => play(profile, s).getSummary()[key]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

test('deterministik: seed dan profil sama menghasilkan ringkasan identik', () => {
  const a = play(PROFILES.menengah, 7).getSummary(), b = play(PROFILES.menengah, 7).getSummary();
  assert.deepStrictEqual(a, b);
});

test('bot tidak mengganggu urutan pesanan game (RNG terpisah)', () => {
  const withBot = play(PROFILES.pemula, 3), noBot = play(PROFILES.pemula, 3, { withBot: false });
  const n = Math.min(withBot.orders.length, noBot.orders.length);
  assert.ok(n > 20);
  assert.deepStrictEqual(withBot.orders.slice(0, n), noBot.orders.slice(0, n));
});

// Catatan: dengan errRate 1 tiap bahan diganti bahan lain, tetapi pada resep 2-3 bahan hasilnya bisa kebetulan
// tetap benar (mis. espresso dan susu saling bertukar). Karena itu "correct" tidak diharapkan 0.
test('bot yang selalu salah tuang tetapi selalu menyadarinya tidak pernah menyajikan gelas salah', () => {
  const s = play({ pourMean: 0.5, errRate: 1, noticeP: 1 }, 11).getSummary();
  assert.strictEqual(s.wrong, 0); assert.ok(s.left > 0);
});

test('bot yang selalu salah tuang dan tidak pernah menyadarinya lebih sering salah daripada benar', () => {
  const s = play({ pourMean: 0.5, errRate: 1, noticeP: 0 }, 11).getSummary();
  assert.ok(s.wrong > s.correct, `salah ${s.wrong}, benar ${s.correct}`);
});

test('bot tanpa kesalahan tidak pernah menyajikan salah', () => {
  const s = play({ pourMean: 0.5, errRate: 0, noticeP: 0 }, 5).getSummary();
  assert.strictEqual(s.wrong, 0); assert.ok(s.correct > 10);
});

test('profil berubah di tengah sesi mengikuti fungsi waktu', () => {
  const bot = new Bot({ seed: 1, profile: (t) => (t < 90 ? PROFILES.pemula : PROFILES.ahli) });
  assert.strictEqual(bot.profile(10), PROFILES.pemula); assert.strictEqual(bot.profile(120), PROFILES.ahli);
});

test('kemampuan berurutan: ahli > menengah > pemula pada tingkat layanan (interval tetap 6 s, 10 seed)', () => {
  const p = meanOver(PROFILES.pemula, 'serviceRate'), m = meanOver(PROFILES.menengah, 'serviceRate'), a = meanOver(PROFILES.ahli, 'serviceRate');
  console.log(`      pemula ${p.toFixed(3)}  menengah ${m.toFixed(3)}  ahli ${a.toFixed(3)}`);
  assert.ok(a > m && m > p, `urutan tidak sesuai: ${p}, ${m}, ${a}`);
});

console.log(`\n${passed} pengujian lolos`);