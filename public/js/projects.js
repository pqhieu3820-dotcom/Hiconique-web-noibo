/* Projects Dashboard — uses TaskManager + Google Sheets */
(function () {
  'use strict';

  // ----- State -----
  var state = {
    viewType: 'board',
    projectFilter: 'all',
    quickFilters: { mine: false, dueToday: false, overdue: false, done: false },
    memberFilter: null, // member id filter
    statusFilter: null, // set by clicking the "Dang lam" stat card ('in-progress' | null)
    sortBy: 'deadline',
    timelineMonth: new Date().getMonth(),
    timelineYear: new Date().getFullYear()
  };

  var currentUser = null;
  var currentDetailTaskId = null;

  // ----- Helpers -----
  function getUser() {
    if (typeof Auth !== 'undefined' && Auth.getCurrentUser) return Auth.getCurrentUser();
    if (typeof TaskManager !== 'undefined' && TaskManager.getCurrentUser) return TaskManager.getCurrentUser();
    return null;
  }
  function getMembers() { return (typeof TaskManager !== 'undefined' && TaskManager.getMembers) ? TaskManager.getMembers() : []; }
  function getProjects() { return (typeof TaskManager !== 'undefined' && TaskManager.getProjects) ? TaskManager.getProjects() : []; }
  function getTasks() { return (typeof TaskManager !== 'undefined' && TaskManager.getTasks) ? TaskManager.getTasks() : []; }
  function getProjectById(id) { return (typeof TaskManager !== 'undefined' && TaskManager.getProject) ? TaskManager.getProject(id) : null; }
  function getMemberById(id) { return (typeof TaskManager !== 'undefined' && TaskManager.getMember) ? TaskManager.getMember(id) : null; }
  function getAssigneesForTask(task) { return (typeof TaskManager !== 'undefined' && TaskManager.getTaskAssignees) ? TaskManager.getTaskAssignees(task) : []; }
  // Chuỗi avatar chip cho N người phụ trách — dùng chung Kanban/List/Timeline.
  function assigneeChipsHtml(assignees, avatarClass) {
    if (!assignees.length) return '';
    return assignees.map(function (a) {
      return '<span class="' + avatarClass + '" style="background:' + (a.color || '#6B7280') + '" title="' + escapeHtml(a.name || '') + '">' + escapeHtml(a.avatar || (a.name || '?').substring(0, 2).toUpperCase()) + '</span>';
    }).join('');
  }

  // Phân loại theo HẠNG MỤC (category) — trước 2026-09-09 hạng mục từng được
  // lưu trong field `type`; giờ `type` = loại công trình thật (Nhà phố, Biệt
  // thự...) và hạng mục nằm ở field `category` mới. Fallback về `type` để
  // dự án cũ (tạo trước khi có field `category`) vẫn phân loại đúng như cũ.
  //
  // Đây CHỈ là phân loại thô 3 nhóm dùng cho bộ đếm sidebar (Thiết kế/Thi
  // công/Khác) — không dùng để chọn đúng thẻ hạng mục trong modal (xem
  // matchHangMucCard bên dưới, dùng danh sách đầy đủ HANG_MUC_LIST).
  function projectType(p) {
    var raw = p && (p.category || p.type);
    if (!raw) return 'admin';
    var t = raw.toLowerCase();
    if (t.indexOf('thiết kế') !== -1 || t.indexOf('thiet ke') !== -1 || t.indexOf('design') !== -1) return 'design';
    if (t.indexOf('thi công') !== -1 || t.indexOf('thi cong') !== -1 || t.indexOf('construction') !== -1) return 'construction';
    return 'admin';
  }

  // Danh sách đầy đủ Hạng mục (khớp với các thẻ .type-card trong
  // projects.html/pricing.html) — docCode dùng để tự sinh số hồ sơ/hợp đồng
  // dạng "HĐ" + docCode, VD Thi công -> HĐTC. Giữ đồng bộ 1-1 với data-type
  // của từng .type-card khi thêm/sửa hạng mục.
  var HANG_MUC_LIST = [
    { slug: 'design', label: 'Thiết kế', docCode: 'TK' },
    { slug: 'construction', label: 'Thi công', docCode: 'TC' },
    { slug: 'interior', label: 'Nội thất', docCode: 'NT' },
    { slug: 'consulting', label: 'Tư vấn', docCode: 'TV' },
    { slug: 'admin', label: 'Hành chính', docCode: 'HC' },
    { slug: 'marketing', label: 'Marketing', docCode: 'MK' },
    { slug: 'supervision', label: 'Giám sát thi công', docCode: 'GS' },
    { slug: 'pm', label: 'Quản lý dự án', docCode: 'QL' },
    { slug: 'general-contractor', label: 'Tổng thầu', docCode: 'TT' },
    { slug: 'structural', label: 'Kết cấu', docCode: 'KC' },
    { slug: 'mep', label: 'Cơ điện (M&E)', docCode: 'CD' },
    { slug: 'landscape', label: 'Cảnh quan', docCode: 'CQ' },
    { slug: 'bidding', label: 'Đấu thầu', docCode: 'DT' },
    { slug: 'maintenance', label: 'Bảo trì & bảo hành', docCode: 'BH' }
  ];

  // Khớp CHÍNH XÁC hạng mục đã lưu (category) với 1 trong 14 thẻ hạng mục để
  // tô sáng đúng thẻ khi sửa dự án — khớp theo nhãn trước (so khớp chuỗi
  // chính xác thì không sợ nhầm như dùng substring, VD "Giám sát thi công"
  // chứa "thi công" nhưng không phải hạng mục "Thi công"), rồi mới fallback
  // về phân loại thô projectType() cho dữ liệu cũ/tự do không khớp nhãn nào.
  function matchHangMucCard(category) {
    if (!category) return 'design';
    var t = String(category).trim().toLowerCase();
    var exact = HANG_MUC_LIST.find(function (h) { return h.label.toLowerCase() === t; });
    if (exact) return exact.slug;
    var partial = HANG_MUC_LIST.find(function (h) { return t.indexOf(h.label.toLowerCase()) !== -1; });
    if (partial) return partial.slug;
    return projectType({ category: category });
  }

  // Số hồ sơ/hợp đồng tự sinh: {ngày}{tháng}HĐ{mã hạng mục}/{mã dự án}-HICON{năm}
  // VD hôm nay 10/09/2026, hạng mục Thi công, mã dự án HMHOUSE:
  // "1009HĐTC/HMHOUSE-HICON2026".
  function buildDocNumber(hangMucSlug, shortCode) {
    if (!shortCode) return '';
    var hangMuc = HANG_MUC_LIST.find(function (h) { return h.slug === hangMucSlug; });
    if (!hangMuc) return '';
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var yyyy = now.getFullYear();
    return dd + mm + 'HĐ' + hangMuc.docCode + '/' + shortCode.toUpperCase() + '-HICON' + yyyy;
  }

  function todayStr() {
    var now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  }
  function isToday(dateStr) { return dateStr && dateStr.indexOf(todayStr()) === 0; }
  function isOverdue(task) {
    if (!task.deadline || task.status === 'completed') return false;
    return new Date(task.deadline) < new Date(todayStr() + 'T00:00');
  }
  function isDueToday(task) {
    if (!task.deadline || task.status === 'completed') return false;
    return isToday(task.deadline);
  }
  function fmtDate(deadline) {
    if (!deadline) return '';
    var d = new Date(deadline);
    if (isNaN(d.getTime())) return deadline;
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function priorityLabel(p) {
    if (p === 'high') return 'Cao';
    if (p === 'medium') return 'Trung bình';
    return 'Thấp';
  }
  function statusLabel(s) {
    if (s === 'in-progress') return 'Đang làm';
    if (s === 'completed') return 'Hoàn thành';
    if (s === 'review') return 'Chờ duyệt';
    return 'Chưa bắt đầu';
  }
  function statusBadgeClass(s) {
    if (s === 'in-progress') return 'status-progress';
    if (s === 'completed') return 'status-done';
    if (s === 'review') return 'status-review';
    return 'status-todo';
  }
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ----- Filter -----
  function getFilteredTasks() {
    var tasks = getTasks();
    var projects = getProjects();

    if (state.projectFilter !== 'all') {
      var allowedIds = {};
      projects.forEach(function (p) {
        if (projectType(p) === state.projectFilter) allowedIds[p.id] = true;
      });
      tasks = tasks.filter(function (t) { return allowedIds[t.projectId]; });
    }

    var f = state.quickFilters;
    if (f.mine && currentUser) {
      tasks = tasks.filter(function (t) { return Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(currentUser.id) !== -1; });
    }
    if (state.memberFilter) {
      tasks = tasks.filter(function (t) { return Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(state.memberFilter) !== -1; });
    }
    if (f.dueToday) tasks = tasks.filter(isDueToday);
    if (f.overdue) tasks = tasks.filter(isOverdue);
    if (!f.done) tasks = tasks.filter(function (t) { return t.status !== 'completed'; });
    if (state.statusFilter) tasks = tasks.filter(function (t) { return t.status === state.statusFilter; });

    tasks.sort(function (a, b) {
      if (state.sortBy === 'priority') {
        var order = { high: 0, medium: 1, low: 2 };
        return (order[a.priority] || 3) - (order[b.priority] || 3);
      }
      if (state.sortBy === 'createdAt') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });

    return tasks;
  }

  // ----- Stats -----
  function renderStats() {
    var projects = getProjects();
    var tasks = getTasks();
    var inProgress = tasks.filter(function (t) { return t.status === 'in-progress'; }).length;
    var overdue = tasks.filter(isOverdue).length;
    document.getElementById('statProjects').textContent = projects.length;
    document.getElementById('statTasks').textContent = tasks.length;
    document.getElementById('statInProgress').textContent = inProgress;
    document.getElementById('statOverdue').textContent = overdue;

    var inProgressCard = document.getElementById('statCardInProgress');
    if (inProgressCard) inProgressCard.classList.toggle('active', state.statusFilter === 'in-progress');
    var overdueCard = document.getElementById('statCardOverdue');
    if (overdueCard) overdueCard.classList.toggle('active', !!state.quickFilters.overdue);
  }

  // ----- Sidebar -----
  function renderSidebarCounts() {
    var projects = getProjects();
    var tasks = getTasks();
    var byType = { design: 0, construction: 0, admin: 0 };
    projects.forEach(function (p) { byType[projectType(p)]++; });
    document.getElementById('countAll').textContent = projects.length;
    document.getElementById('countDesign').textContent = byType.design;
    document.getElementById('countConstruction').textContent = byType.construction;
    document.getElementById('countAdmin').textContent = byType.admin;

    var members = getMembers();
    var memberList = document.getElementById('memberList');
    if (memberList) {
      memberList.innerHTML = '<div class="member-chip member-chip-all' + (!state.memberFilter ? ' active' : '') + '" data-member-filter="">' +
        '<span class="avatar-sm" style="background:var(--color-bronze)">⚡</span>' +
        '<span>Tất cả</span>' +
      '</div>' +
      members.map(function (m) {
        var myTaskCount = tasks.filter(function (t) { return Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(m.id) !== -1 && t.status !== 'completed'; }).length;
        var isActive = state.memberFilter === m.id;
        return '<div class="member-chip' + (isActive ? ' active' : '') + '" data-member-filter="' + escapeHtml(m.id) + '" title="' + escapeHtml(m.email || '') + '">' +
          '<span class="avatar-sm" style="background:' + (m.color || '#6B7280') + '">' +
            escapeHtml(m.avatar || (m.name || '?').substring(0, 2).toUpperCase()) +
          '</span>' +
          '<span>' + escapeHtml(m.name || '') + '</span>' +
          (myTaskCount > 0 ? ' <span class="member-task-count">' + myTaskCount + '</span>' : '') +
        '</div>';
      }).join('');

      // Bind member filter clicks
      memberList.querySelectorAll('[data-member-filter]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.dataset.memberFilter;
          state.memberFilter = id || null;
          renderAll();
        });
      });
    }
  }

  // ----- Render Board (Kanban) -----
  // Việc đã "Hoàn thành" chỉ hiện trên Board trong TUẦN hoàn thành đó — hết
  // tuần (qua 0h Thứ Hai tuần sau) tự ẩn khỏi cột này để cột không dài vô tận
  // theo thời gian. Dữ liệu KHÔNG mất — List/Timeline/Gantt và quick-filter
  // "Đã hoàn thành" vẫn thấy đủ, xem TaskManager.isCompletedThisWeek().
  function renderBoard() {
    var tasks = getFilteredTasks().filter(function (t) {
      if (t.status !== 'completed') return true;
      return !TaskManager.isCompletedThisWeek || TaskManager.isCompletedThisWeek(t.completedAt);
    });
    var columns = document.querySelectorAll('.column-tasks');
    var counts = { pending: 0, 'in-progress': 0, review: 0, completed: 0 };

    columns.forEach(function (col) { col.innerHTML = ''; });

    if (tasks.length === 0) {
      var firstCol = document.querySelector('.column-tasks');
      if (firstCol) {
        firstCol.innerHTML = '<div class="empty-column"><div class="empty-icon">📋</div><p>Không có việc nào.<br>Bấm "Thêm task" để tạo.</p></div>';
      }
    }

    tasks.forEach(function (task) {
      var col = document.querySelector('.column-tasks[data-status="' + task.status + '"]');
      if (!col) return;
      counts[task.status] = (counts[task.status] || 0) + 1;

      var project = getProjectById(task.projectId);
      var assignees = getAssigneesForTask(task);
      var priorityClass = 'priority-' + (task.priority || 'medium');
      var priorityText = priorityLabel(task.priority);

      var dueClass = '';
      var dueText = '';
      if (task.status !== 'completed') {
        if (isOverdue(task)) { dueClass = 'overdue'; dueText = '⚠ ' + fmtDate(task.deadline); }
        else if (isDueToday(task)) { dueClass = 'due-soon'; dueText = fmtDate(task.deadline); }
        else { dueText = fmtDate(task.deadline); }
      } else {
        dueClass = 'done-date';
        dueText = '✓ ' + fmtDate(task.deadline);
      }

      var progress = task.progress || 0;
      var tagsHtml = '';
      if (task.tags && task.tags.length) {
        tagsHtml = '<div class="task-tags">' + task.tags.slice(0, 3).map(function (t) {
          return '<span class="task-tag">' + escapeHtml(t) + '</span>';
        }).join('') + '</div>';
      }

      var html = ''
        + '<div class="task-card" draggable="true" data-task-id="' + escapeHtml(task.id) + '" data-priority="' + escapeHtml(task.priority || 'medium') + '">'
        +   '<div class="task-card-top">'
        +     '<span class="task-priority ' + priorityClass + '">' + priorityText + '</span>'
        +     (project ? '<span class="task-project-tag" style="--project-color:' + (project.color || '#B08D57') + '">' + escapeHtml(project.name) + '</span>' : '')
        +   '</div>'
        +   '<h4 class="task-title">' + escapeHtml(task.title || '') + '</h4>'
        +   (task.description ? '<p class="task-desc">' + escapeHtml(String(task.description).slice(0, 80)) + (String(task.description).length > 80 ? '…' : '') + '</p>' : '')
        +   (progress > 0 ? '<div class="task-progress-bar"><div class="progress-track"><span style="width:' + progress + '%"></span></div><span class="progress-percent">' + progress + '%</span></div>' : '')
        +   tagsHtml
        +   '<div class="task-meta">'
        +     (assignees.length ? '<span class="task-assignee task-assignee-stack">' + assigneeChipsHtml(assignees, 'avatar-xs') + (assignees.length === 1 ? '<span class="assignee-name">' + escapeHtml(assignees[0].name || '') + '</span>' : '') + '</span>' : '')
        +     '<span class="task-date ' + dueClass + '">' + dueText + '</span>'
        +   '</div>'
        + '</div>';

      col.insertAdjacentHTML('beforeend', html);
    });

    document.getElementById('countTodo').textContent = counts.pending || 0;
    document.getElementById('countDoing').textContent = counts['in-progress'] || 0;
    document.getElementById('countReview').textContent = counts.review || 0;
    document.getElementById('countDone').textContent = counts.completed || 0;

    bindDragEvents();
  }

  function renderList() {
    var tasks = getFilteredTasks();
    var body = document.getElementById('listBody');
    if (!body) return;

    if (tasks.length === 0) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:3rem;color:#9AA0A6;">Không có việc nào</td></tr>';
      return;
    }

    body.innerHTML = tasks.map(function (task) {
      var project = getProjectById(task.projectId);
      var assignees = getAssigneesForTask(task);
      var checked = task.status === 'completed' ? 'checked' : '';
      var titleStyle = task.status === 'completed' ? 'text-decoration:line-through' : '';
      var dueClass = isOverdue(task) ? 'due-soon' : '';

      return ''
        + '<tr data-task-id="' + escapeHtml(task.id) + '" class="task-list-row">'
        +   '<td>'
        +     '<label class="task-checkbox" style="' + titleStyle + '">'
        +       '<input type="checkbox" class="task-toggle" ' + checked + '>'
        +       '<span>' + escapeHtml(task.title) + '</span>'
        +     '</label>'
        +   '</td>'
        +   '<td>' + (project ? '<span class="project-tag" style="--project-color:' + (project.color || '#B08D57') + '">' + escapeHtml(project.name) + '</span>' : '—') + '</td>'
        +   '<td>' + (assignees.length ? assigneeChipsHtml(assignees, 'avatar-xs') + (assignees.length === 1 ? ' ' + escapeHtml(assignees[0].name) : '') : '—') + '</td>'
        +   '<td class="' + dueClass + '">' + fmtDate(task.deadline) + '</td>'
        +   '<td><span class="status-badge ' + statusBadgeClass(task.status) + '">' + statusLabel(task.status) + '</span></td>'
        +   '<td><span class="priority-badge priority-' + (task.priority || 'medium') + '">' + priorityLabel(task.priority) + '</span></td>'
        + '</tr>';
    }).join('');

    body.querySelectorAll('.task-toggle').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var row = cb.closest('tr');
        var id = row && row.dataset.taskId;
        if (id && typeof TaskManager !== 'undefined' && TaskManager.toggleTaskStatus) {
          TaskManager.toggleTaskStatus(id);
          renderAll();
        }
      });
    });

    body.querySelectorAll('.task-list-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.task-checkbox')) return;
        var id = row.dataset.taskId;
        if (id) openTaskDetail(id);
      });
    });
  }

  function renderTimeline() {
    var body = document.getElementById('timelineBody');
    var title = document.getElementById('timelineTitle');
    if (!body || !title) return;

    var tasks = getFilteredTasks();
    title.textContent = 'Tháng ' + (state.timelineMonth + 1) + ' / ' + state.timelineYear;

    var groups = {};
    tasks.forEach(function (t) {
      if (!t.deadline) return;
      var d = new Date(t.deadline);
      if (d.getMonth() !== state.timelineMonth || d.getFullYear() !== state.timelineYear) return;
      var key = t.deadline.split('T')[0];
      groups[key] = groups[key] || [];
      groups[key].push(t);
    });

    var keys = Object.keys(groups).sort();
    var today = todayStr();
    var html = '';

    if (keys.length === 0) {
      html = '<div class="timeline-empty"><div class="empty-icon">📅</div><p>Không có deadline nào trong tháng này</p></div>';
    } else {
      keys.forEach(function (dateStr) {
        var d = new Date(dateStr);
        var dayLabel = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        var isTodayClass = (dateStr === today) ? ' timeline-today' : '';

        html += '<div class="timeline-row' + isTodayClass + '">';
        html += '<div class="timeline-date">' + dayLabel + '</div>';
        html += '<div class="timeline-events">';

        groups[dateStr].forEach(function (task) {
          var project = getProjectById(task.projectId);
          var assignees = getAssigneesForTask(task);
          var color = '#B08D57';
          if (task.priority === 'high') color = '#DC2626';
          else if (task.priority === 'low') color = '#059669';
          var overdue = isOverdue(task) ? 'Quá hạn' : (task.status === 'completed' ? '✓ Hoàn thành' : 'Deadline');

          html += '<div class="timeline-event" data-task-id="' + escapeHtml(task.id) + '" style="border-left-color:' + color + '">';
          html += '<span class="event-time">' + overdue + '</span>';
          html += '<span class="event-title">' + escapeHtml(task.title) + '</span>';
          html += '<div class="event-meta">';
          if (project) html += '<span class="event-project">' + escapeHtml(project.name) + '</span>';
          html += assigneeChipsHtml(assignees, 'avatar-xxs');
          html += '</div>';
          html += '</div>';
        });

        html += '</div></div>';
      });
    }

    body.innerHTML = html;

    body.querySelectorAll('.timeline-event').forEach(function (ev) {
      ev.addEventListener('click', function () {
        var id = ev.dataset.taskId;
        if (id) openTaskDetail(id);
      });
    });
  }

  function renderAll() {
    renderStats();
    renderSidebarCounts();
    if (state.viewType === 'board') renderBoard();
    else if (state.viewType === 'list') renderList();
    else if (state.viewType === 'timeline') renderTimeline();
    else if (state.viewType === 'gantt' && typeof HiconiqueGantt !== 'undefined') {
      HiconiqueGantt.render(document.getElementById('gantt-view'));
    }
  }

  // ----- View toggle -----
  function setView(viewType) {
    document.querySelectorAll('.view-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === viewType);
    });
    state.viewType = viewType;

    document.getElementById('kanban-board').style.display = viewType === 'board' ? 'flex' : 'none';
    document.getElementById('list-view').style.display = viewType === 'list' ? 'block' : 'none';
    document.getElementById('timeline-view').style.display = viewType === 'timeline' ? 'block' : 'none';
    document.getElementById('gantt-view').style.display = viewType === 'gantt' ? 'block' : 'none';

    renderAll();
  }

  function bindViewTabs() {
    document.querySelectorAll('.view-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { setView(tab.dataset.view); });
    });
  }

  function bindProjectNav() {
    var navItems = document.querySelectorAll('.project-nav-item');
    navItems.forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        navItems.forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');
        state.projectFilter = item.dataset.project;
        renderAll();
      });
    });
  }

  function bindQuickFilters() {
    var map = {
      filterMine: 'mine',
      filterDueToday: 'dueToday',
      filterOverdue: 'overdue',
      filterDone: 'done'
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        state.quickFilters[map[id]] = el.checked;
        renderAll();
      });
    });
  }

  // Make the 4 top stat tiles act as quick filters/shortcuts instead of
  // being purely decorative.
  function bindStatCards() {
    var projectsCard = document.getElementById('statCardProjects');
    if (projectsCard) {
      projectsCard.addEventListener('click', function () {
        renderProjectListModal();
        var listModal = document.getElementById('project-list-modal');
        if (listModal) listModal.hidden = false;
      });
    }

    var tasksCard = document.getElementById('statCardTasks');
    if (tasksCard) {
      tasksCard.addEventListener('click', function () {
        state.statusFilter = null;
        state.quickFilters = { mine: false, dueToday: false, overdue: false, done: false };
        state.projectFilter = 'all';
        state.memberFilter = null;
        ['filterMine', 'filterDueToday', 'filterOverdue', 'filterDone'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.checked = false;
        });
        document.querySelectorAll('.project-nav-item').forEach(function (i) {
          i.classList.toggle('active', i.dataset.project === 'all');
        });
        renderAll();
      });
    }

    var inProgressCard = document.getElementById('statCardInProgress');
    if (inProgressCard) {
      inProgressCard.addEventListener('click', function () {
        state.statusFilter = state.statusFilter === 'in-progress' ? null : 'in-progress';
        renderAll();
      });
    }

    var overdueCard = document.getElementById('statCardOverdue');
    if (overdueCard) {
      overdueCard.addEventListener('click', function () {
        state.quickFilters.overdue = !state.quickFilters.overdue;
        var checkbox = document.getElementById('filterOverdue');
        if (checkbox) checkbox.checked = state.quickFilters.overdue;
        renderAll();
      });
    }
  }

  function bindSort() {
    var btn = document.getElementById('btnSort');
    var labelEl = document.getElementById('sortLabel');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var order = ['deadline', 'priority', 'createdAt'];
      var labels = { deadline: 'Deadline', priority: 'Ưu tiên', createdAt: 'Mới tạo' };
      var i = order.indexOf(state.sortBy);
      state.sortBy = order[(i + 1) % order.length];
      if (labelEl) labelEl.textContent = 'Sắp xếp: ' + labels[state.sortBy];
      renderAll();
    });
  }

  function bindTimelineNav() {
    var prev = document.getElementById('prevMonth');
    var next = document.getElementById('nextMonth');
    if (prev) prev.addEventListener('click', function () {
      state.timelineMonth--;
      if (state.timelineMonth < 0) { state.timelineMonth = 11; state.timelineYear--; }
      renderTimeline();
    });
    if (next) next.addEventListener('click', function () {
      state.timelineMonth++;
      if (state.timelineMonth > 11) { state.timelineMonth = 0; state.timelineYear++; }
      renderTimeline();
    });
  }

  // ----- Drag & drop -----
  function bindDragEvents() {
    var cards = document.querySelectorAll('.task-card');
    cards.forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', function () {
        card.classList.remove('dragging');
      });
      card.addEventListener('click', function (e) {
        if (e.target.closest('.task-progress-bar') || e.target.closest('button')) return;
        var id = card.dataset.taskId;
        if (id) openTaskDetail(id);
      });
    });

    var columns = document.querySelectorAll('.column-tasks');
    columns.forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', function () {
        col.classList.remove('drag-over');
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('drag-over');
        var id = e.dataTransfer.getData('text/plain');
        var newStatus = col.dataset.status;
        if (!id || !newStatus) return;
        if (typeof TaskManager !== 'undefined' && TaskManager.updateTask) {
          var task = TaskManager.getTask(id);
          if (task && task.status !== newStatus) {
            TaskManager.updateTask(id, { status: newStatus });
            renderAll();
          }
        }
      });
    });

    // Column add buttons
    document.querySelectorAll('.column-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openTaskModalForCreate(btn.dataset.addStatus);
      });
    });
  }

  // ----- Task modal (create/edit) -----
  var taskModal = null;
  var taskForm = null;

  function openTaskModalForCreate(status) {
    var titleEl = document.getElementById('taskModalTitle');
    if (titleEl) titleEl.textContent = 'Tạo việc mới';
    if (taskForm) taskForm.reset();
    delete taskForm.dataset.editingId;
    taskAssigneeSelectedIds = [];
    populateTaskFormOptions();
    if (status) {
      var statusSel = document.getElementById('task-status');
      if (statusSel) statusSel.value = status;
    }
    if (taskModal) taskModal.hidden = false;
  }

  function openEditTask(id) {
    var task = getTasks().filter(function (t) { return t.id === id; })[0];
    if (!task) return;
    var titleEl = document.getElementById('taskModalTitle');
    if (titleEl) titleEl.textContent = 'Sửa việc';
    populateTaskFormOptions();

    document.getElementById('task-name').value = task.title || '';
    document.getElementById('task-project').value = task.projectId || '';
    setSelectedAssignees(Array.isArray(task.assigneeIds) ? task.assigneeIds : []);
    document.getElementById('task-priority').value = task.priority || 'medium';
    document.getElementById('task-status').value = task.status || 'pending';
    document.getElementById('task-start').value = task.startDate ? task.startDate.substring(0, 10) : '';
    document.getElementById('task-due').value = task.deadline ? task.deadline.substring(0, 10) : '';
    document.getElementById('task-desc').value = task.description || '';

    if (taskForm) taskForm.dataset.editingId = id;
    if (taskModal) taskModal.hidden = false;
  }

  var taskAssigneeSelectedIds = [];

  function populateTaskFormOptions() {
    var projectSel = document.getElementById('task-project');

    if (projectSel) {
      var projects = getProjects();
      projectSel.innerHTML = '<option value="">Chọn dự án...</option>' +
        projects.map(function (p) {
          return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>';
        }).join('');
    }
    renderTaskAssigneeDropdown();
  }

  function renderTaskAssigneeDropdown() {
    var dd = document.getElementById('task-assignee-dd');
    if (!dd) return;
    var panel = dd.querySelector('.assignee-dd-panel');
    var trigger = dd.querySelector('.assignee-dd-trigger');
    var triggerText = dd.querySelector('.assignee-dd-trigger-text');
    var members = getMembers();

    panel.innerHTML = members.map(function (m) {
      var checked = taskAssigneeSelectedIds.indexOf(m.id) !== -1;
      return '<div class="assignee-dd-item' + (checked ? ' selected' : '') + '" data-member-id="' + escapeHtml(m.id) + '">'
        + '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
        + '<span class="avatar-xs" style="background:' + (m.color || '#6B7280') + '">' + escapeHtml(m.avatar || (m.name || '?').substring(0, 2).toUpperCase()) + '</span>'
        + '<span>' + escapeHtml(m.name || '') + '</span>'
        + '</div>';
    }).join('');

    function updateTriggerText() {
      var names = members.filter(function (m) { return taskAssigneeSelectedIds.indexOf(m.id) !== -1; }).map(function (m) { return m.name; });
      if (names.length) {
        triggerText.textContent = names.join(', ');
        triggerText.classList.remove('placeholder');
      } else {
        triggerText.textContent = 'Chọn người...';
        triggerText.classList.add('placeholder');
      }
    }
    updateTriggerText();

    panel.querySelectorAll('.assignee-dd-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.dataset.memberId;
        var idx = taskAssigneeSelectedIds.indexOf(id);
        if (idx === -1) taskAssigneeSelectedIds.push(id); else taskAssigneeSelectedIds.splice(idx, 1);
        item.classList.toggle('selected', idx === -1);
        updateTriggerText();
      });
    });

    if (!trigger.dataset.bound) {
      trigger.dataset.bound = '1';
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dd.classList.toggle('open');
        panel.hidden = !isOpen;
      });
      document.addEventListener('click', function (e) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          panel.hidden = true;
        }
      });
    }
  }

  function setSelectedAssignees(ids) {
    taskAssigneeSelectedIds = ids.slice();
    renderTaskAssigneeDropdown();
  }

  function getSelectedAssignees() {
    return taskAssigneeSelectedIds.slice();
  }

  function bindTaskModal() {
    taskModal = document.getElementById('task-modal');
    taskForm = document.getElementById('taskForm');
    var openBtn = document.getElementById('btnNewTask');
    var closeBtn = taskModal ? taskModal.querySelector('.modal-close') : null;
    var cancelBtn = taskModal ? taskModal.querySelector('.modal-cancel') : null;

    if (openBtn) openBtn.addEventListener('click', function () { openTaskModalForCreate(); });
    if (closeBtn) closeBtn.addEventListener('click', function () { taskModal.hidden = true; });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { taskModal.hidden = true; });
    if (taskModal) {
      taskModal.addEventListener('click', function (e) {
        if (e.target === taskModal) taskModal.hidden = true;
      });
    }
    if (taskForm) {
      taskForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('task-name').value.trim();
        if (!name) return;

        var data = {
          title: name,
          projectId: document.getElementById('task-project').value,
          assigneeIds: getSelectedAssignees(),
          priority: document.getElementById('task-priority').value,
          status: document.getElementById('task-status').value,
          startDate: document.getElementById('task-start').value || '',
          deadline: document.getElementById('task-due').value || '',
          description: document.getElementById('task-desc').value,
          createdBy: currentUser ? currentUser.id : '',
          createdAt: new Date().toISOString()
        };

        var editingId = taskForm.dataset.editingId;
        if (editingId && typeof TaskManager !== 'undefined' && TaskManager.updateTask) {
          TaskManager.updateTask(editingId, data);
        } else if (typeof TaskManager !== 'undefined' && TaskManager.createTask) {
          TaskManager.createTask(data);
        }

        taskModal.hidden = true;
        renderAll();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          openTaskModalForCreate();
        }
      }
      if (e.key === 'Escape') {
        if (taskModal && !taskModal.hidden) taskModal.hidden = true;
        var detailModal = document.getElementById('task-detail-modal');
        if (detailModal && !detailModal.hidden) detailModal.hidden = true;
      }
    });
  }

  // ----- Task Detail Modal (with daily progress) -----
  function openTaskDetail(taskId) {
    var task = getTasks().filter(function (t) { return t.id === taskId; })[0];
    if (!task) return;
    currentDetailTaskId = taskId;

    var project = getProjectById(task.projectId);
    var assignees = getAssigneesForTask(task);
    var todayProgress = (typeof TaskManager !== 'undefined' && TaskManager.getTodayProgress) ? TaskManager.getTodayProgress(taskId) : null;
    if (!todayProgress) todayProgress = { progress: task.progress || 0, note: '', done: false };
    var dailyTasks = task.dailyTasks || [];

    document.getElementById('detailTitle').textContent = task.title;

    var priorityClass = 'priority-' + (task.priority || 'medium');
    var priorityText = priorityLabel(task.priority);
    var dueClass = isOverdue(task) ? 'overdue' : '';
    var dueLabel = isOverdue(task) ? '⚠ Quá hạn' : (isDueToday(task) ? '📅 Hôm nay' : '📅 ' + fmtDate(task.deadline));

    var metaHtml = ''
      + '<span class="detail-tag ' + priorityClass + '">' + priorityText + '</span>'
      + '<span class="detail-status status-badge ' + statusBadgeClass(task.status) + '">' + statusLabel(task.status) + '</span>'
      + '<span class="detail-due ' + dueClass + '">' + dueLabel + '</span>';

    document.getElementById('detailMeta').innerHTML = metaHtml;

    var bodyHtml = ''
      + '<div class="detail-grid">'
      +   '<div class="detail-field"><label>Dự án</label><p>' + (project ? escapeHtml(project.name) : 'Chưa có') + '</p></div>'
      +   '<div class="detail-field"><label>Người phụ trách</label><p>' + (assignees.length ? escapeHtml(assignees.map(function (a) { return a.name; }).join(', ')) : 'Chưa giao') + '</p></div>'
      +   '<div class="detail-field"><label>Ngày bắt đầu</label><p>' + (task.startDate ? fmtDate(task.startDate) : '—') + '</p></div>'
      +   '<div class="detail-field"><label>Deadline</label><p>' + (task.deadline ? fmtDate(task.deadline) : '—') + '</p></div>'
      + '</div>'
      + (task.description ? '<div class="detail-desc">' + escapeHtml(task.description) + '</div>' : '')
      + '<div class="daily-progress-section">'
      +   '<div class="dps-header">'
      +     '<h4>📊 Cập nhật tiến độ hôm nay</h4>'
      +     '<span class="dps-date">' + new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }) + '</span>'
      +   '</div>'
      +   '<div class="dps-bar-wrap">'
      +     '<div class="dps-bar-row"><span>Tiến độ hôm nay: <strong style="color:var(--color-bronze)">' + todayProgress.progress + '%</strong></span><span>Tổng: <strong>' + (task.progress || 0) + '%</strong></span></div>'
      +     '<div class="dps-bar"><span style="width:' + todayProgress.progress + '%"></span></div>'
      +   '</div>'
      +   '<div class="dps-slider-row">'
      +     '<input type="range" id="dpSlider" min="0" max="100" value="' + todayProgress.progress + '" />'
      +     '<span id="dpValue">' + todayProgress.progress + '%</span>'
      +   '</div>'
      +   '<div class="dps-note">'
      +     '<label>📝 Đã làm gì hôm nay?</label>'
      +     '<textarea id="dpNote" placeholder="Mô tả công việc đã làm hôm nay...">' + escapeHtml(todayProgress.note || '') + '</textarea>'
      +   '</div>'
      +   '<button type="button" id="dpSaveBtn" class="btn-primary dps-save">Lưu tiến độ hôm nay</button>'
      +   (dailyTasks.length > 0 ? '<div class="dps-history"><h5>Lịch sử tiến độ</h5>' + dailyTasks.slice().reverse().slice(0, 5).map(function (d) {
      return '<div class="dps-history-row"><span class="dps-history-date">' + new Date(d.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) + '</span><span class="dps-history-pct" style="color:' + (d.done ? '#4F6F52' : 'var(--color-bronze)') + '">' + d.progress + '%</span><span class="dps-history-note">' + escapeHtml(d.note || '—') + '</span></div>';
    }).join('') + '</div>' : '')
      + '</div>';

    document.getElementById('detailBody').innerHTML = bodyHtml;

    var detailModal = document.getElementById('task-detail-modal');
    if (detailModal) detailModal.hidden = false;

    // Wire up sliders and save button
    setTimeout(function () {
      var slider = document.getElementById('dpSlider');
      var valueEl = document.getElementById('dpValue');
      if (slider && valueEl) {
        slider.addEventListener('input', function () {
          valueEl.textContent = this.value + '%';
        });
      }
      var saveBtn = document.getElementById('dpSaveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var progress = document.getElementById('dpSlider').value;
          var note = document.getElementById('dpNote').value;
          if (typeof TaskManager !== 'undefined' && TaskManager.addDailyProgress) {
            TaskManager.addDailyProgress(taskId, progress, note);
          }
          // Show feedback
          saveBtn.textContent = '✓ Đã lưu';
          setTimeout(function () { saveBtn.textContent = 'Lưu tiến độ hôm nay'; }, 1500);
          renderAll();
        });
      }
      var editBtn = document.getElementById('btnEditTask');
      if (editBtn) {
        editBtn.onclick = function () { openEditTask(taskId); };
      }
      var delBtn = document.getElementById('btnDeleteTask');
      if (delBtn) {
        delBtn.onclick = function () {
          if (confirm('Bạn có chắc chắn muốn xóa việc này?')) {
            if (typeof TaskManager !== 'undefined' && TaskManager.deleteTask) {
              TaskManager.deleteTask(taskId);
            }
            detailModal.hidden = true;
            renderAll();
          }
        };
      }
    }, 50);
  }

  function bindDetailModal() {
    var detailModal = document.getElementById('task-detail-modal');
    if (!detailModal) return;
    detailModal.querySelectorAll('.modal-close-detail').forEach(function (btn) {
      btn.addEventListener('click', function () { detailModal.hidden = true; });
    });
    detailModal.addEventListener('click', function (e) {
      if (e.target === detailModal) detailModal.hidden = true;
    });
  }

  // ----- Project modal -----
  function bindProjectModal() {
    var modal = document.getElementById('project-modal');
    var form = document.getElementById('projectForm');
    var openBtn = document.getElementById('btnAddProject');
    var closeBtn = modal ? modal.querySelector('.modal-close-project') : null;
    var cancelBtn = modal ? modal.querySelector('.modal-cancel-project') : null;

    if (!modal || !form) return;

    // Color presets
    var presets = ['#B08D57', '#C7A464', '#3B6B8C', '#4F6F52', '#8E7CC3', '#A04848', '#C77A40', '#475569'];
    var presetsEl = document.getElementById('colorPresets');
    if (presetsEl) {
      presetsEl.innerHTML = presets.map(function (c) {
        return '<button type="button" class="color-swatch" data-color="' + c + '" style="background:' + c + '" aria-label="Màu ' + c + '"></button>';
      }).join('');
      presetsEl.querySelectorAll('.color-swatch').forEach(function (sw) {
        sw.addEventListener('click', function () {
          var colorInput = document.getElementById('project-color');
          if (colorInput) colorInput.value = sw.dataset.color;
        });
      });
    }

    // Tỉnh/Thành — cùng danh sách 34 tỉnh thật dùng ở tab "Đơn giá theo tỉnh"
    // (pricing.html), gọi thẳng action có sẵn getProvinceList, load 1 lần.
    var provinceSel = document.getElementById('project-province');
    if (provinceSel && typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.USE_GSHEETS && GSHEETS_CONFIG.API_URL) {
      fetch(GSHEETS_CONFIG.API_URL + '?action=getProvinceList', { redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (list) {
          (Array.isArray(list) ? list : []).forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            provinceSel.appendChild(opt);
          });
        })
        .catch(function (e) { console.error('Không tải được danh sách tỉnh:', e); });
    }

    // Loại dự án — đồng bộ 2 chiều với dropdown "nguồn" (cột U ẩn) trên sheet Dự án:
    // thêm giá trị mới ở cột đó thì web cũng tự thấy, không cần sửa code.
    var buildingTypeSel = document.getElementById('project-building-type');
    if (buildingTypeSel && typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.USE_GSHEETS && GSHEETS_CONFIG.API_URL) {
      fetch(GSHEETS_CONFIG.API_URL + '?action=getProjectTypes', { redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (list) {
          if (!Array.isArray(list) || !list.length) return;
          var currentVal = buildingTypeSel.value;
          buildingTypeSel.innerHTML = '<option value="">— Chọn loại công trình —</option>';
          list.forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            buildingTypeSel.appendChild(opt);
          });
          if (currentVal) buildingTypeSel.value = currentVal;
        })
        .catch(function (e) { console.error('Không tải được danh sách loại dự án:', e); });
    }

    // Type cards behavior
    var typeCards = form.querySelectorAll('.type-card');
    typeCards.forEach(function (card) {
      card.addEventListener('click', function () {
        typeCards.forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        var radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        updateDocNumberPreview();
      });
    });

    // Số hồ sơ/hợp đồng tự sinh — cập nhật theo hạng mục đang chọn + mã dự án
    // đang nhập, ẩn hẳn nếu chưa có mã dự án (không có gì để sinh số).
    var codeInput = document.getElementById('project-code');
    var previewWrap = document.getElementById('docNumberPreviewWrap');
    var previewEl = document.getElementById('docNumberPreview');
    var copyBtn = document.getElementById('docNumberCopyBtn');
    function updateDocNumberPreview() {
      if (!codeInput || !previewWrap || !previewEl) return;
      var activeCard = form.querySelector('.type-card.active');
      var slug = activeCard ? activeCard.dataset.type : 'design';
      var docNumber = buildDocNumber(slug, codeInput.value.trim());
      previewWrap.hidden = !docNumber;
      if (docNumber) previewEl.textContent = docNumber;
    }
    if (codeInput) {
      codeInput.addEventListener('input', function () {
        codeInput.value = codeInput.value.toUpperCase();
        updateDocNumberPreview();
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(previewEl.textContent).then(function () {
          var old = copyBtn.textContent;
          copyBtn.textContent = 'Đã chép!';
          setTimeout(function () { copyBtn.textContent = old; }, 1500);
        });
      });
    }

    if (openBtn) openBtn.addEventListener('click', function () {
      form.reset();
      delete form.dataset.editingId;
      delete form.dataset.originalCategory;
      var eyebrow = modal.querySelector('.modal-eyebrow');
      if (eyebrow) eyebrow.textContent = 'DỰ ÁN MỚI';
      var title = document.getElementById('projectModalTitle');
      if (title) title.textContent = 'Tạo dự án mới';
      var submitBtn = document.getElementById('projectSubmitBtn');
      if (submitBtn) submitBtn.textContent = 'Tạo dự án';
      // Reset type cards visual
      typeCards.forEach(function (c) { c.classList.remove('active'); });
      var defaultCard = form.querySelector('.type-card[data-type="design"]');
      if (defaultCard) {
        defaultCard.classList.add('active');
        var radio = defaultCard.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      }
      // Reset color
      var colorInput = document.getElementById('project-color');
      if (colorInput) colorInput.value = '#B08D57';
      // Set default member
      renderProjectMembers(currentUser ? [currentUser.id] : []);
      updateDocNumberPreview();
      var listModal = document.getElementById('project-list-modal');
      if (listModal) listModal.hidden = true;
      modal.hidden = false;
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { modal.hidden = true; });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { modal.hidden = true; });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.hidden = true;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('project-name').value.trim();
      if (!name) return;

      var catInput = form.querySelector('input[name="project-type"]:checked');
      var catVal = catInput ? catInput.value : 'design';

      var data = {
        name: name,
        type: document.getElementById('project-building-type').value,
        shortCode: document.getElementById('project-code').value.trim().toUpperCase(),
        color: document.getElementById('project-color').value,
        client: document.getElementById('project-client').value.trim(),
        investor: document.getElementById('project-investor').value.trim(),
        location: document.getElementById('project-location').value.trim(),
        province: document.getElementById('project-province').value,
        startDate: document.getElementById('project-start').value || '',
        endDate: document.getElementById('project-end').value || '',
        budget: parseInt(document.getElementById('project-budget').value, 10) || 0,
        priority: document.getElementById('project-priority').value,
        status: document.getElementById('project-status').value,
        description: document.getElementById('project-desc').value,
        members: getSelectedMembers()
      };

      var editingId = form.dataset.editingId;
      if (!editingId) {
        // Only stamp these on brand-new projects — updateProject merges
        // `data` into the existing record, so including them here would
        // silently reset an existing project's progress/createdAt on every edit.
        data.progress = 0;
        data.createdAt = new Date().toISOString().split('T')[0];
      }
      // Preserve the project's original `category` string when the hạng mục
      // wasn't changed (older/seed projects store a full Vietnamese label
      // like "Thiết kế nội thất" — this page's radios only know the short
      // codes, so re-saving unchanged would otherwise downgrade that label).
      if (editingId && form.dataset.originalCategory && matchHangMucCard(form.dataset.originalCategory) === catVal) {
        data.category = form.dataset.originalCategory;
      } else {
        var typeLabelEl = form.querySelector('.type-card.active .type-label');
        data.category = typeLabelEl ? typeLabelEl.textContent.trim() : catVal;
      }

      var ok = false;
      if (editingId) {
        ok = !!(typeof TaskManager !== 'undefined' && TaskManager.updateProject && TaskManager.updateProject(editingId, data, getUser()));
      } else if (typeof TaskManager !== 'undefined' && TaskManager.createProject) {
        ok = !!TaskManager.createProject(data, getUser());
      }

      if (!ok) {
        showToast('Bạn không có quyền ' + (editingId ? 'sửa' : 'tạo') + ' dự án.');
        return;
      }

      modal.hidden = true;
      renderAll();
      var listModal = document.getElementById('project-list-modal');
      if (editingId && listModal && !listModal.hidden) renderProjectListModal();
      showToast(editingId ? '✓ Đã cập nhật dự án: ' + name : '✓ Đã tạo dự án: ' + name);
    });
  }

  // Populate the create/edit modal with an existing project's data and
  // switch it into "edit" mode (used by the project list modal's Sửa button).
  function openProjectForEdit(project) {
    var modal = document.getElementById('project-modal');
    var form = document.getElementById('projectForm');
    if (!modal || !form || !project) return;

    form.reset();
    form.dataset.editingId = project.id;
    form.dataset.originalCategory = project.category || project.type || '';

    document.getElementById('project-name').value = project.name || '';
    document.getElementById('project-building-type').value = project.type || '';
    document.getElementById('project-code').value = (project.shortCode || '').toUpperCase();
    document.getElementById('project-client').value = project.client || '';
    document.getElementById('project-investor').value = project.investor || '';
    document.getElementById('project-location').value = project.location || '';
    document.getElementById('project-province').value = project.province || '';
    document.getElementById('project-start').value = project.startDate ? String(project.startDate).substring(0, 10) : '';
    document.getElementById('project-end').value = project.endDate ? String(project.endDate).substring(0, 10) : '';
    document.getElementById('project-budget').value = project.budget || '';
    document.getElementById('project-priority').value = project.priority || 'medium';
    document.getElementById('project-status').value = project.status || 'on-track';
    document.getElementById('project-desc').value = project.description || '';
    document.getElementById('project-color').value = project.color || '#B08D57';

    var cat = matchHangMucCard(project.category || project.type);
    form.querySelectorAll('.type-card').forEach(function (c) {
      c.classList.toggle('active', c.dataset.type === cat);
    });
    var radio = form.querySelector('input[name="project-type"][value="' + cat + '"]');
    if (radio) radio.checked = true;
    var previewWrapEl = document.getElementById('docNumberPreviewWrap');
    var previewTextEl = document.getElementById('docNumberPreview');
    if (previewWrapEl && previewTextEl) {
      var docNumber = buildDocNumber(cat, project.shortCode || '');
      previewWrapEl.hidden = !docNumber;
      if (docNumber) previewTextEl.textContent = docNumber;
    }

    var memberIds = Array.isArray(project.members)
      ? project.members
      : (project.members ? String(project.members).split(',').map(function (s) { return s.trim(); }) : []);
    renderProjectMembers(memberIds);

    var eyebrow = modal.querySelector('.modal-eyebrow');
    if (eyebrow) eyebrow.textContent = 'CHỈNH SỬA DỰ ÁN';
    var title = document.getElementById('projectModalTitle');
    if (title) title.textContent = 'Chỉnh sửa dự án';
    var submitBtn = document.getElementById('projectSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Lưu thay đổi';

    var listModal = document.getElementById('project-list-modal');
    if (listModal) listModal.hidden = true;
    modal.hidden = false;
  }

  // ----- Project list modal (view all + edit/delete entry point) -----
  function renderProjectListModal() {
    var body = document.getElementById('projectListBody');
    if (!body) return;
    var projects = getProjects();
    var canManage = !!currentUser && (currentUser.roleLevel === 'admin' || currentUser.roleLevel === 'manager');

    if (projects.length === 0) {
      body.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;">Chưa có dự án nào.</p>';
      return;
    }

    body.innerHTML = projects.map(function (p) {
      var meta = [];
      if (p.client) meta.push('KH: ' + escapeHtml(p.client));
      if (p.investor) meta.push('NĐT: ' + escapeHtml(p.investor));
      if (p.budget) meta.push(Number(p.budget).toLocaleString('vi-VN') + ' VNĐ');
      meta.push((p.progress || 0) + '% hoàn thành');
      return '<div class="project-list-row" data-project-id="' + escapeHtml(p.id) + '">'
        + '<div class="project-list-avatar' + (p.shortCode && p.shortCode.length > 3 ? ' project-list-avatar-long' : '') + '" style="background:' + (p.color || '#B08D57') + '">' + escapeHtml(p.shortCode || (p.name || '?').charAt(0)) + '</div>'
        + '<div class="project-list-info">'
        +   '<div class="project-list-name">' + escapeHtml(p.name || '') + ' <span style="color:var(--color-text-muted);font-weight:400;">· ' + escapeHtml([p.type, p.category].filter(Boolean).join(' · ')) + '</span></div>'
        +   '<div class="project-list-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('<span>·</span>') + '</div>'
        + '</div>'
        + '<div class="project-list-actions">'
        +   (canManage ? '<button type="button" data-edit-project="' + escapeHtml(p.id) + '">Sửa</button>' : '')
        +   (canManage ? '<button type="button" class="danger" data-delete-project="' + escapeHtml(p.id) + '">Xoá</button>' : '')
        + '</div>'
      + '</div>';
    }).join('');

    body.querySelectorAll('[data-edit-project]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var project = getProjectById(btn.dataset.editProject);
        if (project) openProjectForEdit(project);
      });
    });
    body.querySelectorAll('[data-delete-project]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var project = getProjectById(btn.dataset.deleteProject);
        if (!project) return;
        if (!confirm('Xoá dự án "' + project.name + '"? Toàn bộ task trong dự án cũng sẽ bị xoá.')) return;
        if (!TaskManager.deleteProject(project.id, getUser())) {
          showToast('Bạn không có quyền xoá dự án.');
          return;
        }
        renderProjectListModal();
        renderAll();
        showToast('✓ Đã xoá dự án: ' + project.name);
      });
    });
  }

  function bindProjectListModal() {
    var modal = document.getElementById('project-list-modal');
    if (!modal) return;
    modal.querySelectorAll('.modal-close-project-list').forEach(function (btn) {
      btn.addEventListener('click', function () { modal.hidden = true; });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.hidden = true;
    });

    var addFromListBtn = document.getElementById('btnAddProjectFromList');
    if (addFromListBtn) {
      var canManage = !!currentUser && (currentUser.roleLevel === 'admin' || currentUser.roleLevel === 'manager');
      if (!canManage) {
        addFromListBtn.style.display = 'none';
      } else {
        addFromListBtn.addEventListener('click', function () {
          var mainAddBtn = document.getElementById('btnAddProject');
          if (mainAddBtn) mainAddBtn.click();
        });
      }
    }
  }

  function renderProjectMembers(selectedIds) {
    var container = document.getElementById('projectMembers');
    if (!container) return;
    var members = getMembers();
    if (members.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.8125rem;">Chưa có thành viên nào.</p>';
      return;
    }
    container.innerHTML = members.map(function (m) {
      var checked = selectedIds.indexOf(m.id) !== -1;
      return '<label class="member-multi-item' + (checked ? ' active' : '') + '">'
        + '<input type="checkbox" value="' + escapeHtml(m.id) + '"' + (checked ? ' checked' : '') + '>'
        + '<span class="avatar-xs" style="background:' + (m.color || '#6B7280') + '">' + escapeHtml(m.avatar || (m.name || '?').substring(0, 2).toUpperCase()) + '</span>'
        + '<span>' + escapeHtml(m.name || '') + '</span>'
        + '</label>';
    }).join('');

    container.querySelectorAll('.member-multi-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var input = item.querySelector('input');
        if (input) {
          input.checked = !input.checked;
          item.classList.toggle('active', input.checked);
        }
      });
    });
  }

  function getSelectedMembers() {
    var container = document.getElementById('projectMembers');
    if (!container) return [];
    var ids = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
      ids.push(cb.value);
    });
    return ids;
  }

  // ----- Work Report (Báo cáo công việc — CEO/Manager) -----
  // Tiến độ dự án + tiến độ từng người + nhật ký cập nhật hàng ngày của từng
  // task, tính lại trực tiếp từ dữ liệu đang có trong TaskManager mỗi lần mở
  // (không phải số liệu tĩnh) — nút refresh còn ép tải lại từ Google Sheets
  // trước khi tính, để chắc chắn "theo thời gian thực tế ngay lúc đó".
  function reportActiveMembers() {
    return getMembers().filter(function (m) { return !m.status || m.status === 'active'; });
  }

  function populateReportFilters() {
    var projectSel = document.getElementById('reportProjectFilter');
    var memberSel = document.getElementById('reportMemberFilter');
    if (projectSel) {
      var projects = getProjects();
      projectSel.innerHTML = '<option value="all">Tất cả dự án</option>' +
        projects.map(function (p) { return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name || p.id) + '</option>'; }).join('');
    }
    if (memberSel) {
      var members = reportActiveMembers();
      memberSel.innerHTML = '<option value="all">Tất cả thành viên</option>' +
        members.map(function (m) { return '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(m.name || m.id) + '</option>'; }).join('');
    }
  }

  function formatNowTime() {
    var d = new Date();
    return 'Cập nhật lúc ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  }

  function renderWorkReport() {
    var body = document.getElementById('workReportBody');
    if (!body) return;
    var updatedEl = document.getElementById('reportUpdatedAt');
    if (updatedEl) updatedEl.textContent = formatNowTime();

    var projectFilter = document.getElementById('reportProjectFilter');
    var memberFilter = document.getElementById('reportMemberFilter');
    var projectId = projectFilter ? projectFilter.value : 'all';
    var memberId = memberFilter ? memberFilter.value : 'all';

    // Lọc bỏ dòng rác không có id/tên (VD 1 dòng trống sót lại trên Sheet
    // "Dự án") — báo cáo không nên hiện 1 dòng trống gây khó hiểu, dù dữ liệu
    // gốc trên Sheet vẫn giữ nguyên (không tự ý sửa/xoá dữ liệu người dùng).
    var allProjects = getProjects().filter(function (p) { return p && p.id && p.name; });
    var allTasks = getTasks();
    var members = reportActiveMembers();
    var today = todayStr();

    var projects = projectId === 'all' ? allProjects : allProjects.filter(function (p) { return p.id === projectId; });
    var tasks = allTasks.filter(function (t) {
      if (projectId !== 'all' && t.projectId !== projectId) return false;
      if (memberId !== 'all' && !(Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(memberId) !== -1)) return false;
      return true;
    });

    // ----- Overview -----
    var completedToday = tasks.filter(function (t) {
      return Array.isArray(t.dailyTasks) && t.dailyTasks.some(function (d) { return d.date === today && d.done; });
    }).length;
    var avgProgress = tasks.length ? Math.round(tasks.reduce(function (s, t) { return s + (t.progress || 0); }, 0) / tasks.length) : 0;
    var overdueCount = tasks.filter(isOverdue).length;

    var overviewHtml = '<div class="report-stat-grid">'
      + '<div class="report-stat"><span class="report-stat-label">Dự án</span><span class="report-stat-value">' + projects.length + '</span></div>'
      + '<div class="report-stat"><span class="report-stat-label">Tổng việc</span><span class="report-stat-value">' + tasks.length + '</span></div>'
      + '<div class="report-stat"><span class="report-stat-label">Tiến độ TB</span><span class="report-stat-value">' + avgProgress + '%</span></div>'
      + '<div class="report-stat"><span class="report-stat-label">Quá hạn</span><span class="report-stat-value" style="' + (overdueCount ? 'color:#DC2626' : '') + '">' + overdueCount + '</span></div>'
      + '</div>';

    // ----- Theo dự án -----
    var byProjectHtml = '<div class="report-section"><h4>Tiến độ theo dự án</h4>' +
      (projects.length === 0 ? '<div class="report-empty">Không có dự án nào khớp bộ lọc.</div>' : projects.map(function (p) {
        var pTasks = tasks.filter(function (t) { return t.projectId === p.id; });
        var pDone = pTasks.filter(function (t) { return t.status === 'completed'; }).length;
        var pProgress = pTasks.length ? Math.round(pTasks.reduce(function (s, t) { return s + (t.progress || 0); }, 0) / pTasks.length) : 0;
        return '<div class="report-row">'
          + '<div class="report-row-name"><span class="truncate" title="' + escapeHtml(p.name || '') + '">' + escapeHtml(p.name || p.id) + '</span></div>'
          + '<div class="progress-track"><span style="width:' + pProgress + '%"></span></div>'
          + '<div class="report-row-meta">' + pProgress + '% · ' + pDone + '/' + pTasks.length + ' xong</div>'
          + '</div>';
      }).join('')) + '</div>';

    // ----- Theo người -----
    var reportMembers = memberId === 'all' ? members : members.filter(function (m) { return m.id === memberId; });
    var byMemberHtml = '<div class="report-section"><h4>Tiến độ theo người</h4>' +
      (reportMembers.length === 0 ? '<div class="report-empty">Không có thành viên nào khớp bộ lọc.</div>' : reportMembers.map(function (m) {
        var mTasks = allTasks.filter(function (t) {
          if (!(Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(m.id) !== -1)) return false;
          if (projectId !== 'all' && t.projectId !== projectId) return false;
          return true;
        });
        if (mTasks.length === 0 && memberId === 'all') return ''; // ẩn người chưa được giao việc nào khớp bộ lọc khi xem tổng
        var mDone = mTasks.filter(function (t) { return t.status === 'completed'; }).length;
        var mProgress = mTasks.length ? Math.round(mTasks.reduce(function (s, t) { return s + (t.progress || 0); }, 0) / mTasks.length) : 0;
        var mOverdue = mTasks.filter(isOverdue).length;
        return '<div class="report-row">'
          + '<div class="report-row-name"><span class="report-avatar" style="background:' + (m.color || '#6B7280') + '">' + escapeHtml(m.avatar || (m.name || '?').substring(0, 2).toUpperCase()) + '</span><span class="truncate">' + escapeHtml(m.name || m.id) + '</span></div>'
          + '<div class="progress-track"><span style="width:' + mProgress + '%"></span></div>'
          + '<div class="report-row-meta">' + mProgress + '% · ' + mDone + '/' + mTasks.length + ' xong' + (mOverdue ? ' · ' + mOverdue + ' quá hạn' : '') + '</div>'
          + '</div>';
      }).join('')) + '</div>';

    // ----- Nhật ký tiến độ hôm nay (dailyTasks) -----
    var dailyEntries = [];
    tasks.forEach(function (t) {
      if (!Array.isArray(t.dailyTasks)) return;
      var entry = t.dailyTasks.find(function (d) { return d.date === today; });
      if (!entry) return;
      dailyEntries.push({ task: t, entry: entry });
    });
    var byDailyHtml = '<div class="report-section"><h4>Nhật ký tiến độ hôm nay (' + dailyEntries.length + ')</h4>' +
      (dailyEntries.length === 0 ? '<div class="report-empty">Chưa có ai cập nhật tiến độ hôm nay.</div>' : dailyEntries.map(function (row) {
        var t = row.task, entry = row.entry;
        var project = getProjectById(t.projectId);
        var assignees = getAssigneesForTask(t).map(function (a) { return a.name; }).join(', ');
        return '<div class="report-daily-item">'
          + '<div class="report-daily-body">'
          +   '<div class="report-daily-title">' + escapeHtml(t.title || '') + '</div>'
          +   '<div class="report-daily-meta">' + escapeHtml(project ? project.name : '—') + (assignees ? ' · ' + escapeHtml(assignees) : '') + '</div>'
          +   (entry.note ? '<div class="report-daily-note">"' + escapeHtml(entry.note) + '"</div>' : '')
          + '</div>'
          + '<div class="report-daily-pct">' + (entry.progress || 0) + '%' + (entry.done ? ' ✓' : '') + '</div>'
          + '</div>';
      }).join('')) + '</div>';

    body.innerHTML = overviewHtml + byProjectHtml + byMemberHtml + byDailyHtml;
  }

  function bindWorkReportModal() {
    var modal = document.getElementById('work-report-modal');
    var openBtn = document.getElementById('btnWorkReport');
    if (!modal || !openBtn) return;

    var canManage = !!currentUser && (currentUser.roleLevel === 'admin' || currentUser.roleLevel === 'manager');
    if (!canManage) { openBtn.hidden = true; return; }
    openBtn.hidden = false;

    openBtn.addEventListener('click', function () {
      populateReportFilters();
      renderWorkReport();
      modal.hidden = false;
      // Vừa mở là tự tải lại dữ liệu mới nhất từ Sheet 1 lần cho đúng nghĩa
      // "thời gian thực" — không chặn hiển thị, render lại khi xong.
      if (typeof TaskManager !== 'undefined' && TaskManager.refreshFromGSheets) {
        TaskManager.refreshFromGSheets(function () {
          populateReportFilters();
          renderWorkReport();
        });
      }
    });

    modal.querySelectorAll('.modal-close-report').forEach(function (btn) {
      btn.addEventListener('click', function () { modal.hidden = true; });
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

    var refreshBtn = document.getElementById('reportRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.classList.add('spinning');
        if (typeof TaskManager !== 'undefined' && TaskManager.refreshFromGSheets) {
          TaskManager.refreshFromGSheets(function () {
            populateReportFilters();
            renderWorkReport();
            refreshBtn.classList.remove('spinning');
          });
        } else {
          renderWorkReport();
          refreshBtn.classList.remove('spinning');
        }
      });
    }

    var projectFilter = document.getElementById('reportProjectFilter');
    var memberFilter = document.getElementById('reportMemberFilter');
    if (projectFilter) projectFilter.addEventListener('change', renderWorkReport);
    if (memberFilter) memberFilter.addEventListener('change', renderWorkReport);
  }

  // ----- Sync from Google Sheets -----
  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 50);
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // ----- Init -----
  function init() {
    currentUser = getUser();
    var canManageProjects = !!currentUser && (currentUser.roleLevel === 'admin' || currentUser.roleLevel === 'manager');
    var addProjectBtn = document.getElementById('btnAddProject');
    if (addProjectBtn && !canManageProjects) addProjectBtn.style.display = 'none';
    bindViewTabs();
    bindProjectNav();
    bindQuickFilters();
    bindStatCards();
    bindSort();
    bindTimelineNav();
    bindTaskModal();
    bindProjectModal();
    bindProjectListModal();
    bindDetailModal();
    bindWorkReportModal();
    if (typeof HiconiqueGantt !== 'undefined') HiconiqueGantt.bind(document.getElementById('gantt-view'));

    if (window.location.hash === '#gantt') {
      setView('gantt');
    } else {
      renderAll();
    }

    // Listen for data refresh
    if (typeof TaskManager !== 'undefined') {
      setInterval(function () {
        if (typeof TaskManager.refreshFromGSheets === 'function') {
          TaskManager.refreshFromGSheets(function () { renderAll(); });
        }
      }, 30000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
