# Cozy Cafe

Prototipe game manajemen kafe untuk tugas Intelligent Game Technology & Design (Assessment 3).
Pemain berperan sebagai barista yang meracik minuman sesuai pesanan pelanggan sebelum kesabaran mereka habis.

Game memiliki dua versi dengan aturan yang sama:

| Versi | Laju kedatangan pelanggan |
|---|---|
| **Baseline (Non-AI)** | Tetap, satu pelanggan tiap 6,0 detik |
| **Adaptif (Fuzzy)** | Mulai 6,0 detik, lalu diatur oleh fuzzy Mamdani tiap 5 detik berdasarkan performa pemain (rentang 3,0–9,0 detik) |

## Menjalankan game

Tidak perlu instalasi. Buka `index.html` di browser (Chrome, Firefox, Edge, atau Safari).

1. Isi **ID Penguji**, **Seed**, dan **Durasi**. Gunakan seed yang sama untuk membandingkan kedua versi.
2. Pilih **Mode Baseline** atau **Mode Adaptif**.
3. Setelah sesi selesai, unduh CSV ringkasan, timeline, dan log adaptasi dari layar hasil.
   Semua ringkasan sesi juga tersimpan di browser dan dapat diunduh sekaligus dari menu (**Unduh riwayat sesi**).

### Kontrol

| Tombol | Aksi |
|---|---|
| `1` `2` `3` `4` | Tambah Espresso / Susu / Cokelat / Matcha ke gelas |
| `Spasi` / `Enter` | Sajikan ke pelanggan terdepan |
| `X` / `Backspace` | Buang isi gelas |
| `P` | Jeda |
| `D` | Panel debug (interval, input fuzzy, aturan dominan) |
| `Esc` | Akhiri sesi |

Tombol di layar juga dapat diklik dengan mouse.

### Menu

| Minuman | Bahan |
|---|---|
| Kopi Hitam | Espresso |
| Cafe Latte | Espresso + Susu |
| Mocha | Espresso + Cokelat + Susu |
| Matcha Latte | Matcha + Susu |
| Cokelat Panas | Cokelat + Susu |

Urutan bahan tidak berpengaruh.

## Simulasi pengujian (opsional, butuh Node.js)

```bash
node tools/simulate.js 10
```

Menjalankan pemain bot (pemula, menengah, ahli, dan pemula→ahli) pada kedua versi dengan seed 1–10.
Hasil tersimpan di folder `results/`:

- `sim_semua_run.csv`: ringkasan setiap run
- `sim_agregat.csv`: rata-rata dan simpangan baku per skenario dan versi
- `sim_adaptasi_<skenario>.csv`: log keputusan fuzzy (seed 1)
- `sim_timeline_<skenario>_<mode>.csv`: kondisi game tiap detik (seed 1)

## Struktur kode

```
index.html          halaman game
css/style.css       gaya menu dan layar hasil
js/config.js        aturan bersama kedua versi (skor, kesabaran, menu, parameter adaptif)
js/rng.js           random dengan seed
js/fuzzy.js         mesin inferensi fuzzy Mamdani
js/difficulty.js    FixedSpawner (baseline) dan AdaptiveSpawner (fuzzy)
js/metrics.js       pencatatan metrik dan ekspor CSV
js/game.js          logika inti game (tanpa tampilan)
js/main.js          tampilan canvas, input, menu, dan layar hasil
tools/simulate.js   simulasi bot untuk pengujian
```
