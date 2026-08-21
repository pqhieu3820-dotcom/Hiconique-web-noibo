/**
 * Google Apps Script - HICONIQUE Task Manager API
 *
 * Cách deploy:
 * 1. Vào https://script.google.com
 * 2. Tạo project mới
 * 3. Dán toàn bộ code này vào
 * 4. Chạy lần đầu để cấp quyền
 * 5. Deploy > New deployment
 * 6. Chọn "Web app"
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone"
 * 9. Copy URL và paste vào gsheets-config.js
 */

// ============= CONFIG =============
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Thay bằng Spreadsheet ID của bạn

// Tên các sheets
const SHEETS = {
  PROJECTS: 'Projects',
  TASKS: 'Tasks',
  MEMBERS: 'Members',
  PROPOSALS: 'Proposals'
};

// ============= HELPERS =============
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Add headers
    const headers = getHeaders(sheetName);
    if (headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function getHeaders(sheetName) {
  switch(sheetName) {
    case SHEETS.PROJECTS:
      return ['id', 'name', 'type', 'color', 'progress', 'status', 'members', 'createdAt'];
    case SHEETS.TASKS:
      return ['id', 'title', 'description', 'projectId', 'assigneeId', 'priority', 'status', 'deadline', 'createdBy', 'createdAt'];
    case SHEETS.MEMBERS:
      return ['id', 'name', 'role', 'color', 'avatar'];
    case SHEETS.PROPOSALS:
      return ['id', 'title', 'description', 'type', 'status', 'requesterId', 'reviewerId', 'amount', 'createdAt', 'reviewedAt'];
    default:
      return [];
  }
}

function getAllData(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, getHeaders(sheetName).length).getValues();
  const headers = getHeaders(sheetName);

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

function getDataById(sheetName, id) {
  const all = getAllData(sheetName);
  return all.find(row => row.id === id);
}

function addData(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);

  // Generate ID
  const prefix = sheetName.toLowerCase().substring(0, 3);
  data.id = prefix + '_' + Date.now();
  data.createdAt = new Date().toISOString().split('T')[0];

  const row = headers.map(h => {
    const val = data[h];
    if (Array.isArray(val)) return JSON.stringify(val);
    return val || '';
  });

  sheet.appendRow(row);
  return data;
}

function updateData(sheetName, id, updates) {
  const all = getAllData(sheetName);
  const index = all.findIndex(row => row.id === id);
  if (index === -1) return null;

  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const rowNum = index + 2; // +2 because header is row 1, data starts at row 2

  updates.updatedAt = new Date().toISOString();

  headers.forEach((h, i) => {
    if (updates[h] !== undefined) {
      let val = updates[h];
      if (Array.isArray(val)) val = JSON.stringify(val);
      sheet.getRange(rowNum, i + 1).setValue(val || '');
    }
  });

  return { ...all[index], ...updates };
}

function deleteData(sheetName, id) {
  const all = getAllData(sheetName);
  const index = all.findIndex(row => row.id === id);
  if (index === -1) return false;

  const sheet = getSheet(sheetName);
  sheet.deleteRow(index + 2);
  return true;
}

// ============= API HANDLERS =============
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
    const sheetName = params.sheet;

    let result;

    switch(action) {
      case 'list':
        result = getAllData(sheetName);
        break;
      case 'get':
        result = getDataById(sheetName, params.id);
        break;
      case 'add':
        const newData = JSON.parse(params.data || '{}');
        result = addData(sheetName, newData);
        break;
      case 'update':
        const updateData_ = JSON.parse(params.data || '{}');
        result = updateData(sheetName, params.id, updateData_);
        break;
      case 'delete':
        result = deleteData(sheetName, params.id);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============= INITIALIZE DEFAULT DATA =============
function initializeDefaultData() {
  // Members
  const membersSheet = getSheet(SHEETS.MEMBERS);
  if (membersSheet.getLastRow() < 2) {
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
  }

  // Projects
  const projectsSheet = getSheet(SHEETS.PROJECTS);
  if (projectsSheet.getLastRow() < 2) {
    const projects = [
      ['prj_001', 'Vinhouse Mỹ Đình', 'Thiết kế nội thất', '#B08D57', 65, 'on-track', '["HQ","HN","PH"]', '2026-07-15'],
      ['prj_002', 'Penthouse HP', 'Triển khai bản vẽ', '#3B6B8C', 40, 'on-track', '["HN","PH"]', '2026-07-20'],
      ['prj_003', 'Biệt thự Đà Lạt', 'Thi công nội thất', '#B8725A', 91, 'on-track', '["PH","TM"]', '2026-06-01'],
      ['prj_004', 'Showroom HCM', 'Concept 3D', '#4F6F52', 24, 'on-track', '["GP"]', '2026-08-01'],
      ['prj_005', 'Risk Project', 'Thiết kế web', '#A04848', 30, 'at-risk', '["TM"]', '2026-07-10'],
      ['prj_006', '20 Landing page', 'Web design', '#C7A464', 85, 'on-track', '["TM","GP"]', '2026-06-15']
    ];
    projects.forEach(p => projectsSheet.appendRow(p));
  }

  // Tasks
  const tasksSheet = getSheet(SHEETS.TASKS);
  if (tasksSheet.getLastRow() < 2) {
    const tasks = [
      ['task_001', 'Review design mockups cho Vinhouse', 'Kiểm tra và phản hồi bản mockup mới nhất', 'prj_001', 'HN', 'high', 'pending', '2026-08-12T11:00', 'HQ', '2026-08-10'],
      ['task_002', 'Chuẩn bị presentation khách hàng', 'Slide trình bày cho buổi họp với khách hàng', 'prj_001', 'TM', 'high', 'in-progress', '2026-08-12T14:00', 'HN', '2026-08-09'],
      ['task_003', 'Code review - Authentication module', 'Kiểm tra code module đăng nhập', 'prj_005', 'GP', 'medium', 'pending', '2026-08-12T15:00', 'HQ', '2026-08-08'],
      ['task_004', 'Quản lý social media', 'Đăng bài lên fanpage và Instagram', 'prj_006', 'TM', 'low', 'in-progress', '2026-08-12T16:30', 'HN', '2026-08-07'],
      ['task_005', 'Visual design review', 'Review thiết kế visual cho website', 'prj_005', 'GP', 'low', 'pending', '2026-08-12T17:00', 'TM', '2026-08-06']
    ];
    tasks.forEach(t => tasksSheet.appendRow(t));
  }

  // Proposals
  const proposalsSheet = getSheet(SHEETS.PROPOSALS);
  if (proposalsSheet.getLastRow() < 2) {
    const proposals = [
      ['prop_001', 'Mua thêm máy tính cho team design', 'Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D', 'mua-sam', 'pending', 'HN', 'HQ', 50000000, '2026-08-10', ''],
      ['prop_002', 'Đăng ký khóa học SketchUp nâng cao', 'Khóa học online cho 3 thành viên', 'dao-tao', 'approved', 'GP', 'HN', 15000000, '2026-08-05', '2026-08-06'],
      ['prop_003', 'Sửa chữa máy chiếu phòng họp', 'Máy chiếu bị hỏng cần mang đi sửa', 'sua-chua', 'rejected', 'NT', 'HQ', 3000000, '2026-08-01', '2026-08-02']
    ];
    proposals.forEach(p => proposalsSheet.appendRow(p));
  }

  return 'Initialized successfully!';
}
