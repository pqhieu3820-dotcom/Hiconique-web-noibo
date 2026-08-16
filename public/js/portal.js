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

  function setTheme(theme) {
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
      localStorage.setItem('hiconique-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
      localStorage.setItem('hiconique-theme', 'dark');
    }
  }

  function initTheme() {
    var saved = localStorage.getItem('hiconique-theme');
    if (saved === 'light') {
      html.setAttribute('data-theme', 'light');
    } else if (!saved && window.matchMedia('(prefers-color-scheme: light)').matches) {
      html.setAttribute('data-theme', 'light');
    }
  }

  initTheme();

  // Add click handlers for all theme toggles
  themeToggle.forEach(function(toggle) {
    toggle.addEventListener('click', function () {
      var current = html.getAttribute('data-theme');
      setTheme(current === 'light' ? 'dark' : 'light');
    });
  });

  // ----- Clock (live) -----
  function updateClock() {
    var el = document.querySelector('[data-clock]');
    if (!el) return;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    el.textContent = hh + ':' + mm;
  }
  updateClock();
  setInterval(updateClock, 30 * 1000);

  // ----- Search overlay -----
  var overlay = document.querySelector('[data-search-overlay]');
  var toggle  = document.querySelector('[data-search-toggle]');
  var input   = document.querySelector('[data-search-input]');

  function openSearch() {
    if (!overlay) return;
    overlay.hidden = false;
    setTimeout(function () { input && input.focus(); }, 30);
  }
  function closeSearch() {
    if (!overlay) return;
    overlay.hidden = true;
  }

  toggle && toggle.addEventListener('click', openSearch);
  overlay && overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeSearch();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !overlay.hidden === false) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') closeSearch();
  });

  // ----- Team directory (sample data — replace with Sheets/Notion for prod) -----
  var team = [
    { initials: 'HQ', name: 'Trần Minh Quân',     role: 'CEO',                  days: 309, status: 'Hoạt động', color: '#B08D57' },
    { initials: 'HN', name: 'Nguyễn Hiếu',        role: 'Trưởng phòng Thiết kế', days: 343, status: 'Thiết kế nội thất', color: '#8E7CC3' },
    { initials: 'PH', name: 'Phạm Hoàng',          role: 'Giám sát thi công',     days: 282, status: 'Giám sát thi công', color: '#C7A464' },
    { initials: 'AL', name: 'Lê Anh',              role: 'Trưởng phòng KD',       days: 101, status: 'KD', color: '#9AA0A6' },
    { initials: 'TM', name: 'Trần Mạnh',           role: 'Truyền thông',          days: 181, status: 'Truyền thông', color: '#4F6F52' },
    { initials: 'TM', name: 'Tô Mai',              role: 'Thiết kế',              days: 101, status: 'Thiết kế nội thất', color: '#8C6F40' },
    { initials: 'GP', name: 'Giản Phương',         role: 'Thiết kế',              days: 101, status: 'Thiết kế nội thất', color: '#A16207' },
    { initials: 'LA', name: 'Lâm Anh',             role: 'Truyền thông',          days: 101, status: 'Truyền thông', color: '#2A3B55' },
    { initials: 'TM', name: 'Thành viên 10',       role: 'Vai trò',               days: 101, status: 'Vai trò', color: '#6B7280' },
    { initials: 'HQ', name: 'Hoàng Quân',          role: 'HR',                    days: 374, status: 'HR', color: '#475569' }
  ];

  var grid = document.getElementById('team-grid');
  if (grid) {
    grid.innerHTML = team.map(function (m) {
      return ''
        + '<article class="team-card">'
        +   '<div class="team-avatar" style="background:' + m.color + '">' + m.initials + '</div>'
        +   '<h3 class="team-name">' + m.name + ' HICONIQUE</h3>'
        +   '<p class="team-role">' + m.role + '</p>'
        +   '<div class="team-stat">'
        +     '<span>' + m.days + ' ngày công</span>'
        +     '<span>HICONIQUE</span>'
        +     '<span>' + m.status + '</span>'
        +   '</div>'
        +   '<div class="team-actions">'
        +     '<a href="#" class="team-action" aria-label="Nhắn tin">'
        +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
        +     '</a>'
        +     '<a href="#" class="team-action" aria-label="Gọi điện">'
        +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
        +     '</a>'
        +   '</div>'
        + '</article>';
    }).join('');
  }
}());
