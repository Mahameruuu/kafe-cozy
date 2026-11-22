// tools/test-game.js — uji otomatis logika inti. Jalankan: node tools/test-game.js
// StubSpawner di bawah HANYA alat uji (interval konstan). Ini BUKAN baseline;
// baseline adalah rancangan dan tulisan Mahameru.
const assert = require('assert');
const CONFIG = require('../js/config.js');
const Game = require('../js/game.js');

class StubSpawner {
  constructor(interval) { this.interval = interval; }
  reset() {}
  update() {}
  getInterval() { return this.interval; }
}

const keyOf = (name) => Object.keys(CONFIG.ingredients).find((k) => CONFIG.ingredients[k] === name);
const make = (interval, seed = 2026) => new Game({ config: CONFIG, seed, spawner: new StubSpawner(interval), mode: 'stub' });
function pourFor(game, orderName) {
  const item = CONFIG.menu.find((m) => m.name === orderName);
  item.recipe.forEach((ing) => game.addIngredient(keyOf(ing)));
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }

test('urutan pesanan sama pada seed sama, walau interval berbeda', () => {
  const a = make(6), b = make(3);
  while (!a.finished) a.update(0.5);
  while (!b.finished) b.update(0.5);
  const n = Math.min(a.orders.length, b.orders.length);
  assert.ok(n >= 20);
  assert.deepStrictEqual(a.orders.slice(0, n), b.orders.slice(0, n));
});

test('penyajian benar: +10 ditambah tip penuh bila langsung disajikan', () => {
  const g = make(100);
  g.update(1.0);                          // pelanggan pertama muncul
  pourFor(g, g.queue[0].order);
  const r = g.serve();
  assert.strictEqual(r.outcome, 'correct');
  assert.strictEqual(g.score, CONFIG.score.correct + CONFIG.score.tipMax);
  assert.strictEqual(g.queue.length, 0);
});

test('urutan tuang tidak berpengaruh, jumlah bahan berpengaruh', () => {
  const g = make(100);
  g.update(1.0);
  const recipe = [...g.queue[0].recipe].reverse();
  recipe.forEach((ing) => g.addIngredient(keyOf(ing)));
  assert.strictEqual(g.serve().outcome, 'correct');
  const h = make(100);
  h.update(1.0);
  h.addIngredient('1'); h.addIngredient('1'); h.addIngredient('1');   // tiga espresso
  assert.strictEqual(h.serve().outcome, 'wrong');
});

test('penyajian salah: -5, pelanggan pergi, gelas kosong', () => {
  const g = make(100);
  g.update(1.0);
  g.addIngredient('4'); g.addIngredient('4'); g.addIngredient('4');
  assert.strictEqual(g.serve().outcome, 'wrong');
  assert.strictEqual(g.score, CONFIG.score.wrong);
  assert.strictEqual(g.cup.length, 0);
});

test('kesabaran habis: pelanggan pergi, -3', () => {
  const g = make(100);
  for (let i = 0; i < 24; i++) g.update(1.0);
  assert.strictEqual(g.history[0].outcome, 'left');
  assert.strictEqual(g.score, CONFIG.score.lost);
});

test('antrean penuh: pelanggan ke-6 ditolak, -3', () => {
  const g = make(0.5);
  for (let i = 0; i < 7; i++) g.update(0.5);   // t = 3,5 s: pelanggan datang di 1,0; 1,5; ...; 3,5 (6 orang)
  assert.strictEqual(g.queue.length, CONFIG.queueCapacity);
  assert.strictEqual(g.history.filter((x) => x.outcome === 'rejected').length, 1);
  assert.strictEqual(g.score, CONFIG.score.lost);
});

test('gelas maksimal 3 bahan; tidak bisa menyajikan gelas kosong', () => {
  const g = make(100);
  g.update(1.0);
  assert.strictEqual(g.serve().reason, 'empty_cup');
  assert.ok(g.addIngredient('1') && g.addIngredient('2') && g.addIngredient('3'));
  assert.strictEqual(g.addIngredient('4'), false);
});

test('sesi berhenti di 180 detik dan menghasilkan ringkasan lengkap', () => {
  const g = make(6);
  while (!g.finished) g.update(1 / 60);
  assert.strictEqual(g.time, CONFIG.sessionSeconds);
  assert.strictEqual(g.samples.length, CONFIG.sessionSeconds);
  const s = g.getSummary();
  assert.strictEqual(s.customersArrived, g.orders.length);
  assert.ok(s.serviceRate === 0 && s.left > 0);   // tanpa pemain, semua pelanggan pergi/ditolak
  assert.ok(Math.abs(s.avgInterval - 6) < 1e-9);
});

console.log(`\n${passed} pengujian lolos`);