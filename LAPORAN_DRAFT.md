# DRAF LAPORAN — COZY CAFE

> **Catatan untuk kelompok (hapus sebelum dikumpulkan):**
> - Bagian bertanda **[ISI]** harus kalian isi sendiri: identitas, screenshot, hasil uji pemain manusia, refleksi pribadi, dan AI Log.
> - Data di 5.4 bagian A berasal dari **simulasi bot** (`node tools/simulate.js 10`), bukan pemain manusia. Labelnya jangan dihapus. Tambahkan data uji pemain manusia di bagian B.
> - Draf ini disusun dengan bantuan asisten AI. Catat penggunaannya di AI Log (Lampiran A) dan di refleksi 7.2/7.3. Template tugas memang mewajibkannya.
> - Kalau parameter di `js/config.js` diubah, jalankan ulang simulasi lalu perbarui semua angka.

---

## IDENTITAS PROYEK

- **Nama game:** Cozy Cafe
- **Opsi fitur:** Adaptive Difficulty
- **Platform dan teknologi:** Web browser; HTML5 Canvas, JavaScript (tanpa library eksternal); Node.js untuk simulasi pengujian
- **Repository bersama:** [ISI tautan]
- **Deskripsi singkat:** Pemain berperan sebagai barista di kafe kecil. Pelanggan datang dan mengantre dengan pesanan masing-masing. Pemain meracik minuman dari empat bahan, lalu menyajikannya ke pelanggan terdepan sebelum kesabaran pelanggan habis. Tujuannya mengumpulkan skor setinggi mungkin dalam 3 menit.

---

## 1. PENDAHULUAN

### 1.1 Latar Belakang
Game bertema *cozy* menawarkan suasana santai dengan tekanan ringan, misalnya mengelola kafe, berkebun, atau memasak. Tema kafe dipilih karena aturannya mudah dipahami (pesan → racik → sajikan), tetapi tetap ada tantangan manajemen waktu dari antrean pelanggan. Keseimbangan antara "santai" dan "menantang" inilah yang membuat tingkat kesulitan menjadi persoalan desain utama.

### 1.2 Masalah Desain Game
Pada versi dasar, pelanggan datang dengan interval tetap. Akibatnya tantangan tidak sesuai untuk semua pemain:
- Pemain cepat dan akurat hampir tidak pernah menghadapi antrean, sehingga game terasa membosankan.
- Pemain pemula bisa tertinggal dan pelanggan pergi, sehingga game terasa frustrasi.

Menurut teori *flow* (Csikszentmihalyi, 1990), pengalaman bermain paling baik ketika tantangan sebanding dengan kemampuan pemain. Interval tetap tidak bisa menyesuaikan diri dengan kemampuan pemain yang berbeda-beda, maupun dengan pemain yang semakin mahir di tengah permainan.

### 1.3 Tujuan Proyek
1. Membuat prototipe game Cozy Cafe yang dapat dimainkan dalam dua versi: Baseline (Non-AI) dan Adaptif.
2. Menerapkan *Adaptive Difficulty* berbasis Fuzzy Logic (Mamdani) yang mengatur laju kedatangan pelanggan berdasarkan performa pemain.
3. Membandingkan kedua versi dengan skenario dan metrik yang sama, lalu menilai apakah fitur adaptif membuat tantangan lebih sesuai dengan kemampuan pemain.

---

## 2. KONSEP DAN RANCANGAN GAME

### 2.1 Gameplay
1. Pelanggan datang, masuk antrean (maksimal 5 orang), dan menampilkan pesanan dalam balon teks.
2. Pemain menambahkan bahan ke gelas (tombol 1–4). Papan menu di kanan atas menunjukkan resep.
3. Pemain menyajikan minuman ke pelanggan terdepan (Spasi). Jika gelas salah, pemain bisa membuang isinya (X).
4. Penyajian benar memberi poin, ditambah tip sesuai sisa kesabaran. Penyajian salah dan pelanggan yang pergi mengurangi poin.
5. Sesi berakhir setelah 180 detik, lalu layar hasil menampilkan metrik dan tombol ekspor CSV.

### 2.2 Aturan dan Fitur Utama (sama pada kedua versi)

| Aturan | Nilai |
|---|---|
| Durasi sesi | 180 detik |
| Kesabaran pelanggan | 22 detik |
| Kapasitas antrean | 5 pelanggan; pelanggan berikutnya ditolak |
| Kapasitas gelas | 3 bahan |
| Bahan | Espresso (1), Susu (2), Cokelat (3), Matcha (4) |
| Menu | Kopi Hitam, Cafe Latte, Mocha, Matcha Latte, Cokelat Panas |
| Skor benar | +10, ditambah tip 0–5 sesuai sisa kesabaran |
| Skor salah | −5 |
| Pelanggan pergi / ditolak | −3 |
| Urutan pesanan | Ditentukan oleh *seed*; urutannya identik di kedua versi untuk seed yang sama |

### 2.3 Rancangan Perbandingan
- **Sama:** seluruh aturan di atas, tampilan, kontrol, urutan pesanan (seed), metrik, dan cara pencatatan. Semua aturan berada di satu berkas (`js/config.js`) yang dipakai kedua versi.
- **Berbeda:** hanya laju kedatangan pelanggan.
  - Baseline: interval tetap 6,0 detik.
  - Adaptif: interval awal 6,0 detik, lalu diatur oleh fuzzy controller dalam rentang 3,0–9,0 detik.

---

## 3. IMPLEMENTASI NON-AI (BASELINE) — AUREL

### 3.1 Teknologi
- **JavaScript + HTML5 Canvas.** Game berjalan langsung di browser tanpa instalasi, mudah dibagikan, dan mudah direkam untuk video demo.
- **Tanpa library eksternal.** Semua grafis digambar dengan bentuk dasar canvas, jadi tidak ada aset berlisensi.
- **Node.js** menjalankan logika game yang sama tanpa tampilan untuk simulasi pengujian.
- Logika game (`game.js`) dipisahkan dari tampilan (`main.js`), sehingga satu kode yang sama dipakai untuk bermain dan untuk simulasi.

### 3.2 Mekanisme Baseline
`FixedSpawner` (`js/difficulty.js`) menghasilkan satu pelanggan setiap 6,0 detik selama sesi berlangsung, tanpa memperhatikan performa pemain. Pesanan tiap pelanggan dipilih acak dari menu memakai RNG ber-*seed* (mulberry32), jadi pelanggan ke-*n* selalu memesan minuman yang sama pada seed yang sama.

### 3.3 Arsitektur atau Alur Sistem
```
Input pemain (keyboard/mouse)
        │
        ▼
main.js ──► Game.addIngredient / serve / discardCup
                     │
Game.update(dt) ─────┼─► kurangi kesabaran → pelanggan pergi (missed)
                     ├─► spawnTimer ≤ 0 → spawnCustomer() → antrean / ditolak
                     │        (interval dari FixedSpawner = 6,0 s)
                     └─► Metrics: catat hasil tiap pelanggan + sampel tiap detik
        │
        ▼
Output: tampilan canvas (antrean, gelas, HUD) + layar hasil + CSV
```

### 3.4 Tampilan dan Bukti Implementasi
[ISI screenshot: menu utama, gameplay baseline, penyajian benar/salah, layar hasil. Beri keterangan gambar.]

### 3.5 Cara Menjalankan
1. Buka `index.html` di browser.
2. Isi ID Penguji dan Seed (misal 2026), lalu klik **Mode Baseline**.
3. Setelah sesi selesai, unduh CSV dari layar hasil.

### 3.6 Hasil Uji Baseline
Lihat kolom "Baseline" pada Tabel 5.4.

---

## 4. IMPLEMENTASI AI / INTELLIGENT FEATURE — M. MAHAMERU. A

### 4.1 Metode Intelligent
**Fuzzy Logic tipe Mamdani** (Zadeh, 1965; Mamdani & Assilian, 1975). Alasan pemilihan:
- Performa pemain bersifat bertingkat ("cukup akurat", "agak lambat"), cocok dinyatakan dengan himpunan fuzzy.
- Aturannya bisa dibaca manusia (IF–THEN), sehingga setiap keputusan perubahan kesulitan bisa dijelaskan dan dicatat di log.
- Tidak memerlukan data latih, cocok untuk prototipe dengan data pemain yang sedikit.

### 4.2 Input, Proses, dan Output
| | Keterangan |
|---|---|
| **Input 1 – akurasi** | Proporsi pelanggan yang dilayani benar dari 6 pelanggan terakhir yang sudah selesai (benar, salah, pergi, atau ditolak). |
| **Input 2 – waktu** | Rata-rata waktu tunggu relatif (lama menunggu ÷ kesabaran) dari 6 pelanggan terakhir **ditambah** pelanggan yang masih mengantre. Pelanggan pergi atau ditolak bernilai 1. |
| **Proses** | Fuzzifikasi → 9 aturan (AND = min) → implikasi min → agregasi max → defuzzifikasi centroid. |
| **Output** | Perubahan interval kedatangan (Δ, detik). Negatif berarti pelanggan datang lebih cepat (lebih sulit); positif berarti lebih lambat (lebih mudah). |

### 4.3 Mekanisme dan Aturan AI

**Fungsi keanggotaan**

| Variabel | Himpunan | Bentuk (parameter) |
|---|---|---|
| akurasi [0–1] | rendah | trapesium (0, 0, 0,5, 0,7) |
| | sedang | segitiga (0,5, 0,75, 0,9) |
| | tinggi | trapesium (0,75, 0,9, 1, 1) |
| waktu [0–1] | cepat | trapesium (0, 0, 0,15, 0,3) |
| | normal | segitiga (0,2, 0,4, 0,6) |
| | lambat | trapesium (0,5, 0,7, 1, 1) |
| Δ interval [−1,5–1,5 s] | percepat_banyak | trapesium (−1,5, −1,5, −1,2, −0,6) |
| | percepat | segitiga (−1,2, −0,6, 0) |
| | tetap | segitiga (−0,4, 0, 0,4) |
| | perlambat | segitiga (0, 0,6, 1,2) |
| | perlambat_banyak | trapesium (0,6, 1,2, 1,5, 1,5) |

**Basis aturan**

| akurasi \ waktu | cepat | normal | lambat |
|---|---|---|---|
| **tinggi** | percepat_banyak | percepat | tetap |
| **sedang** | percepat | tetap | perlambat |
| **rendah** | tetap | perlambat | perlambat_banyak |

**Guardrail**
1. *Pemanasan:* tidak ada penyesuaian sebelum detik ke-12, dan minimal ada 3 pelanggan yang sudah selesai.
2. *Periode evaluasi:* penyesuaian dilakukan tiap 5 detik, tidak setiap frame, agar perubahan tidak terasa tiba-tiba.
3. *Batas langkah:* |Δ| ≤ 1,0 detik per evaluasi.
4. *Batas interval:* 3,0–9,0 detik.
5. *Guardrail antrean:* jika antrean ≥ 3 orang, Δ negatif dibatalkan (laju tidak boleh dipercepat).

Setiap evaluasi dicatat (waktu, input, output fuzzy, aturan dominan, status guardrail, interval sebelum/sesudah) dan bisa diunduh sebagai CSV. Panel debug (tombol D) menampilkan informasi yang sama saat bermain.

**Riwayat penyetelan.** Versi pertama memakai batas langkah 1,2 s dan himpunan "cepat" (0, 0, 0,25, 0,45). Simulasi menunjukkan versi itu menaikkan kesulitan terlalu agresif untuk pemula. Langkah lalu diturunkan ke 0,8 s, himpunan "cepat" dipersempit, dan input waktu serta guardrail antrean ditambahkan. Perbaikannya hanya sebagian. Setelah dicoba bermain, adaptasi terasa terlalu lambat (kesulitan maksimum baru tercapai sekitar detik ke-50). Karena itu periode evaluasi dipercepat dari 10 s ke 5 s, pemanasan dari 20 s ke 12 s, jendela data dari 8 ke 6 pelanggan, dan langkah maksimum menjadi 1,0 s. Tiga varian dibandingkan dengan simulasi. Varian dengan batas bawah 2,5 s ditolak karena membuat pemain menengah kewalahan (antrean padat 22% waktu).

### 4.4 Arsitektur atau Alur Sistem
```
Game.update(dt)
   └─► AdaptiveSpawner.update(game)   [tiap 5 s, setelah detik 12]
          │
          ├─ ambil 6 hasil pelanggan terakhir + pelanggan yang masih antre
          ├─ hitung akurasi & waktu tunggu relatif
          ├─ mamdani(SYSTEM, input) → Δ
          ├─ batasi Δ (±1,0 s), guardrail antrean
          ├─ interval = clamp(interval + Δ, 3,0, 9,0)
          └─ simpan ke log adaptasi
   └─► spawnTimer memakai interval terbaru untuk pelanggan berikutnya
```

### 4.5 Tampilan dan Bukti Implementasi
[ISI screenshot mode adaptif dengan panel debug (D) aktif, terutama saat aturan "percepat_banyak" dan "perlambat_banyak" terpicu, serta saat guardrail antrean aktif.]

### 4.6 Cara Menjalankan
1. Buka `index.html`, isi seed yang **sama** dengan pengujian baseline, lalu klik **Mode Adaptif**.
2. Tekan D untuk melihat keputusan fuzzy secara langsung.
3. Unduh "Log adaptasi (CSV)" di layar hasil.
4. Simulasi bot (butuh Node.js): `node tools/simulate.js 10`.

### 4.7 Hasil Uji AI
Lihat kolom "Adaptif" pada Tabel 5.4.

---

## 5. PENGUJIAN DAN EVALUASI

### 5.1 Pertanyaan Evaluasi
1. Apakah versi adaptif menghasilkan laju antrean yang berbeda untuk pemain dengan kemampuan berbeda?
2. Apakah versi adaptif menambah tantangan bagi pemain yang mahir tanpa menurunkan kualitas layanan?
3. Apakah versi adaptif tetap adil bagi pemain pemula, yaitu tidak membuat mereka lebih sering gagal dibanding baseline?
4. Apakah versi adaptif merespons ketika kemampuan pemain berubah di tengah sesi?

### 5.2 Skenario Pengujian
Kondisi awal: durasi 180 detik, interval awal 6,0 detik, aturan identik. Setiap skenario dijalankan pada kedua versi.

| No. | Skenario/kondisi | Versi diuji | Catatan |
|---|---|---|---|
| S1 | Bot pemula (aksi ±1,5 s/bahan, salah bahan 15%) | Baseline & Adaptif | 10 seed (1–10) per versi |
| S2 | Bot menengah (±0,95 s/bahan, salah 7%) | Baseline & Adaptif | 10 seed per versi |
| S3 | Bot ahli (±0,55 s/bahan, salah 2%) | Baseline & Adaptif | 10 seed per versi |
| S4 | Bot pemula pada 0–90 s, lalu ahli pada 90–180 s | Baseline & Adaptif | Menguji respons terhadap perubahan kemampuan |
| H1 | [ISI] Pemain manusia, sesi pertama | Baseline & Adaptif | [ISI jumlah penguji, seed, urutan versi diacak/diselang-seling] |
| H2 | [ISI] Pemain manusia berpengalaman | Baseline & Adaptif | [ISI] |

Bot memainkan game melalui fungsi yang sama dengan input keyboard (`addIngredient`, `serve`, `discardCup`). Bot bisa salah memilih bahan dan kadang menyadari kesalahannya lalu membuang gelas (pemula 30%, menengah 60%, ahli 90%).

### 5.3 Metrik Pengujian
| Metrik | Cara menghitung |
|---|---|
| Skor | Total skor akhir sesi |
| Tingkat layanan | dilayani benar ÷ (benar + salah + pergi + ditolak) |
| Akurasi pesanan | dilayani benar ÷ (benar + salah) |
| Rata-rata waktu layanan | rata-rata (waktu disajikan − waktu datang), dalam detik |
| Pelanggan pergi / ditolak | jumlah pelanggan yang kesabarannya habis / ditolak karena antrean penuh |
| Waktu antrean padat | % sampel per detik dengan antrean ≥ 4 orang (indikator kewalahan) |
| Pelanggan datang | jumlah pelanggan selama sesi (indikator beban tantangan) |
| Rata-rata interval | rata-rata interval kedatangan per detik |

### 5.4 Tabel Perbandingan Hasil

**A. Simulasi bot** (rata-rata ± simpangan baku, n = 10 seed per sel; sumber `results/sim_agregat.csv`)

| Skenario | Metrik | Non-AI | AI | Catatan |
|---|---|---|---|---|
| S1 pemula | Tingkat layanan | 0,798 ± 0,082 | 0,721 ± 0,097 | AI lebih rendah |
| S1 pemula | Pergi + ditolak | 0 | 1,6 + 1,8 | Baseline tidak pernah kehilangan pelanggan |
| S1 pemula | Waktu antrean padat | 0% | 24,1% ± 7,1 | Kegagalan: overshoot |
| S1 pemula | Rata-rata interval | 6,00 s | 5,31 ± 0,61 s | |
| S2 menengah | Tingkat layanan | 0,947 ± 0,032 | 0,954 ± 0,024 | Setara |
| S2 menengah | Pelanggan datang | 30 | 55,6 | Beban +85% |
| S2 menengah | Skor | 403,7 ± 18,7 | 719,8 ± 39,6 | |
| S2 menengah | Waktu antrean padat | 0% | 1,3% ± 1,8 | |
| S3 ahli | Tingkat layanan | 1,000 | 1,000 | Setara |
| S3 ahli | Pelanggan datang | 30 | 56 | Interval mentok di batas 3,0 s sejak t ≈ 32 s |
| S3 ahli | Rata-rata panjang antrean | 0,21 | 0,40 | Ahli tetap tidak tertantang penuh |
| S4 pemula→ahli | Tingkat layanan | 0,910 ± 0,042 | 0,885 ± 0,052 | AI sedikit lebih rendah |
| S4 pemula→ahli | Waktu antrean padat | 0% | 16,4% ± 4,6 | Terjadi pada fase pemula |
| S4 pemula→ahli | Interval (log seed 1) | 6,0 tetap | 3,0 (t=32) → 8,8 (t=92) → 3,0 (t=132) | Mengikuti perubahan kemampuan |

**B. Uji pemain manusia** [ISI dengan data asli dari CSV riwayat sesi]

| Skenario | Metrik | Non-AI | AI | Catatan |
|---|---|---|---|---|
| H1 | Tingkat layanan | [ISI] | [ISI] | |
| H1 | Waktu antrean padat | [ISI] | [ISI] | |
| H1 | Persepsi tantangan (kuesioner 1–5) | [ISI] | [ISI] | |
| H2 | ... | [ISI] | [ISI] | |

### 5.5 Analisis
*(Berdasarkan data simulasi; perbarui setelah data manusia tersedia.)*

1. **Penyesuaian ke kemampuan (Q1): berhasil sebagian.** Interval rata-rata versi adaptif berbeda per profil: pemula 5,31 s, menengah 3,38 s, ahli 3,35 s. Pemain yang lebih cepat mendapat laju lebih tinggi. Namun selisih menengah dan ahli hampir nol karena keduanya mencapai batas bawah 3,0 s.
2. **Tantangan untuk pemain mahir (Q2): berhasil.** Pada S2 dan S3, baseline terlalu mudah (rata-rata antrean < 0,4 orang, hampir selalu kosong). Versi adaptif menaikkan jumlah pelanggan dari 30 ke 55,6–56 (+85%) dengan tingkat layanan yang tetap sama (0,95 dan 1,00). Kesulitan maksimum tercapai pada t ≈ 27–32 s.
3. **Keadilan untuk pemula (Q3): gagal.** Pada S1, versi adaptif menurunkan tingkat layanan (0,80 → 0,72) dan antrean padat selama 24,1% waktu. Log adaptasi menunjukkan penyebabnya. Pada awal sesi pemula masih bisa mengikuti, sehingga aturan "akurasi tinggi + waktu cepat → percepat_banyak" terpicu berulang kali dan interval turun ke 3,0 s pada t = 32 s. Guardrail antrean aktif pada t = 47–57 s dan menahan penurunan lebih lanjut, tetapi interval baru dinaikkan kembali pada t = 62 s karena controller membaca data masa lalu.
4. **Respons terhadap perubahan kemampuan (Q4): berhasil.** Pada S4 (seed 1), setelah bot berubah menjadi ahli pada t = 90 s, interval turun dari 8,8 s ke 3,0 s dalam ±40 detik (sebelum percepatan parameter: ±50 detik). Baseline tetap 6,0 s sepanjang sesi.

**Kesimpulan sementara:** fitur adaptif membantu pemain menengah dan ahli mendapat tantangan yang lebih sesuai tanpa menurunkan kualitas layanan. Untuk pemula, fitur ini belum lebih baik dari baseline karena terjadi overshoot di awal sesi. Hasil ini berasal dari bot, sehingga perlu dikonfirmasi dengan pemain manusia.

---

## 6. ETIKA, BIAS, DAN KETERBATASAN
- **Rasa tidak adil dan kurang transparan.** Pemain tidak diberi tahu bahwa laju pelanggan berubah. Pemain yang bermain baik justru "dihukum" dengan antrean lebih padat. Skor juga tidak bisa dibandingkan antar-pemain karena beban tiap pemain berbeda (skor adaptif lebih tinggi karena pelanggan lebih banyak, bukan semata karena lebih mahir). Mitigasinya: laporkan tingkat layanan, bukan skor mentah, sebagai ukuran performa, dan pertimbangkan memberi tahu pemain bahwa game menyesuaikan diri.
- **Bias terhadap pemula.** Data simulasi menunjukkan pemula paling dirugikan (lihat 5.5 butir 3). Penyebabnya, controller menilai dari data masa lalu (6 pelanggan terakhir), sehingga selalu ada jeda sebelum penurunan performa terdeteksi.
- **Data performa sedikit.** Keputusan diambil dari 3–6 pelanggan saja, sehingga satu kesalahan sudah berpengaruh besar pada input akurasi.
- **Batas interval.** Batas bawah 3,0 s membuat pemain ahli tidak mendapat tantangan tambahan.
- **Validitas pengujian.** Bot tidak merasakan stres, bosan, atau belajar seperti manusia. Kesimpulan tentang pengalaman bermain (*flow*) harus dikonfirmasi dengan uji pemain manusia dan kuesioner.
- **Ketergantungan eksternal:** tidak ada. Semua berjalan lokal tanpa layanan daring dan tanpa mengumpulkan data pribadi. Riwayat sesi hanya disimpan di browser penguji.
- **Ringkasan etika-bias-check:** [ISI hasil skill etika-bias-check dari plugin.]

---

## 7. KESIMPULAN DAN REFLEKSI

### 7.1 Kesimpulan
Prototipe Cozy Cafe berhasil dibuat dalam versi Baseline (interval tetap) dan versi Adaptif (Fuzzy Mamdani dengan 2 input, 9 aturan, dan 5 guardrail). Pada simulasi bot, versi adaptif menaikkan beban tantangan untuk pemain menengah dan ahli sebesar 85% dalam ±30 detik pertama tanpa menurunkan tingkat layanan, dan merespons perubahan kemampuan di tengah sesi. Versi adaptif belum adil bagi pemula karena overshoot di awal sesi (tingkat layanan 0,72 vs 0,80). Pengembangan berikutnya: memasukkan panjang antrean sebagai input fuzzy, menambah periode pemanasan, dan menguji dengan pemain manusia.

### 7.2 Refleksi Aurel
[ISI sendiri: kontribusi, keputusan, kendala, hal yang dipelajari, **dan bagaimana AI dipakai selama mengerjakan baseline**.]

### 7.3 Refleksi M. Mahameru. A
[ISI sendiri: kontribusi, keputusan, kendala, hal yang dipelajari, **dan bagaimana AI dipakai selama mengerjakan fitur intelligent**.]

### 7.4 Refleksi Kelompok
[ISI: manfaat dan keterbatasan AI, kesalahan/bias AI yang ditemukan, pembelajaran bersama. Contoh temuan nyata dari proses ini: parameter fuzzy awal terlalu agresif dan baru ketahuan setelah diuji dengan simulasi. Asumsi desain perlu diverifikasi dengan data, tidak cukup dengan intuisi.]

---

## DAFTAR PUSTAKA
*(Pertahankan hanya sumber yang benar-benar kalian baca dan pakai.)*

- Csikszentmihalyi, M. (1990). *Flow: The Psychology of Optimal Experience*. Harper & Row.
- Hunicke, R. (2005). The case for dynamic difficulty adjustment in games. *Proceedings of the 2005 ACM SIGCHI International Conference on Advances in Computer Entertainment Technology (ACE '05)*, 429–433.
- Mamdani, E. H., & Assilian, S. (1975). An experiment in linguistic synthesis with a fuzzy logic controller. *International Journal of Man-Machine Studies, 7*(1), 1–13.
- Yannakakis, G. N., & Togelius, J. (2018). *Artificial Intelligence and Games*. Springer.
- Zadeh, L. A. (1965). Fuzzy sets. *Information and Control, 8*(3), 338–353.
- MDN Web Docs. *Canvas API*. https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

---

## LAMPIRAN A. AI LOG (draf; lengkapi dan verifikasi sendiri)

Minimal 10 entri kelompok, minimal 3 entri per anggota. Entri berikut mencatat sesi pembuatan kode dan draf ini. Kolom keputusan, verifikasi, dan refleksi harus diisi oleh anggota yang memakainya.

| No | Anggota | Prompt (ringkas) | Ringkasan output | Keputusan | Alasan | Verifikasi | Refleksi |
|---|---|---|---|---|---|---|---|
| 1 | [ISI] | Membuat game kafe cozy dengan Adaptive Difficulty dan mengisi laporan sesuai template | Struktur proyek HTML5/JS: baseline, adaptif fuzzy Mamdani, metrik, ekspor CSV | [ISI] | [ISI] | Game dijalankan di browser: [ISI hasil] | [ISI] |
| 2 | [ISI] | (lanjutan sesi yang sama) Desain sistem fuzzy | 2 input (akurasi, waktu tunggu relatif), 5 output, 9 aturan | [ISI] | [ISI] | [ISI] | [ISI] |
| 3 | [ISI] | (lanjutan) Simulasi bot untuk pengujian | `tools/simulate.js`, 4 skenario × 2 versi × 10 seed | [ISI] | [ISI] | [ISI] | [ISI] |
| 4 | [ISI] | (lanjutan) Penyetelan setelah simulasi menunjukkan overshoot pada pemula | Langkah dikurangi 1,2→0,8 s, himpunan "cepat" dipersempit, input waktu memasukkan antrean aktif, guardrail antrean | [ISI] | [ISI] | Hasil sebelum/sesudah: tingkat layanan pemula 0,70 → 0,72, masalah belum hilang | [ISI] |
| 5 | [ISI] | (lanjutan) Draf laporan | Draf `LAPORAN_DRAFT.md` | [ISI] | [ISI] | [ISI: cek setiap angka terhadap CSV] | [ISI] |
| 6 | [ISI] | Meminta fuzzy dipercepat karena adaptasi terasa lambat saat dimainkan | Tiga varian dibandingkan dengan simulasi; dipilih periode 5 s, pemanasan 12 s, jendela 6, langkah 1,0 s; varian batas bawah 2,5 s ditolak | [ISI] | [ISI] | Kesulitan maksimum tercapai t ≈ 27–32 s (sebelumnya 50 s); antrean padat pemula 26,5% → 24,1%, S4 8,4% → 16,4% | [ISI] |
| 7–10+ | [ISI] | [ISI] | | | | | |

## LAMPIRAN B. Bukti Plugin IGTD Assessment 3 Kit
[ISI screenshot]

## LAMPIRAN C. Bukti Pengujian
File di folder `results/` dan CSV hasil uji pemain manusia. [ISI screenshot]

## LAMPIRAN D. Repository dan Video Demo
- Repository: [ISI]
- Video demonstrasi 5–8 menit: [ISI]. Saran isi video: masalah interval tetap (baseline terlalu mudah untuk pemain cepat), panel debug D saat fuzzy bekerja, dan **kegagalan overshoot pada pemula** sebagai keterbatasan.
