// csv.js — ekspor log ke CSV. Dipakai browser (tombol unduh) dan Node (simulasi).
(function (root) {
  const q = (v) => {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const row = (arr) => arr.map(q).join(',');
  const f = (n, d) => (typeof n === 'number' && isFinite(n) ? n.toFixed(d === undefined ? 3 : d) : '');

  function customersCsv(game, tester) {
    const head = 'tester,seed,mode,customer_id,order,arrived_at,ended_at,outcome,wait_seconds,tip,score_delta';
    const rows = game.history.map((h) => row([
      tester, game.seed, game.mode, h.id, h.order, f(h.arrivedAt), f(h.endedAt), h.outcome, f(h.wait), h.tip, h.scoreDelta,
    ]));
    return [head, ...rows].join('\n') + '\n';
  }

  function samplesCsv(game, tester) {
    const head = 'tester,seed,mode,t,queue_len,interval,score';
    const rows = game.samples.map((s) => row([tester, game.seed, game.mode, s.t, s.queueLen, f(s.interval), s.score]));
    return [head, ...rows].join('\n') + '\n';
  }

  const SUMMARY_COLS = ['tester', 'seed', 'mode', 'score', 'correct', 'wrong', 'left', 'rejected', 'customers_arrived',
    'service_rate', 'accuracy', 'avg_service_time', 'crowded_pct', 'avg_queue_len', 'avg_interval'];
  const summaryHeader = () => SUMMARY_COLS.join(',');
  const summaryRow = (s, tester) => row([
    tester, s.seed, s.mode, s.score, s.correct, s.wrong, s.left, s.rejected, s.customersArrived,
    f(s.serviceRate), f(s.accuracy), f(s.avgServiceTime), f(s.crowdedPct, 1), f(s.avgQueueLen), f(s.avgInterval),
  ]);

  const API = { customersCsv, samplesCsv, summaryHeader, summaryRow };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CSV = API;
})(typeof window !== 'undefined' ? window : globalThis);