/**
 * HICONIQUE Task Manager - Auto Setup Script
 *
 * Cách sử dụng:
 * 1. Vào https://script.google.com
 * 2. Tạo project mới
 * 3. Dán toàn bộ code này vào
 * 4. Chạy hàm createMonthlySheet() một lần
 * 5. Deploy thành Web App để web truy cập
 *
 * Script này sẽ tự động:
 * - Tạo file Google Sheet mới trong Drive của bạn
 * - Tạo các tab theo tháng (Tasks_08_2026, Projects_08_2026, v.v.)
 * - Đồng bộ dữ liệu từ localStorage (nếu có)
 */

function createMonthlySheet() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const sheetName = `HICONIQUE_TaskManager_${month}_${year}`;

  // Tạo spreadsheet mới
  const ss = SpreadsheetApp.create(sheetName);

  // Log để debug
  Logger.log(`Created: ${ss.getUrl()}`);
  Logger.log(`ID: ${ss.getId()}`);

  // Tạo các sheets
  const months = [
    'Projects', 'Tasks', 'Members', 'Proposals'
  ];

  months.forEach(name => {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    setupSheetHeaders(sheet, name);
  });

  // Thêm dữ liệu mẫu
  addDefaultData(ss);

  // Tạo trigger để tự động chạy mỗi tháng
  createMonthlyTrigger();

  // Trả về thông tin
  return {
    url: ss.getUrl(),
    id: ss.getId(),
    name: sheetName
  };
}

function setupSheetHeaders(sheet, name) {
  let headers = [];

  switch(name) {
    case 'Projects':
      headers = ['id', 'name', 'type', 'color', 'progress', 'status', 'members', 'createdAt', 'updatedAt'];
      break;
    case 'Tasks':
      headers = ['id', 'title', 'description', 'projectId', 'assigneeId', 'priority', 'status', 'deadline', 'createdBy', 'createdAt', 'updatedAt'];
      break;
    case 'Members':
      headers = ['id', 'name', 'role', 'color', 'avatar'];
      break;
    case 'Proposals':
      headers = ['id', 'title', 'description', 'type', 'status', 'requesterId', 'reviewerId', 'amount', 'createdAt', 'reviewedAt'];
      break;
  }

  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function addDefaultData(ss) {
  // Members
  const membersSheet = ss.getSheetByName('Members');
  const members = [
    ['HQ', 'Trần Minh Quân', 'CEO', '#B08D57', 'HQ'],
    ['HN', 'Nguyễn Hiếu', 'Trưởng phòng Thiết kế', '#8E7CC3', 'HN'],
    ['PH', 'Phạm Hoàng', 'Giám sát thi công', '#C7A464', 'PH'],
    ['TM', 'Trần Mạnh', 'Truyền thông', '#4F6F52', 'TM'],
    ['GP', 'Giản Phương', 'Thiết kế đồ họa', '#3B6B8C', 'GP'],
    ['LT', 'Lê Thành', 'Kỹ sư nội thất', '#B8725A', 'LT'],
    ['NT', 'Ngọc Trang', 'Nhân sự', '#6B5B95', 'NT'],
    ['VH', 'Vũ Hùng', 'Kế toán', '#88B04B', 'VH'],
    ['DN', 'Đỗ Nam', 'Thiết kế nội thất', '#F7CAC9', 'DN'],
    ['QM', 'Quách Minh', 'Thi công', '#92A8D1', 'QM']
  ];
  members.forEach(m => membersSheet.appendRow(m));

  // Projects
  const projectsSheet = ss.getSheetByName('Projects');
  const projects = [
    ['prj_001', 'Vinhouse Mỹ Đình', 'Thiết kế nội thất', '#B08D57', 65, 'on-track', '["HQ","HN","PH"]', '2026-07-15', '2026-08-21'],
    ['prj_002', 'Penthouse HP', 'Triển khai bản vẽ', '#3B6B8C', 40, 'on-track', '["HN","PH"]', '2026-07-20', '2026-08-21'],
    ['prj_003', 'Biệt thự Đà Lạt', 'Thi công nội thất', '#B8725A', 91, 'on-track', '["PH","TM"]', '2026-06-01', '2026-08-21'],
    ['prj_004', 'Showroom HCM', 'Concept 3D', '#4F6F52', 24, 'on-track', '["GP"]', '2026-08-01', '2026-08-21'],
    ['prj_005', 'Risk Project', 'Thiết kế web', '#A04848', 30, 'at-risk', '["TM"]', '2026-07-10', '2026-08-21'],
    ['prj_006', '20 Landing page', 'Web design', '#C7A464', 85, 'on-track', '["TM","GP"]', '2026-06-15', '2026-08-21']
  ];
  projects.forEach(p => projectsSheet.appendRow(p));

  // Tasks
  const tasksSheet = ss.getSheetByName('Tasks');
  const tasks = [
    ['task_001', 'Review design mockups cho Vinhouse', 'Kiểm tra và phản hồi bản mockup mới nhất', 'prj_001', 'HN', 'high', 'pending', '2026-08-12T11:00', 'HQ', '2026-08-10', '2026-08-21'],
    ['task_002', 'Chuẩn bị presentation khách hàng', 'Slide trình bày cho buổi họp với khách hàng', 'prj_001', 'TM', 'high', 'in-progress', '2026-08-12T14:00', 'HN', '2026-08-09', '2026-08-21'],
    ['task_003', 'Code review - Authentication module', 'Kiểm tra code module đăng nhập', 'prj_005', 'GP', 'medium', 'pending', '2026-08-12T15:00', 'HQ', '2026-08-08', '2026-08-21'],
    ['task_004', 'Quản lý social media', 'Đăng bài lên fanpage và Instagram', 'prj_006', 'TM', 'low', 'in-progress', '2026-08-12T16:30', 'HN', '2026-08-07', '2026-08-21'],
    ['task_005', 'Visual design review', 'Review thiết kế visual cho website', 'prj_005', 'GP', 'low', 'pending', '2026-08-12T17:00', 'TM', '2026-08-06', '2026-08-21']
  ];
  tasks.forEach(t => tasksSheet.appendRow(t));

  // Proposals
  const proposalsSheet = ss.getSheetByName('Proposals');
  const proposals = [
    ['prop_001', 'Mua thêm máy tính cho team design', 'Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D', 'mua-sam', 'pending', 'HN', 'HQ', 50000000, '2026-08-10', ''],
    ['prop_002', 'Đăng ký khóa học SketchUp nâng cao', 'Khóa học online cho 3 thành viên', 'dao-tao', 'approved', 'GP', 'HN', 15000000, '2026-08-05', '2026-08-06'],
    ['prop_003', 'Sửa chữa máy chiếu phòng họp', 'Máy chiếu bị hỏng cần mang đi sửa', 'sua-chua', 'rejected', 'NT', 'HQ', 3000000, '2026-08-01', '2026-08-02']
  ];
  proposals.forEach(p => proposalsSheet.appendRow(p));
}

function createMonthlyTrigger() {
  // Xóa trigger cũ nếu có
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'autoArchiveMonth') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Tạo trigger mới - chạy vào ngày 1 mỗi tháng
  ScriptApp.newTrigger('autoArchiveMonth')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();
}

function autoArchiveMonth() {
  // Tự động chạy vào ngày 1 mỗi tháng
  // Có thể mở rộng để lưu trữ dữ liệu tháng cũ
  Logger.log('Auto archive running...');
}

// ============= WEB APP API =============

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let result;

    switch(action) {
      case 'getProjects':
        result = getAllData(ss, 'Projects');
        break;
      case 'getTasks':
        result = getAllData(ss, 'Tasks');
        break;
      case 'getMembers':
        result = getAllData(ss, 'Members');
        break;
      case 'getProposals':
        result = getAllData(ss, 'Proposals');
        break;
      case 'addTask':
        result = addData(ss, 'Tasks', JSON.parse(params.data));
        break;
      case 'updateTask':
        result = updateData(ss, 'Tasks', params.id, JSON.parse(params.data));
        break;
      case 'deleteTask':
        result = deleteData(ss, 'Tasks', params.id);
        break;
      case 'addProject':
        result = addData(ss, 'Projects', JSON.parse(params.data));
        break;
      case 'updateProject':
        result = updateData(ss, 'Projects', params.id, JSON.parse(params.data));
        break;
      case 'deleteProject':
        result = deleteData(ss, 'Projects', params.id);
        break;
      case 'addProposal':
        result = addData(ss, 'Proposals', JSON.parse(params.data));
        break;
      case 'updateProposal':
        result = updateData(ss, 'Proposals', params.id, JSON.parse(params.data));
        break;
      case 'getStats':
        const tasks = getAllData(ss, 'Tasks');
        const projects = getAllData(ss, 'Projects');
        const proposals = getAllData(ss, 'Proposals');
        result = {
          totalProjects: projects.length,
          completedTasks: tasks.filter(t => t.status === 'completed').length,
          pendingTasks: tasks.filter(t => t.status === 'pending').length,
          inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
          totalTasks: tasks.length,
          pendingProposals: proposals.filter(p => p.status === 'pending').length
        };
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message, stack: err.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getAllData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  return data.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
      // Parse JSON arrays
      if (typeof row[i] === 'string' && row[i].startsWith('[')) {
        try { obj[h] = JSON.parse(row[i]); } catch(e) {}
      }
    });
    return obj;
  });
}

function addData(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const id = sheetName.toLowerCase() + '_' + Date.now();
  data.id = id;
  data.createdAt = new Date().toISOString().split('T')[0];

  const row = headers.map(h => {
    const val = data[h];
    if (Array.isArray(val)) return JSON.stringify(val);
    return val || '';
  });

  sheet.appendRow(row);
  return data;
}

function updateData(ss, sheetName, id, updates) {
  const sheet = ss.getSheetByName(sheetName);
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(row => row.id === id);

  if (index === -1) return { error: 'Not found' };

  const rowNum = index + 2;
  updates.updatedAt = new Date().toISOString();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  headers.forEach((h, i) => {
    if (updates[h] !== undefined) {
      let val = updates[h];
      if (Array.isArray(val)) val = JSON.stringify(val);
      sheet.getRange(rowNum, i + 1).setValue(val || '');
    }
  });

  return { ...data[index], ...updates };
}

function deleteData(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(row => row.id === id);

  if (index === -1) return false;

  sheet.deleteRow(index + 2);
  return true;
}
