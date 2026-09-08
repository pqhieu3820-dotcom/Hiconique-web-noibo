const SPREADSHEET_ID = '1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY';

const SHEETS = {
  projects: 'Projects',
  tasks: 'Tasks',
  members: 'Members',
  proposals: 'Proposals',
  timesheet: 'Timesheet',
  notifications: 'Notifications',
  notices: 'Notices',
  documents: 'Documents',
  payslips: 'Payslips',
  commissions: 'Commissions',
  commissionRates: 'CommissionRates'
};

// Reference schema only — used to seed headers on a brand-new empty sheet.
// Reads/writes always follow the sheet's ACTUAL header row (see getHeaders),
// so adding/reordering columns directly in Sheets never breaks sync.
const HEADERS = {
  projects: ['id', 'name', 'type', 'color', 'progress', 'status', 'members', 'createdAt', 'updatedAt', 'budget', 'client', 'investor', 'location', 'startDate', 'endDate', 'priority', 'description'],
  tasks: ['id', 'title', 'description', 'projectId', 'assigneeId', 'priority', 'status', 'startDate', 'deadline', 'createdBy', 'createdAt', 'updatedAt', 'progress', 'dailyTasks'],
  members: ['id', 'name', 'role', 'roleLevel', 'email', 'password', 'dob', 'cccd', 'phone', 'hometown', 'bank', 'bankAccount', 'color', 'avatar', 'createdAt', 'gender', 'baseSalary'],
  proposals: ['id', 'title', 'description', 'type', 'status', 'requesterId', 'reviewerId', 'amount', 'createdAt', 'reviewedAt'],
  timesheet: ['id', 'memberId', 'date', 'checkinTime', 'checkoutTime', 'totalHours', 'overtimeHours', 'status', 'note', 'checkinLat', 'checkinLng', 'checkinDistance', 'checkinIp', 'geoPass', 'ipPass', 'verifyPassCount', 'verifyStatus'],
  notifications: ['id', 'title', 'message', 'type', 'scope', 'recurring', 'recurRule', 'active', 'createdBy', 'createdAt', 'updatedAt'],
  notices: ['id', 'title', 'message', 'color', 'createdBy', 'createdAt', 'updatedAt'],
  documents: ['id', 'category', 'name', 'url', 'createdBy', 'createdAt', 'updatedAt'],
  // Phiếu lương tháng — nhân viên tự tạo, CEO/quản lý duyệt.
  payslips: ['id', 'memberId', 'month', 'workDays', 'totalHours', 'otHoursAuto', 'otHoursManual', 'otHours', 'otRate', 'otAmount', 'baseSalary', 'commissionAmount', 'otherBonus', 'otherBonusNote', 'deduction', 'deductionNote', 'totalAmount', 'status', 'note', 'createdBy', 'createdAt', 'updatedAt', 'reviewedAt', 'reviewerId'],
  // Hoa hồng dự án theo từng thành viên (tính từ % x giá trị dự án).
  commissions: ['id', 'projectId', 'memberId', 'projectValue', 'percent', 'amount', 'month', 'note', 'createdBy', 'createdAt', 'updatedAt'],
  // % hoa hồng mặc định theo vai trò (admin/manager/member) — dùng để gợi ý khi tạo hoa hồng dự án.
  commissionRates: ['id', 'roleLevel', 'percent', 'updatedAt']
};

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let result;

    if (action === 'getProjects') {
      result = getAllData(ss, SHEETS.projects);
    } else if (action === 'getTasks') {
      result = getAllData(ss, SHEETS.tasks);
    } else if (action === 'getMembers') {
      result = getAllData(ss, SHEETS.members);
    } else if (action === 'getProposals') {
      result = getAllData(ss, SHEETS.proposals);
    } else if (action === 'addProject') {
      result = addData(ss, SHEETS.projects, JSON.parse(params.data));
    } else if (action === 'addTask') {
      result = addData(ss, SHEETS.tasks, JSON.parse(params.data));
    } else if (action === 'addMember') {
      result = addData(ss, SHEETS.members, JSON.parse(params.data));
    } else if (action === 'addProposal') {
      result = addData(ss, SHEETS.proposals, JSON.parse(params.data));
    } else if (action === 'updateProject') {
      result = updateData(ss, SHEETS.projects, params.id, JSON.parse(params.data));
    } else if (action === 'updateTask') {
      result = updateData(ss, SHEETS.tasks, params.id, JSON.parse(params.data));
    } else if (action === 'updateMember') {
      result = updateData(ss, SHEETS.members, params.id, JSON.parse(params.data));
    } else if (action === 'updateProposal') {
      result = updateData(ss, SHEETS.proposals, params.id, JSON.parse(params.data));
    } else if (action === 'deleteProject') {
      result = deleteData(ss, SHEETS.projects, params.id);
    } else if (action === 'deleteTask') {
      result = deleteData(ss, SHEETS.tasks, params.id);
    } else if (action === 'deleteMember') {
      result = deleteData(ss, SHEETS.members, params.id);
    } else if (action === 'deleteProposal') {
      result = deleteData(ss, SHEETS.proposals, params.id);
    } else if (action === 'toggleTask') {
      const task = getDataById(ss, SHEETS.tasks, params.id);
      if (task) {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        result = updateData(ss, SHEETS.tasks, params.id, { status: newStatus });
      } else {
        result = { error: 'Task not found' };
      }
    } else if (action === 'approveProposal') {
      result = updateData(ss, SHEETS.proposals, params.id, { status: 'approved', reviewedAt: new Date().toISOString() });
    } else if (action === 'rejectProposal') {
      result = updateData(ss, SHEETS.proposals, params.id, { status: 'rejected', reviewedAt: new Date().toISOString() });
    } else if (action === 'getTimesheet') {
      result = getAllData(ss, SHEETS.timesheet);
    } else if (action === 'addTimesheet') {
      result = addData(ss, SHEETS.timesheet, JSON.parse(params.data));
    } else if (action === 'updateTimesheet') {
      result = updateData(ss, SHEETS.timesheet, params.id, JSON.parse(params.data));
    } else if (action === 'getNotifications') {
      result = getAllData(ss, SHEETS.notifications);
    } else if (action === 'addNotification') {
      result = addData(ss, SHEETS.notifications, JSON.parse(params.data));
    } else if (action === 'updateNotification') {
      result = updateData(ss, SHEETS.notifications, params.id, JSON.parse(params.data));
    } else if (action === 'deleteNotification') {
      result = deleteData(ss, SHEETS.notifications, params.id);
    } else if (action === 'getNotices') {
      result = getAllData(ss, SHEETS.notices);
    } else if (action === 'addNotice') {
      result = addData(ss, SHEETS.notices, JSON.parse(params.data));
    } else if (action === 'updateNotice') {
      result = updateData(ss, SHEETS.notices, params.id, JSON.parse(params.data));
    } else if (action === 'deleteNotice') {
      result = deleteData(ss, SHEETS.notices, params.id);
    } else if (action === 'getDocuments') {
      result = getAllData(ss, SHEETS.documents);
    } else if (action === 'addDocument') {
      result = addData(ss, SHEETS.documents, JSON.parse(params.data));
    } else if (action === 'updateDocument') {
      result = updateData(ss, SHEETS.documents, params.id, JSON.parse(params.data));
    } else if (action === 'deleteDocument') {
      result = deleteData(ss, SHEETS.documents, params.id);
    } else if (action === 'getPayslips') {
      result = getAllData(ss, SHEETS.payslips);
    } else if (action === 'addPayslip') {
      result = addData(ss, SHEETS.payslips, JSON.parse(params.data));
    } else if (action === 'updatePayslip') {
      result = updateData(ss, SHEETS.payslips, params.id, JSON.parse(params.data));
    } else if (action === 'deletePayslip') {
      result = deleteData(ss, SHEETS.payslips, params.id);
    } else if (action === 'getCommissions') {
      result = getAllData(ss, SHEETS.commissions);
    } else if (action === 'addCommission') {
      result = addData(ss, SHEETS.commissions, JSON.parse(params.data));
    } else if (action === 'updateCommission') {
      result = updateData(ss, SHEETS.commissions, params.id, JSON.parse(params.data));
    } else if (action === 'deleteCommission') {
      result = deleteData(ss, SHEETS.commissions, params.id);
    } else if (action === 'getCommissionRates') {
      result = getAllData(ss, SHEETS.commissionRates);
    } else if (action === 'addCommissionRate') {
      result = addData(ss, SHEETS.commissionRates, JSON.parse(params.data));
    } else if (action === 'updateCommissionRate') {
      result = updateData(ss, SHEETS.commissionRates, params.id, JSON.parse(params.data));
    } else if (action === 'deleteCommissionRate') {
      result = deleteData(ss, SHEETS.commissionRates, params.id);
    } else {
      result = { error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Real header row of the sheet — the single source of truth for column order/name.
function getHeaders(sheet) {
  if (sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

// Auto-creates the tab if it doesn't exist yet (e.g. Payslips/Commissions on
// first use) — addData then seeds its header row from HEADERS below.
function getOrCreateSheet(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function getAllData(ss, sheetName) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);
  return data.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      let val = row[i];
      if (typeof val === 'string' && val.startsWith('[')) {
        try { obj[h] = JSON.parse(val); } catch (e) { obj[h] = val; }
      } else {
        obj[h] = val;
      }
    });
    return obj;
  });
}

function getDataById(ss, sheetName, id) {
  return getAllData(ss, sheetName).find(function (row) { return row.id === id; });
}

// <prefix>_<yyMMdd>_<timestamp> — date prefix keeps ids sortable/scannable
// over years of growth without ever needing to reset the sheet.
function makeId(prefix) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyMMdd');
  return prefix + '_' + stamp + '_' + Date.now();
}

// Sheets auto-parses strings that look like dates (e.g. "2026-09") into real
// dates on write — via appendRow/setValue — REGARDLESS of the column's own
// number format (plain-text formatting only protects manual typing, not API
// writes). Fields like "month" ('YYYY-MM') are compared with exact string
// equality elsewhere, so a silent date-coercion breaks all of that filtering.
// A leading apostrophe is the standard Sheets trick to force literal text.
function forceTextIfDateLike(val) {
  if (typeof val === 'string' && /^\d{4}-\d{1,2}$/.test(val)) return "'" + val;
  return val;
}

function addData(ss, sheetName, data) {
  const sheet = getOrCreateSheet(ss, sheetName);
  let headers = getHeaders(sheet);
  // Brand-new empty sheet with no header row yet: seed it from the reference schema.
  if (headers.length === 0) {
    const schemaKey = Object.keys(HEADERS).filter(function (k) { return k.toLowerCase() === sheetName.toLowerCase(); })[0];
    headers = (schemaKey && HEADERS[schemaKey]) || Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  if (!data.id) {
    data.id = makeId(sheetName.toLowerCase().replace(/s$/, ''));
  }
  data.createdAt = data.createdAt || new Date().toISOString().split('T')[0];
  const row = headers.map(function (h) {
    const val = data[h];
    if (Array.isArray(val)) return JSON.stringify(val);
    return forceTextIfDateLike(val !== undefined && val !== null ? val : '');
  });
  sheet.appendRow(row);
  return data;
}

function updateData(ss, sheetName, id, updates) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = getHeaders(sheet);
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(function (row) { return row.id === id; });
  if (index === -1) return { error: 'Not found: ' + id };
  const rowNum = index + 2;
  if (headers.indexOf('updatedAt') !== -1) {
    updates.updatedAt = new Date().toISOString();
  }
  headers.forEach(function (h, i) {
    if (updates[h] !== undefined) {
      let val = updates[h];
      if (Array.isArray(val)) val = JSON.stringify(val);
      sheet.getRange(rowNum, i + 1).setValue(forceTextIfDateLike(val) || '');
    }
  });
  return Object.assign({}, data[index], updates);
}

function deleteData(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(function (row) { return row.id === id; });
  if (index === -1) return { error: 'Not found' };
  sheet.deleteRow(index + 2);
  return { success: true, deleted: id };
}

// Installable trigger (Triggers > Add Trigger > onEdit > From spreadsheet > On edit).
// When a Member's id cell is edited by hand in the Sheet, cascades the change to every
// other sheet that references that member id, so tasks/projects/timesheet/proposals
// stay linked instead of silently pointing at a now-nonexistent id.
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEETS.members) return;
    const headers = getHeaders(sheet);
    const col = e.range.getColumn();
    if (headers[col - 1] !== 'id') return;
    if (e.range.getRow() === 1) return; // header row itself

    const oldId = e.oldValue;
    const newId = e.value;
    if (!oldId || !newId || oldId === newId) return;

    cascadeMemberIdChange(oldId, newId);
  } catch (err) {
    // Never let a cascade failure block the user's manual edit.
  }
}

function cascadeMemberIdChange(oldId, newId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  replaceIdInColumn(ss, SHEETS.tasks, 'assigneeId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.tasks, 'createdBy', oldId, newId);
  replaceIdInColumn(ss, SHEETS.proposals, 'requesterId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.proposals, 'reviewerId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.timesheet, 'memberId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.payslips, 'memberId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.commissions, 'memberId', oldId, newId);
  replaceIdInListColumn(ss, SHEETS.projects, 'members', oldId, newId);
}

function replaceIdInColumn(ss, sheetName, headerName, oldId, newId) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(headerName);
  if (colIdx === -1) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = false;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === oldId) {
      values[i][0] = newId;
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

function replaceIdInListColumn(ss, sheetName, headerName, oldId, newId) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(headerName);
  if (colIdx === -1) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = false;
  for (let i = 0; i < values.length; i++) {
    const raw = values[i][0];
    if (!raw) continue;
    // Members lists show up as either a real JSON array (newer rows, written by
    // addData/updateData) or a plain comma-separated string (older seed rows).
    // Handle both, and write back in whichever shape the cell already used.
    let arr, isJson;
    try {
      arr = JSON.parse(raw);
      isJson = Array.isArray(arr);
    } catch (e2) {
      isJson = false;
    }
    if (!isJson) {
      arr = String(raw).split(',').map(function (s) { return s.trim(); });
    }
    const idx = arr.indexOf(oldId);
    if (idx !== -1) {
      arr[idx] = newId;
      values[i][0] = isJson ? JSON.stringify(arr) : arr.join(',');
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}
