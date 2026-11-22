// tools/test-adaptive.js — uji AdaptiveSpawner. Jalankan: node tools/test-adaptive.js
// Sebagian besar uji memakai "game tiruan" agar tiap skenario terkontrol; nilai harapan dihitung dengan tangan.
const assert = require('assert');
const CONFIG = require('../js/config.js');
const Game = require('../js/game.js');
const AdaptiveSpawner = require('../js/adaptive-spawner.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} diharapkan ${b}, dapat ${a}`);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }

const mk = (over = {}) => ({ time: 12, seed: 1, mode: 'adaptif', config: { customerPatience: 22, spawn: { initialInterval: 6 } }, queue: [], history: [], ...over });
const fin = (outcome, wait, id) => ({ id, order: 'x', outcome, arrivedAt: 0, endedAt: wait, wait, tip: 0, scoreDelta: 0 });
const strong = () => Array.from({ length: 6 }, (_, i) => fin('correct', 2, i + 1));   // akurasi 1, waktu relatif 2/22 = 0,09 (cepat)
const started = (game, params) => { const s = new AdaptiveSpawner(params); s.reset(game); return s; };

test('pemanasan: tidak ada penyesuaian sebelum detik ke-12', () => {
  const g = mk({ time: 11.9, history: strong() }), s = started(g);
  s.update(g);
  assert.strictEqual(s.getInterval(), 6); assert.strictEqual(s.log.length, 0);
});

test('data kurang: < 3 pelanggan selesai -> interval tetap, tercatat di log', () => {
  const g = mk({ history: strong().slice(0, 2) }), s = started(g);
  s.update(g);
  assert.strictEqual(s.getInterval(), 6);
  assert.deepStrictEqual(s.log[0].flags, ['data_kurang']);
});

// Pemain kuat: akurasi 1, waktu 0,09 -> (tinggi,cepat) -> percepat_banyak, delta fuzzy ~ -1,175 -> dijepit -1,0 -> 5,0
test('pemain kuat: interval 6,0 -> 5,0 dengan guardrail batas_langkah', () => {
  const g = mk({ history: strong() }), s = started(g);
  s.update(g);
  near(s.getInterval(), 5.0, 1e-9);
  assert.deepStrictEqual(s.log[0].flags, ['batas_langkah']);
  assert.strictEqual(s.log[0].fuzzy.dominant.then, 'percepat_banyak');
});

test('guardrail antrean: antrean >= 3 membatalkan percepatan', () => {
  const queue = [1, 2, 3].map((id) => ({ id, arrivedAt: 12, patienceLeft: 22 }));
  const g = mk({ history: strong(), queue }), s = started(g);
  s.update(g);
  assert.strictEqual(s.getInterval(), 6);
  assert.ok(s.log[0].flags.includes('antrean'));
});

// Pemain lemah: 4 pergi (relatif 1) + 2 salah (10/22 = 0,4545) -> akurasi 0, waktu (4 + 0,909)/6 = 0,818 -> perlambat_banyak -> +1,0
test('pemain lemah: interval 6,0 -> 7,0', () => {
  const history = [...[1, 2, 3, 4].map((i) => fin('left', 22, i)), fin('wrong', 10, 5), fin('wrong', 10, 6)];
  const g = mk({ history }), s = started(g);
  s.update(g);
  near(s.log[0].akurasi, 0, 1e-12); near(s.log[0].waktu, 0.8182, 1e-3);
  near(s.getInterval(), 7.0, 1e-9);
});

test('batas interval: tidak di bawah 3,0 dan tidak di atas 9,0', () => {
  const g1 = mk({ history: strong() }), s1 = started(g1);
  s1.interval = 3.0; s1.update(g1);
  assert.strictEqual(s1.getInterval(), 3.0); assert.ok(s1.log[0].flags.includes('batas_interval'));
  const weak = Array.from({ length: 6 }, (_, i) => fin('left', 22, i + 1));
  const g2 = mk({ history: weak }), s2 = started(g2);
  s2.interval = 9.0; s2.update(g2);
  assert.strictEqual(s2.getInterval(), 9.0);
});

test('periode evaluasi: hanya tiap 5 detik (12, 17, ...)', () => {
  const g = mk({ history: strong() }), s = started(g);
  s.update(g);                       // t=12 -> 5,0
  g.time = 14; s.update(g);          // belum waktunya
  near(s.getInterval(), 5.0, 1e-9);
  g.time = 17; s.update(g);          // evaluasi kedua -> 4,0
  near(s.getInterval(), 4.0, 1e-9);
  assert.strictEqual(s.log.length, 2);
});

test('jendela: hanya 6 pelanggan selesai terakhir yang dinilai', () => {
  const history = [...[1, 2, 3, 4].map((i) => fin('left', 22, i)), ...strong().map((h, i) => ({ ...h, id: 5 + i }))];
  const g = mk({ history }), s = started(g);
  s.update(g);
  assert.strictEqual(s.log[0].n, 6); near(s.log[0].akurasi, 1, 1e-12);
  near(s.getInterval(), 5.0, 1e-9);
});

// 3 benar (relatif 0,0909) + 3 ditolak (bernilai 1): akurasi 0,5; waktu (3*0,0909 + 3)/6 = 0,5455
test('pelanggan ditolak: bukan "benar" dan bernilai 1 pada waktu tunggu relatif', () => {
  const history = [...strong().slice(0, 3), ...[4, 5, 6].map((i) => fin('rejected', 0, i))];
  const g = mk({ history }), s = started(g);
  s.update(g);
  near(s.log[0].akurasi, 0.5, 1e-12); near(s.log[0].waktu, 0.5455, 1e-3);
  assert.ok(s.log[0].deltaFuzzy > 0);
});

test('pelanggan yang masih mengantre ikut dihitung pada waktu tunggu relatif', () => {
  const queue = [{ id: 7, arrivedAt: 12 - 22, patienceLeft: 0.01 }];   // sudah menunggu ~22 s -> relatif 1
  const g1 = mk({ history: strong() }), s1 = started(g1); s1.update(g1);
  const g2 = mk({ history: strong(), queue }), s2 = started(g2); s2.update(g2);
  assert.ok(s2.log[0].waktu > s1.log[0].waktu);
  near(s2.log[0].waktu, (6 * (2 / 22) + 1) / 7, 1e-9);
});

test('spawner tidak mengubah state game (hanya membaca)', () => {
  const queue = [{ id: 1, arrivedAt: 10, patienceLeft: 20 }];
  const g = mk({ history: strong(), queue }), s = started(g);
  const before = JSON.stringify(g);
  s.update(g);
  assert.strictEqual(JSON.stringify(g), before);
});

test('log CSV: jumlah baris sama dengan jumlah evaluasi dan kolom konsisten', () => {
  const g = mk({ history: strong().slice(0, 2) }), s = started(g);
  s.update(g);                                       // evaluasi 1: data kurang
  g.history = strong(); g.time = 17; s.update(g);    // evaluasi 2
  const lines = s.logCsv('P01', g).trim().split('\n');
  assert.strictEqual(lines.length, s.log.length + 1);
  const cols = lines[0].split(',').length;
  lines.forEach((l) => assert.strictEqual(l.split(',').length, cols));
  assert.ok(s.debugLines(g).length <= 7);
});

test('integrasi: tanpa pemain, semua pelanggan pergi -> interval naik, monoton, dalam batas', () => {
  const spawner = new AdaptiveSpawner();
  const g = new Game({ config: CONFIG, seed: 5, spawner, mode: 'adaptif' });
  while (!g.finished) g.update(0.5);
  const iv = g.samples.map((x) => x.interval);
  iv.forEach((v, i) => { assert.ok(v >= 3 && v <= 9); if (i) assert.ok(v >= iv[i - 1] - 1e-9); });
  assert.ok(iv[iv.length - 1] > 6);
  assert.ok(spawner.log.length > 10);
});

console.log(`\n${passed} pengujian lolos`);