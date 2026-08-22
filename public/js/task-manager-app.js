/**
 * Task Manager Application - Interactive Behaviors
 */

(function() {
  'use strict';

  // DOM Elements
  let modalOverlay = null;
  let currentModal = null;

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

    // Wire sync button click handler
    var syncBtn = document.getElementById('syncFromSheetsBtn');
    if (syncBtn) syncBtn.addEventListener('click', syncFromSheets);

    // Update user info in UI
    if (currentUser) updateUserUIUI(currentUser);

    // Update badges with real data
    updateNavBadges();

    // Start auto-polling from Google Sheets every 15s
    startAutoPolling();
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
    var canManageMembers = roleLevel === 'admin';
    var canAccessSettings = roleLevel === 'admin';
    var canCreateProject = roleLevel === 'admin' || roleLevel === 'manager';

    // Settings link
    document.querySelectorAll('[data-view="settings"]').forEach(function(el) {
      el.style.display = canAccessSettings ? '' : 'none';
    });

    // Hide "Tạo dự án" buttons for members
    if (!canCreateProject) {
      var style = document.createElement('style');
      style.textContent = '.add-project-btn { display: none !important; }';
      document.head.appendChild(style);
    }
  }

  // Auto-poll from Google Sheets every 15s
  function startAutoPolling() {
    if (typeof GSHEETS_CONFIG === 'undefined' || !GSHEETS_CONFIG.USE_GSHEETS) return;
    setInterval(function() {
      if (!TaskManager.refreshFromGSheets) return;
      TaskManager.refreshFromGSheets(function() {
        updateNavBadges();
        // Re-render if on dashboard or related view
        var active = document.querySelector('.tm-nav-item.active');
        if (active) {
          var view = active.dataset.view;
          if (view === 'dashboard') renderDashboard();
          else if (view === 'projects') renderProjectsView();
          else if (view === 'my-tasks') renderMyTasks();
          else if (view === 'team') renderTeam();
          else if (view === 'calendar') renderCalendar();
          else if (view === 'proposals') renderProposals();
        }
      });
    }, 15000);
  }

  // Update nav badge counts with real data
  function updateNavBadges() {
    var projects = TaskManager.getProjects();
    var tasks = TaskManager.getTasks();
    var proposals = TaskManager.getProposals();
    var currentUser = TaskManager.getCurrentUser();

    var projBadge = document.getElementById('projectsBadge');
    if (projBadge) projBadge.textContent = projects.length;

    var myBadge = document.getElementById('myTasksBadge');
    if (myBadge) {
      var myTasks = tasks.filter(t => t.assigneeId === currentUser.id);
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
      // Re-render current view
      var activeNav = document.querySelector('.tm-nav-item.active');
      if (activeNav) {
        var text = activeNav.textContent.trim();
        if (text.includes('Dashboard')) renderDashboard();
        else if (text.includes('Dự án')) renderProjectsView();
        else if (text.includes('Tasks của tôi')) renderMyTasks();
        else if (text.includes('Team')) renderTeam();
        else if (text.includes('Đề xuất')) renderProposals();
      } else {
        renderDashboard();
      }

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
            renderDashboard();
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
        else if (view === 'proposals') renderProposals();
        else if (view === 'settings') renderSettings();
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

    // Quick add task button
    document.addEventListener('click', function(e) {
      const addBtn = e.target.closest('.quick-add-btn, .add-task-btn, [data-action="add-task"]');
      if (addBtn) {
        e.preventDefault();
        openTaskModal();
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
          TaskManager.deleteProject(projectId);
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
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Open task creation/edit modal
  function openTaskModal(task = null) {
    const isEdit = !!task;
    const members = TaskManager.getMembers();
    const projects = TaskManager.getProjects();
    const currentUser = TaskManager.getCurrentUser();

    const memberOptions = members.map(m =>
      `<option value="${m.id}" ${task && task.assigneeId === m.id ? 'selected' : ''}>${m.name}</option>`
    ).join('');

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

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dự án</label>
            <select class="form-select" name="projectId">
              <option value="">-- Chọn dự án --</option>
              ${projectOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Người được giao</label>
            <select class="form-select" name="assigneeId">
              <option value="">-- Chọn người --</option>
              ${memberOptions}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Deadline</label>
            <input type="datetime-local" class="form-input" name="deadline"
              value="${task && task.deadline ? task.deadline.slice(0, 16) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Trạng thái</label>
            <select class="form-select" name="status">
              <option value="pending" ${task && task.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
              <option value="in-progress" ${task && task.status === 'in-progress' ? 'selected' : ''}>Đang làm</option>
              <option value="completed" ${task && task.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Độ ưu tiên</label>
          <div class="priority-options">
            <div class="priority-option high ${task && task.priority === 'high' ? 'active' : ''}" data-value="high">Cao</div>
            <div class="priority-option medium ${task && task.priority === 'medium' ? 'active' : ''}" data-value="medium">Trung bình</div>
            <div class="priority-option low ${task && task.priority === 'low' ? 'active' : ''}" data-value="low">Thấp</div>
          </div>
          <input type="hidden" name="priority" id="priorityInput" value="${task ? task.priority : 'medium'}">
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

    // Priority option click handlers
    document.querySelectorAll('.priority-option').forEach(opt => {
      opt.addEventListener('click', function() {
        document.querySelectorAll('.priority-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('priorityInput').value = this.dataset.value;
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

    const taskData = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      projectId: form.projectId.value,
      assigneeId: form.assigneeId.value,
      deadline: form.deadline.value,
      status: form.status.value,
      priority: document.getElementById('priorityInput').value
    };

    if (taskId) {
      TaskManager.updateTask(taskId, taskData);
    } else {
      taskData.createdBy = TaskManager.getCurrentUser().id;
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
    const assignee = task.assigneeId ? TaskManager.getMember(task.assigneeId) : null;
    const creator = task.createdBy ? TaskManager.getMember(task.createdBy) : null;

    const priorityClass = task.priority === 'high' ? 'priority-high' : task.priority === 'medium' ? 'priority-medium' : 'priority-low';
    const priorityLabel = task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp';

    const statusLabel = task.status === 'pending' ? 'Chờ xử lý' : task.status === 'in-progress' ? 'Đang làm' : 'Hoàn thành';

    // Get today's progress
    const todayProgress = TaskManager.getTodayProgress(taskId) || { progress: task.progress || 0, note: '', done: false };
    const dailyTasks = task.dailyTasks || [];

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

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Dự án</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${project ? project.name : 'Không có'}</p>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--color-text-muted);">Người được giao</label>
          <p style="font-size: 0.875rem; color: var(--color-text);">${assignee ? assignee.name : 'Chưa giao'}</p>
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
          alert('Đã lưu tiến độ!');
          openTaskDetailModal(taskId); // Refresh
        });
      }
    }, 100);
  }

  // Open project modal
  function openProjectModal(project = null) {
    const isEdit = !!project;
    const members = TaskManager.getMembers();
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
          <label class="form-label">Thành viên tham gia</label>
          <div class="member-select">
            ${members.map(m => `
              <div class="member-chip ${project && project.members && project.members.includes(m.id) ? 'selected' : ''}"
                   data-member-id="${m.id}" onclick="toggleMemberChip(this)">
                <span class="avatar-chip" style="background: ${m.color}">${m.avatar}</span>
                ${m.name}
              </div>
            `).join('')}
          </div>
          <input type="hidden" name="members" id="membersInput"
            value="${project && project.members ? project.members.join(',') : ''}">
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
      progress: parseInt(form.progress.value),
      status: form.status.value,
      members: document.getElementById('membersInput').value ?
        document.getElementById('membersInput').value.split(',') : []
    };

    if (projectId) {
      TaskManager.updateProject(projectId, projectData);
    } else {
      TaskManager.createProject(projectData);
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

    const memberAvatars = project.members ? project.members.map(mid => {
      const m = TaskManager.getMember(mid);
      return m ? `<span class="avatar-xxs" style="background:${m.color}">${m.avatar}</span>` : '';
    }).join('') : '';

    const statusClass = project.status === 'on-track' ? 'project-on-track' : project.status === 'at-risk' ? 'project-at-risk' : '';

    const body = `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div class="project-avatar" style="background:${project.color}; width: 48px; height: 48px; border-radius: 8px; display: grid; place-items: center; color: #0B0D10; font-weight: 600;">
            ${project.name.charAt(0)}
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
      </div>

      <h4 style="font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin-bottom: 12px;">
        Tasks trong dự án (${tasks.length})
      </h4>

      ${tasks.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
          ${tasks.map(t => {
            const assignee = TaskManager.getMember(t.assigneeId);
            return `
              <div class="task-row" data-task-id="${t.id}" style="padding: 10px; background: var(--color-bg); border-radius: 6px; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${t.status === 'completed' ? 'var(--color-bronze)' : 'var(--color-border-strong)'}; ${t.status === 'completed' ? 'background: var(--color-bronze)' : ''};"></div>
                  <div style="flex: 1;">
                    <span style="font-size: 0.875rem; color: ${t.status === 'completed' ? 'var(--color-text-faint)' : 'var(--color-text)'}; ${t.status === 'completed' ? 'text-decoration: line-through' : ''};">${t.title}</span>
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 8px;">${assignee ? assignee.name : 'Chưa giao'}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<p style="font-size: 0.875rem; color: var(--color-text-muted);">Chưa có task nào</p>'}
    `;

    const footer = `
      <button class="btn btn-danger" data-action="delete-project" data-project-id="${project.id}">Xóa</button>
      <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
      <button class="btn btn-primary" onclick="openProjectModal(TaskManager.getProject('${project.id}'));">Sửa</button>
    `;

    openModal('Chi tiết Dự án', body, footer);
  }

  // Apply filter tab (bottom tabs)
  function applyFilterTab(label) {
    var taskListEl = document.querySelector('.task-list');
    if (!taskListEl) return;

    var tasks = TaskManager.getTasks();

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
      var assignee = TaskManager.getMember(task.assigneeId);
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
          ${assignee ? `<span class="avatar-xs-tm" style="background:${assignee.color}">${assignee.avatar}</span>` : ''}
        </li>
      `;
    }).join('');
  }

  // Render functions
  function renderDashboard() {
    // Stats are rendered statically in HTML, but we can update them dynamically
    const stats = TaskManager.getStats();
    updateStats(stats);

    // Insert sync button into top bar
    var topbar = document.querySelector('.tm-topbar');
    if (topbar && !document.getElementById('syncFromSheetsBtn')) {
      topbar.insertAdjacentHTML('beforeend', `
        <button id="syncFromSheetsBtn" class="sync-btn" title="Đồng bộ dữ liệu mới nhất từ Google Sheets" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; color: var(--color-text); border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; font-size: 0.8125rem; white-space: nowrap; margin-right: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Đồng bộ Sheet
        </button>
      `);
      document.getElementById('syncFromSheetsBtn').addEventListener('click', syncFromSheets);
    }

    // Render task list
    renderTaskList();

    // Render projects
    renderProjectList();

    // Animate progress bars
    setTimeout(animateProgressBars, 100);
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

    const tasks = TaskManager.getTasks();

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
      const assignee = TaskManager.getMember(task.assigneeId);
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
          ${assignee ? `<span class="avatar-xs-tm" style="background:${assignee.color}">${assignee.avatar}</span>` : ''}
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
      const memberAvatars = project.members ? project.members.slice(0, 3).map(mid => {
        const m = TaskManager.getMember(mid);
        return m ? `<span class="avatar-xxs" style="background:${m.color}">${m.avatar}</span>` : '';
      }).join('') : '';

      const statusClass = project.status === 'on-track' ? 'project-on-track' : 'project-at-risk';

      return `
        <article class="project-card" data-project-id="${project.id}">
          <header>
            <div class="project-avatar" style="background:${project.color}">${project.name.charAt(0)}</div>
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
          const memberAvatars = project.members ? project.members.slice(0, 4).map(mid => {
            const m = TaskManager.getMember(mid);
            return m ? `<span class="avatar-xxs" style="background:${m.color}">${m.avatar}</span>` : '';
          }).join('') : '';

          const statusClass = project.status === 'on-track' ? 'project-on-track' : project.status === 'at-risk' ? 'project-at-risk' : '';

          return `
            <article class="project-card" data-project-id="${project.id}" style="cursor: pointer;">
              <header>
                <div class="project-avatar" style="background:${project.color}">${project.name.charAt(0)}</div>
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
    const allTasks = TaskManager.getTasks();
    const myTasks = allTasks.filter(t => t.assigneeId === currentUser.id);
    const allMyTasks = allTasks.filter(t => t.assigneeId === currentUser.id || t.createdBy === currentUser.id);

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
          const statusLabel = task.status === 'pending' ? 'Chờ xử lý' :
                              task.status === 'in-progress' ? 'Đang làm' : 'Hoàn thành';
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
          const tasks = TaskManager.getTasks({ assigneeId: member.id });
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

  function renderCalendar() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    const tasks = TaskManager.getTasks();

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Lịch</h2>
      </div>

      <div style="padding: 40px; text-align: center;">
        <div style="font-size: 4rem; margin-bottom: 16px;">📅</div>
        <h3 style="font-size: 1.25rem; color: var(--color-text); margin-bottom: 8px;">Lịch trình</h3>
        <p style="color: var(--color-text-muted);">Hiển thị các task có deadline</p>
        <div style="margin-top: 24px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
          ${tasks.filter(t => t.deadline).slice(0, 10).map(task => {
            const deadline = new Date(task.deadline);
            return `
              <div style="display: flex; gap: 16px; padding: 12px; background: var(--color-surface); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--color-border);">
                <div style="min-width: 60px; text-align: center;">
                  <div style="font-size: 1.25rem; font-weight: 600; color: var(--color-bronze);">${deadline.getDate()}</div>
                  <div style="font-size: 0.75rem; color: var(--color-text-muted);">${deadline.toLocaleDateString('vi-VN', { month: 'short' })}</div>
                </div>
                <div>
                  <div style="font-weight: 500; color: var(--color-text);">${task.title}</div>
                  <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
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
        <button class="quick-add-btn" onclick="openProposalModal()">
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

          const typeIcon = proposal.type === 'mua-sam' ? '🛒' :
                         proposal.type === 'dao-tao' ? '📚' :
                         proposal.type === 'sua-chua' ? '🔧' : '📝';
          const typeLabel = proposal.type === 'mua-sam' ? 'Mua sắm' :
                           proposal.type === 'dao-tao' ? 'Đào tạo' :
                           proposal.type === 'sua-chua' ? 'Sửa chữa' : 'Khác';

          const statusBadge = proposal.status === 'pending' ? '<span class="task-priority-badge priority-medium">Chờ duyệt</span>' :
                            proposal.status === 'approved' ? '<span class="task-priority-badge priority-low">Đã duyệt</span>' :
                            '<span class="task-priority-badge priority-high">Từ chối</span>';

          const canReview = isLeader && proposal.status === 'pending' && reviewer && reviewer.id === currentUser.id;

          return `
            <div class="proposal-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 16px;">
              <div style="display: flex; align-items: flex-start; gap: 16px;">
                <div style="font-size: 2rem;">${typeIcon}</div>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <h3 style="font-size: 1rem; font-weight: 600; color: var(--color-text);">${proposal.title}</h3>
                    ${statusBadge}
                  </div>
                  <p style="font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 12px;">${proposal.description}</p>
                  <div style="display: flex; gap: 24px; font-size: 0.8125rem; color: var(--color-text-muted);">
                    <span>👤 ${requester ? requester.name : 'Không rõ'}</span>
                    <span>💰 ${proposal.amount ? proposal.amount.toLocaleString('vi-VN') + ' VNĐ' : 'Không có'}</span>
                    <span>📅 ${new Date(proposal.createdAt).toLocaleDateString('vi-VN')}</span>
                    ${reviewer ? `<span>✓ Người duyệt: ${reviewer.name}</span>` : ''}
                  </div>
                </div>
                ${canReview ? `
                  <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary" style="padding: 6px 16px;" onclick="approveProposal('${proposal.id}')">Duyệt</button>
                    <button class="btn btn-danger" style="padding: 6px 16px;" onclick="rejectProposal('${proposal.id}')">Từ chối</button>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
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
            <div class="proposal-type-option ${proposal && proposal.type === 'mua-sam' ? 'active' : ''}" data-value="mua-sam" onclick="selectProposalType(this)">
              <div class="type-icon">🛒</div>
              <div class="type-label">Mua sắm</div>
            </div>
            <div class="proposal-type-option ${proposal && proposal.type === 'dao-tao' ? 'active' : ''}" data-value="dao-tao" onclick="selectProposalType(this)">
              <div class="type-icon">📚</div>
              <div class="type-label">Đào tạo</div>
            </div>
            <div class="proposal-type-option ${proposal && proposal.type === 'sua-chua' ? 'active' : ''}" data-value="sua-chua" onclick="selectProposalType(this)">
              <div class="type-icon">🔧</div>
              <div class="type-label">Sửa chữa</div>
            </div>
          </div>
          <input type="hidden" name="type" id="proposalTypeInput" value="${proposal ? proposal.type : 'mua-sam'}">
        </div>

        <div class="form-group">
          <label class="form-label">Số tiền dự kiến (VNĐ)</label>
          <input type="number" class="form-input" name="amount"
            placeholder="0"
            value="${proposal ? proposal.amount : ''}">
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
      amount: form.amount.value ? parseInt(form.amount.value) : 0,
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

  function renderSettings() {
    const tmContent = document.querySelector('.tm-content');
    if (!tmContent) return;

    tmContent.innerHTML = `
      <div class="tm-topbar">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Cài đặt</h2>
      </div>

      <div style="max-width: 600px;">
        <div class="form-group">
          <label class="form-label">Tên người dùng</label>
          <input type="text" class="form-input" value="${TaskManager.getCurrentUser().name}" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">Vai trò</label>
          <input type="text" class="form-input" value="${TaskManager.getCurrentUser().role}" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">Dữ liệu</label>
          <button class="btn btn-secondary" onclick="exportData()">Xuất dữ liệu</button>
          <button class="btn btn-secondary" onclick="clearData()" style="margin-left: 8px;">Xóa dữ liệu</button>
        </div>
      </div>
    `;
  }

  // Export/Import functions
  window.exportData = function() {
    const data = {
      projects: TaskManager.getProjects(),
      tasks: TaskManager.getTasks(),
      members: TaskManager.getMembers(),
      proposals: TaskManager.getProposals()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hiconique-tasks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.clearData = function() {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu?')) {
      localStorage.clear();
      location.reload();
    }
  };

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

  // Close modal globally
  window.closeModal = closeModal;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
