// tools/test-fuzzy.js — uji modul fuzzy. Jalankan: node tools/test-fuzzy.js
// Nilai harapan kasus A-C dihitung dengan tangan (lihat komentar), bukan disalin dari keluaran kode.
const assert = require('assert');
const E = require('../js/fuzzy-engine.js');
const SYSTEM = require('../js/fuzzy-system.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} diharapkan ${b}, dapat ${a}`);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }
const run = (akurasi, waktu) => E.mamdani(SYSTEM, { akurasi, waktu });

test('fungsi keanggotaan: segitiga, trapesium, dan bahu', () => {
  const tri = E.mf([0.5, 0.75, 0.9]);
  near(tri(0.75), 1, 1e-12); near(tri(0.5), 0, 1e-12); near(tri(0.625), 0.5, 1e-12);
  const bahuKiri = E.mf([0, 0, 0.5, 0.7]);
  near(bahuKiri(0), 1, 1e-12); near(bahuKiri(0.6), 0.5, 1e-12); near(bahuKiri(0.8), 0, 1e-12);
  const bahuKanan = E.mf([0.75, 0.9, 1, 1]);
  near(bahuKanan(1), 1, 1e-12); near(bahuKanan(0.825), 0.5, 1e-12);
});

test('cakupan: setiap nilai input memiliki derajat keanggotaan > 0 pada minimal satu himpunan', () => {
  for (const [name, def] of Object.entries(SYSTEM.inputs)) {
    for (let x = def.range[0]; x <= def.range[1] + 1e-9; x += 0.01) {
      const total = Object.values(E.fuzzify(def, x)).reduce((s, v) => s + v, 0);
      assert.ok(total > 0, `${name}=${x.toFixed(2)} tidak tercakup`);
    }
  }
});

// Kasus A: akurasi 1,0 dan waktu 0 -> hanya (tinggi,cepat) menyala dengan kekuatan 1 -> percepat_banyak utuh.
// Trapesium (-1,5; -1,5; -1,2; -0,6): persegi lebar 0,3 (pusat -1,35) + segitiga luas 0,3 (pusat -1,0)
// => centroid = (0,3*-1,35 + 0,3*-1,0) / 0,6 = -1,175
test('kasus A (hitung tangan): akurasi 1,0, waktu 0 -> -1,175', () => {
  const r = run(1.0, 0);
  assert.strictEqual(r.fired.length, 1);
  assert.strictEqual(r.dominant.then, 'percepat_banyak');
  near(r.output, -1.175, 0.01);
});

// Kasus B: simetris -> (rendah,lambat) -> perlambat_banyak -> +1,175
test('kasus B (hitung tangan): akurasi 0, waktu 1,0 -> +1,175', () => {
  const r = run(0, 1.0);
  assert.strictEqual(r.dominant.then, 'perlambat_banyak');
  near(r.output, 1.175, 0.01);
});

// Kasus C: akurasi 0,75 dan waktu 0,4 -> hanya (sedang,normal) -> tetap (segitiga simetris) -> 0
test('kasus C (hitung tangan): akurasi 0,75, waktu 0,4 -> 0', () => {
  const r = run(0.75, 0.4);
  assert.strictEqual(r.fired.length, 1);
  assert.strictEqual(r.dominant.then, 'tetap');
  near(r.output, 0, 0.01);
});

// Kasus D: akurasi 0,6 -> rendah = (0,7-0,6)/0,2 = 0,5; sedang = (0,6-0,5)/0,25 = 0,4. waktu 0,4 -> normal = 1.
test('kasus D (hitung tangan): kekuatan aturan 0,5 dan 0,4, dominan perlambat', () => {
  const r = run(0.6, 0.4);
  assert.strictEqual(r.fired.length, 2);
  const byThen = Object.fromEntries(r.fired.map((f) => [f.then, f.strength]));
  near(byThen.perlambat, 0.5, 1e-9); near(byThen.tetap, 0.4, 1e-9);
  assert.strictEqual(r.dominant.then, 'perlambat');
  assert.ok(r.output > 0 && r.output < 0.6);
});

// Kasus E: akurasi 0,6 (rendah 0,5; sedang 0,4) dan waktu 0,55 (normal 0,25; lambat 0,25).
// AND = min -> keempat aturan berkekuatan 0,25 (bila memakai perkalian akan 0,125 / 0,10).
test('kasus E (hitung tangan): operator AND memakai min', () => {
  const r = run(0.6, 0.55);
  assert.strictEqual(r.fired.length, 4);
  r.fired.forEach((f) => near(f.strength, 0.25, 1e-9));
});

test('sifat: akurasi naik (waktu tetap 0,4) -> perubahan interval tidak naik', () => {
  let prev = Infinity;
  for (let a = 0; a <= 1.0001; a += 0.05) {
    const o = run(a, 0.4).output;
    assert.ok(o <= prev + 1e-6, `tidak monoton di akurasi ${a.toFixed(2)}: ${o.toFixed(3)} > ${prev.toFixed(3)}`);
    prev = o;
  }
});

test('sifat: waktu tunggu naik (akurasi tetap 0,9) -> perubahan interval tidak turun', () => {
  let prev = -Infinity;
  for (let w = 0; w <= 1.0001; w += 0.05) {
    const o = run(0.9, w).output;
    assert.ok(o >= prev - 1e-6, `tidak monoton di waktu ${w.toFixed(2)}: ${o.toFixed(3)} < ${prev.toFixed(3)}`);
    prev = o;
  }
});

test('sifat: keluaran selalu dalam rentang, masukan di luar rentang dijepit', () => {
  for (let a = -0.5; a <= 1.5; a += 0.1) for (let w = -0.5; w <= 1.5; w += 0.1) {
    const o = run(a, w).output;
    assert.ok(o >= -1.5 && o <= 1.5);
  }
  assert.strictEqual(run(5, -3).output, run(1, 0).output);
});

console.log(`\n${passed} pengujian lolos`);