/**
 * HICONIQUE — Gantt view + Excel export for the Dự án page.
 * Reads real data from TaskManager (projects + tasks), no hardcoded demo data.
 */
var HiconiqueGantt = (function () {
  'use strict';

  var MS_PER_DAY = 86400000;
  var currentFilter = 'all';

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

  // ----- Build a month axis spanning every task in view -----
  function buildAxis(sections) {
    var minD = null, maxD = null;
    sections.forEach(function (s) {
      s.tasks.forEach(function (t) {
        var r = getTaskRange(t);
        if (!minD || r.start < minD) minD = r.start;
        if (!maxD || r.end > maxD) maxD = r.end;
      });
    });
    var today = new Date();
    if (!minD) minD = new Date(today.getFullYear(), today.getMonth(), 1);
    if (!maxD) maxD = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    var start = new Date(minD.getFullYear(), minD.getMonth(), 1);
    var end = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1); // exclusive
    // Ensure a minimum 3-month span so the chart isn't cramped
    while ((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) < 3) {
      end = new Date(end.getFullYear(), end.getMonth() + 1, 1);
    }

    var months = [];
    var cur = new Date(start);
    while (cur < end) {
      months.push(new Date(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    var totalDays = (end - start) / MS_PER_DAY;
    return { start: start, end: end, months: months, totalDays: totalDays };
  }

  function pct(axis, date) {
    return Math.max(0, Math.min(100, ((date - axis.start) / MS_PER_DAY / axis.totalDays) * 100));
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

    var sections = buildSections(currentFilter);
    var axis = buildAxis(sections);
    var members = (typeof TaskManager !== 'undefined' ? TaskManager.getMembers() : []) || [];
    var todayPct = (new Date() >= axis.start && new Date() < axis.end) ? pct(axis, new Date()) : null;

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
        var member = members.filter(function (m) { return m.id === task.assigneeId; })[0];
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
              '<div class="gantt-task-avatar" style="background:' + (member ? member.color : color) + '">' + escapeHtml(member ? member.avatar : '?') + '</div>' +
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
              axis.months.map(function (m, i) {
                if (i === 0) return '';
                return '<div class="gantt-month-line" style="left:' + pct(axis, m) + '%"></div>';
              }).join('') +
              (todayPct !== null ? '<div class="gantt-today-line" style="left:' + todayPct + '%"></div>' : '') +
              '<div class="gantt-bar-item" style="left:' + left + '%;width:' + width + '%;background:linear-gradient(135deg,' + color + ',' + darken(color, 40) + ')" ' +
                'data-title="' + escapeHtml(task.title || '') + '" data-assignee="' + escapeHtml(member ? member.name : '—') + '" ' +
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
    var monthLabel = axis.months.length ? (axis.months[0].toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }) + ' – ' + axis.months[axis.months.length - 1].toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })) : '';
    tableEl.querySelector('thead th:nth-child(2)').textContent = monthLabel;
    metaEl.innerHTML = '<strong>' + totalTaskCount + '</strong> hạng mục · Cập nhật ' + new Date().toLocaleDateString('vi-VN');

    // Tooltip
    var tooltip = document.getElementById('ganttTooltip');
    root.querySelectorAll('.gantt-bar-item').forEach(function (bar) {
      bar.addEventListener('mouseenter', function () {
        tooltip.querySelector('.gantt-tooltip-title').textContent = bar.dataset.title;
        tooltip.querySelector('.gantt-tooltip-meta').innerHTML =
          '<span>👤 ' + escapeHtml(bar.dataset.assignee) + '</span>' +
          '<span>📅 ' + bar.dataset.start + ' – ' + bar.dataset.end + '</span>' +
          '<span>📊 ' + bar.dataset.progress + '% hoàn thành</span>' +
          '<span>🏗 ' + escapeHtml(bar.dataset.project) + '</span>';
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
        var member = members.filter(function (m) { return m.id === task.assigneeId; })[0];
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
        cAssignee.value = member ? member.name : '—';
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
