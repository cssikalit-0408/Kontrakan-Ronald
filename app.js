/* ============================================================
   Rumah Opung — pengelolaan kos 8 kamar
   Seluruh logika: formula F1-F8, penyimpanan, tautan kartu,
   draft pesan, dan tampilan Papan Kendali.

   Tanpa framework. Tanpa backend. Tanpa dependensi luar.
   ============================================================ */
'use strict';

var RO = (function () {

  /* ==========================================================
     BAGIAN A — UTILITAS TANGGAL & UANG
     Semua tanggal memakai tengah malam waktu lokal (Asia/Jakarta
     di perangkat pemilik). toISOString() sengaja TIDAK dipakai
     untuk perbandingan karena rawan bergeser satu hari.
     ========================================================== */

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var NAMA_BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function hariIni() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function fmtTgl(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseTgl(s) {
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    var b = String(s).split('-');
    return new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]));
  }

  function hariTerakhirBulan(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function tambahHari(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function selisihHari(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  function kodeBulan(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

  function labelBulan(kode) {
    var b = String(kode).split('-');
    return NAMA_BULAN[Number(b[1]) - 1] + ' ' + b[0];
  }

  function labelTgl(d) {
    return d.getDate() + ' ' + NAMA_BULAN_PENDEK[d.getMonth()] + ' ' + d.getFullYear();
  }

  function labelTglPanjang(d) {
    return d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* Rupiah selalu bilangan bulat. Format: Rp 1.500.000 */
  function rupiah(n) {
    var neg = n < 0;
    var s = String(Math.abs(Math.round(n)));
    var out = '', c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = '.' + out;
    }
    return (neg ? '-' : '') + 'Rp ' + out;
  }

  /* ==========================================================
     BAGIAN B — FORMULA F1 & F2 (dasar tanggal)
     ========================================================== */

  /* F1 — Jatuh tempo bulan tertentu.
     Bila tanggal ulang bulan melebihi jumlah hari bulan itu,
     mundur ke hari terakhir bulan (31 -> 28/29 Februari). */
  function jatuhTempo(y, m, tglUlangBulan) {
    var maks = hariTerakhirBulan(y, m);
    var hari = Math.min(Math.max(1, tglUlangBulan), maks);
    return new Date(y, m, hari);
  }

  /* F1 — Batas bayar = jatuh tempo + tenggat (bawaan 10 hari) */
  function batasBayar(jt, tenggatHari) {
    return tambahHari(jt, tenggatHari);
  }

  /* ==========================================================
     BAGIAN C — PENYIMPANAN (localStorage)
     ========================================================== */

  var KUNCI_SIMPAN = 'rumahOpung.v1';

  function pengaturanBawaan(today) {
    var T = today || hariIni();
    var potong = new Date(T.getFullYear(), T.getMonth() - 5, 1);
    return {
      namaKos: 'Rumah Opung',
      tanggalPotong: fmtTgl(potong),
      dendaTetap: 150000,
      tenggatHari: 10,
      /* Riwayat tarif denda. Perubahan tarif hanya berlaku untuk
         denda yang timbul SESUDAH tanggal perubahan (F5). */
      dendaRiwayat: [{ sejak: '2000-01-01', nilai: 150000 }],
      kunciApi: ''
    };
  }

  function dbKosong(today) {
    return {
      versi: 1,
      pengaturan: pengaturanBawaan(today),
      penghuni: [],
      saldoAwal: [],
      pembayaran: [],
      waive: []
    };
  }

  function rapikanDb(db, today) {
    var bawaan = pengaturanBawaan(today);
    if (!db || typeof db !== 'object') db = {};
    db.versi = 1;
    db.pengaturan = db.pengaturan || {};
    for (var k in bawaan) {
      if (Object.prototype.hasOwnProperty.call(bawaan, k) &&
        (db.pengaturan[k] === undefined || db.pengaturan[k] === null)) {
        db.pengaturan[k] = bawaan[k];
      }
    }
    if (!db.pengaturan.dendaRiwayat || !db.pengaturan.dendaRiwayat.length) {
      db.pengaturan.dendaRiwayat = [{ sejak: '2000-01-01', nilai: db.pengaturan.dendaTetap }];
    }
    db.pengaturan.dendaRiwayat.sort(function (a, b) { return a.sejak < b.sejak ? -1 : 1; });
    db.penghuni = db.penghuni || [];
    db.saldoAwal = db.saldoAwal || [];
    db.pembayaran = db.pembayaran || [];
    db.waive = db.waive || [];
    return db;
  }

  function muat() {
    var mentah = null;
    try {
      mentah = window.localStorage.getItem(KUNCI_SIMPAN);
    } catch (e) { mentah = null; }
    if (!mentah) return null;
    try {
      return rapikanDb(JSON.parse(mentah));
    } catch (e) { return null; }
  }

  function simpan(db) {
    try {
      window.localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(db));
      return true;
    } catch (e) { return false; }
  }

  function hapusSimpanan() {
    try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch (e) { }
  }

  /* ==========================================================
     BAGIAN D — FORMULA F3-F8 (inti perhitungan)
     ========================================================== */

  /* Tarif denda yang berlaku pada suatu tanggal (F5). */
  function tarifDendaPada(pengaturan, tanggal) {
    var r = pengaturan.dendaRiwayat || [{ sejak: '2000-01-01', nilai: pengaturan.dendaTetap }];
    var nilai = r[0].nilai;
    for (var i = 0; i < r.length; i++) {
      if (parseTgl(r[i].sejak).getTime() <= tanggal.getTime()) nilai = r[i].nilai;
    }
    return nilai;
  }

  /* Bangun daftar periode bulanan sejak tanggal potong (F1). */
  function bangunPeriode(db, p, today) {
    var potong = parseTgl(db.pengaturan.tanggalPotong);
    var tenggat = Number(db.pengaturan.tenggatHari) || 10;
    var akhir = new Date(today.getFullYear(), today.getMonth(), 1);
    var cur = new Date(potong.getFullYear(), potong.getMonth(), 1);
    var out = [];
    var pengaman = 0;
    while (cur.getTime() <= akhir.getTime() && pengaman++ < 600) {
      var jt = jatuhTempo(cur.getFullYear(), cur.getMonth(), p.tglUlangBulan);
      if (jt.getTime() >= potong.getTime()) {
        out.push({
          bulan: kodeBulan(cur),
          tahun: cur.getFullYear(),
          bulanIndeks: cur.getMonth(),
          jatuhTempo: jt,
          batasBayar: batasBayar(jt, tenggat),
          pokok: Math.round(p.sewa)
        });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  }

  function cariSaldoAwal(db, penghuniId) {
    for (var i = 0; i < db.saldoAwal.length; i++) {
      if (db.saldoAwal[i].penghuniId === penghuniId) return db.saldoAwal[i];
    }
    return null;
  }

  function kunciWaive(penghuniId, bulan) { return penghuniId + '|' + bulan; }

  /* ---- Inti: hitung posisi satu penghuni pada tanggal tertentu ---- */
  function hitung(db, p, today) {
    today = today || hariIni();
    var st = db.pengaturan;
    var per = bangunPeriode(db, p, today);

    /* F8 — Saldo awal: satu baris di puncak. Denda masa lalu = 0. */
    var awal = cariSaldoAwal(db, p.id);
    var pokokAwal = awal ? Math.round(awal.pokokTertunggak) : 0;
    var bulanAwal = awal ? Number(awal.bulanTertunggak) || 0 : 0;

    /* Pembayaran yang sudah disetujui, urut tanggal */
    var bayar = db.pembayaran.filter(function (b) {
      return b.penghuniId === p.id && b.status === 'disetujui';
    }).slice().sort(function (a, b) {
      return a.tanggalBayar < b.tanggalBayar ? -1 : (a.tanggalBayar > b.tanggalBayar ? 1 : 0);
    });
    var totalDisetujui = 0;
    for (var i = 0; i < bayar.length; i++) totalDisetujui += Math.round(bayar[i].jumlah);

    function bayarSampai(tgl) {
      var s = 0;
      for (var j = 0; j < bayar.length; j++) {
        if (parseTgl(bayar[j].tanggalBayar).getTime() <= tgl.getTime()) s += Math.round(bayar[j].jumlah);
      }
      return s;
    }

    /* --- Tandai jatuh tempo, keterlambatan, dan denda yang timbul --- */
    var kumulatif = pokokAwal;
    per.forEach(function (q) {
      kumulatif += q.pokok;
      q.pokokKumulatif = kumulatif;
      q.sudahJatuhTempo = q.jatuhTempo.getTime() <= today.getTime();
      /* F2 — hari lewat batas bayar */
      q.lewatBatas = today.getTime() > q.batasBayar.getTime();
      q.hariLewatBatas = q.lewatBatas ? selisihHari(today, q.batasBayar) : 0;
      /* Angka yang ditampilkan ke pemilik: berapa hari sejak jatuh tempo */
      q.hariSejakJatuhTempo = q.sudahJatuhTempo ? selisihHari(today, q.jatuhTempo) : 0;

      /* F5 — Denda timbul SEKALI saat melewati batas bayar, bila pada
         saat itu pokok sampai bulan ini belum tertutup pembayaran.
         Nilainya dikunci pada tarif yang berlaku saat itu. */
      var belumTertutup = bayarSampai(q.batasBayar) < q.pokokKumulatif;
      q.dendaTimbul = (q.lewatBatas && belumTertutup) ? tarifDendaPada(st, q.batasBayar) : 0;
      q.dibebaskan = db.waive.indexOf(kunciWaive(p.id, q.bulan)) >= 0;
      q.dendaAktif = q.dibebaskan ? 0 : q.dendaTimbul;
    });

    /* --- F6 — Alokasi pembayaran, berurutan dan tidak boleh dilompati --- */
    var sisaUang = totalDisetujui;

    /* 1a. Pokok tertunggak dari sebelum tanggal potong (paling lama) */
    var dibayarAwal = Math.min(sisaUang, pokokAwal);
    var sisaPokokAwal = pokokAwal - dibayarAwal;
    sisaUang -= dibayarAwal;

    /* 1b. Pokok per bulan, dari yang terlama */
    per.forEach(function (q) {
      q.dibayarPokok = 0;
      if (q.sudahJatuhTempo) {
        var u = Math.min(sisaUang, q.pokok);
        q.dibayarPokok = u;
        sisaUang -= u;
      }
      q.sisaPokok = q.pokok - q.dibayarPokok;
      q.dendaDibayar = 0;
    });

    var totalSisaPokok = sisaPokokAwal;
    per.forEach(function (q) { if (q.sudahJatuhTempo) totalSisaPokok += q.sisaPokok; });

    /* 2. Denda dari yang terlama — HANYA setelah seluruh pokok lunas */
    if (totalSisaPokok === 0) {
      per.forEach(function (q) {
        if (sisaUang > 0 && q.dendaAktif > 0) {
          var u = Math.min(sisaUang, q.dendaAktif);
          q.dendaDibayar = u;
          sisaUang -= u;
        }
      });
    }
    per.forEach(function (q) { q.sisaDenda = q.dendaAktif - q.dendaDibayar; });

    /* 3. Sisa uang menjadi saldo lebih untuk bulan berikutnya */
    var saldoLebih = sisaUang;

    var totalSisaDenda = 0;
    var totalDendaDibebaskan = 0;
    per.forEach(function (q) {
      totalSisaDenda += q.sisaDenda;
      if (q.dibebaskan) totalDendaDibebaskan += q.dendaTimbul;
    });

    /* F7 — Total tagihan */
    var totalTagihanF7 = totalSisaPokok + totalSisaDenda - saldoLebih;
    var totalTagihan = Math.max(0, totalTagihanF7);

    /* --- F3 — Bulan tertunggak (patokan ulang bulan penghuni) --- */
    var bulanTertunggakAwal = 0;
    if (sisaPokokAwal > 0 && bulanAwal > 0) {
      var satuan = pokokAwal / bulanAwal;
      bulanTertunggakAwal = satuan > 0 ? Math.ceil(sisaPokokAwal / satuan) : bulanAwal;
      if (bulanTertunggakAwal > bulanAwal) bulanTertunggakAwal = bulanAwal;
    } else if (sisaPokokAwal > 0) {
      bulanTertunggakAwal = 1;
    }

    var M = bulanTertunggakAwal;
    var bulanTertunggak = [];
    per.forEach(function (q) {
      q.dihitungTertunggak = false;
      if (!q.sudahJatuhTempo || q.sisaPokok <= 0) return;
      var jtBerikut = jatuhTempo(
        q.bulanIndeks === 11 ? q.tahun + 1 : q.tahun,
        q.bulanIndeks === 11 ? 0 : q.bulanIndeks + 1,
        p.tglUlangBulan
      );
      if (jtBerikut.getTime() <= today.getTime()) {
        M++;
        q.dihitungTertunggak = true;
        bulanTertunggak.push(q.bulan);
      }
    });

    /* --- F4 — Status, diperiksa berurutan --- */
    var adaBulanLewatBatas = false;
    per.forEach(function (q) {
      if (q.sudahJatuhTempo && q.sisaPokok > 0 && q.lewatBatas) adaBulanLewatBatas = true;
    });

    var status;
    if (M >= 3) status = 'lama';
    else if (M >= 1) status = 'baru';
    else if (adaBulanLewatBatas) status = 'telat';
    else status = 'lancar';

    /* Penanda: pokok lunas tapi masih ada denda tergantung */
    var penandaDenda = (totalSisaPokok === 0 && totalSisaDenda > 0);

    /* Periode berjalan yang paling relevan untuk pesan penagihan */
    var periodeTerlambat = null;
    for (var z = per.length - 1; z >= 0; z--) {
      if (per[z].sudahJatuhTempo && per[z].sisaPokok > 0) { periodeTerlambat = per[z]; break; }
    }

    return {
      penghuni: p,
      hariIni: today,
      periode: per,
      saldoAwal: awal ? {
        bulanTertunggak: bulanAwal,
        pokokTertunggak: pokokAwal,
        sisaPokok: sisaPokokAwal,
        dibayar: dibayarAwal,
        sejakBulan: awal.sejakBulan
      } : null,
      totalDisetujui: totalDisetujui,
      totalSisaPokok: totalSisaPokok,
      totalSisaDenda: totalSisaDenda,
      totalDendaDibebaskan: totalDendaDibebaskan,
      saldoLebih: saldoLebih,
      totalTagihanF7: totalTagihanF7,
      totalTagihan: totalTagihan,
      bulanTertunggak: M,
      daftarBulanTertunggak: bulanTertunggak,
      status: status,
      penandaDenda: penandaDenda,
      periodeTerlambat: periodeTerlambat
    };
  }

  var INFO_STATUS = {
    lancar: { ikon: '🟢', label: 'Lancar', urut: 3 },
    telat: { ikon: '🟡', label: 'Telat', urut: 2 },
    baru: { ikon: '🟠', label: 'Baru menunggak', urut: 1 },
    lama: { ikon: '🔴', label: 'Lama menunggak', urut: 0 }
  };

  function hitungSemua(db, today) {
    today = today || hariIni();
    var hasil = db.penghuni.filter(function (p) { return p.aktif !== false; })
      .map(function (p) { return hitung(db, p, today); });
    hasil.sort(function (a, b) {
      var d = INFO_STATUS[a.status].urut - INFO_STATUS[b.status].urut;
      if (d !== 0) return d;
      d = b.totalTagihan - a.totalTagihan;
      if (d !== 0) return d;
      return a.penghuni.kamar - b.penghuni.kamar;
    });
    return hasil;
  }

  /* ==========================================================
     BAGIAN E — TAUTAN KARTU KAMAR
     JSON -> kunci pendek -> encodeURIComponent -> Base64 URL-safe.
     Data ditaruh sesudah tanda # sehingga tidak pernah dikirim
     ke server mana pun.
     ========================================================== */

  function keB64Url(teks) {
    var b64;
    if (typeof btoa === 'function') {
      b64 = btoa(unescape(encodeURIComponent(teks)));
    } else {
      b64 = Buffer.from(teks, 'utf8').toString('base64');
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function dariB64Url(kode) {
    var b64 = String(kode).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(b64)));
    }
    return Buffer.from(b64, 'base64').toString('utf8');
  }

  /* Potret data SATU penghuni. Tidak memuat apa pun milik penghuni lain. */
  function snapshotKartu(db, p, today) {
    today = today || hariIni();
    var h = hitung(db, p, today);
    var riw = h.periode.slice(-12).map(function (q) {
      return [
        q.bulan,
        q.pokok,
        q.sudahJatuhTempo ? q.sisaPokok : -1,
        q.sisaDenda,
        q.dibayarPokok + q.dendaDibayar,
        q.dibebaskan ? 1 : 0
      ];
    });
    var s = {
      v: 1,
      t: fmtTgl(today),
      o: db.pengaturan.namaKos,
      n: p.nama,
      k: p.kamar,
      u: p.tglUlangBulan,
      g: Number(db.pengaturan.tenggatHari) || 10,
      st: h.status,
      fd: h.penandaDenda ? 1 : 0,
      m: h.bulanTertunggak,
      sp: h.totalSisaPokok,
      sd: h.totalSisaDenda,
      sl: h.saldoLebih,
      tt: h.totalTagihan,
      r: riw
    };
    if (h.saldoAwal && h.saldoAwal.pokokTertunggak > 0) {
      s.aw = [h.saldoAwal.bulanTertunggak, h.saldoAwal.sisaPokok, h.saldoAwal.sejakBulan || ''];
    }
    return s;
  }

  function kodeKartu(db, p, today) {
    return keB64Url(JSON.stringify(snapshotKartu(db, p, today)));
  }

  function tautanKartu(db, p, today) {
    var dasar = 'kartu.html';
    if (typeof location !== 'undefined' && location.href) {
      dasar = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '') + 'kartu.html';
    }
    return dasar + '#d=' + kodeKartu(db, p, today);
  }

  /* ==========================================================
     BAGIAN F — DRAFT PESAN PENAGIHAN (template, tanpa API)
     ========================================================== */

  function nomorWA(no) {
    var d = String(no || '').replace(/[^0-9]/g, '');
    if (d.indexOf('0') === 0) d = '62' + d.slice(1);
    else if (d.indexOf('62') !== 0 && d.length > 0) d = '62' + d;
    return d;
  }

  function daftarBulanTeks(kodeList) {
    var n = kodeList.map(labelBulan);
    if (n.length === 0) return '-';
    if (n.length === 1) return n[0];
    return n.slice(0, -1).join(', ') + ' dan ' + n[n.length - 1];
  }

  function draftPesan(h, tautan) {
    var p = h.penghuni;
    var nama = p.nama;
    var kamar = p.kamar;

    if (h.status === 'lama') {
      return 'Halo ' + nama + ', sewa kamar ' + kamar + ' sudah tertunggak ' +
        h.bulanTertunggak + ' bulan dengan total ' + rupiah(h.totalTagihan) +
        '. Rinciannya di sini: ' + tautan +
        ' Saya ingin membicarakan ini langsung — kapan waktu yang memungkinkan untuk kita bicara?';
    }

    if (h.status === 'baru') {
      return 'Halo ' + nama + ', sewa kamar ' + kamar + ' tercatat tertunggak ' +
        h.bulanTertunggak + ' bulan (' + daftarBulanTeks(h.daftarBulanTertunggak) +
        '). Total dengan denda ' + rupiah(h.totalTagihan) +
        '. Rincian lengkapnya bisa dicek di sini: ' + tautan +
        ' Kalau ada kendala, boleh dibicarakan supaya kita cari jalan keluar bersama. Terima kasih 🙏';
    }

    if (h.status === 'telat') {
      var q = h.periodeTerlambat || h.periode[h.periode.length - 1];
      return 'Halo ' + nama + ', saya ingin mengingatkan sewa kamar ' + kamar +
        ' bulan ' + labelBulan(q.bulan) + ' sebesar ' + rupiah(q.sisaPokok) +
        ' yang jatuh tempo ' + labelTglPanjang(q.jatuhTempo) +
        '. Sudah lewat batas ' + (Number(h.periode.length) ? selisihHari(q.batasBayar, q.jatuhTempo) : 10) +
        ' hari, sehingga terdapat denda ' + rupiah(q.sisaDenda) +
        '. Total ' + rupiah(h.totalTagihan) +
        '. Kalau sudah ditransfer, mohon kirim buktinya ya. Terima kasih 🙏' +
        ' Rincian: ' + tautan;
    }

    /* Lancar — hanya dipakai bila pemilik menekan tagih secara manual */
    if (h.penandaDenda) {
      return 'Halo ' + nama + ', sewa kamar ' + kamar +
        ' sudah lunas, terima kasih ya 🙏 Masih ada denda keterlambatan ' +
        rupiah(h.totalSisaDenda) + ' yang belum dibayar. Rinciannya di sini: ' + tautan;
    }
    return 'Halo ' + nama + ', sewa kamar ' + kamar +
      ' tercatat lancar sampai hari ini. Terima kasih ya 🙏 Kartu kamar bisa dicek di sini: ' + tautan;
  }

  function tautanWA(noWA, pesan) {
    return 'https://wa.me/' + nomorWA(noWA) + '?text=' + encodeURIComponent(pesan);
  }

  /* ==========================================================
     BAGIAN G — DATA CONTOH (8 penghuni, status bercampur)
     Dibuat relatif terhadap hari ini supaya campuran statusnya
     tetap benar kapan pun aplikasi dibuka.
     ========================================================== */

  function dataContoh(today) {
    var T = today || hariIni();
    var db = dbKosong(T);

    function hariDariMundur(n) { return tambahHari(T, -n).getDate(); }

    var daftar = [
      { kamar: 1, nama: 'Sari Dewi', tglUlangBulan: 5, sewa: 1500000, noWA: '081234567001', resep: { sisakan: 0 } },
      { kamar: 2, nama: 'Budi Santoso', tglUlangBulan: 20, sewa: 1350000, noWA: '081234567002', resep: { sisakan: 0 } },
      { kamar: 3, nama: 'Andi Pratama', tglUlangBulan: hariDariMundur(14), sewa: 1500000, noWA: '081234567003', resep: { sisakan: 1 } },
      { kamar: 4, nama: 'Rina Marbun', tglUlangBulan: hariDariMundur(18), sewa: 1250000, noWA: '081234567004', resep: { sisakan: 1 } },
      { kamar: 5, nama: 'Joko Susilo', tglUlangBulan: hariDariMundur(3), sewa: 1400000, noWA: '081234567005', resep: { sisakan: 2 } },
      { kamar: 6, nama: 'Maria Tobing', tglUlangBulan: hariDariMundur(6), sewa: 1600000, noWA: '081234567006', resep: { sisakan: 3 } },
      { kamar: 7, nama: 'Hendra Wijaya', tglUlangBulan: hariDariMundur(4), sewa: 1500000, noWA: '081234567007', resep: { sisakan: 99, saldoAwal: true } },
      { kamar: 8, nama: 'Lia Anggraini', tglUlangBulan: 12, sewa: 1450000, noWA: '081234567008', resep: { sisakan: 0, telatkanPertama: true } }
    ];

    var nomorBayar = 1;
    daftar.forEach(function (d, idx) {
      var p = {
        id: 'p' + (idx + 1),
        kamar: d.kamar,
        nama: d.nama,
        tglUlangBulan: d.tglUlangBulan,
        sewa: d.sewa,
        noWA: d.noWA,
        aktif: true
      };
      db.penghuni.push(p);

      if (d.resep.saldoAwal) {
        var potong = parseTgl(db.pengaturan.tanggalPotong);
        var sejak = new Date(potong.getFullYear(), potong.getMonth() - 2, 1);
        db.saldoAwal.push({
          penghuniId: p.id,
          bulanTertunggak: 2,
          pokokTertunggak: 3000000,
          sejakBulan: kodeBulan(sejak)
        });
      }

      var per = bangunPeriode(db, p, T).filter(function (q) {
        return q.jatuhTempo.getTime() <= T.getTime();
      });
      var bayarSampaiIdx = per.length - (d.resep.sisakan || 0);
      for (var i = 0; i < bayarSampaiIdx && i < per.length; i++) {
        var q = per[i];
        var tanggal = (d.resep.telatkanPertama && i === 0) ? tambahHari(q.batasBayar, 4) : q.jatuhTempo;
        db.pembayaran.push({
          id: 'b' + (nomorBayar++),
          penghuniId: p.id,
          tanggalBayar: fmtTgl(tanggal),
          jumlah: q.pokok,
          catatanBukti: 'transfer BCA ' + labelTgl(tanggal),
          status: 'disetujui',
          alasanTolak: ''
        });
      }

      /* Satu pembayaran sebagian untuk kasus tunggakan lama */
      if (d.resep.saldoAwal) {
        db.pembayaran.push({
          id: 'b' + (nomorBayar++),
          penghuniId: p.id,
          tanggalBayar: fmtTgl(tambahHari(T, -55)),
          jumlah: 2000000,
          catatanBukti: 'transfer sebagian, screenshot BRI',
          status: 'disetujui',
          alasanTolak: ''
        });
      }
    });

    /* Dua laporan menunggu verifikasi supaya panel hari ini terisi */
    db.pembayaran.push({
      id: 'b' + (nomorBayar++),
      penghuniId: 'p3',
      tanggalBayar: fmtTgl(tambahHari(T, -1)),
      jumlah: 1500000,
      catatanBukti: 'screenshot BCA ' + labelTgl(tambahHari(T, -1)),
      status: 'menunggu',
      alasanTolak: ''
    });
    db.pembayaran.push({
      id: 'b' + (nomorBayar++),
      penghuniId: 'p6',
      tanggalBayar: fmtTgl(T),
      jumlah: 1600000,
      catatanBukti: 'foto struk ATM',
      status: 'menunggu',
      alasanTolak: ''
    });

    return db;
  }

  /* ==========================================================
     EKSPOR MODUL
     ========================================================== */
  return {
    /* utilitas */
    NAMA_BULAN: NAMA_BULAN,
    NAMA_BULAN_PENDEK: NAMA_BULAN_PENDEK,
    hariIni: hariIni,
    fmtTgl: fmtTgl,
    parseTgl: parseTgl,
    tambahHari: tambahHari,
    selisihHari: selisihHari,
    hariTerakhirBulan: hariTerakhirBulan,
    kodeBulan: kodeBulan,
    labelBulan: labelBulan,
    labelTgl: labelTgl,
    labelTglPanjang: labelTglPanjang,
    rupiah: rupiah,
    /* formula */
    jatuhTempo: jatuhTempo,
    batasBayar: batasBayar,
    bangunPeriode: bangunPeriode,
    hitung: hitung,
    hitungSemua: hitungSemua,
    tarifDendaPada: tarifDendaPada,
    kunciWaive: kunciWaive,
    INFO_STATUS: INFO_STATUS,
    /* penyimpanan */
    KUNCI_SIMPAN: KUNCI_SIMPAN,
    dbKosong: dbKosong,
    rapikanDb: rapikanDb,
    muat: muat,
    simpan: simpan,
    hapusSimpanan: hapusSimpanan,
    dataContoh: dataContoh,
    /* tautan & pesan */
    keB64Url: keB64Url,
    dariB64Url: dariB64Url,
    snapshotKartu: snapshotKartu,
    kodeKartu: kodeKartu,
    tautanKartu: tautanKartu,
    draftPesan: draftPesan,
    tautanWA: tautanWA,
    nomorWA: nomorWA,
    daftarBulanTeks: daftarBulanTeks
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RO;
