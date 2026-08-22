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
    proposals: { add: 'addProposal', update: 'updateProposal', delete: 'deleteProposal', approve: 'approveProposal', reject: 'rejectProposal' }
  };

  var apiAction = actionMap[type] ? actionMap[type][action] : null;
  if (!apiAction) return;

  callGSheetsAPI(apiAction, data, id);
}

var TaskManager = (function() {
  'use strict';

  // Default members
  var DEFAULT_MEMBERS = [
    { id: 'HQ', name: 'Trần Minh Quân', role: 'CEO', roleLevel: 'admin', email: 'quan@hiconique.vn', color: '#B08D57', avatar: 'HQ' },
    { id: 'HN', name: 'Nguyễn Hiếu', role: 'Trưởng phòng Thiết kế', roleLevel: 'manager', email: 'hieu@hiconique.vn', color: '#8E7CC3', avatar: 'HN' },
    { id: 'PH', name: 'Phạm Hoàng', role: 'Giám sát thi công', roleLevel: 'manager', email: 'hoang@hiconique.vn', color: '#C7A464', avatar: 'PH' },
    { id: 'TM', name: 'Trần Mạnh', role: 'Truyền thông', roleLevel: 'member', email: 'manh@hiconique.vn', color: '#4F6F52', avatar: 'TM' },
    { id: 'GP', name: 'Giản Phương', role: 'Thiết kế đồ họa', roleLevel: 'member', email: 'phuong@hiconique.vn', color: '#3B6B8C', avatar: 'GP' },
    { id: 'LT', name: 'Lê Thành', role: 'Kỹ sư nội thất', roleLevel: 'member', email: 'thanh@hiconique.vn', color: '#B8725A', avatar: 'LT' },
    { id: 'NT', name: 'Ngọc Trang', role: 'Nhân sự', roleLevel: 'member', email: 'trang@hiconique.vn', color: '#6B5B95', avatar: 'NT' },
    { id: 'VH', name: 'Vũ Hùng', role: 'Kế toán', roleLevel: 'member', email: 'hung@hiconique.vn', color: '#88B04B', avatar: 'VH' },
    { id: 'DN', name: 'Đỗ Nam', role: 'Thiết kế nội thất', roleLevel: 'member', email: 'nam@hiconique.vn', color: '#F7CAC9', avatar: 'DN' },
    { id: 'QM', name: 'Quách Minh', role: 'Thi công', roleLevel: 'member', email: 'minh@hiconique.vn', color: '#92A8D1', avatar: 'QM' }
  ];

  // Default projects
  var DEFAULT_PROJECTS = [
    { id: 'prj_001', name: 'Vinhouse Mỹ Đình', type: 'Thiết kế nội thất', progress: 65, status: 'on-track', members: ['HQ', 'HN', 'PH'], color: '#B08D57', createdAt: '2026-07-15' },
    { id: 'prj_002', name: 'Penthouse HP', type: 'Triển khai bản vẽ', progress: 40, status: 'on-track', members: ['HN', 'PH'], color: '#3B6B8C', createdAt: '2026-07-20' },
    { id: 'prj_003', name: 'Biệt thự Đà Lạt', type: 'Thi công nội thất', progress: 91, status: 'on-track', members: ['PH', 'TM'], color: '#B8725A', createdAt: '2026-06-01' },
    { id: 'prj_004', name: 'Showroom HCM', type: 'Concept 3D', progress: 24, status: 'on-track', members: ['GP'], color: '#4F6F52', createdAt: '2026-08-01' },
    { id: 'prj_005', name: 'Risk Project', type: 'Thiết kế web', progress: 30, status: 'at-risk', members: ['TM'], color: '#A04848', createdAt: '2026-07-10' },
    { id: 'prj_006', name: '20 Landing page', type: 'Web design', progress: 85, status: 'on-track', members: ['TM', 'GP'], color: '#C7A464', createdAt: '2026-06-15' }
  ];

  // Default tasks
  var DEFAULT_TASKS = [
    { id: 'task_001', title: 'Review design mockups cho Vinhouse', description: 'Kiểm tra và phản hồi bản mockup mới nhất', projectId: 'prj_001', assigneeId: 'HN', priority: 'high', status: 'pending', deadline: '2026-08-12T11:00', createdBy: 'HQ', createdAt: '2026-08-10', progress: 0, dailyTasks: [] },
    { id: 'task_002', title: 'Chuẩn bị presentation khách hàng', description: 'Slide trình bày cho buổi họp với khách hàng', projectId: 'prj_001', assigneeId: 'TM', priority: 'high', status: 'in-progress', deadline: '2026-08-12T14:00', createdBy: 'HN', createdAt: '2026-08-09', progress: 30, dailyTasks: [
      { date: '2026-08-11', progress: 30, note: 'Đã làm slide 1-5', done: true },
      { date: '2026-08-12', progress: 0, note: '', done: false }
    ]},
    { id: 'task_003', title: 'Code review - Authentication module', description: 'Kiểm tra code module đăng nhập', projectId: 'prj_005', assigneeId: 'GP', priority: 'medium', status: 'pending', deadline: '2026-08-12T15:00', createdBy: 'HQ', createdAt: '2026-08-08', progress: 0, dailyTasks: [] },
    { id: 'task_004', title: 'Quản lý social media', description: 'Đăng bài lên fanpage và Instagram', projectId: 'prj_006', assigneeId: 'TM', priority: 'low', status: 'in-progress', deadline: '2026-08-12T16:30', createdBy: 'HN', createdAt: '2026-08-07', progress: 50, dailyTasks: [
      { date: '2026-08-11', progress: 25, note: 'Đăng 2 bài lên fanpage', done: true },
      { date: '2026-08-12', progress: 25, note: 'Đăng story Instagram', done: false }
    ]},
    { id: 'task_005', title: 'Visual design review', description: 'Review thiết kế visual cho website', projectId: 'prj_005', assigneeId: 'GP', priority: 'low', status: 'pending', deadline: '2026-08-12T17:00', createdBy: 'TM', createdAt: '2026-08-06', progress: 0, dailyTasks: [] }
  ];

  // Default proposals
  var DEFAULT_PROPOSALS = [
    { id: 'prop_001', title: 'Mua thêm máy tính cho team design', description: 'Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D', type: 'mua-sam', status: 'pending', requesterId: 'HN', reviewerId: 'HQ', amount: 50000000, createdAt: '2026-08-10' },
    { id: 'prop_002', title: 'Đăng ký khóa học SketchUp nâng cao', description: 'Khóa học online cho 3 thành viên', type: 'dao-tao', status: 'approved', requesterId: 'GP', reviewerId: 'HN', amount: 15000000, createdAt: '2026-08-05' },
    { id: 'prop_003', title: 'Sửa chữa máy chiếu phòng họp', description: 'Máy chiếu bị hỏng cần mang đi sửa', type: 'sua-chua', status: 'rejected', requesterId: 'NT', reviewerId: 'HQ', amount: 3000000, createdAt: '2026-08-01' }
  ];

  // Storage keys
  var STORAGE_KEYS = {
    projects: 'hiconique_projects',
    tasks: 'hiconique_tasks',
    members: 'hiconique_members',
    proposals: 'hiconique_proposals',
    settings: 'hiconique_settings'
  };

  // Cache for Google Sheets data
  var gsCache = {
    projects: null,
    tasks: null,
    members: null,
    proposals: null,
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
    var total = 4;
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

    // Storage
    STORAGE_KEYS: STORAGE_KEYS,

    // Sync helpers
    refreshFromGSheets: refreshFromGSheets,
    isUsingGSheets: isUsingGSheets
  };
})();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskManager;
}
