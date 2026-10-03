/**
 * Google Sheets Configuration - HICONIQUE Task Manager
 * Sheet đã publish đầy đủ
 */
const GSHEETS_CONFIG = {
  // Google Apps Script Web App URL — dùng cho CẢ đọc lẫn ghi.
  // (Trước đây đọc qua CSV publish-to-web, nhưng sau khi đổi tên cột Sheet
  //  sang tiếng Việt thì CSV trả header tiếng Việt làm hỏng toàn bộ web —
  //  giờ mọi thao tác đọc/ghi đều qua Apps Script để được dịch VI↔EN, xem
  //  FIELD_MAP/VALUE_MAP trong gsheets-api-v2.js.)
  API_URL: 'https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec',

  // Bật chế độ Google Sheets
  USE_GSHEETS: true
};

// 2026-10-03 BẢO MẬT: API giờ yêu cầu "vé" đăng nhập (token ký bởi máy chủ, xem secureEntry_ trong gsheets-api-v2.js).
// Bọc window.fetch để MỌI lệnh gọi tới API_URL (dù ở file nào) tự gắn ?tk=<vé> lấy từ phiên đăng nhập hiện tại — không phải sửa
// hàng chục chỗ gọi fetch. Máy chủ trả {error:'AUTH_REQUIRED'} (vé hết hạn/bị đổi khoá) → xoá phiên, tải lại để hiện màn đăng nhập.
(function () {
  if (typeof window === 'undefined' || !window.fetch || window.__hqAuthFetchWrapped) return;
  window.__hqAuthFetchWrapped = true;
  var nativeFetch = window.fetch.bind(window), api = GSHEETS_CONFIG.API_URL, SESSION_KEY = 'hiconique_auth_session', kicked = false;
  function token() { try { var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return (s && s.token) || ''; } catch (e) { return ''; } }
  GSHEETS_CONFIG.getToken = token;
  window.fetch = function (input, init) {
    if (typeof input !== 'string' || input.indexOf(api) !== 0) return nativeFetch(input, init);
    var tk = token();
    if (tk && input.indexOf('tk=') < 0) input += (input.indexOf('?') < 0 ? '?' : '&') + 'tk=' + encodeURIComponent(tk);
    return nativeFetch(input, init).then(function (res) {
      if (!kicked && res && res.type !== 'opaque') {
        res.clone().text().then(function (t) {
          if (t.length < 200 && t.indexOf('AUTH_REQUIRED') >= 0 && !kicked) {
            kicked = true;
            var home = location.pathname === '/' || /\/index\.html$/.test(location.pathname);
            if (tk) {
              try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* bỏ qua */ }
              alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
              if (home) window.location.reload(); else window.location.href = '/';
            } else if (!home) {
              window.location.href = '/';   // trang con mở khi chưa đăng nhập → về trang chủ để đăng nhập
            }
          }
        }).catch(function () { /* bỏ qua */ });
      }
      return res;
    });
  };
})();
