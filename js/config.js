// config.js — satu-satunya sumber aturan game. Dipakai browser dan Node.
// Kedua versi (baseline & adaptif) HARUS memakai berkas ini tanpa perubahan,
// supaya satu-satunya perbedaan adalah logika laju kedatangan pelanggan.
//
// Semua nilai adalah NILAI AWAL yang belum diuji. Boleh disetel, tetapi
// catat alasannya, dan jangan menyetel setelah hasil evaluasi akhir keluar.
(function (root) {
  const CONFIG = {
    sessionSeconds: 180,     // durasi sesi
    customerPatience: 22,    // detik kesabaran tiap pelanggan
    queueCapacity: 5,        // pelanggan ke-6 dst. ditolak
    cupCapacity: 3,          // maksimal bahan dalam satu gelas

    // tombol 1-4 -> bahan
    ingredients: { 1: 'espresso', 2: 'susu', 3: 'cokelat', 4: 'matcha' },

    // Resep dibandingkan sebagai himpunan bahan (urutan tuang tidak berpengaruh).
    menu: [
      { name: 'Kopi Hitam',   recipe: ['espresso'] },
      { name: 'Cafe Latte',   recipe: ['espresso', 'susu'] },
      { name: 'Mocha',        recipe: ['espresso', 'cokelat', 'susu'] },
      { name: 'Matcha Latte', recipe: ['matcha', 'susu'] },
      { name: 'Cokelat Panas', recipe: ['cokelat', 'susu'] },
    ],

    // Skor. Tip = round(tipMax * sisaKesabaran / customerPatience).
    score: { correct: 10, tipMax: 5, wrong: -5, lost: -3 },

    // Pengaturan kedatangan yang berlaku untuk kedua versi.
    spawn: { initialInterval: 6.0, firstCustomerAt: 1.0 },

    // Seed dipisah: satu set untuk menyetel, satu set untuk evaluasi akhir.
    seeds: {
      tuning: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
      evaluation: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);