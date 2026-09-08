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
    documents: { add: 'addDocument', update: 'updateDocument', delete: 'deleteDocument' },
    payslips: { add: 'addPayslip', update: 'updatePayslip', delete: 'deletePayslip' },
    commissions: { add: 'addCommission', update: 'updateCommission', delete: 'deleteCommission' },
    commissionRates: { add: 'addCommissionRate', update: 'updateCommissionRate', delete: 'deleteCommissionRate' }
  };

  var apiAction = actionMap[type] ? actionMap[type][action] : null;
  if (!apiAction) return;

  callGSheetsAPI(apiAction, data, id);
}

// Payslips/Commissions/CommissionRates are brand-new sheets with no CSV
// publish gid available yet, so they're read straight from the Apps Script
// Web App (JSON) instead of the CSV-publish path used for the older sheets.
function fetchFromAPI(action, callback) {
  if (!isUsingGSheets() || !GSHEETS_CONFIG.API_URL) { callback([]); return; }
  fetch(GSHEETS_CONFIG.API_URL + '?action=' + encodeURIComponent(action), { redirect: 'follow' })
    .then(function (r) { return r.json(); })
    .then(function (data) { callback(Array.isArray(data) ? data : []); })
    .catch(function (e) { console.error('GSheets API read failed:', e); callback([]); });
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
    docCategories: 'hiconique_doc_categories',
    payslips: 'hiconique_payslips',
    commissions: 'hiconique_commissions',
    commissionRates: 'hiconique_commission_rates'
  };

  // % hoa hồng mặc định theo vai trò — gợi ý khi tạo hoa hồng dự án, admin/
  // quản lý có thể chỉnh lại ở trang % Hoa hồng dự án.
  var DEFAULT_COMMISSION_RATES = [
    { id: 'crate_admin', roleLevel: 'admin', percent: 5, updatedAt: '2026-01-01' },
    { id: 'crate_manager', roleLevel: 'manager', percent: 3, updatedAt: '2026-01-01' },
    { id: 'crate_member', roleLevel: 'member', percent: 1, updatedAt: '2026-01-01' }
  ];

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
    var total = 11;
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
    getFromGSheets('payslips', function(payslips) {
      localStorage.setItem(STORAGE_KEYS.payslips, JSON.stringify(payslips));
      checkDone();
    });
    getFromGSheets('commissions', function(commissions) {
      localStorage.setItem(STORAGE_KEYS.commissions, JSON.stringify(commissions));
      checkDone();
    });
    getFromGSheets('commissionRates', function(rates) {
      if (rates.length > 0) {
        localStorage.setItem(STORAGE_KEYS.commissionRates, JSON.stringify(rates));
      }
      checkDone();
    });
  }

  // Get data from Google Sheets (all via the Apps Script Web App — see note
  // inside about why the old CSV publish path was removed).
  function getFromGSheets(type, callback) {
    var now = Date.now();
    // Cache for 30 seconds
    if (gsCache[type] && (now - gsCache.lastFetch) < 30000) {
      callback(gsCache[type]);
      return;
    }

    // ALL reads now go through the Apps Script Web App (JSON), which
    // translates the Sheet's Vietnamese headers AND value dropdowns back to
    // the English keys/values the client uses (FIELD_MAP + VALUE_MAP in
    // gsheets-api-v2.js). The old CSV publish-to-web path is intentionally
    // no longer used: raw CSV exposes the Vietnamese column names verbatim
    // (e.g. "Mã NV" instead of "id", "Còn làm việc" instead of "active"),
    // which silently broke every .id/.name/.status/.roleLevel lookup after
    // the Sheet was renamed to Vietnamese.
    var apiReadActions = {
      projects: 'getProjects', tasks: 'getTasks', members: 'getMembers',
      proposals: 'getProposals', timesheet: 'getTimesheet',
      notifications: 'getNotifications', notices: 'getNotices',
      documents: 'getDocuments', payslips: 'getPayslips',
      commissions: 'getCommissions', commissionRates: 'getCommissionRates'
    };
    var action = apiReadActions[type];
    if (!action) { callback([]); return; }
    fetchFromAPI(action, function (data) {
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
      getFromGSheets('payslips', function(payslips) {
        localStorage.setItem(STORAGE_KEYS.payslips, JSON.stringify(payslips));
      });
      getFromGSheets('commissions', function(commissions) {
        localStorage.setItem(STORAGE_KEYS.commissions, JSON.stringify(commissions));
      });
      getFromGSheets('commissionRates', function(rates) {
        localStorage.setItem(STORAGE_KEYS.commissionRates, JSON.stringify(rates.length > 0 ? rates : DEFAULT_COMMISSION_RATES));
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
      if (!localStorage.getItem(STORAGE_KEYS.payslips)) {
        localStorage.setItem(STORAGE_KEYS.payslips, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.commissions)) {
        localStorage.setItem(STORAGE_KEYS.commissions, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.commissionRates)) {
        localStorage.setItem(STORAGE_KEYS.commissionRates, JSON.stringify(DEFAULT_COMMISSION_RATES));
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

  // Chỉ CEO/quản lý được tạo, sửa, xoá dự án — thành viên chỉ xem.
  function createProject(project, user) {
    user = user || getCurrentUser();
    if (!canManageNotifications(user)) return null;
    project.status = project.status || 'on-track';
    project.progress = project.progress || 0;
    var newProject = add(STORAGE_KEYS.projects, project);
    // Sync to Google Sheets
    syncToGSheets('projects', 'add', newProject);
    return newProject;
  }

  function updateProject(id, updates, user) {
    user = user || getCurrentUser();
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.projects, id, updates);
    // Sync to Google Sheets
    if (updated) syncToGSheets('projects', 'update', updates, id);
    return updated;
  }

  function deleteProject(id, user) {
    user = user || getCurrentUser();
    if (!canManageNotifications(user)) return null;
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

  // Self-service profile edit (trang Thông tin cá nhân) — chỉ cho phép sửa
  // các trường không nhạy cảm về quyền hạn (không cho đổi role/roleLevel/email
  // qua đường này). Chủ tài khoản luôn sửa được hồ sơ của chính mình; CEO/Manager
  // sửa được hồ sơ người khác.
  var MEMBER_SELF_EDIT_FIELDS = ['dob', 'gender', 'cccd', 'phone', 'hometown', 'bank', 'bankAccount', 'password', 'deviceIds'];
  function updateMember(id, updates, user) {
    if (!user) return null;
    var isSelf = user.id === id;
    if (!isSelf && !canManageNotifications(user)) return null;
    var safeUpdates = {};
    MEMBER_SELF_EDIT_FIELDS.forEach(function (k) {
      if (updates[k] !== undefined) safeUpdates[k] = updates[k];
    });
    var updated = update(STORAGE_KEYS.members, id, safeUpdates);
    if (updated) syncToGSheets('members', 'update', safeUpdates, id);
    return updated;
  }

  // Chống chấm công hộ (kiểu 2) — mỗi thành viên tự "đăng ký" tối đa 2 thiết
  // bị (deviceId sinh ngẫu nhiên, lưu ở localStorage của trình duyệt, xem
  // getOrCreateDeviceId() trong timesheet.html — web không có cách nào đọc
  // ID phần cứng thật). Lưu dạng chuỗi "id1,id2" trong 1 cột `deviceIds` của
  // Members (cần tự thêm cột này vào Sheet mới đồng bộ được, xem
  // GHI_CHU_DU_AN.md — code vẫn hoạt động cache-only nếu chưa có cột).
  var MAX_MEMBER_DEVICES = 2;
  function parseDeviceIds(member) {
    return String((member && member.deviceIds) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function getMemberDeviceIds(memberId) {
    return parseDeviceIds(getMember(memberId));
  }

  // Trả về { ok, isNew, full }. full=true nghĩa là deviceId lạ nhưng đã đủ
  // MAX_MEMBER_DEVICES thiết bị — caller (UI) tự quyết định cảnh báo/hỏi lại,
  // hàm này không tự chặn.
  function registerMemberDevice(memberId, deviceId, user) {
    var member = getMember(memberId);
    if (!member || !deviceId) return { ok: false, isNew: false, full: false };
    var ids = parseDeviceIds(member);
    if (ids.indexOf(deviceId) !== -1) return { ok: true, isNew: false, full: false };
    if (ids.length >= MAX_MEMBER_DEVICES) return { ok: false, isNew: false, full: true };
    ids.push(deviceId);
    updateMember(memberId, { deviceIds: ids.join(',') }, user);
    return { ok: true, isNew: true, full: false };
  }

  function removeMemberDevice(memberId, deviceId, user) {
    var member = getMember(memberId);
    if (!member) return null;
    var ids = parseDeviceIds(member).filter(function (id) { return id !== deviceId; });
    return updateMember(memberId, { deviceIds: ids.join(',') }, user);
  }

  // Duyệt/từ chối thành viên đăng ký mới: CEO hoặc Manager.
  function canManageMembers(user) {
    return !!user && (user.roleLevel === 'admin' || user.roleLevel === 'manager');
  }

  // Ngưng công tác / khôi phục thành viên: chỉ CEO.
  function canTerminateMembers(user) {
    return !!user && user.roleLevel === 'admin';
  }

  // status: 'active' (duyệt / khôi phục), 'rejected' (từ chối), 'inactive' (ngưng công tác).
  // Duyệt/từ chối một tài khoản đang "pending" chỉ cần Manager+; ngưng công tác hoặc
  // khôi phục một tài khoản đã "inactive" bắt buộc phải là CEO.
  function updateMemberStatus(id, status, user) {
    var member = getMember(id);
    if (!member) return null;
    var isTerminateAction = status === 'inactive' || member.status === 'inactive';
    var allowed = isTerminateAction ? canTerminateMembers(user) : canManageMembers(user);
    if (!allowed) return null;
    var updated = update(STORAGE_KEYS.members, id, { status: status });
    if (updated) syncToGSheets('members', 'update', { status: status }, id);
    return updated;
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

    // Sinh nhật thành viên — lịch nhắc mặc định, không cần tạo tay trên
    // Notifications sheet: so khớp tháng-ngày của Members.dob (bỏ qua năm),
    // báo trước 1 ngày VÀ đúng ngày sinh nhật, hiện cho tất cả (scope 'all')
    // để cả team biết mà gửi lời chúc. Tính lại mỗi lần mở app, không lưu.
    var todayMD = today.slice(5);
    var tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    var tomorrowMD = tomorrowDate.toISOString().split('T')[0].slice(5);
    members.filter(function (m) { return m.dob; }).forEach(function (m) {
      var dobMD = String(m.dob).slice(5, 10);
      if (dobMD === todayMD) {
        alerts.push({ id: 'alert_birthday_today_' + m.id + '_' + today, title: '🎂 Sinh nhật hôm nay', message: m.name + ' sinh nhật hôm nay — gửi lời chúc nhé!', type: 'birthday', level: 'info', createdAt: today });
      } else if (dobMD === tomorrowMD) {
        alerts.push({ id: 'alert_birthday_soon_' + m.id + '_' + today, title: 'Sinh nhật sắp tới', message: m.name + ' sinh nhật vào ngày mai.', type: 'birthday', level: 'info', createdAt: today });
      }
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

  function getMonthlyTimesheetStats(memberId, month) {
    // month: 'YYYY-MM'
    var parts = String(month).split('-');
    var entries = getTimesheetEntries({ memberId: memberId, year: parts[0], month: parts[1] });
    var workDays = 0, totalHours = 0, overtimeHours = 0;
    entries.forEach(function (e) {
      if (e.checkoutTime) {
        workDays++;
        totalHours += parseFloat(e.totalHours) || 0;
        overtimeHours += parseFloat(e.overtimeHours) || 0;
      }
    });
    return { workDays: workDays, totalHours: totalHours, overtimeHours: overtimeHours };
  }

  // Lương cơ bản — chỉ admin/quản lý được sửa (không cho tự sửa lương của mình).
  function setMemberBaseSalary(id, baseSalary, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.members, id, { baseSalary: baseSalary });
    if (updated) syncToGSheets('members', 'update', { baseSalary: baseSalary }, id);
    return updated;
  }

  // % Hoa hồng dự án theo vai trò — cấu hình mặc định, admin/quản lý chỉnh được.
  function getCommissionRates() {
    return getAll(STORAGE_KEYS.commissionRates);
  }

  function getCommissionRateFor(roleLevel) {
    var found = getCommissionRates().find(function (r) { return r.roleLevel === roleLevel; });
    return found ? (Number(found.percent) || 0) : 0;
  }

  function saveCommissionRate(roleLevel, percent, user) {
    if (!canManageNotifications(user)) return null;
    var existing = getCommissionRates().find(function (r) { return r.roleLevel === roleLevel; });
    if (existing) {
      var updated = update(STORAGE_KEYS.commissionRates, existing.id, { percent: percent });
      if (updated) syncToGSheets('commissionRates', 'update', { percent: percent }, existing.id);
      return updated;
    }
    var created = add(STORAGE_KEYS.commissionRates, { roleLevel: roleLevel, percent: percent });
    syncToGSheets('commissionRates', 'add', created);
    return created;
  }

  // Hoa hồng dự án — mỗi dòng là hoa hồng của 1 thành viên trên 1 dự án, cho 1 tháng.
  function getCommissions(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.commissions);
    if (filters.projectId) list = list.filter(function (c) { return c.projectId === filters.projectId; });
    if (filters.memberId) list = list.filter(function (c) { return c.memberId === filters.memberId; });
    if (filters.month) list = list.filter(function (c) { return c.month === filters.month; });
    return list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function createCommission(data, user) {
    if (!canManageNotifications(user)) return null;
    var created = add(STORAGE_KEYS.commissions, data);
    syncToGSheets('commissions', 'add', created);
    return created;
  }

  function updateCommission(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.commissions, id, updates);
    if (updated) syncToGSheets('commissions', 'update', updates, id);
    return updated;
  }

  function deleteCommission(id, user) {
    if (!canManageNotifications(user)) return null;
    var result = remove(STORAGE_KEYS.commissions, id);
    syncToGSheets('commissions', 'delete', {}, id);
    return result;
  }

  function getMemberCommissionTotal(memberId, month) {
    return getCommissions({ memberId: memberId, month: month }).reduce(function (sum, c) {
      return sum + (Number(c.amount) || 0);
    }, 0);
  }

  // Phiếu lương — nhân viên tự tạo cho chính mình mỗi tháng, CEO/quản lý duyệt.
  var OT_MULTIPLIER = 1.5;
  var STANDARD_MONTHLY_HOURS = 208; // 26 công x 8 giờ/ngày — quy ước tính đơn giá giờ OT

  function getPayslips(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.payslips);
    if (filters.memberId) list = list.filter(function (p) { return p.memberId === filters.memberId; });
    if (filters.month) list = list.filter(function (p) { return p.month === filters.month; });
    if (filters.status) list = list.filter(function (p) { return p.status === filters.status; });
    return list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function getPayslip(id) {
    return getById(STORAGE_KEYS.payslips, id);
  }

  function createPayslip(payslip) {
    payslip.status = 'pending';
    var created = add(STORAGE_KEYS.payslips, payslip);
    syncToGSheets('payslips', 'add', created);
    return created;
  }

  function updatePayslip(id, updates) {
    var updated = update(STORAGE_KEYS.payslips, id, updates);
    if (updated) syncToGSheets('payslips', 'update', updates, id);
    return updated;
  }

  function approvePayslip(id, user) {
    if (!canManageNotifications(user)) return null;
    return updatePayslip(id, { status: 'approved', reviewedAt: new Date().toISOString(), reviewerId: user.id });
  }

  function rejectPayslip(id, user) {
    if (!canManageNotifications(user)) return null;
    return updatePayslip(id, { status: 'rejected', reviewedAt: new Date().toISOString(), reviewerId: user.id });
  }

  // Chỉ chủ phiếu (hoặc quản lý) xoá được, và chỉ khi còn ở trạng thái chờ duyệt.
  function deletePayslip(id, user) {
    var slip = getPayslip(id);
    if (!slip || !user) return null;
    var isOwner = slip.memberId === user.id;
    if (!isOwner && !canManageNotifications(user)) return null;
    if (slip.status !== 'pending') return null;
    var result = remove(STORAGE_KEYS.payslips, id);
    syncToGSheets('payslips', 'delete', {}, id);
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
    updateMember: updateMember,
    getMemberDeviceIds: getMemberDeviceIds,
    registerMemberDevice: registerMemberDevice,
    removeMemberDevice: removeMemberDevice,
    canManageMembers: canManageMembers,
    canTerminateMembers: canTerminateMembers,
    updateMemberStatus: updateMemberStatus,

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

    // Lương cơ bản (Members.baseSalary)
    setMemberBaseSalary: setMemberBaseSalary,

    // % Hoa hồng dự án
    getCommissionRates: getCommissionRates,
    getCommissionRateFor: getCommissionRateFor,
    saveCommissionRate: saveCommissionRate,
    getCommissions: getCommissions,
    createCommission: createCommission,
    updateCommission: updateCommission,
    deleteCommission: deleteCommission,
    getMemberCommissionTotal: getMemberCommissionTotal,

    // Phiếu lương
    getMonthlyTimesheetStats: getMonthlyTimesheetStats,
    getPayslips: getPayslips,
    getPayslip: getPayslip,
    createPayslip: createPayslip,
    updatePayslip: updatePayslip,
    approvePayslip: approvePayslip,
    rejectPayslip: rejectPayslip,
    deletePayslip: deletePayslip,
    OT_MULTIPLIER: OT_MULTIPLIER,
    STANDARD_MONTHLY_HOURS: STANDARD_MONTHLY_HOURS,

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
