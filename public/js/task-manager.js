/* Task Manager - Interactive behaviors */
(function () {
  'use strict';

  // Task check interaction
  var taskRows = document.querySelectorAll('.task-row');
  taskRows.forEach(function (row) {
    var check = row.querySelector('.task-check');
    if (!check) return;

    check.addEventListener('click', function () {
      row.classList.toggle('done');
    });
  });

  // Nav item click
  var navItems = document.querySelectorAll('.tm-nav-item');
  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      navItems.forEach(function (i) { i.classList.remove('active'); });
      item.classList.add('active');
    });
  });

  // Filter tab click
  var filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      filterTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
    });
  });

  // Animate progress bars on load
  var bars = document.querySelectorAll('.progress-bar-tm span');
  setTimeout(function () {
    bars.forEach(function (bar) {
      var width = bar.style.width;
      bar.style.width = '0';
      setTimeout(function () {
        bar.style.width = width;
      }, 100);
    });
  }, 200);

  // Week bars animation
  var dayBars = document.querySelectorAll('.day-bar span');
  setTimeout(function () {
    dayBars.forEach(function (bar) {
      var height = bar.style.height;
      bar.style.height = '0';
      setTimeout(function () {
        bar.style.height = height;
      }, 300);
    });
  }, 400);
})();