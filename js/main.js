// main.js — menghubungkan game dengan browser: input, loop, layar hasil, unduh CSV.
(function () {
  const { CONFIG, Game, CSV, Render } = window;
  const $ = (id) => document.getElementById(id);
  const ctx = $('canvas').getContext('2d');
  const STORE_KEY = 'cozycafe:sessions';

  // Mode tersedia hanya jika kelasnya dimuat (lihat tag <script> di index.html).
  const MODES = [
    { id: 'baseline', label: 'Mode Baseline', cls: window.BaselineSpawner },
    { id: 'adaptif', label: 'Mode Adaptif', cls: window.AdaptiveSpawner },
    { id: 'dev', label: 'Mode Uji (khusus pengembangan)', cls: window.DevSpawner },
  ];

  let game = null, tester = '', last = 0, seen = 0;
  const ui = { toasts: [], debug: false, debugLines: [] };

  // ---------- layar awal ----------
  MODES.forEach((m) => {
    const b = document.createElement('button');
    b.textContent = m.cls ? m.label : m.label + ' (belum tersedia)';
    b.disabled = !m.cls;
    b.onclick = () => start(m);
    $('modes').appendChild(b);
  });
  $('seed').value = CONFIG.seeds.evaluation[0];

  function start(mode) {
    tester = $('tester').value.trim() || 'anon';
    const seed = parseInt($('seed').value, 10) || 1;
    game = new Game({ config: CONFIG, seed, spawner: new mode.cls(), mode: mode.id });
    ui.toasts = []; ui.debug = false; seen = 0;
    $('start').hidden = true; $('result').hidden = true; $('canvas').hidden = false;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  // ---------- loop ----------
  const TOAST = {
    correct: (h) => ['+' + h.scoreDelta + (h.tip ? ' (tip ' + h.tip + ')' : ''), 'correct'],
    wrong: (h) => ['Salah ' + h.scoreDelta, 'wrong'],
    left: (h) => ['Pelanggan pergi ' + h.scoreDelta, 'left'],
    rejected: (h) => ['Antrean penuh ' + h.scoreDelta, 'rejected'],
  };
  function addToast(text, kind) { ui.toasts.push({ text, kind, age: 0 }); }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.update(dt);
    for (; seen < game.history.length; seen++) {
      const [t, k] = TOAST[game.history[seen].outcome](game.history[seen]);
      addToast(t, k);
    }
    ui.toasts.forEach((t) => { t.age += dt; });
    ui.toasts = ui.toasts.filter((t) => t.age < 1.2);
    ui.debugLines = typeof game.spawner.debugLines === 'function' ? game.spawner.debugLines(game) : [
      'mode: ' + game.mode, 'interval: ' + game.spawner.getInterval().toFixed(2) + ' s',
      'antrean: ' + game.queue.length, 't: ' + game.time.toFixed(1) + ' s',
    ];
    Render.draw(ctx, game, ui);
    if (game.finished) finish(); else requestAnimationFrame(loop);
  }

  // ---------- input ----------
  document.addEventListener('keydown', (e) => {
    if (!game || game.finished || $('canvas').hidden) return;
    if (CONFIG.ingredients[e.key]) game.addIngredient(e.key);
    else if (e.key === ' ') {
      e.preventDefault();
      const r = game.serve();
      if (!r.ok && r.reason === 'empty_cup') addToast('Gelas masih kosong', 'info');
      if (!r.ok && r.reason === 'no_customer') addToast('Belum ada pelanggan', 'info');
    } else if (e.key === 'x' || e.key === 'X') game.discardCup();
    else if (e.key === 'd' || e.key === 'D') ui.debug = !ui.debug;
  });

  // ---------- layar hasil ----------
  const pct = (v) => (v === null ? '-' : (v * 100).toFixed(1) + '%');
  const num = (v, d) => (v === null ? '-' : v.toFixed(d));
  function download(name, content) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  function loadSessions() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  }
  function saveSession(entry) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...loadSessions(), entry].slice(-200))); } catch (e) { /* abaikan */ }
  }

  function finish() {
    const s = game.getSummary();
    saveSession({ tester, summary: s });
    const rows = [
      ['Mode / seed', s.mode + ' / ' + s.seed], ['Skor', s.score],
      ['Benar / salah', s.correct + ' / ' + s.wrong], ['Pergi / ditolak', s.left + ' / ' + s.rejected],
      ['Pelanggan datang', s.customersArrived], ['Tingkat layanan', pct(s.serviceRate)],
      ['Akurasi pesanan', pct(s.accuracy)], ['Waktu layanan rata-rata', num(s.avgServiceTime, 1) + ' s'],
      ['Waktu antrean padat (≥4)', num(s.crowdedPct, 1) + '%'], ['Panjang antrean rata-rata', num(s.avgQueueLen, 2)],
      ['Interval rata-rata', num(s.avgInterval, 2) + ' s'],
    ];
    $('summary').innerHTML = rows.map((r) => '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>').join('');
    const tag = tester + '_' + s.mode + '_seed' + s.seed;
    const actions = [
      ['Unduh CSV pelanggan', () => download('pelanggan_' + tag + '.csv', CSV.customersCsv(game, tester))],
      ['Unduh CSV per detik', () => download('detik_' + tag + '.csv', CSV.samplesCsv(game, tester))],
      ['Unduh CSV ringkasan sesi', () => download('ringkasan_' + tag + '.csv', CSV.summaryHeader() + '\n' + CSV.summaryRow(s, tester) + '\n')],
      ['Unduh CSV riwayat sesi', () => download('riwayat_sesi.csv', CSV.summaryHeader() + '\n' +
        loadSessions().map((e) => CSV.summaryRow(e.summary, e.tester)).join('\n') + '\n')],
    ];
    // Log adaptasi hanya ada jika spawner menyediakannya (versi adaptif).
    if (typeof game.spawner.logCsv === 'function') {
      actions.push(['Unduh log adaptasi (CSV)', () => download('adaptasi_' + tag + '.csv', game.spawner.logCsv(tester, game))]);
    }
    actions.push(['Main lagi', () => { $('result').hidden = true; $('canvas').hidden = true; $('start').hidden = false; }]);
    $('actions').innerHTML = '';
    actions.forEach(([label, fn]) => {
      const b = document.createElement('button'); b.textContent = label; b.onclick = fn; $('actions').appendChild(b);
    });
    $('result').hidden = false;
  }
})();