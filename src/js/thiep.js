/*
 * Các chức năng của thiệp (mẫu Minimalism Nâu): màn mở thiệp, nhạc nền, album 3D + xem ảnh lớn,
 * xác nhận tham dự, sổ lưu bút, hộp quà mừng cưới.
 * Cấu hình được build.js đưa vào window.THIEP từ noi-dung.md.
 */
(function () {
  'use strict';
  var CFG = window.THIEP || {};
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------------- thông báo nhỏ */
  var tb = document.createElement('div');
  tb.className = 'thong-bao';
  document.body.appendChild(tb);
  function thongBao(chu) {
    tb.textContent = chu;
    tb.classList.add('hien');
    clearTimeout(thongBao.hen);
    thongBao.hen = setTimeout(function () { tb.classList.remove('hien'); }, 2600);
  }

  /* ---------------------------------------------------------------- tên khách mời */
  // Link dài (?khach=) đọc từ địa chỉ; link ngắn thì máy chủ đã chèn tên vào [data-khach-moi]
  function tenKhachMoi() {
    var p = new URLSearchParams(location.search);
    var tuLink = (p.get('khach') || p.get('guest-name') || '').trim();
    if (tuLink) return tuLink;
    var el = document.querySelector('[data-khach-moi]');
    var t = el ? el.textContent.trim() : '';
    return t && t !== (CFG.khachMacDinh || '') ? t : '';
  }
  var khach = tenKhachMoi();
  if (khach) document.querySelectorAll('[data-khach-moi]').forEach(function (el) { el.textContent = khach; });

  /* ---------------------------------------------------------------- co chữ tự động theo khung (như mẫu) */
  // Tên cô dâu/chú rể: cơ sở 31px (điện thoại) / 46px (từ 768px trở lên), co lại nếu tên dài hơn 80% bề rộng thẻ.
  // Tên bố mẹ: 12px / 13px. Hai tên của một cặp dùng chung cỡ nhỏ nhất. (Thuật toán lấy từ hook co chữ của mẫu.)
  function doRong(chu, co, kieu) {
    var sp = document.createElement('span');
    sp.style.cssText = 'visibility:hidden;position:absolute;white-space:nowrap;font-size:' + co + 'px;font-family:' + kieu.fontFamily
      + ';font-weight:' + kieu.fontWeight + ';letter-spacing:' + kieu.letterSpacing;
    sp.textContent = chu;
    document.body.appendChild(sp);
    var w = sp.offsetWidth;
    document.body.removeChild(sp);
    return w;
  }
  function coVuaKhung(el, khung, coMay, coPc, toiThieu) {
    var cs = getComputedStyle(el);
    if (!khung) return null;
    var co = window.innerWidth >= 768 ? coPc : coMay;
    var min = toiThieu || Math.max(12, 0.5 * co);
    var chu = el.textContent.trim();
    var kieu = { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing };
    var w = doRong(chu, co, kieu);
    var x = co;
    if (w > khung) {
      x = Math.max(min, Math.min(co, khung / w * co * 0.95));
      var b = Math.round(x);
      var y = doRong(chu, b, kieu);
      if (y > khung && b > min) { b = Math.max(min, Math.round(khung / y * b * 0.95)); y = doRong(chu, b, kieu); }
      while (b > min && doRong(chu, b, kieu) > khung) b -= 1;
      x = b;
    }
    return x;
  }
  function coChu() {
    var ten = [].slice.call(document.querySelectorAll('[data-fit-ten]'));
    var cs = ten.map(function (el) { return coVuaKhung(el, el.offsetWidth, 31, 46, 15.5); }).filter(function (v) { return v; });
    if (cs.length) {
      var m = Math.min.apply(null, cs);
      ten.forEach(function (el) { el.style.fontSize = m + 'px'; });
    }
    var tran = window.innerWidth >= 768 ? 13 : 12;
    document.querySelectorAll('[data-fit-bome]').forEach(function (el) {
      var v = coVuaKhung(el, el.parentNode.clientWidth, 12, 13, 12);
      el.style.fontSize = (v ? Math.min(v, tran) : tran) + 'px';
    });
  }
  var henCo = null;
  window.addEventListener('resize', function () { clearTimeout(henCo); henCo = setTimeout(coChu, 60); });
  coChu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(coChu);

/* ---------------------------------------------------------------- tự động cuộn trang (giống mẫu) */
  // Port từ mã của mẫu: sau khi mở thiệp 2 giây, trang tự cuộn xuống 50px/giây (đổi bằng ?scroll=N). Mỗi khung hình
  // đặt vị trí cuộn = (thời gian trôi) × tốc độ. Dừng khi khách lăn chuột (≥50px) / chạm màn hình / bấm hay gõ vào ô nhập;
  // bấm vào chỗ trống của thiệp để dừng hoặc chạy tiếp (bấm vào ảnh, nút, link thì chỉ dừng). Tự kết thúc ở cuối trang.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  var tuCuon = (function () {
    var tocDo = parseInt(new URLSearchParams(location.search).get('scroll'), 10);
    if (!(tocDo > 0)) tocDo = 50;
    var giamChuyenDongCuon = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var daMoThiep = !$('man-mo'); // không có màn mở thiệp thì coi như đã mở
    var chay = false;      // vòng cuộn đang hoạt động
    var ketThuc = false;   // đã tới cuối trang / bị huỷ
    var tamDungCuon = false;
    var dangNhap = false;
    var moc = null;        // thời điểm quy chiếu cho vị trí 0
    var raf = null;
    var hen = null;
    var tichLuy = 0;
    var luc = 0;           // lần cuối rời ô nhập (chống bấm đúp 400ms)

    function khung(t) {
      if (ketThuc) return;
      if (tamDungCuon) { raf = requestAnimationFrame(khung); return; }
      if (moc === null) moc = t;
      var y = (t - moc) / 1000 * tocDo;
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) > 2) { document.documentElement.scrollTop = y; document.body.scrollTop = y; }
      var cao = window.innerHeight;
      var tong = document.documentElement.scrollHeight;
      if ((window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) + cao >= tong - 10) { ketThuc = true; return; }
      raf = requestAnimationFrame(khung);
    }
    function batDau() {
      if (chay || giamChuyenDongCuon) return;
      chay = true;
      hen = setTimeout(function () { if (!ketThuc) raf = requestAnimationFrame(khung); }, 2000);
    }
    function dung() { if (!tamDungCuon && !ketThuc) tamDungCuon = true; }
    function tiep() {
      if (!tamDungCuon || ketThuc) return;
      var vt = (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) / tocDo * 1000;
      moc = performance.now() - vt;
      tamDungCuon = false;
    }
    var laONhap = function (e) { return e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable="true"]'); };
    var biDung = false; // trạng thái "đã dừng do khách" (isPaused của mẫu)
    window.addEventListener('wheel', function (e) {
      if (!daMoThiep || biDung || dangNhap) return;
      tichLuy += Math.abs(e.deltaY);
      if (tichLuy >= 50) { dung(); biDung = true; }
    }, { passive: true });
    window.addEventListener('touchstart', function () { if (daMoThiep && !biDung && !dangNhap) { dung(); biDung = true; } }, { passive: true });
    function vaoONhap(e) { if (laONhap(e)) { dung(); dangNhap = true; biDung = true; } }
    window.addEventListener('focusin', vaoONhap, { passive: true });
    window.addEventListener('mousedown', vaoONhap, { passive: true });
    window.addEventListener('focusout', function () {
      if (!dangNhap) return;
      setTimeout(function () {
        var a = document.activeElement;
        if (a && a.matches && a.matches('input, textarea, select, [contenteditable="true"]')) return;
        luc = Date.now();
        dangNhap = false;
      }, 0);
    }, { passive: true });
    // bấm vào thiệp: chỗ trống = dừng/chạy tiếp; ảnh, nút, link, popup... = chỉ dừng
    var thiepEl = document.querySelector('main') && document.querySelector('main').closest('.cursor-pointer');
    if (thiepEl) thiepEl.addEventListener('click', function (e) {
      if (!daMoThiep) return;
      var t = e.target;
      var tuongTac = t.closest('img, button, a, input, textarea, select, video, audio, dialog, [role="menu"], [role="menuitem"], [role="listbox"], [role="option"], [role="dialog"], [role="alertdialog"], .modal, .dropdown-menu, [data-dropdown], [data-modal]');
      if (laONhap(e)) { if (!dangNhap) { dung(); dangNhap = true; biDung = true; } return; }
      if (tuongTac) { if (!biDung && !dangNhap) { dung(); biDung = true; } return; }
      if (!dangNhap && !(Date.now() - luc < 400)) {
        if (biDung) { tiep(); biDung = false; tichLuy = 0; } else { dung(); biDung = true; }
      }
    });
    return { mo: function () { daMoThiep = true; batDau(); }, daMo: function () { return daMoThiep; }, batDau: batDau };
  })();
  if (!$('man-mo')) tuCuon.batDau();

  /* ---------------------------------------------------------------- nhạc nền */
  var audio = $('myAudio');
  var nutNhac = $('nut-nhac');
  var nutLoa = $('toggleMusic');
  var goiYNhac = $('nhac-goi-y');
  var nguoiDungTat = false; // khách chủ động tắt thì không tự bật lại
  var daThuTuPhat = false;
  var CU_CHI = ['click', 'touchstart', 'touchend', 'keydown'];
  function capNhatNutNhac() {
    var phat = !audio.paused;
    nutNhac.classList.toggle('dang-phat', phat);
    nutNhac.classList.toggle('dang-dung', !phat);
    nutLoa.setAttribute('aria-label', phat ? 'Tạm dừng nhạc' : 'Phát nhạc');
    if (phat) { nutNhac.classList.remove('bi-chan'); goiYNhac.hidden = true; }
  }
  // Trình duyệt chặn phát nhạc có tiếng cho tới khi có cử chỉ thật: hiện vòng lan + bong bóng "Chạm để phát nhạc" 5 giây
  // (y như mẫu), rồi lần chạm/bấm đầu tiên sẽ phát.
  var henGoiY = null;
  function biChan() {
    nutNhac.classList.add('bi-chan');
    goiYNhac.hidden = false;
    clearTimeout(henGoiY);
    henGoiY = setTimeout(function () { goiYNhac.hidden = true; }, 5000);
  }
  function thuPhat() {
    if (nguoiDungTat) return Promise.resolve(false);
    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    if (!p || !p.then) return Promise.resolve(true);
    return p.then(function () { return true; }, function () { biChan(); return false; });
  }
  function tuPhatNhac(e) {
    if (nguoiDungTat || daThuTuPhat || (e && nutNhac.contains(e.target))) return;
    if (!audio.paused) { goLangNghe(); return; }
    daThuTuPhat = true;
    thuPhat().then(function (ok) { if (ok) goLangNghe(); else daThuTuPhat = false; });
  }
  function goLangNghe() {
    CU_CHI.forEach(function (ev) { document.removeEventListener(ev, tuPhatNhac, true); });
  }
  function batLangNghe() {
    CU_CHI.forEach(function (ev) { document.addEventListener(ev, tuPhatNhac, true); });
  }
  audio.addEventListener('play', capNhatNutNhac);
  audio.addEventListener('pause', capNhatNutNhac);
  capNhatNutNhac();
  nutLoa.addEventListener('click', function () {
    if (audio.paused) { nguoiDungTat = false; audio.play().catch(function () {}); }
    else { nguoiDungTat = true; audio.pause(); }
  });

  /* ---------------------------------------------------------------- màn "Mở thiệp" */
  // Chuỗi như mẫu: bấm → tiếng "ting" + nhạc nền; dấu sáp vỡ (0.5s); ở 0.5s lá bay tung toé + thẻ bay lên (0.8s);
  // ở 1.3s bỏ màn hình để lộ thiệp.
  function tiengTing() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      var e = new AC();
      var t = e.currentTime;
      var not = function (tanSo, batDau, dai, bien, lenDinh) {
        var o = e.createOscillator();
        var g = e.createGain();
        o.connect(g); g.connect(e.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(tanSo, batDau);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(bien, batDau + (lenDinh || 0.01));
        g.gain.exponentialRampToValueAtTime(0.001, batDau + dai);
        o.start(batDau); o.stop(batDau + dai);
      };
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { not(f, t + 0.1 * i, 1.8, 0.035 - 0.005 * i); });
      [1567.98, 2093].forEach(function (f, i) { not(f, t + 0.35 + 0.1 * i, 1.2, 0.015, 0.02); });
      var o = e.createOscillator();
      var g = e.createGain();
      var lp = e.createBiquadFilter();
      o.connect(lp); lp.connect(g); g.connect(e.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(261.63, t);
      lp.type = 'lowpass'; lp.frequency.value = 400;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.4);
      g.gain.setValueAtTime(0.02, t + 1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      o.start(t); o.stop(t + 2.5);
      setTimeout(function () {
        [783.99, 987.77, 1174.66, 1567.98].forEach(function (f, i) { not(f, e.currentTime + 0.06 * i, 0.6, 0.025, 0.01); });
      }, 1200);
    } catch (err) { /* không có âm thanh thì thôi */ }
  }
  var LA = '<svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"></path></svg>';
  function langBay() {
    var cha = document.createElement('div');
    cha.id = 'mm-hat-bay';
    var mau = CFG.mauHatBay || ['#c9a97e'];
    for (var i = 0; i < 32; i++) {
      var goc = 2 * Math.PI * i / 32 + (Math.random() - 0.5) * 0.4;
      var r = 25 + 60 * Math.random();
      var x = 50 + Math.cos(goc) * r;
      var y = 50 + Math.sin(goc) * r;
      var c = mau[Math.floor(Math.random() * mau.length)];
      var d = document.createElement('div');
      d.className = 'mm-hat';
      d.style.cssText = 'color:' + c + ';font-size:' + (10 + 16 * Math.random()) + 'px;text-shadow:0 0 10px ' + c
        + ';--dx:' + (x - 50) * 5 + 'px;--dy:' + (y - 50) * 5 + 'px;--rot-start:' + (Math.random() - 0.5) * 30 + 'deg;--rot-end:' + (Math.random() - 0.5) * 360
        + 'deg;animation-delay:' + 0.15 * Math.random() + 's';
      d.innerHTML = LA;
      cha.appendChild(d);
    }
    return cha;
  }
  var manMo = $('man-mo');
  if (manMo) {
    document.body.classList.add('chua-mo');
    var daMo = false;
    var theMo = $('mm-the');
    // lớp ánh sáng ở đầu thẻ, hiện khi mở
    var sang = document.createElement('div');
    sang.id = 'mm-anh-sang';
    theMo.querySelector('.overflow-hidden').appendChild(sang);
    var moThiep = function (e) {
      if (e) e.preventDefault();
      if (daMo) return;
      daMo = true;
      // cử chỉ bấm này cho phép phát nhạc
      daThuTuPhat = true;
      thuPhat().then(function (ok) { if (!ok) { daThuTuPhat = false; batLangNghe(); } });
      tiengTing();
      manMo.classList.add('dang-mo');
      // hai nhánh hoa trang trí "vụt" bay lại gần trước (nhân bản ra góc màn hình, như mẫu); thẻ bay lên sau 0,5 giây
      theMo.querySelectorAll('img[src*="flower2-decoration"]').forEach(function (g) {
        var lat = /(^|\s)-scale-x-100(\s|$)/.test(g.className);
        var lop = g.className.split(/\s+/).filter(function (c) {
          return c && !/^jsx-/.test(c) && c !== '-scale-x-100' && c !== 'object-contain' && c !== 'absolute' && c !== 'pointer-events-none';
        }).join(' ');
        var w = document.createElement('div');
        w.className = 'absolute pointer-events-none ' + lop;
        var im = document.createElement('img');
        im.src = g.src;
        im.alt = '';
        im.setAttribute('aria-hidden', 'true');
        im.className = 'pointer-events-none block h-auto max-h-full w-full object-contain';
        im.style.cssText = '--fly-scale-x:' + (lat ? -1 : 1) + ';animation:dragon-fly-forward 1.2s ease-in forwards';
        w.appendChild(im);
        theMo.parentNode.appendChild(w); // trong khối thẻ: bay lên cùng thẻ
      });
      setTimeout(function () { manMo.classList.add('bay'); }, 500);
      var vong = document.createElement('div');
      vong.id = 'mm-vong';
      theMo.appendChild(vong);
      setTimeout(function () { manMo.appendChild(langBay()); }, 500);
      setTimeout(function () {
        document.body.classList.remove('chua-mo');
        window.scrollTo(0, 0);
        if (manMo.parentNode) manMo.parentNode.removeChild(manMo);
        tuCuon.mo(); // thiệp đã mở → 2 giây sau bắt đầu tự cuộn
      }, 1300);
    };
    $('mm-nut').addEventListener('click', moThiep);
    $('mm-nut').addEventListener('keydown', function (e) { if (e.key === ' ') moThiep(e); });
  } else {
    batLangNghe();
    tuPhatNhac();
  }

  /* ---------------------------------------------------------------- album 3D (giống mẫu) */
  // Công thức của mẫu: ảnh cách ảnh đang xem l bước (l âm = bên trái) → dịch ngang 60%·l, lùi sâu 150px·|l|, xoay 45°·l,
  // thu nhỏ max(0.7, 1-0.15|l|), mờ max(0.3, 1-0.25|l|). Tự chuyển ảnh mỗi 1,4 giây khi đang nằm trong màn hình;
  // dừng khi rê chuột vào hoặc vừa chạm/vuốt (6 giây).
  var xemAnh = $('xem-anh');
  var album = $('album');
  var anhAlbum = album ? [].slice.call(album.querySelectorAll('[data-album-anh]')) : [];
  var dangXem = 0;
  var trongManHinh = false;
  var tamDung = false;
  var henTamDung = null;
  var cham = null;
  var giamChuyenDong = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function viTri(i) {
    var n = anhAlbum.length;
    var l = i - dangXem;
    l = l > n / 2 ? l - n : l < -n / 2 ? l + n : l;
    var o = Math.abs(l);
    return {
      l: l,
      transform: 'translateX(' + 60 * l + '%) translateZ(' + -(150 * o) + 'px) rotateY(' + 45 * l + 'deg) scale(' + Math.max(0.7, 1 - 0.15 * o) + ')',
      opacity: Math.max(0.3, 1 - 0.25 * o),
      zIndex: 100 - o,
    };
  }
  function veAlbum() {
    var n = anhAlbum.length;
    anhAlbum.forEach(function (el, i) {
      var v = viTri(i);
      el.style.transform = v.transform;
      el.style.opacity = v.opacity;
      el.style.zIndex = v.zIndex;
      el.classList.toggle('dang-xem', v.l === 0);
    });
    if (cham) {
      [].forEach.call(cham.children, function (b, k) {
        b.className = 'rounded-full transition-all duration-300 ' + (k === dangXem ? 'w-6 h-2 bg-current opacity-70' : 'w-2 h-2 bg-current opacity-25 hover:opacity-40');
      });
    } else {
      var dem = $('album-dem');
      if (dem) dem.textContent = (dangXem + 1) + ' / ' + n;
    }
  }
  function denAnh(i) {
    var n = anhAlbum.length;
    dangXem = ((i % n) + n) % n;
    veAlbum();
  }
  function tamDungAlbum() {
    tamDung = true;
    clearTimeout(henTamDung);
    henTamDung = setTimeout(function () { tamDung = false; }, 6000);
  }
  if (anhAlbum.length) {
    // chỉ số: ≤ 7 ảnh thì hiện chấm tròn, nhiều hơn thì "n / N" (như mẫu)
    var demEl = $('album-dem');
    if (anhAlbum.length <= 7 && demEl) {
      cham = document.createElement('div');
      cham.className = 'flex justify-center gap-1.5 mt-3';
      anhAlbum.forEach(function (_, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Xem ảnh ' + (k + 1));
        b.addEventListener('click', function () { denAnh(k); tamDungAlbum(); });
        cham.appendChild(b);
      });
      demEl.parentNode.parentNode.replaceChild(cham, demEl.parentNode);
    }
    veAlbum();
    var vuaVuot = false;
    anhAlbum.forEach(function (el, i) {
      el.addEventListener('click', function () {
        if (vuaVuot) return;
        if (i === dangXem) moXemAnh(i); else { denAnh(i); tamDungAlbum(); }
      });
    });
    document.querySelectorAll('[data-album]').forEach(function (b) {
      b.addEventListener('click', function () { denAnh(dangXem + (b.getAttribute('data-album') === 'truoc' ? -1 : 1)); tamDungAlbum(); });
    });
    // vuốt ngang để đổi ảnh (cảm ứng và chuột)
    var x0 = null;
    var y0 = null;
    album.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; vuaVuot = false; });
    album.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0;
      var dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        vuaVuot = true;
        denAnh(dangXem + (dx < 0 ? 1 : -1));
        tamDungAlbum();
        setTimeout(function () { vuaVuot = false; }, 50);
      }
    });
    album.addEventListener('pointercancel', function () { x0 = null; });
    var vung = album.parentNode.parentNode;
    vung.addEventListener('mouseenter', function () { clearTimeout(henTamDung); tamDung = true; });
    vung.addEventListener('mouseleave', function () { tamDung = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { trongManHinh = es[0].isIntersecting; }, { threshold: 0, rootMargin: '300px 0px' }).observe(vung);
    } else trongManHinh = true;
    if (anhAlbum.length > 1 && !giamChuyenDong) {
      setInterval(function () {
        if (trongManHinh && !tamDung && !document.hidden && !(xemAnh && xemAnh.open)) denAnh(dangXem + 1);
      }, 1400);
    }
  }

  /* ---------------------------------------------------------------- xem ảnh lớn (lightbox của mẫu) */
  var xemAnhImg = xemAnh && xemAnh.querySelector('img');
  var xemAnhNho = $('xem-anh-nho');
  var xemAnhSo = 0;
  var zoom = { scale: 1, tx: 0, ty: 0 };
  var cu = { mode: 'none', startDist: 0, startScale: 1, startTx: 0, startTy: 0, startX: 0, startY: 0, lastTap: 0, x: null, f: null };
  function moDialog(d) {
    if (!d) return;
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  function dongDialog(d) {
    if (!d) return;
    if (d.close) d.close(); else d.removeAttribute('open');
  }
  // các form đóng (modal-backdrop, nút ✕) trong dialog
  document.querySelectorAll('dialog form').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); dongDialog(f.closest('dialog')); });
  });
  function hienXemAnh(i) {
    var n = anhAlbum.length;
    xemAnhSo = ((i % n) + n) % n;
    xemAnhImg.src = anhAlbum[xemAnhSo].querySelector('img').src;
    xemAnhImg.alt = 'Ảnh cưới ' + (xemAnhSo + 1);
    $('xem-anh-dem').textContent = (xemAnhSo + 1) + ' / ' + n;
    datLaiZoom();
    var cl = 'flex-shrink-0 h-12 w-12 sm:h-16 sm:w-16 rounded-md sm:rounded-lg overflow-hidden transition-all duration-200 ';
    [].forEach.call(xemAnhNho.children, function (b, k) {
      b.className = cl + (k === xemAnhSo ? 'scale-105 shadow-lg' : 'opacity-60 hover:opacity-100');
      b.style.outline = k === xemAnhSo ? '2px solid rgb(124, 106, 96)' : '';
      b.style.outlineOffset = k === xemAnhSo ? '2px' : '';
      if (k === xemAnhSo) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    var t = xemAnhNho.children[xemAnhSo];
    if (t) xemAnhNho.scrollTo({ left: t.offsetLeft - xemAnhNho.offsetWidth / 2 + t.offsetWidth / 2, behavior: 'smooth' });
  }
  function moXemAnh(i) {
    if (!xemAnh) return;
    if (!xemAnhNho.children.length) {
      anhAlbum.forEach(function (el, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'flex-shrink-0 h-12 w-12 sm:h-16 sm:w-16 rounded-md sm:rounded-lg overflow-hidden transition-all duration-200 opacity-60 hover:opacity-100';
        b.setAttribute('aria-label', 'Xem ảnh ' + (k + 1));
        b.innerHTML = '<img alt="" class="h-full w-full object-cover" loading="lazy">';
        b.firstChild.src = el.querySelector('img').src;
        b.addEventListener('click', function (e) { e.stopPropagation(); hienXemAnh(k); });
        xemAnhNho.appendChild(b);
      });
    }
    hienXemAnh(i);
    moDialog(xemAnh);
  }
  // Hành vi lấy từ mã của mẫu: nút ‹ ›, phím ←/→, thanh ảnh nhỏ tự cuộn tới ảnh đang xem, bấm ra ngoài thì đóng;
  // trên cảm ứng: vuốt ngang ±50px đổi ảnh, hai ngón phóng 1×–4×, kéo ảnh khi đã phóng; bấm đúp (≤300ms) phóng 2.5× / thu lại.
  function veZoom() {
    xemAnhImg.style.transform = 'translate(' + zoom.tx + 'px, ' + zoom.ty + 'px) scale(' + zoom.scale + ')';
    xemAnhImg.style.transition = cu.mode === 'none' ? 'transform 0.2s ease-out' : 'none';
  }
  function datLaiZoom() { zoom = { scale: 1, tx: 0, ty: 0 }; veZoom(); }
  function keoTrongKhung(s, tx, ty) {
    var kh = xemAnhImg.parentNode;
    var mx = kh.clientWidth * (s - 1) / 2;
    var my = kh.clientHeight * (s - 1) / 2;
    return { tx: Math.max(-mx, Math.min(mx, tx)), ty: Math.max(-my, Math.min(my, ty)) };
  }
  function khoangCach(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  if (xemAnh) {
    xemAnh.querySelectorAll('[aria-label="Previous image"], [aria-label="Next image"]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); hienXemAnh(xemAnhSo + (b.getAttribute('aria-label') === 'Previous image' ? -1 : 1)); });
    });
    // bấm vào ô đếm / thanh ảnh nhỏ thì không đóng
    $('xem-anh-dem').addEventListener('click', function (e) { e.stopPropagation(); });
    xemAnhNho.addEventListener('click', function (e) { e.stopPropagation(); });
    // bấm đúp vào ảnh: phóng 2.5× hoặc thu lại
    xemAnhImg.addEventListener('click', function (e) {
      e.stopPropagation();
      var t = e.timeStamp;
      if (t - cu.lastTap < 300) zoom = zoom.scale > 1 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2.5, tx: 0, ty: 0 };
      cu.lastTap = t;
      veZoom();
    });
    // bấm ra chỗ trống thì đóng
    xemAnh.querySelector('.modal-box').addEventListener('click', function () { dongDialog(xemAnh); });
    var kh = xemAnhImg.parentNode;
    kh.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        cu.mode = 'pinch'; cu.startDist = khoangCach(e.touches); cu.startScale = zoom.scale; cu.startTx = zoom.tx; cu.startTy = zoom.ty;
      } else if (e.touches.length === 1) {
        cu.startX = e.touches[0].clientX; cu.startY = e.touches[0].clientY; cu.startTx = zoom.tx; cu.startTy = zoom.ty;
        cu.mode = zoom.scale > 1 ? 'pan' : 'swipe';
        cu.f = null; cu.x = e.touches[0].clientX;
      }
    }, { passive: true });
    kh.addEventListener('touchmove', function (e) {
      if (cu.mode === 'pinch' && e.touches.length === 2) {
        var s = Math.max(1, Math.min(4, cu.startScale * khoangCach(e.touches) / (cu.startDist || 1)));
        var p = keoTrongKhung(s, cu.startTx, cu.startTy);
        zoom = { scale: s, tx: p.tx, ty: p.ty };
        veZoom();
      } else if (cu.mode === 'pan' && e.touches.length === 1) {
        var q = keoTrongKhung(zoom.scale, cu.startTx + (e.touches[0].clientX - cu.startX), cu.startTy + (e.touches[0].clientY - cu.startY));
        zoom = { scale: zoom.scale, tx: q.tx, ty: q.ty };
        veZoom();
      } else if (cu.mode === 'swipe') cu.f = e.touches[0].clientX;
    }, { passive: true });
    kh.addEventListener('touchend', function (e) {
      if (cu.mode === 'swipe' && cu.x !== null && cu.f !== null) {
        var d = cu.x - cu.f;
        if (d > 50) hienXemAnh(xemAnhSo + 1); else if (d < -50) hienXemAnh(xemAnhSo - 1);
      }
      if (cu.mode === 'pinch' && zoom.scale <= 1.02) datLaiZoom();
      cu.x = null; cu.f = null;
      if (e.touches.length === 0) { cu.mode = 'none'; veZoom(); }
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (!xemAnh.open) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); hienXemAnh(xemAnhSo - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); hienXemAnh(xemAnhSo + 1); }
    });
    xemAnh.addEventListener('close', datLaiZoom);
  }

  /* ---------------------------------------------------------------- xác nhận tham dự (popup giống mẫu) */
  // Hành vi lấy từ mã của mẫu: popup hiện/tắt tức thì; bấm ra ngoài hoặc nút ✕ để đóng; nút gửi chỉ bật khi đã chọn đến/không đến;
  // chọn "sẽ đến" thì hiện bộ đếm số khách (− 1 +) và ô lời nhắn, chọn "không đến" chỉ hiện ô lời nhắn; gửi xong hiện màn cảm ơn.
  var xn = $('xac-nhan');
  if (xn) {
    var formXn = $('form-xac-nhan');
    var nutGuiXn = formXn.querySelector('button[type=submit]');
    var dangGuiXn = false;
    var soKhach = 1;
    var toiDa = CFG.soKhachToiDa || null; // null = không giới hạn
    var khachCoSan = !!khach;
    var chonXn = ''; // '', 'yes', 'no'
    var LOP = {
      yes: { vien: 'border-emerald-500 bg-emerald-50/50', tron: 'bg-emerald-500', bieuTuong: 'text-white', chu: 'text-emerald-700' },
      no: { vien: 'border-red-400 bg-red-50/50', tron: 'bg-red-400', bieuTuong: 'text-white', chu: 'text-red-600' },
      none: { vien: 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50', tron: 'bg-gray-200', bieuTuong: 'text-gray-500', chu: 'text-gray-700' },
    };
    function veLuaChon() {
      formXn.querySelectorAll('[data-lua-chon]').forEach(function (l) {
        var k = l.getAttribute('data-lua-chon');
        var m = chonXn === k ? LOP[k] : LOP.none;
        l.className = 'flex items-center gap-3 py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ' + m.vien;
        l.children[1].className = 'w-8 h-8 rounded-full flex items-center justify-center transition-colors ' + m.tron;
        l.children[1].firstElementChild.setAttribute('class', 'w-4 h-4 ' + m.bieuTuong);
        l.children[2].className = 'text-sm font-medium ' + m.chu;
      });
      $('xn-so-khach').hidden = chonXn !== 'yes';
      $('xn-loi-nhan').hidden = !chonXn;
      nutGuiXn.disabled = dangGuiXn || !chonXn;
    }
    function veSoKhach() {
      $('xn-so').textContent = soKhach;
      formXn.querySelector('[data-xn-them]').disabled = toiDa !== null && soKhach >= toiDa;
    }
    if (toiDa !== null) {
      var th = $('xn-toi-da');
      th.textContent = (CFG.chuToiDa || 'Tối đa {{max}} người').replace('{{max}}', toiDa);
      th.hidden = false;
    }
    var tenInput = formXn.elements.ten;
    if (khachCoSan) {
      // link riêng cho khách: tên điền sẵn và không sửa (như mẫu)
      tenInput.value = khach;
      tenInput.disabled = true;
      tenInput.className = tenInput.className.replace('bg-white text-gray-900', 'bg-gray-50 text-gray-800');
    }
    var moXn = function () {
      $('xn-bieu-mau').hidden = false;
      $('xac-nhan-xong').hidden = true;
      xn.hidden = false;
    };
    var dongXn = function () { xn.hidden = true; };
    document.querySelectorAll('[data-mo-xac-nhan]').forEach(function (b) { b.addEventListener('click', moXn); });
    xn.querySelectorAll('[data-dong-xac-nhan]').forEach(function (b) { b.addEventListener('click', dongXn); });
    xn.addEventListener('click', function (e) { if (e.target === xn) dongXn(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !xn.hidden) dongXn(); });
    formXn.addEventListener('change', function (e) {
      if (e.target.name === 'attending') { chonXn = e.target.value; veLuaChon(); }
    });
    formXn.querySelector('[data-xn-bot]').addEventListener('click', function () { soKhach = Math.max(1, soKhach - 1); veSoKhach(); });
    formXn.querySelector('[data-xn-them]').addEventListener('click', function () { soKhach = toiDa === null ? soKhach + 1 : Math.min(soKhach + 1, toiDa); veSoKhach(); });
    veLuaChon();
    veSoKhach();
    formXn.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!chonXn || dangGuiXn) return;
      var ten = tenInput.value.trim();
      if (!ten) { tenInput.focus(); return; }
      dangGuiXn = true;
      $('xn-loi').hidden = true;
      nutGuiXn.querySelector('[data-chu-gui]').hidden = true;
      nutGuiXn.querySelector('[data-dang-gui]').hidden = false;
      veLuaChon();
      var coDen = chonXn === 'yes';
      fetch('api/xac-nhan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ben: CFG.ben, ten: ten, thamDu: coDen ? 'co' : 'khong', soNguoi: coDen ? soKhach : 0,
          loiNhan: formXn.elements.loiNhan.value.trim(), khachMoi: khach || '', duongDan: location.pathname,
        }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.loi || CFG.thongBao.loiXacNhan);
          return d;
        });
      }).then(function () {
        $('xn-bieu-mau').hidden = true;
        $('xn-xong-den').hidden = !coDen;
        $('xn-xong-khong').hidden = coDen;
        $('xac-nhan-xong').hidden = false;
        formXn.elements.loiNhan.value = '';
      }).catch(function (err) {
        var o = $('xn-loi');
        o.lastElementChild.textContent = err && err.message ? err.message : CFG.thongBao.loiXacNhan;
        o.hidden = false;
      }).then(function () {
        dangGuiXn = false;
        nutGuiXn.querySelector('[data-chu-gui]').hidden = false;
        nutGuiXn.querySelector('[data-dang-gui]').hidden = true;
        veLuaChon();
      });
    });
  }

  /* ---------------------------------------------------------------- sổ lưu bút (giống mẫu) */
  // Hành vi lấy từ mã của mẫu: gửi → xoá ô lời chúc ngay, lời chúc mới hiện đầu danh sách; thành công hiện khung "Cảm ơn bạn!"
  // trong 3 giây, thất bại thì trả lại chữ đã gõ và hiện khung báo lỗi. Tên giữ nguyên sau khi gửi. Nút 🪄 mở popup 5 lời
  // chúc gợi ý ngẫu nhiên (chọn một câu → điền vào ô, con trỏ về cuối).
  var formLc = $('form-loi-chuc');
  var dsLc = $('ds-loi-chuc');
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  function gioChu(iso) {
    var t = new Date(iso);
    if (isNaN(t)) return '';
    var h = function (n) { return (n < 10 ? '0' : '') + n; };
    return h(t.getHours()) + ':' + h(t.getMinutes()) + ':' + h(t.getSeconds()) + ' ' + t.getDate() + '/' + (t.getMonth() + 1) + '/' + t.getFullYear();
  }
  var sectionLc = formLc && formLc.closest('section');
  var lopCoLoiChuc = sectionLc ? [].filter.call(sectionLc.classList, function (c) { return c.indexOf('[&>div:last-child]') === 0; }) : [];
  function veLoiChuc(ds) {
    ds = ds || [];
    dsLc.innerHTML = ds.length ? ds.map(function (x) {
      return '<div class="rounded-[8px] border p-4 text-sm" style="border-color: rgba(124, 106, 96, 0.333); background-color: rgba(255, 255, 255, 0.55);">'
        + '<div class="flex items-start justify-between"><span class="font-semibold" style="color: rgb(124, 106, 96);">' + esc(x.ten) + '</span>'
        + '<span class="text-xs opacity-70">' + gioChu(x.luc) + '</span></div>'
        + '<p class="mt-2 leading-relaxed">' + esc(x.loiChuc) + '</p></div>';
    }).join('') : '<p class="text-center text-sm opacity-70 flex flex-col items-center">' + esc(CFG.chuChuaCoLoiChuc) + '</p>';
    // khoảng cách phía dưới khác nhau khi chưa có / đã có lời chúc (như mẫu)
    if (sectionLc) {
      sectionLc.classList.toggle('lc-trong', !ds.length);
      lopCoLoiChuc.forEach(function (c) { sectionLc.classList.toggle(c, !!ds.length); });
    }
  }
  var danhSachHienTai = [];
  if (formLc && !formLc.closest('[hidden]')) {
    veLoiChuc([]);
    fetch('api/loi-chuc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"xem":true}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { danhSachHienTai = d.danhSach || []; veLoiChuc(danhSachHienTai); } })
      .catch(function () {});
    if (khach && !formLc.elements.ten.value) formLc.elements.ten.value = khach;
    var nutGuiLc = formLc.querySelector('button[type=submit]');
    var chuGuiLc = nutGuiLc.firstElementChild;
    var chuGuiGoc = chuGuiLc.textContent;
    var khungOk = $('lc-thanh-cong');
    var khungLoi = $('lc-loi');
    var henOk = null;
    var dangGuiLc = false;

    // popup lời chúc gợi ý
    var goiY = CFG.goiY || [];
    var nutGoiY = formLc.querySelector('[data-goi-y]');
    var nguoiGoiY = null;
    function ngauNhien5() { return goiY.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 5); }
    function dongGoiY() { if (nguoiGoiY) { nguoiGoiY.remove(); nguoiGoiY = null; } }
    function veGoiY(ds) {
      dongGoiY();
      var o = document.createElement('div');
      o.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50';
      o.innerHTML = '<div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"><div class="p-6">'
        + '<div class="flex justify-between items-center mb-4"><h3 class="text-lg font-semibold text-gray-900">' + esc(CFG.goiYChu.tieuDe) + '</h3>'
        + '<button type="button" data-dong class="text-gray-400 hover:text-gray-600 transition-colors" aria-label="' + esc(CFG.goiYChu.dong) + '"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>'
        + '<p class="text-sm text-gray-600 mb-4">' + esc(CFG.goiYChu.huongDan) + '</p><div class="space-y-3 mb-4">'
        + ds.map(function (w, i) { return '<button type="button" data-chon="' + i + '" class="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-all"><p class="text-gray-800">' + esc(w) + '</p></button>'; }).join('')
        + '</div><div class="flex gap-2"><button type="button" data-them class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">' + esc(CFG.goiYChu.taoThem) + '</button>'
        + '<button type="button" data-dong class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">' + esc(CFG.goiYChu.dong) + '</button></div></div></div>';
      o.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) { if (e.target === o) dongGoiY(); return; }
        if (b.hasAttribute('data-dong')) dongGoiY();
        else if (b.hasAttribute('data-them')) veGoiY(ngauNhien5());
        else if (b.hasAttribute('data-chon')) {
          var chu = ds[+b.getAttribute('data-chon')];
          var ta = formLc.elements.loiChuc;
          ta.value = chu;
          dongGoiY();
          setTimeout(function () { ta.focus(); ta.setSelectionRange(chu.length, chu.length); }, 0);
        }
      });
      document.body.appendChild(o);
      nguoiGoiY = o;
    }
    if (!goiY.length) nutGoiY.hidden = true;
    nutGoiY.addEventListener('click', function () { veGoiY(ngauNhien5()); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dongGoiY(); });

    formLc.addEventListener('submit', function (e) {
      e.preventDefault();
      if (dangGuiLc) return;
      var ten = formLc.elements.ten.value.trim();
      var loi = formLc.elements.loiChuc.value.trim();
      if (!ten || !loi) { alert(CFG.thongBao.thieuLoiChuc); return; }
      dangGuiLc = true;
      nutGuiLc.disabled = true;
      chuGuiLc.textContent = CFG.chuDangGui;
      khungOk.hidden = true;
      khungLoi.hidden = true;
      var chuDaGo = formLc.elements.loiChuc.value;
      // như mẫu: xoá ô lời chúc và thêm lời chúc vào đầu danh sách ngay
      formLc.elements.loiChuc.value = '';
      var moi = { ten: ten, loiChuc: loi, luc: new Date().toISOString() };
      veLoiChuc([moi].concat(danhSachHienTai));
      var guiSheet = CFG.linkGoogleSheet
        ? fetch(CFG.linkGoogleSheet, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ ho_ten: ten, loi_chuc: loi, khach_moi: khach || '', ben: CFG.ben, link: location.href }) }).catch(function () {})
        : Promise.resolve();
      Promise.all([
        fetch('api/loi-chuc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ten: ten, loiChuc: loi, ben: CFG.ben }) })
          .then(function (r) { if (!r.ok) throw new Error('Máy chủ lỗi ' + r.status); return r.json(); }),
        guiSheet,
      ]).then(function (kq) {
        danhSachHienTai = kq[0].danhSach || [moi].concat(danhSachHienTai);
        veLoiChuc(danhSachHienTai);
        khungOk.hidden = false;
        clearTimeout(henOk);
        henOk = setTimeout(function () { khungOk.hidden = true; }, 3000);
      }).catch(function () {
        formLc.elements.loiChuc.value = chuDaGo;
        veLoiChuc(danhSachHienTai);
        khungLoi.hidden = false;
      }).then(function () {
        dangGuiLc = false;
        nutGuiLc.disabled = false;
        chuGuiLc.textContent = chuGuiGoc;
      });
    });
  }

  /* ---------------------------------------------------------------- hộp quà mừng cưới */
  var hopQua = $('hop-qua');
  if (hopQua) {
    document.querySelectorAll('[data-mo-qua]').forEach(function (b) {
      b.addEventListener('click', function () { moDialog(hopQua); });
    });
    var nutDongQua = hopQua.querySelector('.btn-circle');
    if (nutDongQua) nutDongQua.addEventListener('click', function () { dongDialog(hopQua); });
    hopQua.querySelectorAll('.qua-tk').forEach(function (tk, i) {
      tk.querySelector('[data-tai-qr]').addEventListener('click', function () {
        var src = tk.querySelector('img').src;
        var luu = function (href) {
          var a = document.createElement('a');
          a.href = href;
          a.download = 'QR-mung-cuoi-' + (i + 1) + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        // ảnh ở trang khác (VietQR) phải tải về trước mới lưu được; không được thì mở ảnh ra để khách tự lưu
        fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
          var u = URL.createObjectURL(b);
          luu(u);
          setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        }).catch(function () { window.open(src, '_blank'); });
      });
      // chạm vào số tài khoản để sao chép (không có nút riêng, giống mẫu)
      tk.querySelector('[data-stk]').addEventListener('click', function () {
        var stk = this.textContent.trim();
        var xong = function () { thongBao('Đã sao chép STK: ' + stk); };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(stk).then(xong, function () { if (chepCu(stk)) xong(); });
        } else if (chepCu(stk)) xong();
      });
    });
  }
  function chepCu(chu) {
    var t = document.createElement('textarea');
    t.value = chu;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t);
    t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
    document.body.removeChild(t);
    return ok;
  }
})();
