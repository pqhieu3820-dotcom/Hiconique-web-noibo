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
 *
 * 2026-09-17: TRƯỚC ĐÂY css/js dùng "stale-while-revalidate" (trả bản cache
 * cũ ngay, tải bản mới chạy ngầm cho LẦN SAU) — trên máy tính desktop hay tự
 * fetch lại tự nhiên nên ít để ý, nhưng trên điện thoại (app "Thêm vào Màn
 * hình chính") có thể đứng yên ở đúng 1 phiên bản cache rất lâu (nhiều phút,
 * người dùng phản ánh phải thoát app/chờ ~5 phút mới thấy code mới, kéo
 * xuống làm mới cũng không ăn thua vì SW vẫn trả cache cũ trước network).
 * Đổi hẳn sang "network-first" cho MỌI request (kể cả css/js), ép bỏ qua
 * HTTP cache của trình duyệt (`cache: 'no-store'`) — ưu tiên tuyệt đối lấy
 * bản MỚI NHẤT, chỉ rơi về cache khi thật sự mất mạng. Đổi tên phiên bản để
 * mọi client tự xoá sạch cache cũ ngay lần cài đặt SW mới này.
 */
// 2026-09-23: Web Push (Firebase Cloud Messaging) — cho phép popup thông báo
// thật trên điện thoại/máy tính (giống Zalo) kể cả khi tab đang đóng. Nạp SDK
// Firebase bằng importScripts() (service worker cổ điển, không phải ES module
// nên không dùng import/export được) NGAY ĐẦU file, trước CACHE_VERSION —
// không liên quan gì tới phần cache app-shell bên dưới, chỉ dùng chung 1 file
// sw.js vì mỗi origin chỉ nên có 1 service worker đang active.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBbMw5HI4cJjcXJtPFglFn2yFKahSv8d9s',
  authDomain: 'hiconique-internal-hub-f77f2.firebaseapp.com',
  projectId: 'hiconique-internal-hub-f77f2',
  storageBucket: 'hiconique-internal-hub-f77f2.firebasestorage.app',
  messagingSenderId: '794909117053',
  appId: '1:794909117053:web:a9dd484a37d26288577f14'
});

// Tự bắt push lúc tab đang ĐÓNG/nền (lúc tab đang MỞ dùng onMessage() phía
// public/js/push-notifications.js — 2 đường khác nhau, cùng phải xử lý).
// Định nghĩa onBackgroundMessage() ở đây thay hẳn cách Firebase tự hiện
// notification mặc định, để ép đúng icon/badge thương hiệu HICONIQUE.
var messaging = firebase.messaging();
messaging.onBackgroundMessage(function (payload) {
  var n = payload.notification || {};
  var link = (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.link) || '/';
  self.registration.showNotification(n.title || 'HICONIQUE', {
    body: n.body || '',
    icon: '/apple-touch-icon.png',
    badge: '/icon-192.png',
    data: { link: link }
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.location.origin) === 0 && 'focus' in list[i]) return list[i].focus();
      }
      return clients.openWindow(link);
    })
  );
});

const CACHE_VERSION = 'hiconique-shell-v5';

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
  '/js/push-notifications.js',
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
      fetch(req, { cache: 'no-store' }).then(function (res) {
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

  // Tài nguyên tĩnh khác (css/js/icon...): NETWORK-FIRST (ép bỏ qua HTTP
  // cache bằng `no-store`) — chỉ rơi về bản đã cache khi fetch thật sự thất
  // bại (mất mạng). Đổi từ stale-while-revalidate cũ vì bản cũ LUÔN trả cache
  // trước, khiến code mới deploy không bao giờ hiện ngay được.
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then(function (res) {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req);
    })
  );
});
