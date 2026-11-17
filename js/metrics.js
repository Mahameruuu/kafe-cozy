// Pencatatan metrik pengujian. Dipakai sama persis oleh kedua versi.
(function (root) {
  const CC = (root.CC = root.CC || {});

  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

  class Metrics {
    constructor() {
      this.outcomes = []; // { id, order, outcome, arrive, end, waitRatio }
      this.timeline = []; // sampel tiap 1 detik
      this.discards = 0;
    }

    record(entry) {
      this.outcomes.push(entry);
    }

    recentOutcomes(n) {
      return this.outcomes.slice(-n);
    }

    count(outcome) {
      return this.outcomes.filter((o) => o.outcome === outcome).length;
    }

    sample(game) {
      this.timeline.push({
        t: Math.round(game.time),
        antrean: game.queue.length,
        interval: round(game.spawner.interval, 2),
        skor: game.score,
        benar: this.count('correct'),
        salah: this.count('wrong'),
        pergi: this.count('missed'),
        ditolak: this.count('rejected'),
      });
    }

    summary(game) {
      const correct = this.count('correct');
      const wrong = this.count('wrong');
      const missed = this.count('missed');
      const rejected = this.count('rejected');
      const resolved = correct + wrong + missed + rejected;
      const served = this.outcomes.filter((o) => o.outcome === 'correct' || o.outcome === 'wrong');
      const queueLens = this.timeline.map((s) => s.antrean);
      const intervals = this.timeline.map((s) => s.interval);

      return {
        id_penguji: game.playerId,
        mode: game.mode,
        seed: game.seed,
        durasi_s: Math.round(game.time),
        skor: game.score,
        pelanggan_datang: resolved + game.queue.length,
        dilayani_benar: correct,
        dilayani_salah: wrong,
        pergi_kehabisan_sabar: missed,
        ditolak_antrean_penuh: rejected,
        sisa_antrean_akhir: game.queue.length,
        tingkat_layanan: round(resolved ? correct / resolved : 0),
        akurasi_pesanan: round(served.length ? correct / served.length : 0),
        rata_waktu_layanan_s: round(mean(served.map((o) => o.end - o.arrive)), 2),
        rata_panjang_antrean: round(mean(queueLens), 2),
        persen_waktu_antrean_padat: round(
          queueLens.length ? (100 * queueLens.filter((q) => q >= 4).length) / queueLens.length : 0,
          1
        ),
        gelas_dibuang: this.discards,
        interval_rata_s: round(mean(intervals), 2),
        interval_min_s: intervals.length ? Math.min(...intervals) : game.spawner.interval,
        interval_max_s: intervals.length ? Math.max(...intervals) : game.spawner.interval,
        jumlah_penyesuaian: game.spawner.log.length,
      };
    }
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  }

  function adaptationRows(log) {
    return log.map((e) => ({
      t: round(e.t, 1),
      sampel: e.samples,
      akurasi: round(e.akurasi),
      waktu_relatif: round(e.waktu),
      antrean: e.queue,
      output_fuzzy_s: round(e.fuzzyOutput),
      guardrail_aktif: e.guarded ? 'ya' : 'tidak',
      delta_s: round(e.delta),
      interval_sebelum_s: round(e.intervalBefore, 2),
      interval_sesudah_s: round(e.intervalAfter, 2),
      aturan_dominan: e.rule,
      kekuatan_aturan: round(e.ruleStrength),
    }));
  }

  CC.Metrics = Metrics;
  CC.toCSV = toCSV;
  CC.adaptationRows = adaptationRows;
})(typeof window !== 'undefined' ? window : globalThis);
