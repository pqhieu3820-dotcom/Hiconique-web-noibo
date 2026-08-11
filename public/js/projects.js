/* Projects Page - Lark-style functionality */
(function () {
  'use strict';

  // ----- View Toggle -----
  var viewTabs = document.querySelectorAll('.view-tab');
  var kanbanBoard = document.getElementById('kanban-board');
  var listView = document.getElementById('list-view');
  var timelineView = document.getElementById('timeline-view');

  viewTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var view = tab.dataset.view;

      // Update tab active state
      viewTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      // Show/hide views
      kanbanBoard.style.display = view === 'board' ? 'flex' : 'none';
      listView.style.display = view === 'list' ? 'block' : 'none';
      timelineView.style.display = view === 'timeline' ? 'block' : 'none';
    });
  });

  // ----- Project Filter -----
  var projectNavItems = document.querySelectorAll('.project-nav-item');

  projectNavItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      projectNavItems.forEach(function (i) { i.classList.remove('active'); });
      item.classList.add('active');
    });
  });

  // ----- Drag and Drop -----
  var taskCards = document.querySelectorAll('.task-card');
  var columns = document.querySelectorAll('.column-tasks');

  taskCards.forEach(function (card) {
    card.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', '');
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
    });
  });

  columns.forEach(function (column) {
    column.addEventListener('dragover', function (e) {
      e.preventDefault();
      var dragging = document.querySelector('.dragging');
      if (dragging) {
        column.appendChild(dragging);
      }
    });
  });

  // ----- Modal -----
  var modal = document.getElementById('task-modal');
  var modalClose = document.querySelector('.modal-close');
  var modalCancel = document.querySelector('.modal-cancel');
  var newTaskBtn = document.querySelector('.btn-new-task');
  var taskForm = document.querySelector('.modal-body form');

  function openModal() {
    modal.hidden = false;
    document.getElementById('task-name').focus();
  }

  function closeModal() {
    modal.hidden = true;
  }

  newTaskBtn && newTaskBtn.addEventListener('click', openModal);
  modalClose && modalClose.addEventListener('click', closeModal);
  modalCancel && modalCancel.addEventListener('click', closeModal);

  modal && modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // Form submit
  taskForm && taskForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('task-name').value;
    var project = document.getElementById('task-project').value;
    var assignee = document.getElementById('task-assigninee').value;
    var priority = document.getElementById('task-priority').value;
    var due = document.getElementById('task-due').value;

    if (!name) return;

    // Create new task card
    var priorityClass = 'priority-' + priority;
    var assigneeInitials = assignee ? assignee.substring(0, 2).toUpperCase() : '?';
    var dueDate = due ? due.split('-')[2] + '/' + due.split('-')[1] : '...';

    var newCard = document.createElement('div');
    newCard.className = 'task-card';
    newCard.draggable = true;
    newCard.dataset.priority = priority;
    newCard.innerHTML =
      '<div class="task-priority ' + priorityClass + '">' +
        (priority === 'high' ? 'Cao' : priority === 'medium' ? 'Trung bình' : 'Thấp') +
      '</div>' +
      '<h4 class="task-title">' + name + '</h4>' +
      '<p class="task-project">' + (project || 'Chưa có dự án') + '</p>' +
      '<div class="task-meta">' +
        '<span class="task-assignee"><span class="avatar-xs">' + assigneeInitials + '</span></span>' +
        '<span class="task-date">' + dueDate + '</span>' +
      '</div>';

    // Add to first column
    var firstColumn = document.querySelector('.column-tasks');
    firstColumn.appendChild(newCard);

    // Add drag events to new card
    newCard.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', '');
      newCard.classList.add('dragging');
    });
    newCard.addEventListener('dragend', function () {
      newCard.classList.remove('dragging');
    });

    // Reset form and close
    taskForm.reset();
    closeModal();
  });

  // ----- Task Checkbox -----
  var taskCheckboxes = document.querySelectorAll('.task-checkbox input');
  taskCheckboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', function () {
      var row = checkbox.closest('tr');
      if (checkbox.checked) {
        row.style.opacity = '0.5';
      } else {
        row.style.opacity = '1';
      }
    });
  });

  // ----- Keyboard shortcuts -----
  document.addEventListener('keydown', function (e) {
    // Press N for new task
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openModal();
    }
    // Press Escape to close modal
    if (e.key === 'Escape' && !modal.hidden) {
      closeModal();
    }
  });
})();
