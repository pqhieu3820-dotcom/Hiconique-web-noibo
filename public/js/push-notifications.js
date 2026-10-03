/**
 * Thông báo đẩy (Web Push qua Firebase Cloud Messaging) — 2026-09-23.
 *
 * Cho phép thông báo popup thật trên điện thoại/máy tính (giống Zalo), kể cả
 * khi không mở web — khác hẳn chuông trên thanh đầu trang (chỉ thấy khi đang mở trang).
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
          var d = payload.data || {}, n = payload.notification || {};   // 2026-10-03: máy chủ gửi data-only
          var link = d.link || (payload.fcmOptions && payload.fcmOptions.link) || '/';
          if (Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(function (reg) {
              reg.showNotification(d.title || n.title || 'HICONIQUE', {
                body: d.body || n.body || '', icon: '/apple-touch-icon.png', badge: '/icon-192.png', tag: 'hq-' + Date.now(), renotify: true, data: { link: link }
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
          registerTokenWithBackend(token, user);   // mỗi lần mở web khi ĐANG ĐĂNG NHẬP: làm mới "hoạt động gần nhất" (máy chủ chỉ gửi cho thiết bị còn mới)
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

  // ---------- 2026-10-03: danh sách thiết bị (API getPushDevices…) + nhắc đăng ký đủ 2 thiết bị ----------
  var REQUIRED_DEVICES = 2;   // nên có ít nhất 2 thiết bị (nhắc hằng ngày)
  var MAX_DEVICES = 5;        // 2026-10-04: tối đa 5 thiết bị / người (máy chủ cũng chặn)
  function localToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function isIos() { return /iPhone|iPad|iPod/.test(navigator.userAgent); }
  function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function api(action, data, extra) {
    var url = apiUrl(); if (!url) return Promise.reject(new Error('Chưa cấu hình API'));
    var q = url + '?action=' + action + (data ? '&data=' + encodeURIComponent(JSON.stringify(data)) : '') + (extra || '') + '&_=' + Date.now();
    return fetch(q, { redirect: 'follow' }).then(function (r) { return r.json(); });
  }
  function listDevices(user) {
    if (!user) return Promise.resolve({ devices: [] });
    return api('getPushDevices', null, '&actorId=' + encodeURIComponent(user.id)).then(function (res) {
      var tail = localToken().slice(-12);
      (res.devices || []).forEach(function (d) { d.isThis = !!tail && d.tokenTail === tail; });
      return res;
    });
  }
  function updateDevice(user, id, fields) { var d = { actorId: user.id, id: id }; for (var k in fields) d[k] = fields[k]; return api('updatePushDevice', d); }
  function deleteDevice(user, id) { return api('deletePushDevice', { actorId: user.id, id: id }); }
  function testDevice(user, id) { return api('testPushDevice', { actorId: user.id, id: id }); }
  function myActiveCount(res, user) { return (res.devices || []).filter(function (d) { return d.memberId === user.id && d.active; }).length; }

  // Bật thông báo + đợi máy chủ ghi xong (khác enable() cũ: trả Promise, dùng cho bảng thiết bị / hộp nhắc)
  function enableAndWait(user) {
    return new Promise(function (resolve) {
      if (!isSupported() || !user) return resolve({ ok: false, reason: isIos() && !isStandalone() ? 'ios' : 'unsupported' });
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') return resolve({ ok: false, reason: perm === 'denied' ? 'denied' : 'default' });
        var messaging = ensureFirebaseApp(); if (!messaging) return resolve({ ok: false, reason: 'unsupported' });
        navigator.serviceWorker.ready.then(function (reg) {
          return messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
        }).then(function (token) {
          if (!token) return resolve({ ok: false, reason: 'token' });
          try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
          var dev = detectDevice();
          api('registerPushDevice', { fcmToken: token, memberId: user.id, deviceLabel: dev.label, browserFamily: dev.browserFamily }).then(function (res) { if (res && res.error === 'DEVICE_LIMIT') { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} resolve({ ok: false, reason: 'limit' }); } else resolve({ ok: true }); }, function () { resolve({ ok: true }); });
        }).catch(function () { resolve({ ok: false, reason: 'token' }); });
      });
    });
  }
  function reasonText(r) {
    return r === 'limit' ? 'Tài khoản đã đủ ' + MAX_DEVICES + ' thiết bị nhận thông báo. Vào “Quản lý thiết bị” xoá bớt 1 thiết bị cũ rồi đăng ký lại thiết bị này.'
      : r === 'denied' ? 'Trình duyệt đang CHẶN thông báo của trang này. Bấm biểu tượng ổ khoá cạnh địa chỉ web → Thông báo → Cho phép, rồi tải lại trang.'
      : r === 'ios' ? 'Trên iPhone/iPad: mở web bằng Safari → nút Chia sẻ → “Thêm vào Màn hình chính”, mở app HICONIQUE từ màn hình chính rồi bật thông báo (Apple chỉ cho phép thông báo trong app đã thêm vào màn hình chính).'
      : r === 'default' ? 'Bạn chưa bấm “Cho phép” ở hộp hỏi của trình duyệt.'
      : 'Trình duyệt này không hỗ trợ thông báo đẩy — hãy dùng Chrome/Edge (máy tính, Android) hoặc Safari đã “Thêm vào Màn hình chính” (iPhone).';
  }

  // Nhắc MỖI NGÀY 1 lần (lần mở web đầu tiên trong ngày) cho tới khi tài khoản có đủ 2 thiết bị đang nhận thông báo.
  // "Để sau" chỉ ẩn tới hết hôm nay — KHÔNG có lựa chọn tắt hẳn (theo yêu cầu 03/10/2026).
  function showDevicePrompt(user, count, thisRegistered) {
    if (document.getElementById('pushDevicePrompt')) return;
    var status = getStatus(), canHere = !thisRegistered && status !== 'denied' && isSupported();
    var ov = document.createElement('div'); ov.id = 'pushDevicePrompt';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(10,12,15,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    var hint = thisRegistered ? 'Thiết bị này đã nhận thông báo. Hãy mở HICONIQUE trên <b>thiết bị còn lại</b> (điện thoại hoặc máy tính) và bấm “Bật thông báo”.'
      : (!isSupported() || status === 'denied') ? reasonText(!isSupported() ? (isIos() && !isStandalone() ? 'ios' : 'unsupported') : 'denied')
      : 'Bấm “Bật thông báo trên thiết bị này”, sau đó làm tương tự trên thiết bị còn lại.';
    ov.innerHTML = '<div style="width:100%;max-width:440px;background:var(--color-surface,#1a1d21);color:var(--color-text,#eee);border:1px solid var(--color-border,#333);border-radius:16px;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(0,0,0,.4);font-family:Inter,sans-serif;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="width:38px;height:38px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(176,141,87,.22),rgba(176,141,87,.08));box-shadow:inset 0 0 0 1px rgba(176,141,87,.28);color:var(--color-bronze,#B08D57);flex:0 0 auto;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9z"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/><path d="M12 3V2" /></svg></span>' +
      '<div style="font-weight:700;font-size:1rem;">Đăng ký nhận thông báo (' + count + '/' + REQUIRED_DEVICES + ' thiết bị)</div></div>' +
      '<div style="font-size:.875rem;line-height:1.55;color:var(--color-text-muted,#aaa);margin-bottom:6px;">Nên nhận thông báo trên ít nhất <b>2 thiết bị</b> (máy tính + điện thoại), tối đa <b>' + MAX_DEVICES + '</b>, để không bỏ lỡ việc mới, duyệt/từ chối, bảng tin… Chỉ thiết bị <b>đang đăng nhập</b> mới nhận; đăng xuất hoặc lâu không đăng nhập sẽ tự ngừng nhận.</div>' +
      '<div id="pdpHint" style="font-size:.8125rem;line-height:1.55;margin:10px 0 16px;padding:10px 12px;border-radius:10px;background:var(--color-surface-2,#222);">' + hint + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" id="pdpLater" style="flex:1;min-width:120px;height:40px;border-radius:10px;border:1px solid var(--color-border,#333);background:transparent;color:inherit;font-weight:600;cursor:pointer;">Để sau</button>' +
        '<a href="/pages/notices.html#devices" style="flex:1;min-width:120px;height:40px;border-radius:10px;border:1px solid var(--color-border,#333);display:inline-flex;align-items:center;justify-content:center;color:inherit;text-decoration:none;font-weight:600;font-size:.875rem;">Quản lý thiết bị</a>' +
        (isSupported() && !thisRegistered ? '<button type="button" id="pdpAsk" style="flex:1 1 100%;height:40px;border-radius:10px;border:1px solid var(--color-bronze,#B08D57);background:transparent;color:var(--color-bronze,#B08D57);font-weight:700;cursor:pointer;">Yêu cầu cấp phép lại</button>' : '') +
        (canHere ? '<button type="button" id="pdpNow" style="flex:1 1 100%;height:42px;border-radius:10px;border:none;background:var(--color-bronze,#B08D57);color:#0B0D10;font-weight:700;cursor:pointer;">Bật thông báo trên thiết bị này</button>' : '') +
      '</div><div style="font-size:.6875rem;color:var(--color-text-faint,#777);margin-top:10px;">Thông báo này sẽ nhắc lại mỗi ngày cho tới khi đủ 2 thiết bị.</div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    document.getElementById('pdpLater').addEventListener('click', close);
    // 2026-10-04: nút "Yêu cầu cấp phép lại" — hỏi lại quyền thông báo; nếu trình duyệt đã CHẶN (không hỏi lại được) thì hướng dẫn mở khoá
    // và TỰ phát hiện khi người dùng vừa bật lại quyền (không cần tải lại trang) để đăng ký thiết bị luôn.
    var ask = document.getElementById('pdpAsk'), hintEl = document.getElementById('pdpHint'), watching = false, copyBtn = null;
    var onOk = function () { if (ask) { ask.textContent = 'Đã bật trên thiết bị này ✓'; ask.disabled = true; } hintEl.textContent = 'Thiết bị này đã nhận thông báo.'; if (copyBtn) copyBtn.remove(); setTimeout(close, 1500); };
    // Trình duyệt KHÔNG cho trang web ép hiện lại hộp "Cho phép" sau khi đã chặn (quy định bảo mật của Chrome/Edge/Firefox/Safari).
    // Cách duy nhất: người dùng bật quyền trong cài đặt trình duyệt — nên ta (1) hỏi ngay nếu còn hỏi được, (2) nếu đã chặn thì hướng dẫn đúng theo trình duyệt
    // + nút sao chép địa chỉ trang cài đặt, (3) tự nhận khi quyền vừa được bật (onchange / quay lại tab / mỗi 2 giây) rồi đăng ký thiết bị luôn.
    var fam = detectDevice().browserFamily, os = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'pc';
    var settingsUrl = fam === 'Edge' ? 'edge://settings/content/notifications' : fam === 'Chrome' ? 'chrome://settings/content/notifications' : fam === 'Opera' ? 'opera://settings/content/notifications' : fam === 'Firefox' ? 'about:preferences#privacy' : '';
    var steps = function () {
      if (os === 'ios') return 'Trình duyệt đang CHẶN nên web không hỏi lại được. iPhone/iPad: Cài đặt → Thông báo → HICONIQUE (app đã thêm vào Màn hình chính) → bật “Cho phép thông báo”.';
      if (os === 'android') return 'Trình duyệt đang CHẶN nên web không hỏi lại được. Android: bấm ổ khoá/ⓘ cạnh địa chỉ web → Quyền/Cài đặt trang → Thông báo → Cho phép (hoặc Cài đặt máy → Ứng dụng → trình duyệt/HICONIQUE → Thông báo → bật).';
      return 'Trình duyệt đang CHẶN nên web không hỏi lại được. Bấm ổ khoá (hoặc ⓘ) cạnh địa chỉ web → Thông báo → đổi thành “Cho phép”' + (settingsUrl ? ', hoặc dán ' + settingsUrl + ' vào thanh địa chỉ, tìm trang này và chọn Cho phép' : '') + '. Làm xong trang tự nhận, không cần tải lại.';
    };
    var startWatch = function () {
      if (watching) return; watching = true;
      var check = function () { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { clearInterval(iv); tryAsk(); } };
      var iv = setInterval(function () { if (!document.getElementById('pushDevicePrompt')) return clearInterval(iv); check(); }, 2000);
      window.addEventListener('focus', check); document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
      if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'notifications' }).then(function (ps) { ps.onchange = check; }).catch(function () {});
    };
    var tryAsk = function () {
      if (ask) { ask.disabled = true; ask.textContent = 'Đang yêu cầu…'; }
      enableAndWait(user).then(function (r) {
        if (r.ok) return onOk();
        if (ask) { ask.disabled = false; ask.textContent = r.reason === 'denied' ? 'Tôi đã cho phép — thử lại' : 'Yêu cầu cấp phép lại'; }
        if (r.reason === 'denied') {
          hintEl.textContent = steps(); startWatch();
          if (settingsUrl && !copyBtn && ask) {
            copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.textContent = 'Sao chép địa chỉ trang cài đặt';
            copyBtn.style.cssText = 'flex:1 1 100%;height:36px;border-radius:10px;border:1px dashed var(--color-border,#333);background:transparent;color:inherit;font-weight:600;font-size:.8125rem;cursor:pointer;';
            copyBtn.addEventListener('click', function () { var done = function () { copyBtn.textContent = 'Đã sao chép — dán vào thanh địa chỉ ✓'; }; try { navigator.clipboard.writeText(settingsUrl).then(done, function () { copyBtn.textContent = settingsUrl; }); } catch (e) { copyBtn.textContent = settingsUrl; } });
            ask.after(copyBtn);
          }
        } else hintEl.textContent = reasonText(r.reason);
      });
    };
    if (ask) ask.addEventListener('click', tryAsk);
    var now = document.getElementById('pdpNow');
    if (now) now.addEventListener('click', function () {
      now.disabled = true; now.textContent = 'Đang bật…';
      enableAndWait(user).then(function (r) {
        if (r.ok) { now.textContent = 'Đã bật trên thiết bị này ✓'; setTimeout(close, 1500); }
        else { now.disabled = false; now.textContent = 'Thử lại'; document.getElementById('pdpHint').textContent = reasonText(r.reason); }
      });
    });
  }

  function initAutoPrompt(user) {
    if (!user) return;
    if (isSupported() && getStatus() === 'granted') silentRefresh(user);
    var key = 'hiconique_push_nag_' + user.id, today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(key) === today) return; } catch (e) {}
    setTimeout(function () {
      listDevices(user).then(function (res) {
        if (!res || res.error) return;
        var cnt = myActiveCount(res, user);
        if (cnt >= REQUIRED_DEVICES) return;
        try { localStorage.setItem(key, today); } catch (e) {}   // đã nhắc hôm nay → mai nhắc tiếp (không có nút tắt hẳn)
        var tail = localToken().slice(-12), thisReg = (res.devices || []).some(function (d) { return d.memberId === user.id && d.active && tail && d.tokenTail === tail; });
        showDevicePrompt(user, cnt, thisReg && getStatus() === 'granted');
      }).catch(function () {});
    }, 2500);
  }

  window.PushNotify = {
    isSupported: isSupported,
    getStatus: getStatus,
    enable: enable,
    enableAndWait: enableAndWait,
    disable: disable,
    initAutoPrompt: initAutoPrompt,
    listDevices: listDevices,
    updateDevice: updateDevice,
    deleteDevice: deleteDevice,
    testDevice: testDevice,
    reasonText: reasonText,
    REQUIRED_DEVICES: REQUIRED_DEVICES,
    MAX_DEVICES: MAX_DEVICES
  };
})();
