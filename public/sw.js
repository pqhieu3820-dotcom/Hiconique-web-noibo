/**
 * HICONIQUE Internal Hub — Service Worker
 *
 * Mục tiêu: cho app shell (HTML/CSS/JS/icon) load được khi KHÔNG có mạng, trên
 * cả Safari iOS và Chrome Android (2 nơi hay bị bỏ sót khi chỉ test Chrome
 * desktop). Dữ liệu (Google Sheets) KHÔNG cache ở đây — tầng dữ liệu đã tự
 * cache vào localStorage (xem task-data.js initData()), sw.js chỉ lo phần
 * "vỏ" trang để trình duyệt còn mở được trang lúc mất mạng.
 *
 * Tăng CACHE_VERSION mỗi khi đổi danh sách PRECACHE_URLS hoặc muốn ép mọi
 * client tải lại toàn bộ shell (activate sẽ tự xoá cache phiên bản cũ).
 */
const CACHE_VERSION = 'hiconique-shell-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-152.png',
  '/apple-touch-icon-167.png',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-mark.png',
  '/pages/commission.html',
  '/pages/finance.html',
  '/pages/hicon-bim-huongdan.html',
  '/pages/hicon-bim.html',
  '/pages/my-dashboard.html',
  '/pages/notices.html',
  '/pages/orders.html',
  '/pages/payslip.html',
  '/pages/pricing.html',
  '/pages/profile.html',
  '/pages/progress-board.html',
  '/pages/projects.html',
  '/pages/spc.html',
  '/pages/tasks-manager.html',
  '/pages/team.html',
  '/pages/timesheet.html',
  '/pages/wiki.html',
  '/css/gantt.css',
  '/css/portal.css',
  '/css/projects.css',
  '/css/reset.css',
  '/css/spc.css',
  '/css/subpage.css',
  '/css/task-manager.css',
  '/css/tokens.css',
  '/js/auth.js',
  '/js/gantt.js',
  '/js/gsheets-config.js',
  '/js/offline.js',
  '/js/portal.js',
  '/js/projects.js',
  '/js/task-data.js',
  '/js/task-manager-app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // addAll thất bại cả loạt nếu 1 URL lỗi — thêm từng cái, bỏ qua URL lỗi
      // (VD 1 trang bị xoá sau này) thay vì làm cả service worker cài đặt hỏng.
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (e) {
            console.warn('[sw] precache lỗi, bỏ qua:', url, e);
          });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_VERSION; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return; // chỉ lo GET (mọi API ghi đều là GET có query, giữ nguyên hành vi network thật)

  const url = new URL(req.url);
  // Chỉ can thiệp request CÙNG GỐC (file tĩnh của web). Request sang
  // script.google.com (API), fonts.googleapis.com... để trình duyệt tự xử lý
  // bình thường — không cache dữ liệu/API ở lớp Service Worker.
  if (url.origin !== self.location.origin) return;

  // Điều hướng trang (gõ URL/bấm link/mở từ icon màn hình chính): network
  // trước cho dữ liệu mới nhất, hết mạng thì rơi về đúng trang đã cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match(new URL(req.url).pathname) || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Tài nguyên tĩnh khác (css/js/icon...): cache trước cho tốc độ, network
  // chạy song song để cập nhật cache ngầm — "stale-while-revalidate".
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
