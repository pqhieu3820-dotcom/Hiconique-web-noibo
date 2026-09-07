const SPREADSHEET_ID = '1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY';
// API URL: https://script.google.com/macros/s/AKfycbwc-b9AMPpl34VNUGHhiUg9wf1Kt5xZ3-XbOHEq128f0yzqlucmbkhnmmrhLa9xUeCR/exec

const SHEETS = {
  projects: 'Projects',
  tasks: 'Tasks',
  members: 'Members',
  proposals: 'Proposals',
  timesheet: 'Timesheet'
};

const HEADERS = {
  projects: ['id', 'name', 'type', 'color', 'progress', 'status', 'members', 'createdAt', 'updatedAt'],
  tasks: ['id', 'title', 'description', 'projectId', 'assigneeId', 'priority', 'status', 'startDate', 'deadline', 'createdBy', 'createdAt', 'updatedAt'],
  members: ['id', 'name', 'role', 'roleLevel', 'email', 'password', 'dob', 'cccd', 'hometown', 'bankAccount', 'color', 'avatar', 'createdAt'],
  proposals: ['id', 'title', 'description', 'type', 'status', 'requesterId', 'reviewerId', 'amount', 'createdAt', 'reviewedAt'],
  timesheet: ['id', 'memberId', 'date', 'checkinTime', 'checkoutTime', 'totalHours', 'overtimeHours', 'status']
};

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let result;

    // Auth check - chỉ cần khi write (có thể mở rộng sau)
    // const userEmail = Session.getActiveUser().getEmail();

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
    } else {
      result = { error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getAllData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return data.map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) {
      let val = row[i];
      if (typeof val === 'string' && val.startsWith('[')) {
        try { obj[h] = JSON.parse(val); } catch(e) { obj[h] = val; }
      } else {
        obj[h] = val;
      }
    });
    return obj;
  });
}

function getDataById(ss, sheetName, id) {
  return getAllData(ss, sheetName).find(function(row) { return row.id === id; });
}

function addData(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = HEADERS[sheetName.toLowerCase()];
  if (!data.id) {
    data.id = sheetName.toLowerCase().replace('s', '') + '_' + Date.now();
  }
  data.createdAt = data.createdAt || new Date().toISOString().split('T')[0];
  const row = headers.map(function(h) {
    const val = data[h];
    return Array.isArray(val) ? JSON.stringify(val) : (val || '');
  });
  sheet.appendRow(row);
  return data;
}

function updateData(ss, sheetName, id, updates) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = HEADERS[sheetName.toLowerCase()];
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(function(row) { return row.id === id; });
  if (index === -1) return { error: 'Not found: ' + id };
  const rowNum = index + 2;
  updates.updatedAt = new Date().toISOString();
  headers.forEach(function(h, i) {
    if (updates[h] !== undefined) {
      let val = updates[h];
      if (Array.isArray(val)) val = JSON.stringify(val);
      sheet.getRange(rowNum, i + 1).setValue(val || '');
    }
  });
  return Object.assign({}, data[index], updates);
}

function deleteData(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(function(row) { return row.id === id; });
  if (index === -1) return { error: 'Not found' };
  sheet.deleteRow(index + 2);
  return { success: true, deleted: id };
}