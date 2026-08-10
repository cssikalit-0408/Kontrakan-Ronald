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
    /* Riwayat sewa. Data lama hanya punya satu angka `sewa`; angka itu
       dijadikan tarif yang berlaku sejak awal supaya riwayat yang sudah
       tercatat tidak bergeser sama sekali. */
    db.penghuni.forEach(function (p) {
      if (!p.sewaRiwayat || !p.sewaRiwayat.length) {
        p.sewaRiwayat = [{ sejak: '2000-01-01', nilai: Math.round(p.sewa) || 0 }];
      }
      p.sewaRiwayat.sort(function (a, b) { return a.sejak < b.sejak ? -1 : 1; });
      p.sewa = p.sewaRiwayat[p.sewaRiwayat.length - 1].nilai;
      /* Catatan penagihan: kapan terakhir dihubungi dan apa hasilnya.
         Ini catatan pribadi pemilik — tidak pernah ikut ke Kartu Kamar. */
      if (typeof p.terakhirDitagih !== 'string') p.terakhirDitagih = '';
      if (typeof p.catatan !== 'string') p.catatan = '';
    });
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

  /* Tarif sewa yang berlaku pada suatu tanggal.
     Pasangan dari tarifDendaPada: menaikkan sewa TIDAK boleh mengubah
     bulan-bulan yang sudah lewat, karena itu akan memunculkan kekurangan
     bayar dan denda untuk keterlambatan yang tidak pernah terjadi. */
  function tarifSewaPada(p, tanggal) {
    var r = p.sewaRiwayat;
    if (!r || !r.length) return Math.round(p.sewa) || 0;
    var nilai = r[0].nilai;
    for (var i = 0; i < r.length; i++) {
      if (parseTgl(r[i].sejak).getTime() <= tanggal.getTime()) nilai = r[i].nilai;
    }
    return Math.round(nilai);
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
          /* Tarif yang berlaku saat bulan itu jatuh tempo, bukan tarif hari ini */
          pokok: tarifSewaPada(p, jt)
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

    /* Contoh catatan penagihan, supaya gunanya langsung kelihatan */
    var contohKontak = {
      p7: { mundur: 12, catatan: 'Sudah dihubungi. Minta dicicil Rp 500.000 per bulan mulai bulan depan.' },
      p5: { mundur: 3, catatan: 'Bilang gajian tanggal 25, mau langsung transfer.' }
    };
    db.penghuni.forEach(function (p) {
      var k = contohKontak[p.id];
      if (!k) return;
      p.terakhirDitagih = fmtTgl(tambahHari(T, -k.mundur));
      p.catatan = k.catatan;
    });

    return rapikanDb(db, T);
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
    tarifSewaPada: tarifSewaPada,
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

/* ============================================================
   BAGIAN H — TAMPILAN PAPAN KENDALI (layar pemilik)
   Hanya berjalan di peramban. Di Node bagian ini dilewati.
   ============================================================ */
(function () {
  if (typeof document === 'undefined') return;

  var db = null;
  var kini = null;          /* tanggal hari ini, dihitung ulang tiap gambar ulang */
  var tab = 'beranda';
  var saring = null;        /* null | 'verifikasi' | 'tagih' */
  var idxToast = null;

  /* ---------------- pembantu kecil ---------------- */

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function titik(n) { return RO.rupiah(n).replace('Rp ', ''); }

  function toast(pesan) {
    var t = el('toast');
    t.textContent = pesan;
    t.hidden = false;
    if (idxToast) clearTimeout(idxToast);
    idxToast = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function simpanDanGambar() {
    if (!RO.simpan(db)) {
      toast('Gagal menyimpan. Ruang penyimpanan peramban mungkin penuh.');
    }
    gambar();
  }

  function cariPenghuni(id) {
    for (var i = 0; i < db.penghuni.length; i++) if (db.penghuni[i].id === id) return db.penghuni[i];
    return null;
  }

  function cariPembayaran(id) {
    for (var i = 0; i < db.pembayaran.length; i++) if (db.pembayaran[i].id === id) return db.pembayaran[i];
    return null;
  }

  function idBaru(awalan, daftar) {
    var n = 1;
    while (true) {
      var kandidat = awalan + n;
      var bentrok = false;
      for (var i = 0; i < daftar.length; i++) if (daftar[i].id === kandidat) bentrok = true;
      if (!bentrok) return kandidat;
      n++;
    }
  }

  /* ---------------- lapisan (dialog) ---------------- */

  function bukaLapis(judul, isi) {
    el('lapisJudul').textContent = judul;
    el('lapisIsi').innerHTML = isi;
    el('lapisIsi').scrollTop = 0;
    el('lapis').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function tutupLapis() {
    el('lapis').hidden = true;
    el('lapisIsi').innerHTML = '';
    document.body.style.overflow = '';
  }

  function lapisTerbuka() { return !el('lapis').hidden; }

  /* ---------------- salin teks ---------------- */

  function salin(teks) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(function () {
        toast('Tersalin.');
      }, function () { salinCadangan(teks); });
    } else {
      salinCadangan(teks);
    }
  }

  function salinCadangan(teks) {
    var ta = document.createElement('textarea');
    ta.value = teks;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? 'Tersalin.' : 'Tidak bisa menyalin otomatis. Silakan tahan lalu salin manual.');
  }

  /* ==========================================================
     GAMBAR — Beranda
     ========================================================== */

  function lencanaStatus(h) {
    var s = RO.INFO_STATUS[h.status];
    var html = '<span class="lencana l-' + h.status + '">' + s.ikon + ' ' + s.label + '</span>';
    if (h.penandaDenda) {
      html += ' <span class="lencana l-telat">⚠️ ada denda belum lunas</span>';
    }
    return html;
  }

  /* Keterangan singkat di baris kamar, disesuaikan dengan statusnya supaya
     tidak membingungkan (mis. "tidak ada tunggakan" di sebelah tagihan besar). */
  function ringkasanBaris(h) {
    if (h.bulanTertunggak > 0) return 'Tertunggak ' + h.bulanTertunggak + ' bulan';
    if (h.status === 'telat' && h.periodeTerlambat) {
      return 'Telat ' + h.periodeTerlambat.hariSejakJatuhTempo + ' hari sejak jatuh tempo';
    }
    if (h.penandaDenda) return 'Sewa lunas, denda belum';
    if (h.saldoLebih > 0) return 'Lebih bayar ' + RO.rupiah(h.saldoLebih);
    return 'Tidak ada tunggakan';
  }

  /* Kapan terakhir orang ini dihubungi — fakta yang paling menentukan
     tindakan hari ini, lebih daripada angka rupiahnya. */
  function labelDitagih(p) {
    if (!p.terakhirDitagih) return 'Belum pernah ditagih';
    var n = RO.selisihHari(kini, RO.parseTgl(p.terakhirDitagih));
    if (n <= 0) return 'Ditagih hari ini';
    if (n === 1) return 'Ditagih kemarin';
    return 'Ditagih ' + n + ' hari lalu';
  }

  function htmlBarisKontak(h) {
    var p = h.penghuni;
    if (h.status === 'lancar' && !p.catatan) return '';
    return '<div class="baris-kontak">🗓️ ' + esc(labelDitagih(p)) +
      (p.catatan ? '<br>📝 ' + esc(p.catatan) : '') + '</div>';
  }

  /* Penyunting catatan penagihan. Dipakai di dua tempat: layar detail
     dan layar tagih. Keduanya tidak pernah terbuka bersamaan. */
  function htmlKontak(p) {
    return '<div class="kartu"><div class="kartu-isi">' +
      '<div class="riwayat-kepala"><span>Catatan penagihan</span>' +
      '<span class="riwayat-tag tag-jalan">' + esc(labelDitagih(p)) + '</span></div>' +
      '<p class="petunjuk">Hanya untuk kamu. Tidak pernah ikut ke Kartu Kamar maupun draft pesan.</p>' +
      '<label class="isian"><span class="nama-isian">Terakhir ditagih</span>' +
      '<input type="date" id="kTanggal" value="' + esc(p.terakhirDitagih || '') + '"></label>' +
      '<label class="isian"><span class="nama-isian">Catatan</span>' +
      '<textarea id="kCatatan" rows="3" placeholder="mis. janji bayar setelah gajian tanggal 25">' +
      esc(p.catatan || '') + '</textarea></label>' +
      '<div class="tbl-baris">' +
      '<button type="button" class="tbl garis kecil-tbl" data-aksi="kontak-hari-ini">Isi hari ini</button>' +
      '<button type="button" class="tbl kecil-tbl" data-aksi="simpan-kontak" data-id="' + esc(p.id) + '">Simpan catatan</button>' +
      '</div></div></div>';
  }

  function gambarBeranda() {
    var semua = RO.hitungSemua(db, kini);
    var menunggu = db.pembayaran.filter(function (b) { return b.status === 'menunggu'; });
    var perluTagih = semua.filter(function (h) { return h.status !== 'lancar'; });

    /* --- Panel Hari Ini: hanya dua angka --- */
    var panel;
    if (menunggu.length === 0 && perluTagih.length === 0) {
      panel = '<div class="panel-kosong">Tidak ada yang perlu dikerjakan hari ini.</div>';
      saring = null;
    } else {
      panel =
        '<div class="panel">' +
        '<button type="button" class="panel-ubin" data-aksi="saring" data-nilai="verifikasi"' +
        ' aria-pressed="' + (saring === 'verifikasi') + '">' +
        '<span class="panel-angka">' + menunggu.length + '</span>' +
        '<span class="panel-label">🔔 Menunggu verifikasi</span></button>' +
        '<button type="button" class="panel-ubin" data-aksi="saring" data-nilai="tagih"' +
        ' aria-pressed="' + (saring === 'tagih') + '">' +
        '<span class="panel-angka">' + perluTagih.length + '</span>' +
        '<span class="panel-label">📣 Perlu ditagih</span></button>' +
        '</div>';
    }
    el('panelHariIni').innerHTML = panel;

    /* --- Daftar di bawah panel --- */
    var isi = '';
    if (saring === 'verifikasi') {
      isi += '<h2 class="judul-bagian">Menunggu verifikasi (' + menunggu.length + ')</h2>';
      if (!menunggu.length) {
        isi += '<div class="kartu"><div class="kartu-isi sunyi">Tidak ada laporan pembayaran yang menunggu.</div></div>';
      }
      menunggu.slice().sort(function (a, b) {
        return a.tanggalBayar < b.tanggalBayar ? -1 : 1;
      }).forEach(function (b) {
        var p = cariPenghuni(b.penghuniId);
        isi += '<button type="button" class="antre" data-aksi="verifikasi" data-id="' + esc(b.id) + '">' +
          '<div class="baris-judul"><span class="baris-kamar-no">Kamar ' + esc(p ? p.kamar : '?') + '</span>' +
          '<span class="baris-nama">' + esc(p ? p.nama : 'Penghuni terhapus') + '</span></div>' +
          '<div class="antre-jumlah">' + RO.rupiah(b.jumlah) + '</div>' +
          '<div class="riwayat-info">Dilaporkan ' + esc(RO.labelTgl(RO.parseTgl(b.tanggalBayar))) +
          (b.catatanBukti ? ' · ' + esc(b.catatanBukti) : '') + '</div>' +
          '</button>';
      });
    } else {
      var daftar = saring === 'tagih' ? perluTagih : semua;
      isi += '<h2 class="judul-bagian">' +
        (saring === 'tagih' ? 'Perlu ditagih (' + perluTagih.length + ')' : 'Daftar kamar (' + semua.length + ')') +
        '</h2>';
      if (!daftar.length) {
        isi += '<div class="kartu"><div class="kartu-isi sunyi">' +
          (db.penghuni.length ? 'Semua penghuni lancar.' : 'Belum ada penghuni. Tambahkan lewat Pengaturan.') +
          '</div></div>';
      }
      daftar.forEach(function (h) {
        var p = h.penghuni;
        isi += '<div class="baris-kamar s-' + h.status + '">' +
          '<button type="button" class="baris-utama" data-aksi="detail" data-id="' + esc(p.id) + '">' +
          '<div class="baris-judul"><span class="baris-kamar-no">Kamar ' + esc(p.kamar) + '</span>' +
          '<span class="baris-nama">' + esc(p.nama) + '</span></div>' +
          '<div>' + lencanaStatus(h) + '</div>' +
          htmlBarisKontak(h) +
          '<div class="baris-rincian">' +
          '<span class="baris-tunggak">' + esc(ringkasanBaris(h)) + '</span>' +
          '<span class="baris-total' + (h.totalTagihan === 0 ? ' nol' : '') + '">' + RO.rupiah(h.totalTagihan) + '</span>' +
          '</div></button>' +
          '<div class="baris-aksi">' +
          '<button type="button" data-aksi="tagih" data-id="' + esc(p.id) + '">📣 Tagih</button>' +
          '<button type="button" data-aksi="kartu" data-id="' + esc(p.id) + '">🔗 Buat Kartu</button>' +
          '</div></div>';
      });
    }
    el('daftarKamar').innerHTML = isi;
  }

  /* ==========================================================
     GAMBAR — Detail penghuni (riwayat 12 bulan)
     ========================================================== */

  function htmlDetail(h) {
    var p = h.penghuni;
    var isi = '<div class="kartu"><div class="kartu-isi">' +
      '<div class="baris-judul"><span class="baris-kamar-no">Kamar ' + esc(p.kamar) + '</span>' +
      '<span class="baris-nama">' + esc(p.nama) + '</span></div>' +
      '<div style="margin-top:6px">' + lencanaStatus(h) + '</div>' +
      '<div class="ringkas">' +
      '<div class="ringkas-baris"><span>Sewa per bulan</span><span class="tebal">' + RO.rupiah(p.sewa) + '</span></div>' +
      (p.sewaRiwayat && p.sewaRiwayat.length > 1
        ? '<div class="ringkas-baris"><span>Sewa pernah berubah</span><span class="tebal">' +
          p.sewaRiwayat.length + ' tarif</span></div>' : '') +
      '<div class="ringkas-baris"><span>Tanggal ulang bulan</span><span class="tebal">tiap tanggal ' + esc(p.tglUlangBulan) + '</span></div>' +
      '<div class="ringkas-baris"><span>Sisa pokok</span><span class="tebal">' + RO.rupiah(h.totalSisaPokok) + '</span></div>' +
      '<div class="ringkas-baris"><span>Denda belum dibayar</span><span class="tebal">' + RO.rupiah(h.totalSisaDenda) + '</span></div>';
    if (h.totalDendaDibebaskan > 0) {
      isi += '<div class="ringkas-baris"><span>Denda dibebaskan</span><span class="tebal">−' + RO.rupiah(h.totalDendaDibebaskan) + '</span></div>';
    }
    if (h.saldoLebih > 0) {
      isi += '<div class="ringkas-baris"><span>Saldo lebih</span><span class="tebal">−' + RO.rupiah(h.saldoLebih) + '</span></div>';
    }
    isi += '<div class="ringkas-baris total"><span>Total tagihan</span><span>' + RO.rupiah(h.totalTagihan) + '</span></div>' +
      '</div></div>' +
      '<div class="baris-aksi">' +
      '<button type="button" data-aksi="tagih" data-id="' + esc(p.id) + '">📣 Tagih</button>' +
      '<button type="button" data-aksi="kartu" data-id="' + esc(p.id) + '">🔗 Buat Kartu</button>' +
      '</div></div>';

    return isi;
  }

  function riwayatHtml(h) {
    var p = h.penghuni;
    var isi = '<h2 class="judul-bagian">Riwayat</h2>';

    /* F8 — satu baris posisi awal di puncak, tanpa mengisi mundur 12 bulan */
    if (h.saldoAwal && h.saldoAwal.pokokTertunggak > 0) {
      var a = h.saldoAwal;
      isi += '<div class="riwayat-baris awal">' +
        '<div class="riwayat-kepala"><span>Posisi awal</span>' +
        '<span class="riwayat-tag ' + (a.sisaPokok > 0 ? 'tag-belum' : 'tag-lunas') + '">' +
        (a.sisaPokok > 0 ? 'belum lunas' : 'lunas') + '</span></div>' +
        '<div class="riwayat-info">Per ' + esc(RO.labelTgl(RO.parseTgl(db.pengaturan.tanggalPotong))) +
        ' — tertunggak ' + esc(a.bulanTertunggak) + ' bulan, ' + RO.rupiah(a.pokokTertunggak) +
        (a.sejakBulan ? ' (sejak ' + esc(RO.labelBulan(a.sejakBulan)) + ')' : '') + '.</div>' +
        '<div class="riwayat-info">Dibayar <b>' + RO.rupiah(a.dibayar) + '</b> · Sisa <b>' + RO.rupiah(a.sisaPokok) + '</b> · Denda masa lalu dihapus seluruhnya.</div>' +
        '</div>';
    }

    var out = '';
    h.periode.slice(-12).forEach(function (q) {
      var kelas, tag, tagKelas;
      if (!q.sudahJatuhTempo) { kelas = ''; tag = 'belum jatuh tempo'; tagKelas = 'tag-jalan'; }
      else if (q.sisaPokok === 0 && q.sisaDenda === 0) { kelas = ' lunas'; tag = 'lunas'; tagKelas = 'tag-lunas'; }
      else if (q.sisaPokok === 0) { kelas = ' lunas'; tag = 'pokok lunas'; tagKelas = 'tag-lunas'; }
      else { kelas = ' belum'; tag = 'belum lunas'; tagKelas = 'tag-belum'; }

      out += '<div class="riwayat-baris' + kelas + '">' +
        '<div class="riwayat-kepala"><span>' + esc(RO.labelBulan(q.bulan)) + '</span>' +
        '<span class="riwayat-tag ' + tagKelas + '">' + tag + '</span></div>' +
        '<div class="riwayat-info">Jatuh tempo <b>' + esc(RO.labelTgl(q.jatuhTempo)) +
        '</b> · Batas bayar <b>' + esc(RO.labelTgl(q.batasBayar)) + '</b></div>' +
        '<div class="riwayat-info">Pokok <b>' + RO.rupiah(q.pokok) + '</b> · Dibayar <b>' + RO.rupiah(q.dibayarPokok) +
        '</b> · Sisa <b>' + (q.sudahJatuhTempo ? RO.rupiah(q.sisaPokok) : '—') + '</b></div>';

      if (q.sudahJatuhTempo && q.sisaPokok > 0 && q.lewatBatas) {
        out += '<div class="riwayat-info">Terlambat <b>' + q.hariSejakJatuhTempo + ' hari</b> sejak jatuh tempo ' +
          '(' + q.hariLewatBatas + ' hari lewat batas bayar).</div>';
      }

      if (q.dendaTimbul > 0) {
        out += '<div class="riwayat-denda"><span>Denda ' +
          '<b class="' + (q.dibebaskan ? 'dibebaskan' : '') + '">' + RO.rupiah(q.dendaTimbul) + '</b>' +
          (q.dibebaskan ? ' <span class="riwayat-tag tag-lunas">dibebaskan</span>'
            : (q.sisaDenda === 0 ? ' <span class="riwayat-tag tag-lunas">sudah dibayar</span>' : '')) +
          '</span>' +
          '<button type="button" data-aksi="waive" data-id="' + esc(p.id) + '" data-bulan="' + esc(q.bulan) + '">' +
          (q.dibebaskan ? 'Aktifkan lagi' : 'Bebaskan') + '</button></div>';
      }
      out += '</div>';
    });
    return isi + out;
  }

  function bukaDetail(id) {
    var p = cariPenghuni(id);
    if (!p) return;
    var h = RO.hitung(db, p, kini);
    var bayarPenghuni = db.pembayaran.filter(function (b) { return b.penghuniId === id; })
      .slice().sort(function (a, b) { return a.tanggalBayar < b.tanggalBayar ? 1 : -1; });

    var isi = htmlDetail(h) + htmlKontak(p) + riwayatHtml(h);

    isi += '<h2 class="judul-bagian">Catatan pembayaran</h2>';
    if (!bayarPenghuni.length) {
      isi += '<div class="kartu"><div class="kartu-isi sunyi">Belum ada catatan pembayaran.</div></div>';
    }
    bayarPenghuni.forEach(function (b) {
      var tagKelas = b.status === 'disetujui' ? 'tag-lunas' : (b.status === 'menunggu' ? 'tag-jalan' : 'tag-belum');
      isi += '<div class="riwayat-baris">' +
        '<div class="riwayat-kepala"><span>' + RO.rupiah(b.jumlah) + '</span>' +
        '<span class="riwayat-tag ' + tagKelas + '">' + esc(b.status) + '</span></div>' +
        '<div class="riwayat-info">' + esc(RO.labelTgl(RO.parseTgl(b.tanggalBayar))) +
        (b.catatanBukti ? ' · ' + esc(b.catatanBukti) : '') + '</div>' +
        (b.status === 'ditolak' && b.alasanTolak ? '<div class="riwayat-info">Alasan ditolak: <b>' + esc(b.alasanTolak) + '</b></div>' : '') +
        (b.status === 'menunggu' ? '<button type="button" class="tbl kecil-tbl garis" data-aksi="verifikasi" data-id="' + esc(b.id) + '">Verifikasi sekarang</button>' : '') +
        '<button type="button" class="tbl kecil-tbl merah" data-aksi="hapus-bayar" data-id="' + esc(b.id) + '">Hapus catatan ini</button>' +
        '</div>';
    });

    bukaLapis('Kamar ' + p.kamar + ' — ' + p.nama, isi);
  }

  /* ==========================================================
     Verifikasi pembayaran (maksimal 3 ketukan)
     ========================================================== */

  function bukaVerifikasi(id) {
    var b = cariPembayaran(id);
    if (!b) return;
    var p = cariPenghuni(b.penghuniId);
    var isi = '<div class="kartu"><div class="kartu-isi">' +
      '<div class="baris-judul"><span class="baris-kamar-no">Kamar ' + esc(p ? p.kamar : '?') + '</span>' +
      '<span class="baris-nama">' + esc(p ? p.nama : 'Penghuni terhapus') + '</span></div>' +
      '<div class="total-besar" style="margin-top:10px">' + RO.rupiah(b.jumlah) + '</div>' +
      '<div class="ringkas">' +
      '<div class="ringkas-baris"><span>Tanggal bayar</span><span class="tebal">' + esc(RO.labelTglPanjang(RO.parseTgl(b.tanggalBayar))) + '</span></div>' +
      '<div class="ringkas-baris"><span>Catatan bukti</span><span class="tebal">' + esc(b.catatanBukti || '—') + '</span></div>' +
      '</div></div></div>' +
      '<button type="button" class="tbl hijau" data-aksi="setuju" data-id="' + esc(b.id) + '">✅ Setuju</button>' +
      '<button type="button" class="tbl merah" data-aksi="tolak-buka" data-id="' + esc(b.id) + '">✖️ Tolak</button>' +
      '<div id="kotakTolak" hidden>' +
      '<label class="isian"><span class="nama-isian">Alasan ditolak</span>' +
      '<input type="text" id="alasanTolak" placeholder="mis. bukti tidak terbaca"></label>' +
      '<button type="button" class="tbl merah" data-aksi="tolak-simpan" data-id="' + esc(b.id) + '">Simpan penolakan</button>' +
      '</div>';
    bukaLapis('Verifikasi pembayaran', isi);
  }

  function lanjutSetelahVerifikasi() {
    var sisa = db.pembayaran.filter(function (b) { return b.status === 'menunggu'; });
    if (sisa.length) { saring = 'verifikasi'; tutupLapis(); }
    else { saring = null; tutupLapis(); }
  }

  /* ==========================================================
     Tagih & Buat Kartu
     ========================================================== */

  function bukaTagih(id) {
    var p = cariPenghuni(id);
    if (!p) return;
    var h = RO.hitung(db, p, kini);
    var tautan = RO.tautanKartu(db, p, kini);
    var pesan = RO.draftPesan(h, tautan);
    var isi = '<div class="kartu"><div class="kartu-isi">' +
      '<div>' + lencanaStatus(h) + '</div>' +
      '<p class="petunjuk">Draft dipilih otomatis sesuai status. Boleh diubah dulu sebelum dikirim.</p>' +
      '<textarea id="teksPesan" rows="10">' + esc(pesan) + '</textarea>' +
      '</div></div>' +
      '<button type="button" class="tbl" data-aksi="salin-pesan">📋 Salin pesan</button>' +
      (RO.nomorWA(p.noWA)
        ? '<a class="tbl hijau" id="tautanWA" href="#" data-aksi="buka-wa" data-id="' + esc(p.id) + '">💬 Buka WhatsApp</a>'
        : '<p class="petunjuk">Nomor WhatsApp penghuni ini belum diisi. Lengkapi lewat Pengaturan supaya tombol WhatsApp bisa dipakai.</p>') +
      htmlKontak(p);
    bukaLapis('Tagih — ' + p.nama, isi);
  }

  function bukaKartu(id) {
    var p = cariPenghuni(id);
    if (!p) return;
    var tautan = RO.tautanKartu(db, p, kini);
    var isi = '<div class="catatan-potret">Tautan ini berisi potret data ' + esc(p.nama) +
      ' per ' + esc(RO.labelTglPanjang(kini)) + '. Datanya menempel di dalam tautan dan tidak dikirim ke server mana pun. ' +
      'Bila ada perubahan, buat tautan baru.</div>' +
      '<div class="kartu"><div class="kartu-isi">' +
      '<textarea id="teksTautan" rows="6" readonly>' + esc(tautan) + '</textarea>' +
      '</div></div>' +
      '<button type="button" class="tbl" data-aksi="salin-tautan">📋 Salin tautan</button>' +
      '<a class="tbl garis" href="' + esc(tautan) + '" target="_blank" rel="noopener">👁️ Lihat kartunya</a>';
    bukaLapis('Kartu Kamar — ' + p.nama, isi);
  }

  /* ==========================================================
     GAMBAR — Catat pembayaran
     ========================================================== */

  function gambarCatat() {
    var pilihan = db.penghuni.filter(function (p) { return p.aktif !== false; })
      .slice().sort(function (a, b) { return a.kamar - b.kamar; })
      .map(function (p) {
        return '<option value="' + esc(p.id) + '">Kamar ' + esc(p.kamar) + ' — ' + esc(p.nama) + '</option>';
      }).join('');

    el('tab-catat').innerHTML =
      '<h2 class="judul-bagian">Catat pembayaran</h2>' +
      '<div class="kartu"><div class="kartu-isi">' +
      '<p class="petunjuk">Catatan ini masuk ke antrean sebagai <b>menunggu verifikasi</b>. Perhitungan baru berubah setelah kamu menyetujuinya.</p>' +
      '<form id="formCatat">' +
      '<label class="isian"><span class="nama-isian">Penghuni</span>' +
      '<select id="cPenghuni" required>' + (pilihan || '<option value="">Belum ada penghuni</option>') + '</select></label>' +
      '<label class="isian"><span class="nama-isian">Tanggal bayar</span>' +
      '<input type="date" id="cTanggal" value="' + RO.fmtTgl(kini) + '" required></label>' +
      '<label class="isian"><span class="nama-isian">Jumlah</span>' +
      '<input type="text" inputmode="numeric" id="cJumlah" data-uang placeholder="1.500.000" required></label>' +
      '<p class="pratinjau-uang" id="cPratinjau">Rp 0</p>' +
      '<label class="isian"><span class="nama-isian">Catatan bukti</span>' +
      '<input type="text" id="cBukti" placeholder="mis. screenshot BCA 08/08"></label>' +
      '<button type="submit" class="tbl">Simpan ke antrean</button>' +
      '</form></div></div>';
  }

  /* ==========================================================
     GAMBAR — Pengaturan
     ========================================================== */

  function gambarAtur() {
    var st = db.pengaturan;
    var isi = '';

    isi += '<h2 class="judul-bagian">Aturan kos</h2>' +
      '<div class="kartu"><div class="kartu-isi"><form id="formAturan">' +
      '<label class="isian"><span class="nama-isian">Nama kos</span>' +
      '<input type="text" id="aNama" value="' + esc(st.namaKos) + '"></label>' +
      '<label class="isian"><span class="nama-isian">Denda tetap per bulan telat</span>' +
      '<input type="text" inputmode="numeric" id="aDenda" data-uang value="' + esc(titik(st.dendaTetap)) + '"></label>' +
      '<p class="petunjuk">Perubahan tarif hanya berlaku untuk denda yang <b>timbul sesudah hari ini</b>. Denda lama tetap memakai tarif saat itu.</p>' +
      '<label class="isian"><span class="nama-isian">Tenggat setelah jatuh tempo (hari)</span>' +
      '<input type="number" id="aTenggat" min="0" max="60" step="1" value="' + esc(st.tenggatHari) + '"></label>' +
      '<label class="isian"><span class="nama-isian">Tanggal mulai sistem</span>' +
      '<input type="date" id="aPotong" value="' + esc(st.tanggalPotong) + '"></label>' +
      '<p class="petunjuk">Bulan sebelum tanggal ini tidak dihitung ulang. Tunggakan lama cukup diisi sebagai <b>posisi awal</b> di data penghuni.</p>' +
      '<button type="submit" class="tbl">Simpan aturan</button>' +
      '</form></div></div>';

    isi += '<h2 class="judul-bagian">Data penghuni</h2>';
    db.penghuni.slice().sort(function (a, b) { return a.kamar - b.kamar; }).forEach(function (p) {
      var sa = null;
      for (var i = 0; i < db.saldoAwal.length; i++) if (db.saldoAwal[i].penghuniId === p.id) sa = db.saldoAwal[i];
      isi += '<button type="button" class="antre" style="border-left-color:var(--biru)" data-aksi="edit-penghuni" data-id="' + esc(p.id) + '">' +
        '<div class="baris-judul"><span class="baris-kamar-no">Kamar ' + esc(p.kamar) + '</span>' +
        '<span class="baris-nama">' + esc(p.nama) + '</span></div>' +
        '<div class="riwayat-info">Sewa ' + RO.rupiah(p.sewa) + ' · ulang bulan tgl ' + esc(p.tglUlangBulan) +
        (p.aktif === false ? ' · <b>tidak aktif</b>' : '') +
        (sa && sa.pokokTertunggak > 0 ? ' · posisi awal ' + RO.rupiah(sa.pokokTertunggak) : '') +
        '</div></button>';
    });
    isi += '<button type="button" class="tbl garis" data-aksi="edit-penghuni" data-id="">➕ Tambah penghuni</button>';

    isi += '<h2 class="judul-bagian">Pembebasan denda</h2>' +
      '<div class="kartu"><div class="kartu-isi sunyi">' +
      'Denda dibebaskan per penghuni per bulan. Buka <b>Beranda → ketuk baris kamar</b>, lalu tekan <b>Bebaskan</b> pada bulan yang dituju. ' +
      'Saat ini ada <b>' + db.waive.length + '</b> denda yang dibebaskan.' +
      '</div></div>';

    isi += '<h2 class="judul-bagian">Cadangan data</h2>' +
      '<div class="kartu"><div class="kartu-isi">' +
      '<p class="petunjuk">Data hanya tersimpan di peramban HP ini. Kalau riwayat peramban dibersihkan atau HP berganti, data bisa hilang. ' +
      'Ekspor rutin, lalu simpan berkasnya di WhatsApp atau surel sendiri.</p>' +
      '<button type="button" class="tbl" data-aksi="ekspor">⬇️ Ekspor data (JSON)</button>' +
      '<button type="button" class="tbl garis" data-aksi="impor">⬆️ Impor data (JSON)</button>' +
      '</div></div>';

    isi += '<h2 class="judul-bagian">Penghalusan pesan (opsional)</h2>' +
      '<div class="kartu"><div class="kartu-isi"><form id="formApi">' +
      '<label class="isian"><span class="nama-isian">Kunci API</span>' +
      '<input type="password" id="aApi" autocomplete="off" value="' + esc(st.kunciApi || '') + '" placeholder="kosongkan bila tidak dipakai"></label>' +
      '<p class="petunjuk">Opsional. Bila diisi, draft pesan dihaluskan otomatis. Kunci disimpan hanya di perangkat ini. ' +
      'Aplikasi berfungsi penuh tanpa kunci ini — draft memakai template.</p>' +
      '<button type="submit" class="tbl garis">Simpan kunci</button>' +
      '</form></div></div>';

    isi += '<h2 class="judul-bagian">Muat ulang data</h2>' +
      '<div class="kartu"><div class="kartu-isi">' +
      '<button type="button" class="tbl abu" data-aksi="reset-contoh">🔁 Reset ke data contoh</button>' +
      '<button type="button" class="tbl merah" data-aksi="kosongkan">🗑️ Kosongkan semua data</button>' +
      '</div></div>';

    el('tab-atur').innerHTML = isi;
  }

  /* ---------------- Form penghuni ---------------- */

  function riwayatSewaHtml(p) {
    var r = p.sewaRiwayat || [];
    if (r.length < 2) return '';
    var out = '<div class="riwayat-baris"><div class="riwayat-kepala"><span>Riwayat sewa</span></div>';
    r.slice().reverse().forEach(function (x) {
      /* '2000-01-01' adalah penanda "sejak awal", jangan ditampilkan apa adanya */
      var sejak = x.sejak === '2000-01-01' ? 'sejak awal' : 'sejak ' + RO.labelTgl(RO.parseTgl(x.sejak));
      out += '<div class="riwayat-denda"><span><b>' + RO.rupiah(x.nilai) + '</b> ' +
        '<span class="sunyi">' + esc(sejak) + '</span></span>' +
        '<button type="button" data-aksi="hapus-sewa" data-id="' + esc(p.id) + '" data-sejak="' + esc(x.sejak) + '">Hapus</button>' +
        '</div>';
    });
    return out + '</div>';
  }

  function bukaEditPenghuni(id) {
    var p = id ? cariPenghuni(id) : null;
    var sa = null;
    if (p) { for (var i = 0; i < db.saldoAwal.length; i++) if (db.saldoAwal[i].penghuniId === p.id) sa = db.saldoAwal[i]; }

    var isi = '<div class="kartu"><div class="kartu-isi"><form id="formPenghuni" data-id="' + esc(id || '') + '">' +
      '<label class="isian"><span class="nama-isian">Nomor kamar (1–8)</span>' +
      '<input type="number" id="pKamar" min="1" max="99" step="1" required value="' + esc(p ? p.kamar : '') + '"></label>' +
      '<label class="isian"><span class="nama-isian">Nama</span>' +
      '<input type="text" id="pNama" required value="' + esc(p ? p.nama : '') + '"></label>' +
      '<label class="isian"><span class="nama-isian">Tanggal ulang bulan (1–31)</span>' +
      '<input type="number" id="pUlang" min="1" max="31" step="1" required value="' + esc(p ? p.tglUlangBulan : '') + '"></label>' +
      '<p class="petunjuk">Kalau tanggalnya 29, 30, atau 31, pada bulan pendek otomatis mundur ke hari terakhir bulan itu.</p>' +
      '<label class="isian"><span class="nama-isian">Sewa per bulan</span>' +
      '<input type="text" inputmode="numeric" id="pSewa" data-uang required value="' + esc(p ? titik(p.sewa) : '') + '"></label>' +
      (p ? '<label class="isian"><span class="nama-isian">Kalau sewa diubah, berlaku mulai bulan</span>' +
        '<input type="month" id="pSewaMulai" value="' + esc(RO.kodeBulan(new Date(kini.getFullYear(), kini.getMonth() + 1, 1))) + '"></label>' +
        '<p class="petunjuk">Bulan-bulan sebelumnya tetap memakai sewa lama, jadi riwayat yang sudah lunas tidak ikut berubah.</p>' +
        riwayatSewaHtml(p) : '') +
      '<label class="isian"><span class="nama-isian">Nomor WhatsApp</span>' +
      '<input type="tel" id="pWA" placeholder="08xxxxxxxxxx" value="' + esc(p ? p.noWA : '') + '"></label>' +
      '<label class="centang"><input type="checkbox" id="pAktif"' + (!p || p.aktif !== false ? ' checked' : '') + '>' +
      '<span>Masih menghuni (tampil di daftar kamar)</span></label>' +

      '<hr class="pemisah">' +
      '<h2 class="judul-bagian" style="margin-top:0">Posisi awal</h2>' +
      '<p class="petunjuk">Tunggakan sebelum sistem dipakai. Denda masa lalu selalu dianggap <b>nol</b> dan dihapus seluruhnya.</p>' +
      '<label class="isian"><span class="nama-isian">Bulan tertunggak</span>' +
      '<input type="number" id="sBulan" min="0" max="60" step="1" value="' + esc(sa ? sa.bulanTertunggak : 0) + '"></label>' +
      '<label class="isian"><span class="nama-isian">Pokok tertunggak</span>' +
      '<input type="text" inputmode="numeric" id="sPokok" data-uang value="' + esc(sa ? titik(sa.pokokTertunggak) : '') + '"></label>' +
      '<label class="isian"><span class="nama-isian">Sejak bulan</span>' +
      '<input type="text" id="sSejak" placeholder="2026-03" value="' + esc(sa ? sa.sejakBulan : '') + '"></label>' +

      '<button type="submit" class="tbl">Simpan</button>' +
      '</form>' +
      (p ? '<button type="button" class="tbl merah" data-aksi="hapus-penghuni" data-id="' + esc(p.id) + '">Hapus penghuni ini</button>' : '') +
      '</div></div>';

    bukaLapis(p ? 'Ubah — ' + p.nama : 'Tambah penghuni', isi);
  }

  /* ---------------- Ekspor / Impor ---------------- */

  function bukaEkspor() {
    var teks = JSON.stringify(db, null, 2);
    var nama = 'rumah-opung-' + RO.fmtTgl(kini) + '.json';
    var tautanUnduh = '';
    try {
      var blob = new Blob([teks], { type: 'application/json' });
      tautanUnduh = URL.createObjectURL(blob);
    } catch (e) { tautanUnduh = ''; }

    var isi = '<div class="kartu"><div class="kartu-isi">' +
      '<p class="petunjuk">Simpan berkas ini di tempat yang aman. Untuk memulihkan, pakai tombol <b>Impor data</b>.</p>' +
      (tautanUnduh ? '<a class="tbl" href="' + tautanUnduh + '" download="' + nama + '">⬇️ Unduh ' + nama + '</a>' : '') +
      '<button type="button" class="tbl garis" data-aksi="salin-ekspor">📋 Salin isinya</button>' +
      '<textarea id="teksEkspor" rows="10" readonly>' + esc(teks) + '</textarea>' +
      '</div></div>';
    bukaLapis('Ekspor data', isi);
  }

  function bukaImpor() {
    var isi = '<div class="kartu"><div class="kartu-isi">' +
      '<p class="petunjuk">Impor akan <b>mengganti seluruh data</b> yang ada di perangkat ini. Sebaiknya ekspor dulu sebelum mengimpor.</p>' +
      '<label class="isian"><span class="nama-isian">Pilih berkas JSON</span>' +
      '<input type="file" id="berkasImpor" accept="application/json,.json"></label>' +
      '<label class="isian"><span class="nama-isian">Atau tempel isinya di sini</span>' +
      '<textarea id="teksImpor" rows="8" placeholder="tempel isi berkas JSON"></textarea></label>' +
      '<button type="button" class="tbl" data-aksi="impor-jalan">Impor sekarang</button>' +
      '</div></div>';
    bukaLapis('Impor data', isi);
  }

  function jalankanImpor(teks) {
    var baru;
    try { baru = JSON.parse(teks); }
    catch (e) { toast('Berkas tidak terbaca. Pastikan isinya berkas ekspor Rumah Opung.'); return; }
    if (!baru || typeof baru !== 'object' || !Array.isArray(baru.penghuni)) {
      toast('Isi berkas tidak cocok. Pastikan itu berkas ekspor Rumah Opung.');
      return;
    }
    if (!window.confirm('Ganti seluruh data di perangkat ini dengan isi berkas tadi?')) return;
    db = RO.rapikanDb(baru, kini);
    RO.simpan(db);
    tutupLapis();
    saring = null;
    gambar();
    toast('Data berhasil diimpor.');
  }

  /* ==========================================================
     Gambar utama & navigasi
     ========================================================== */

  function gambar() {
    kini = RO.hariIni();
    document.title = db.pengaturan.namaKos + ' — Papan Kendali';
    el('judulKos').textContent = db.pengaturan.namaKos;
    el('tanggalHariIni').textContent = 'Hari ini ' + RO.labelTglPanjang(kini);

    ['beranda', 'catat', 'atur'].forEach(function (n) {
      el('tab-' + n).hidden = (n !== tab);
    });
    var tombol = document.querySelectorAll('#navBawah .nav-tombol');
    for (var i = 0; i < tombol.length; i++) {
      tombol[i].classList.toggle('aktif', tombol[i].getAttribute('data-tab') === tab);
    }

    if (tab === 'beranda') gambarBeranda();
    else if (tab === 'catat') gambarCatat();
    else gambarAtur();
  }

  /* ==========================================================
     Penangan kejadian
     ========================================================== */

  var AKSI = {
    saring: function (t) {
      var nilai = t.getAttribute('data-nilai');
      saring = (saring === nilai) ? null : nilai;
      gambar();
    },
    detail: function (t) { bukaDetail(t.getAttribute('data-id')); },
    tagih: function (t) { bukaTagih(t.getAttribute('data-id')); },
    kartu: function (t) { bukaKartu(t.getAttribute('data-id')); },
    verifikasi: function (t) { bukaVerifikasi(t.getAttribute('data-id')); },

    setuju: function (t) {
      var b = cariPembayaran(t.getAttribute('data-id'));
      if (!b) return;
      b.status = 'disetujui';
      b.alasanTolak = '';
      RO.simpan(db);
      lanjutSetelahVerifikasi();
      gambar();
      toast('Pembayaran disetujui.');
    },

    'tolak-buka': function () {
      var k = el('kotakTolak');
      if (k) { k.hidden = false; var a = el('alasanTolak'); if (a) a.focus(); }
    },

    'tolak-simpan': function (t) {
      var b = cariPembayaran(t.getAttribute('data-id'));
      if (!b) return;
      var a = el('alasanTolak');
      b.status = 'ditolak';
      b.alasanTolak = a ? a.value.trim() : '';
      RO.simpan(db);
      lanjutSetelahVerifikasi();
      gambar();
      toast('Pembayaran ditolak.');
    },

    'hapus-bayar': function (t) {
      if (!window.confirm('Hapus catatan pembayaran ini?')) return;
      var id = t.getAttribute('data-id');
      db.pembayaran = db.pembayaran.filter(function (b) { return b.id !== id; });
      RO.simpan(db);
      tutupLapis();
      gambar();
      toast('Catatan dihapus.');
    },

    waive: function (t) {
      var id = t.getAttribute('data-id');
      var bulan = t.getAttribute('data-bulan');
      var k = RO.kunciWaive(id, bulan);
      var i = db.waive.indexOf(k);
      if (i >= 0) db.waive.splice(i, 1); else db.waive.push(k);
      RO.simpan(db);
      bukaDetail(id);
      gambar();
      toast(i >= 0 ? 'Denda diaktifkan lagi.' : 'Denda dibebaskan.');
    },

    'salin-pesan': function () { var e = el('teksPesan'); if (e) salin(e.value); },
    'salin-tautan': function () { var e = el('teksTautan'); if (e) salin(e.value); },
    'salin-ekspor': function () { var e = el('teksEkspor'); if (e) salin(e.value); },

    'buka-wa': function (t, ev) {
      ev.preventDefault();
      var p = cariPenghuni(t.getAttribute('data-id'));
      var e = el('teksPesan');
      if (!p || !e) return;
      /* Membuka WhatsApp = benar-benar menagih, jadi langsung dicatat.
         Kalau tidak begini, catatannya bergantung pada ingatan pemilik. */
      p.terakhirDitagih = RO.fmtTgl(kini);
      var c = el('kCatatan');
      if (c) p.catatan = c.value.trim();
      RO.simpan(db);
      window.open(RO.tautanWA(p.noWA, e.value), '_blank');
      bukaTagih(p.id);
      gambar();
      toast('Dicatat: ditagih hari ini.');
    },

    'kontak-hari-ini': function () {
      var d = el('kTanggal');
      if (d) d.value = RO.fmtTgl(kini);
    },

    'simpan-kontak': function (t) {
      var p = cariPenghuni(t.getAttribute('data-id'));
      if (!p) return;
      var d = el('kTanggal');
      var c = el('kCatatan');
      var nilai = d ? d.value : '';
      p.terakhirDitagih = /^\d{4}-\d{2}-\d{2}$/.test(nilai) ? nilai : '';
      p.catatan = c ? c.value.trim() : '';
      RO.simpan(db);
      gambar();
      toast('Catatan penagihan disimpan.');
    },

    'edit-penghuni': function (t) { bukaEditPenghuni(t.getAttribute('data-id')); },

    'hapus-penghuni': function (t) {
      var id = t.getAttribute('data-id');
      var p = cariPenghuni(id);
      if (!p) return;
      if (!window.confirm('Hapus ' + p.nama + ' beserta seluruh catatan pembayarannya?')) return;
      db.penghuni = db.penghuni.filter(function (x) { return x.id !== id; });
      db.saldoAwal = db.saldoAwal.filter(function (x) { return x.penghuniId !== id; });
      db.pembayaran = db.pembayaran.filter(function (x) { return x.penghuniId !== id; });
      db.waive = db.waive.filter(function (x) { return x.split('|')[0] !== id; });
      RO.simpan(db);
      tutupLapis();
      gambar();
      toast('Penghuni dihapus.');
    },

    'hapus-sewa': function (t) {
      var id = t.getAttribute('data-id');
      var sejak = t.getAttribute('data-sejak');
      var p = cariPenghuni(id);
      if (!p || !p.sewaRiwayat || p.sewaRiwayat.length < 2) return;
      if (!window.confirm('Hapus tarif sewa ini dari riwayat? Bulan yang memakainya akan dihitung ulang dengan tarif sebelumnya.')) return;
      p.sewaRiwayat = p.sewaRiwayat.filter(function (x) { return x.sejak !== sejak; });
      p.sewa = p.sewaRiwayat[p.sewaRiwayat.length - 1].nilai;
      RO.simpan(db);
      bukaEditPenghuni(id);
      gambar();
      toast('Tarif dihapus dari riwayat sewa.');
    },

    ekspor: function () { bukaEkspor(); },
    impor: function () { bukaImpor(); },

    'impor-jalan': function () {
      var berkas = el('berkasImpor');
      var teks = el('teksImpor');
      if (berkas && berkas.files && berkas.files[0]) {
        var fr = new FileReader();
        fr.onload = function () { jalankanImpor(String(fr.result)); };
        fr.onerror = function () { toast('Berkas tidak bisa dibaca.'); };
        fr.readAsText(berkas.files[0]);
      } else if (teks && teks.value.trim()) {
        jalankanImpor(teks.value.trim());
      } else {
        toast('Pilih berkas atau tempel isinya dulu.');
      }
    },

    'reset-contoh': function () {
      if (!window.confirm('Ganti seluruh data dengan data contoh 8 penghuni?')) return;
      db = RO.dataContoh(RO.hariIni());
      RO.simpan(db);
      saring = null;
      tab = 'beranda';
      gambar();
      toast('Data contoh dimuat.');
    },

    kosongkan: function () {
      if (!window.confirm('Kosongkan SEMUA data? Tindakan ini tidak bisa dibatalkan.')) return;
      if (!window.confirm('Yakin? Sebaiknya ekspor dulu sebagai cadangan.')) return;
      db = RO.dbKosong(RO.hariIni());
      RO.simpan(db);
      saring = null;
      tab = 'beranda';
      gambar();
      toast('Semua data dikosongkan.');
    }
  };

  function pasangKejadian() {
    document.addEventListener('click', function (ev) {
      var nav = ev.target.closest ? ev.target.closest('#navBawah .nav-tombol') : null;
      if (nav) {
        tab = nav.getAttribute('data-tab');
        saring = null;
        gambar();
        window.scrollTo(0, 0);
        return;
      }
      var t = ev.target.closest ? ev.target.closest('[data-aksi]') : null;
      if (t && AKSI[t.getAttribute('data-aksi')]) {
        AKSI[t.getAttribute('data-aksi')](t, ev);
      }
    });

    el('lapisTutup').addEventListener('click', tutupLapis);
    el('lapis').addEventListener('click', function (ev) {
      if (ev.target === el('lapis')) tutupLapis();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && lapisTerbuka()) tutupLapis();
    });

    /* Format otomatis isian uang */
    document.addEventListener('input', function (ev) {
      var t = ev.target;
      if (!t || !t.hasAttribute || !t.hasAttribute('data-uang')) return;
      var angka = t.value.replace(/[^0-9]/g, '');
      t.value = angka ? titik(Number(angka)) : '';
      if (t.id === 'cJumlah') {
        var pv = el('cPratinjau');
        if (pv) pv.textContent = RO.rupiah(Number(angka || 0));
      }
    });

    /* Semua form ditangani di satu tempat */
    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (f.id === 'formCatat') { ev.preventDefault(); simpanCatat(); }
      else if (f.id === 'formAturan') { ev.preventDefault(); simpanAturan(); }
      else if (f.id === 'formPenghuni') { ev.preventDefault(); simpanPenghuni(f.getAttribute('data-id')); }
      else if (f.id === 'formApi') { ev.preventDefault(); simpanApi(); }
    });
  }

  function bacaUang(id) {
    var e = el(id);
    if (!e) return 0;
    return Number(String(e.value).replace(/[^0-9]/g, '')) || 0;
  }

  function simpanCatat() {
    var idP = el('cPenghuni').value;
    var tanggal = el('cTanggal').value;
    var jumlah = bacaUang('cJumlah');
    if (!idP) { toast('Pilih penghuni dulu.'); return; }
    if (!tanggal) { toast('Isi tanggal bayarnya.'); return; }
    if (jumlah <= 0) { toast('Jumlah harus lebih dari nol.'); return; }
    db.pembayaran.push({
      id: idBaru('b', db.pembayaran),
      penghuniId: idP,
      tanggalBayar: tanggal,
      jumlah: jumlah,
      catatanBukti: el('cBukti').value.trim(),
      status: 'menunggu',
      alasanTolak: ''
    });
    RO.simpan(db);
    tab = 'beranda';
    saring = 'verifikasi';
    gambar();
    window.scrollTo(0, 0);
    toast('Masuk antrean. Tinggal diverifikasi.');
  }

  function simpanAturan() {
    var st = db.pengaturan;
    st.namaKos = el('aNama').value.trim() || 'Rumah Opung';
    var dendaBaru = bacaUang('aDenda');
    if (dendaBaru > 0 && dendaBaru !== st.dendaTetap) {
      var hari = RO.fmtTgl(kini);
      st.dendaRiwayat = st.dendaRiwayat.filter(function (x) { return x.sejak !== hari; });
      st.dendaRiwayat.push({ sejak: hari, nilai: dendaBaru });
      st.dendaRiwayat.sort(function (a, b) { return a.sejak < b.sejak ? -1 : 1; });
      st.dendaTetap = dendaBaru;
    }
    var tenggat = parseInt(el('aTenggat').value, 10);
    if (!isNaN(tenggat) && tenggat >= 0) st.tenggatHari = tenggat;
    var potong = el('aPotong').value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(potong)) st.tanggalPotong = potong;
    simpanDanGambar();
    toast('Aturan disimpan.');
  }

  function simpanApi() {
    db.pengaturan.kunciApi = el('aApi').value.trim();
    RO.simpan(db);
    toast(db.pengaturan.kunciApi
      ? 'Kunci disimpan di perangkat ini. Penghalusan otomatis belum aktif di versi ini.'
      : 'Kunci dikosongkan. Draft memakai template.');
  }

  function simpanPenghuni(id) {
    var kamar = parseInt(el('pKamar').value, 10);
    var nama = el('pNama').value.trim();
    var ulang = parseInt(el('pUlang').value, 10);
    var sewa = bacaUang('pSewa');
    if (!nama) { toast('Nama belum diisi.'); return; }
    if (isNaN(kamar) || kamar < 1) { toast('Nomor kamar tidak sah.'); return; }
    if (isNaN(ulang) || ulang < 1 || ulang > 31) { toast('Tanggal ulang bulan harus 1 sampai 31.'); return; }
    if (sewa <= 0) { toast('Sewa harus lebih dari nol.'); return; }

    var p = id ? cariPenghuni(id) : null;
    if (!p) {
      p = { id: idBaru('p', db.penghuni) };
      db.penghuni.push(p);
    }
    p.kamar = kamar;
    p.nama = nama;
    p.tglUlangBulan = ulang;

    /* Perubahan sewa hanya berlaku ke depan. Tarif lama tetap dipakai untuk
       bulan-bulan sebelum tanggal berlakunya, supaya riwayat tidak bergeser. */
    if (!p.sewaRiwayat || !p.sewaRiwayat.length) {
      p.sewaRiwayat = [{ sejak: '2000-01-01', nilai: sewa }];
    } else if (sewa !== p.sewaRiwayat[p.sewaRiwayat.length - 1].nilai) {
      var eMulai = el('pSewaMulai');
      var mulai = eMulai ? eMulai.value : '';
      var sejak = /^\d{4}-\d{2}$/.test(mulai) ? mulai + '-01' : RO.fmtTgl(kini);
      p.sewaRiwayat = p.sewaRiwayat.filter(function (x) { return x.sejak !== sejak; });
      p.sewaRiwayat.push({ sejak: sejak, nilai: sewa });
      p.sewaRiwayat.sort(function (a, b) { return a.sejak < b.sejak ? -1 : 1; });
    }
    p.sewa = p.sewaRiwayat[p.sewaRiwayat.length - 1].nilai;

    p.noWA = el('pWA').value.trim();
    p.aktif = el('pAktif').checked;

    /* Posisi awal (F8) */
    var sBulan = parseInt(el('sBulan').value, 10) || 0;
    var sPokok = bacaUang('sPokok');
    var sSejak = el('sSejak').value.trim();
    db.saldoAwal = db.saldoAwal.filter(function (x) { return x.penghuniId !== p.id; });
    if (sPokok > 0) {
      db.saldoAwal.push({
        penghuniId: p.id,
        bulanTertunggak: sBulan,
        pokokTertunggak: sPokok,
        sejakBulan: /^\d{4}-\d{2}$/.test(sSejak) ? sSejak : ''
      });
    }

    RO.simpan(db);
    tutupLapis();
    gambar();
    toast('Data penghuni disimpan.');
  }

  /* ==========================================================
     Titik masuk
     ========================================================== */

  RO.mulaiPapanKendali = function () {
    kini = RO.hariIni();
    db = RO.muat();
    if (!db) {
      db = RO.dataContoh(kini);
      RO.simpan(db);
    }
    pasangKejadian();
    gambar();
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RO;
