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

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('hiconique-theme', theme);
  }

  function initTheme() {
    var saved = localStorage.getItem('hiconique-theme');
    if (saved === 'light' || saved === 'dark') {
      html.setAttribute('data-theme', saved);
    }
    // Default is dark (html has data-theme="dark" in markup)
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
    var tasks = (typeof TaskManager !== 'undefined' && TaskManager.getTasks) ? TaskManager.getTasks() : [];
    var hour = now.getHours();
    var isWorkHour = hour >= 8 && hour < 18;
    var isWeekday = now.getDay() >= 1 && now.getDay() <= 5;

    // Active = có task đang in-progress HOẶC trong giờ làm việc ngày thường
    var activeIds = {};
    tasks.forEach(function (t) {
      if (t.status === 'in-progress' && t.assigneeId) {
        activeIds[t.assigneeId] = true;
      }
    });
    if (isWorkHour && isWeekday) {
      members.forEach(function (m) {
        if (m.id) activeIds[m.id] = true;
      });
    }

    var onlineCount = Object.keys(activeIds).length;
    var totalCount = members.length;

    if (totalEl) totalEl.textContent = totalCount;
    if (onlineEl) onlineEl.textContent = onlineCount;
    if (numberEl) numberEl.textContent = onlineCount;
    if (dotEl) {
      dotEl.style.background = (onlineCount > 0 && isWorkHour) ? '#4F6F52' : '#A04848';
    }
  }
  updateHeroStat();
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
    { title: '% Hoa hồng dự án', sub: 'Cấu hình và tính hoa hồng theo dự án', url: '/pages/commission.html', group: 'Công cụ' },
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
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
  };

  // ----- Team directory (from Google Sheets via TaskManager) -----
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
      var email = m.email || '';
      var status = m.status || (m.roleLevel ? m.roleLevel.charAt(0).toUpperCase() + m.roleLevel.slice(1) : '—');
      var days = daysAtCompany(m.createdAt);
      var daysLabel = days !== null ? (days + ' ngày làm việc') : '—';
      var joinDate = m.createdAt ? new Date(m.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

      return ''
        + '<article class="team-card" data-idx="' + i + '" tabindex="0" role="button" aria-haspopup="dialog">'
        +   '<div class="team-avatar" style="background:' + color + '">' + initials + '</div>'
        +   '<h3 class="team-name">' + (m.name || '—') + '</h3>'
        +   '<p class="team-role">' + role + '</p>'
        +   '<div class="team-stat">'
        +     '<span>' + email + '</span>'
        +     '<span>' + daysLabel + '</span>'
        +     '<span>' + status + '</span>'
        +   '</div>'
        +   '<div class="team-meta-row">'
        +     (joinDate ? '<span class="team-tenure" title="Gia nhập từ ' + joinDate + '">📅 ' + joinDate + '</span>' : '')
        +   '</div>'
        +   '<div class="team-actions">'
        +     '<a href="mailto:' + email + '" class="team-action" aria-label="Gửi email">'
        +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'
        +     '</a>'
        +   '</div>'
        + '</article>';
    }).join('');

    grid.querySelectorAll('.team-card').forEach(function (card) {
      function open(e) {
        if (e.target.closest('.team-action')) return;
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
    var roleLevelLabel = m.roleLevel === 'admin' ? 'Quản trị viên' : m.roleLevel === 'manager' ? 'Quản lý' : 'Nhân viên';
    var days = daysAtCompany(m.createdAt);
    var joinDate = m.createdAt ? new Date(m.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

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
        (m.phone ? '<div class="team-modal-row">' + ICON.phone + '<span>' + escapeHtml(m.phone) + '</span></div>' : '') +
        (m.hometown ? '<div class="team-modal-row">' + ICON.pin + '<span>' + escapeHtml(m.hometown) + '</span></div>' : '') +
        (joinDate ? '<div class="team-modal-row">' + ICON.calendar + '<span>Vào làm từ ' + joinDate + (days !== null ? ' · ' + days + ' ngày' : '') + '</span></div>' : '') +
      '</div>';

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

  function renderTasksPanel() {
    var list = document.getElementById('panelTasksList');
    if (!list) return;

    var tasks = (typeof TaskManager !== 'undefined' && TaskManager.getTasks) ? TaskManager.getTasks() : [];
    var user = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;

    // Show user's tasks, fall back to all tasks if none assigned
    var mine = user ? tasks.filter(function (t) { return t.assigneeId === user.id; }) : tasks;
    var displayTasks = mine.length > 0 ? mine : tasks;

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
      var assignee = (typeof TaskManager !== 'undefined' && TaskManager.getMember) ? TaskManager.getMember(task.assigneeId) : null;
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
      var assigneeName = assignee ? escapeHtml(assignee.name || '') : '';

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
      items.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
      return items;
    }

    function updateBadge() {
      var unread = collect().filter(function (n) { return !TaskManager.isNotificationRead(n.id); }).length;
      var dot = bell.querySelector('.badge-dot');
      if (dot) dot.hidden = unread === 0;
    }
    updateBadge();

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
      var canManage = TaskManager.canManageNotifications(user);
      var canRules = TaskManager.canManageRecurringRules(user);

      var html = '<div class="notif-panel-header">' +
        '<span>Thông báo</span>' +
        '<button type="button" class="notif-link" id="notifMarkAll">Đánh dấu đã đọc tất cả</button>' +
        '</div>';

      html += '<div class="notif-list">' + (items.length ? items.map(itemRow).join('') : '<div class="notif-empty">Không có thông báo nào.</div>') + '</div>';

      if (canManage) {
        if (canRules) {
          var rules = TaskManager.getNotificationRules().filter(function (n) { return n.recurring; });
          html += '<div class="notif-rules">' +
            '<div class="notif-panel-header"><span>Nhắc định kỳ hiện có</span></div>' +
            (rules.length ? rules.map(function (r) {
              return '<div class="notif-rule-row" data-id="' + escapeHtml(r.id) + '">' +
                '<div><strong>' + escapeHtml(r.title) + '</strong><div class="notif-meta">' + escapeHtml(r.recurRule || '') + '</div></div>' +
                '<label class="notif-rule-toggle"><input type="checkbox" class="notif-rule-active" ' + (r.active !== false ? 'checked' : '') + '> Bật</label>' +
                '<button type="button" class="notif-link notif-rule-del">Xoá</button>' +
              '</div>';
            }).join('') : '<div class="notif-empty">Chưa có nhắc định kỳ nào.</div>') +
          '</div>';
        }
      }

      panel.innerHTML = html;

      panel.querySelectorAll('.notif-item').forEach(function (row) {
        row.addEventListener('click', function () {
          TaskManager.markNotificationRead(row.dataset.id);
          row.classList.remove('unread');
          updateBadge();
        });
      });

      var markAllBtn = panel.querySelector('#notifMarkAll');
      if (markAllBtn) markAllBtn.addEventListener('click', function () {
        TaskManager.markAllNotificationsRead(items.map(function (n) { return n.id; }));
        render();
      });

      panel.querySelectorAll('.notif-rule-active').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var id = cb.closest('.notif-rule-row').dataset.id;
          TaskManager.updateNotification(id, { active: cb.checked }, user);
        });
      });
      panel.querySelectorAll('.notif-rule-del').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.notif-rule-row').dataset.id;
          TaskManager.deleteNotification(id, user);
          render();
        });
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

    function render() {
      var full = (typeof TaskManager !== 'undefined' ? TaskManager.getMembers() : [])
        .find(function (m) { return m.id === session.id; }) || session;
      var joined = fmtJoined(full.createdAt);

      menu.innerHTML =
        '<div class="user-menu-header">' +
          '<div class="user-menu-avatar">' + escapeHtml(full.avatar || '--') + '</div>' +
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
