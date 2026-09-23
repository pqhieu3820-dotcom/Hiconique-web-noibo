/**
 * Thông báo đẩy (Web Push qua Firebase Cloud Messaging) — 2026-09-23.
 *
 * Cho phép thông báo popup thật trên điện thoại/máy tính (giống Zalo), kể cả
 * khi không mở web — khác hẳn chuông 🔔 hiện có (chỉ thấy khi đang mở trang).
 *
 * Cần nạp 2 script Firebase (compat, không cần bundler) TRƯỚC file này ở mọi
 * trang có portal.js:
 *   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"></script>
 *   <script src="/js/push-notifications.js"></script>
 *
 * Luồng nền (tab đóng/không active): xử lý trong public/sw.js
 * (messaging.onBackgroundMessage() + notificationclick).
 * Luồng khi tab đang MỞ: onMessage() bên dưới tự hiện notification giống hệt
 * (Chrome/trình duyệt KHÔNG tự bật popup hệ thống cho push tới foreground).
 *
 * apiKey/appId trong FIREBASE_CONFIG không phải bí mật (Google thiết kế để
 * lộ trong code client, giới hạn quyền qua Firebase Security Rules/App Check
 * chứ không qua việc giấu key) — khác hẳn service-account JSON dùng để GỬI
 * push từ Apps Script, cái đó tuyệt đối không được đưa vào code (xem
 * pushForNotificationRow_() trong gsheets-api-v2.js + GHI_CHU_DU_AN.md).
 */
(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBbMw5HI4cJjcXJtPFglFn2yFKahSv8d9s',
    authDomain: 'hiconique-internal-hub-f77f2.firebaseapp.com',
    projectId: 'hiconique-internal-hub-f77f2',
    storageBucket: 'hiconique-internal-hub-f77f2.firebasestorage.app',
    messagingSenderId: '794909117053',
    appId: '1:794909117053:web:a9dd484a37d26288577f14'
  };
  var VAPID_KEY = 'BOTcOdpkB7gNluLXcYwF8K5lfW5vS0ho2RVpr4bEnyhKU7N6CYhIvZrYtzghtudIiyjkpFWsedJEFTsQggyI890';
  var PROMPTED_KEY = 'hiconique_push_prompted';
  var TOKEN_KEY = 'hiconique_fcm_token';

  var messagingInstance = null;

  function isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && typeof firebase !== 'undefined';
  }

  function ensureFirebaseApp() {
    if (!isSupported()) return null;
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      if (!messagingInstance) {
        messagingInstance = firebase.messaging();
        // Tab đang MỞ (foreground) — push tới không tự hiện popup hệ thống,
        // phải tự showNotification() giống hệt bên sw.js (onBackgroundMessage)
        // để 2 trường hợp nhìn giống nhau tuyệt đối.
        messagingInstance.onMessage(function (payload) {
          var n = payload.notification || {};
          var link = (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.link) || '/';
          if (Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(function (reg) {
              reg.showNotification(n.title || 'HICONIQUE', {
                body: n.body || '', icon: '/apple-touch-icon.png', badge: '/icon-192.png', data: { link: link }
              });
            });
          }
        });
      }
      return messagingInstance;
    } catch (e) {
      console.warn('[push] không khởi tạo được Firebase Messaging:', e);
      return null;
    }
  }

  function detectDevice() {
    var ua = navigator.userAgent;
    var browser = 'Trình duyệt';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\//.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';
    var os = 'thiết bị';
    if (/iPhone|iPad|iPod/.test(ua)) os = 'iPhone/iPad';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Mac OS X/.test(ua)) os = 'Mac';
    else if (/Windows/.test(ua)) os = 'Windows';
    return { label: browser + ' trên ' + os, browserFamily: browser };
  }

  function apiUrl() {
    return (typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL) || null;
  }

  function registerTokenWithBackend(token, user) {
    var url = apiUrl();
    if (!url || !token || !user) return;
    var dev = detectDevice();
    var data = { fcmToken: token, memberId: user.id, deviceLabel: dev.label, browserFamily: dev.browserFamily };
    fetch(url + '?action=registerPushDevice&data=' + encodeURIComponent(JSON.stringify(data)), { redirect: 'follow' }).catch(function () {});
  }

  function unregisterTokenFromBackend(token) {
    var url = apiUrl();
    if (!url || !token) return;
    fetch(url + '?action=unregisterPushDevice&fcmToken=' + encodeURIComponent(token), { redirect: 'follow' }).catch(function () {});
  }

  function getStatus() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission; // 'granted' | 'denied' | 'default'
  }

  function enable(user, callback) {
    if (!isSupported() || !user) { if (callback) callback(false); return; }
    Notification.requestPermission().then(function (perm) {
      try { localStorage.setItem(PROMPTED_KEY, '1'); } catch (e) {}
      if (perm !== 'granted') { if (callback) callback(false); return; }
      var messaging = ensureFirebaseApp();
      if (!messaging) { if (callback) callback(false); return; }
      navigator.serviceWorker.ready.then(function (reg) {
        messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).then(function (token) {
          if (token) {
            try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
            registerTokenWithBackend(token, user);
          }
          if (callback) callback(!!token);
        }).catch(function (e) {
          console.warn('[push] getToken lỗi:', e);
          if (callback) callback(false);
        });
      });
    });
  }

  function disable(callback) {
    var token = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
    if (token) unregisterTokenFromBackend(token);
    var messaging = ensureFirebaseApp();
    if (messaging && messaging.deleteToken) messaging.deleteToken().catch(function () {});
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    if (callback) callback(true);
  }

  // Đã cấp quyền từ trước (mở lại trang/thiết bị khác cùng tài khoản) — tự
  // làm mới đăng ký token mỗi lần mở app, KHÔNG hỏi lại permission (đã có
  // rồi). Bắt cả trường hợp hiếm token đổi + cập nhật "hoạt động gần nhất".
  function silentRefresh(user) {
    if (getStatus() !== 'granted') return;
    var messaging = ensureFirebaseApp();
    if (!messaging) return;
    navigator.serviceWorker.ready.then(function (reg) {
      messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).then(function (token) {
        if (token) {
          try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
          registerTokenWithBackend(token, user);
        }
      }).catch(function () {});
    });
  }

  // Banner nhỏ tự đóng, hỏi bật thông báo — KHÔNG dùng confirm()/alert() gốc
  // (chốt cứng của dự án, xem GHI_CHU_DU_AN.md mục QUY TẮC LÀM VIỆC CỐ ĐỊNH).
  function showEnableBanner(user) {
    if (document.getElementById('pushEnableBanner')) return;
    var el = document.createElement('div');
    el.id = 'pushEnableBanner';
    el.style.cssText = 'position:fixed; left:16px; right:16px; bottom:16px; z-index:10002; max-width:420px; margin:0 auto; padding:14px 16px; background:var(--color-surface,#1a1d21); border:1px solid var(--color-border,#333); border-left:4px solid var(--color-bronze,#B08D57); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.35); font-size:0.8125rem; color:var(--color-text,#fff); font-family:inherit;';
    el.innerHTML =
      '<div style="display:flex; align-items:flex-start; gap:10px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;margin-top:1px;color:var(--color-bronze,#B08D57);"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-weight:600; margin-bottom:2px;">Bật thông báo trên thiết bị này?</div>' +
          '<div style="color:var(--color-text-muted,#999); margin-bottom:10px;">Nhận thông báo việc mới, duyệt/từ chối... ngay cả khi không mở web.</div>' +
          '<div style="display:flex; gap:8px;">' +
            '<button type="button" id="pushEnableLater" style="flex:1; padding:7px 10px; background:var(--color-surface-2,#222); border:1px solid var(--color-border,#333); border-radius:6px; color:inherit; font-size:0.8125rem; cursor:pointer; font-family:inherit;">Để sau</button>' +
            '<button type="button" id="pushEnableNow" style="flex:1; padding:7px 10px; background:var(--color-bronze,#B08D57); border:none; border-radius:6px; color:#0B0D10; font-weight:600; font-size:0.8125rem; cursor:pointer; font-family:inherit;">Bật thông báo</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    function toast(message, ok) {
      var t = document.createElement('div');
      t.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10003; max-width:420px; padding:14px 18px; background:var(--color-surface,#1a1d21); border:1px solid var(--color-border,#333); border-left:4px solid ' + (ok ? 'var(--color-bronze,#B08D57)' : '#A04848') + '; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.25); font-size:0.875rem; color:var(--color-text,#fff); font-family:inherit;';
      t.textContent = message;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 4000);
    }

    document.getElementById('pushEnableLater').addEventListener('click', function () {
      try { localStorage.setItem(PROMPTED_KEY, '1'); } catch (e) {}
      el.remove();
    });
    document.getElementById('pushEnableNow').addEventListener('click', function () {
      el.remove();
      enable(user, function (ok) {
        toast(ok ? 'Đã bật thông báo trên thiết bị này.' : 'Không bật được thông báo (bị chặn hoặc trình duyệt không hỗ trợ).', ok);
      });
    });
  }

  function initAutoPrompt(user) {
    if (!isSupported() || !user) return;
    var status = getStatus();
    if (status === 'granted') { silentRefresh(user); return; }
    if (status === 'denied') return; // đã từ chối hẳn ở cấp trình duyệt, không hỏi lại được nữa
    var alreadyPrompted = false;
    try { alreadyPrompted = !!localStorage.getItem(PROMPTED_KEY); } catch (e) {}
    if (alreadyPrompted) return;
    // Chờ 1 chút để không chặn ngay lúc trang vừa load xong.
    setTimeout(function () { showEnableBanner(user); }, 2500);
  }

  window.PushNotify = {
    isSupported: isSupported,
    getStatus: getStatus,
    enable: enable,
    disable: disable,
    initAutoPrompt: initAutoPrompt
  };
})();
