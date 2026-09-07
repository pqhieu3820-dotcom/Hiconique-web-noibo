/**
 * Task Manager Data Layer
 * Supports localStorage and Google Sheets integration
 */

// Check if using Google Sheets (from gsheets-config.js)
function isUsingGSheets() {
  return typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.USE_GSHEETS === true;
}

// Google Sheets API functions (synchronous wrapper)
function callGSheetsAPI(action, data, id) {
  if (!isUsingGSheets() || !GSHEETS_CONFIG.API_URL) return;

  try {
    var params = '?action=' + encodeURIComponent(action);
    if (id) params += '&id=' + encodeURIComponent(id);
    if (data && Object.keys(data).length > 0) {
      params += '&data=' + encodeURIComponent(JSON.stringify(data));
    }

    fetch(GSHEETS_CONFIG.API_URL + params, {
      method: 'GET',
      redirect: 'follow'
    }).then(function(response) {
      return response.json();
    }).then(function(result) {
      if (result.error) {
        console.error('GSheets API error:', result.error);
      }
    }).catch(function(e) {
      console.error('GSheets API call failed:', e);
    });
  } catch (e) {
    console.error('GSheets API error:', e);
  }
}

function syncToGSheets(type, action, data, id) {
  var actionMap = {
    projects: { add: 'addProject', update: 'updateProject', delete: 'deleteProject' },
    tasks: { add: 'addTask', update: 'updateTask', delete: 'deleteTask', toggle: 'toggleTask' },
    proposals: { add: 'addProposal', update: 'updateProposal', delete: 'deleteProposal', approve: 'approveProposal', reject: 'rejectProposal' },
    timesheet: { add: 'addTimesheet', update: 'updateTimesheet' }
  };

  var apiAction = actionMap[type] ? actionMap[type][action] : null;
  if (!apiAction) return;

  callGSheetsAPI(apiAction, data, id);
}

var TaskManager = (function() {
  'use strict';

  // Default members
  var DEFAULT_MEMBERS = [
    { id: 'CEO', name: 'Phạm Quang Hiếu', role: 'CEO', roleLevel: 'admin', email: 'pqhieu3820@gmail.com', password: '123456', dob: '1990-01-15', cccd: '012345678901', hometown: 'Hà Nội', bankAccount: '1234567890', color: '#B08D57', avatar: 'HQ', createdAt: '2026-01-01' },
    { id: 'MGR1', name: 'Nguyễn Hiếu', role: 'Quản lý thiết kế', roleLevel: 'manager', email: 'hieu@hiconique.vn', password: '123456', dob: '1992-05-20', cccd: '012345678902', hometown: 'TP.HCM', bankAccount: '1234567891', color: '#8E7CC3', avatar: 'NH', createdAt: '2026-01-01' },
    { id: 'MGR2', name: 'Trần Mạnh', role: 'Quản lý thi công', roleLevel: 'manager', email: 'manh@hiconique.vn', password: '123456', dob: '1988-08-10', cccd: '012345678903', hometown: 'Hà Nội', bankAccount: '1234567892', color: '#4F6F52', avatar: 'TM', createdAt: '2026-01-01' },
    { id: 'MEM1', name: 'Giản Phương', role: 'Thiết kế đồ họa', roleLevel: 'member', email: 'phuong@hiconique.vn', password: '123456', dob: '1995-03-25', cccd: '012345678904', hometown: 'Đà Nẵng', bankAccount: '1234567893', color: '#3B6B8C', avatar: 'GP', createdAt: '2026-01-01' },
    { id: 'MEM2', name: 'Lê Thành', role: 'Kỹ sư nội thất', roleLevel: 'member', email: 'thanh@hiconique.vn', password: '123456', dob: '1993-11-08', cccd: '012345678905', hometown: 'Hải Phòng', bankAccount: '1234567894', color: '#B8725A', avatar: 'LT', createdAt: '2026-01-01' }
  ];

  // Default projects
  var DEFAULT_PROJECTS = [
    { id: 'prj_A', name: 'Dự án A', type: 'Thiết kế nội thất', progress: 50, status: 'on-track', members: ['CEO', 'MGR1', 'MEM1'], color: '#B08D57', createdAt: '2026-08-01' },
    { id: 'prj_B', name: 'Dự án B', type: 'Thi công xây dựng', progress: 30, status: 'on-track', members: ['MGR2', 'MEM2'], color: '#3B6B8C', createdAt: '2026-08-10' },
    { id: 'prj_C', name: 'Dự án C', type: 'Thiết kế kiến trúc', progress: 10, status: 'on-track', members: ['MGR1', 'MGR2'], color: '#4F6F52', createdAt: '2026-08-15' }
  ];

  // Default tasks
  var DEFAULT_TASKS = [
    { id: 'task_001', title: 'Thiết kế phòng khách Dự án A', description: 'Hoàn thiện bản vẽ thiết kế nội thất phòng khách', projectId: 'prj_A', assigneeId: 'MGR1', priority: 'high', status: 'in-progress', deadline: '2026-08-25T17:00', createdBy: 'CEO', createdAt: '2026-08-20', progress: 50, dailyTasks: [
      { date: '2026-08-21', progress: 30, note: 'Đã hoàn thành bản vẽ 3D', done: true },
      { date: '2026-08-22', progress: 20, note: 'Đang chỉnh sửa theo yêu cầu', done: false }
    ]},
    { id: 'task_002', title: 'Giám sát thi công Dự án B', description: 'Theo dõi tiến độ thi công tại công trường', projectId: 'prj_B', assigneeId: 'MGR2', priority: 'high', status: 'pending', deadline: '2026-08-30T08:00', createdBy: 'CEO', createdAt: '2026-08-15', progress: 0, dailyTasks: [] },
    { id: 'task_003', title: 'Thiết kế kiến trúc Dự án C', description: 'Lập phương án thiết kế kiến trúc sơ bộ', projectId: 'prj_C', assigneeId: 'MEM1', priority: 'medium', status: 'pending', deadline: '2026-09-01T17:00', createdBy: 'MGR1', createdAt: '2026-08-18', progress: 0, dailyTasks: [] },
    { id: 'task_004', title: 'Lập dự toán công trình', description: 'Tính toán chi phí vật liệu và nhân công', projectId: 'prj_B', assigneeId: 'MEM2', priority: 'medium', status: 'pending', deadline: '2026-08-28T17:00', createdBy: 'MGR2', createdAt: '2026-08-19', progress: 0, dailyTasks: [] }
  ];

  // Default proposals
  var DEFAULT_PROPOSALS = [
    { id: 'prop_001', title: 'Mua thêm máy tính cho team design', description: 'Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D', type: 'mua-sam', status: 'pending', requesterId: 'MGR1', reviewerId: 'CEO', amount: 50000000, createdAt: '2026-08-10' },
    { id: 'prop_002', title: 'Đăng ký khóa học SketchUp nâng cao', description: 'Khóa học online cho 3 thành viên', type: 'dao-tao', status: 'approved', requesterId: 'MEM1', reviewerId: 'MGR1', amount: 15000000, createdAt: '2026-08-05' },
    { id: 'prop_003', title: 'Sửa chữa máy chiếu phòng họp', description: 'Máy chiếu bị hỏng cần mang đi sửa', type: 'sua-chua', status: 'rejected', requesterId: 'MEM2', reviewerId: 'CEO', amount: 3000000, createdAt: '2026-08-01' }
  ];

  // Storage keys
  var STORAGE_KEYS = {
    projects: 'hiconique_projects',
    tasks: 'hiconique_tasks',
    members: 'hiconique_members',
    proposals: 'hiconique_proposals',
    settings: 'hiconique_settings',
    timesheet: 'hiconique_timesheet'
  };

  // Cache for Google Sheets data
  var gsCache = {
    projects: null,
    tasks: null,
    members: null,
    proposals: null,
    timesheet: null,
    lastFetch: 0
  };

  // Force refresh from Google Sheets (bypass cache)
  function refreshFromGSheets(callback) {
    gsCache.lastFetch = 0;
    if (!isUsingGSheets()) {
      if (callback) callback(false);
      return;
    }

    var done = 0;
    var total = 5;
    var success = false;

    function checkDone() {
      done++;
      if (done >= total && callback) callback(success);
    }

    getFromGSheets('projects', function(projects) {
      if (projects.length > 0) {
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
        success = true;
      }
      checkDone();
    });
    getFromGSheets('tasks', function(tasks) {
      if (tasks.length > 0) {
        localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
      }
      checkDone();
    });
    getFromGSheets('members', function(members) {
      if (members.length > 0) {
        localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
      }
      checkDone();
    });
    getFromGSheets('proposals', function(proposals) {
      if (proposals.length > 0) {
        localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(proposals));
      }
      checkDone();
    });
    getFromGSheets('timesheet', function(timesheet) {
      if (timesheet.length > 0) {
        localStorage.setItem(STORAGE_KEYS.timesheet, JSON.stringify(timesheet));
      }
      checkDone();
    });
  }

  // Fetch data from Google Sheets
  function fetchFromSheet(url, callback) {
    fetch(url).then(function(response) {
      return response.text();
    }).then(function(text) {
      var data = parseCSV(text);
      callback(data);
    }).catch(function(e) {
      console.error('Error fetching from sheet:', e);
      callback([]);
    });
  }

  // Parse CSV (comma-separated values) to JSON
  function parseCSV(text) {
    if (!text || text.trim() === '') return [];
    var lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    var parseLine = function(line) {
      var result = [];
      var current = '';
      var inQuotes = false;
      for (var i = 0; i < line.length; i++) {
        var char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    var headers = parseLine(lines[0]);
    var data = [];

    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var values = parseLine(lines[i]);
      var obj = {};
      headers.forEach(function(h, index) {
        var val = values[index] || '';
        // Parse arrays
        if (val.startsWith('[') && val.endsWith(']')) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        // Parse numbers
        if (!isNaN(val) && val !== '' && h !== 'name' && h !== 'title' && h !== 'description' && h !== 'type' && h !== 'status') {
          val = Number(val);
        }
        obj[h] = val;
      });
      data.push(obj);
    }
    return data;
  }

  // Get data from Google Sheets
  function getFromGSheets(type, callback) {
    var now = Date.now();
    // Cache for 30 seconds
    if (gsCache[type] && (now - gsCache.lastFetch) < 30000) {
      callback(gsCache[type]);
      return;
    }

    var urls = GSHEETS_CONFIG.DATA_URLS;
    var url = '';
    switch(type) {
      case 'projects': url = urls.PROJECTS; break;
      case 'tasks': url = urls.TASKS; break;
      case 'members': url = urls.MEMBERS; break;
      case 'proposals': url = urls.PROPOSALS; break;
      case 'timesheet': url = urls.TIMESHEET; break;
    }

    fetchFromSheet(url, function(data) {
      gsCache[type] = data;
      gsCache.lastFetch = now;
      callback(data);
    });
  }

  // Get current user
  function getCurrentUser() {
    // First try Auth module (real session)
    if (typeof Auth !== 'undefined') {
      var authUser = Auth.getCurrentUser();
      if (authUser) return authUser;
    }
    // Fallback to first member (development only)
    return DEFAULT_MEMBERS[0];
  }

  // Initialize data from localStorage or Google Sheets
  function initData() {
    if (isUsingGSheets()) {
      // Try to fetch from Google Sheets
      getFromGSheets('projects', function(projects) {
        if (projects.length > 0) {
          localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
        } else {
          localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(DEFAULT_PROJECTS));
        }
      });
      getFromGSheets('tasks', function(tasks) {
        if (tasks.length > 0) {
          localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
        } else {
          localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(DEFAULT_TASKS));
        }
      });
      getFromGSheets('members', function(members) {
        if (members.length > 0) {
          localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
        } else {
          localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(DEFAULT_MEMBERS));
        }
      });
      getFromGSheets('proposals', function(proposals) {
        if (proposals.length > 0) {
          localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(proposals));
        } else {
          localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(DEFAULT_PROPOSALS));
        }
      });
      getFromGSheets('timesheet', function(timesheet) {
        if (timesheet.length > 0) {
          localStorage.setItem(STORAGE_KEYS.timesheet, JSON.stringify(timesheet));
        }
      });
    } else {
      // Use localStorage
      if (!localStorage.getItem(STORAGE_KEYS.projects)) {
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(DEFAULT_PROJECTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.tasks)) {
        localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(DEFAULT_TASKS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.members)) {
        localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(DEFAULT_MEMBERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.proposals)) {
        localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(DEFAULT_PROPOSALS));
      }
    }
  }

  // Generic CRUD operations
  function getAll(key) {
    var data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  function getById(key, id) {
    var items = getAll(key);
    return items.find(function(item) { return item.id === id; });
  }

  function save(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function add(key, item) {
    var items = getAll(key);
    item.id = key.replace('hiconique_', '') + '_' + Date.now();
    item.createdAt = new Date().toISOString().split('T')[0];
    items.push(item);
    save(key, items);
    return item;
  }

  function update(key, id, updates) {
    var items = getAll(key);
    var index = items.findIndex(function(item) { return item.id === id; });
    if (index !== -1) {
      items[index] = Object.assign({}, items[index], updates, { updatedAt: new Date().toISOString() });
      save(key, items);
      return items[index];
    }
    return null;
  }

  function remove(key, id) {
    var items = getAll(key);
    var filtered = items.filter(function(item) { return item.id !== id; });
    save(key, filtered);
    return filtered;
  }

  // Projects
  function getProjects() {
    return getAll(STORAGE_KEYS.projects);
  }

  function getProject(id) {
    return getById(STORAGE_KEYS.projects, id);
  }

  function createProject(project) {
    project.status = project.status || 'on-track';
    project.progress = project.progress || 0;
    var newProject = add(STORAGE_KEYS.projects, project);
    // Sync to Google Sheets
    syncToGSheets('projects', 'add', newProject);
    return newProject;
  }

  function updateProject(id, updates) {
    var updated = update(STORAGE_KEYS.projects, id, updates);
    // Sync to Google Sheets
    if (updated) syncToGSheets('projects', 'update', updates, id);
    return updated;
  }

  function deleteProject(id) {
    var tasks = getAll(STORAGE_KEYS.tasks).filter(function(t) { return t.projectId !== id; });
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    var result = remove(STORAGE_KEYS.projects, id);
    // Sync to Google Sheets
    syncToGSheets('projects', 'delete', {}, id);
    return result;
  }

  // Tasks
  function getTasks(filters) {
    filters = filters || {};
    var tasks = getAll(STORAGE_KEYS.tasks);

    if (filters.status) {
      tasks = tasks.filter(function(t) { return t.status === filters.status; });
    }
    if (filters.priority) {
      tasks = tasks.filter(function(t) { return t.priority === filters.priority; });
    }
    if (filters.assigneeId) {
      tasks = tasks.filter(function(t) { return t.assigneeId === filters.assigneeId; });
    }
    if (filters.projectId) {
      tasks = tasks.filter(function(t) { return t.projectId === filters.projectId; });
    }
    if (filters.search) {
      var search = filters.search.toLowerCase();
      tasks = tasks.filter(function(t) {
        return t.title.toLowerCase().includes(search) ||
          (t.description && t.description.toLowerCase().includes(search));
      });
    }

    return tasks.sort(function(a, b) {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return 0;
    });
  }

  function getTask(id) {
    return getById(STORAGE_KEYS.tasks, id);
  }

  function createTask(task) {
    task.status = task.status || 'pending';
    var newTask = add(STORAGE_KEYS.tasks, task);
    // Sync to Google Sheets
    syncToGSheets('tasks', 'add', newTask);
    return newTask;
  }

  function updateTask(id, updates) {
    var updated = update(STORAGE_KEYS.tasks, id, updates);
    // Sync to Google Sheets
    if (updated) syncToGSheets('tasks', 'update', updates, id);
    return updated;
  }

  function deleteTask(id) {
    var result = remove(STORAGE_KEYS.tasks, id);
    // Sync to Google Sheets
    syncToGSheets('tasks', 'delete', {}, id);
    return result;
  }

  function toggleTaskStatus(id) {
    var task = getTask(id);
    if (task) {
      var newStatus = task.status === 'completed' ? 'pending' : 'completed';
      var updated = updateTask(id, { status: newStatus });
      // Sync toggle to Google Sheets
      syncToGSheets('tasks', 'toggle', {}, id);
      return updated;
    }
    return null;
  }

  // Add daily progress to task
  function addDailyProgress(taskId, progress, note) {
    var task = getTask(taskId);
    if (!task) return null;

    var today = new Date().toISOString().split('T')[0];
    var dailyTasks = task.dailyTasks || [];

    var todayEntry = dailyTasks.find(function(d) { return d.date === today; });

    if (todayEntry) {
      todayEntry.progress = parseInt(progress) || 0;
      todayEntry.note = note || '';
      todayEntry.done = todayEntry.progress >= 100;
    } else {
      dailyTasks.push({
        date: today,
        progress: parseInt(progress) || 0,
        note: note || '',
        done: (parseInt(progress) || 0) >= 100
      });
    }

    // Calculate overall progress from daily tasks
    if (dailyTasks.length > 0) {
      var total = dailyTasks.reduce(function(sum, d) { return sum + (d.progress || 0); }, 0);
      var avgProgress = Math.round(total / dailyTasks.length);
      updateTask(taskId, { dailyTasks: dailyTasks, progress: avgProgress });
    } else {
      updateTask(taskId, { dailyTasks: dailyTasks });
    }

    return task;
  }

  // Get today's progress for a task
  function getTodayProgress(taskId) {
    var task = getTask(taskId);
    if (!task) return null;

    var today = new Date().toISOString().split('T')[0];
    var dailyTasks = task.dailyTasks || [];
    return dailyTasks.find(function(d) { return d.date === today; }) || { progress: 0, note: '', done: false };
  }

  // Generate daily tasks from deadline
  function generateDailyTasks(taskId) {
    var task = getTask(taskId);
    if (!task || !task.deadline) return;

    var startDate = new Date(task.createdAt || new Date().toISOString().split('T')[0]);
    var endDate = new Date(task.deadline);
    var dailyTasks = [];

    for (var d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      var dateStr = d.toISOString().split('T')[0];
      dailyTasks.push({ date: dateStr, progress: 0, note: '', done: false });
    }

    updateTask(taskId, { dailyTasks: dailyTasks });
    return dailyTasks;
  }

  // Members
  function getMembers() {
    return getAll(STORAGE_KEYS.members);
  }

  function getMember(id) {
    return getById(STORAGE_KEYS.members, id);
  }

  // Proposals
  function getProposals(filters) {
    filters = filters || {};
    var proposals = getAll(STORAGE_KEYS.proposals);

    if (filters.status) {
      proposals = proposals.filter(function(p) { return p.status === filters.status; });
    }
    if (filters.requesterId) {
      proposals = proposals.filter(function(p) { return p.requesterId === filters.requesterId; });
    }

    return proposals.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getProposal(id) {
    return getById(STORAGE_KEYS.proposals, id);
  }

  function createProposal(proposal) {
    proposal.status = proposal.status || 'pending';
    var newProposal = add(STORAGE_KEYS.proposals, proposal);
    // Sync to Google Sheets
    syncToGSheets('proposals', 'add', newProposal);
    return newProposal;
  }

  function updateProposal(id, updates) {
    var updated = update(STORAGE_KEYS.proposals, id, updates);
    // Sync to Google Sheets
    if (updated) syncToGSheets('proposals', 'update', updates, id);
    return updated;
  }

  function approveProposal(id) {
    var result = updateProposal(id, { status: 'approved', reviewedAt: new Date().toISOString() });
    // Sync approve to Google Sheets
    syncToGSheets('proposals', 'approve', {}, id);
    return result;
  }

  function rejectProposal(id) {
    var result = updateProposal(id, { status: 'rejected', reviewedAt: new Date().toISOString() });
    // Sync reject to Google Sheets
    syncToGSheets('proposals', 'reject', {}, id);
    return result;
  }

  // Timesheet
  function getTimesheetEntries(filters) {
    filters = filters || {};
    var entries = getAll(STORAGE_KEYS.timesheet);
    if (filters.memberId) {
      entries = entries.filter(function(e) { return e.memberId === filters.memberId; });
    }
    if (filters.month && filters.year) {
      entries = entries.filter(function(e) {
        if (!e.date) return false;
        var d = e.date.split('-');
        return d[0] === String(filters.year) && d[1] === String(filters.month).padStart(2, '0');
      });
    }
    return entries;
  }

  function addTimesheetEntry(entry) {
    var newEntry = add(STORAGE_KEYS.timesheet, entry);
    syncToGSheets('timesheet', 'add', newEntry);
    return newEntry;
  }

  function updateTimesheetEntry(id, updates) {
    var updated = update(STORAGE_KEYS.timesheet, id, updates);
    if (updated) syncToGSheets('timesheet', 'update', updates, id);
    return updated;
  }

  // Statistics
  function getStats() {
    var tasks = getAll(STORAGE_KEYS.tasks);
    var projects = getAll(STORAGE_KEYS.projects);
    var members = getAll(STORAGE_KEYS.members);

    var completedTasks = tasks.filter(function(t) { return t.status === 'completed'; }).length;
    var pendingTasks = tasks.filter(function(t) { return t.status === 'pending'; }).length;
    var inProgressTasks = tasks.filter(function(t) { return t.status === 'in-progress'; }).length;

    var today = new Date().toISOString().split('T')[0];
    var dueToday = tasks.filter(function(t) {
      if (!t.deadline) return false;
      return t.deadline.startsWith(today) && t.status !== 'completed';
    }).length;

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(function(p) { return p.status !== 'completed'; }).length,
      completedTasks: completedTasks,
      pendingTasks: pendingTasks,
      inProgressTasks: inProgressTasks,
      totalTasks: tasks.length,
      dueToday: dueToday,
      totalMembers: members.length,
      onlineMembers: 3
    };
  }

  // Initialize on load
  initData();

  // Public API
  return {
    // User
    getCurrentUser: getCurrentUser,

    // Projects
    getProjects: getProjects,
    getProject: getProject,
    createProject: createProject,
    updateProject: updateProject,
    deleteProject: deleteProject,

    // Tasks
    getTasks: getTasks,
    getTask: getTask,
    createTask: createTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    toggleTaskStatus: toggleTaskStatus,
    addDailyProgress: addDailyProgress,
    getTodayProgress: getTodayProgress,
    generateDailyTasks: generateDailyTasks,

    // Members
    getMembers: getMembers,
    getMember: getMember,

    // Proposals
    getProposals: getProposals,
    getProposal: getProposal,
    createProposal: createProposal,
    updateProposal: updateProposal,
    approveProposal: approveProposal,
    rejectProposal: rejectProposal,

    // Stats
    getStats: getStats,

    // Timesheet
    getTimesheetEntries: getTimesheetEntries,
    addTimesheetEntry: addTimesheetEntry,
    updateTimesheetEntry: updateTimesheetEntry,

    // Storage
    STORAGE_KEYS: STORAGE_KEYS,

    // Sync helpers
    refreshFromGSheets: refreshFromGSheets,
    isUsingGSheets: isUsingGSheets
  };
})();

// Export globally so other pages can use TaskManager.*
window.TaskManager = TaskManager;

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskManager;
}
