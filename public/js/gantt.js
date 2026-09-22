/**
 * HICONIQUE — Gantt view + Excel export for the Dự án page.
 * Reads real data from TaskManager (projects + tasks), no hardcoded demo data.
 */
var HiconiqueGantt = (function () {
  'use strict';

  var MS_PER_DAY = 86400000;
  var currentFilter = 'all';
  var today0 = new Date();
  var currentMonth = new Date(today0.getFullYear(), today0.getMonth(), 1);
  var VI_DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // 2026-09-18: nút zoom cột ngày — bảng vốn co lại vừa khung nhìn (min-width
  // cố định 620px cho cả tháng, ~20px/ngày), khó đọc rõ khi nhiều task chồng
  // ngày sát nhau. Zoom chỉ đổi ĐỘ RỘNG mỗi cột ngày (biến CSS
  // --gantt-day-col-width, xem applyZoom()) — vị trí/độ dài thanh task vẫn
  // tính bằng % (pct()) nên không cần vẽ lại gì khác, chỉ giãn/co khung chứa.
  var BASE_DAY_WIDTH = 20; // px/ngày ở zoom 100% — khớp đúng 620px/31 ngày cũ
  var MIN_ZOOM = 0.5, MAX_ZOOM = 2.5, ZOOM_STEP = 0.25;
  var currentZoom = 1;

  function toDate(d) {
    if (!d) return null;
    var dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function fmtDate(d) {
    var dt = toDate(d);
    if (!dt) return '--';
    return ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + dt.getFullYear();
  }

  function fmtDateShort(d) {
    var dt = toDate(d);
    if (!dt) return '--';
    return ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2);
  }

  function darken(hex, amt) {
    hex = (hex || '#B08D57').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex, 16) || 0xB08D57;
    var r = Math.max(0, (num >> 16) - amt);
    var g = Math.max(0, ((num >> 8) & 0xFF) - amt);
    var b = Math.max(0, (num & 0xFF) - amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function getTaskRange(task) {
    var start = toDate(task.startDate) || toDate(task.createdAt) || new Date();
    var end = toDate(task.deadline) || start;
    if (end < start) end = start;
    return { start: start, end: end };
  }

  function getStatusInfo(task) {
    var range = getTaskRange(task);
    var overdue = task.status !== 'completed' && range.end < new Date();
    if (task.status === 'completed') return { cls: 'completed', label: '✓ Hoàn thành' };
    if (overdue) return { cls: 'delayed', label: 'Trễ hạn' };
    if (task.status === 'in-progress') return { cls: 'on-track', label: 'Đang làm' };
    if (task.status === 'review') return { cls: 'at-risk', label: 'Chờ duyệt' };
    return { cls: 'at-risk', label: 'Chưa bắt đầu' };
  }

  // ----- Build the (project -> tasks) sections for the current filter -----
  function buildSections(filter) {
    var projects = (typeof TaskManager !== 'undefined' ? TaskManager.getProjects() : []) || [];
    var tasks = (typeof TaskManager !== 'undefined' ? TaskManager.getTasks() : []) || [];

    var visibleProjects = filter === 'all' ? projects : projects.filter(function (p) { return p.id === filter; });

    return visibleProjects.map(function (p) {
      var projTasks = tasks.filter(function (t) { return t.projectId === p.id; });
      projTasks.sort(function (a, b) { return getTaskRange(a).start - getTaskRange(b).start; });
      return { project: p, tasks: projTasks };
    }).filter(function (s) { return s.tasks.length > 0; });
  }

  // ----- Build a single calendar-month axis: day 1 to the last day of the month -----
  function buildAxis(monthDate) {
    var start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1); // exclusive
    var days = [];
    var cur = new Date(start);
    while (cur < end) {
      days.push(new Date(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    var totalDays = days.length;
    return { start: start, end: end, days: days, totalDays: totalDays };
  }

  // Does a task's range overlap the given axis (calendar month) at all?
  function overlapsAxis(range, axis) {
    return range.start < axis.end && range.end >= axis.start;
  }

  function pct(axis, date) {
    var clamped = date < axis.start ? axis.start : (date > axis.end ? axis.end : date);
    return Math.max(0, Math.min(100, ((clamped - axis.start) / MS_PER_DAY / axis.totalDays) * 100));
  }

  // ----- Render -----
  function renderFilterTabs(container) {
    var projects = (typeof TaskManager !== 'undefined' ? TaskManager.getProjects() : []) || [];
    var html = '<button class="gantt-filter-tab' + (currentFilter === 'all' ? ' active' : '') + '" data-filter="all">Tất cả</button>';
    projects.forEach(function (p) {
      html += '<button class="gantt-filter-tab' + (currentFilter === p.id ? ' active' : '') + '" data-filter="' + p.id + '">' + escapeHtml(p.name || p.id) + '</button>';
    });
    container.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(root) {
    var filterTabsEl = root.querySelector('#ganttFilterTabs');
    var tableEl = root.querySelector('#ganttTable');
    var bodyEl = root.querySelector('#ganttBody');
    var metaEl = root.querySelector('#ganttCardMeta');
    var legendEl = root.querySelector('#ganttLegend');
    if (!bodyEl) return;

    renderFilterTabs(filterTabsEl);

    var axis = buildAxis(currentMonth);
    var allSections = buildSections(currentFilter);
    // Only show tasks whose range overlaps the month currently in view
    var sections = allSections.map(function (s) {
      return { project: s.project, tasks: s.tasks.filter(function (t) { return overlapsAxis(getTaskRange(t), axis); }) };
    }).filter(function (s) { return s.tasks.length > 0; });
    var members = (typeof TaskManager !== 'undefined' ? TaskManager.getMembers() : []) || [];
    var todayPct = (new Date() >= axis.start && new Date() < axis.end) ? pct(axis, new Date()) : null;

    var monthLabelEl = root.querySelector('#ganttMonthLabel');
    if (monthLabelEl) monthLabelEl.textContent = currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    // Legend: one dot per visible project
    legendEl.innerHTML = sections.map(function (s) {
      return '<div class="gantt-legend-item"><div class="gantt-legend-dot" style="background:' + (s.project.color || '#B08D57') + '"></div>' + escapeHtml(s.project.name || s.project.id) + '</div>';
    }).join('') + '<div class="gantt-legend-item"><div class="gantt-legend-line" style="background:#EF4444;opacity:.85"></div>Hôm nay</div>';

    var html = '';
    var totalTaskCount = 0;

    sections.forEach(function (section) {
      totalTaskCount += section.tasks.length;
      var color = section.project.color || '#B08D57';
      html += '<tr class="gantt-section-row">' +
        '<td colspan="1">' + escapeHtml(section.project.name || section.project.id) + '</td>' +
        '<td colspan="' + (12) + '"></td>' +
        '<td>' + section.tasks.length + ' hạng mục</td>' +
        '<td></td>' +
      '</tr>';

      section.tasks.forEach(function (task) {
        var range = getTaskRange(task);
        var assigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
        var taskMembers = assigneeIds.map(function (id) { return members.filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
        var member = taskMembers[0];
        var assigneeNames = taskMembers.length ? taskMembers.map(function (m) { return m.name; }).join(', ') : '—';
        var status = getStatusInfo(task);
        var progress = task.progress || 0;
        var left = pct(axis, range.start);
        var right = pct(axis, range.end);
        var width = Math.max(1.5, right - left);
        var circ = 2 * Math.PI * 16;
        var dash = (progress / 100) * circ;

        html += '<tr class="gantt-task-row">' +
          '<td><div class="gantt-task-info">' +
            '<div class="gantt-task-top">' +
              '<div class="gantt-task-avatar" style="background:' + (member ? member.color : color) + '" title="' + escapeHtml(assigneeNames) + '">' + escapeHtml(member ? member.avatar : '?') + (taskMembers.length > 1 ? '<span class="gantt-task-avatar-more">+' + (taskMembers.length - 1) + '</span>' : '') + '</div>' +
              '<div class="gantt-task-title">' + escapeHtml(task.title || '') + '</div>' +
            '</div>' +
            '<div class="gantt-task-sub">' +
              '<span class="gantt-task-deadline' + (status.cls === 'delayed' ? ' overdue' : '') + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                fmtDateShort(range.start) + ' – ' + fmtDateShort(range.end) +
              '</span>' +
            '</div>' +
          '</div></td>' +
          '<td colspan="12" style="position:relative;">' +
            '<div class="gantt-bar-cell"><div class="gantt-bar-track">' +
              axis.days.map(function (d, i) {
                if (i === 0) return '';
                var weekend = d.getDay() === 0 || d.getDay() === 6;
                return '<div class="gantt-month-line' + (weekend ? ' gantt-weekend-line' : '') + '" style="left:' + pct(axis, d) + '%"></div>';
              }).join('') +
              (todayPct !== null ? '<div class="gantt-today-line" style="left:' + todayPct + '%"></div>' : '') +
              '<div class="gantt-bar-item" style="left:' + left + '%;width:' + width + '%;background:linear-gradient(135deg,' + color + ',' + darken(color, 40) + ')" ' +
                'data-title="' + escapeHtml(task.title || '') + '" data-assignee="' + escapeHtml(assigneeNames) + '" ' +
                'data-progress="' + progress + '" data-start="' + fmtDateShort(range.start) + '" data-end="' + fmtDateShort(range.end) + '" data-project="' + escapeHtml(section.project.name || '') + '">' +
                (width > 8 ? progress + '%' : '') +
              '</div>' +
              (progress >= 100 ? '<div class="gantt-milestone" style="left:calc(' + (left + width) + '% - 7px)"></div>' : '') +
            '</div></div>' +
          '</td>' +
          '<td class="gantt-progress-cell"><div class="gantt-progress-ring">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" style="transform:rotate(-90deg)">' +
              '<circle class="gantt-progress-bg" cx="20" cy="20" r="16"/>' +
              '<circle class="gantt-progress-fill" cx="20" cy="20" r="16" stroke="' + color + '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ - dash) + '"/>' +
            '</svg>' +
            '<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:0.6875rem;font-weight:700;color:var(--color-text);">' + progress + '%</div>' +
          '</div></td>' +
          '<td style="text-align:right;padding-right:20px;"><span class="gantt-status-badge ' + status.cls + '">' + status.label + '</span></td>' +
        '</tr>';
      });
    });

    if (!html) {
      html = '<tr><td colspan="15"><div class="gantt-empty">' +
        '<div class="gantt-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>' +
        '<h3>Chưa có hạng mục nào</h3><p>Thêm việc có ngày bắt đầu/kết thúc để hiển thị trên Gantt.</p>' +
      '</div></td></tr>';
    }

    bodyEl.innerHTML = html;
    var headCell = tableEl.querySelector('thead th:nth-child(2)');
    headCell.innerHTML = '<div class="gantt-day-header">' + axis.days.map(function (d) {
      var weekend = d.getDay() === 0 || d.getDay() === 6;
      var isToday = d.toDateString() === new Date().toDateString();
      return '<div class="gantt-day-cell' + (weekend ? ' weekend' : '') + (isToday ? ' today' : '') + '" style="left:' + pct(axis, d) + '%">' +
        '<span class="gantt-day-dow">' + VI_DOW_SHORT[d.getDay()] + '</span>' +
        '<span class="gantt-day-num">' + d.getDate() + '</span>' +
      '</div>';
    }).join('') + '</div>';
    metaEl.innerHTML = '<strong>' + totalTaskCount + '</strong> hạng mục · Cập nhật ' + new Date().toLocaleDateString('vi-VN');
    applyZoom(root, axis);

    // Tooltip
    var tooltip = document.getElementById('ganttTooltip');
    root.querySelectorAll('.gantt-bar-item').forEach(function (bar) {
      bar.addEventListener('mouseenter', function () {
        tooltip.querySelector('.gantt-tooltip-title').textContent = bar.dataset.title;
        tooltip.querySelector('.gantt-tooltip-meta').innerHTML =
          '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;vertical-align:-2px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ' + escapeHtml(bar.dataset.assignee) + '</span>' +
          '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ' + bar.dataset.start + ' – ' + bar.dataset.end + '</span>' +
          '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;vertical-align:-2px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> ' + bar.dataset.progress + '% hoàn thành</span>' +
          '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;vertical-align:-2px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> ' + escapeHtml(bar.dataset.project) + '</span>';
        tooltip.classList.add('visible');
      });
      bar.addEventListener('mousemove', function (e) {
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
      });
      bar.addEventListener('mouseleave', function () { tooltip.classList.remove('visible'); });
    });
  }

  function bind(root) {
    var filterTabsEl = root.querySelector('#ganttFilterTabs');
    filterTabsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.gantt-filter-tab');
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      render(root);
    });
    var exportBtn = root.querySelector('#ganttExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () { exportExcel(currentFilter); });

    var prevBtn = root.querySelector('#ganttPrevMonth');
    var nextBtn = root.querySelector('#ganttNextMonth');
    var todayBtn = root.querySelector('#ganttTodayMonth');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render(root);
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render(root);
    });
    if (todayBtn) todayBtn.addEventListener('click', function () {
      var t = new Date();
      currentMonth = new Date(t.getFullYear(), t.getMonth(), 1);
      render(root);
    });

    bindMonthPicker(root);
    bindZoomControl(root);
    bindWheelZoom(root);
    bindWheelMonthNav(root.querySelector('.gantt-month-nav'), prevBtn, nextBtn);
  }

  // Lăn chuột khi trỏ vào cụm điều hướng tháng (mũi tên trái/phải + nhãn
  // "Tháng X Năm YYYY") để chuyển tháng nhanh, khỏi phải bấm mũi tên nhiều
  // lần — dùng chung cho mọi nơi có cụm điều hướng dạng mũi tên trái/phải.
  function bindWheelMonthNav(navEl, prevBtn, nextBtn) {
    if (!navEl || navEl.dataset.wheelBound) return;
    navEl.dataset.wheelBound = '1';
    navEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      var btn = e.deltaY > 0 ? nextBtn : prevBtn;
      if (btn) btn.click();
    }, { passive: false });
  }

  // Giữ Ctrl (hoặc Cmd trên Mac) + lăn chuột trong bảng Gantt để zoom in/out,
  // giống thao tác quen thuộc ở Google Maps/Figma. preventDefault() để chặn
  // trình duyệt zoom cả trang; chỉ kích hoạt khi con trỏ đang ở trong
  // .gantt-table-wrap (không ảnh hưởng cuộn trang bình thường).
  function bindWheelZoom(root) {
    var wrap = root.querySelector('.gantt-table-wrap');
    if (!wrap || wrap.dataset.wheelBound) return;
    wrap.dataset.wheelBound = '1';
    wrap.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var step = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      var next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((currentZoom + step) * 100) / 100));
      if (next === currentZoom) return;
      currentZoom = next;
      render(root);
    }, { passive: false });
  }

  // Độ rộng mỗi cột ngày = BASE_DAY_WIDTH * currentZoom, nhân với tổng số
  // ngày trong tháng đang xem — set qua CSS custom property thay vì tính lại
  // % vị trí thanh task (pct() không đổi, chỉ khung chứa giãn/co).
  function applyZoom(root, axis) {
    var width = Math.round(BASE_DAY_WIDTH * currentZoom * axis.totalDays);
    root.style.setProperty('--gantt-day-col-width', width + 'px');
    var levelEl = root.querySelector('#ganttZoomLevel');
    if (levelEl) levelEl.textContent = Math.round(currentZoom * 100) + '%';
    var zoomOutBtn = root.querySelector('#ganttZoomOut');
    var zoomInBtn = root.querySelector('#ganttZoomIn');
    if (zoomOutBtn) zoomOutBtn.disabled = currentZoom <= MIN_ZOOM;
    if (zoomInBtn) zoomInBtn.disabled = currentZoom >= MAX_ZOOM;
  }

  // Tự chèn cụm nút zoom vào toolbar (KHÔNG bắt buộc trang gọi HiconiqueGantt
  // phải tự viết sẵn markup này trong HTML) — dùng được ngay cho mọi trang đã
  // nhúng gantt.js (Dự án lẫn Task Manager) mà không cần sửa thêm chỗ nào khác.
  function bindZoomControl(root) {
    var toolbar = root.querySelector('.gantt-toolbar');
    if (!toolbar || toolbar.querySelector('.gantt-zoom')) return; // đã chèn rồi (VD render() gọi lại nhiều lần)
    var zoomEl = document.createElement('div');
    zoomEl.className = 'gantt-zoom';
    zoomEl.innerHTML =
      '<button type="button" class="gantt-zoom-btn" id="ganttZoomOut" aria-label="Thu nhỏ">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<span class="gantt-zoom-level" id="ganttZoomLevel">100%</span>' +
      '<button type="button" class="gantt-zoom-btn" id="ganttZoomIn" aria-label="Phóng to">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6" stroke-linecap="round"/></svg>' +
      '</button>';
    var exportBtn = toolbar.querySelector('#ganttExportBtn');
    if (exportBtn) toolbar.insertBefore(zoomEl, exportBtn); else toolbar.appendChild(zoomEl);

    zoomEl.querySelector('#ganttZoomOut').addEventListener('click', function () {
      currentZoom = Math.max(MIN_ZOOM, Math.round((currentZoom - ZOOM_STEP) * 100) / 100);
      render(root);
    });
    zoomEl.querySelector('#ganttZoomIn').addEventListener('click', function () {
      currentZoom = Math.min(MAX_ZOOM, Math.round((currentZoom + ZOOM_STEP) * 100) / 100);
      render(root);
    });
  }

  // Bấm thẳng vào nhãn "Tháng X Năm YYYY" mở bảng chọn nhanh 12 tháng + điều
  // hướng năm — cùng kiểu với timeline picker ở projects.js (dùng chung CSS
  // .timeline-month-picker/.timeline-month-panel/.timeline-month-grid).
  var pickerYear = null;
  function bindMonthPicker(root) {
    var picker = root.querySelector('#ganttMonthPicker');
    var btn = root.querySelector('#ganttMonthLabelBtn');
    var panel = root.querySelector('#ganttMonthPanel');
    var yearLabel = root.querySelector('#ganttYearLabel');
    var grid = root.querySelector('#ganttMonthGrid');
    var yearPrev = root.querySelector('#ganttYearPrev');
    var yearNext = root.querySelector('#ganttYearNext');
    if (!picker || !btn || !panel || !grid || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    var monthNames = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

    function renderGrid() {
      yearLabel.textContent = pickerYear;
      grid.innerHTML = monthNames.map(function (label, i) {
        var isCurrent = pickerYear === currentMonth.getFullYear() && i === currentMonth.getMonth();
        return '<button type="button" class="timeline-month-cell' + (isCurrent ? ' active' : '') + '" data-month="' + i + '">' + label + '</button>';
      }).join('');
      grid.querySelectorAll('.timeline-month-cell').forEach(function (cell) {
        cell.addEventListener('click', function () {
          currentMonth = new Date(pickerYear, parseInt(cell.dataset.month, 10), 1);
          panel.hidden = true;
          picker.classList.remove('open');
          render(root);
        });
      });
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = panel.hidden;
      panel.hidden = !willOpen;
      picker.classList.toggle('open', willOpen);
      if (willOpen) { pickerYear = currentMonth.getFullYear(); renderGrid(); }
    });
    yearPrev.addEventListener('click', function (e) { e.stopPropagation(); pickerYear--; renderGrid(); });
    yearNext.addEventListener('click', function (e) { e.stopPropagation(); pickerYear++; renderGrid(); });
    document.addEventListener('click', function (e) {
      if (!picker.contains(e.target)) { panel.hidden = true; picker.classList.remove('open'); }
    });
  }

  // ----- Excel export: classic construction "Bảng tiến độ thi công" weekly Gantt -----
  function exportExcel(filter) {
    if (typeof ExcelJS === 'undefined') {
      alert('Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại.');
      return;
    }
    var sections = buildSections(filter || 'all');
    if (!sections.length) {
      alert('Chưa có hạng mục công việc nào để xuất file.');
      return;
    }

    // Weekly axis (classic construction schedule granularity)
    var minD = null, maxD = null;
    sections.forEach(function (s) { s.tasks.forEach(function (t) {
      var r = getTaskRange(t);
      if (!minD || r.start < minD) minD = r.start;
      if (!maxD || r.end > maxD) maxD = r.end;
    }); });
    var weekStart = new Date(minD);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
    var weeks = [];
    var cur = new Date(weekStart);
    while (cur <= maxD) {
      weeks.push(new Date(cur));
      cur = new Date(cur.getTime() + 7 * MS_PER_DAY);
    }
    if (!weeks.length) weeks.push(new Date(weekStart));

    var wb = new ExcelJS.Workbook();
    wb.creator = 'HICONIQUE Internal Hub';
    wb.created = new Date();
    var ws = wb.addWorksheet('Tiến độ', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] });

    var FIXED_COLS = ['STT', 'Hạng mục công việc', 'Phụ trách', 'Bắt đầu', 'Kết thúc', 'Số ngày', '% HT', 'Trạng thái'];
    var totalCols = FIXED_COLS.length + weeks.length;

    // Title rows
    ws.mergeCells(1, 1, 1, totalCols);
    var titleCell = ws.getCell(1, 1);
    titleCell.value = 'BẢNG TIẾN ĐỘ THI CÔNG — HICONIQUE VIETNAM';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF0B0D10' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, totalCols);
    var subCell = ws.getCell(2, 1);
    subCell.value = 'Khoảng thời gian: ' + fmtDate(weekStart) + ' – ' + fmtDate(maxD) + '   ·   Xuất lúc: ' + new Date().toLocaleString('vi-VN');
    subCell.font = { size: 10, color: { argb: 'FF6B7280' } };

    // Header rows (row 3 = week labels grouped, row 4 = fixed cols + week short labels)
    var headerRow = 4;
    FIXED_COLS.forEach(function (label, i) {
      var cell = ws.getCell(headerRow, i + 1);
      cell.value = label;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22272E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = borderAll();
    });
    weeks.forEach(function (w, i) {
      var col = FIXED_COLS.length + i + 1;
      var cell = ws.getCell(headerRow, col);
      // Real date value (not text) so the Gantt shading below can reference it with a formula
      cell.value = w;
      cell.numFmt = 'dd/mm';
      cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22272E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = borderAll();
      ws.getColumn(col).width = 4;
    });
    ws.getRow(headerRow).height = 30;

    // Column widths for fixed columns
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 11;
    ws.getColumn(5).width = 11;
    ws.getColumn(6).width = 9;
    ws.getColumn(7).width = 7;
    ws.getColumn(8).width = 13;

    var r = headerRow + 1;
    var stt = 1;

    sections.forEach(function (section) {
      var color = (section.project.color || '#B08D57').replace('#', '').toUpperCase();
      ws.mergeCells(r, 1, r, totalCols);
      var groupCell = ws.getCell(r, 1);
      groupCell.value = (section.project.name || section.project.id).toUpperCase();
      groupCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
      groupCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(r).height = 18;
      r++;

      section.tasks.forEach(function (task) {
        var range = getTaskRange(task);
        var members = (typeof TaskManager !== 'undefined' ? TaskManager.getMembers() : []) || [];
        var xlsAssigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
        var xlsTaskMembers = xlsAssigneeIds.map(function (id) { return members.filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
        var status = getStatusInfo(task);
        // Số ngày = khoảng cách ngày (không +1) để công thức Kết thúc = Bắt đầu + Số ngày cho đúng ngày kết thúc thật
        var days = Math.max(0, Math.round((range.end - range.start) / MS_PER_DAY));

        // STT
        var cStt = ws.getCell(r, 1);
        cStt.value = stt++;
        // Hạng mục
        var cName = ws.getCell(r, 2);
        cName.value = task.title || '';
        // Phụ trách
        var cAssignee = ws.getCell(r, 3);
        cAssignee.value = xlsTaskMembers.length ? xlsTaskMembers.map(function (m) { return m.name; }).join(', ') : '—';
        // Bắt đầu — ngày thật (nguồn của công thức Kết thúc)
        var cStart = ws.getCell(r, 4);
        cStart.value = range.start;
        cStart.numFmt = 'dd/mm/yyyy';
        // Kết thúc = Bắt đầu + Số ngày (công thức, tự cập nhật nếu sửa 2 ô kia)
        var cEnd = ws.getCell(r, 5);
        cEnd.value = { formula: 'D' + r + '+F' + r };
        cEnd.numFmt = 'dd/mm/yyyy';
        // Số ngày
        var cDays = ws.getCell(r, 6);
        cDays.value = days;
        // % hoàn thành — số thực (0-1) để có thể dùng trong công thức/điều kiện
        var cProgress = ws.getCell(r, 7);
        cProgress.value = (task.progress || 0) / 100;
        cProgress.numFmt = '0%';
        // Trạng thái
        var cStatus = ws.getCell(r, 8);
        cStatus.value = status.label;

        [cStt, cName, cAssignee, cStart, cEnd, cDays, cProgress, cStatus].forEach(function (cell, i) {
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center', wrapText: i === 1 };
          cell.border = borderAll();
        });

        // Vạch tuần (mượn viền), tô màu qua conditional formatting bên dưới — liên kết trực tiếp với ô Bắt đầu/Kết thúc
        weeks.forEach(function (w, i) {
          ws.getCell(r, FIXED_COLS.length + i + 1).border = borderAll();
        });

        // Thanh Gantt = định dạng có điều kiện dựa trên ngày ở hàng tiêu đề so với $D{r}:$E{r}
        // => nếu sửa Bắt đầu / Số ngày trên Excel, thanh màu tự dịch chuyển theo
        var firstWeekCol = colLetter(FIXED_COLS.length + 1);
        var lastWeekCol = colLetter(totalCols);
        ws.addConditionalFormatting({
          ref: firstWeekCol + r + ':' + lastWeekCol + r,
          rules: [{
            type: 'expression',
            formulae: ['AND(' + firstWeekCol + '$' + headerRow + '<=$E' + r + ',' + firstWeekCol + '$' + headerRow + '+6>=$D' + r + ')'],
            priority: r,
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF' + color } } }
          }]
        });

        r++;
      });
    });

    ws.getRow(headerRow).eachCell(function (cell) { cell.border = borderAll(); });

    wb.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'Tien-do-cong-trinh-HICONIQUE-' + stamp + '.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function (err) {
      console.error('Export Excel failed:', err);
      alert('Xuất file thất bại. Vui lòng thử lại.');
    });
  }

  function borderAll() {
    var s = { style: 'thin', color: { argb: 'FFD9D9D9' } };
    return { top: s, left: s, bottom: s, right: s };
  }

  function colLetter(n) {
    var s = '';
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  return { render: render, bind: bind, exportExcel: exportExcel };
})();
