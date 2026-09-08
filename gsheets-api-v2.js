const SPREADSHEET_ID = '1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY';

// Tab names on the live Sheet are Vietnamese (renamed by hand). Code below
// always reads/writes through FIELD_MAP so client JS keeps using English
// keys (m.title, m.status...) no matter what the Sheet's header text says.
const SHEETS = {
  projects: 'Dự án',
  tasks: 'Công việc',
  members: 'Thành viên',
  proposals: 'Đề xuất',
  timesheet: 'Chấm công',
  notifications: 'Thông báo',
  notices: 'Bảng tin',
  documents: 'Tài liệu',
  payslips: 'Phiếu lương',
  commissions: 'Hoa hồng dự án',
  commissionRates: 'Mức hoa hồng'
};

// [Vietnamese header on the Sheet, internal English key used by client JS].
// Order here is just the seed order for a brand-new empty sheet — reads/
// writes always follow whatever's ACTUALLY on the Sheet's header row (see
// getHeaders), matched against this table by the Vietnamese text. A column
// added by hand that isn't in this list still round-trips fine — it just
// keeps its Vietnamese name as the object key instead of getting an English
// alias, so existing client code (which never looks for it) is unaffected.
const FIELD_MAP = {
  members: [
    ['Mã NV', 'id'], ['Họ tên', 'name'], ['Chức vụ', 'role'], ['Cấp bậc', 'roleLevel'],
    ['Giới tính', 'gender'], ['Mail', 'email'], ['Mật khẩu', 'password'], ['Ngày sinh', 'dob'],
    ['SĐT', 'phone'], ['CCCD', 'cccd'], ['Quê quán', 'hometown'], ['Số tài khoản ngân hàng', 'bankAccount'],
    ['Ngân hàng thụ hưởng', 'bank'], ['Màu sắc đại diện', 'color'], ['Tên viết tắt đại diện', 'avatar'],
    ['Làm việc từ', 'createdAt'], ['Lương cơ bản', 'baseSalary'], ['Trạng thái', 'status']
  ],
  projects: [
    ['Mã DA', 'id'], ['Tên dự án', 'name'], ['Loại dự án', 'type'], ['Tiến độ', 'progress'],
    ['Trạng thái', 'status'], ['Thành viên tham gia', 'members'], ['Màu sắc đại diện', 'color'],
    ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt'], ['Ngân sách', 'budget'],
    ['Khách hàng', 'client'], ['Nhà đầu tư', 'investor'], ['Địa điểm', 'location'],
    ['Ngày bắt đầu', 'startDate'], ['Ngày kết thúc', 'endDate'], ['Mức độ ưu tiên', 'priority'],
    ['Mô tả', 'description']
  ],
  tasks: [
    ['Mã CV', 'id'], ['Tên công việc', 'title'], ['Mô tả', 'description'], ['Mã dự án', 'projectId'],
    ['Mã người phụ trách', 'assigneeId'], ['Mức độ ưu tiên', 'priority'], ['Trạng thái', 'status'],
    ['Ngày bắt đầu', 'startDate'], ['Ngày tới hạn deadline', 'deadline'], ['Người tạo', 'createdBy'],
    ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt'], ['Tiến độ', 'progress'],
    ['Update tiến độ việc hàng ngày', 'dailyTasks']
  ],
  proposals: [
    ['Mã ĐX', 'id'], ['Tiêu đề', 'title'], ['Nội dung', 'description'], ['Loại đề xuất', 'type'],
    ['Trạng thái', 'status'], ['Người đề xuất', 'requesterId'], ['Người phê duyệt', 'reviewerId'],
    ['Số tiền', 'amount'], ['Ngày tạo', 'createdAt'], ['Ngày duyệt', 'reviewedAt']
  ],
  timesheet: [
    ['Mã CC', 'id'], ['Mã thành viên', 'memberId'], ['Ngày', 'date'], ['Giờ checkin', 'checkinTime'],
    ['Giờ checkout', 'checkoutTime'], ['Tổng số giờ làm việc', 'totalHours'], ['Số giờ tăng ca', 'overtimeHours'],
    ['Trạng thái', 'status'], ['Ghi chú', 'note'], ['Vĩ độ checkin', 'checkinLat'], ['Kinh độ checkin', 'checkinLng'],
    ['Khoảng cách checkin', 'checkinDistance'], ['IP Checkin', 'checkinIp'], ['Trạng thái đạt vị trí', 'geoPass'],
    ['Trạng thái đạt IP', 'ipPass'], ['Số điều kiện đạt', 'verifyPassCount'], ['Trạng thái xác thực', 'verifyStatus']
  ],
  notifications: [
    ['Mã TB', 'id'], ['Tiêu đề', 'title'], ['Nội dung', 'message'], ['Loại', 'type'], ['Phạm vi', 'scope'],
    ['Định kỳ', 'recurring'], ['Quy tắc lặp', 'recurRule'], ['Trạng thái bật tắt', 'active'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  notices: [
    ['Mã TB', 'id'], ['Tiêu đề', 'title'], ['Nội dung', 'message'], ['Màu sắc', 'color'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  documents: [
    ['Mã TL', 'id'], ['Danh mục', 'category'], ['Tên tài liệu', 'name'], ['Đường liên kết', 'url'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  payslips: [
    ['Mã PL', 'id'], ['Mã thành viên', 'memberId'], ['Tháng', 'month'], ['Ngày công', 'workDays'],
    ['Tổng số giờ', 'totalHours'], ['Giờ OT tự tính', 'otHoursAuto'], ['Giờ OT nhập tay', 'otHoursManual'],
    ['Tổng giờ OT', 'otHours'], ['Hệ số giờ OT', 'otRate'], ['Tiền OT', 'otAmount'], ['Lương cơ bản', 'baseSalary'],
    ['Tiền hoa hồng', 'commissionAmount'], ['Thưởng khác', 'otherBonus'], ['Ghi chú thưởng', 'otherBonusNote'],
    ['Khấu trừ', 'deduction'], ['Ghi chú khấu trừ', 'deductionNote'], ['Thực lãnh', 'totalAmount'],
    ['Trạng thái', 'status'], ['Ghi chú', 'note'], ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'],
    ['Ngày cập nhật', 'updatedAt'], ['Ngày duyệt', 'reviewedAt'], ['Mã người duyệt', 'reviewerId']
  ],
  commissions: [
    ['Mã dòng', 'id'], ['Dự án', 'projectId'], ['Mã thành viên', 'memberId'], ['Giá trị dự án', 'projectValue'],
    ['Phần trăm', 'percent'], ['Số tiền', 'amount'], ['Tháng', 'month'], ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  commissionRates: [
    ['Mã dòng', 'id'], ['Cấp bậc', 'roleLevel'], ['Phần trăm', 'percent'], ['Ngày cập nhật', 'updatedAt']
  ]
};

// Field-level VALUE translation — only needed where the cell's actual
// content (not just its header) was changed to Vietnamese, e.g. a data-
// validation dropdown built with Vietnamese options. Add more [sheetKey,
// englishFieldKey] entries here if more dropdowns get "Việt hoá" later.
const VALUE_MAP = {
  'members.status': [
    ['Còn làm việc', 'active'],
    ['Chờ duyệt', 'pending'],
    ['Từ chối', 'rejected'],
    ['Ngưng công tác', 'inactive']
  ],
  // roleLevel gates permissions everywhere in the client (isAdmin(), PERMISSIONS
  // matrix...) via the literal string 'admin' — only the Sheet's display value
  // changed to "CEO", the internal key must stay 'admin' or the CEO silently
  // loses every admin-only feature.
  'members.roleLevel': [
    ['CEO', 'admin']
  ]
};

function sheetKeyFor(sheetName) {
  return Object.keys(SHEETS).filter(function (k) { return SHEETS[k] === sheetName; })[0];
}

// Vietnamese header text (as it literally appears on the Sheet) -> English key.
// Unknown/custom header: returned as-is, so manually-added columns still work.
function viToEnHeader(sheetName, viHeader) {
  const key = sheetKeyFor(sheetName);
  const map = key && FIELD_MAP[key];
  if (!map) return viHeader;
  const hit = map.filter(function (p) { return p[0] === viHeader; })[0];
  return hit ? hit[1] : viHeader;
}

// English key -> Vietnamese header text to write against. Unknown key: as-is.
function enToViHeader(sheetName, enKey) {
  const key = sheetKeyFor(sheetName);
  const map = key && FIELD_MAP[key];
  if (!map) return enKey;
  const hit = map.filter(function (p) { return p[1] === enKey; })[0];
  return hit ? hit[0] : enKey;
}

function viToEnValue(sheetName, enKey, val) {
  const key = sheetKeyFor(sheetName);
  const pairs = key && VALUE_MAP[key + '.' + enKey];
  if (!pairs) return val;
  const hit = pairs.filter(function (p) { return p[0] === val; })[0];
  return hit ? hit[1] : val;
}

function enToViValue(sheetName, enKey, val) {
  const key = sheetKeyFor(sheetName);
  const pairs = key && VALUE_MAP[key + '.' + enKey];
  if (!pairs) return val;
  const hit = pairs.filter(function (p) { return p[1] === val; })[0];
  return hit ? hit[0] : val;
}

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
// Trimmed because manually-typed/pasted headers can carry stray leading/trailing
// whitespace that would otherwise silently break the VN header -> EN key match.
function getHeaders(sheet) {
  if (sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
    return typeof h === 'string' ? h.trim() : h;
  });
}

// Robust sheet lookup — tolerant of trailing spaces AND of Unicode form
// differences in the Vietnamese tab names. "ả" can be stored either
// precomposed (U+1EA3) or decomposed ("a" + U+0309 combining hook); a plain
// ss.getSheetByName() compares bytes and misses the other form. That exact
// mismatch (code said one form, the "Bảng tin" tab used the other) made reads
// silently spawn empty duplicate tabs. NFC-normalising both sides fixes it
// for every sheet at once.
function normalizeName(s) {
  return String(s == null ? '' : s).normalize('NFC').trim();
}
function findSheet(ss, sheetName) {
  const target = normalizeName(sheetName);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizeName(sheets[i].getName()) === target) return sheets[i];
  }
  return null;
}
// Only creates when the tab genuinely does not exist (matched via findSheet,
// so a Unicode/whitespace variant is reused, never duplicated). Used by the
// WRITE paths — reads must never create (see getAllData).
function getOrCreateSheet(ss, sheetName) {
  return findSheet(ss, sheetName) || ss.insertSheet(sheetName);
}

function getAllData(ss, sheetName) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return []; // read never creates a tab — avoids phantom empties
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);
  return data.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      const key = viToEnHeader(sheetName, h);
      let val = row[i];
      if (typeof val === 'string' && val.startsWith('[')) {
        try { val = JSON.parse(val); } catch (e) { /* keep raw string */ }
      }
      obj[key] = typeof val === 'string' ? viToEnValue(sheetName, key, val) : val;
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
  // Brand-new empty sheet with no header row yet: seed it (in Vietnamese) from FIELD_MAP.
  if (headers.length === 0) {
    const schemaKey = sheetKeyFor(sheetName);
    const pairs = schemaKey && FIELD_MAP[schemaKey];
    headers = pairs ? pairs.map(function (p) { return p[0]; }) : Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  if (!data.id) {
    const prefix = (sheetKeyFor(sheetName) || sheetName).toLowerCase().replace(/s$/, '');
    data.id = makeId(prefix);
  }
  data.createdAt = data.createdAt || new Date().toISOString().split('T')[0];
  const row = headers.map(function (h) {
    const enKey = viToEnHeader(sheetName, h);
    let val = data[enKey];
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === 'string') val = enToViValue(sheetName, enKey, val);
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
  if (headers.indexOf(enToViHeader(sheetName, 'updatedAt')) !== -1) {
    updates.updatedAt = new Date().toISOString();
  }
  headers.forEach(function (h, i) {
    const enKey = viToEnHeader(sheetName, h);
    if (updates[enKey] !== undefined) {
      let val = updates[enKey];
      if (Array.isArray(val)) val = JSON.stringify(val);
      else if (typeof val === 'string') val = enToViValue(sheetName, enKey, val);
      sheet.getRange(rowNum, i + 1).setValue(forceTextIfDateLike(val) || '');
    }
  });
  return Object.assign({}, data[index], updates);
}

function deleteData(ss, sheetName, id) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };
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
    if (normalizeName(sheet.getName()) !== normalizeName(SHEETS.members)) return;
    const headers = getHeaders(sheet);
    const col = e.range.getColumn();
    if (headers[col - 1] !== enToViHeader(SHEETS.members, 'id')) return;
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

function replaceIdInColumn(ss, sheetName, headerNameEn, oldId, newId) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return;
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(sheetName, headerNameEn));
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

function replaceIdInListColumn(ss, sheetName, headerNameEn, oldId, newId) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return;
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(sheetName, headerNameEn));
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
