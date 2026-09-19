/* HICONIQUE Portal — small UI behaviors.
   - Clock
   - Search overlay open/close
   - Theme toggle (light/dark)
   - Team grid render (uses a static dataset — replace with API for production)
*/
(function () {
  'use strict';

  // ----- Theme Toggle -----
  var themeToggle = document.querySelectorAll('[data-theme-toggle]');
  var html = document.documentElement;
  var state = { miniTaskFilter: 'all' };

  function getSyncUser() {
    return (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
  }

  // Giao diện sáng/tối nhớ THEO TÀI KHOẢN (field `theme` của Thành viên,
  // đồng bộ qua Google Sheets), không chỉ theo trình duyệt/máy — đăng nhập
  // lại ở máy/trình duyệt khác vẫn ra đúng theme đã chọn ở lần cuối. Vẫn ghi
  // localStorage song song để áp dụng ngay (không nháy màn hình) trước khi
  // đọc được dữ liệu tài khoản.
  function setTheme(theme, skipAccountSync) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('hiconique-theme', theme);
    if (skipAccountSync) return;
    var user = getSyncUser();
    if (user && typeof TaskManager !== 'undefined' && TaskManager.updateMember) {
      TaskManager.updateMember(user.id, { theme: theme }, user);
    }
  }

  function initTheme() {
    var saved = localStorage.getItem('hiconique-theme');
    if (saved === 'light' || saved === 'dark') {
      html.setAttribute('data-theme', saved);
    }
    // Default is dark (html has data-theme="dark" in markup)

    // Tài khoản là nguồn đúng cuối cùng — nếu khác với localStorage của máy
    // này (VD lần trước đăng nhập ở máy khác rồi đổi theme), áp dụng lại theo
    // tài khoản (skipAccountSync=true vì đang ĐỌC lại giá trị đã lưu, không
    // phải người dùng vừa bấm đổi — không cần ghi ngược lên Sheet).
    var user = getSyncUser();
    var member = (user && typeof TaskManager !== 'undefined' && TaskManager.getMember) ? TaskManager.getMember(user.id) : null;
    if (member && (member.theme === 'light' || member.theme === 'dark') && member.theme !== saved) {
      setTheme(member.theme, true);
    }
  }

  initTheme();

  // Add click handlers for all theme toggles
  themeToggle.forEach(function(toggle) {
    toggle.addEventListener('click', function () {
      var current = html.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  });

  // ----- Clock (live) -----
  function updateClock() {
    var el = document.querySelector('[data-clock]');
    if (!el) return;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    el.textContent = hh + ':' + mm;
    var timeEl = document.getElementById('heroStatTime');
    if (timeEl) timeEl.textContent = hh + ':' + mm + ':' + ss;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ----- Hero stat: real-time date + active members -----
  var VI_DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  // Đặt trước updateHeroStat() vì nó dùng ngay PRESENCE_ONLINE_WINDOW_MS ở
  // lần gọi đầu tiên (bên dưới) — khai báo sau sẽ bị hoisting làm undefined
  // đúng lần gọi đó.
  var PRESENCE_PING_MS = 60000;
  var PRESENCE_ONLINE_WINDOW_MS = 3 * 60 * 1000; // coi là online nếu ping trong 3 phút gần nhất

  function updateHeroStat() {
    var dateEl = document.getElementById('heroStatDate');
    var totalEl = document.getElementById('heroStatTotal');
    var onlineEl = document.getElementById('heroStatOnline');
    var numberEl = document.getElementById('heroStatNumber');
    var dotEl = document.getElementById('heroStatDot');
    if (!dateEl) return;

    var now = new Date();
    var dow = VI_DOW[now.getDay()];
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var yyyy = now.getFullYear();
    dateEl.textContent = dow + ', ' + dd + '/' + mm + '/' + yyyy;

    var members = (typeof TaskManager !== 'undefined' && TaskManager.getMembers) ? TaskManager.getMembers() : [];

    // "Đang hoạt động" = có ping presence (lastActiveAt, xem
    // startPresenceHeartbeat() dưới) trong PRESENCE_ONLINE_WINDOW_MS gần đây
    // — tức thật sự đang mở & dùng web, không phải suy đoán theo giờ hành
    // chính như trước (2026-09-10, trước đó hiện cứng total/total suốt giờ
    // làm dù chỉ 1 người đang mở web — sai với thực tế người dùng phản hồi).
    var nowMs = now.getTime();
    var onlineCount = members.filter(function (m) {
      if (!m.lastActiveAt) return false;
      var t = new Date(m.lastActiveAt).getTime();
      return !isNaN(t) && (nowMs - t) <= PRESENCE_ONLINE_WINDOW_MS;
    }).length;
    var totalCount = members.length;

    if (totalEl) totalEl.textContent = totalCount;
    if (onlineEl) onlineEl.textContent = onlineCount;
    if (numberEl) numberEl.textContent = onlineCount;
    if (dotEl) {
      dotEl.style.background = onlineCount > 0 ? '#4F6F52' : '#A04848';
    }
  }
  updateHeroStat();

  // Nếu đang ở trang chủ (có phần tử hero stat) thì định kỳ lấy lại dữ liệu
  // thành viên mới nhất từ Google Sheets rồi tính lại — nếu không sẽ chỉ thấy
  // đúng bản cache tải lúc mở trang, không thấy người khác vừa online/offline.
  // Chỉ polling khi thật sự cần (có phần tử hero) để không gọi API thừa ở
  // các trang khác.
  function refreshHeroStat() {
    if (!document.getElementById('heroStatOnline')) return;
    if (typeof TaskManager !== 'undefined' && TaskManager.refreshFromGSheets) {
      TaskManager.refreshFromGSheets(function () { updateHeroStat(); });
    } else {
      updateHeroStat();
    }
  }
  setInterval(refreshHeroStat, 45000);

  // ----- Presence heartbeat -----
  // Ping timestamp lên Sheet (field `lastActiveAt` của Thành viên) mỗi ~60s
  // trong lúc tab đang mở & hiển thị (tạm dừng khi chuyển sang tab khác/thu
  // nhỏ), để BẤT KỲ máy nào cũng tính được đúng ai đang thực sự mở web —
  // đây là cách duy nhất để biết "online" thật vì hệ thống không có server
  // real-time, chỉ có Google Sheets làm nguồn dữ liệu chung.
  function pingPresence() {
    var user = getSyncUser();
    if (!user || typeof TaskManager === 'undefined' || !TaskManager.updateMember) return;
    TaskManager.updateMember(user.id, { lastActiveAt: new Date().toISOString() }, user);
  }

  function startPresenceHeartbeat() {
    if (!getSyncUser()) return;
    pingPresence(); // ping ngay khi mở trang, không chờ hết chu kỳ đầu
    setInterval(function () {
      if (document.visibilityState === 'visible') pingPresence();
    }, PRESENCE_PING_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pingPresence();
    });
  }
  startPresenceHeartbeat();
  setInterval(updateHeroStat, 30000);

  // ----- Search overlay (self-installing so every page gets a working search, not just index.html) -----
  (function ensureSearchToggleButton() {
    var actions = document.querySelector('.header-actions');
    if (!actions || actions.querySelector('[data-search-toggle]')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.setAttribute('aria-label', 'Tìm kiếm');
    btn.setAttribute('data-search-toggle', '');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>';
    actions.insertBefore(btn, actions.firstChild);
  })();

  var overlay = document.querySelector('[data-search-overlay]');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.setAttribute('data-search-overlay', '');
    overlay.hidden = true;
    document.body.appendChild(overlay);
  }
  if (!overlay.querySelector('[data-search-results]')) {
    var existingBox = overlay.querySelector('.search-box');
    var panel = document.createElement('div');
    panel.className = 'search-panel';
    if (existingBox) {
      existingBox.parentNode.insertBefore(panel, existingBox);
      panel.appendChild(existingBox);
    } else {
      panel.innerHTML =
        '<div class="search-box" role="search">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>' +
          '<input type="search" placeholder="Tìm công cụ, tài liệu, đồng nghiệp…" aria-label="Tìm kiếm" data-search-input />' +
          '<kbd>ESC</kbd>' +
        '</div>';
      overlay.appendChild(panel);
    }
    var resultsPanel = document.createElement('div');
    resultsPanel.className = 'search-results';
    resultsPanel.setAttribute('data-search-results', '');
    resultsPanel.hidden = true;
    panel.appendChild(resultsPanel);
  }

  var toggle = document.querySelectorAll('[data-search-toggle]');
  var input = overlay.querySelector('[data-search-input]');
  var resultsBox = overlay.querySelector('[data-search-results]');

  var SEARCH_PAGES = [
    { title: 'Trang chủ', sub: 'Không gian làm việc', url: '/', group: 'Trang' },
    { title: 'Task Manager', sub: 'Quản lý công việc, Kanban', url: '/pages/tasks-manager.html', group: 'Công cụ' },
    { title: 'Dự án', sub: 'Board / List / Timeline / Gantt', url: '/pages/projects.html', group: 'Công cụ' },
    { title: 'Bảng tiến độ', sub: 'Theo dõi tiến độ công việc', url: '/pages/progress-board.html', group: 'Công cụ' },
    { title: 'Chấm công', sub: 'Check-in / Check-out hàng ngày', url: '/pages/timesheet.html', group: 'Công cụ' },
    { title: 'Phiếu lương', sub: 'Đề xuất thanh toán lương hàng tháng', url: '/pages/payslip.html', group: 'Công cụ' },
    { title: 'Hoa hồng dự án', sub: 'Cấu hình và tính hoa hồng theo dự án', url: '/pages/commission.html', group: 'Công cụ' },
    { title: 'Bảng giá dịch vụ', sub: 'Soạn báo giá, xuất Excel/PDF cho khách', url: '/pages/pricing.html', group: 'Công cụ' },
    { title: 'Tài chính công ty', sub: 'Lãi/lỗ, dòng tiền, vay nợ — CEO-only', url: '/pages/finance.html', group: 'Công cụ' },
    { title: 'Tài liệu / Wiki', sub: 'Quy trình, biểu mẫu, hướng dẫn', url: '/pages/wiki.html', group: 'Tài liệu' },
    { title: 'SPC', sub: 'Kiểm soát chất lượng', url: '/pages/spc.html', group: 'Tài liệu' },
    { title: 'Thông báo', sub: 'Tin tức và thông báo nội bộ', url: '/pages/notices.html', group: 'Trang' },
    { title: 'Team', sub: 'Danh bạ nhân sự', url: '/pages/team.html', group: 'Trang' },
    { title: 'Thông tin cá nhân', sub: 'Hồ sơ, đổi mật khẩu', url: '/pages/profile.html', group: 'Trang' },
    { title: 'Dashboard của tôi', sub: 'Tổng quan công việc cá nhân', url: '/pages/my-dashboard.html', group: 'Trang' }
  ];

  function searchMembers() {
    if (typeof TaskManager === 'undefined' || !TaskManager.getMembers) return [];
    return TaskManager.getMembers().map(function (m) {
      return {
        title: m.name || '—',
        sub: (m.role || m.position || 'Nhân sự') + (m.email ? ' · ' + m.email : ''),
        url: '/pages/team.html',
        group: 'Đồng nghiệp'
      };
    });
  }

  var SEARCH_ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

  function renderSearchResults(query) {
    if (!resultsBox) return;
    var q = query.trim().toLowerCase();
    if (!q) {
      resultsBox.hidden = true;
      resultsBox.innerHTML = '';
      return;
    }

    var pool = SEARCH_PAGES.concat(searchMembers());
    var matches = pool.filter(function (item) {
      return (item.title + ' ' + item.sub).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);

    resultsBox.hidden = false;

    if (matches.length === 0) {
      resultsBox.innerHTML = '<p class="search-empty">Không tìm thấy kết quả cho "' + escapeHtml(query) + '"</p>';
      return;
    }

    var groups = [];
    var byGroup = {};
    matches.forEach(function (m) {
      if (!byGroup[m.group]) { byGroup[m.group] = []; groups.push(m.group); }
      byGroup[m.group].push(m);
    });

    resultsBox.innerHTML = groups.map(function (g) {
      return '<p class="search-result-group">' + escapeHtml(g) + '</p>' + byGroup[g].map(function (item) {
        return '<a class="search-result-item" href="' + item.url + '">' +
          SEARCH_ICON_ARROW +
          '<span><strong>' + escapeHtml(item.title) + '</strong><br><small>' + escapeHtml(item.sub) + '</small></span>' +
        '</a>';
      }).join('');
    }).join('');
  }

  function openSearch() {
    if (!overlay) return;
    overlay.hidden = false;
    if (input) { input.value = ''; }
    if (resultsBox) { resultsBox.hidden = true; resultsBox.innerHTML = ''; }
    setTimeout(function () { input && input.focus(); }, 30);
  }
  function closeSearch() {
    if (!overlay) return;
    overlay.hidden = true;
  }

  toggle.forEach(function (btn) { btn.addEventListener('click', openSearch); });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeSearch();
  });
  input && input.addEventListener('input', function () { renderSearchResults(input.value); });
  input && input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var first = resultsBox && resultsBox.querySelector('.search-result-item');
      if (first) window.location.href = first.getAttribute('href');
    }
  });
  document.addEventListener('keydown', function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (e.key === '/' && overlay.hidden && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') closeSearch();
  });

  // Small line-icon set reused by the team directory modal and the account menu.
  var ICON = {
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6.5-9 12-9 12s-9-5.5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    cake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-6a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v6"/><path d="M4 16h16"/><path d="M12 8V5m-3 3V6m6 2V6"/><path d="M12 3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/></svg>'
  };

  // ----- Team directory (from Google Sheets via TaskManager) -----
  // KHÔNG dùng alert()/confirm() gốc của trình duyệt (chốt cứng 2026-09-15 —
  // dialog native chặn hẳn main thread, làm treo cứng tab thật khi test bằng
  // Claude in Chrome, phát hiện lại lần nữa khi test luồng Từ chối/Duyệt lại
  // ở đây). Copy y hệt pattern showConfirmDialog()/showToast() đã có sẵn
  // trong timesheet.html — cùng tên hàm/class CSS để nhất quán.
  function showToast(message, ok) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10001; max-width:420px; padding:14px 18px; background:var(--color-surface); border:1px solid var(--color-border); border-left:4px solid ' + (ok === false ? '#A04848' : 'var(--color-bronze)') + '; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.25); font-size:0.875rem; color:var(--color-text);';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  function showConfirmDialog(title, onConfirm, confirmLabel) {
    var overlay = document.createElement('div');
    overlay.className = 'ts-confirm-overlay';
    overlay.innerHTML =
      '<div class="ts-confirm-box">' +
        '<div class="ts-confirm-title">' + title + '</div>' +
        '<div class="ts-confirm-actions">' +
          '<button type="button" class="ts-confirm-cancel">Huỷ</button>' +
          '<button type="button" class="ts-confirm-ok">' + (confirmLabel || 'Xác nhận') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.ts-confirm-cancel').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('.ts-confirm-ok').addEventListener('click', function () {
      overlay.remove();
      onConfirm();
    });
  }

  function getInitials(name) {
    if (!name) return '??';
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[parts.length - 2] || '').charAt(0) + (parts[parts.length - 1] || '').charAt(0);
  }

  function daysAtCompany(createdAt) {
    if (!createdAt) return null;
    var start = new Date(createdAt);
    if (isNaN(start.getTime())) return null;
    var now = new Date();
    var diffMs = now - start;
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // Ngày "Làm việc từ" trên sheet Members có thể bị sửa tay thành 1 giá trị
  // không parse được (VD gõ nhầm định dạng) — new Date(...) khi đó trả về
  // "Invalid Date", nếu hiện thẳng ra thẻ team sẽ vừa sai vừa tràn khung
  // (chuỗi "Invalid Date · NaN ngày" dài hơn text bình thường). Trả về ''
  // để phần UI ẩn hẳn dòng ngày làm việc thay vì hiện rác.
  function formatJoinDate(createdAt) {
    if (!createdAt) return '';
    var d = new Date(createdAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Tài khoản bị Từ chối tự động XOÁ VĨNH VIỄN sau đúng 48h kể từ lúc bị từ
  // chối (server tự stamp `rejectedAt` — xem stampMemberRejection() trong
  // gsheets-api-v2.js). Client chỉ cần cộng thêm 48h để biết mốc xoá, không
  // cần đọc thêm field nào khác qua API — tính lại y hệt logic server dùng
  // để quyết định có xoá hay không (deleteExpiredRejectedMembers()).
  var REJECTION_DELETE_AFTER_MS = 48 * 60 * 60 * 1000;
  function rejectionDeleteAt(rejectedAt) {
    if (!rejectedAt) return null;
    var t = new Date(rejectedAt).getTime();
    return isNaN(t) ? null : t + REJECTION_DELETE_AFTER_MS;
  }

  function formatCountdown(deleteAt) {
    var remain = deleteAt - Date.now();
    if (remain <= 0) return 'Đã tới hạn — chờ hệ thống xoá';
    var totalSec = Math.floor(remain / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    return 'Còn ' + h + ':' + pad2(m) + ':' + pad2(s) + ' trước khi bị xoá vĩnh viễn';
  }

  function formatAbsoluteDeleteTime(deleteAt) {
    var d = new Date(deleteAt);
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' ngày ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // 1 vòng lặp DUY NHẤT (không phải mỗi thẻ 1 setInterval riêng — tốn tài
  // nguyên nếu team có nhiều người bị từ chối cùng lúc) tự cập nhật MỌI phần
  // tử đang gắn [data-reject-countdown] hiện có trên trang, mỗi giây 1 lần.
  // An toàn nếu không có phần tử nào (team-card bị gỡ khỏi DOM khi loadTeam()
  // render lại) — querySelectorAll trả rỗng, vòng lặp không làm gì.
  setInterval(function () {
    document.querySelectorAll('[data-reject-countdown]').forEach(function (el) {
      var deleteAt = parseInt(el.getAttribute('data-reject-countdown'), 10);
      if (!deleteAt) return;
      el.textContent = formatCountdown(deleteAt);
    });
  }, 1000);

  function renderTeamGrid(members) {
    var grid = document.getElementById('team-grid');
    var countEl = document.querySelector('.eyebrow-count');
    if (!grid) return;

    if (countEl) {
      countEl.textContent = (members.length > 0 ? members.length : '…') + ' thành viên';
    }

    if (!members || members.length === 0) {
      grid.innerHTML = '<p style="color:#9AA0A6;padding:2rem;text-align:center;">Đang tải dữ liệu team…</p>';
      return;
    }

    grid.innerHTML = members.map(function (m, i) {
      var initials = m.avatar || getInitials(m.name);
      var color = m.color || '#6B7280';
      var role = m.role || m.position || '';
      // 2026-09-18: thẻ Team bỏ hẳn badge Cấp bậc (Founder/CEO/Quản lý/...) —
      // người dùng thấy thừa vì chức danh (role) đã đủ nói lên vai trò, chỗ
      // này đổi sang hiện Bộ phận · Phòng ban cho hữu ích hơn. Suy ngược
      // divisionCode từ departmentCode nếu thiếu (thành viên gán Phòng ban
      // TRƯỚC khi có field Bộ phận, 2026-09-16) — cùng cách profile.html làm.
      var effDivisionCode = m.divisionCode;
      if (!effDivisionCode && m.departmentCode && typeof TaskManager !== 'undefined' && TaskManager.getDepartmentByCode) {
        var deptInfoForDiv = TaskManager.getDepartmentByCode(m.departmentCode);
        effDivisionCode = deptInfoForDiv ? deptInfoForDiv.divisionCode : '';
      }
      var deptLabel = [effDivisionCode, m.departmentCode].filter(Boolean).join(' · ');
      var deptTitle = [m.division, m.department].filter(Boolean).join(' · ');
      var days = daysAtCompany(m.createdAt);
      var joinDate = formatJoinDate(m.createdAt);
      var statusBadge = m.status === 'pending' ? '<span class="team-status-badge pending">Chờ duyệt</span>'
        : m.status === 'inactive' ? '<span class="team-status-badge inactive">Ngưng công tác</span>'
        : m.status === 'rejected' ? '<span class="team-status-badge rejected">Đã từ chối</span>'
        : m.status === 'on-leave' ? '<span class="team-status-badge on-leave">Tạm nghỉ việc</span>'
        : '';

      var deleteAt = m.status === 'rejected' ? rejectionDeleteAt(m.rejectedAt) : null;
      var countdownRow = deleteAt
        ? '<div class="team-reject-countdown" title="Xoá lúc ' + formatAbsoluteDeleteTime(deleteAt) + '" data-reject-countdown="' + deleteAt + '">' + formatCountdown(deleteAt) + '</div>'
        : '';

      return ''
        + '<article class="team-card" data-idx="' + i + '" tabindex="0" role="button" aria-haspopup="dialog">'
        +   (statusBadge ? '<div class="team-card-flag">' + statusBadge + '</div>' : '')
        +   '<div class="team-avatar" style="background:' + color + '">' + initials + '</div>'
        +   '<h3 class="team-name">' + (m.name || '—') + '</h3>'
        +   '<p class="team-role">' + role + '</p>'
        +   (deptLabel ? '<span class="team-rolelevel-badge member"' + (deptTitle ? ' title="' + escapeHtml(deptTitle) + '"' : '') + '>' + deptLabel + '</span>' : '')
        +   '<div class="team-meta-row">'
        +     (joinDate ? '<span class="team-tenure" title="Gia nhập từ ' + joinDate + '">' + ICON.calendar + '<span>' + joinDate + (days !== null ? ' · ' + days + ' ngày' : '') + '</span></span>' : '')
        +   '</div>'
        +   countdownRow
        + '</article>';
    }).join('');

    grid.querySelectorAll('.team-card').forEach(function (card) {
      function open(e) {
        openTeamMemberModal(members[parseInt(card.dataset.idx, 10)]);
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
      });
    });
  }

  // Full-detail modal for a team card — deliberately leaves out CCCD/bank
  // info even though it's on the member record, since this view is visible
  // to every logged-in teammate, not just the person themselves or admins.
  function openTeamMemberModal(m) {
    if (!m) return;
    var overlay = document.getElementById('teamModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'team-modal-overlay';
      overlay.id = 'teamModalOverlay';
      overlay.hidden = true;
      overlay.innerHTML = '<div class="team-modal" role="dialog" aria-modal="true">' +
        '<button type="button" class="team-modal-close" aria-label="Đóng">&times;</button>' +
        '<div id="teamModalContent"></div>' +
      '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.hidden = true; });
      overlay.querySelector('.team-modal-close').addEventListener('click', function () { overlay.hidden = true; });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') overlay.hidden = true; });
    }

    var initials = m.avatar || getInitials(m.name);
    var color = m.color || '#6B7280';
    var modalLevelInfo = (m.level && typeof TaskManager !== 'undefined' && TaskManager.getLevelByCode) ? TaskManager.getLevelByCode(m.level) : null;
    var roleLevelLabel = modalLevelInfo ? modalLevelInfo.label : (m.roleLevel === 'admin' ? 'Quản trị viên' : m.roleLevel === 'manager' ? 'Quản lý' : 'Nhân viên');
    var days = daysAtCompany(m.createdAt);
    var joinDate = formatJoinDate(m.createdAt);
    var dobDate = m.dob ? new Date(m.dob).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    var statusLabel = m.status === 'pending' ? 'Đang chờ duyệt'
      : m.status === 'inactive' ? 'Đã ngưng công tác'
      : m.status === 'rejected' ? 'Đăng ký đã bị từ chối'
      : m.status === 'on-leave' ? 'Đang tạm nghỉ việc'
      : '';

    var currentUser = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
    var canManage = typeof TaskManager !== 'undefined' && TaskManager.canManageMembers && TaskManager.canManageMembers(currentUser);
    var canTerminate = typeof TaskManager !== 'undefined' && TaskManager.canTerminateMembers && TaskManager.canTerminateMembers(currentUser);
    var isSelf = currentUser && currentUser.id === m.id;

    var actionButtons = '';
    if (m.status === 'pending' && canManage) {
      actionButtons += '<button type="button" class="team-modal-action approve" data-action="approve">✓ Duyệt tài khoản</button>';
      actionButtons += '<button type="button" class="team-modal-action reject" data-action="reject">✕ Từ chối</button>';
    } else if (m.status === 'rejected' && canManage) {
      // Duyệt lại TRƯỚC KHI hết 48h sẽ huỷ luôn lịch xoá — xem
      // stampMemberRejection()/clearMemberRejection() trong gsheets-api-v2.js
      // (chuyển status ra khỏi 'rejected' tự xoá mốc rejectedAt).
      actionButtons += '<button type="button" class="team-modal-action approve" data-action="approve">✓ Duyệt lại tài khoản</button>';
    } else if (m.status === 'inactive' && canTerminate) {
      actionButtons += '<button type="button" class="team-modal-action approve" data-action="reinstate">↺ Khôi phục công tác</button>';
    } else if (m.status === 'on-leave') {
      if (canManage) actionButtons += '<button type="button" class="team-modal-action approve" data-action="return">↺ Trở lại làm việc</button>';
      if (canTerminate && !isSelf) actionButtons += '<button type="button" class="team-modal-action reject" data-action="terminate">⏸ Ngưng công tác</button>';
    } else if (!m.status || m.status === 'active') {
      if (canManage && !isSelf) actionButtons += '<button type="button" class="team-modal-action leave" data-action="leave">‖ Tạm nghỉ việc</button>';
      if (canTerminate && !isSelf) actionButtons += '<button type="button" class="team-modal-action reject" data-action="terminate">⏸ Ngưng công tác</button>';
    }

    document.getElementById('teamModalContent').innerHTML =
      '<div class="team-modal-header">' +
        '<div class="team-modal-avatar" style="background:' + color + '">' + escapeHtml(initials) + '</div>' +
        '<div class="team-modal-id">' +
          '<h3 class="team-modal-name">' + escapeHtml(m.name || '—') + '</h3>' +
          '<p class="team-modal-role">' + escapeHtml(m.role || '') + '</p>' +
          '<span class="pf-id-badge">' + roleLevelLabel + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="team-modal-body">' +
        '<div class="team-modal-row">' + ICON.mail + '<span>' + escapeHtml(m.email || '—') + '</span></div>' +
        // Thành viên gán Phòng ban TRƯỚC khi có Bộ phận (2026-09-16) sẽ chưa có
        // divisionCode — suy ra ngược từ departmentCode qua quan hệ cha/con.
        (function () {
          var divCode = m.divisionCode;
          var divName = m.division;
          var divDesc = '';
          if (!divCode && m.departmentCode && typeof TaskManager !== 'undefined' && TaskManager.getDepartmentByCode) {
            var deptInfo = TaskManager.getDepartmentByCode(m.departmentCode);
            if (deptInfo) {
              divCode = deptInfo.divisionCode;
              var divInfo = TaskManager.getDivisionByCode ? TaskManager.getDivisionByCode(divCode) : null;
              divName = divInfo ? divInfo.name : '';
            }
          }
          if (divCode && typeof TaskManager !== 'undefined' && TaskManager.getDivisionByCode) {
            var divFull = TaskManager.getDivisionByCode(divCode);
            divDesc = divFull ? divFull.desc || '' : '';
          }
          // title = mô tả chức năng của Khối, hiện khi di chuột vào (giống quy
          // ước title="" đã dùng ở deptLabel trên badge team card).
          return divCode ? '<div class="team-modal-row"' + (divDesc ? ' title="' + escapeHtml(divDesc) + '"' : '') + '>' + ICON.building + '<span>' + escapeHtml(divCode) + (divName ? ' — ' + escapeHtml(divName) : '') + '</span></div>' : '';
        })() +
        (function () {
          if (!m.departmentCode) return '';
          var deptFull = (typeof TaskManager !== 'undefined' && TaskManager.getDepartmentByCode) ? TaskManager.getDepartmentByCode(m.departmentCode) : null;
          var deptDesc = deptFull ? deptFull.desc || '' : '';
          return '<div class="team-modal-row"' + (deptDesc ? ' title="' + escapeHtml(deptDesc) + '"' : '') + '>' + ICON.building + '<span>' + escapeHtml(m.departmentCode) + (m.department ? ' — ' + escapeHtml(m.department) : '') + '</span></div>';
        })() +
        (m.phone ? '<div class="team-modal-row">' + ICON.phone + '<span>' + escapeHtml(m.phone) + '</span></div>' : '') +
        (m.hometown ? '<div class="team-modal-row">' + ICON.pin + '<span>' + escapeHtml(m.hometown) + '</span></div>' : '') +
        (dobDate ? '<div class="team-modal-row">' + ICON.cake + '<span>Sinh ngày ' + dobDate + '</span></div>' : '') +
        (joinDate ? '<div class="team-modal-row">' + ICON.calendar + '<span>Vào làm từ ' + joinDate + (days !== null ? ' · ' + days + ' ngày' : '') + '</span></div>' : '') +
        (statusLabel ? '<div class="team-modal-row team-modal-status-row">' + escapeHtml(statusLabel) + '</div>' : '') +
        (function () {
          if (m.status !== 'rejected') return '';
          var deleteAt = rejectionDeleteAt(m.rejectedAt);
          if (!deleteAt) return '';
          return '<div class="team-modal-row team-reject-countdown" title="Xoá lúc ' + formatAbsoluteDeleteTime(deleteAt) + '" data-reject-countdown="' + deleteAt + '">' + formatCountdown(deleteAt) + '</div>';
        })() +
      '</div>' +
      (actionButtons ? '<div class="team-modal-actions">' + actionButtons + '</div>' : '');

    var contentEl = document.getElementById('teamModalContent');
    contentEl.querySelectorAll('.team-modal-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.action;
        var newStatus = action === 'approve' ? 'active'
          : action === 'reject' ? 'rejected'
          : action === 'reinstate' ? 'active'
          : action === 'leave' ? 'on-leave'
          : action === 'return' ? 'active'
          : 'inactive';
        var confirmMsg = action === 'approve' && m.status === 'rejected' ? 'Duyệt lại tài khoản này? Sẽ HUỶ lịch tự động xoá còn lại.'
          : action === 'approve' ? 'Duyệt tài khoản này? Thành viên sẽ đăng nhập được ngay.'
          : action === 'reject' ? 'Từ chối đăng ký này? Nếu không được duyệt lại, dữ liệu sẽ TỰ ĐỘNG XOÁ VĨNH VIỄN sau 48 giờ.'
          : action === 'reinstate' ? 'Khôi phục công tác cho thành viên này?'
          : action === 'leave' ? 'Đánh dấu thành viên này đang tạm nghỉ việc?'
          : action === 'return' ? 'Đánh dấu thành viên này đã trở lại làm việc?'
          : 'Đánh dấu thành viên này đã ngưng công tác? Họ sẽ không đăng nhập được nữa.';
        showConfirmDialog(confirmMsg, function () {
          var result = TaskManager.updateMemberStatus(m.id, newStatus, currentUser);
          if (!result) { showToast('Bạn không có quyền thực hiện thao tác này.', false); return; }
          m.status = newStatus;
          overlay.hidden = true;
          loadTeam();
        }, action === 'reject' ? 'Từ chối' : 'Xác nhận');
      });
    });

    overlay.hidden = false;
  }

  function loadTeam() {
    // Try TaskManager first (populated from Sheets), then fall back to stored JSON
    var members = [];
    if (typeof TaskManager !== 'undefined' && TaskManager.getMembers) {
      members = TaskManager.getMembers();
    }
    if (members.length > 0) {
      renderTeamGrid(members);
      return;
    }
    // Wait a bit for async Sheets fetch to populate localStorage
    var attempts = 0;
    var poll = setInterval(function () {
      attempts++;
      if (typeof TaskManager !== 'undefined' && TaskManager.getMembers) {
        members = TaskManager.getMembers();
      }
      if (members.length > 0 || attempts > 20) {
        clearInterval(poll);
        renderTeamGrid(members);
      }
    }, 300);
  }

  // Load team on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeam);
  } else {
    loadTeam();
  }

  // 2026-09-19: cùng bug "cập nhật xong nhưng không hiện" — loadTeam() chỉ
  // chạy 1 lần lúc trang tải, không tự vẽ lại khi có thành viên mới được
  // duyệt/đổi trạng thái ở nơi khác trong lúc trang team.html đang mở sẵn.
  // renderTeamGrid() đã tự no-op nếu #team-grid không tồn tại (trang khác
  // không có grid này) nên đăng ký chung ở đây (portal.js load mọi trang)
  // là an toàn.
  window.addEventListener('hiconique:data-refreshed', loadTeam);

  // ----- Expand panels (Tasks / Dự án) -----
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function todayStr() {
    var now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  }

  function isOverdue(task) {
    if (!task.deadline || task.status === 'completed') return false;
    return new Date(task.deadline) < new Date(todayStr() + 'T00:00');
  }

  function fmtDate(deadline) {
    if (!deadline) return '';
    var d = new Date(deadline);
    if (isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function priorityLabel(p) {
    if (p === 'high') return 'Cao';
    if (p === 'medium') return 'Trung bình';
    return 'Thấp';
  }

  // assigneeIds đến từ Google Sheets có thể là mảng JS hoặc chuỗi JSON
  // (tuỳ đường load) — phải chuẩn hoá trước khi so sánh, không chỉ check
  // Array.isArray(), nếu không sẽ luôn khớp 0 kết quả và lọt vào fallback sai.
  function getPanelTaskAssigneeIds(task) {
    if (!task || !task.assigneeIds) return [];
    if (Array.isArray(task.assigneeIds)) return task.assigneeIds;
    if (typeof task.assigneeIds === 'string') {
      try { var arr = JSON.parse(task.assigneeIds); if (Array.isArray(arr)) return arr; } catch (e) {}
      if (task.assigneeIds.trim()) return [task.assigneeIds.trim()];
    }
    return [];
  }

  function renderTasksPanel() {
    var list = document.getElementById('panelTasksList');
    if (!list) return;

    var tasks = (typeof TaskManager !== 'undefined' && TaskManager.getTasks) ? TaskManager.getTasks() : [];
    var user = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;

    // Chỉ hiển thị việc của CHÍNH người đang đăng nhập — không fallback
    // sang toàn bộ task công ty khi rỗng (trước đó bị lệch do bug parse
    // assigneeIds ở trên, khiến "Tasks của tôi" hiện tới 91 việc của cả team).
    var displayTasks = user ? tasks.filter(function (t) { return getPanelTaskAssigneeIds(t).indexOf(user.id) !== -1; }) : [];

    var inProgress = displayTasks.filter(function (t) { return t.status === 'in-progress'; }).length;
    var overdue = displayTasks.filter(isOverdue).length;

    var elMyTasks = document.getElementById('panelMyTasks');
    var elMyDoing = document.getElementById('panelMyDoing');
    var elMyOverdue = document.getElementById('panelMyOverdue');
    if (elMyTasks) elMyTasks.textContent = displayTasks.length;
    if (elMyDoing) elMyDoing.textContent = inProgress;
    if (elMyOverdue) elMyOverdue.textContent = overdue;

    // Store globally for filter pills
    window.__panelTasks = displayTasks;

    renderTasksPanelFiltered(state.miniTaskFilter || 'all');

    // Wire filter pills
    document.querySelectorAll('.task-filter-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        document.querySelectorAll('.task-filter-pill').forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
        state.miniTaskFilter = pill.dataset.miniFilter;
        renderTasksPanelFiltered(state.miniTaskFilter);
      });
    });

    // Wire checkbox toggles
    list.querySelectorAll('.tl-checkbox').forEach(function (cb) {
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
        var taskId = cb.dataset.taskId;
        if (taskId && typeof TaskManager !== 'undefined' && TaskManager.toggleTaskStatus) {
          TaskManager.toggleTaskStatus(taskId);
          renderTasksPanel();
        }
      });
    });
  }

  function renderTasksPanelFiltered(filter) {
    var list = document.getElementById('panelTasksList');
    if (!list) return;
    var displayTasks = window.__panelTasks || [];

    var filtered;
    if (filter === 'all') filtered = displayTasks;
    else if (filter === 'in-progress') filtered = displayTasks.filter(function (t) { return t.status === 'in-progress'; });
    else if (filter === 'pending') filtered = displayTasks.filter(function (t) { return t.status === 'pending'; });
    else if (filter === 'overdue') filtered = displayTasks.filter(isOverdue);
    else filtered = displayTasks;

    if (filtered.length === 0) {
      var msg = filter === 'all'
        ? 'Chưa có công việc nào. Hãy tạo việc mới từ Dashboard Dự án.'
        : 'Không có việc nào khớp với bộ lọc này.';
      list.innerHTML = '<li class="empty-state-mini"><div class="empty-icon">📋</div><div class="empty-title">' + msg + '</div></li>';
      return;
    }

    list.innerHTML = filtered.map(function (task) {
      var isDone = task.status === 'completed';
      var project = (typeof TaskManager !== 'undefined' && TaskManager.getProject) ? TaskManager.getProject(task.projectId) : null;
      var taskAssignees = (typeof TaskManager !== 'undefined' && TaskManager.getTaskAssignees) ? TaskManager.getTaskAssignees(task) : [];
      var assignee = taskAssignees[0] || null;
      var dueClass = '';
      var dueIcon = '📅';
      var dueText = '';
      if (task.deadline) {
        if (isOverdue(task)) { dueClass = 'overdue'; dueIcon = '⚠'; }
        else if (isTodayOrTomorrow(task.deadline)) { dueClass = 'today'; dueIcon = '⏰'; }
        dueText = fmtDate(task.deadline);
      }
      var assigneeInitials = assignee ? escapeHtml(assignee.avatar || (assignee.name || '?').substring(0, 2).toUpperCase()) : '';
      var assigneeColor = assignee ? (assignee.color || '#6B7280') : '#6B7280';
      var assigneeName = taskAssignees.length ? escapeHtml(taskAssignees.map(function (a) { return a.name; }).join(', ')) : '';

      return ''
        + '<li class="priority-' + (task.priority || 'medium') + ' ' + (isDone ? 'is-done' : '') + '">'
        +   '<button class="tl-checkbox" data-task-id="' + escapeHtml(task.id) + '" aria-label="Đánh dấu hoàn thành">'
        +     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
        +   '</button>'
        +   '<div class="tl-content">'
        +     '<div class="tl-top">'
        +       '<span class="tl-title ' + (isDone ? 'is-done' : '') + '">' + escapeHtml(task.title || '—') + '</span>'
        +       (project ? '<span class="tl-project">📁 ' + escapeHtml(project.name) + '</span>' : '')
        +     '</div>'
        +     (assignee ? '<div class="tl-meta"><span>👤 ' + assigneeName + '</span></div>' : '')
        +   '</div>'
        +   '<div class="tl-right">'
        +     '<span class="tl-priority priority-' + (task.priority || 'medium') + '">' + priorityLabel(task.priority) + '</span>'
        +     (dueText ? '<span class="tl-due ' + dueClass + '">' + dueIcon + ' ' + dueText + '</span>' : '')
        +     (assigneeInitials ? '<span class="tl-assignee" style="background:' + assigneeColor + '" title="' + assigneeName + '">' + assigneeInitials + '</span>' : '')
        +   '</div>'
        + '</li>';
    }).join('');
  }

  function isTodayOrTomorrow(dateStr) {
    if (!dateStr) return false;
    var d = new Date(dateStr);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d >= today && d < tomorrow;
  }

  function renderProjectsPanel() {
    var grid = document.getElementById('panelProjectsGrid');
    if (!grid) return;

    var projects = (typeof TaskManager !== 'undefined' && TaskManager.getProjects) ? TaskManager.getProjects() : [];
    var tasks = (typeof TaskManager !== 'undefined' && TaskManager.getTasks) ? TaskManager.getTasks() : [];

    var active = projects.filter(function (p) { return p.status !== 'completed'; }).length;
    var openTasks = tasks.filter(function (t) { return t.status !== 'completed'; }).length;

    var elTotal = document.getElementById('panelProjTotal');
    var elActive = document.getElementById('panelProjActive');
    var elOpen = document.getElementById('panelProjOpenTasks');
    if (elTotal) elTotal.textContent = projects.length;
    if (elActive) elActive.textContent = active;
    if (elOpen) elOpen.textContent = openTasks;

    if (projects.length === 0) {
      grid.innerHTML = '<p style="color:#9AA0A6;padding:1.5rem;text-align:center;">Chưa có dự án nào.</p>';
      return;
    }

    grid.innerHTML = projects.map(function (p) {
      var projTasks = tasks.filter(function (t) { return t.projectId === p.id; });
      var projOpen = projTasks.filter(function (t) { return t.status !== 'completed'; }).length;
      var progress = p.progress || 0;
      var status = p.status || 'on-track';
      var statusLabel = status === 'completed' ? 'Hoàn thành' : (status === 'at-risk' ? 'Có rủi ro' : 'Đang chạy');
      var projColor = p.color || '#B08D57';

      // Member avatars
      var memberIds = p.members || [];
      var avatarsHtml = '';
      var members = (typeof TaskManager !== 'undefined' && TaskManager.getMembers) ? TaskManager.getMembers() : [];
      memberIds.slice(0, 4).forEach(function (mid) {
        var m = members.filter(function (mm) { return mm.id === mid; })[0];
        if (m) {
          var init = escapeHtml(m.avatar || (m.name || '?').substring(0, 2).toUpperCase());
          avatarsHtml += '<span class="pcm-avatar" style="background:' + (m.color || '#6B7280') + '" title="' + escapeHtml(m.name || '') + '">' + init + '</span>';
        }
      });
      if (memberIds.length > 4) {
        avatarsHtml += '<span class="pcm-avatar" style="background:var(--color-text-faint);color:#0B0D10">+' + (memberIds.length - 4) + '</span>';
      }

      return ''
        + '<article class="project-card-mini" style="--proj-color:' + projColor + '">'
        +   '<div class="project-card-mini-head">'
        +     '<h4>' + escapeHtml(p.name || '—') + '</h4>'
        +     '<span class="pcm-status ' + status + '">' + statusLabel + '</span>'
        +   '</div>'
        +   '<p class="pcm-type">' + escapeHtml(p.type || '') + '</p>'
        +   '<div class="pcm-progress"><span style="width:' + progress + '%"></span></div>'
        +   '<div class="pcm-meta">'
        +     '<span class="pcm-tasks">📋 ' + projOpen + ' việc mở · ' + progress + '%</span>'
        +     '<span class="pcm-avatars">' + avatarsHtml + '</span>'
        +   '</div>'
        + '</article>';
    }).join('');
  }

  function bindExpandPanels() {
    var navLinks = document.querySelectorAll('.nav-link[data-panel]');
    var panels = document.querySelectorAll('.expand-panel');
    var closeBtns = document.querySelectorAll('[data-close-panel]');

    function closeAllPanels() {
      panels.forEach(function (p) { p.hidden = true; });
      navLinks.forEach(function (l) { l.classList.remove('active'); });
    }

    function openPanel(name, scrollToPanel) {
      closeAllPanels();
      var target = document.getElementById('panel-' + name);
      if (!target) return;

      if (name === 'tasks') renderTasksPanel();
      if (name === 'projects') renderProjectsPanel();

      target.hidden = false;
      navLinks.forEach(function (l) {
        if (l.dataset.panel === name) l.classList.add('active');
      });

      // Smooth scroll to top of panel (skip on initial page load default)
      if (scrollToPanel !== false) {
        setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }

    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var name = link.dataset.panel;
        var isActive = link.classList.contains('active');
        if (isActive) {
          closeAllPanels();
        } else {
          openPanel(name);
        }
      });
    });

    // Auto-open the panel from URL hash on load (e.g., #panel-tasks)
    function openInitialPanel() {
      var hash = (window.location.hash || '').toLowerCase();
      var match = hash.match(/^#panel-(\w+)/);
      if (match) {
        openPanel(match[1]);
        return true;
      }
      return false;
    }

    if (!openInitialPanel()) {
      // Fallback: open tasks panel by default so it's visible, but stay at top of page
      openPanel('tasks', false);
    }

    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeAllPanels();
      });
    });

    // Esc closes any open panel
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var open = document.querySelector('.expand-panel:not([hidden])');
        if (open) closeAllPanels();
      }
    });
  }

  function loadPanels() {
    if (typeof TaskManager === 'undefined' || !TaskManager.getTasks) {
      var attempts = 0;
      var poll = setInterval(function () {
        attempts++;
        if ((typeof TaskManager !== 'undefined' && TaskManager.getTasks && TaskManager.getTasks().length > 0) || attempts > 20) {
          clearInterval(poll);
          bindExpandPanels();
        }
      }, 300);
    } else {
      bindExpandPanels();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPanels);
  } else {
    loadPanels();
  }

  // ----- Notifications bell (site-wide: reuses the bell on index.html, injects one elsewhere) -----
  var NOTIF_TYPE_LABELS = { task: 'Việc', project: 'Dự án', violation: 'Vi phạm', checkin: 'Chấm công', payroll: 'Lương', system: 'Hệ thống', custom: 'Thông báo' };

  // 2026-09-19: bấm vào 1 thông báo giờ tự nhảy sang đúng trang liên quan
  // thay vì chỉ đánh dấu đã đọc rồi nằm im — suy trang đích từ `type` của
  // thông báo. Với 2 loại "Việc quá hạn"/"Việc đến hạn hôm nay" (computed
  // alert, id dạng "alert_overdue_<taskId>"/"alert_duetoday_<taskId>") còn
  // mở THẲNG đúng task (xem ?openTask= trong task-manager-app.js) — các loại
  // còn lại chỉ nhảy tới đúng TRANG (chưa có deep-link theo id ở trang đó).
  // Trả về null cho loại không có trang liên quan rõ ràng (system/custom/
  // general/violation) — bấm vào vẫn chỉ đánh dấu đã đọc như cũ.
  function notifTarget(n) {
    var type = n.type;
    if (type === 'task') {
      var m = /^alert_(?:overdue|duetoday)_(.+)$/.exec(n.id || '');
      return m ? ('/pages/tasks-manager.html?openTask=' + encodeURIComponent(m[1])) : '/pages/tasks-manager.html';
    }
    if (type === 'attendance' || type === 'checkin') return '/pages/timesheet.html';
    if (type === 'payroll') return '/pages/payslip.html';
    if (type === 'project') return '/pages/projects.html';
    if (type === 'birthday') return '/pages/team.html';
    return null;
  }

  function relTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var diffMs = Date.now() - d.getTime();
    var diffDay = Math.floor(diffMs / 86400000);
    if (diffDay <= 0) return 'Hôm nay';
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return diffDay + ' ngày trước';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }

  function initNotifications() {
    if (typeof TaskManager === 'undefined' || typeof Auth === 'undefined') return;
    var user = Auth.getCurrentUser();
    if (!user) return;

    var bell = document.querySelector('.icon-btn-bell');
    var actions = document.querySelector('.header-actions');
    if (!bell && actions) {
      bell = document.createElement('button');
      bell.type = 'button';
      bell.className = 'icon-btn icon-btn-bell';
      bell.setAttribute('aria-label', 'Thông báo');
      bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21a2 2 0 0 0 4 0" stroke-linecap="round"/></svg><span class="badge-dot" hidden></span>';
      var avatarEl = actions.querySelector('.avatar');
      if (avatarEl) actions.insertBefore(bell, avatarEl); else actions.appendChild(bell);
    }
    if (!bell) return;

    var panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.hidden = true;
    document.body.appendChild(panel);

    bell.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (panel.hidden) { position(); render(); panel.hidden = false; }
      else { panel.hidden = true; }
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { panel.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.hidden = true; });

    function position() {
      var r = bell.getBoundingClientRect();
      panel.style.top = (r.bottom + 8) + 'px';
      panel.style.right = Math.max(12, window.innerWidth - r.right - 8) + 'px';
    }

    function collect() {
      var items = TaskManager.getNotifications(user).concat(TaskManager.getComputedAlerts(user));
      items = items.filter(function (n) { return !TaskManager.isNotificationDismissed(n.id); });
      items.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
      return items;
    }

    function updateBadge() {
      var unread = collect().filter(function (n) { return !TaskManager.isNotificationRead(n.id); }).length;
      var dot = bell.querySelector('.badge-dot');
      if (dot) dot.hidden = unread === 0;
    }
    updateBadge();

    // 2026-09-19: cùng bug "cập nhật xong nhưng không hiện" đã fix ở
    // timesheet.html/task-manager-app.js — updateBadge() (chấm đỏ chuông
    // thông báo, hiện SITEWIDE) trước đây chỉ chạy 1 lần lúc trang tải,
    // không tự chạy lại khi TaskManager.refreshFromGSheets() cập nhật ngầm
    // mỗi 20s. 1 thông báo MỚI do người khác tạo (VD duyệt đề xuất/thiết bị)
    // sẽ không làm chấm đỏ sáng lên ở tab đang mở cho tới khi F5. Nếu panel
    // đang mở sẵn (đang xem danh sách) thì vẽ lại luôn danh sách, không chỉ
    // riêng chấm đỏ.
    window.addEventListener('hiconique:data-refreshed', function () {
      updateBadge();
      if (!panel.hidden) render();
    });

    function itemRow(n) {
      var unread = !TaskManager.isNotificationRead(n.id);
      return '<div class="notif-item' + (unread ? ' unread' : '') + '" data-id="' + escapeHtml(n.id) + '">' +
        '<span class="notif-dot level-' + (n.level || 'info') + '"></span>' +
        '<div class="notif-body">' +
          '<div class="notif-title">' + escapeHtml(n.title || '') + '</div>' +
          (n.message ? '<div class="notif-message">' + escapeHtml(n.message) + '</div>' : '') +
          '<div class="notif-meta">' + (NOTIF_TYPE_LABELS[n.type] || 'Thông báo') + ' · ' + relTime(n.createdAt) + (n.recurring ? ' · định kỳ' : '') + '</div>' +
        '</div></div>';
    }

    function render() {
      var items = collect();

      var html = '<div class="notif-panel-header">' +
        '<span>Thông báo</span>' +
        '<button type="button" class="notif-link" id="notifMarkAll">Đánh dấu đã đọc tất cả</button>' +
        '</div>';

      html += '<div class="notif-list">' + (items.length ? items.map(itemRow).join('') : '<div class="notif-empty">Không có thông báo nào.</div>') + '</div>';

      // 2026-09-17: nút xoá TOÀN BỘ thông báo — mỗi người tự xoá danh sách
      // CỦA RIÊNG MÌNH trên máy này (không đụng dữ liệu chung trên Sheet, xem
      // dismissAllNotifications() trong task-data.js), nên không cần quyền
      // canManage gì cả — ai cũng bấm được, chỉ ẩn khỏi mắt người bấm.
      if (items.length > 0) {
        html += '<div class="notif-footer"><button type="button" class="notif-link danger" id="notifDismissAll">Xoá tất cả thông báo</button></div>';
      }

      panel.innerHTML = html;

      panel.querySelectorAll('.notif-item').forEach(function (row) {
        row.addEventListener('click', function () {
          TaskManager.markNotificationRead(row.dataset.id);
          row.classList.remove('unread');
          updateBadge();
          var n = items.filter(function (x) { return x.id === row.dataset.id; })[0];
          var target = n && notifTarget(n);
          if (target) window.location.href = target;
        });
      });

      var markAllBtn = panel.querySelector('#notifMarkAll');
      if (markAllBtn) markAllBtn.addEventListener('click', function () {
        // Bug 2026-09-17: thiếu updateBadge() ở đây khiến chấm đỏ trên
        // chuông không bao giờ tắt sau khi bấm — người dùng tưởng nút này
        // hỏng vì không thấy phản hồi gì trên giao diện (dữ liệu vẫn lưu
        // đúng, chỉ là không có gì hiển thị đổi).
        TaskManager.markAllNotificationsRead(items.map(function (n) { return n.id; }));
        updateBadge();
        render();
      });

      var dismissAllBtn = panel.querySelector('#notifDismissAll');
      if (dismissAllBtn) dismissAllBtn.addEventListener('click', function () {
        showConfirmDialog('Xoá tất cả thông báo đang hiện? Chỉ ẩn khỏi danh sách của bạn, không ảnh hưởng người khác.', function () {
          TaskManager.dismissAllNotifications(items.map(function (n) { return n.id; }));
          updateBadge();
          render();
        }, 'Xoá tất cả');
      });

    }
  }

  // ----- Avatar dropdown (account menu) -----
  // Shared across every page that has a plain `.avatar` button in `.header-actions`.
  function initUserMenu() {
    if (typeof Auth === 'undefined') return;
    var session = Auth.getCurrentUser();
    if (!session) return;

    var avatarBtn = document.querySelector('.header-actions .avatar');
    if (!avatarBtn) return;

    var textEl = avatarBtn.querySelector('span');
    if (textEl) textEl.textContent = session.avatar || '--';

    var menu = document.createElement('div');
    menu.className = 'user-menu-panel';
    menu.hidden = true;
    document.body.appendChild(menu);

    function fmtJoined(v) {
      if (!v) return '';
      var d = new Date(v);
      if (isNaN(d.getTime())) return '';
      return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    }

    // Đồng bộ "Màu sắc đại diện" (cột Sheet NS-Thành viên, field `color`,
    // người dùng tự sửa ở profile.html) vào avatar header + dropdown, thay vì
    // luôn dùng màu CSS cố định như trước — không có màu tuỳ chỉnh thì bỏ
    // trống style để avatar rơi về đúng màu mặc định cũ của từng nơi.
    function getFullMember() {
      return (typeof TaskManager !== 'undefined' ? TaskManager.getMembers() : [])
        .find(function (m) { return m.id === session.id; }) || session;
    }
    function applyAvatarColor() {
      avatarBtn.style.background = getFullMember().color || '';
    }
    applyAvatarColor();
    setTimeout(applyAvatarColor, 1200); // dữ liệu Sheet fetch async, khớp pattern render() lặp lại ở nơi khác

    function render() {
      var full = getFullMember();
      var joined = fmtJoined(full.createdAt);
      applyAvatarColor();

      menu.innerHTML =
        '<div class="user-menu-header">' +
          '<div class="user-menu-avatar" style="background:' + escapeHtml(full.color || '') + '">' + escapeHtml(full.avatar || '--') + '</div>' +
          '<div class="user-menu-id">' +
            '<div class="user-menu-name">' + escapeHtml(full.name || '--') + '</div>' +
            '<div class="user-menu-role">' + escapeHtml(full.role || '--') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="user-menu-meta">' +
          '<div>' + ICON.mail + '<span>' + escapeHtml(full.email || '--') + '</span></div>' +
          (full.hometown ? '<div>' + ICON.pin + '<span>' + escapeHtml(full.hometown) + '</span></div>' : '') +
          (joined ? '<div>' + ICON.calendar + '<span>Vào làm từ ' + joined + '</span></div>' : '') +
        '</div>' +
        '<a href="/pages/profile.html" class="user-menu-link">' + ICON.user + '<span>Thông tin cá nhân</span></a>' +
        '<a href="/pages/my-dashboard.html" class="user-menu-link">' + ICON.chart + '<span>Dashboard của tôi</span></a>' +
        '<button type="button" class="user-menu-link user-menu-logout" id="userMenuLogout">' + ICON.logout + '<span>Đăng xuất</span></button>';

      var logoutBtn = menu.querySelector('#userMenuLogout');
      if (logoutBtn) logoutBtn.addEventListener('click', function () {
        Auth.logout();
        window.location.href = '/';
      });
    }

    function position() {
      var r = avatarBtn.getBoundingClientRect();
      menu.style.top = (r.bottom + 8) + 'px';
      menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    }

    avatarBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (menu.hidden) { render(); position(); menu.hidden = false; }
      else { menu.hidden = true; }
    });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { menu.hidden = true; });
  }

  // ----- Mobile nav (hamburger) -----
  // Injected into every page's .header-inner — the nav links themselves
  // (.primary-nav) already exist in each page's markup; this just adds the
  // toggle button and the open/close behavior for narrow viewports, once,
  // shared across the whole site instead of per-page.
  function initMobileNav() {
    var headerInner = document.querySelector('.site-header .header-inner');
    var nav = document.querySelector('.site-header .primary-nav');
    if (!headerInner || !nav) return;
    if (headerInner.querySelector('.menu-toggle')) return;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'menu-toggle';
    toggle.setAttribute('aria-label', 'Mở menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML =
      '<svg class="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>' +
      '<svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    headerInner.insertBefore(toggle, headerInner.firstChild);

    function closeNav() {
      nav.classList.remove('nav-open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    function toggleNav(e) {
      e.preventDefault();
      e.stopPropagation();
      var opening = !nav.classList.contains('nav-open');
      nav.classList.toggle('nav-open', opening);
      toggle.classList.toggle('is-open', opening);
      toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
    }

    toggle.addEventListener('click', toggleNav);
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.nav-link')) closeNav();
    });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && e.target !== toggle) closeNav();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1024) closeNav(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initNotifications();
      initUserMenu();
      initMobileNav();
    });
  } else {
    initNotifications();
    initUserMenu();
    initMobileNav();
  }
}());
