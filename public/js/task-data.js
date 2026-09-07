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
    members: { add: 'addMember', update: 'updateMember', delete: 'deleteMember' },
    projects: { add: 'addProject', update: 'updateProject', delete: 'deleteProject' },
    tasks: { add: 'addTask', update: 'updateTask', delete: 'deleteTask', toggle: 'toggleTask' },
    proposals: { add: 'addProposal', update: 'updateProposal', delete: 'deleteProposal', approve: 'approveProposal', reject: 'rejectProposal' },
    timesheet: { add: 'addTimesheet', update: 'updateTimesheet' },
    notifications: { add: 'addNotification', update: 'updateNotification', delete: 'deleteNotification' },
    notices: { add: 'addNotice', update: 'updateNotice', delete: 'deleteNotice' },
    documents: { add: 'addDocument', update: 'updateDocument', delete: 'deleteDocument' }
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
    timesheet: 'hiconique_timesheet',
    notifications: 'hiconique_notifications',
    readNotifications: 'hiconique_read_notifications',
    notices: 'hiconique_notices',
    documents: 'hiconique_documents',
    docCategories: 'hiconique_doc_categories'
  };

  // Recurring notification rules — seeded once, editable by CEO from the bell panel.
  var DEFAULT_NOTIFICATIONS = [
    { id: 'notification_260101_1', title: 'Nhắc làm đề xuất thanh toán lương', message: 'Đầu tháng — vui lòng hoàn tất đề xuất thanh toán lương cho kỳ trước.', type: 'payroll', scope: 'all', recurring: true, recurRule: 'monthly:1-5', active: true, createdBy: 'CEO', createdAt: '2026-01-01' }
  ];

  // Notice board (public/pages/notices.html) — seeded from the page's original static content.
  // color: xanh (green, nhẹ) < vàng (yellow, trung bình) < đỏ (red, ưu tiên) < tím (purple, khẩn cấp)
  var DEFAULT_NOTICES = [
    { id: 'notice_260101_1', title: 'Nhắc nhở cuối tuần', message: 'Mọi người cập nhật bảng Google Sheets và sao lưu dữ liệu quan trọng trước khi kết thúc ngày làm việc nhé!', color: 'green', createdBy: 'CEO', createdAt: '2026-08-22' },
    { id: 'notice_260101_2', title: 'Họp team tháng 9', message: 'Bàn giao & cải tiến, review dự án đang chạy, kế hoạch tháng mới. Thứ Năm 07/09/2026 · 9:00–10:00.', color: 'yellow', createdBy: 'CEO', createdAt: '2026-08-25' },
    { id: 'notice_260101_3', title: 'Nhắc nhở: cập nhật phiếu lương tháng 9/2026', message: 'Mọi người vào cập nhật phiếu lương từ ngày 01–05 hàng tháng.', color: 'red', createdBy: 'CEO', createdAt: '2026-08-28' },
    { id: 'notice_260101_4', title: 'Bàn giao công trình Vinhouse', message: 'Buổi nghiệm thu cuối cùng dự kiến 30/08/2026. Mời các bộ phận liên quan đến công trường để hoàn tất checklist bàn giao.', color: 'yellow', createdBy: 'MGR2', createdAt: '2026-08-20' },
    { id: 'notice_260101_5', title: 'Lịch training nội bộ', message: 'HICONIQUE mở lớp training về quy trình SPC vào 20/08/2026. Đăng ký trước ngày 18/08.', color: 'green', createdBy: 'MGR1', createdAt: '2026-08-10' }
  ];

  // Wiki / document links (public/pages/wiki.html) — seeded from the page's original static links.
  var DEFAULT_DOCUMENTS = [
    { id: 'document_260101_1', category: 'Template chung', name: 'Hướng dẫn dàn trang bản vẽ', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_2', category: 'Template chung', name: 'Layout trình bày báo giá', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_3', category: 'Template chung', name: 'Template trình bày concept', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_9', category: 'Template chung', name: 'Bảng giá dịch vụ 2026', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_10', category: 'Template chung', name: 'Hợp đồng mẫu · TK · TC', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_4', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Bục ngồi gỗ · chiều cao 600–700 mm', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_5', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Tay vịn · chiều cao 850–950 mm', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_11', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Độ dày kính cường lực · an toàn', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_12', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Vật liệu bề mặt gỗ tự nhiên', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_13', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Đặc tính đá tự nhiên · marble', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_6', category: 'Sổ tay nhân sự', name: 'Quy trình onboarding · nhân viên mới', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_7', category: 'Sổ tay nhân sự', name: 'Chính sách làm việc & OT', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_14', category: 'Sổ tay nhân sự', name: 'Quy chế KPI & lương tháng', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_15', category: 'Sổ tay nhân sự', name: 'Đào tạo nội bộ · lịch học', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_8', category: 'Brand & Marketing', name: 'Logo, màu, font HICONIQUE', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_16', category: 'Brand & Marketing', name: 'Tone & voice thương hiệu', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_17', category: 'Brand & Marketing', name: 'Template bài viết mạng xã hội', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' }
  ];

  // Danh mục chung cho trang Tài liệu — quản lý riêng (thêm/xoá), không đi qua Google Sheets.
  var DEFAULT_DOC_CATEGORIES = ['Template chung', 'SPC · Quy chuẩn kỹ thuật', 'Sổ tay nhân sự', 'Brand & Marketing'];

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
    var total = 8;
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
    getFromGSheets('notifications', function(notifications) {
      if (notifications.length > 0) {
        localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
      }
      checkDone();
    });
    getFromGSheets('notices', function(notices) {
      if (notices.length > 0) {
        localStorage.setItem(STORAGE_KEYS.notices, JSON.stringify(notices));
      }
      checkDone();
    });
    getFromGSheets('documents', function(documents) {
      if (documents.length > 0) {
        localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents));
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
        // Parse booleans (Sheets exports checkbox/boolean cells as "TRUE"/"FALSE")
        if (val === 'TRUE' || val === 'FALSE') {
          val = (val === 'TRUE');
        }
        // Parse numbers
        else if (!isNaN(val) && val !== '' && h !== 'name' && h !== 'title' && h !== 'description' && h !== 'type' && h !== 'status') {
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
      case 'notifications': url = urls.NOTIFICATIONS; break;
      case 'notices': url = urls.NOTICES; break;
      case 'documents': url = urls.DOCUMENTS; break;
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
    // Danh mục tài liệu chỉ sống trong localStorage của từng máy (không qua Sheets).
    if (!localStorage.getItem(STORAGE_KEYS.docCategories)) {
      localStorage.setItem(STORAGE_KEYS.docCategories, JSON.stringify(DEFAULT_DOC_CATEGORIES));
    }
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
      getFromGSheets('notifications', function(notifications) {
        if (notifications.length > 0) {
          localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
        } else if (!localStorage.getItem(STORAGE_KEYS.notifications)) {
          localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(DEFAULT_NOTIFICATIONS));
        }
      });
      getFromGSheets('notices', function(notices) {
        if (notices.length > 0) {
          localStorage.setItem(STORAGE_KEYS.notices, JSON.stringify(notices));
        } else if (!localStorage.getItem(STORAGE_KEYS.notices)) {
          localStorage.setItem(STORAGE_KEYS.notices, JSON.stringify(DEFAULT_NOTICES));
        }
      });
      getFromGSheets('documents', function(documents) {
        if (documents.length > 0) {
          localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents));
        } else if (!localStorage.getItem(STORAGE_KEYS.documents)) {
          localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(DEFAULT_DOCUMENTS));
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
      if (!localStorage.getItem(STORAGE_KEYS.notifications)) {
        localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(DEFAULT_NOTIFICATIONS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.notices)) {
        localStorage.setItem(STORAGE_KEYS.notices, JSON.stringify(DEFAULT_NOTICES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.documents)) {
        localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(DEFAULT_DOCUMENTS));
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

  // <prefix>_<yyMMdd>_<timestamp> — date prefix keeps ids sortable/scannable
  // over years of growth without needing to reset the sheet.
  function makeId(prefix) {
    var d = new Date();
    var yy = String(d.getFullYear()).slice(-2);
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return prefix + '_' + yy + mm + dd + '_' + Date.now();
  }

  function add(key, item) {
    var items = getAll(key);
    var prefix = key.replace('hiconique_', '').replace(/s$/, '');
    item.id = makeId(prefix);
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

  // Notifications
  // Persisted items (announcements + recurring rule definitions) live in the
  // Notifications sheet. "Alerts" (overdue tasks, late check-in, an active
  // recurring rule for today) are computed on the fly and never written —
  // keeps the sheet small no matter how long the company runs on it.

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function canManageNotifications(user) {
    return !!user && (user.roleLevel === 'admin' || user.roleLevel === 'manager');
  }

  function canManageRecurringRules(user) {
    return !!user && user.roleLevel === 'admin';
  }

  // All persisted rows — used by the CEO/manager management panel.
  function getNotificationRules() {
    return getAll(STORAGE_KEYS.notifications);
  }

  // One-off announcements visible to a given user (scope 'all' or their own id).
  function getNotifications(user) {
    if (!user) return [];
    return getAll(STORAGE_KEYS.notifications).filter(function(n) {
      if (n.recurring) return false;
      if (n.active === false) return false;
      return n.scope === 'all' || n.scope === user.id;
    });
  }

  function createNotification(data, user) {
    if (!canManageNotifications(user)) return null;
    data.active = data.active !== false;
    data.createdBy = user.id;
    var newItem = add(STORAGE_KEYS.notifications, data);
    syncToGSheets('notifications', 'add', newItem);
    return newItem;
  }

  function updateNotification(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.notifications, id, updates);
    if (updated) syncToGSheets('notifications', 'update', updates, id);
    return updated;
  }

  function deleteNotification(id, user) {
    if (!canManageNotifications(user)) return false;
    var result = remove(STORAGE_KEYS.notifications, id);
    syncToGSheets('notifications', 'delete', {}, id);
    return result;
  }

  function parseRecurWindow(rule) {
    var m = /^monthly:(\d+)-(\d+)$/.exec(rule || '');
    if (!m) return null;
    return { from: parseInt(m[1], 10), to: parseInt(m[2], 10) };
  }

  function isRecurringActiveToday(rule) {
    if (!rule.recurring || rule.active === false) return false;
    var win = parseRecurWindow(rule.recurRule);
    if (!win) return false;
    var day = new Date().getDate();
    return day >= win.from && day <= win.to;
  }

  // Read/unread — per-device only, not synced (mark-as-read isn't shared data).
  function getReadIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.readNotifications) || '[]'); }
    catch (e) { return []; }
  }

  function markNotificationRead(id) {
    var ids = getReadIds();
    if (ids.indexOf(id) === -1) {
      ids.push(id);
      localStorage.setItem(STORAGE_KEYS.readNotifications, JSON.stringify(ids));
    }
  }

  function markAllNotificationsRead(ids) {
    var read = getReadIds();
    ids.forEach(function(id) { if (read.indexOf(id) === -1) read.push(id); });
    localStorage.setItem(STORAGE_KEYS.readNotifications, JSON.stringify(read));
  }

  function isNotificationRead(id) {
    return getReadIds().indexOf(id) !== -1;
  }

  // Live alerts derived from current data — never persisted.
  function getComputedAlerts(user) {
    if (!user) return [];
    var alerts = [];
    var today = todayStr();
    var members = getAll(STORAGE_KEYS.members);

    // Task deadlines assigned to this user
    getAll(STORAGE_KEYS.tasks).filter(function(t) {
      return t.assigneeId === user.id && t.status !== 'completed' && t.deadline;
    }).forEach(function(t) {
      var overdue = new Date(t.deadline) < new Date();
      var dueToday = (t.deadline.split('T')[0] === today);
      if (overdue) {
        alerts.push({ id: 'alert_overdue_' + t.id, title: 'Việc quá hạn', message: t.title, type: 'task', level: 'danger', createdAt: t.deadline });
      } else if (dueToday) {
        alerts.push({ id: 'alert_duetoday_' + t.id, title: 'Việc đến hạn hôm nay', message: t.title, type: 'task', level: 'warning', createdAt: t.deadline });
      }
    });

    // Late check-in — self always, team view for CEO/manager
    var LATE_THRESHOLD = '08:30';
    var canSeeTeam = canManageNotifications(user);
    getAll(STORAGE_KEYS.timesheet).filter(function(e) {
      return e.date === today && e.checkinTime && e.checkinTime > LATE_THRESHOLD;
    }).forEach(function(e) {
      if (e.memberId !== user.id && !canSeeTeam) return;
      var m = members.filter(function(mm) { return mm.id === e.memberId; })[0];
      alerts.push({ id: 'alert_late_' + e.id, title: 'Chấm công trễ', message: (m ? m.name : e.memberId) + ' check-in lúc ' + e.checkinTime, type: 'checkin', level: 'warning', createdAt: today });
    });

    // Active recurring rules (e.g. payroll reminder days 1-5)
    getAll(STORAGE_KEYS.notifications).filter(function(n) {
      return isRecurringActiveToday(n) && (n.scope === 'all' || n.scope === user.id);
    }).forEach(function(n) {
      alerts.push({ id: 'alert_recur_' + n.id + '_' + today, title: n.title, message: n.message, type: n.type || 'system', level: 'info', createdAt: today, recurring: true });
    });

    return alerts;
  }

  // Notice board (public/pages/notices.html)
  function getNotices() {
    return getAll(STORAGE_KEYS.notices).sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
  }

  function createNotice(data, user) {
    if (!canManageNotifications(user)) return null;
    data.color = data.color || 'bronze';
    data.createdBy = user.id;
    var newItem = add(STORAGE_KEYS.notices, data);
    syncToGSheets('notices', 'add', newItem);
    return newItem;
  }

  function updateNotice(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.notices, id, updates);
    if (updated) syncToGSheets('notices', 'update', updates, id);
    return updated;
  }

  function deleteNotice(id, user) {
    if (!canManageNotifications(user)) return false;
    var result = remove(STORAGE_KEYS.notices, id);
    syncToGSheets('notices', 'delete', {}, id);
    return result;
  }

  // Wiki document links (public/pages/wiki.html)
  function getDocuments() {
    var docs = getAll(STORAGE_KEYS.documents);
    var byCategory = {};
    var order = [];
    docs.forEach(function(d) {
      if (!byCategory[d.category]) { byCategory[d.category] = []; order.push(d.category); }
      byCategory[d.category].push(d);
    });
    return order.map(function(cat) { return { category: cat, items: byCategory[cat] }; });
  }

  function createDocument(data, user) {
    if (!canManageNotifications(user)) return null;
    data.createdBy = user.id;
    var newItem = add(STORAGE_KEYS.documents, data);
    syncToGSheets('documents', 'add', newItem);
    return newItem;
  }

  function updateDocument(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.documents, id, updates);
    if (updated) syncToGSheets('documents', 'update', updates, id);
    return updated;
  }

  function deleteDocument(id, user) {
    if (!canManageNotifications(user)) return false;
    var result = remove(STORAGE_KEYS.documents, id);
    syncToGSheets('documents', 'delete', {}, id);
    return result;
  }

  // Danh mục chung (dropdown "Danh mục" khi thêm tài liệu) — CEO/Manager thêm/xoá được,
  // lưu riêng trong localStorage của máy (không đồng bộ qua Google Sheets).
  function getDocCategories() {
    var list = getAll(STORAGE_KEYS.docCategories);
    return list.slice().sort(function (a, b) { return a.localeCompare(b, 'vi'); });
  }

  function addDocCategory(name, user) {
    if (!canManageNotifications(user)) return null;
    name = String(name || '').trim();
    if (!name) return null;
    var list = getAll(STORAGE_KEYS.docCategories);
    var exists = list.some(function (c) { return c.toLowerCase() === name.toLowerCase(); });
    if (exists) return list;
    list.push(name);
    save(STORAGE_KEYS.docCategories, list);
    return list;
  }

  function deleteDocCategory(name, user) {
    if (!canManageNotifications(user)) return null;
    var list = getAll(STORAGE_KEYS.docCategories);
    var filtered = list.filter(function (c) { return c.toLowerCase() !== String(name || '').toLowerCase(); });
    save(STORAGE_KEYS.docCategories, filtered);
    return filtered;
  }

  // Mã tài liệu — [Phòng ban]-[Loại tài liệu]-[STT 3 số], STT tự tăng theo cặp
  // phòng ban+loại đã có, không phụ thuộc tài liệu bị xoá hay chưa (luôn tăng dần).
  function getNextDocCode(dept, type) {
    if (!dept || !type) return '';
    var prefix = dept + '-' + type + '-';
    var maxSeq = 0;
    getAll(STORAGE_KEYS.documents).forEach(function (d) {
      if (d.code && d.code.indexOf(prefix) === 0) {
        var seq = parseInt(d.code.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    var next = maxSeq + 1;
    return prefix + ('00' + next).slice(-3);
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

    // Notifications
    getNotifications: getNotifications,
    getNotificationRules: getNotificationRules,
    createNotification: createNotification,
    updateNotification: updateNotification,
    deleteNotification: deleteNotification,
    getComputedAlerts: getComputedAlerts,
    canManageNotifications: canManageNotifications,
    canManageRecurringRules: canManageRecurringRules,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    isNotificationRead: isNotificationRead,

    // Notice board
    getNotices: getNotices,
    createNotice: createNotice,
    updateNotice: updateNotice,
    deleteNotice: deleteNotice,

    // Wiki documents
    getDocuments: getDocuments,
    createDocument: createDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,
    getDocCategories: getDocCategories,
    addDocCategory: addDocCategory,
    deleteDocCategory: deleteDocCategory,
    getNextDocCode: getNextDocCode,

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
