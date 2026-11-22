# Kontrak bersama: Cozy Cafe

Dokumen ini menjaga agar versi baseline dan versi adaptif bisa dibandingkan secara adil.
Hanya satu hal yang boleh berbeda antara kedua versi: **logika laju kedatangan pelanggan (spawner)**.

## 1. Aturan yang sama
Semua aturan ada di `js/config.js`. Jangan menduplikasi nilainya di berkas lain.

## 2. Urutan pesanan identik
- Pesanan pelanggan ke-n dipilih dari RNG ber-seed (`js/rng.js`) khusus pesanan.
- RNG pesanan **hanya** dipakai satu kali per pelanggan baru dan tidak boleh dipakai untuk hal lain
  (bot, animasi, dll. memakai RNG sendiri). Dengan begitu, pelanggan ke-n selalu memesan minuman yang
  sama pada seed yang sama, walau waktu kedatangannya berbeda antar versi.

## 3. Antarmuka spawner
Game tidak tahu cara kerja spawner. Game hanya memanggil:

```js
spawner.reset(game)        // sekali, di awal sesi
spawner.update(game, dt)   // setiap tick (dt dalam detik)
spawner.getInterval()      // detik antar pelanggan; dibaca saat menjadwalkan pelanggan berikutnya
```

Pada tiap tick, game mengurangi `spawnTimer`. Saat `spawnTimer <= 0`:
muncul satu pelanggan, lalu `spawnTimer += spawner.getInterval()`.

Spawner hanya boleh **membaca** state game, tidak boleh mengubahnya:

| Properti game | Isi |
|---|---|
| `game.time` | detik sejak sesi mulai |
| `game.queue` | array pelanggan yang sedang mengantre (`patienceLeft`, `arrivedAt`) |
| `game.history` | hasil pelanggan yang sudah selesai: `{ id, outcome, arrivedAt, endedAt }` |

`outcome` bernilai `correct`, `wrong`, `left` (pergi), atau `rejected` (ditolak).

**Keputusan aturan:** penyajian salah membuat pelanggan langsung pergi dengan hasil `wrong` (-5),
sehingga akurasi (benar ÷ benar+salah) dihitung per pelanggan. Aturan ini ada di inti game
dan berlaku sama untuk kedua versi; jangan diubah tanpa menjalankan ulang semua hasil.

### Metode opsional pada spawner
- `debugLines(game)` mengembalikan array string untuk panel debug (tombol D).
- `logCsv(tester, game)` mengembalikan teks CSV log keputusan (hanya versi adaptif); jika ada,
  tombol unduh log adaptasi muncul di layar hasil.

### Mendaftarkan spawner ke game
Berkas spawner mengisi `window.BaselineSpawner` atau `window.AdaptiveSpawner` (lihat pola di
`dev/dev-spawner.js`), lalu tag `<script>`-nya diaktifkan di `index.html`. `dev/dev-spawner.js`
hanya untuk pengembangan dan harus dihapus dari `index.html` sebelum pengambilan data evaluasi.

**Untuk Mahameru:** simpan baseline sebagai `js/baseline-spawner.js` dengan pola yang sama seperti
`dev/dev-spawner.js` (kelas yang diekspor lewat `module.exports` untuk Node dan `window.BaselineSpawner`
untuk browser). Setelah berkas itu ada, `node tools/simulate.js` otomatis memakainya sebagai pembanding
(label `baseline`), dan tombol Mode Baseline aktif di `index.html` setelah tag `<script>`-nya diaktifkan.

## 4. Pembagian tanggung jawab
- **Aurel**: inti game (`game.js`, `main.js`, metrik, log), `AdaptiveSpawner`, bot, simulator.
  Dikerjakan dengan bantuan AI; semua interaksi penting dicatat di AI log.
- **Mahameru**: spawner baseline (`BaselineSpawner`), dirancang dan ditulis sendiri tanpa AI,
  dengan antarmuka di atas. Pendekatannya ditentukan sendiri (mis. interval tetap atau threshold).
- Laporan harus menyebut jujur bahwa inti game dibuat dengan bantuan AI, dan bahwa bagian non-AI
  yang dibuat manual adalah spawner baseline.

## 5. Skema log (kolom CSV)
- Per pelanggan: `tester, seed, mode, customer_id, order, arrived_at, ended_at, outcome, wait_seconds, tip, score_delta`
- Per detik: `tester, seed, mode, t, queue_len, interval, score`
- Ringkasan sesi: `tester, seed, mode, score, correct, wrong, left, rejected, customers_arrived, service_rate, accuracy, avg_service_time, crowded_pct, avg_queue_len, avg_interval`
- Log adaptasi (hanya versi adaptif): `tester, seed, mode, t, n_data, akurasi, waktu, delta_fuzzy, aturan_dominan, kekuatan, delta_dipakai, guardrail, interval_sebelum, interval_sesudah, antrean`
