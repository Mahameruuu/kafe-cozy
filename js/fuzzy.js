// Mesin inferensi fuzzy Mamdani sederhana.
// AND = min, implikasi = min (clipping), agregasi = max, defuzzifikasi = centroid.
(function (root) {
  const CC = (root.CC = root.CC || {});

  function trapmf(x, a, b, c, d) {
    if (x < a || x > d) return 0;
    if (x >= b && x <= c) return 1;
    if (x < b) return b === a ? 1 : (x - a) / (b - a);
    return d === c ? 1 : (d - x) / (d - c);
  }

  function trimf(x, a, b, c) {
    return trapmf(x, a, b, b, c);
  }

  function fuzzify(variable, x) {
    const result = {};
    for (const label of Object.keys(variable.sets)) {
      result[label] = variable.sets[label](x);
    }
    return result;
  }

  function mamdani(system, inputs) {
    const degrees = {};
    for (const name of Object.keys(system.inputs)) {
      degrees[name] = fuzzify(system.inputs[name], inputs[name]);
    }

    const firing = system.rules.map((rule) => {
      let strength = 1;
      for (const name of Object.keys(rule.if)) {
        strength = Math.min(strength, degrees[name][rule.if[name]]);
      }
      return { rule, strength };
    });

    const output = system.output;
    const [lo, hi] = output.range;
    const steps = system.resolution || 200;
    let num = 0;
    let den = 0;
    for (let i = 0; i <= steps; i++) {
      const y = lo + ((hi - lo) * i) / steps;
      let mu = 0;
      for (const f of firing) {
        if (f.strength <= 0) continue;
        mu = Math.max(mu, Math.min(f.strength, output.sets[f.rule.then](y)));
      }
      num += y * mu;
      den += mu;
    }

    return { value: den > 0 ? num / den : null, degrees, firing };
  }

  CC.Fuzzy = { trapmf, trimf, fuzzify, mamdani };
})(typeof window !== 'undefined' ? window : globalThis);
