// HICONIQUE Hub — cổng xác thực toàn site bằng Cookie + Netlify Blobs.
// Thay thế basic-auth.js (HTTP Basic Auth) cũ. Toàn bộ traffic "/*" đi qua
// đây (xem netlify.toml) trước khi tới file tĩnh thật trong public/.
//
// Tính năng A — Hẹn giờ tự huỷ: cookie session luôn Expires vào đúng 1:00
// sáng (giờ VN, UTC+7) của NGÀY HÔM SAU tính từ lúc đăng nhập — không phải
// "24 giờ sau", nên đăng nhập lúc 23h sẽ hết hạn chỉ sau ~2 giờ, còn đăng
// nhập lúc 8h sáng sẽ hết hạn sau ~17 giờ. Đây là chủ đích (ép đăng nhập
// lại mỗi ngày làm việc mới).
//
// Tính năng B — 1 thiết bị / 1 phiên: session_id hợp lệ duy nhất được lưu
// trong Netlify Blobs (store "hiconique-auth", key "current-session"). Mỗi
// request đối chiếu cookie với giá trị này; ai đăng nhập sau sẽ ghi đè giá
// trị trong Blobs, khiến mọi cookie cũ (thiết bị khác) tự động sai khớp và
// bị đẩy về /login.html — không cần token blacklist hay theo dõi danh sách
// thiết bị, chỉ cần 1 giá trị "current" là đủ.

import { getStore } from 'npm:@netlify/blobs';

const COOKIE_NAME = 'hiconique_session';
const BLOB_STORE = 'hiconique-auth';
const BLOB_KEY = 'current-session';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7, Việt Nam không có DST

// Mật khẩu chung: tái dùng đúng biến môi trường AUTH_USERS đã có sẵn trên
// Netlify từ thời Basic Auth cũ (định dạng "user:pass,user2:pass2,...") —
// khỏi phải tạo biến mới trên dashboard. login.html chỉ có 1 ô mật khẩu
// (không có username) nên chấp nhận nếu khớp với BẤT KỲ password nào có
// trong danh sách đó. Nếu chưa từng set AUTH_USERS, fallback về đúng mật
// khẩu mặc định "Hiconique@2026" như đặc tả ban đầu.
function getValidPasswords() {
  const raw = Netlify.env.get('AUTH_USERS');
  if (!raw) return ['Hiconique@2026'];
  const passwords = raw
    .split(',')
    .map((pair) => {
      const idx = pair.indexOf(':');
      return idx === -1 ? pair.trim() : pair.slice(idx + 1).trim();
    })
    .filter(Boolean);
  return passwords.length ? passwords : ['Hiconique@2026'];
}

// Đường dẫn không cần đăng nhập mới xem được — login.html tự chứa toàn bộ
// CSS/JS (không gọi ra /css/*.css hay /js/*.js của site), nên chỉ cần trừ
// đúng các path này, không cần whitelist thêm asset nào khác.
const PUBLIC_PATHS = new Set(['/login.html', '/login-submit', '/favicon.svg', '/favicon.ico']);

function randomSessionId() {
  return crypto.randomUUID();
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

// Trả về Date (UTC thật) tương ứng 01:00:00 giờ VN của ngày hôm sau, tính
// từ thời điểm hiện tại. Cách làm: dịch "now" +7h rồi đọc các trường UTC —
// lúc đó các trường UTC (năm/tháng/ngày) chính là ngày-giờ VN thực tế. Từ
// đó dựng mốc "ngày+1, 01:00" trong cùng hệ dịch, rồi dịch ngược -7h để ra
// đúng thời điểm UTC thật dùng cho header Expires.
function nextOneAmVietnamUTC() {
  const now = new Date();
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const nextDay1amShifted = new Date(Date.UTC(y, m, d + 1, 1, 0, 0, 0));
  return new Date(nextDay1amShifted.getTime() - VN_OFFSET_MS);
}

function buildSessionCookie(sessionId, expiresUTC) {
  return (
    `${COOKIE_NAME}=${sessionId}; Path=/; Expires=${expiresUTC.toUTCString()}; ` +
    'HttpOnly; Secure; SameSite=Lax'
  );
}

export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const store = getStore(BLOB_STORE);

  // ── /login-submit: xử lý form đăng nhập từ login.html ──
  if (path === '/login-submit') {
    if (request.method !== 'POST') {
      return Response.redirect(new URL('/login.html', url), 303);
    }

    let password = '';
    try {
      const form = await request.formData();
      password = String(form.get('password') || '');
    } catch (_err) {
      password = '';
    }

    if (!getValidPasswords().includes(password)) {
      return Response.redirect(new URL('/login.html?error=1', url), 303);
    }

    // Tính năng B: tạo session mới + ghi đè Blobs — mọi phiên cũ (thiết bị
    // khác) lập tức bị vô hiệu hoá vì Blobs chỉ giữ đúng 1 giá trị "current".
    const sessionId = randomSessionId();
    await store.set(BLOB_KEY, sessionId);

    // Tính năng A: Expires = 1h sáng VN của ngày hôm sau.
    const expires = nextOneAmVietnamUTC();

    const headers = new Headers();
    headers.set('Location', '/');
    headers.set('Set-Cookie', buildSessionCookie(sessionId, expires));
    return new Response(null, { status: 303, headers });
  }

  // ── Các path công khai (trang login + asset của nó) ──
  if (PUBLIC_PATHS.has(path)) {
    return context.next();
  }

  // ── Mọi path còn lại: đối chiếu cookie với session hiện hành trong Blobs ──
  const cookies = parseCookies(request.headers.get('cookie'));
  const sessionId = cookies[COOKIE_NAME];
  const currentSession = sessionId ? await store.get(BLOB_KEY, { type: 'text' }) : null;

  if (sessionId && currentSession && sessionId === currentSession) {
    return context.next();
  }

  return Response.redirect(new URL('/login.html', url), 303);
};
