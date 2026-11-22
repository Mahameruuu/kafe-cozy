// fuzzy-engine.js — mesin fuzzy tipe Mamdani yang GENERIK (tidak tahu soal kafe).
// Alur: fuzzifikasi -> kekuatan aturan (AND = min) -> implikasi (min/potong)
//       -> agregasi (max) -> defuzzifikasi (centroid).
// Desainnya (himpunan, aturan) ada di fuzzy-system.js sebagai data.
(function (root) {
  // Fungsi keanggotaan dari parameter: [a,b,c] segitiga, [a,b,c,d] trapesium.
  // Bahu (a==b atau c==d) valid: nilai di sisi bahu tetap 1.
  function mf(p) {
    const [a, b, c, d] = p.length === 3 ? [p[0], p[1], p[1], p[2]] : p;
    return (x) => {
      if (x < a || x > d) return 0;
      if (x >= b && x <= c) return 1;
      return x < b ? (x - a) / (b - a) : (d - x) / (d - c);
    };
  }
  const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));

  // Fuzzifikasi satu input -> { namaHimpunan: derajat }
  function fuzzify(def, x) {
    const v = clamp(x, def.range), out = {};
    for (const [name, p] of Object.entries(def.sets)) out[name] = mf(p)(v);
    return out;
  }

  function mamdani(system, inputs) {
    const memberships = {};
    for (const [name, def] of Object.entries(system.inputs)) memberships[name] = fuzzify(def, inputs[name]);

    // Kekuatan tiap aturan: AND = min dari derajat semua antesedennya.
    const fired = [];
    system.rules.forEach((rule, i) => {
      const strength = Math.min(...Object.entries(rule.if).map(([v, set]) => memberships[v][set]));
      if (strength > 0) fired.push({ rule: i, if: rule.if, then: rule.then, strength });
    });

    // Agregasi max dari himpunan output yang dipotong (implikasi min), lalu centroid.
    const o = system.output, fns = {};
    for (const [name, p] of Object.entries(o.sets)) fns[name] = mf(p);
    let num = 0, den = 0;
    if (fired.length) {
      for (let z = o.range[0]; z <= o.range[1] + 1e-9; z += o.step) {
        const mu = Math.max(...fired.map((f) => Math.min(f.strength, fns[f.then](z))));
        num += z * mu; den += mu;
      }
    }
    const dominant = fired.reduce((best, f) => (!best || f.strength > best.strength ? f : best), null);
    return { output: den > 0 ? num / den : 0, memberships, fired, dominant };
  }

  const API = { mf, fuzzify, mamdani };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FuzzyEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);