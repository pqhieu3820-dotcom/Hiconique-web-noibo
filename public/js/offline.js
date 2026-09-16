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
  var PING_TIMEOUT_MS = 6000;

  // Bắt đầu bằng đúng những gì trình duyệt báo — chỉnh lại ngay sau ping đầu.
  var online = navigator.onLine !== false;
  var wasOffline = !online;
  var banner = null;
  var pingTimer = null;

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
      el.innerHTML = '⚠️ Đang không có kết nối mạng — dữ liệu hiển thị từ lúc <b>' + formatVNDateTime(ts) + '</b>. Chỉ xem được, chưa thể tạo/sửa dữ liệu.';
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
      .then(function () { if (timeoutId) clearTimeout(timeoutId); setOnline(true); })
      .catch(function () { if (timeoutId) clearTimeout(timeoutId); setOnline(false); });
  }

  function setOnline(next) {
    var was = online;
    online = next;
    if (was === false && next === true) {
      // Vừa có mạng lại sau khi mất mạng — tự tải lại trang để lấy dữ liệu
      // mới nhất thay vì tự vá UI từng trang (mỗi trang render khác nhau).
      renderBanner();
      showToast('Đã có mạng trở lại — đang tải dữ liệu mới nhất...', true);
      setTimeout(function () { window.location.reload(); }, 900);
      return;
    }
    if (was !== next) renderBanner();
  }

  function isOnline() { return online; }

  // Chặn 1 thao tác GHI khi mất mạng. Trả về true nếu ĐÃ CHẶN (caller phải
  // return ngay, không tiếp tục ghi localStorage/gọi API).
  function guard(actionLabel) {
    if (online) return false;
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

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return; // Safari cũ/WebView nội bộ không hỗ trợ — bỏ qua êm, không lỗi
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('[offline] đăng ký service worker thất bại:', e);
      });
    });
  }

  function init() {
    renderBanner(); // ẩn sẵn nếu đang online, không giật màn hình lúc load
    window.addEventListener('online', pingCheck);
    window.addEventListener('offline', function () { setOnline(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pingCheck();
    });
    pingCheck();
    pingTimer = setInterval(pingCheck, PING_INTERVAL_MS);
    registerServiceWorker();
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
