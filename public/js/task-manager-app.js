/**
 * Task Manager Application - Interactive Behaviors
 */

(function() {
  'use strict';

  // DOM Elements
  let modalOverlay = null;
  let currentModal = null;

  // 2026-09-19: state cho "Calendar To Do List" (mục Lịch, xem renderCalendar()
  // phía dưới) — tháng/năm đang xem + ngày đang mở chi tiết, giữ NGOÀI hàm để
  // sống sót qua các lần renderCalendar() (đổi tháng/năm, bấm Tải lại...).
  var todoCalState = (function () {
    var now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, selectedDate: null };
  })();

  // Normalize task.assigneeIds (mảng nhiều người phụ trách) — tolerate ô cũ
  // dạng chuỗi đơn (chưa migrate) hoặc thiếu hẳn field.
  function getTaskAssigneeIds(task) {
    if (!task || !task.assigneeIds) return [];
    if (Array.isArray(task.assigneeIds)) return task.assigneeIds;
    if (typeof task.assigneeIds === 'string') {
      try { var arr = JSON.parse(task.assigneeIds); if (Array.isArray(arr)) return arr; } catch (e) {}
      if (task.assigneeIds.trim()) return [task.assigneeIds.trim()];
    }
    return [];
  }
  function taskHasAssignee(task, memberId) {
    return getTaskAssigneeIds(task).indexOf(memberId) !== -1;
  }

  // 2026-09-21: nhãn/màu 4 trạng thái (Chờ xử lý/Đang làm/Chờ duyệt/Hoàn
  // thành) — thay 2 chỗ ternary 3-nhánh cũ (coi mọi trạng thái khác pending/
  // in-progress là "Hoàn thành", khiến việc đang 'review' hiện SAI thành đã
  // xong) bằng 1 hàm dùng chung duy nhất.
  function taskStatusLabel(status) {
    if (status === 'in-progress') return 'Đang làm';
    if (status === 'review') return 'Chờ duyệt';
    if (status === 'completed') return 'Hoàn thành';
    return 'Chờ xử lý';
  }

  // 2026-09-22: helper dùng chung — lọc bỏ task đã "Xoá" (visible=false,
  // không xoá thật nữa) và task Hoàn thành đã qua tháng hoàn thành khỏi MỌI
  // danh sách/board hiển thị hàng ngày (List, Kanban, badge số lượng, lịch,
  // "Tasks của tôi"...). Dùng ở mọi nơi gọi TaskManager.getTasks() để render
  // ra màn hình cho người dùng browse — KHÔNG dùng ở chỗ tính thống kê/báo
  // cáo theo năm/quý (những chỗ đó đọc thẳng TaskManager.getTasks() không lọc).
  function visibleTasks(filters) {
    var tasks = TaskManager.getTasks(filters);
    if (!TaskManager.isVisibleNow) return tasks;
    return tasks.filter(function (t) { return TaskManager.isVisibleNow(t); });
  }

  // showToast()/showConfirmDialog() — copy y hệt pattern cùng tên đã dùng ở
  // timesheet.html/portal.js (dùng chung class .ts-confirm-overlay và tương
  // đương cho toast, có sẵn trong portal.css) — file này CHƯA có bản riêng
  // của nó, tasks-manager.html trước giờ toàn dùng alert()/confirm() gốc
  // trình duyệt (vi phạm quy tắc cố định của dự án). Chỉ thêm để dùng cho
  // code MỚI (quy trình duyệt việc) — không đi sửa lại toàn bộ alert() cũ có
  // sẵn trong file này, ngoài phạm vi việc đang làm.
  function showToast(message, ok) {
    var el = document.createElement('div');
    el.className = 'ts-confirm-toast';
    el.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:100080; padding:10px 16px; border-radius:8px; font-size:0.8125rem; font-weight:600; color:#fff; background:' + (ok === false ? 'var(--color-destructive, #A04848)' : 'var(--color-bronze)') + '; box-shadow:0 6px 20px rgba(0,0,0,0.25);';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
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
  // Bảng nhập lý do từ chối duyệt việc — dùng chung style .ts-confirm-overlay/
  // -box, thêm 1 textarea bắt buộc (không cho gửi trống, người bị từ chối
  // cần biết rõ cần sửa gì).
  function showTaskRejectDialog(onSubmit) {
    var overlay = document.createElement('div');
    overlay.className = 'ts-confirm-overlay';
    overlay.innerHTML =
      '<div class="ts-confirm-box" style="max-width:420px;">' +
        '<div class="ts-confirm-title">Từ chối công việc này</div>' +
        '<label style="display:block; font-size:0.8125rem; color:var(--color-text-muted); margin:-12px 0 8px;">Lý do từ chối (bắt buộc — người được giao sẽ thấy nội dung này)</label>' +
        '<textarea id="taskRejectNoteInput" rows="3" style="width:100%; box-sizing:border-box; margin-bottom:16px; padding:8px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:6px; color:var(--color-text); font-size:0.8125rem; font-family:inherit;" placeholder="VD: chưa đúng vật liệu, cần bổ sung ảnh nghiệm thu…"></textarea>' +
        '<div class="ts-confirm-actions">' +
          '<button type="button" class="ts-confirm-cancel">Huỷ</button>' +
          '<button type="button" class="ts-confirm-ok">Từ chối</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = overlay.querySelector('#taskRejectNoteInput');
    input.focus();
    overlay.querySelector('.ts-confirm-cancel').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('.ts-confirm-ok').addEventListener('click', function () {
      var note = input.value.trim();
      if (!note) { input.style.borderColor = '#A04848'; input.focus(); return; }
      overlay.remove();
      onSubmit(note);
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 2026-09-19: nút ẩn/hiện panel "Tiến độ hôm nay" — chỉ cần toggle 1 class
  // trên .tm-main (CSS lo phần co giãn lưới + ẩn nội dung panel, xem
  // task-manager.css). Nhớ trạng thái qua localStorage để lần mở trang sau
  // vẫn giữ nguyên lựa chọn (VD ai đang cần bề ngang rộng cho Gantt/Lịch thì
  // không phải tắt lại mỗi lần).
  var TM_PANEL_COLLAPSED_KEY = 'hiconique_tm_panel_collapsed';
  function bindRightPanelToggle() {
    var toggleBtn = document.getElementById('tmPanelToggle');
    var tmMain = document.querySelector('.tm-main');
    if (!toggleBtn || !tmMain) return;

    var collapsed = false;
    try { collapsed = localStorage.getItem(TM_PANEL_COLLAPSED_KEY) === '1'; } catch (e) { /* bỏ qua */ }
    tmMain.classList.toggle('tm-panel-collapsed', collapsed);

    toggleBtn.addEventListener('click', function () {
      collapsed = !collapsed;
      tmMain.classList.toggle('tm-panel-collapsed', collapsed);
      try { localStorage.setItem(TM_PANEL_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) { /* bỏ qua */ }
    });
  }

  // Normalize project.members from Google Sheets string to array
  function getProjectMembers(project) {
    if (!project || !project.members) return [];
    if (Array.isArray(project.members)) return project.members;
    if (typeof project.members === 'string') {
      try { return JSON.parse(project.members); } catch(e) {}
      if (project.members.trim()) return project.members.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  // Initialize app
  function init() {
    // Check auth first
    var currentUser = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;

    if (!currentUser && typeof Auth !== 'undefined') {
      // Wait for auth to load data, then show login modal
      setTimeout(function() {
        Auth.init(true);
        window.onAuthSuccess = function() {
          window.location.reload();
        };
      }, 500);
      return; // Don't render until logged in
    }

    createModalStructure();
    setupEventListeners();
    renderDashboard();

    // 2026-09-19: mở thẳng chi tiết 1 task khi tới từ link thông báo
    // (?openTask=<id>) — xem notifTarget() trong portal.js (bấm thông báo
    // "Việc quá hạn"/"Việc đến hạn hôm nay" giờ nhảy thẳng vào đúng task thay
    // vì chỉ đánh dấu đã đọc rồi thôi). Xoá param khỏi URL sau khi mở để
    // F5/back không mở lại modal ngoài ý muốn.
    var openTaskId = new URLSearchParams(window.location.search).get('openTask');
    if (openTaskId) {
      openTaskDetailModal(openTaskId);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Wire sync button click handler
    var syncBtn = document.getElementById('syncFromSheetsBtn');
    if (syncBtn) syncBtn.addEventListener('click', syncFromSheets);

    // Nút refresh nhỏ trên panel "Tiến độ hôm nay" — ép tải lại từ Sheet trước khi tính lại.
    var dpRefreshBtn = document.getElementById('dpRefreshBtn');
    if (dpRefreshBtn) {
      dpRefreshBtn.addEventListener('click', function () {
        dpRefreshBtn.classList.add('spinning');
        if (typeof TaskManager !== 'undefined' && TaskManager.refreshFromGSheets) {
          TaskManager.refreshFromGSheets(function () {
            renderDailyProgressPanel();
            dpRefreshBtn.classList.remove('spinning');
          });
        } else {
          renderDailyProgressPanel();
          dpRefreshBtn.classList.remove('spinning');
        }
      });
    }

    bindRightPanelToggle();

    // Update user info in UI
    if (currentUser) updateUserUIUI(currentUser);

    // Update badges with real data
    updateNavBadges();

    // Start auto-polling from Google Sheets every 15s
    startAutoPolling();

    // 2026-09-19: TaskManager.refreshFromGSheets() (chạy ngầm mỗi 20s qua
    // offline.js, và cả bản 60s riêng của startAutoPolling() ở trên) tự
    // phát sự kiện 'hiconique:data-refreshed' khi xong — vẽ lại đúng view
    // đang mở (không chỉ badge/số liệu như startAutoPolling() cố tình bỏ
    // qua để tránh giật màn hình lúc đang thao tác Kanban).
    window.addEventListener('hiconique:data-refreshed', rerenderActiveView);
  }

  // Update UI with current user info
  function updateUserUIUI(user) {
    // Update header avatar
    var avatarEl = document.querySelector('.header-actions .avatar span');
    if (avatarEl) avatarEl.textContent = user.avatar;

    // Update welcome text in sidebar
    var welcomeName = document.querySelector('.welcome-name');
    if (welcomeName) welcomeName.textContent = user.name;

    // Hide admin-only items based on permissions
    applyPermissions(user.roleLevel);
  }

  // Apply UI permissions
  function applyPermissions(roleLevel) {
    // 2026-09-22: mọi cấp bậc (kể cả Nhân viên) đều tạo được dự án theo yêu
    // cầu người dùng — không còn ẩn ".add-project-btn" theo roleLevel nữa.
  }

  // Auto-poll from Google Sheets every 60s — gentle update to avoid UI flicker
  function startAutoPolling() {
    if (typeof GSHEETS_CONFIG === 'undefined' || !GSHEETS_CONFIG.USE_GSHEETS) return;
    setInterval(function() {
      if (!TaskManager.refreshFromGSheets) return;
      // Skip polling if modal is open or user is interacting
      var modalOpen = document.getElementById('modalOverlay') &&
                      document.getElementById('modalOverlay').classList.contains('active');
      if (modalOpen) return;

      TaskManager.refreshFromGSheets(function() {
        // Only update badges and stats numbers — don't rebuild the whole DOM
        updateNavBadges();
        var stats = TaskManager.getStats();
        if (stats) updateStats(stats);
        renderDailyProgressPanel();
      });
    }, 60000);
  }

  // Update nav badge counts with real data
  function updateNavBadges() {
    var projects = TaskManager.getProjects();
    var tasks = visibleTasks();
    var proposals = TaskManager.getProposals();
    var currentUser = TaskManager.getCurrentUser();

    var projBadge = document.getElementById('projectsBadge');
    if (projBadge) projBadge.textContent = projects.length;

    var myBadge = document.getElementById('myTasksBadge');
    if (myBadge) {
      var myTasks = tasks.filter(t => taskHasAssignee(t, currentUser.id));
      myBadge.textContent = myTasks.length;
    }

    var propBadge = document.getElementById('proposalBadge');
    if (propBadge) {
      var pending = proposals.filter(p => p.status === 'pending');
      propBadge.textContent = pending.length;
    }
  }

  // Setup auto-sync button (button now in HTML)
  function setupAutoSync() {
    // Button already in HTML, no action needed
  }

  // Vẽ lại ĐÚNG view đang mở dựa vào data-view của .tm-nav-item.active (không
  // đoán theo chữ hiển thị) — tách ra dùng chung cho cả nút "Đồng bộ" thủ
  // công (syncFromSheets()) LẪN sự kiện 'hiconique:data-refreshed' (2026-09-19,
  // xem bên dưới): trước đây renderProposals() (danh sách "Đề xuất" của CEO/
  // Manager) chỉ được vẽ lại khi TỰ bấm nút Đồng bộ hoặc chuyển view - vòng
  // lặp tự làm mới ngầm mỗi 20-60s (offline.js/startAutoPolling()) chỉ cập
  // nhật badge/số liệu, không vẽ lại danh sách, y hệt bug "Thiết bị chờ
  // duyệt" đã fix ở timesheet.html. Bỏ qua nếu đang mở modal (tránh mất
  // trạng thái form đang nhập dở).
  function rerenderActiveView() {
    var modalOpen = document.getElementById('modalOverlay') &&
                    document.getElementById('modalOverlay').classList.contains('active');
    if (modalOpen) { updateNavBadges(); return; }
    var activeNav = document.querySelector('.tm-nav-item.active');
    var view = activeNav ? activeNav.dataset.view : 'dashboard';
    if (view === 'dashboard') renderDashboard();
    else if (view === 'projects') renderProjectsView();
    else if (view === 'my-tasks') renderMyTasks();
    else if (view === 'team') renderTeam();
    else if (view === 'calendar') renderCalendar();
    else if (view === 'gantt') renderGantt();
    else if (view === 'proposals') renderProposals();
    else renderDashboard();
  }

  // Sync from Google Sheets
  function syncFromSheets(silent) {
    var btn = document.getElementById('syncFromSheetsBtn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('spinning');
    }

    if (!TaskManager.refreshFromGSheets) {
      if (btn) { btn.disabled = false; btn.classList.remove('spinning'); }
      return;
    }
    TaskManager.refreshFromGSheets(function(success) {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('spinning');
      }
      rerenderActiveView();

      if (!silent) {
        var msg = document.createElement('div');
        msg.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: var(--color-bronze); color: #0B0D10; padding: 12px 20px; border-radius: 8px; font-size: 0.875rem; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500;';
        msg.textContent = '✓ Đã đồng bộ từ Google Sheets';
        document.body.appendChild(msg);
        setTimeout(function() { msg.remove(); }, 2500);
      }
    });
  }

  window.syncFromSheets = syncFromSheets;

  // Create modal structure in DOM
  function createModalStructure() {
    const modalHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal" id="modalContent">
          <div class="modal-header">
            <h3 class="modal-title" id="modalTitle">Modal Title</h3>
            <button class="modal-close" id="modalClose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" id="modalBody">
            <!-- Dynamic content -->
          </div>
          <div class="modal-footer" id="modalFooter">
            <!-- Dynamic buttons -->
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modalOverlay = document.getElementById('modalOverlay');

    document.getElementById('modalClose').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Setup event listeners
  function setupEventListeners() {
    // Task check interaction
    document.addEventListener('click', function(e) {
      const check = e.target.closest('.task-check');
      if (check) {
        const row = check.closest('.task-row');
        if (row) {
          const taskId = row.dataset.taskId;
          if (taskId) {
            TaskManager.toggleTaskStatus(taskId);
            // Re-render whatever view is currently active, not always Dashboard —
            // checking a task inside "Tasks của tôi" (hoặc bất kỳ view nào khác)
            // phải giữ nguyên view đó, không bị nhảy về Dashboard.
            var activeNav = document.querySelector('.tm-nav-item.active');
            var view = activeNav ? activeNav.dataset.view : 'dashboard';
            if (view === 'dashboard') renderDashboard();
            else if (view === 'projects') renderProjectsView();
            else if (view === 'my-tasks') renderMyTasks();
            else if (view === 'team') renderTeam();
            else if (view === 'calendar') renderCalendar();
            else if (view === 'gantt') renderGantt();
            else if (view === 'proposals') renderProposals();
            else renderDashboard();
          }
        }
      }
    });

    // Nav item click
    document.addEventListener('click', function(e) {
      const navItem = e.target.closest('.tm-nav-item');
      if (navItem && navItem.dataset && navItem.dataset.view) {
        e.preventDefault();
        document.querySelectorAll('.tm-nav-item').forEach(i => i.classList.remove('active'));
        navItem.classList.add('active');

        var view = navItem.dataset.view;
        if (view === 'dashboard') renderDashboard();
        else if (view === 'projects') renderProjectsView();
        else if (view === 'my-tasks') renderMyTasks();
        else if (view === 'team') renderTeam();
        else if (view === 'calendar') renderCalendar();
        else if (view === 'gantt') renderGantt();
        else if (view === 'proposals') renderProposals();
      }
    });

    // Filter tab click
    document.addEventListener('click', function(e) {
      const filterTab = e.target.closest('.filter-tab');
      if (filterTab) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        filterTab.classList.add('active');
        applyFilterTab(filterTab.textContent.trim());
      }
    });

    // Create proposal button - FIX: was creating tasks instead
    document.addEventListener('click', function(e) {
      const proposalBtn = e.target.closest('[data-action="create-proposal"], .create-proposal-btn');
      if (proposalBtn) {
        e.preventDefault();
        openProposalModal();
      }
    });

    // Quick add task button - exclude proposal view
    document.addEventListener('click', function(e) {
      const addBtn = e.target.closest('.quick-add-btn, .add-task-btn, [data-action="add-task"]');
      if (addBtn) {
        // Only open task modal if NOT on proposals view
        const activeNav = document.querySelector('.tm-nav-item.active');
        const isProposalView = activeNav && activeNav.dataset.view === 'proposals';
        if (!isProposalView) {
          e.preventDefault();
          openTaskModal();
        }
      }
    });

    // Quick add project button
    document.addEventListener('click', function(e) {
      const addBtn = e.target.closest('.add-project-btn, [data-action="add-project"]');
      if (addBtn) {
        e.preventDefault();
        openProjectModal();
      }
    });

    // View task detail
    document.addEventListener('click', function(e) {
      const taskCard = e.target.closest('.task-row, .task-card');
      if (taskCard && !e.target.closest('.task-check')) {
        const taskId = taskCard.dataset.taskId;
        if (taskId) {
          openTaskDetailModal(taskId);
        }
      }
    });

    // View project detail
    document.addEventListener('click', function(e) {
      const projectCard = e.target.closest('.project-card');
      if (projectCard) {
        const projectId = projectCard.dataset.projectId;
        if (projectId) {
          openProjectDetailModal(projectId);
        }
      }
    });

    // Delete buttons
    document.addEventListener('click', function(e) {
      const deleteTaskBtn = e.target.closest('[data-action="delete-task"]');
      if (deleteTaskBtn) {
        e.preventDefault();
        const taskId = deleteTaskBtn.dataset.taskId;
        if (confirm('Bạn có chắc chắn muốn xóa task này?')) {
          TaskManager.deleteTask(taskId);
          closeModal();
          renderDashboard();
        }
      }

      const deleteProjectBtn = e.target.closest('[data-action="delete-project"]');
      if (deleteProjectBtn) {
        e.preventDefault();
        const projectId = deleteProjectBtn.dataset.projectId;
        if (confirm('Bạn có chắc chắn muốn xóa dự án này? Tất cả tasks trong dự án cũng sẽ bị xóa.')) {
          if (!TaskManager.deleteProject(projectId, TaskManager.getCurrentUser())) {
            alert('Bạn không có quyền xoá dự án.');
            return;
          }
          closeModal();
          renderDashboard();
        }
      }
    });

    // Filter change
    document.addEventListener('change', function(e) {
      if (e.target.classList.contains('filter-select-tm')) {
        renderDashboard();
      }
    });
  }

  // Modal functions
  function openModal(title, bodyContent, footerContent) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyContent;
    document.getElementById('modalFooter').innerHTML = footerContent;
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (typeof HiconiqueMoney !== 'undefined') HiconiqueMoney.bindAll(document.getElementById('modalBody'));
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Open task creation/edit modal
  function openTaskModal(task = null) {
    const isEdit = !!task;
    // 2026-09-17: chỉ cho chọn thành viên CÒN LÀM VIỆC — không cho giao việc
    // cho người đang chờ duyệt/bị từ chối (họ chưa đăng nhập được).
    const members = TaskManager.getActiveMembers();
    const projects = TaskManager.getProjects();
    const currentUser = TaskManager.getCurrentUser();

    const taskAssigneeIds = (task && Array.isArray(task.assigneeIds)) ? task.assigneeIds : [];
    const assigneeItemsHtml = members.map(m => {
      const checked = taskAssigneeIds.includes(m.id);
      return `<label class="member-multi-item${checked ? ' active' : ''}">`
        + `<input type="checkbox" value="${m.id}" data-member-name="${m.name}"${checked ? ' checked' : ''}>`
        + `<span class="avatar-xs-tm" style="background:${m.color || '#6B7280'}">${m.avatar || (m.name || '?').substring(0, 2).toUpperCase()}</span>`
        + `<span>${m.name}</span>`
        + `</label>`;
    }).join('');

    const projectOptions = projects.map(p =>
      `<option value="${p.id}" ${task && task.projectId === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const body = `
      <form id="taskForm">
        <div class="form-group">
          <label class="form-label">Tiêu đề task *</label>
          <input type="text" class="form-input" name="title" required
            placeholder="Nhập tiêu đề task..."
            value="${task ? task.title : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Mô tả</label>
          <textarea class="form-textarea" name="description"
            placeholder="Mô tả chi tiết công việc...">${task ? (task.description || '') : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Dự án</label>
          <select class="form-select" name="projectId">
            <option value="">-- Chọn dự án --</option>
            ${projectOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Người được giao</label>
          <div class="member-multi" id="taskAssigneeChips">${assigneeItemsHtml}</div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ngày bắt đầu</label>
            <input type="datetime-local" class="form-input" name="startDate"
              value="${task && task.startDate ? task.startDate.slice(0, 16) : (task && task.createdAt ? task.createdAt.slice(0, 16) : '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Ngày kết thúc (Deadline)</label>
            <input type="datetime-local" class="form-input" name="deadline"
              value="${task && task.deadline ? task.deadline.slice(0, 16) : ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Trạng thái</label>
            <select class="form-select" name="status">
              <option value="pending" ${task && task.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
              <option value="in-progress" ${task && task.status === 'in-progress' ? 'selected' : ''}>Đang làm</option>
              <option value="review" ${task && task.status === 'review' ? 'selected' : ''}>Chờ duyệt</option>
              <option value="completed" ${task && task.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Độ ưu tiên</label>
            <select class="form-select" name="prioritySelect">
              <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>Cao</option>
              <option value="medium" ${(!task || task.priority === 'medium') ? 'selected' : ''}>Trung bình</option>
              <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Thấp</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveTask(${task ? `'${task.id}'` : 'null'})">
        ${isEdit ? 'Cập nhật' : 'Tạo task'}
      </button>
    `;

    openModal(isEdit ? 'Chỉnh sửa Task' : 'Tạo Task Mới', body, footer);
    bindTaskAssigneeChips(taskAssigneeIds.slice());
  }

  // Lưới chip chọn nhiều người phụ trách (đồng bộ với .member-multi ở
  // projects.js/projects.html — xem GHI_CHU_DU_AN.md §6.6, không dùng
  // dropdown-phải-mở-mới-thấy-hết-người nữa).
  var taskModalAssigneeIds = [];
  function bindTaskAssigneeChips(initialIds) {
    taskModalAssigneeIds = initialIds || [];
    var container = document.getElementById('taskAssigneeChips');
    if (!container) return;
    container.querySelectorAll('.member-multi-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var input = item.querySelector('input');
        if (!input) return;
        var id = input.value;
        var idx = taskModalAssigneeIds.indexOf(id);
        if (idx === -1) taskModalAssigneeIds.push(id); else taskModalAssigneeIds.splice(idx, 1);
        input.checked = idx === -1;
        item.classList.toggle('active', idx === -1);
      });
    });
  }

  // Save task from modal
  window.saveTask = function(taskId) {
    const form = document.getElementById('taskForm');
    if (!form.title.value.trim()) {
      alert('Vui lòng nhập tiêu đề task');
      return;
    }

    const assigneeIds = taskModalAssigneeIds.slice();

    const taskData = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      projectId: form.projectId.value,
      assigneeIds: assigneeIds,
      startDate: form.startDate.value,
      deadline: form.deadline.value,
      priority: form.prioritySelect.value
    };

    if (taskId) {
      // Sửa task có sẵn: giữ nguyên quyền chỉnh tay trạng thái (dropdown) —
      // đây là lối tắt cho CEO/Quản lý, không đi qua các nút Xác nhận/Hoàn
      // thành/Duyệt trong "Chi tiết Task".
      taskData.status = form.status.value;
      TaskManager.updateTask(taskId, taskData);
    } else {
      taskData.createdBy = TaskManager.getCurrentUser().id;
      // 2026-09-21: KHÔNG gán taskData.status ở đây — để createTask() tự
      // quyết theo đúng quy trình (tự tạo cho mình/cho nhóm có mình -> "Đang
      // làm" luôn; giao hẳn cho người khác -> "Chờ xử lý", chờ họ tự bấm
      // "Xác nhận nhận việc"). Dropdown Trạng thái trong form tạo mới giờ chỉ
      // còn tác dụng khi SỬA task, không áp dụng lúc tạo mới.
      TaskManager.createTask(taskData);
    }

    closeModal();
    renderDashboard();
  };

  // Open task detail modal
  function openTaskDetailModal(taskId) {
    const task = TaskManager.getTask(taskId);
    if (!task) return;

    const project = task.projectId ? TaskManager.getProject(task.projectId) : null;
    const assignees = TaskManager.getTaskAssignees(task);
    const creator = task.createdBy ? TaskManager.getMember(task.createdBy) : null;
    const currentUser = TaskManager.getCurrentUser();

    const priorityClass = task.priority === 'high' ? 'priority-high' : task.priority === 'medium' ? 'priority-medium' : 'priority-low';
    const priorityLabel = task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp';

    const statusLabel = taskStatusLabel(task.status);

    // Get today's progress
    const todayProgress = TaskManager.getTodayProgress(taskId) || { progress: task.progress || 0, note: '', done: false };
    const dailyTasks = task.dailyTasks || [];

    // 2026-09-21: quy trình duyệt việc — xem hàm nào hiện nút gì:
    // pending -> người được giao tự "Xác nhận nhận việc" (confirmTaskAssignment).
    // in-progress + đạt 100% -> người được giao bấm "Hoàn thành" để nộp duyệt
    // (submitTaskForReview). review -> CEO/Quản lý (canReviewTasks) "Duyệt"
    // hoặc "Từ chối" kèm lý do (approveTaskReview/rejectTaskReview).
    const isAssignee = !!currentUser && assignees.some(a => a.id === currentUser.id);
    const canReview = TaskManager.canReviewTasks && TaskManager.canReviewTasks(currentUser);
    const progressPct = Number(task.progress) || 0;

    let workflowActionsHtml = '';
    if (task.status === 'pending' && isAssignee) {
      workflowActionsHtml = `<button type="button" id="taskConfirmBtn" class="btn btn-primary" style="width:100%;">✅ Xác nhận nhận việc</button>`;
    } else if (task.status === 'in-progress' && isAssignee) {
      workflowActionsHtml = progressPct >= 100
        ? `<button type="button" id="taskSubmitReviewBtn" class="btn btn-primary" style="width:100%;">🏁 Hoàn thành — nộp duyệt</button>`
        : `<p style="font-size:0.75rem; color:var(--color-text-muted); margin:0;">Đạt 100% tiến độ để nộp duyệt.</p>`;
    } else if (task.status === 'review' && canReview) {
      workflowActionsHtml = `
        <div style="display:flex; gap:8px;">
          <button type="button" id="taskRejectBtn" class="btn btn-danger" style="flex:1;">Từ chối</button>
          <button type="button" id="taskApproveBtn" class="btn btn-primary" style="flex:1;">Duyệt hoàn thành</button>
        </div>`;
    } else if (task.status === 'review') {
      workflowActionsHtml = `<p style="font-size:0.75rem; color:var(--color-text-muted); margin:0;">Đang chờ CEO/Quản lý duyệt.</p>`;
    }

    const body = `
      <div class="task-detail-header">
        <div>
          <h3 class="task-detail-title">${task.title}</h3>
          <div class="task-detail-meta">
            <span class="${priorityClass}" style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${priorityLabel}</span>
            <span>${statusLabel}</span>
          </div>
        </div>
      </div>

      <div class="task-detail-body">
        ${task.description ? `<p class="task-detail-description">${task.description}</p>` : '<p class="task-detail-description" style="opacity: 0.5;">Không có mô tả</p>'}
      </div>

      ${task.reviewNote ? `
        <div style="background: rgba(160,72,72,0.1); border: 1px solid var(--color-destructive, #A04848); border-radius: 8px; padding: 10px 12px; margin-bottom: 16px;">
          <div style="font-size: 0.75rem; font-weight: 600; color: var(--color-destructive, #A04848); margin-bottom: 2px;">⚠ Bị từ chối — cần sửa</div>
          <div style="font-size: 0.8125rem; color: var(--color-text);">${task.reviewNote}</div>
        </div>
      ` : ''}

      ${workflowActionsHtml ? `<div style="margin-bottom: 16px;">${workflowActionsHtml}</div>` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Dự án</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${project ? project.name : 'Không có'}</p>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Người được giao</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${assignees.length ? assignees.map(a => a.name).join(', ') : 'Chưa giao'}</p>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Ngày bắt đầu</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${task.startDate ? new Date(task.startDate).toLocaleString('vi-VN') : 'Chưa có'}</p>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Deadline</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${task.deadline ? new Date(task.deadline).toLocaleString('vi-VN') : 'Không có'}</p>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Người tạo</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${creator ? creator.name : 'Không rõ'}</p>
        </div>
      </div>

      <!-- Daily Progress Section -->
      <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px; margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin: 0;">📊 Cập nhật tiến độ hôm nay</h4>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Tiến độ hôm nay: <strong style="color: var(--color-bronze);">${todayProgress.progress}%</strong></span>
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Tổng: <strong>${task.progress || 0}%</strong></span>
          </div>
          <div style="height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden;">
            <div style="width: ${todayProgress.progress}%; height: 100%; background: var(--color-bronze); transition: width 0.3s;"></div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; color: var(--color-text-muted); display: block; margin-bottom: 4px;">Tiến độ (%)</label>
          <input type="range" id="dailyProgressInput" min="0" max="100" value="${todayProgress.progress}" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-muted);">
            <span>0%</span>
            <span id="dailyProgressValue" style="font-weight: 600; color: var(--color-bronze);">${todayProgress.progress}%</span>
            <span>100%</span>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; color: var(--color-text-muted); display: block; margin-bottom: 4px;">📝 Đã làm gì hôm nay?</label>
          <textarea id="dailyNoteInput" placeholder="Mô tả công việc đã làm hôm nay..." style="width: 100%; min-height: 60px; padding: 8px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-text); font-size: 0.8125rem; resize: vertical;">${todayProgress.note || ''}</textarea>
        </div>

        <button type="button" id="saveDailyProgressBtn" class="btn btn-primary" style="width: 100%;">Lưu tiến độ hôm nay</button>

        ${dailyTasks.length > 0 ? `
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border);">
            <h5 style="font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); margin: 0 0 8px;">Lịch sử tiến độ</h5>
            <div style="max-height: 150px; overflow-y: auto;">
              ${dailyTasks.slice().reverse().map(d => `
                <div style="display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--color-border); font-size: 0.75rem;">
                  <span style="min-width: 80px; color: var(--color-text-muted);">${new Date(d.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}</span>
                  <span style="min-width: 40px; font-weight: 600; color: ${d.done ? '#4F6F52' : 'var(--color-bronze)'};">${d.progress}%</span>
                  <span style="flex: 1; color: var(--color-text);">${d.note || '-'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const footer = `
      <button class="btn btn-danger" data-action="delete-task" data-task-id="${task.id}">Xóa</button>
      <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
      <button class="btn btn-primary" onclick="openTaskModal(TaskManager.getTask('${task.id}'));">Sửa</button>
    `;

    openModal('Chi tiết Task', body, footer);

    // Add event listeners for daily progress
    setTimeout(function() {
      var progressInput = document.getElementById('dailyProgressInput');
      var progressValue = document.getElementById('dailyProgressValue');
      var saveBtn = document.getElementById('saveDailyProgressBtn');

      if (progressInput && progressValue) {
        progressInput.addEventListener('input', function() {
          progressValue.textContent = this.value + '%';
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          var progress = document.getElementById('dailyProgressInput').value;
          var note = document.getElementById('dailyNoteInput').value;
          TaskManager.addDailyProgress(taskId, progress, note);
          showToast('Đã lưu tiến độ!', true);
          openTaskDetailModal(taskId); // Refresh
        });
      }

      var confirmBtn = document.getElementById('taskConfirmBtn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
          var updated = TaskManager.confirmTaskAssignment(taskId, TaskManager.getCurrentUser());
          if (!updated) { showToast('Không xác nhận được, thử lại.', false); return; }
          showToast('Đã xác nhận nhận việc — chuyển sang "Đang làm".', true);
          openTaskDetailModal(taskId);
          renderDashboard();
        });
      }

      var submitReviewBtn = document.getElementById('taskSubmitReviewBtn');
      if (submitReviewBtn) {
        submitReviewBtn.addEventListener('click', function () {
          var updated = TaskManager.submitTaskForReview(taskId, TaskManager.getCurrentUser());
          if (!updated) { showToast('Không nộp duyệt được — kiểm tra lại tiến độ đã đạt 100% chưa.', false); return; }
          showToast('Đã nộp duyệt — chuyển sang "Chờ duyệt".', true);
          openTaskDetailModal(taskId);
          renderDashboard();
        });
      }

      var approveBtn = document.getElementById('taskApproveBtn');
      if (approveBtn) {
        approveBtn.addEventListener('click', function () {
          showConfirmDialog('Duyệt hoàn thành công việc "' + task.title.replace(/"/g, '&quot;') + '"?', function () {
            var updated = TaskManager.approveTaskReview(taskId, TaskManager.getCurrentUser());
            if (!updated) { showToast('Duyệt thất bại, thử lại.', false); return; }
            showToast('Đã duyệt hoàn thành.', true);
            openTaskDetailModal(taskId);
            renderDashboard();
          }, 'Duyệt');
        });
      }

      var rejectBtn = document.getElementById('taskRejectBtn');
      if (rejectBtn) {
        rejectBtn.addEventListener('click', function () {
          showTaskRejectDialog(function (note) {
            var updated = TaskManager.rejectTaskReview(taskId, note, TaskManager.getCurrentUser());
            if (!updated) { showToast('Từ chối thất bại, thử lại.', false); return; }
            showToast('Đã từ chối — việc quay lại "Đang làm".', true);
            openTaskDetailModal(taskId);
            renderDashboard();
          });
        });
      }
    }, 100);
  }

  // Open project modal
  function openProjectModal(project = null) {
    const isEdit = !!project;
    // 2026-09-17: chỉ cho chọn thành viên CÒN LÀM VIỆC vào dự án — không cho
    // thêm người đang chờ duyệt/bị từ chối (họ chưa đăng nhập được).
    const members = TaskManager.getActiveMembers();
    const currentUser = TaskManager.getCurrentUser();

    const body = `
      <form id="projectForm">
        <div class="form-group">
          <label class="form-label">Tên dự án *</label>
          <input type="text" class="form-input" name="name" required
            placeholder="Nhập tên dự án..."
            value="${project ? project.name : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Loại dự án</label>
          <select class="form-select" name="type">
            <option value="Thiết kế nội thất" ${project && project.type === 'Thiết kế nội thất' ? 'selected' : ''}>Thiết kế nội thất</option>
            <option value="Thiết kế kiến trúc" ${project && project.type === 'Thiết kế kiến trúc' ? 'selected' : ''}>Thiết kế kiến trúc</option>
            <option value="Triển khai bản vẽ" ${project && project.type === 'Triển khai bản vẽ' ? 'selected' : ''}>Triển khai bản vẽ</option>
            <option value="Thi công nội thất" ${project && project.type === 'Thi công nội thất' ? 'selected' : ''}>Thi công nội thất</option>
            <option value="Thi công xây dựng" ${project && project.type === 'Thi công xây dựng' ? 'selected' : ''}>Thi công xây dựng</option>
            <option value="Xây dựng dân dụng" ${project && project.type === 'Xây dựng dân dụng' ? 'selected' : ''}>Xây dựng dân dụng</option>
            <option value="Xây dựng công nghiệp" ${project && project.type === 'Xây dựng công nghiệp' ? 'selected' : ''}>Xây dựng công nghiệp</option>
            <option value="Cải tạo sửa chữa" ${project && project.type === 'Cải tạo sửa chữa' ? 'selected' : ''}>Cải tạo sửa chữa</option>
            <option value="Giám sát thi công" ${project && project.type === 'Giám sát thi công' ? 'selected' : ''}>Giám sát thi công</option>
            <option value="Concept 3D" ${project && project.type === 'Concept 3D' ? 'selected' : ''}>Concept 3D</option>
            <option value="Tư vấn thiết kế" ${project && project.type === 'Tư vấn thiết kế' ? 'selected' : ''}>Tư vấn thiết kế</option>
            <option value="Khác" ${project && project.type === 'Khác' ? 'selected' : ''}>Khác</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Màu sắc</label>
          <input type="color" class="form-input" name="color"
            style="height: 40px; padding: 4px;"
            value="${project ? project.color : '#B08D57'}">
        </div>

        <div class="form-group">
          <label class="form-label">Khách hàng</label>
          <input type="text" class="form-input" name="client"
            placeholder="Tên khách hàng / công ty..."
            value="${project && project.client ? project.client : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Tên nhà đầu tư</label>
          <input type="text" class="form-input" name="investor"
            placeholder="Tên nhà đầu tư (nếu có)..."
            value="${project && project.investor ? project.investor : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Địa điểm</label>
          <input type="text" class="form-input" name="location"
            placeholder="VD: Quận 2, TP.HCM"
            value="${project && project.location ? project.location : ''}">
        </div>

        <div class="form-group" style="display: flex; gap: 12px;">
          <div style="flex: 1;">
            <label class="form-label">Ngày bắt đầu</label>
            <input type="date" class="form-input" name="startDate"
              value="${project && project.startDate ? String(project.startDate).substring(0, 10) : ''}">
          </div>
          <div style="flex: 1;">
            <label class="form-label">Ngày kết thúc dự kiến</label>
            <input type="date" class="form-input" name="endDate"
              value="${project && project.endDate ? String(project.endDate).substring(0, 10) : ''}">
          </div>
        </div>

        <div class="form-group" style="display: flex; gap: 12px;">
          <div style="flex: 1;">
            <label class="form-label">Tổng số tiền (VNĐ)</label>
            <input type="text" inputmode="numeric" class="form-input" name="budget"
              placeholder="0" data-money-input
              value="${project && project.budget ? HiconiqueMoney.format(project.budget) : ''}">
          </div>
          <div style="flex: 1;">
            <label class="form-label">Độ ưu tiên</label>
            <select class="form-select" name="priority">
              <option value="low" ${project && project.priority === 'low' ? 'selected' : ''}>Thấp</option>
              <option value="medium" ${!project || !project.priority || project.priority === 'medium' ? 'selected' : ''}>Trung bình</option>
              <option value="high" ${project && project.priority === 'high' ? 'selected' : ''}>Cao</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Mô tả chi tiết</label>
          <textarea class="form-input" name="description" rows="3"
            placeholder="Mô tả ngắn về phạm vi, mục tiêu, hạng mục chính của dự án...">${project && project.description ? project.description : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Thành viên tham gia</label>
          <div class="member-select">
            ${members.map(m => `
              <div class="member-chip ${project && getProjectMembers(project).includes(m.id) ? 'selected' : ''}"
                   data-member-id="${m.id}" onclick="toggleMemberChip(this)">
                <span class="avatar-chip" style="background: ${m.color}">${m.avatar}</span>
                ${m.name}
              </div>
            `).join('')}
          </div>
          <input type="hidden" name="members" id="membersInput"
            value="${project ? getProjectMembers(project).join(',') : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Tiến độ (%)</label>
          <input type="range" name="progress" min="0" max="100"
            value="${project ? project.progress : 0}"
            style="width: 100%;">
          <div style="text-align: center; font-size: 0.875rem; color: var(--color-text); margin-top: 4px;">
            <span id="progressValue">${project ? project.progress : 0}</span>%
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Trạng thái</label>
          <select class="form-select" name="status">
            <option value="on-track" ${project && project.status === 'on-track' ? 'selected' : ''}>On track</option>
            <option value="at-risk" ${project && project.status === 'at-risk' ? 'selected' : ''}>At risk</option>
            <option value="completed" ${project && project.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
          </select>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveProject(${project ? `'${project.id}'` : 'null'})">
        ${isEdit ? 'Cập nhật' : 'Tạo dự án'}
      </button>
    `;

    openModal(isEdit ? 'Chỉnh sửa Dự án' : 'Tạo Dự án Mới', body, footer);

    // Progress slider
    document.querySelector('input[name="progress"]').addEventListener('input', function() {
      document.getElementById('progressValue').textContent = this.value;
    });
  }

  // Toggle member chip selection
  window.toggleMemberChip = function(el) {
    el.classList.toggle('selected');
    const selected = Array.from(document.querySelectorAll('.member-chip.selected'))
      .map(chip => chip.dataset.memberId);
    document.getElementById('membersInput').value = selected.join(',');
  };

  // Save project from modal
  window.saveProject = function(projectId) {
    const form = document.getElementById('projectForm');
    if (!form.name.value.trim()) {
      alert('Vui lòng nhập tên dự án');
      return;
    }

    const projectData = {
      name: form.name.value.trim(),
      type: form.type.value,
      color: form.color.value,
      client: form.client.value.trim(),
      investor: form.investor.value.trim(),
      location: form.location.value.trim(),
      startDate: form.startDate.value || '',
      endDate: form.endDate.value || '',
      budget: HiconiqueMoney.parse(form.budget.value),
      priority: form.priority.value,
      description: form.description.value.trim(),
      progress: parseInt(form.progress.value),
      status: form.status.value,
      members: document.getElementById('membersInput').value ?
        document.getElementById('membersInput').value.split(',') : []
    };

    const currentUser = TaskManager.getCurrentUser();
    if (projectId) {
      if (!TaskManager.updateProject(projectId, projectData, currentUser)) {
        alert('Bạn không có quyền sửa dự án.');
        return;
      }
    } else {
      if (!TaskManager.createProject(projectData, currentUser)) {
        alert('Bạn không có quyền tạo dự án.');
        return;
      }
    }

    closeModal();
    renderDashboard();
  };

  // Open project detail modal
  function openProjectDetailModal(projectId) {
    const project = TaskManager.getProject(projectId);
    if (!project) return;

    const tasks = TaskManager.getTasks({ projectId: projectId });
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : project.progress;

    const memberAvatars = project.members ? getProjectMembers(project).map(mid => {
      const m = TaskManager.getMember(mid);
      return m ? `<span class="avatar-xxs" style="background:${m.color}">${m.avatar}</span>` : '';
    }).join('') : '';

    const statusClass = project.status === 'on-track' ? 'project-on-track' : project.status === 'at-risk' ? 'project-at-risk' : '';

    const body = `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div class="project-avatar" style="background:${project.color}; width: auto; min-width: 48px; height: 48px; padding: 0 8px; border-radius: 8px; display: grid; place-items: center; color: #0B0D10; font-weight: 600; font-size: ${project.shortCode && project.shortCode.length > 3 ? '0.75rem' : '1.125rem'};">
            ${project.shortCode || project.name.charAt(0)}
          </div>
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--color-text);">${project.name}</h3>
            <p style="font-size: 0.875rem; color: var(--color-text-muted);">${project.type}</p>
          </div>
          <span class="project-status ${statusClass}" style="margin-left: auto;">${project.status === 'on-track' ? 'On track' : project.status === 'at-risk' ? 'At risk' : 'Hoàn thành'}</span>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Tiến độ</span>
            <span style="font-size: 0.75rem; color: var(--color-text);">${progress}%</span>
          </div>
          <div class="progress-bar-tm">
            <span style="width: ${progress}%; background: ${project.color}"></span>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          ${memberAvatars || '<span style="font-size: 0.75rem; color: var(--color-text-muted);">Không có thành viên</span>'}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; background: var(--color-bg); border-radius: 8px; margin-bottom: 16px;">
          ${project.client ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Khách hàng</div><div style="font-size: 0.8125rem; color: var(--color-text);">${project.client}</div></div>` : ''}
          ${project.investor ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Nhà đầu tư</div><div style="font-size: 0.8125rem; color: var(--color-text);">${project.investor}</div></div>` : ''}
          ${project.location ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Địa điểm</div><div style="font-size: 0.8125rem; color: var(--color-text);">${project.location}</div></div>` : ''}
          ${project.budget ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Tổng số tiền</div><div style="font-size: 0.8125rem; color: var(--color-bronze); font-weight: 600;">${Number(project.budget).toLocaleString('vi-VN')} VNĐ</div></div>` : ''}
          ${project.startDate ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Ngày bắt đầu</div><div style="font-size: 0.8125rem; color: var(--color-text);">${new Date(project.startDate).toLocaleDateString('vi-VN')}</div></div>` : ''}
          ${project.endDate ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Ngày kết thúc dự kiến</div><div style="font-size: 0.8125rem; color: var(--color-text);">${new Date(project.endDate).toLocaleDateString('vi-VN')}</div></div>` : ''}
          ${project.priority ? `<div><div style="font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase;">Độ ưu tiên</div><div style="font-size: 0.8125rem; color: var(--color-text);">${project.priority === 'high' ? 'Cao' : project.priority === 'low' ? 'Thấp' : 'Trung bình'}</div></div>` : ''}
        </div>
        ${project.description ? `<p style="font-size: 0.8125rem; color: var(--color-text-muted); line-height: 1.6; margin-bottom: 16px;">${project.description}</p>` : ''}
      </div>

      <h4 style="font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin-bottom: 12px;">
        Tasks trong dự án (${tasks.length})
      </h4>

      ${tasks.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
          ${tasks.map(t => {
            const taskAssignees = TaskManager.getTaskAssignees(t);
            return `
              <div class="task-row" data-task-id="${t.id}" style="padding: 10px; background: var(--color-bg); border-radius: 6px; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${t.status === 'completed' ? 'var(--color-bronze)' : 'var(--color-border-strong)'}; ${t.status === 'completed' ? 'background: var(--color-bronze)' : ''};"></div>
                  <div style="flex: 1;">
                    <span style="font-size: 0.875rem; color: ${t.status === 'completed' ? 'var(--color-text-faint)' : 'var(--color-text)'}; ${t.status === 'completed' ? 'text-decoration: line-through' : ''};">${t.title}</span>
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 8px;">${taskAssignees.length ? taskAssignees.map(a => a.name).join(', ') : 'Chưa giao'}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<p style="font-size: 0.875rem; color: var(--color-text-muted);">Chưa có task nào</p>'}
    `;

    const currentUserForActions = TaskManager.getCurrentUser();
    const canManageProject = currentUserForActions && (currentUserForActions.roleLevel === 'admin' || currentUserForActions.roleLevel === 'manager');
    const footer = `
      ${canManageProject ? `<button class="btn btn-danger" data-action="delete-project" data-project-id="${project.id}">Xóa</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
      ${canManageProject ? `<button class="btn btn-primary" onclick="openProjectModal(TaskManager.getProject('${project.id}'));">Sửa</button>` : ''}
    `;

    openModal('Chi tiết Dự án', body, footer);
  }

  // Apply filter tab (bottom tabs)
  function applyFilterTab(label) {
    var taskListEl = document.querySelector('.task-list');
    if (!taskListEl) return;

    var tasks = visibleTasks();

    if (label.includes('Tasks')) {
      // All tasks
      tasks = tasks;
    } else if (label.includes('Đang làm')) {
      tasks = tasks.filter(t => t.status === 'in-progress');
    } else if (label.includes('Tiến độ')) {
      // Tasks in progress
      tasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'pending');
    } else if (label.includes('Thêm task')) {
      openTaskModal();
      return;
    } else if (label.includes('Lịch')) {
      // Tasks with deadline today
      var today = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.deadline && t.deadline.startsWith(today));
    }

    if (tasks.length === 0) {
      taskListEl.innerHTML = `
        <li class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Không có task nào</div>
        </li>
      `;
      return;
    }

    taskListEl.innerHTML = tasks.slice(0, 8).map(task => {
      var taskAssignees = TaskManager.getTaskAssignees(task);
      var project = task.projectId ? TaskManager.getProject(task.projectId) : null;
      var priorityClass = task.priority === 'high' ? 'priority-high' :
                         task.priority === 'medium' ? 'priority-medium' : 'priority-low';
      var priorityLabel = task.priority === 'high' ? 'Cao' :
                         task.priority === 'medium' ? 'Trung bình' : 'Thấp';
      var deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', {
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      }) : '';

      return `
        <li class="task-row ${task.status === 'completed' ? 'done' : ''}" data-task-id="${task.id}">
          <button class="task-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
          <div class="task-content">
            <h4>${task.title}</h4>
            <p>${project ? project.name + ' · ' : ''}${deadline}</p>
          </div>
          <span class="task-priority-badge ${priorityClass}">${priorityLabel}</span>
          ${taskAssignees.map(a => `<span class="avatar-xs-tm" style="background:${a.color}" title="${a.name}">${a.avatar}</span>`).join('')}
        </li>
      `;
    }).join('');
  }

  // Render functions
  function renderDashboard() {
    // Render Kanban board with stats and objectives
    renderKanbanBoard();

    // Render projects
    renderProjectList();

    // Animate progress bars
    setTimeout(animateProgressBars, 100);

    // Panel "Tiến độ hôm nay" bên phải (dữ liệu thật của chính người đăng nhập)
    renderDailyProgressPanel();
  }

  // Thứ Hai của tuần chứa ngày d (00:00), dùng để khớp đúng cột T2 trong
  // #dpWeekBars — tuần cố định (không phải "7 ngày gần nhất") để luôn khớp
  // đúng nhãn T2..CN có sẵn trong HTML.
  function mondayOfWeek(d) {
    var day = d.getDay(); // 0=CN, 1=T2 ... 6=T7
    var diff = day === 0 ? -6 : 1 - day;
    var monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Panel bên phải trang Tasks — trước đây là mockup tĩnh (số/lịch hardcode
  // sẵn trong HTML, không có dòng JS nào wire dữ liệu thật). Giữ nguyên UI/
  // tiêu đề, chỉ thay nội dung bằng dữ liệu thật của CHÍNH người đang đăng
  // nhập: (1) vòng tròn + "N/M tasks hoàn thành hôm nay" tính từ
  // TaskManager.getTodayProgress() trên các task đang xử lý (chưa completed)
  // được giao cho họ; (2) biểu đồ "Tuần này" = tiến độ trung bình mỗi ngày
  // trong tuần hiện tại (T2..CN) từ dailyTasks của họ; (3) "Lịch hôm nay" ->
  // đổi nội dung thành các task SẮP ĐẾN HẠN gần nhất (hệ thống chưa có lịch
  // họp/sự kiện riêng nên không thể hiện đúng nghĩa "lịch", nhưng đây là
  // thông tin thật gần nhất với nhu cầu "hôm nay cần làm/chú ý gì").
  function renderDailyProgressPanel() {
    if (typeof TaskManager === 'undefined') return;
    var user = TaskManager.getCurrentUser ? TaskManager.getCurrentUser() : null;
    if (!user) return;

    var myTasks = visibleTasks({ assigneeId: user.id }) || [];
    var activeTasks = myTasks.filter(function (t) { return t.status !== 'completed'; });
    var today = new Date();
    var todayKey = ymd(today);

    var todayEntries = activeTasks.map(function (t) {
      return TaskManager.getTodayProgress ? TaskManager.getTodayProgress(t.id) : { progress: 0, done: false };
    });
    var percent = todayEntries.length ? Math.round(todayEntries.reduce(function (s, e) { return s + (e.progress || 0); }, 0) / todayEntries.length) : 0;
    var doneToday = todayEntries.filter(function (e) { return e.done; }).length;

    var ring = document.getElementById('dpRing');
    if (ring) {
      var circumference = 314; // khớp stroke-dasharray có sẵn trong HTML (2*pi*50 làm tròn)
      ring.setAttribute('stroke-dashoffset', String(Math.round(circumference * (1 - percent / 100))));
    }
    var percentEl = document.getElementById('dpPercent');
    if (percentEl) percentEl.textContent = percent + '%';
    var tasksTextEl = document.getElementById('dpTasksText');
    if (tasksTextEl) {
      tasksTextEl.textContent = activeTasks.length
        ? doneToday + '/' + activeTasks.length + ' tasks hoàn thành hôm nay'
        : 'Không có task nào đang xử lý';
    }

    var monday = mondayOfWeek(today);
    var weekBars = document.querySelectorAll('#dpWeekBars .day-bar > span');
    for (var i = 0; i < weekBars.length; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var dKey = ymd(d);
      var entriesForDay = [];
      myTasks.forEach(function (t) {
        if (!Array.isArray(t.dailyTasks)) return;
        var e = t.dailyTasks.find(function (x) { return x.date === dKey; });
        if (e) entriesForDay.push(e.progress || 0);
      });
      var dayPct = entriesForDay.length ? Math.round(entriesForDay.reduce(function (a, b) { return a + b; }, 0) / entriesForDay.length) : 0;
      weekBars[i].style.height = dayPct + '%';
      weekBars[i].style.background = dKey === todayKey ? 'var(--color-bronze)' : '';
    }

    var upcoming = myTasks
      .filter(function (t) { return t.status !== 'completed' && t.deadline; })
      .sort(function (a, b) { return new Date(a.deadline) - new Date(b.deadline); })
      .slice(0, 4);
    var scheduleEl = document.getElementById('dpSchedule');
    if (scheduleEl) {
      if (upcoming.length === 0) {
        scheduleEl.innerHTML = '<p class="daily-text">Không có việc nào sắp đến hạn</p>';
      } else {
        scheduleEl.innerHTML = upcoming.map(function (t) {
          var project = TaskManager.getProject ? TaskManager.getProject(t.projectId) : null;
          var d = new Date(t.deadline);
          var hasTime = !isNaN(d.getTime()) && t.deadline.indexOf('T') !== -1;
          var timeLabel = hasTime ? (String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')) : '';
          var dateLabel = TaskManager.formatShortDate ? TaskManager.formatShortDate(t.deadline.slice(0, 10)) : t.deadline.slice(0, 10);
          return '<div class="schedule-item">'
            + '<span class="schedule-time">' + (timeLabel || dateLabel) + '</span>'
            + '<div class="schedule-content">'
            +   '<h5>' + (t.title || '') + '</h5>'
            +   '<p>' + (project ? project.name : '') + (timeLabel ? ' · ' + dateLabel : '') + '</p>'
            + '</div>'
          + '</div>';
        }).join('');
      }
    }
  }

  // Render main objective section
  function renderMainObjective() {
    let objectives = JSON.parse(localStorage.getItem('hiconique_objectives') || '[]');
    const currentUser = TaskManager.getCurrentUser();

    // Ensure there's always at least one objective slot
    if (objectives.length === 0) {
      objectives = [{ id: 'obj-1', text: '', completed: false }];
    }

    const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

    // Build objectives HTML
    const objectivesHTML = objectives.map((obj, idx) => `
      <div class="objective-item ${obj.completed ? 'completed' : ''}" data-obj-id="${obj.id}">
        <button class="obj-check" onclick="toggleObjective('${obj.id}')">
          ${obj.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>
        <input type="text" class="obj-input" placeholder="Mục tiêu hôm nay..."
          value="${obj.text}" onblur="saveObjectiveText('${obj.id}', this.value)"
          onkeydown="if(event.key==='Enter'){this.blur()}">
        ${objectives.length > 1 ? `<button class="obj-remove" onclick="removeObjective('${obj.id}')">×</button>` : ''}
      </div>
    `).join('');

    const container = document.getElementById('mainObjectiveContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="objective-section">
        <div class="objective-header">
          <div>
            <div class="objective-eyebrow">MỤC TIÊU HÔM NAY</div>
            <div class="objective-date">${today}</div>
          </div>
          <button class="objective-add-btn" onclick="addObjective()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Thêm mục tiêu
          </button>
        </div>
        <div class="objective-list">
          ${objectivesHTML}
        </div>
        <div class="objective-progress">
          <span>${objectives.filter(o => o.completed).length}/${objectives.length} hoàn thành</span>
          <div class="objective-progress-bar">
            <div class="objective-progress-fill" style="width:${objectives.length > 0 ? Math.round((objectives.filter(o => o.completed).length / objectives.length) * 100) : 0}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Toggle objective completion
  window.toggleObjective = function(id) {
    let objectives = JSON.parse(localStorage.getItem('hiconique_objectives') || '[]');
    const obj = objectives.find(o => o.id === id);
    if (obj) {
      obj.completed = !obj.completed;
      localStorage.setItem('hiconique_objectives', JSON.stringify(objectives));
      renderMainObjective();
    }
  };

  // Save objective text
  window.saveObjectiveText = function(id, text) {
    let objectives = JSON.parse(localStorage.getItem('hiconique_objectives') || '[]');
    const obj = objectives.find(o => o.id === id);
    if (obj) {
      obj.text = text;
      localStorage.setItem('hiconique_objectives', JSON.stringify(objectives));
      renderMainObjective();
    }
  };

  // Add new objective
  window.addObjective = function() {
    let objectives = JSON.parse(localStorage.getItem('hiconique_objectives') || '[]');
    const newId = 'obj-' + Date.now();
    objectives.push({ id: newId, text: '', completed: false });
    localStorage.setItem('hiconique_objectives', JSON.stringify(objectives));
    renderMainObjective();
    // Focus the new input
    setTimeout(() => {
      const newInput = document.querySelector(`[data-obj-id="${newId}"] .obj-input`);
      if (newInput) newInput.focus();
    }, 50);
  };

  // Remove objective
  window.removeObjective = function(id) {
    let objectives = JSON.parse(localStorage.getItem('hiconique_objectives') || '[]');
    objectives = objectives.filter(o => o.id !== id);
    localStorage.setItem('hiconique_objectives', JSON.stringify(objectives));
    renderMainObjective();
  };

  // Render Kanban board
  function renderKanbanBoard() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    // 2026-09-22: lọc theo TaskManager.isVisibleNow() — ẩn task đã bấm "Xoá"
    // (visible=false, không xoá thật nữa) khỏi MỌI cột, và "Hoàn thành" chỉ
    // hiện việc hoàn thành TRONG THÁNG NÀY (tự ẩn khi qua tháng kế tiếp —
    // trước đây tính theo tuần, đổi thành tháng theo yêu cầu người dùng; dữ
    // liệu KHÔNG mất, thống kê năm/quý vẫn đọc thẳng TaskManager.getTasks()).
    const tasks = visibleTasks();
    const currentUser = TaskManager.getCurrentUser();

    // 2026-09-21: đổi sang 4 cột giống hệt quy trình "Dự án" (Chờ xử lý ->
    // Đang làm -> Chờ duyệt -> Hoàn thành, xem taskStatusLabel()) thay vì 3
    // cột cũ (Kanban của tasks-manager.html không có nơi hiện việc đang
    // 'review' — bị "mất tích" khỏi board).
    const todo = tasks.filter(t => t.status === 'pending');
    const inProgress = tasks.filter(t => t.status === 'in-progress');
    const review = tasks.filter(t => t.status === 'review');
    const done = tasks.filter(t => t.status === 'completed');

    const columnHTML = (title, dotColor, tasks, colId) => `
      <div class="kanban-col" id="${colId}">
        <div class="kanban-col-header">
          <span class="kanban-dot" style="background:${dotColor}"></span>
          <span class="kanban-col-title">${title}</span>
          <span class="kanban-count">${tasks.length}</span>
        </div>
        <div class="kanban-cards" data-status="${colId.replace('col-', '')}">
          ${tasks.length > 0 ? tasks.map(task => buildKanbanCard(task)).join('') : '<div class="kanban-empty">Chưa có task</div>'}
        </div>
        ${colId === 'col-pending' ? `<button class="kanban-add-btn" onclick="openTaskModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Thêm task
        </button>` : ''}
      </div>
    `;

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Dashboard</h2>
        <button class="quick-add-btn" onclick="openTaskModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Thêm task
        </button>
      </div>

      <div class="stats-grid" id="statsGrid"></div>
      <div id="mainObjectiveContainer"></div>
      <div class="kanban-board">
        ${columnHTML('Chờ xử lý', 'var(--color-text-faint)', todo, 'col-pending')}
        ${columnHTML('Đang làm', 'var(--color-blue)', inProgress, 'col-in-progress')}
        ${columnHTML('Chờ duyệt', 'var(--color-terracotta)', review, 'col-review')}
        ${columnHTML('Hoàn thành', 'var(--color-success)', done, 'col-completed')}
      </div>
    `;

    // Render stats and objectives after DOM is ready
    setTimeout(function() {
      renderMainObjective();
      renderStatsGrid();
      setupKanbanDragDrop();
    }, 50);
  }

  // Render stats grid
  function renderStatsGrid() {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;

    const stats = TaskManager.getStats();
    const members = TaskManager.getMembers();
    const currentUser = TaskManager.getCurrentUser();

    statsGrid.innerHTML = `
      <div class="stat-card stat-bronze">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
        </div>
        <div class="stat-body">
          <span class="stat-value">${stats.activeProjects}</span>
          <span class="stat-label">Dự án đang chạy</span>
        </div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="stat-body">
          <span class="stat-value">${stats.completedTasks}</span>
          <span class="stat-label">Tasks hoàn thành</span>
        </div>
      </div>
      <div class="stat-card stat-terracotta">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-body">
          <span class="stat-value">${stats.pendingTasks}</span>
          <span class="stat-label">Tasks đang chờ</span>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-body">
          <span class="stat-value">${members.length}</span>
          <span class="stat-label">Thành viên</span>
        </div>
      </div>
    `;
  }

  function buildKanbanCard(task) {
    const taskAssignees = TaskManager.getTaskAssignees(task);
    const project = task.projectId ? TaskManager.getProject(task.projectId) : null;
    const priorityClass = task.priority === 'high' ? 'priority-high' :
                         task.priority === 'medium' ? 'priority-medium' : 'priority-low';
    const priorityLabel = task.priority === 'high' ? 'Cao' :
                         task.priority === 'medium' ? 'TB' : 'Thấp';
    const deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }) : '';
    const isOverdue = task.status !== 'completed' && task.deadline && new Date(task.deadline) < new Date();

    return `
      <div class="kanban-card" data-task-id="${task.id}" draggable="true">
        <div class="kanban-card-header">
          <span class="task-priority-badge ${priorityClass}">${priorityLabel}</span>
          ${taskAssignees.map(a => `<span class="avatar-xs-tm" style="background:${a.color}" title="${a.name}">${a.avatar}</span>`).join('')}
        </div>
        <div class="kanban-card-title">${task.title}</div>
        ${project ? `<div class="kanban-card-project">📁 ${project.name}</div>` : ''}
        ${deadline ? `<div class="kanban-card-deadline ${isOverdue ? 'overdue' : ''}">📅 ${deadline}</div>` : ''}
      </div>
    `;
  }

  function setupKanbanDragDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-cards');
    // 2026-09-21: kéo-thả đổi cột TRỰC TIẾP (bỏ qua hết bước xác nhận/nộp
    // duyệt/lý do từ chối) — chỉ để CEO/Quản lý dùng như công cụ chỉnh tay
    // khi cần (canReviewTasks()), nhân viên thường PHẢI đi qua đúng nút bấm
    // trong "Chi tiết Task" (Xác nhận nhận việc/Hoàn thành) để giữ đúng quy
    // trình duyệt việc.
    const currentUser = TaskManager.getCurrentUser();
    const canDrag = TaskManager.canReviewTasks && TaskManager.canReviewTasks(currentUser);

    cards.forEach(card => {
      card.setAttribute('draggable', canDrag ? 'true' : 'false');
      if (canDrag) {
        card.addEventListener('dragstart', function(e) {
          e.dataTransfer.setData('text/plain', card.dataset.taskId);
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', function() {
          card.classList.remove('dragging');
        });
      }
      // Click to open detail
      card.addEventListener('click', function(e) {
        if (!card.classList.contains('dragging')) {
          openTaskDetailModal(card.dataset.taskId);
        }
      });
    });

    if (!canDrag) return;
    columns.forEach(col => {
      col.addEventListener('dragover', function(e) {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', function() {
        col.classList.remove('drag-over');
      });
      col.addEventListener('drop', function(e) {
        e.preventDefault();
        col.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.status;
        if (taskId && newStatus) {
          TaskManager.updateTask(taskId, { status: newStatus });
          renderDashboard();
        }
      });
    });
  }

  function updateStats(stats) {
    // Update stats cards
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues[0]) statValues[0].textContent = stats.activeProjects;
    if (statValues[1]) statValues[1].textContent = stats.completedTasks;
    if (statValues[2]) statValues[2].textContent = stats.pendingTasks;
    if (statValues[3]) statValues[3].textContent = stats.totalMembers;
  }

  function renderTaskList() {
    const taskListEl = document.querySelector('.task-list');
    if (!taskListEl) return;

    const tasks = visibleTasks();

    if (tasks.length === 0) {
      taskListEl.innerHTML = `
        <li class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Không có task nào</div>
          <div class="empty-state-desc">Tạo task đầu tiên để bắt đầu</div>
        </li>
      `;
      return;
    }

    taskListEl.innerHTML = tasks.map(task => {
      const taskAssignees = TaskManager.getTaskAssignees(task);
      const project = task.projectId ? TaskManager.getProject(task.projectId) : null;

      const priorityClass = task.priority === 'high' ? 'priority-high' :
                          task.priority === 'medium' ? 'priority-medium' : 'priority-low';
      const priorityLabel = task.priority === 'high' ? 'Cao' :
                          task.priority === 'medium' ? 'Trung bình' : 'Thấp';

      const deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', {
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      }) : 'Không có deadline';

      return `
        <li class="task-row ${task.status === 'completed' ? 'done' : ''}" data-task-id="${task.id}">
          <button class="task-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
          <div class="task-content">
            <h4>${task.title}</h4>
            <p>${project ? project.name + ' · ' : ''}${deadline}</p>
          </div>
          <span class="task-priority-badge ${priorityClass}">${priorityLabel}</span>
          ${taskAssignees.map(a => `<span class="avatar-xs-tm" style="background:${a.color}" title="${a.name}">${a.avatar}</span>`).join('')}
        </li>
      `;
    }).join('');
  }

  function renderProjectList() {
    const projectsGrid = document.querySelector('.projects-grid');
    if (!projectsGrid) return;

    const projects = TaskManager.getProjects();

    if (projects.length === 0) {
      projectsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-title">Không có dự án nào</div>
          <div class="empty-state-desc">Tạo dự án đầu tiên</div>
        </div>
      `;
      return;
    }

    projectsGrid.innerHTML = projects.slice(0, 6).map(project => {
      const memberAvatars = project.members ? getProjectMembers(project).slice(0, 3).map(mid => {
        const m = TaskManager.getMember(mid);
        return m ? `<span class="avatar-xxs" style="background:${m.color}">${m.avatar}</span>` : '';
      }).join('') : '';

      const statusClass = project.status === 'on-track' ? 'project-on-track' : 'project-at-risk';

      return `
        <article class="project-card" data-project-id="${project.id}">
          <header>
            <div class="project-avatar${project.shortCode && project.shortCode.length > 3 ? ' project-avatar-long' : ''}" style="background:${project.color}">${project.shortCode || project.name.charAt(0)}</div>
            <div>
              <h3>${project.name}</h3>
              <p>${project.type}</p>
            </div>
          </header>
          <div class="project-progress">
            <div class="progress-bar-tm"><span style="width:${project.progress}%; background:${project.color}"></span></div>
            <span class="progress-percent">${project.progress}%</span>
          </div>
          <footer>
            <div class="project-members">${memberAvatars}</div>
            <span class="project-status ${statusClass}">${project.status === 'on-track' ? 'On track' : 'At risk'}</span>
          </footer>
        </article>
      `;
    }).join('');
  }

  // View renderers
  function renderProjectsView() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    const projects = TaskManager.getProjects();

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Dự án</h2>
        <button class="quick-add-btn add-project-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Tạo dự án
        </button>
      </div>

      <div class="projects-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        ${projects.map(project => {
          const memberAvatars = project.members ? getProjectMembers(project).slice(0, 4).map(mid => {
            const m = TaskManager.getMember(mid);
            return m ? `<span class="avatar-xxs" style="background:${m.color}">${m.avatar}</span>` : '';
          }).join('') : '';

          const statusClass = project.status === 'on-track' ? 'project-on-track' : project.status === 'at-risk' ? 'project-at-risk' : '';

          return `
            <article class="project-card" data-project-id="${project.id}" style="cursor: pointer;">
              <header>
                <div class="project-avatar${project.shortCode && project.shortCode.length > 3 ? ' project-avatar-long' : ''}" style="background:${project.color}">${project.shortCode || project.name.charAt(0)}</div>
                <div>
                  <h3>${project.name}</h3>
                  <p>${project.type}</p>
                </div>
              </header>
              <div class="project-progress">
                <div class="progress-bar-tm"><span style="width:${project.progress}%; background:${project.color}"></span></div>
                <span class="progress-percent">${project.progress}%</span>
              </div>
              <footer>
                <div class="project-members">${memberAvatars}</div>
                <span class="project-status ${statusClass}">${project.status === 'on-track' ? 'On track' : project.status === 'at-risk' ? 'At risk' : 'Hoàn thành'}</span>
              </footer>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderMyTasks() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    const currentUser = TaskManager.getCurrentUser();
    const allTasks = visibleTasks();
    const myTasks = allTasks.filter(t => taskHasAssignee(t, currentUser.id));
    const allMyTasks = allTasks.filter(t => taskHasAssignee(t, currentUser.id) || t.createdBy === currentUser.id);

    const pending = allMyTasks.filter(t => t.status === 'pending').length;
    const inProgress = allMyTasks.filter(t => t.status === 'in-progress').length;
    const completed = allMyTasks.filter(t => t.status === 'completed').length;
    const overdue = allMyTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date()).length;

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Tasks của tôi</h2>
        <button class="quick-add-btn add-task-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Thêm task
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Chờ xử lý</div>
          <div style="font-size: 1.75rem; font-weight: 600; color: var(--color-text); margin-top: 4px;">${pending}</div>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Đang làm</div>
          <div style="font-size: 1.75rem; font-weight: 600; color: #C7A464; margin-top: 4px;">${inProgress}</div>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Hoàn thành</div>
          <div style="font-size: 1.75rem; font-weight: 600; color: #4F6F52; margin-top: 4px;">${completed}</div>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Trễ hạn</div>
          <div style="font-size: 1.75rem; font-weight: 600; color: #A04848; margin-top: 4px;">${overdue}</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Trạng thái:</span>
          <select class="filter-select-tm" id="statusFilter">
            <option value="">Tất cả</option>
            <option value="pending">Chờ xử lý</option>
            <option value="in-progress">Đang làm</option>
            <option value="completed">Hoàn thành</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Ưu tiên:</span>
          <select class="filter-select-tm" id="priorityFilter">
            <option value="">Tất cả</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Dự án:</span>
          <select class="filter-select-tm" id="projectFilter">
            <option value="">Tất cả</option>
            ${TaskManager.getProjects().map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <ul class="task-list">
        ${allMyTasks.length > 0 ? allMyTasks.map(task => {
          const project = task.projectId ? TaskManager.getProject(task.projectId) : null;
          const priorityClass = task.priority === 'high' ? 'priority-high' :
                              task.priority === 'medium' ? 'priority-medium' : 'priority-low';
          const priorityLabel = task.priority === 'high' ? 'Cao' :
                              task.priority === 'medium' ? 'Trung bình' : 'Thấp';
          const statusLabel = taskStatusLabel(task.status);
          const deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', {
            weekday: 'short', hour: '2-digit', minute: '2-digit'
          }) : 'Không có deadline';
          const isOverdue = task.status !== 'completed' && task.deadline && new Date(task.deadline) < new Date();

          return `
            <li class="task-row ${task.status === 'completed' ? 'done' : ''}" data-task-id="${task.id}">
              <button class="task-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <div class="task-content">
                <h4>${task.title}</h4>
                <p style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                  ${project ? `<span>📁 ${project.name}</span>` : ''}
                  <span ${isOverdue ? 'style="color: #A04848; font-weight: 500;"' : ''}>📅 ${deadline}</span>
                  <span>⚙️ ${statusLabel}</span>
                </p>
              </div>
              <span class="task-priority-badge ${priorityClass}">${priorityLabel}</span>
            </li>
          `;
        }).join('') : `
          <li class="empty-state">
            <div class="empty-state-icon">✓</div>
            <div class="empty-state-title">Không có task nào</div>
            <div class="empty-state-desc">Bạn chưa được giao task nào</div>
          </li>
        `}
      </ul>
    `;

    // Filter change handlers
    setTimeout(() => {
      ['statusFilter', 'priorityFilter', 'projectFilter'].forEach(id => {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('change', function() {
            var status = document.getElementById('statusFilter').value;
            var priority = document.getElementById('priorityFilter').value;
            var projectId = document.getElementById('projectFilter').value;

            var filtered = allMyTasks.filter(t => {
              if (status && t.status !== status) return false;
              if (priority && t.priority !== priority) return false;
              if (projectId && t.projectId !== projectId) return false;
              return true;
            });

            var listEl = document.querySelector('.task-list');
            if (filtered.length > 0) {
              listEl.innerHTML = filtered.map(task => {
                var project = task.projectId ? TaskManager.getProject(task.projectId) : null;
                var priorityClass = task.priority === 'high' ? 'priority-high' :
                                    task.priority === 'medium' ? 'priority-medium' : 'priority-low';
                var priorityLabel = task.priority === 'high' ? 'Cao' :
                                    task.priority === 'medium' ? 'Trung bình' : 'Thấp';
                var deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', {
                  weekday: 'short', hour: '2-digit', minute: '2-digit'
                }) : 'Không có deadline';
                return `
                  <li class="task-row ${task.status === 'completed' ? 'done' : ''}" data-task-id="${task.id}">
                    <button class="task-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                    <div class="task-content">
                      <h4>${task.title}</h4>
                      <p>${project ? project.name + ' · ' : ''}${deadline}</p>
                    </div>
                    <span class="task-priority-badge ${priorityClass}">${priorityLabel}</span>
                  </li>
                `;
              }).join('');
            } else {
              listEl.innerHTML = '<li class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Không có task khớp bộ lọc</div></li>';
            }
          });
        }
      });
    }, 100);
  }

  function renderTeam() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    const members = TaskManager.getMembers();

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Thành viên</h2>
      </div>

      <div class="team-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
        ${members.map(member => {
          const tasks = visibleTasks({ assigneeId: member.id });
          const activeTasks = tasks.filter(t => t.status !== 'completed').length;

          return `
            <div class="team-card">
              <div class="team-avatar" style="background: ${member.color}">${member.avatar}</div>
              <div class="team-name">${member.name}</div>
              <div class="team-role">${member.role}</div>
              <div class="team-stat">
                <span>${activeTasks} tasks đang làm</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // "Calendar To Do List" — lưới lịch tháng thật (thay cho danh sách deadline
  // đơn giản cũ), mỗi ngày hiện các task có deadline đúng ngày đó, bấm vào 1
  // ngày mở khung to-do-list đầy đủ bên dưới (tick hoàn thành ngay tại chỗ,
  // bấm tên task mở modal chi tiết đầy đủ — dùng lại openTaskDetailModal()).
  function tasksDueOn(tasks, dateStr) {
    return tasks.filter(function (t) {
      if (!t.deadline) return false;
      var d = new Date(t.deadline);
      if (isNaN(d.getTime())) return false;
      var s = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return s === dateStr;
    });
  }

  function renderCalendar() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    const state = todoCalState;
    const tasks = visibleTasks();
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    // 2026-09-18: tuần bắt đầu từ Thứ 2 (ISO, giống lịch chấm công ở
    // timesheet.html) + tên ngày tiếng Việt thay vì SUNDAY/MONDAY... tiếng Anh.
    const dayHeaders = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const yearsOptions = [];
    for (var y = today.getFullYear() - 2; y <= today.getFullYear() + 2; y++) yearsOptions.push(y);

    const firstDay = new Date(state.year, state.month - 1, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // getDay(): 0=CN..6=T7 -> quy về 0=T2..6=CN
    const daysInMonth = new Date(state.year, state.month, 0).getDate();

    var cellsHtml = '';
    for (var p = 0; p < startWeekday; p++) cellsHtml += '<div class="todo-cal-day other-month"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = state.year + '-' + String(state.month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var dueTasks = tasksDueOn(tasks, dateStr);
      var isToday = dateStr === todayStr;
      var isSelected = dateStr === state.selectedDate;
      var pillsHtml = dueTasks.slice(0, 3).map(function (t) {
        var isDone = t.status === 'completed';
        var dotColor = isDone ? 'var(--color-success)' : (t.priority === 'high' ? 'var(--color-destructive)' : t.priority === 'medium' ? 'var(--color-terracotta)' : 'var(--color-bronze)');
        return '<div class="todo-cal-pill" style="border-left-color:' + dotColor + '" title="' + escapeHtml(t.title) + '">' + escapeHtml(t.title) + '</div>';
      }).join('');
      var moreHtml = dueTasks.length > 3 ? '<div class="todo-cal-more">+' + (dueTasks.length - 3) + ' việc khác</div>' : '';
      cellsHtml += '<div class="todo-cal-day' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + '" data-date="' + dateStr + '">' +
        '<span class="todo-cal-daynum">' + String(d).padStart(2, '0') + '</span>' +
        '<div class="todo-cal-pills">' + pillsHtml + moreHtml + '</div>' +
        '</div>';
    }
    var totalCells = startWeekday + daysInMonth;
    var trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (var n = 0; n < trailing; n++) cellsHtml += '<div class="todo-cal-day other-month"></div>';

    var selectedTasks = state.selectedDate ? tasksDueOn(tasks, state.selectedDate) : [];
    var detailHtml = '';
    if (state.selectedDate) {
      var selD = new Date(state.selectedDate + 'T00:00:00');
      var selLabel = selD.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
      detailHtml = '<div class="todo-cal-detail">' +
        '<h3>Việc cần làm — ' + selLabel + '</h3>' +
        (selectedTasks.length ? '<ul class="todo-cal-tasklist">' + selectedTasks.map(function (t) {
          var isDone = t.status === 'completed';
          var project = t.projectId ? TaskManager.getProject(t.projectId) : null;
          return '<li class="todo-cal-task' + (isDone ? ' done' : '') + '" data-task-id="' + t.id + '">' +
            '<button type="button" class="todo-cal-check" data-toggle-id="' + t.id + '" aria-label="Đánh dấu hoàn thành">' +
              (isDone ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
            '</button>' +
            '<span class="todo-cal-task-title" data-open-id="' + t.id + '">' + escapeHtml(t.title) + (project ? ' <span class="todo-cal-task-project">· ' + escapeHtml(project.name) + '</span>' : '') + '</span>' +
          '</li>';
        }).join('') + '</ul>' : '<p class="todo-cal-empty">Không có việc nào đến hạn ngày này.</p>') +
      '</div>';
    }

    tmContent.innerHTML = `
      <div class="todo-cal-card">
        <div class="todo-cal-header">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M9 16l2 2 4-4"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Calendar To Do List</h2>
          <div class="todo-cal-controls">
            <label>Tháng<select id="todoCalMonth">${monthNames.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === state.month ? ' selected' : '') + '>' + m + '</option>'; }).join('')}</select></label>
            <label>Năm<select id="todoCalYear">${yearsOptions.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '</option>'; }).join('')}</select></label>
            <button type="button" class="todo-cal-reload" id="todoCalToday"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15" r="2" fill="currentColor" stroke="none"/></svg> Hôm nay</button>
          </div>
        </div>
        <div class="todo-cal-grid">
          ${dayHeaders.map(function (h) { return '<div class="todo-cal-day-header">' + h + '</div>'; }).join('')}
          ${cellsHtml}
        </div>
      </div>
      ${detailHtml}
    `;

    document.getElementById('todoCalMonth').addEventListener('change', function () {
      todoCalState.month = parseInt(this.value, 10);
      renderCalendar();
    });
    document.getElementById('todoCalYear').addEventListener('change', function () {
      todoCalState.year = parseInt(this.value, 10);
      renderCalendar();
    });
    // Lăn chuột khi trỏ vào dropdown Tháng/Năm để đổi giá trị nhanh, không
    // cần bấm mở danh sách rồi chọn — preventDefault() để không cuộn cả
    // trang khi con trỏ đang ở trên select.
    function bindWheelSelect(select, onChange) {
      select.addEventListener('wheel', function (e) {
        e.preventDefault();
        var options = Array.prototype.slice.call(select.options);
        var idx = options.findIndex(function (o) { return o.value === select.value; });
        var nextIdx = idx + (e.deltaY > 0 ? 1 : -1);
        if (nextIdx < 0 || nextIdx >= options.length) return;
        select.value = options[nextIdx].value;
        onChange(select.value);
      }, { passive: false });
    }
    bindWheelSelect(document.getElementById('todoCalMonth'), function (val) {
      todoCalState.month = parseInt(val, 10);
      renderCalendar();
    });
    bindWheelSelect(document.getElementById('todoCalYear'), function (val) {
      todoCalState.year = parseInt(val, 10);
      renderCalendar();
    });
    document.getElementById('todoCalToday').addEventListener('click', function () {
      var t = new Date();
      todoCalState.year = t.getFullYear();
      todoCalState.month = t.getMonth() + 1;
      todoCalState.selectedDate = null;
      renderCalendar();
    });
    tmContent.querySelectorAll('.todo-cal-day:not(.other-month)').forEach(function (cell) {
      cell.addEventListener('click', function () {
        todoCalState.selectedDate = todoCalState.selectedDate === cell.dataset.date ? null : cell.dataset.date;
        renderCalendar();
      });
    });
    tmContent.querySelectorAll('[data-toggle-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        TaskManager.toggleTaskStatus(btn.dataset.toggleId);
        renderCalendar();
      });
    });
    tmContent.querySelectorAll('[data-open-id]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        openTaskDetailModal(el.dataset.openId);
      });
    });
  }

  // "Gantt" (mục Gantt, sidebar) — dùng lại NGUYÊN VẸN component HiconiqueGantt
  // đã có sẵn cho trang Dự án (public/js/gantt.js) thay vì viết lại: cùng 1
  // biểu đồ Gantt toàn công ty (tất cả dự án + task có deadline), tránh 2 nơi
  // có 2 logic vẽ Gantt khác nhau. Khác trang Dự án (nơi #gantt-view là 1
  // phần tử TĨNH luôn nằm sẵn trong DOM, chỉ ẩn/hiện bằng display:none) —
  // ở đây .tm-content bị THAY TOÀN BỘ innerHTML mỗi lần đổi view, nên phải
  // tự dựng lại đúng khung HTML đó rồi gọi cả render() LẪN bind() mỗi lần.
  function renderGantt() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Gantt — Tiến độ công việc</h2>
      </div>
      <div class="gantt-view" id="gantt-view">
        <div class="gantt-toolbar">
          <div class="gantt-filter-tabs" id="ganttFilterTabs"></div>
          <div class="gantt-month-nav">
            <button type="button" class="gantt-nav-btn" id="ganttPrevMonth" aria-label="Tháng trước">&larr;</button>
            <div class="timeline-month-picker" id="ganttMonthPicker">
              <button type="button" class="timeline-title-btn" id="ganttMonthLabelBtn">
                <span class="gantt-month-label" id="ganttMonthLabel"></span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="timeline-month-panel" id="ganttMonthPanel" hidden>
                <div class="timeline-year-nav">
                  <button type="button" id="ganttYearPrev" aria-label="Năm trước">&larr;</button>
                  <span id="ganttYearLabel"></span>
                  <button type="button" id="ganttYearNext" aria-label="Năm sau">&rarr;</button>
                </div>
                <div class="timeline-month-grid" id="ganttMonthGrid"></div>
              </div>
            </div>
            <button type="button" class="gantt-nav-btn" id="ganttNextMonth" aria-label="Tháng sau">&rarr;</button>
            <button type="button" class="gantt-today-btn" id="ganttTodayMonth">Hôm nay</button>
          </div>
          <button class="gantt-export-btn" id="ganttExportBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Xuất Excel
          </button>
        </div>
        <div class="gantt-card">
          <div class="gantt-card-header">
            <div class="gantt-card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Biểu đồ Gantt — Tiến độ dự án
            </div>
            <div class="gantt-card-meta" id="ganttCardMeta"></div>
          </div>
          <div class="gantt-legend" id="ganttLegend"></div>
          <div class="gantt-table-wrap">
            <table class="gantt-table" id="ganttTable">
              <thead>
                <tr>
                  <th>Công việc</th>
                  <th colspan="12" style="text-align:center">Khoảng thời gian</th>
                  <th class="gantt-col-progress">Tiến độ</th>
                  <th style="text-align:right">Trạng thái</th>
                </tr>
              </thead>
              <tbody id="ganttBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (typeof HiconiqueGantt !== 'undefined') {
      var ganttRoot = document.getElementById('gantt-view');
      HiconiqueGantt.render(ganttRoot);
      HiconiqueGantt.bind(ganttRoot);
    }
  }

  // Icon SVG (line-icon, đồng bộ phong cách với các icon khác trong app,
  // đổi từ emoji sang) + class màu riêng cho từng loại đề xuất — dùng chung
  // cho cả icon lớn trên mỗi thẻ đề xuất và icon trong bảng chọn loại ở modal.
  const PROPOSAL_TYPE_META = {
    'nghi-phep': {
      label: 'Nghỉ phép',
      colorClass: 'proposal-color-leave',
      svg: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    },
    'mua-sam': {
      label: 'Mua sắm',
      colorClass: 'proposal-color-shopping',
      svg: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'
    },
    'nhan-su': {
      label: 'Nhân sự',
      colorClass: 'proposal-color-hr',
      svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    },
    'cong-tac': {
      label: 'Công tác',
      colorClass: 'proposal-color-trip',
      svg: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>'
    },
    'tai-chinh': {
      label: 'Tài chính',
      colorClass: 'proposal-color-finance',
      svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    },
    'khen-thuong': {
      label: 'Khen thưởng',
      colorClass: 'proposal-color-reward',
      svg: '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>'
    }
  };
  const PROPOSAL_TYPE_DEFAULT = { label: 'Khác', colorClass: 'proposal-color-other', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>' };

  function proposalTypeMeta(type) {
    return PROPOSAL_TYPE_META[type] || PROPOSAL_TYPE_DEFAULT;
  }

  function proposalIconHtml(type, sizeClass) {
    const meta = proposalTypeMeta(type);
    return '<div class="proposal-icon ' + (sizeClass || '') + ' ' + meta.colorClass + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + meta.svg + '</svg>' +
      '</div>';
  }

  function renderProposals() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    const currentUser = TaskManager.getCurrentUser();
    const proposals = TaskManager.getProposals();
    const pendingProposals = proposals.filter(p => p.status === 'pending');

    // Update badge
    const badge = document.getElementById('proposalBadge');
    if (badge) badge.textContent = pendingProposals.length;

    const isLeader = ['CEO', 'Trưởng phòng'].some(r => currentUser.role.includes(r));

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Đề xuất</h2>
        <button class="quick-add-btn create-proposal-btn" data-action="create-proposal" onclick="openProposalModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Tạo đề xuất
        </button>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Trạng thái:</span>
          <select class="filter-select-tm" id="proposalStatusFilter">
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
      </div>

      <div class="proposals-grid" style="display: flex; flex-direction: column; gap: 12px;">
        ${proposals.length > 0 ? proposals.map(proposal => {
          const requester = TaskManager.getMember(proposal.requesterId);
          const reviewer = proposal.reviewerId ? TaskManager.getMember(proposal.reviewerId) : null;

          const typeIconHtml = proposalIconHtml(proposal.type);

          const statusBadge = proposal.status === 'pending' ? '<span class="task-priority-badge priority-medium">Chờ duyệt</span>' :
                            proposal.status === 'approved' ? '<span class="task-priority-badge priority-low">Đã duyệt</span>' :
                            '<span class="task-priority-badge priority-high">Từ chối</span>';

          const canReview = isLeader && proposal.status === 'pending' && reviewer && reviewer.id === currentUser.id;

          return `
            <div class="proposal-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 16px;">
              <div style="display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                ${typeIconHtml}
                <div style="flex: 1 1 220px; min-width: 220px;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
                    <h3 style="font-size: 1rem; font-weight: 600; color: var(--color-text);">${proposal.title}</h3>
                    ${statusBadge}
                  </div>
                  <p style="font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 12px;">${proposal.description}</p>
                  <div class="proposal-meta" style="display: flex; gap: 8px 24px; font-size: 0.8125rem; color: var(--color-text-muted); flex-wrap: wrap;">
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${requester ? requester.name : 'Không rõ'}</span>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> ${proposal.amount ? proposal.amount.toLocaleString('vi-VN') + ' VNĐ' : 'Không có'}</span>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${new Date(proposal.createdAt).toLocaleDateString('vi-VN')}</span>
                    ${reviewer ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px;"><path d="M20 6L9 17l-5-5"/></svg> Người duyệt: ${reviewer.name}</span>` : ''}
                  </div>
                </div>
                ${canReview ? `
                  <div style="display: flex; gap: 8px; flex-basis: 100%; justify-content: flex-end;">
                    <button class="btn btn-primary" style="padding: 6px 16px;" onclick="approveProposal('${proposal.id}')">Duyệt</button>
                    <button class="btn btn-danger" style="padding: 6px 16px;" onclick="rejectProposal('${proposal.id}')">Từ chối</button>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state">
            <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
            <div class="empty-state-title">Không có đề xuất nào</div>
            <div class="empty-state-desc">Tạo đề xuất đầu tiên</div>
          </div>
        `}
      </div>
    `;
  }

  // Open proposal modal
  window.openProposalModal = function(proposal = null) {
    const isEdit = !!proposal;

    const body = `
      <form id="proposalForm">
        <div class="form-group">
          <label class="form-label">Tiêu đề đề xuất *</label>
          <input type="text" class="form-input" name="title" required
            placeholder="Nhập tiêu đề..."
            value="${proposal ? proposal.title : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Mô tả chi tiết</label>
          <textarea class="form-textarea" name="description"
            placeholder="Mô tả chi tiết đề xuất...">${proposal ? (proposal.description || '') : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Loại đề xuất</label>
          <div class="proposal-type-options">
            <div class="proposal-type-option ${proposal && proposal.type === 'nghi-phep' ? 'active' : ''}" data-value="nghi-phep" onclick="selectProposalType(this)">
              ${proposalIconHtml('nghi-phep', 'proposal-icon-sm')}
              <div class="type-label">Nghỉ phép</div>
            </div>
            <div class="proposal-type-option ${!proposal || proposal.type === 'mua-sam' ? 'active' : ''}" data-value="mua-sam" onclick="selectProposalType(this)">
              ${proposalIconHtml('mua-sam', 'proposal-icon-sm')}
              <div class="type-label">Mua sắm</div>
            </div>
            <div class="proposal-type-option ${proposal && proposal.type === 'nhan-su' ? 'active' : ''}" data-value="nhan-su" onclick="selectProposalType(this)">
              ${proposalIconHtml('nhan-su', 'proposal-icon-sm')}
              <div class="type-label">Nhân sự</div>
            </div>
            <div class="proposal-type-option ${proposal && proposal.type === 'cong-tac' ? 'active' : ''}" data-value="cong-tac" onclick="selectProposalType(this)">
              ${proposalIconHtml('cong-tac', 'proposal-icon-sm')}
              <div class="type-label">Công tác</div>
            </div>
            <div class="proposal-type-option ${proposal && proposal.type === 'tai-chinh' ? 'active' : ''}" data-value="tai-chinh" onclick="selectProposalType(this)">
              ${proposalIconHtml('tai-chinh', 'proposal-icon-sm')}
              <div class="type-label">Tài chính</div>
            </div>
            <div class="proposal-type-option ${proposal && proposal.type === 'khen-thuong' ? 'active' : ''}" data-value="khen-thuong" onclick="selectProposalType(this)">
              ${proposalIconHtml('khen-thuong', 'proposal-icon-sm')}
              <div class="type-label">Khen thưởng</div>
            </div>
          </div>
          <input type="hidden" name="type" id="proposalTypeInput" value="${proposal ? proposal.type : 'mua-sam'}">
        </div>

        <div class="form-group">
          <label class="form-label">Số tiền dự kiến (VNĐ)</label>
          <input type="text" inputmode="numeric" class="form-input" name="amount"
            placeholder="0" data-money-input
            value="${proposal && proposal.amount ? HiconiqueMoney.format(proposal.amount) : ''}">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveProposal(${proposal ? `'${proposal.id}'` : 'null'})">
        ${isEdit ? 'Cập nhật' : 'Gửi đề xuất'}
      </button>
    `;

    openModal(isEdit ? 'Chỉnh sửa Đề xuất' : 'Tạo Đề xuất Mới', body, footer);
  }

  window.selectProposalType = function(el) {
    document.querySelectorAll('.proposal-type-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('proposalTypeInput').value = el.dataset.value;
  }

  window.saveProposal = function(proposalId) {
    const form = document.getElementById('proposalForm');
    if (!form.title.value.trim()) {
      alert('Vui lòng nhập tiêu đề đề xuất');
      return;
    }

    const proposalData = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      type: document.getElementById('proposalTypeInput').value,
      amount: HiconiqueMoney.parse(form.amount.value),
      requesterId: TaskManager.getCurrentUser().id,
      reviewerId: 'HQ' // CEO reviews by default
    };

    if (proposalId) {
      TaskManager.updateProposal(proposalId, proposalData);
    } else {
      TaskManager.createProposal(proposalData);
    }

    closeModal();
    renderProposals();
  }

  window.approveProposal = function(proposalId) {
    TaskManager.approveProposal(proposalId);
    renderProposals();
  }

  window.rejectProposal = function(proposalId) {
    TaskManager.rejectProposal(proposalId);
    renderProposals();
  }

  // Animate progress bars
  function animateProgressBars() {
    const bars = document.querySelectorAll('.progress-bar-tm span');
    bars.forEach(function(bar) {
      var width = bar.style.width;
      bar.style.width = '0';
      setTimeout(function() {
        bar.style.width = width;
      }, 100);
    });
  }

  // Export task modal functions globally
  window.openTaskModal = openTaskModal;
  window.closeModal = closeModal;
  window.openProjectModal = openProjectModal;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
