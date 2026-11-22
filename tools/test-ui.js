// tools/test-ui.js — uji asap CSV dan penggambaran. Jalankan: node tools/test-ui.js
// Konteks canvas tiruan menerima semua pemanggilan, jadi uji ini menangkap error
// (misalnya properti yang tidak ada), bukan kualitas tampilan. Tetap lihat game di browser.
const assert = require('assert');
const CONFIG = require('../js/config.js');
const Game = require('../js/game.js');
const CSV = require('../js/csv.js');
const Render = require('../js/render.js');
const DevSpawner = require('../dev/dev-spawner.js');

function fakeCtx() {
  const store = {};
  return new Proxy(store, {
    get: (t, p) => (p === 'measureText' ? () => ({ width: 50 }) : p in t ? t[p] : () => {}),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }
const run = (secs, seed = 1) => {
  const g = new Game({ config: CONFIG, seed, spawner: new DevSpawner(), mode: 'dev' });
  for (let t = 0; t < secs; t += 0.5) g.update(0.5);
  return g;
};

test('CSV pelanggan: jumlah baris = riwayat + header, kolom konsisten', () => {
  const g = run(40);
  const lines = CSV.customersCsv(g, 'P01').trim().split('\n');
  assert.strictEqual(lines.length, g.history.length + 1);
  assert.ok(g.history.length > 0);
  const cols = lines[0].split(',').length;
  lines.forEach((l) => assert.strictEqual(l.split(',').length, cols));
});

test('CSV per detik dan ringkasan punya header dan baris yang benar', () => {
  const g = run(30);
  assert.strictEqual(CSV.samplesCsv(g, 'P01').trim().split('\n').length, g.samples.length + 1);
  const header = CSV.summaryHeader().split(',').length;
  assert.strictEqual(CSV.summaryRow(g.getSummary(), 'P01').split(',').length, header);
});

test('CSV: ID penguji dengan koma tidak merusak kolom', () => {
  const g = run(40);                              // cukup lama agar ada pelanggan yang selesai
  assert.ok(g.history.length > 0);
  const line = CSV.customersCsv(g, 'Aurel, uji 1').split('\n')[1];
  assert.ok(line.startsWith('"Aurel, uji 1",'));
});

test('render: tidak error pada awal, tengah (antrean penuh), debug, toast, dan akhir sesi', () => {
  const ctx = fakeCtx();
  const g = new Game({ config: CONFIG, seed: 3, spawner: new DevSpawner(), mode: 'dev' });
  const ui = { toasts: [{ text: '+15', kind: 'correct', age: 0.3 }], debug: true, debugLines: ['a', 'b'] };
  Render.draw(ctx, g, ui);                       // awal
  for (let i = 0; i < 40; i++) g.update(0.5);   // antrean terisi
  g.addIngredient('1'); g.addIngredient('2');
  Render.draw(ctx, g, ui);
  while (!g.finished) g.update(0.5);
  Render.draw(ctx, g, { toasts: [], debug: false });
});

console.log(`\n${passed} pengujian lolos`);