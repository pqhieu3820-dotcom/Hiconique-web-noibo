/**
 * HICONIQUE — Offline-first support (chung cho mọi trang)
 *
 * Nạp file này SAU task-data.js, TRƯỚC bất kỳ script nào khác cần gọi
 * Offline.guard()/Offline.isOnline(). Không phụ thuộc jQuery/framework nào.
 *
 * Chức năng:
 * 1. Đăng ký Service Worker (sw.js) để app-shell (HTML/CSS/JS/icon) mở được
 *    cả khi KHÔNG có mạng — hoạt động trên Safari iOS lẫn Chrome Android.
 * 2. Theo dõi trạng thái mạng thật (không chỉ navigator.onLine, vốn có thể
 *    báo sai trên iOS Safari khi đang bắt WiFi nhưng không có Internet) bằng
 *    cách tự "ping" thẳng vào Apps Script Web App định kỳ.
 * 3. Hiện banner cố định đầu trang khi mất mạng, kèm mốc thời gian dữ liệu
 *    đang xem là của lần đồng bộ THÀNH CÔNG gần nhất (lưu ở localStorage
 *    'hiconique_last_sync', do task-data.js tự cập nhật mỗi lần đọc API
 *    thành công — xem markSynced()).
 * 4. Offline.guard(nhãn hành động) — chặn thao tác GHI (thêm/sửa/xoá, chấm
 *    công...) khi mất mạng: hiện toast + trả về true (đã chặn). Mọi hàm ghi
 *    dữ liệu dùng chung (add/update/remove/callGSheetsAPI... trong
 *    task-data.js, gsWrite trong hicon-bim.html/pricing.html, Auth.register)
 *    đều gọi guard() này — KHÔNG tự thêm luồng ghi mới mà bỏ qua guard().
 * 5. Khi có mạng trở lại sau khi mất mạng: tự tải lại trang để lấy dữ liệu
 *    mới nhất (đơn giản, chắc chắn đúng hơn tự vá lại từng phần UI của từng
 *    trang khác nhau).
 */
var Offline = (function () {
  'use strict';

  var LAST_SYNC_KEY = 'hiconique_last_sync';
  var PING_INTERVAL_MS = 15000;
  var PING_TIMEOUT_MS = 15000; // Apps Script có lúc chậm thật (cold start/nhiều người dùng cùng lúc) — không siết quá tay kẻo báo mất mạng oan
  // 2026-09-17: nâng từ 3 lên 10 lần trượt LIÊN TIẾP mới kết luận mất mạng
  // (10 * 15s ≈ 2.5 phút toàn trượt) — 3 lần trước đó vẫn còn báo động giả
  // quá dễ (mạng yếu/Apps Script chậm 1 chút vài chục giây là đủ khoá thao
  // tác, người dùng phản ánh rất khó chịu). Kết hợp với guard() đã chỉ chặn
  // khi navigator.onLine CŨNG báo mất mạng (xem guard() dưới) — 2 lớp phòng
  // báo động giả, cực kỳ hiếm khi chặn oan trong khi mạng vẫn dùng bình thường.
  var CONSECUTIVE_FAILS_TO_GO_OFFLINE = 10;
  // 2026-09-16: app "Thêm vào Màn hình chính" (iOS Safari/Android Chrome) mở
  // ra ở chế độ standalone thường bị trình duyệt đưa vào bfcache khi chuyển
  // sang app khác — quay lại thì trang KHÔNG chạy lại JS/initData(), chỉ hiện
  // nguyên DOM cũ đứng yên (khác hẳn 1 tab Chrome desktop bình thường hay bị
  // load lại tự nhiên khi chuyển qua lại trang). Trước đây chỉ có cách thoát
  // ra đăng nhập lại mới ép initData() chạy lại. Sửa bằng cách tự RELOAD
  // trang khi phát hiện dữ liệu đã cũ quá ngưỡng — đơn giản, chắc chắn đúng
  // hơn tự vá lại state từng trang (mỗi trang render khác nhau).
  var STALE_RELOAD_MS = 20000; // dữ liệu cũ quá 20s (khi trang đang hiển thị) thì coi là cần tải lại

  function dataAgeMs() {
    var ts = null;
    try { ts = localStorage.getItem(LAST_SYNC_KEY); } catch (e) {}
    if (!ts) return 0; // chưa từng sync lần nào — để trang tự initData() lần đầu, không reload
    var t = new Date(ts).getTime();
    return isNaN(t) ? 0 : (Date.now() - t);
  }

  // Chỉ reload khi: có mạng (reload lúc mất mạng chỉ tải lại y hệt bản cũ,
  // vô nghĩa) + trang đang thật sự hiển thị (không reload ngầm lúc app đang
  // ở nền, phí pin/dữ liệu di động vô ích) + dữ liệu đã cũ quá ngưỡng.
  function reloadIfStale() {
    if (!online) return;
    if (document.visibilityState !== 'visible') return;
    if (dataAgeMs() > STALE_RELOAD_MS) window.location.reload();
  }

  // Bắt đầu bằng đúng những gì trình duyệt báo — chỉnh lại ngay sau ping đầu.
  var online = navigator.onLine !== false;
  var wasOffline = !online;
  var banner = null;
  var pingTimer = null;
  var consecutiveFails = 0;

  function apiBaseUrl() {
    return (typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL) ? GSHEETS_CONFIG.API_URL : null;
  }

  function markSynced() {
    try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch (e) { /* Safari riêng tư có thể chặn */ }
    if (banner) renderBanner(); // cập nhật lại giờ hiển thị trên banner nếu đang mở
  }

  function formatVNDateTime(iso) {
    if (!iso) return '--';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '--';
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    var hh = pad2(d.getHours()), mm = pad2(d.getMinutes()), ss = pad2(d.getSeconds());
    return hh + ':' + mm + ':' + ss + ' ngày ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // Chèn thẳng 1 thẻ <style> thay vì phụ thuộc portal.css (login.html và
  // progress-board.html không nạp portal.css) — banner tự đẩy nội dung
  // xuống ở MỌI trang mà không cần trang đó khai báo gì thêm.
  function ensureOffsetStyle() {
    if (document.getElementById('hiconiqueOfflineOffsetStyle')) return;
    var style = document.createElement('style');
    style.id = 'hiconiqueOfflineOffsetStyle';
    style.textContent = 'body.hiconique-offline { padding-top: var(--offline-banner-h, 38px); }';
    document.head.appendChild(style);
  }

  function ensureBanner() {
    if (banner) return banner;
    ensureOffsetStyle();
    banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:100050',
      'display:none', 'align-items:center', 'justify-content:center', 'gap:8px',
      'padding:9px 16px', 'font-family:Inter,system-ui,sans-serif', 'font-size:0.8125rem',
      'font-weight:600', 'color:#0B0D10', 'background:#D9A441',
      'box-shadow:0 2px 10px rgba(0,0,0,0.25)', 'text-align:center', 'line-height:1.4'
    ].join(';');
    document.body.appendChild(banner);
    return banner;
  }

  function renderBanner() {
    var el = ensureBanner();
    if (!online) {
      var ts = null;
      try { ts = localStorage.getItem(LAST_SYNC_KEY); } catch (e) {}
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0;vertical-align:-2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Đang không có kết nối mạng — dữ liệu hiển thị từ lúc <b>' + formatVNDateTime(ts) + '</b>. Chỉ xem được, chưa thể tạo/sửa dữ liệu.';
      el.style.display = 'flex';
      document.documentElement.style.setProperty('--offline-banner-h', el.offsetHeight + 'px');
      document.body.classList.add('hiconique-offline');
    } else {
      el.style.display = 'none';
      document.body.classList.remove('hiconique-offline');
    }
  }

  // Không chỉ tin navigator.onLine (iOS Safari hay báo "online" dù WiFi không
  // có Internet thật) — tự bắn 1 request nhẹ thẳng vào Apps Script Web App,
  // có response (dù server trả lỗi "Unknown action") nghĩa là mạng THẬT có.
  function pingCheck() {
    var url = apiBaseUrl();
    if (!url) { setOnline(navigator.onLine !== false); return; }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, PING_TIMEOUT_MS) : null;
    fetch(url + '?action=ping', { method: 'GET', redirect: 'follow', cache: 'no-store', signal: controller ? controller.signal : undefined })
      .then(function () { if (timeoutId) clearTimeout(timeoutId); consecutiveFails = 0; setOnline(true); })
      .catch(function () {
        if (timeoutId) clearTimeout(timeoutId);
        consecutiveFails++;
        // Chỉ kết luận mất mạng sau khi trượt liên tiếp đủ số lần — 1 lần
        // trượt đơn lẻ (mạng chập chờn 1 nhịp, Apps Script phản hồi chậm) chưa
        // đủ để hiện banner, tránh báo động giả gây khó chịu.
        if (consecutiveFails >= CONSECUTIVE_FAILS_TO_GO_OFFLINE) setOnline(false);
      });
  }

  function setOnline(next) {
    var was = online;
    online = next;
    if (was === false && next === true) {
      // 2026-09-17: TRƯỚC ĐÂY reload cả trang lúc có mạng lại — xoá mất y
      // nguyên form/dữ liệu người dùng đang gõ dở nếu đúng lúc đó mạng chập
      // chờn 1 nhịp rồi có lại ngay (rất hay xảy ra, không phải mất mạng
      // thật). Giờ chỉ âm thầm làm mới dữ liệu (không reload) + báo 1 toast
      // ngắn, y hệt cơ chế silentRefresh() định kỳ đã có.
      renderBanner();
      showToast('Đã có mạng trở lại — đang cập nhật dữ liệu mới nhất.', true);
      if (typeof TaskManager !== 'undefined' && TaskManager.silentRefresh) TaskManager.silentRefresh();
      return;
    }
    if (was !== next) renderBanner();
  }

  function isOnline() { return online; }

  // Chặn 1 thao tác GHI khi mất mạng. Trả về true nếu ĐÃ CHẶN (caller phải
  // return ngay, không tiếp tục ghi localStorage/gọi API).
  // 2026-09-17: chỉ chặn khi CẢ HAI tín hiệu đều nói mất mạng (ping tới Apps
  // Script trượt liên tiếp VÀ navigator.onLine cũng báo mất mạng) — trước đó
  // chỉ dựa vào ping 1 mình, nên 1 lần Apps Script phản hồi chậm/trượt (cold
  // start, quá tải) dù mạng máy vẫn tốt 100% cũng đủ khoá hết thao tác ghi,
  // người dùng phải tự reload trang mới hết — rất khó chịu, đã phản ánh thật.
  // navigator.onLine gần như luôn đúng khi máy THẬT SỰ có kết nối (chỉ sai
  // chiều ngược lại — báo online dù không có Internet thật — nên dùng nó làm
  // "phiếu phủ quyết" cho false positive là hợp lý, không làm mất tác dụng
  // phát hiện mất mạng thật của ping).
  function guard(actionLabel) {
    if (online || navigator.onLine !== false) return false;
    showToast('Đang không có kết nối mạng — chưa thể ' + (actionLabel || 'thực hiện thao tác này') + '. Vui lòng thử lại khi có mạng.', false);
    return true;
  }

  // Toast tối giản, không phụ thuộc showToast() riêng của từng trang (chỉ
  // timesheet.html có sẵn) — dùng được ở MỌI trang.
  var toastTimer = null;
  function showToast(message, ok) {
    var el = document.getElementById('hiconiqueOfflineToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hiconiqueOfflineToast';
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%) translateY(12px)',
        'z-index:100060', 'max-width:min(420px,90vw)', 'padding:12px 18px', 'border-radius:10px',
        'font-family:Inter,system-ui,sans-serif', 'font-size:0.875rem', 'font-weight:500',
        'color:#fff', 'box-shadow:0 10px 30px rgba(0,0,0,0.35)', 'opacity:0',
        'transition:opacity .2s ease, transform .2s ease', 'text-align:center'
      ].join(';');
      document.body.appendChild(el);
    }
    el.style.background = ok ? '#3E7A4C' : '#B0453A';
    el.textContent = message;
    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(12px)';
    }, 3200);
  }

  // 2026-09-16: kéo xuống ở đầu trang (trên điện thoại) = tải lại TOÀN BỘ
  // trang (window.location.reload()) — y hệt hiệu ứng đăng xuất/đăng nhập
  // lại đã dùng để ép dữ liệu mới trước đây, giờ người dùng có thể tự làm
  // bất cứ lúc nào mà không cần đăng xuất thật. CHỈ bắt gesture khi trang
  // đang ở ĐỈNH (scrollTop = 0) và đang kéo XUỐNG — nếu không sẽ cản trở
  // cuộn trang bình thường. Không dùng thư viện ngoài, tự vẽ icon mũi tên
  // xoay tối giản bằng SVG inline.
  var PULL_THRESHOLD = 70;
  var PULL_MAX = 110;
  function initPullToRefresh() {
    var startY = 0;
    var pulling = false;
    var indicator = null;

    function ensureIndicator() {
      if (indicator) return indicator;
      if (!document.getElementById('hiconiquePullSpinStyle')) {
        var style = document.createElement('style');
        style.id = 'hiconiquePullSpinStyle';
        style.textContent = '@keyframes hiconiquePullSpin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      }
      indicator = document.createElement('div');
      indicator.id = 'hiconiquePullRefresh';
      indicator.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:100045',
        'display:flex', 'align-items:center', 'justify-content:center',
        'height:56px', 'transform:translateY(-56px)', 'opacity:0',
        'pointer-events:none'
      ].join(';');
      indicator.innerHTML = '<div style="width:34px;height:34px;border-radius:50%;background:var(--color-surface,#1A1D21);border:1px solid var(--color-border,rgba(255,255,255,0.12));display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.25);">' +
        '<svg id="hiconiquePullIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B08D57" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></svg>' +
      '</div>';
      document.body.appendChild(indicator);
      return indicator;
    }

    function atTop() {
      return (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
    }

    document.addEventListener('touchstart', function (e) {
      if (!atTop() || e.touches.length !== 1) { pulling = false; return; }
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY;
      if (dy <= 0 || !atTop()) { pulling = false; return; }
      e.preventDefault();
      var pull = Math.min(dy * 0.5, PULL_MAX);
      var el = ensureIndicator();
      el.style.transform = 'translateY(' + (pull - 56) + 'px)';
      el.style.opacity = Math.min(pull / PULL_THRESHOLD, 1);
      var icon = document.getElementById('hiconiquePullIcon');
      if (icon) icon.style.transform = 'rotate(' + Math.round((pull / PULL_MAX) * 360) + 'deg)';
      el.setAttribute('data-pull', pull);
    }, { passive: false });

    function endPull() {
      if (!pulling) return;
      pulling = false;
      var el = indicator;
      if (!el) return;
      var pull = parseFloat(el.getAttribute('data-pull') || '0');
      if (pull >= PULL_THRESHOLD) {
        el.style.transition = 'transform .15s ease-out';
        el.style.transform = 'translateY(12px)';
        var icon = document.getElementById('hiconiquePullIcon');
        if (icon) icon.style.animation = 'hiconiquePullSpin .6s linear infinite';
        window.location.reload();
      } else {
        el.style.transition = 'transform .2s ease-out, opacity .2s ease-out';
        el.style.transform = 'translateY(-56px)';
        el.style.opacity = '0';
      }
    }
    document.addEventListener('touchend', endPull, { passive: true });
    document.addEventListener('touchcancel', endPull, { passive: true });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return; // Safari cũ/WebView nội bộ không hỗ trợ — bỏ qua êm, không lỗi
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('[offline] đăng ký service worker thất bại:', e);
      });
    });
    // 2026-09-17: sw.js đổi chiến lược cache (xem CACHE_VERSION trong sw.js)
    // nhưng bản Service Worker MỚI chỉ thật sự điều khiển trang sau khi
    // 'activate' xong (đã có skipWaiting()+clients.claim() ở sw.js) — trang
    // ĐANG MỞ vẫn còn script cũ đã load sẵn trong bộ nhớ, tự nó không có
    // cách nào "tiêm" code mới vào giữa chừng được. 'controllerchange' bắn
    // đúng lúc SW mới giành quyền kiểm soát — reload đúng 1 lần (cờ
    // `refreshedForSW` chặn lặp vô hạn nếu trình duyệt bắn sự kiện này nhiều
    // lần) để trang tải lại với code mới ngay, không cần người dùng tự thoát
    // app/chờ như trước.
    var refreshedForSW = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshedForSW) return;
      refreshedForSW = true;
      // 2026-09-26: KHÔNG reload giữa lúc người dùng đang nhập/mở modal (mất
      // dữ liệu đang gõ) — chờ tới khi rảnh mới tải lại để nhận code mới.
      var tryReload = function () {
        var busy = typeof window.HiconiqueUserBusy === 'function' && window.HiconiqueUserBusy();
        if (busy) { setTimeout(tryReload, 3000); return; }
        window.location.reload();
      };
      tryReload();
    });
  }

  // 2026-09-17: BỎ hẳn việc reload cả trang định kỳ (bản trước gọi
  // reloadIfStale() mỗi 15s — 1-2 lần đầu vô hại, nhưng vì mỗi reload tự đặt
  // lại mốc "vừa đồng bộ" nên ~20-30s sau lại "cũ" và reload tiếp, lặp vô hạn
  // → nháy màn hình liên tục, cắt ngang thao tác đang làm dở, người dùng
  // phản ánh thật). Giờ CHỈ reload cả trang đúng 1 tình huống: vừa mở lại app
  // từ bfcache sau khi bị đưa ra nền (event.persisted trong 'pageshow') — đây
  // mới là ca DOM đứng yên hoàn toàn, không có cách nào khác ngoài reload.
  // Mọi lúc còn lại (đang mở app liên tục, chuyển tab ngắn rồi quay lại...)
  // chỉ làm mới dữ liệu NGẦM qua TaskManager.silentRefresh() — không reload,
  // không giật màn hình, không mất trạng thái form/modal đang mở.
  // 2026-09-22: rút từ 20s xuống 5s theo yêu cầu người dùng ("thao tác xong
  // đợi mãi vẫn không thấy") — không hạ xuống đúng 1s như yêu cầu ban đầu vì
  // mỗi chu kỳ silentRefresh() bắn tới 16 request GET song song lên Apps
  // Script (refreshFromGSheets() đọc đủ loại dữ liệu) — 1 giây/lần nhân với
  // vài người cùng mở app dễ vượt quota thực thi của Apps Script (tài khoản
  // Google cá nhân), sập hẳn cho TẤT CẢ mọi người chứ không riêng máy đó.
  // 5s vẫn nhanh hơn hẳn (gấp 4 lần) mà vẫn an toàn quota.
  // 2026-09-29: đo thực tế — 5s x 16 lệnh song song = ~192 lệnh Apps Script/phút/tab làm NGHẼN hàng đợi (12-35s, 404).
  // Nay: 1 lệnh gói (getBundle) + cache phía server, hẹn giờ 10-15s có độ lệch ngẫu nhiên (các thiết bị không bắn cùng lúc),
  // bỏ qua khi tab đang ẩn (visibilitychange tự làm mới ngay khi hiện lại).
  var SILENT_REFRESH_MIN_MS = 10000, SILENT_REFRESH_JITTER_MS = 5000;
  function silentRefresh() {
    if (!online) return;
    if (document.visibilityState === 'hidden') return;
    if (typeof TaskManager === 'undefined' || !TaskManager.silentRefresh) return;
    TaskManager.silentRefresh();
  }

  function init() {
    renderBanner(); // ẩn sẵn nếu đang online, không giật màn hình lúc load
    window.addEventListener('online', pingCheck);
    window.addEventListener('offline', function () { setOnline(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        pingCheck();
        silentRefresh();
      }
    });
    // 'pageshow' bắn cả lúc load bình thường LẪN lúc trình duyệt phục hồi
    // trang từ bfcache (event.persisted = true) — chính là lúc mở lại app đã
    // "Thêm vào Màn hình chính" từ nền ra. Đây là điểm mấu chốt để bắt đúng
    // ca bfcache mà 'visibilitychange' một mình không chắc bắt được ở mọi
    // trình duyệt di động — TRƯỜNG HỢP DUY NHẤT còn reload cả trang.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) reloadIfStale();
    });
    pingCheck();
    pingTimer = setInterval(pingCheck, PING_INTERVAL_MS);
    (function scheduleSilentRefresh() {
      var wait = SILENT_REFRESH_MIN_MS + Math.random() * SILENT_REFRESH_JITTER_MS;
      if (window.HiconiqueMetrics) window.HiconiqueMetrics.nextRefreshAt = Date.now() + wait;
      setTimeout(function () { silentRefresh(); scheduleSilentRefresh(); }, wait);
    })();
    registerServiceWorker();
    initPullToRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    isOnline: isOnline,
    guard: guard,
    markSynced: markSynced,
    showToast: showToast
  };
})();

// ===== Khung trạng thái đồng bộ TOÀN WEB (Liquid Glass, 2026-09-30): chỉ hiện khi có thao tác ghi; xong hiện "✓ Đã đồng bộ" rồi tự ẩn sau 5s =====
// Đặt trong offline.js vì file này được nạp ở MỌI trang (kể cả trang tạo sau này, miễn có <script src="/js/offline.js">) — không cần thêm gì riêng cho từng trang.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var last = { event: '', reason: '', tries: 0 }, failed = false, doneUntil = 0, el = null;
  function readQueue_() {
    if (typeof readWriteQueue_ === 'function') return readWriteQueue_();   // có cả hàng đợi giữ trong RAM khi localStorage đầy
    try { var a = JSON.parse(localStorage.getItem('hiconique_write_queue') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function sec(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + 's'; }
  function dur(ms) { var s = Math.max(0, Math.round(ms / 1000)); return s >= 60 ? Math.floor(s / 60) + 'p' + (s % 60 < 10 ? '0' : '') + (s % 60) + 's' : s + 's'; }
  function ensure() {
    if (el || !document.body) return el;
    el = document.createElement('div'); el.id = 'hqSyncChip'; el.hidden = true;
    if (!document.getElementById('hqSyncChipCss')) {
      var st = document.createElement('style'); st.id = 'hqSyncChipCss';
      // Kính lỏng (Liquid Glass): nền mờ trong suốt + blur/saturate, viền sáng phía trên, đổ bóng mềm; sáng/tối theo data-theme của web
      // 2026-09-30: Liquid Glass kiểu iOS 26 — nền gần như trong suốt (alpha ~10%), blur mạnh + tăng bão hòa/độ sáng nền phía sau,
      // viền "specular" sáng ở góc trên-trái và tối dần ở góc dưới-phải (mask viền gradient), ánh sáng bên trong, bóng mềm dài, bo tròn kiểu viên thuốc.
      st.textContent =
        '#hqSyncChip{position:fixed;right:18px;bottom:18px;z-index:9500;max-width:min(400px,calc(100vw - 36px));padding:12px 18px 12px 14px;border-radius:24px;display:flex;align-items:center;gap:12px;' +
        'font:500 13px/1.4 "Plus Jakarta Sans",Inter,system-ui,-apple-system,sans-serif;letter-spacing:.005em;pointer-events:none;isolation:isolate;' +
        '-webkit-backdrop-filter:blur(2px) saturate(130%);backdrop-filter:blur(2px) saturate(130%);' +
        'background:linear-gradient(140deg,rgba(255,255,255,.02) 0%,rgba(255,255,255,0) 50%,rgba(255,255,255,.01) 100%);color:#12110F;' +
        'box-shadow:0 1px 1px rgba(255,255,255,.5) inset,0 -1px 1px rgba(255,255,255,.12) inset,0 12px 30px -10px rgba(20,24,40,.22),0 0 0 1px rgba(20,24,40,.06),0 4px 12px rgba(20,24,40,.08);' +
        'animation:hqGlassIn .42s cubic-bezier(.2,.9,.25,1.15) both;}' +
        '#hqSyncChip::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.2px;pointer-events:none;' +
        'background:linear-gradient(135deg,rgba(255,255,255,.95),rgba(255,255,255,.15) 38%,rgba(255,255,255,.08) 62%,rgba(255,255,255,.7));' +
        '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);}' +
        '#hqSyncChip::after{content:"";position:absolute;left:12%;right:12%;top:1px;height:42%;border-radius:0 0 50% 50%/0 0 100% 100%;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,0));opacity:.3;}' +
        'html[data-theme="dark"] #hqSyncChip{background:linear-gradient(140deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 45%,rgba(255,255,255,.02) 100%);color:#F6F2EB;' +
        '-webkit-backdrop-filter:blur(5px) saturate(150%);backdrop-filter:blur(5px) saturate(150%);' +
        'box-shadow:0 1px 1px rgba(255,255,255,.35) inset,0 -1px 1px rgba(255,255,255,.06) inset,0 18px 44px -8px rgba(0,0,0,.55),0 4px 14px rgba(0,0,0,.3);}' +
        'html[data-theme="dark"] #hqSyncChip::before{background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(255,255,255,.06) 38%,rgba(255,255,255,.03) 62%,rgba(255,255,255,.4));}' +
        'html[data-theme="dark"] #hqSyncChip::after{opacity:.35;}' +
        '#hqSyncChip .ic{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background:rgba(120,120,128,.55);box-shadow:0 0 0 1px rgba(255,255,255,.35) inset,0 2px 8px rgba(0,0,0,.16);}' +
        '#hqSyncChip .ic svg{width:16px;height:16px;overflow:visible}#hqSyncChip .ic.ok svg path{stroke:#fff;stroke-width:3.2;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;animation:hqTick .45s .18s cubic-bezier(.65,0,.35,1) forwards}' +
        '#hqSyncChip .ic.ok{animation:hqPop .5s cubic-bezier(.2,1.4,.4,1) both,hqRing 1.1s .3s ease-out 1;background:linear-gradient(160deg,#5FD087,#2E9F58);box-shadow:0 0 0 1px rgba(255,255,255,.4) inset,0 2px 10px rgba(46,159,88,.45);}' +
        '#hqSyncChip .ic.bad{background:linear-gradient(160deg,#FF8A72,#D9482C);box-shadow:0 0 0 1px rgba(255,255,255,.4) inset,0 2px 10px rgba(217,72,44,.45);}' +
        '#hqSyncChip .ic.bad svg .st{stroke:#fff;stroke-width:3.4;fill:none;stroke-linecap:round;stroke-dasharray:8;stroke-dashoffset:8;animation:hqTick .4s .2s cubic-bezier(.65,0,.35,1) forwards}#hqSyncChip .ic.bad svg .dt{fill:#fff;transform-origin:12px 17.6px;transform:scale(0);animation:hqDot .3s .55s cubic-bezier(.2,1.6,.4,1) forwards}' +
        '#hqSyncChip .ic.bad{animation:hqPop .5s cubic-bezier(.2,1.4,.4,1) both,hqShake .55s .45s ease-in-out 1,hqRingBad 1.8s 1s ease-out infinite}' +
        '@keyframes hqDot{to{transform:scale(1)}}@keyframes hqShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}@keyframes hqRingBad{0%{box-shadow:0 0 0 0 rgba(224,80,50,.55),0 0 0 1px rgba(255,255,255,.4) inset}100%{box-shadow:0 0 0 14px rgba(224,80,50,0),0 0 0 1px rgba(255,255,255,.4) inset}}' +
        '#hqSyncChip .ic.busy{background:linear-gradient(160deg,#E7C27F,#B08D57);box-shadow:0 0 0 1px rgba(255,255,255,.4) inset,0 2px 10px rgba(176,141,87,.45);}' +
        '#hqSyncChip .ic.busy i{width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.9);border-top-color:transparent;animation:hqSpin .8s linear infinite;}' +
        '#hqSyncChip .tx{min-width:0;-webkit-font-smoothing:antialiased}#hqSyncChip .l1{font-weight:700;font-size:13.5px;text-shadow:0 0 10px rgba(255,255,255,.55)}#hqSyncChip .l1b{font-weight:600;font-size:12.5px;color:#9A7434;margin-top:1px;font-variant-numeric:tabular-nums}html[data-theme="dark"] #hqSyncChip .l1b{color:#E7C27F}#hqSyncChip .l2{opacity:.75;font-weight:500;font-size:11.5px;margin-top:2px;font-variant-numeric:tabular-nums}' +
        '#hqSyncChip .l1.ok{color:#1F7A44}#hqSyncChip .l1.bad{color:#B5361F}html[data-theme="dark"] #hqSyncChip .l1.ok{color:#8FE0A8}html[data-theme="dark"] #hqSyncChip .l1.bad{color:#FFA793}' +
        '@keyframes hqTick{to{stroke-dashoffset:0}}@keyframes hqPop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.18);opacity:1}100%{transform:scale(1)}}@keyframes hqRing{0%{box-shadow:0 0 0 0 rgba(63,190,110,.55),0 0 0 1px rgba(255,255,255,.4) inset}100%{box-shadow:0 0 0 14px rgba(63,190,110,0),0 0 0 1px rgba(255,255,255,.4) inset}}' +
        '@keyframes hqGlassIn{from{opacity:0;transform:translateY(14px) scale(.94);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}@keyframes hqSpin{to{transform:rotate(360deg)}}' +
        '@media (prefers-reduced-motion:reduce){#hqSyncChip{animation:none}#hqSyncChip .ic.ok,#hqSyncChip .ic.ok svg path,#hqSyncChip .ic.bad,#hqSyncChip .ic.bad svg .st,#hqSyncChip .ic.bad svg .dt{animation:none;stroke-dashoffset:0;transform:none}#hqSyncChip .ic.busy i{animation:none}}';
      document.head.appendChild(st);
    }
    el.style.cssText = '';
    document.body.appendChild(el); return el;
  }
  function render() {
    var q = readQueue_(), n = q.length, now = Date.now(), M = window.HiconiqueMetrics || {};
    var w = M.writeMs || [], aw = w.length ? w.reduce(function (a, b) { return a + b; }, 0) / w.length : 0;
    if (!failed && n === 0 && now > doneUntil) { if (el) el.hidden = true; return; }
    if (!ensure()) return;
    var top = ''; if (n > 3) { var c = {}; q.forEach(function (o) { c[o.action] = (c[o.action] || 0) + 1; }); var k = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0]; top = ' · nhiều nhất: ' + k + ' ×' + c[k]; }
    var l1, cls = '', icon = '', eta = '';
    if (failed) { l1 = 'Có thao tác KHÔNG lưu được lên Google Sheet — hãy chụp màn hình báo lại.'; cls = 'bad'; icon = '<span class="ic bad"><svg viewBox="0 0 24 24"><path class="st" d="M12 5.8v7.4"/><circle class="dt" cx="12" cy="17.6" r="1.7"/></svg></span>'; }
    else if (n > 0 && last.event === 'retry') { l1 = 'Chưa lưu được' + (last.reason ? ' (' + last.reason + ')' : '') + ' — thử lại lần ' + last.tries + (M.nextWriteAt > now ? ' sau ' + dur(M.nextWriteAt - now) : '') + '. ĐỪNG đóng trang.'; cls = 'bad'; icon = '<span class="ic bad"><svg viewBox="0 0 24 24"><path class="st" d="M12 5.8v7.4"/><circle class="dt" cx="12" cy="17.6" r="1.7"/></svg></span>'; }
    else if (n > 0) { icon = '<span class="ic busy"><i></i></span>'; l1 = 'Đang lưu lên Google Sheet… ' + n + ' thao tác' + top; eta = aw ? 'còn khoảng ' + dur(n * aw) : ''; }
    else { l1 = 'Đã đồng bộ Google Sheet'; cls = 'ok'; icon = '<span class="ic ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.6 4.6L19 7.5"/></svg></span>'; }
    var l2 = 'Ghi ' + (aw ? sec(aw) + '/lệnh' : '—') + ' · Đọc ' + (M.readMs != null ? sec(M.readMs) : '—') + ' · làm mới sau ' + (M.nextRefreshAt > now ? dur(M.nextRefreshAt - now) : '…');
    el.hidden = false;
    var key = icon + '|' + cls + '|' + l1;
    if (el._key === key && el.querySelector('.l2')) { el.querySelector('.l2').textContent = l2; var eb = el.querySelector('.l1b'); if (eb) eb.textContent = eta; return; }    // chỉ đổi dòng số liệu → giữ nguyên vòng xoay, không nháy
    el._key = key;
    el.innerHTML = icon + '<div class="tx"><div class="l1 ' + cls + '">' + l1 + '</div>' + (eta ? '<div class="l1b">' + eta + '</div>' : '') + '<div class="l2">' + l2 + '</div></div>';
  }
  window.addEventListener('hiconique:sync-state', function (e) {
    var d = e.detail || {};
    if (d.event) { last = { event: d.event, reason: d.reason || '', tries: d.tries || 0 }; if (d.event === 'ok' || d.event === 'queued') failed = false; }
    if (d.pending === 0 && d.event === 'ok') doneUntil = Date.now() + 5000;   // hiện "Đã đồng bộ" 5s rồi ẩn
    render();
  });
  window.addEventListener('hiconique:sync-failed', function () { failed = true; render(); });
  setInterval(render, 1000);
})();


/* ===== 2026-09-30: hiển thị NGÀY THÁNG toàn web dạng dd/mm/yyyy (30/09/2026) =====
   Dữ liệu lưu/so sánh vẫn là yyyy-mm-dd; chỉ đổi CHỮ hiển thị (text node) — không đụng ô nhập, thuộc tính, script/style.
   Muốn giữ nguyên 1 vùng: đặt thuộc tính data-raw-date trên phần tử đó. */
(function () {
  'use strict';
  var RE = /(?:\b(20\d{2}|19\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b(?![-_])|(?<![-_\/\w])(20\d{2}|19\d{2})-(0[1-9]|1[0-2])(?![-_\/\w]))/g;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  function convert(text) { return text.replace(RE, function (m, y, mo, d, y2, mo2) { return y ? d + '/' + mo + '/' + y : mo2 + '/' + y2; }); }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || SKIP[root.tagName] || (root.closest && root.closest('[data-raw-date]'))) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || SKIP[p.tagName] || (p.isContentEditable) || (p.closest && p.closest('[data-raw-date],script,style,textarea'))) return NodeFilter.FILTER_REJECT;
        return RE.test(n.nodeValue) ? (RE.lastIndex = 0, NodeFilter.FILTER_ACCEPT) : (RE.lastIndex = 0, NodeFilter.FILTER_REJECT);
      }
    });
    var list = [], n; while ((n = w.nextNode())) list.push(n);
    list.forEach(fix);
  }
  function fix(n) { var v = n.nodeValue; RE.lastIndex = 0; if (RE.test(v)) { RE.lastIndex = 0; var nv = convert(v); if (nv !== v) n.nodeValue = nv; } RE.lastIndex = 0; }
  var pending = false, queue = [];
  function flush() { pending = false; var q = queue; queue = []; q.forEach(walk); }
  function schedule(node) { queue.push(node); if (!pending) { pending = true; (window.requestAnimationFrame || setTimeout)(flush); } }
  function start() {
    walk(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (a) { schedule(a); });
        else if (m.type === 'characterData') schedule(m.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
