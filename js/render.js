// render.js — menggambar game ke canvas. Hanya MEMBACA state game, tidak mengubahnya.
(function (root) {
  const W = 960, H = 540;
  const COLORS = { espresso: '#4b2e1e', susu: '#f7f0e4', cokelat: '#7b3f24', matcha: '#7aa35a' };
  const LABEL = { espresso: 'Espresso', susu: 'Susu', cokelat: 'Cokelat', matcha: 'Matcha' };
  const SKIN = ['#f2c9a0', '#e0a97c', '#c98b5e', '#f5d7b8', '#d9a27a'];
  const TOAST_COLOR = { correct: '#2e7d32', wrong: '#c62828', left: '#c62828', rejected: '#c62828', info: '#5d4037' };

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  const fmtTime = (s) => {
    const r = Math.max(0, Math.ceil(s));
    return String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
  };
  const text = (ctx, str, x, y, font, color, align) => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.fillText(str, x, y);
  };

  function drawCustomer(ctx, c, i, patience) {
    const x = 70 + i * 130, y = 150, ratio = Math.max(0, c.patienceLeft / patience);
    // balon pesanan
    rrect(ctx, x - 55, 52, 110, 38, 10); ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.strokeStyle = '#b08968'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, c.order, x, 76, 'bold 14px sans-serif', '#4e342e', 'center');
    // badan dan wajah
    ctx.beginPath(); ctx.arc(x, y + 6, 34, 0, Math.PI * 2); ctx.fillStyle = SKIN[c.id % SKIN.length]; ctx.fill();
    if (i === 0) { ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.fillStyle = '#3e2723';
    ctx.beginPath(); ctx.arc(x - 12, y, 4, 0, Math.PI * 2); ctx.arc(x + 12, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 3; ctx.beginPath();
    if (ratio > 0.5) { ctx.arc(x, y + 14, 12, 0.15 * Math.PI, 0.85 * Math.PI); }
    else if (ratio > 0.25) { ctx.moveTo(x - 10, y + 22); ctx.lineTo(x + 10, y + 22); }
    else { ctx.arc(x, y + 32, 12, 1.15 * Math.PI, 1.85 * Math.PI); }
    ctx.stroke();
    // bar kesabaran
    ctx.fillStyle = '#d7ccc8'; ctx.fillRect(x - 45, 210, 90, 10);
    ctx.fillStyle = ratio > 0.5 ? '#66bb6a' : ratio > 0.25 ? '#ffca28' : '#ef5350';
    ctx.fillRect(x - 45, 210, 90 * ratio, 10);
  }

  function drawMenu(ctx, config) {
    rrect(ctx, 660, 20, 280, 200, 12); ctx.fillStyle = '#3e2f26'; ctx.fill();
    text(ctx, 'MENU', 800, 44, 'bold 16px sans-serif', '#f5e6c8', 'center');
    config.menu.forEach((m, i) => {
      const y = 70 + i * 30;
      text(ctx, m.name, 674, y, '13px sans-serif', '#f5e6c8');
      m.recipe.forEach((ing, k) => {
        ctx.beginPath(); ctx.arc(868 + k * 22, y - 5, 8, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[ing]; ctx.fill(); ctx.strokeStyle = '#f5e6c8'; ctx.lineWidth = 1; ctx.stroke();
      });
    });
  }

  function drawCup(ctx, game) {
    const cap = game.config.cupCapacity, x = 435, y = 360, w = 90, h = 108, layerH = (h - 10) / cap;
    game.cup.forEach((ing, k) => {
      ctx.fillStyle = COLORS[ing]; ctx.fillRect(x + 5, y + h - 5 - (k + 1) * layerH, w - 10, layerH);
    });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
    text(ctx, game.cup.length + '/' + cap, x + w / 2, y - 8, '13px sans-serif', '#fff', 'center');
  }

  function drawShelf(ctx, config) {
    Object.keys(config.ingredients).forEach((key, i) => {
      const name = config.ingredients[key], x = 110 + i * 190;
      rrect(ctx, x, 480, 150, 38, 8); ctx.fillStyle = COLORS[name]; ctx.fill();
      ctx.strokeStyle = '#f5e6c8'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, '[' + key + '] ' + LABEL[name], x + 75, 505, 'bold 14px sans-serif', name === 'susu' ? '#4e342e' : '#fff', 'center');
    });
  }

  function drawToasts(ctx, toasts) {
    toasts.forEach((t) => {
      ctx.globalAlpha = Math.max(0, 1 - t.age / 1.2);
      text(ctx, t.text, 480, 330 - t.age * 40, 'bold 20px sans-serif', TOAST_COLOR[t.kind] || TOAST_COLOR.info, 'center');
    });
    ctx.globalAlpha = 1;
  }

  function drawDebug(ctx, lines) {
    rrect(ctx, 20, 240, 330, 20 + lines.length * 18, 8); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fill();
    lines.forEach((l, i) => text(ctx, l, 32, 262 + i * 18, '12px monospace', '#c8e6c9'));
  }

  function draw(ctx, game, ui) {
    const C = game.config;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e8d8c3'; ctx.fillRect(0, 0, W, 330);
    ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, 330, W, H - 330);
    ctx.fillStyle = '#a06b47'; ctx.fillRect(0, 330, W, 8);
    text(ctx, 'Waktu ' + fmtTime(C.sessionSeconds - game.time), 20, 30, 'bold 20px sans-serif', '#4e342e');
    text(ctx, 'Skor ' + game.score, 230, 30, 'bold 20px sans-serif', '#4e342e');
    text(ctx, 'Antrean ' + game.queue.length + '/' + C.queueCapacity, 400, 30, '16px sans-serif', '#6d4c41');
    game.queue.forEach((c, i) => drawCustomer(ctx, c, i, C.customerPatience));
    drawMenu(ctx, C);
    drawCup(ctx, game);
    drawShelf(ctx, C);
    text(ctx, 'Spasi: sajikan   X: buang gelas   D: panel debug', 480, 532, '12px sans-serif', '#f5e6c8', 'center');
    drawToasts(ctx, ui.toasts || []);
    if (ui.debug) drawDebug(ctx, ui.debugLines || []);
  }

  const API = { draw, W, H };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Render = API;
})(typeof window !== 'undefined' ? window : globalThis);