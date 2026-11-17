// Tampilan, input, dan alur layar (menu -> main -> hasil).
(function () {
  const CC = window.CC;
  const cfg = CC.Config;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const $ = (id) => document.getElementById(id);
  const menuEl = $('menu');
  const resultEl = $('result');

  const HISTORY_KEY = 'cozycafe_history';
  const MODE_LABEL = { baseline: 'Baseline (Non-AI)', adaptive: 'Adaptif (Fuzzy)' };

  const QUEUE_X0 = 150;
  const QUEUE_GAP = 125;
  const CUSTOMER_Y = 290;
  const COUNTER_Y = 392;
  const CUP_X = 830;

  const ING = Object.fromEntries(cfg.INGREDIENTS.map((i) => [i.id, i]));

  let game = null;
  let paused = false;
  let showDebug = false;
  let lastTs = 0;
  let clock = 0;
  const drawX = new Map(); // posisi animasi pelanggan

  // ---------- Tombol di canvas ----------
  const buttons = (() => {
    const list = cfg.INGREDIENTS.map((ing) => ({
      label: ing.name,
      key: ing.key,
      color: ing.color,
      action: () => game && game.addIngredient(ing.id),
    }));
    list.push({ label: 'Sajikan', key: 'Spasi', color: '#81b29a', action: () => game && game.serve() });
    list.push({ label: 'Buang', key: 'X', color: '#e07a5f', action: () => game && game.discardCup() });
    const w = 130;
    const gap = 14;
    const x0 = (W - (list.length * w + (list.length - 1) * gap)) / 2;
    list.forEach((b, i) => Object.assign(b, { x: x0 + i * (w + gap), y: 500, w, h: 72 }));
    return list;
  })();

  // ---------- Util gambar ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function text(str, x, y, size, color, align = 'left', weight = 'normal') {
    ctx.font = `${weight} ${size}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  // ---------- Latar ----------
  function drawBackground() {
    ctx.fillStyle = '#f6e3c6';
    ctx.fillRect(0, 0, W, H);

    // wallpaper garis
    ctx.fillStyle = '#f0d8b6';
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 18, COUNTER_Y);

    // jendela
    ctx.fillStyle = '#9bc4d8';
    roundRect(420, 70, 200, 120, 10);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    circle(580, 100, 16);
    ctx.strokeStyle = '#8b5a3c';
    ctx.lineWidth = 8;
    roundRect(420, 70, 200, 120, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(520, 70);
    ctx.lineTo(520, 190);
    ctx.stroke();

    // lampu gantung
    for (const lx of [260, 760]) {
      ctx.strokeStyle = '#5a3d2b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, 40);
      ctx.stroke();
      ctx.fillStyle = '#e9a23b';
      ctx.beginPath();
      ctx.arc(lx, 52, 18, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 140, 0.18)';
      circle(lx, 60, 60);
    }

    // tanaman
    ctx.fillStyle = '#b5651d';
    roundRect(30, 330, 50, 60, 8);
    ctx.fill();
    ctx.fillStyle = '#6a994e';
    circle(55, 315, 26);
    circle(38, 300, 16);
    circle(72, 298, 18);

    // meja bar
    ctx.fillStyle = '#a0693f';
    ctx.fillRect(0, COUNTER_Y, W, 80);
    ctx.fillStyle = '#c4874f';
    ctx.fillRect(0, COUNTER_Y, W, 14);
    ctx.fillStyle = '#8a5632';
    for (let x = 0; x < W; x += 120) ctx.fillRect(x, COUNTER_Y + 22, 3, 58);

    // lantai
    ctx.fillStyle = '#6e4a33';
    ctx.fillRect(0, COUNTER_Y + 80, W, H - COUNTER_Y - 80);
  }

  function drawMenuBoard() {
    const x = 680;
    const y = 62;
    ctx.fillStyle = '#3d3b37';
    roundRect(x, y, 260, 214, 10);
    ctx.fill();
    ctx.strokeStyle = '#8b5a3c';
    ctx.lineWidth = 6;
    roundRect(x, y, 260, 214, 10);
    ctx.stroke();
    text('MENU', x + 130, y + 22, 18, '#fdf6e3', 'center', 'bold');
    cfg.MENU.forEach((m, i) => {
      const yy = y + 56 + i * 34;
      text(m.name, x + 16, yy, 15, '#fdf6e3');
      m.recipe.forEach((id, j) => {
        ctx.fillStyle = ING[id].color;
        circle(x + 170 + j * 26, yy, 9);
        text(ING[id].key, x + 170 + j * 26, yy, 11, id === 'susu' ? '#3a2618' : '#fff', 'center', 'bold');
      });
    });
  }

  // ---------- Pelanggan ----------
  function drawCustomer(c, x, isFront) {
    const y = CUSTOMER_Y;
    const mood = c.patienceLeft / c.patience;
    const bob = Math.sin(clock * 3 + c.id) * 2;

    if (isFront) {
      ctx.fillStyle = 'rgba(255, 210, 120, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y + 96, 48, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // badan
    ctx.fillStyle = c.look.shirt;
    roundRect(x - 34, y + bob, 68, 100, 24);
    ctx.fill();

    // kepala
    ctx.fillStyle = c.look.skin;
    circle(x, y - 22 + bob, 28);

    // rambut
    ctx.fillStyle = c.look.hair;
    ctx.beginPath();
    ctx.arc(x, y - 26 + bob, 29, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    if (c.look.hairStyle === 1) circle(x, y - 54 + bob, 11);
    if (c.look.hairStyle === 2) {
      ctx.fillRect(x - 29, y - 30 + bob, 8, 30);
      ctx.fillRect(x + 21, y - 30 + bob, 8, 30);
    }

    // wajah
    ctx.fillStyle = '#2b1d16';
    circle(x - 10, y - 22 + bob, 3);
    circle(x + 10, y - 22 + bob, 3);
    ctx.strokeStyle = '#2b1d16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (mood > 0.5) ctx.arc(x, y - 12 + bob, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood > 0.25) {
      ctx.moveTo(x - 7, y - 8 + bob);
      ctx.lineTo(x + 7, y - 8 + bob);
    } else ctx.arc(x, y - 2 + bob, 8, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    if (mood > 0.5) {
      ctx.fillStyle = 'rgba(230, 120, 110, 0.35)';
      circle(x - 17, y - 14 + bob, 5);
      circle(x + 17, y - 14 + bob, 5);
    }

    // balon pesanan
    const bw = 118;
    const bh = 58;
    const bx = x - bw / 2;
    const by = y - 140;
    ctx.fillStyle = '#fffaf3';
    roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 8, by + bh);
    ctx.lineTo(x, by + bh + 10);
    ctx.lineTo(x + 8, by + bh);
    ctx.fill();
    text(c.order.name, x, by + 18, 14, '#3a2618', 'center', 'bold');
    const n = c.order.recipe.length;
    c.order.recipe.forEach((id, j) => {
      ctx.fillStyle = ING[id].color;
      const cx = x - ((n - 1) * 22) / 2 + j * 22;
      circle(cx, by + 40, 8);
      ctx.strokeStyle = '#d6c2a8';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // bar kesabaran
    const pw = 90;
    ctx.fillStyle = '#e6d3bb';
    roundRect(x - pw / 2, y - 70, pw, 8, 4);
    ctx.fill();
    ctx.fillStyle = mood > 0.5 ? '#81b29a' : mood > 0.25 ? '#f2cc8f' : '#e07a5f';
    roundRect(x - pw / 2, y - 70, Math.max(4, pw * mood), 8, 4);
    ctx.fill();
  }

  function drawQueue(dt) {
    const alive = new Set();
    game.queue.forEach((c, i) => {
      alive.add(c.id);
      const target = QUEUE_X0 + i * QUEUE_GAP;
      const cur = drawX.has(c.id) ? drawX.get(c.id) : W + 60;
      const next = cur + (target - cur) * Math.min(1, dt * 6);
      drawX.set(c.id, next);
    });
    for (const id of [...drawX.keys()]) if (!alive.has(id)) drawX.delete(id);

    // gambar dari belakang ke depan
    for (let i = game.queue.length - 1; i >= 0; i--) {
      const c = game.queue[i];
      drawCustomer(c, drawX.get(c.id), i === 0);
    }
  }

  // ---------- Gelas & tombol ----------
  function drawCup() {
    const x = CUP_X;
    const bottom = COUNTER_Y + 60;
    const w = 64;
    const h = 78;
    ctx.fillStyle = '#fffaf3';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, bottom - h);
    ctx.lineTo(x + w / 2, bottom - h);
    ctx.lineTo(x + w / 2 - 8, bottom);
    ctx.lineTo(x - w / 2 + 8, bottom);
    ctx.closePath();
    ctx.fill();

    const layerH = (h - 10) / cfg.CUP_CAPACITY;
    game.cup.forEach((id, i) => {
      ctx.fillStyle = ING[id].color;
      const yTop = bottom - (i + 1) * layerH;
      ctx.fillRect(x - w / 2 + 10, yTop, w - 20, layerH - 2);
    });

    ctx.strokeStyle = '#8b5a3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, bottom - h);
    ctx.lineTo(x - w / 2 + 8, bottom);
    ctx.lineTo(x + w / 2 - 8, bottom);
    ctx.lineTo(x + w / 2, bottom - h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w / 2 + 2, bottom - h / 2, 14, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    const names = game.cup.map((id) => ING[id].name).join(' + ') || 'gelas kosong';
    text(names, x, bottom + 14, 13, '#fff8ef', 'center');
  }

  function drawButtons() {
    for (const b of buttons) {
      ctx.fillStyle = '#4a3223';
      roundRect(b.x, b.y + 4, b.w, b.h, 12);
      ctx.fill();
      ctx.fillStyle = '#fff4e4';
      roundRect(b.x, b.y, b.w, b.h, 12);
      ctx.fill();
      ctx.fillStyle = b.color;
      circle(b.x + 26, b.y + b.h / 2, 14);
      ctx.strokeStyle = '#c9b193';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(b.label, b.x + 48, b.y + 28, 16, '#3a2618', 'left', 'bold');
      text(`[${b.key}]`, b.x + 48, b.y + 50, 13, '#8b6a4f');
    }
  }

  // ---------- HUD ----------
  function drawHud() {
    ctx.fillStyle = 'rgba(58, 38, 24, 0.85)';
    ctx.fillRect(0, 0, W, 46);
    const left = Math.max(0, game.duration - game.time);
    const mm = Math.floor(left / 60);
    const ss = Math.floor(left % 60)
      .toString()
      .padStart(2, '0');
    text(`Skor ${game.score}`, 18, 23, 20, '#fdf6e3', 'left', 'bold');
    text(`Waktu ${mm}:${ss}`, 190, 23, 20, '#fdf6e3', 'left', 'bold');
    text(`Tersaji ${game.metrics.count('correct')}`, 360, 23, 18, '#cfe8d8');
    text(`Antrean ${game.queue.length}/${cfg.MAX_QUEUE}`, 500, 23, 18, '#f6dcb6');
    text(MODE_LABEL[game.mode], W - 18, 23, 15, '#f2cc8f', 'right');
  }

  function drawFeedback() {
    game.feedback.forEach((f, i) => {
      const alpha = Math.max(0, 1 - f.age / 1.6);
      const color = f.kind === 'good' ? '46, 125, 80' : f.kind === 'bad' ? '190, 60, 50' : '120, 90, 50';
      ctx.globalAlpha = alpha;
      text(f.text, 470, 360 - f.age * 30 - i * 22, 20, `rgb(${color})`, 'center', 'bold');
      ctx.globalAlpha = 1;
    });
  }

  function drawDebug() {
    const sp = game.spawner;
    const lines = [`Interval kedatangan: ${sp.interval.toFixed(2)} s (${MODE_LABEL[game.mode]})`];
    const e = sp.lastEval;
    if (game.mode === 'adaptive') {
      if (e) {
        lines.push(`t=${e.t.toFixed(0)}s  akurasi=${e.akurasi.toFixed(2)}  waktu=${e.waktu.toFixed(2)}`);
        lines.push(`aturan: ${e.rule} (${e.ruleStrength.toFixed(2)})`);
        lines.push(`delta=${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(2)} s${e.guarded ? '  [guardrail antrean]' : ''}`);
      } else {
        lines.push(`menunggu data (pemanasan ${cfg.ADAPT_WARMUP} s)`);
      }
    }
    const h = 14 + lines.length * 18;
    ctx.fillStyle = 'rgba(30, 20, 14, 0.8)';
    roundRect(8, 52, 410, h, 8);
    ctx.fill();
    lines.forEach((l, i) => text(l, 18, 62 + i * 18, 13, '#e8f5e9'));
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(40, 26, 18, 0.55)';
    ctx.fillRect(0, 0, W, H);
    text('Jeda', W / 2, H / 2 - 10, 48, '#fdf6e3', 'center', 'bold');
    text('Tekan P untuk lanjut', W / 2, H / 2 + 36, 18, '#fdf6e3', 'center');
  }

  // ---------- Loop ----------
  function frame(ts) {
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    clock += dt;

    if (game && !paused && !game.finished) {
      game.update(dt);
      if (game.finished) showResult();
    }

    drawBackground();
    drawMenuBoard();
    if (game) {
      drawQueue(paused ? 0 : dt);
      drawCup();
      drawButtons();
      drawHud();
      drawFeedback();
      if (showDebug) drawDebug();
      if (paused && !game.finished) drawPause();
    }
    requestAnimationFrame(frame);
  }

  // ---------- Layar ----------
  function startGame(mode) {
    const seed = parseInt($('seed').value, 10);
    const duration = parseInt($('duration').value, 10);
    game = new CC.Game({
      mode,
      seed: Number.isFinite(seed) ? seed : 2026,
      duration: Number.isFinite(duration) && duration >= 30 ? duration : cfg.SESSION_DURATION,
      playerId: $('playerId').value.trim() || '-',
    });
    drawX.clear();
    paused = false;
    menuEl.classList.add('hidden');
    resultEl.classList.add('hidden');
  }

  const RESULT_LABELS = {
    mode: 'Mode',
    seed: 'Seed',
    skor: 'Skor',
    pelanggan_datang: 'Pelanggan datang',
    dilayani_benar: 'Dilayani benar',
    dilayani_salah: 'Dilayani salah',
    pergi_kehabisan_sabar: 'Pergi (kesabaran habis)',
    ditolak_antrean_penuh: 'Ditolak (antrean penuh)',
    tingkat_layanan: 'Tingkat layanan',
    akurasi_pesanan: 'Akurasi pesanan',
    rata_waktu_layanan_s: 'Rata-rata waktu layanan (s)',
    persen_waktu_antrean_padat: 'Waktu antrean padat (%)',
    interval_rata_s: 'Rata-rata interval kedatangan (s)',
  };

  function showResult() {
    const s = game.summary;
    s.waktu_selesai = new Date().toISOString();
    saveHistory(s);
    const table = $('resultTable');
    table.innerHTML = '';
    for (const [key, label] of Object.entries(RESULT_LABELS)) {
      const tr = document.createElement('tr');
      const v = key === 'mode' ? MODE_LABEL[s.mode] : s[key];
      tr.innerHTML = `<td>${label}</td><td></td>`;
      tr.lastChild.textContent = v;
      table.appendChild(tr);
    }
    resultEl.classList.remove('hidden');
  }

  function showMenu() {
    resultEl.classList.add('hidden');
    menuEl.classList.remove('hidden');
    game = null;
    refreshHistoryInfo();
  }

  // ---------- Riwayat & unduhan ----------
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(summary) {
    try {
      const all = loadHistory();
      all.push(summary);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    } catch (e) {
      // riwayat hanya fitur bantu; abaikan bila storage tidak tersedia
    }
  }

  function refreshHistoryInfo() {
    $('historyInfo').textContent = `${loadHistory().length} sesi tersimpan`;
  }

  function download(name, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function fileTag() {
    const s = game.summary;
    return `${s.id_penguji}_${s.mode}_seed${s.seed}`;
  }

  // ---------- Event ----------
  document.querySelectorAll('[data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => startGame(btn.dataset.mode))
  );
  $('backMenu').addEventListener('click', showMenu);
  $('dlSummary').addEventListener('click', () => download(`ringkasan_${fileTag()}.csv`, CC.toCSV([game.summary])));
  $('dlTimeline').addEventListener('click', () =>
    download(`timeline_${fileTag()}.csv`, CC.toCSV(game.metrics.timeline))
  );
  $('dlAdapt').addEventListener('click', () => {
    const rows = CC.adaptationRows(game.spawner.log);
    download(`adaptasi_${fileTag()}.csv`, rows.length ? CC.toCSV(rows) : 'tidak ada penyesuaian (mode baseline)');
  });
  $('dlHistory').addEventListener('click', () => {
    const all = loadHistory();
    if (all.length) download('riwayat_sesi_cozy_cafe.csv', CC.toCSV(all));
  });
  $('clearHistory').addEventListener('click', () => {
    if (!confirm('Hapus semua riwayat sesi di browser ini?')) return;
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      /* abaikan */
    }
    refreshHistoryInfo();
  });

  window.addEventListener('keydown', (e) => {
    if (!game || game.finished) return;
    const k = e.key.toLowerCase();
    if (k === 'p') {
      paused = !paused;
      return;
    }
    if (k === 'd') {
      showDebug = !showDebug;
      return;
    }
    if (k === 'escape') {
      game.finish();
      showResult();
      return;
    }
    if (paused) return;

    const ing = cfg.INGREDIENTS.find((i) => i.key === k);
    if (ing) game.addIngredient(ing.id);
    else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      game.serve();
    } else if (k === 'x' || k === 'backspace') {
      e.preventDefault();
      game.discardCup();
    }
  });

  canvas.addEventListener('click', (e) => {
    if (!game || paused || game.finished) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    const hit = buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit) hit.action();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && !game.finished) paused = true;
  });

  refreshHistoryInfo();
  requestAnimationFrame(frame);
})();
