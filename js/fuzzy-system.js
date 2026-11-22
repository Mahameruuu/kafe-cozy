// fuzzy-system.js — DESAIN sistem fuzzy sebagai data. Inilah berkas yang kamu ubah
// saat menyetel desain; mesinnya (fuzzy-engine.js) tidak perlu disentuh.
//
// STATUS: semua parameter di sini adalah TEBAKAN AWAL dari rancangan draf, belum
// disetel dengan data. Setiap perubahan harus dicatat (apa, kenapa, hasil sebelum/sesudah).
(function (root) {
  const SYSTEM = {
    inputs: {
      // proporsi pelanggan dilayani benar dari jendela hasil terakhir
      akurasi: {
        range: [0, 1],
        sets: { rendah: [0, 0, 0.5, 0.7], sedang: [0.5, 0.75, 0.9], tinggi: [0.75, 0.9, 1, 1] },
      },
      // lama menunggu relatif = lama menunggu / kesabaran (1 = sampai pergi)
      waktu: {
        range: [0, 1],
        sets: { cepat: [0, 0, 0.15, 0.3], normal: [0.2, 0.4, 0.6], lambat: [0.5, 0.7, 1, 1] },
      },
    },
    // perubahan interval kedatangan dalam detik: negatif = pelanggan datang lebih cepat (lebih sulit)
    output: {
      name: 'delta',
      range: [-1.5, 1.5],
      step: 0.01,
      sets: {
        percepat_banyak: [-1.5, -1.5, -1.2, -0.6],
        percepat: [-1.2, -0.6, 0],
        tetap: [-0.4, 0, 0.4],
        perlambat: [0, 0.6, 1.2],
        perlambat_banyak: [0.6, 1.2, 1.5, 1.5],
      },
    },
    // basis aturan 3x3: akurasi tinggi + pelanggan cepat dilayani -> pemain terlalu santai -> percepat
    rules: [
      { if: { akurasi: 'tinggi', waktu: 'cepat' }, then: 'percepat_banyak' },
      { if: { akurasi: 'tinggi', waktu: 'normal' }, then: 'percepat' },
      { if: { akurasi: 'tinggi', waktu: 'lambat' }, then: 'tetap' },
      { if: { akurasi: 'sedang', waktu: 'cepat' }, then: 'percepat' },
      { if: { akurasi: 'sedang', waktu: 'normal' }, then: 'tetap' },
      { if: { akurasi: 'sedang', waktu: 'lambat' }, then: 'perlambat' },
      { if: { akurasi: 'rendah', waktu: 'cepat' }, then: 'tetap' },
      { if: { akurasi: 'rendah', waktu: 'normal' }, then: 'perlambat' },
      { if: { akurasi: 'rendah', waktu: 'lambat' }, then: 'perlambat_banyak' },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SYSTEM;
  else root.FuzzySystem = SYSTEM;
})(typeof window !== 'undefined' ? window : globalThis);