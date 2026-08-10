# Rumah Opung

Aplikasi kecil untuk mencatat sewa 8 kamar kos **Rumah Opung** (Jati Cempaka, Bekasi).

Tujuannya cuma satu: **pemilik tahu persis siapa yang menunggak, berapa, dan sejak kapan — pada hari mana pun.**

---

## Bagian 1 · Yang perlu dipahami dulu

Ada tiga hal penting sebelum dipakai. Baca sebentar, ini menghemat kebingungan nanti.

### 1. Datanya tersimpan di HP kamu, bukan di internet

Aplikasi ini tidak punya server dan tidak punya database. Semua catatan disimpan di
dalam **peramban (browser) HP pemilik** — kira-kira seperti catatan di aplikasi Notes.

Akibatnya:

- Kalau kamu buka aplikasi ini dari HP lain, **datanya kosong**. Itu normal.
- Kalau riwayat peramban dibersihkan, atau HP diganti, **data bisa hilang**.
- Karena itu ada tombol **Ekspor data**. Pakai rutin (lihat Bagian 4).

Sisi baiknya: data penghuni tidak pernah dikirim ke mana pun. Tidak ada yang bisa
mengintipnya, termasuk pembuat aplikasi ini.

### 2. Penghuni tidak punya aplikasi — mereka dikirimi tautan

Penghuni tidak perlu memasang apa pun dan tidak perlu daftar akun.

Kamu tekan tombol **🔗 Buat Kartu** pada baris kamarnya, lalu tautan yang muncul
kamu kirim lewat WhatsApp. Penghuni membuka tautan itu, lalu melihat kartunya:
tagihan, denda, dan riwayat bulanannya.

Yang perlu diingat: **kartu itu adalah foto, bukan siaran langsung.** Isinya terkunci
pada tanggal kamu membuatnya. Kalau ada perubahan (misalnya dia sudah bayar),
kartu lama tidak ikut berubah — buat tautan baru dan kirim ulang. Aplikasi sudah
menulis peringatan ini di kartunya, jadi penghuni tidak akan salah paham.

Satu tautan hanya berisi data satu orang. Penghuni tidak bisa melihat data
penghuni lain dengan cara apa pun.

### 3. Penghuni tetap lapor lewat WhatsApp

Kartu Kamar hanya untuk dilihat. Tidak ada tombol apa pun di sana.

Alurnya tetap seperti sekarang: penghuni transfer → kirim bukti lewat WA →
**kamu** yang mencatat di aplikasi. Aplikasi tidak menggantikan WhatsApp,
ia hanya membereskan pembukuannya.

---

## Bagian 2 · Cara memasang ke Vercel

Sekali saja, sekitar 10 menit. Setelah ini, setiap perubahan cukup `git push`.

1. Buka [vercel.com](https://vercel.com) lalu daftar. Pilih **Continue with GitHub**
   supaya tersambung ke tempat berkas ini disimpan.
2. Di halaman depan Vercel, tekan **Add New… → Project**.
3. Cari nama repositori ini di daftar, lalu tekan **Import**.
4. Vercel akan bertanya soal pengaturan. **Jangan diubah apa pun.**
   Bagian *Framework Preset* biarkan **Other**, dan *Build Command* biarkan kosong —
   aplikasi ini memang tidak perlu dibangun.
5. Tekan **Deploy**, lalu tunggu kira-kira satu menit.
6. Selesai. Vercel memberi alamat seperti `https://rumah-opung.vercel.app`.
   Itulah alamat Papan Kendali kamu.

### Simpan di layar utama HP

Supaya tidak usah mengetik alamatnya tiap kali:

- **Android (Chrome):** buka alamatnya → titik tiga di kanan atas →
  *Tambahkan ke layar utama*.
- **iPhone (Safari):** buka alamatnya → ikon bagikan (kotak dengan panah ke atas) →
  *Tambahkan ke Layar Utama*.

Ikonnya lalu muncul seperti aplikasi biasa.

> **Penting:** buka selalu dari HP yang sama. Data mengikuti perangkat, bukan alamat.

---

## Bagian 3 · Cara pakai sehari-hari

### Pertama kali membuka

Aplikasi langsung terisi **data contoh 8 penghuni** supaya kamu bisa mencoba-coba
dengan aman. Kalau sudah paham dan siap memakai data betulan:

**Pengaturan → 🗑️ Kosongkan semua data**, lalu masukkan penghuni sungguhan
lewat **Pengaturan → ➕ Tambah penghuni**.

Kalau ternyata masih ingin berlatih lagi, ada **🔁 Reset ke data contoh**.

### Memasukkan penghuni

Isi nomor kamar, nama, sewa, dan nomor WhatsApp. Dua kolom perlu penjelasan:

**Tanggal ulang bulan.** Tanggal jatuh tempo sewa tiap bulan. Kalau dia masuk
tanggal 3, isi `3`. Kalau tanggalnya 29, 30, atau 31, aplikasi otomatis mundur ke
hari terakhir bulan pendek — jadi ulang bulan tanggal 31 jatuh tempo 28 Februari.
Tidak perlu diatur manual.

**Sewa per bulan.** Kalau suatu saat sewanya naik, ubah angkanya lalu isi
**berlaku mulai bulan** — bawaannya bulan depan. Bulan-bulan sebelumnya tetap
memakai tarif lama, jadi riwayat yang sudah lunas tidak ikut berubah.

Ini penting. Tanpa tanggal berlaku, menaikkan sewa Rp 100.000 akan membuat
setiap bulan yang sudah lewat mendadak kurang bayar Rp 100.000, lalu ikut kena
denda — penghuni yang tidak pernah telat bisa tiba-tiba tampak menunggak jutaan
rupiah. Semua tarif yang pernah dipakai tersimpan dan bisa dilihat di formulir
penghuni; kalau salah isi, tarif itu bisa dihapus dari riwayat.

**Posisi awal.** Ini untuk penghuni yang **sudah menunggak sebelum aplikasi ini
dipakai**. Isi berapa bulan tertunggak dan berapa rupiah pokoknya. Kamu **tidak
perlu** mengetik ulang riwayat setahun ke belakang — cukup satu baris ini saja.

Denda masa lalu dianggap **nol dan dihapus seluruhnya**. Ini keputusan sengaja:
menghitung ulang denda lama hanya menimbulkan pertengkaran, sementara angkanya
tidak akan pernah tertagih juga.

### Layar Beranda

Paling atas ada **dua angka saja**:

| Angka | Artinya |
|---|---|
| 🔔 **Menunggu verifikasi** | Ada laporan bayar yang belum kamu periksa. |
| 📣 **Perlu ditagih** | Ada penghuni yang telat atau menunggak. |

Ketuk salah satunya untuk menyaring daftar di bawahnya. Ketuk lagi untuk
menampilkan semuanya kembali.

Kalau keduanya nol, muncul tulisan **"Tidak ada yang perlu dikerjakan hari ini."**
Itu artinya betul-betul tidak ada. Tutup aplikasinya, lanjut kerja.

Di bawahnya ada daftar 8 kamar, **diurutkan dari yang paling parah**. Yang merah
selalu di atas, jadi kamu tidak perlu mencari.

| Warna | Arti |
|---|---|
| 🟢 Lancar | Tidak ada tunggakan. |
| 🟡 Telat | Lewat batas bayar, tapi belum sampai sebulan. |
| 🟠 Baru menunggak | Tertunggak 1–2 bulan. |
| 🔴 Lama menunggak | Tertunggak 3 bulan atau lebih. |

Kalau ada tanda **⚠️ ada denda belum lunas** di baris hijau, artinya sewanya sudah
lunas tapi denda keterlambatannya belum dibayar. Orang ini **bukan** penunggak.

Ketuk baris kamarnya untuk melihat riwayat bulan per bulan.

### Mencatat pembayaran

Penghuni kirim bukti transfer lewat WA. Lalu:

1. Buka tab **✍️ Catat bayar**.
2. Pilih penghuninya, isi tanggal dan jumlah.
3. Di kolom catatan bukti, tulis penanda singkat supaya nanti mudah dicocokkan —
   misalnya `screenshot BCA 08/08`.
4. Tekan **Simpan ke antrean**.

Catatan itu masuk sebagai **menunggu verifikasi**. Perhitungan tagihan **belum**
berubah sampai kamu menyetujuinya. Ini disengaja: mencatat itu cepat dan bisa
dilakukan sambil jalan, sedangkan memeriksa perlu perhatian.

### Menyetujui pembayaran (tiga ketukan)

1. Ketuk **🔔 Menunggu verifikasi** di Beranda.
2. Ketuk laporan yang mau diperiksa.
3. Ketuk **✅ Setuju**.

Selesai. Semua angka langsung diperbarui.

Kalau buktinya meragukan, tekan **✖️ Tolak**, tulis alasannya, lalu simpan.
Laporan yang ditolak tidak ikut menghapus tagihan, tapi tetap tercatat supaya
kamu ingat pernah ada laporan itu.

### Menagih

Tekan **📣 Tagih** di baris kamarnya. Aplikasi menyusun draft pesan yang nadanya
sudah disesuaikan dengan keadaan orang itu — makin lama menunggak, makin mengajak
bicara, bukan makin galak. Tautan kartunya ikut disertakan otomatis.

Draftnya **boleh kamu ubah dulu** sebelum dikirim. Lalu tekan
**💬 Buka WhatsApp** — WhatsApp terbuka dengan pesan sudah terisi, tinggal tekan kirim.

### Catatan penagihan

Untuk yang menunggak lama, angka rupiahnya bukan informasi baru — kamu sudah
tahu. Yang menentukan tindakan hari ini justru: *kapan terakhir saya
menghubunginya, dan dia bilang apa?*

Setiap penghuni punya **satu tanggal terakhir ditagih** dan **satu kolom catatan
bebas**. Keduanya bisa diisi dari layar detail kamar atau dari layar Tagih.

Tanggalnya terisi **otomatis** begitu kamu menekan 💬 Buka WhatsApp — jadi kamu
tidak perlu ingat mencatatnya. Catatannya kamu tulis sendiri, misalnya
*"janji transfer setelah gajian tanggal 25"* atau *"minta dicicil Rp 500.000
per bulan"*.

Keduanya lalu muncul langsung di baris kamarnya, jadi sebelum menagih lagi kamu
bisa lihat dulu apakah orang ini baru dihubungi kemarin atau sudah didiamkan
tiga minggu.

> **Catatan ini pribadi milik kamu.** Tidak pernah ikut ke Kartu Kamar dan tidak
> pernah masuk ke draft pesan WhatsApp. Penghuni tidak bisa melihatnya.

### Membebaskan denda

Kadang dendanya perlu dihapus, misalnya karena penghuni sedang kesulitan.

Buka **baris kamarnya → cari bulan yang dituju di bagian Riwayat → tekan Bebaskan.**
Total tagihannya langsung berkurang, dan bulan itu ditandai *dibebaskan* — jadi
kamu masih bisa melihat bahwa dendanya pernah ada, tapi sengaja dilepas.
Kalau berubah pikiran, tombolnya berubah jadi **Aktifkan lagi**.

---

## Bagian 4 · Mencadangkan data (jangan dilewati)

Sekali sebulan, sesudah semua pembayaran diverifikasi:

1. **Pengaturan → ⬇️ Ekspor data (JSON)**.
2. Tekan tombol unduh. Berkasnya bernama seperti `rumah-opung-2026-08-08.json`.
3. **Kirim berkas itu ke diri sendiri** lewat WhatsApp atau surel.

Itu saja. Kalau suatu saat data hilang atau HP berganti, buka aplikasi di HP baru,
lalu **Pengaturan → ⬆️ Impor data (JSON)** dan pilih berkas terakhir.

> Lakukan ini betulan. Tanpa ekspor, satu kali bersih-bersih peramban bisa
> menghapus seluruh catatan tanpa peringatan.

---

## Bagian 5 · Bagaimana angkanya dihitung

Supaya kamu bisa menjelaskan ke penghuni kalau ada yang bertanya.

**Jatuh tempo & batas bayar.** Jatuh tempo = tanggal ulang bulan penghuni.
Batas bayar = 10 hari sesudahnya (bisa diubah di Pengaturan).

**Denda: Rp 150.000 tetap per bulan yang telat.** Tidak bertambah tiap hari.
Muncul sekali saat lewat batas bayar. Telat 11 hari dan telat 40 hari sama-sama
kena Rp 150.000 untuk bulan itu — tapi menunggak 3 bulan berarti 3 × Rp 150.000
= Rp 450.000.

Denda tetap terutang walaupun pokok sewanya kemudian dilunasi.

Kalau tarif dendanya kamu ubah di Pengaturan, tarif baru **hanya berlaku untuk
denda yang timbul sesudahnya**. Denda lama tidak ikut berubah.

**Sewa juga begitu.** Setiap bulan dihitung memakai tarif sewa yang berlaku
**pada saat bulan itu jatuh tempo**, bukan tarif hari ini. Jadi menaikkan sewa
tidak pernah mengubah tagihan bulan-bulan yang sudah lewat.

**Urutan pembayaran.** Uang yang masuk selalu dipakai berurutan:

1. **Pokok sewa dulu**, dari bulan yang paling lama, sampai uangnya habis.
2. **Denda menyusul** — dan baru disentuh setelah *seluruh* pokok lunas.
3. Sisanya jadi **saldo lebih** untuk bulan berikutnya.

Contoh: menunggak Juni dan Juli, masing-masing Rp 1.500.000, plus denda
2 × Rp 150.000. Totalnya Rp 3.300.000. Dia transfer Rp 1.800.000.

Hasilnya: pokok Juni **lunas**, pokok Juli sisa **Rp 1.200.000**, dan dendanya
**Rp 300.000 utuh — belum tersentuh sama sekali**. Sisa tagihan Rp 1.500.000.

Aturan "pokok dulu" ini sengaja dipilih supaya uang penghuni selalu dipakai untuk
mengurangi utang pokoknya lebih dulu, bukan habis di denda.

**Hitungan bulan tertunggak.** Patokannya tanggal ulang bulan penghuni, bukan
tanggal kalender. Sebuah bulan baru dihitung "tertunggak" setelah jatuh tempo
bulan **berikutnya** juga lewat. Sebelum itu statusnya masih 🟡 Telat.

---

## Bagian 6 · Kalau ada yang aneh

| Keluhan | Penyebab & jalan keluarnya |
|---|---|
| Buka di HP lain, datanya kosong | Wajar — data mengikuti perangkat. Ekspor dari HP lama, impor di HP baru. |
| Penghuni bilang kartunya salah | Kartu adalah foto per tanggal pembuatan. Tekan 🔗 Buat Kartu lagi dan kirim tautan yang baru. |
| Penghuni buka tautan, muncul "Tautan tidak valid" | Tautannya terpotong saat disalin atau dikirim. Kirim ulang, jangan diketik manual. |
| Ada denda yang seharusnya tidak ada | Bebaskan lewat baris kamarnya (lihat Bagian 3). |
| Sesudah sewa dinaikkan, bulan lama ikut berubah | Bulan berlakunya terlalu mundur. Buka penghuninya, hapus tarif itu dari **Riwayat sewa**, lalu isi ulang dengan bulan berlaku yang benar. |
| Semua data hilang | Impor berkas ekspor terakhir. Kalau belum pernah ekspor, datanya tidak bisa dikembalikan. |
| Angka tagihan tidak berubah setelah dicatat | Catatan masih menunggu verifikasi. Setujui dulu lewat 🔔. |

---

## Bagian 7 · Catatan teknis

Untuk siapa pun yang nanti menyentuh berkasnya.

HTML, CSS, dan JavaScript biasa. Tanpa framework, tanpa npm, tanpa proses build,
tanpa dependensi luar sama sekali — tidak ada CDN, font, atau ikon dari internet.
Semua ikon memakai emoji.

| Berkas | Isi |
|---|---|
| `index.html` | Papan Kendali (layar pemilik). |
| `kartu.html` | Kartu Kamar (layar penghuni). Berdiri sendiri — tidak memuat `app.js`, supaya tidak ada kemungkinan data penghuni lain ikut terbawa. |
| `app.js` | Formula F1–F8, penyimpanan, penyandian tautan, draft pesan, tampilan Papan Kendali. |
| `style.css` | Gaya tampilan, mobile-first. |
| `vercel.json` | Pengaturan situs statis. |

Data kartu disandikan sebagai JSON dengan nama kolom pendek, lalu Base64 URL-safe,
dan ditaruh **setelah tanda `#`** pada alamat. Bagian setelah `#` tidak pernah
dikirim ke server — jadi data penghuni tidak pernah meninggalkan perangkat,
bahkan tidak ke Vercel.

Kunci penyimpanan di peramban: `rumahOpung.v1`.

Di Pengaturan ada kolom **Kunci API** yang sengaja dibiarkan kosong dan nonaktif.
Aplikasi berfungsi 100% tanpanya; draft pesan memakai template.
