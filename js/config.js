// Konfigurasi bersama. Semua aturan di sini dipakai oleh versi Baseline
// maupun versi Adaptif, sehingga perbandingan keduanya adil.
(function (root) {
  const CC = (root.CC = root.CC || {});

  CC.Config = {
    SESSION_DURATION: 180, // detik per sesi
    FIRST_CUSTOMER_DELAY: 1.5,

    // Laju kedatangan pelanggan (detik antar pelanggan)
    BASE_SPAWN_INTERVAL: 6.0, // baseline tetap di nilai ini, adaptif mulai dari sini
    MIN_SPAWN_INTERVAL: 3.0,
    MAX_SPAWN_INTERVAL: 9.0,

    PATIENCE: 22, // detik sebelum pelanggan pergi
    MAX_QUEUE: 5, // pelanggan ke-6 ditolak karena antrean penuh
    CUP_CAPACITY: 3,

    SCORE_CORRECT: 10,
    SCORE_TIP_MAX: 5, // bonus sesuai sisa kesabaran
    SCORE_WRONG: -5,
    SCORE_MISSED: -3, // pelanggan pergi / ditolak

    // Pengatur kesulitan adaptif
    ADAPT_WARMUP: 12, // belum ada penyesuaian sebelum detik ke-12
    ADAPT_PERIOD: 5, // evaluasi tiap 5 detik
    ADAPT_WINDOW: 6, // jumlah pelanggan terakhir yang dianalisis
    ADAPT_MIN_SAMPLES: 3,
    ADAPT_MAX_STEP: 1.0, // perubahan interval maksimum per evaluasi (detik)
    ADAPT_QUEUE_GUARD: 3, // antrean >= 3 orang: laju tidak boleh dipercepat

    INGREDIENTS: [
      { id: 'espresso', name: 'Espresso', key: '1', color: '#5b3a29' },
      { id: 'susu', name: 'Susu', key: '2', color: '#f3ede2' },
      { id: 'cokelat', name: 'Cokelat', key: '3', color: '#8a5432' },
      { id: 'matcha', name: 'Matcha', key: '4', color: '#8fb35a' },
    ],

    MENU: [
      { id: 'kopi', name: 'Kopi Hitam', recipe: ['espresso'] },
      { id: 'latte', name: 'Cafe Latte', recipe: ['espresso', 'susu'] },
      { id: 'mocha', name: 'Mocha', recipe: ['espresso', 'cokelat', 'susu'] },
      { id: 'matcha', name: 'Matcha Latte', recipe: ['matcha', 'susu'] },
      { id: 'cokelat', name: 'Cokelat Panas', recipe: ['cokelat', 'susu'] },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
