// ============================================================
// BIM MODEL/OBJECT SYNC — file Apps Script RIÊNG, KHÔNG đụng vào
// gsheets-api-v2.js (theo yêu cầu 2026-09-09: tách lẻ, chỉ nối 1 dòng
// chuyển tiếp `handleBimSyncAction` ở cuối handleRequest() bên file chính).
//
// Cách cài: mở Apps Script editor của project "HICONIQUE NỘI BỘ API",
// bấm "+" cạnh "Tệp" > Script > đặt tên "bim-model-sync" > dán nội dung
// file này vào. Cùng 1 project Apps Script thì mọi file .gs chia sẻ chung
// global scope, nên các hàm dưới đây gọi thẳng được getOrCreateSheet/
// getHeaders/addData/addDataBatch/updateData/deleteData/makeId đã có sẵn
// trong gsheets-api-v2.js — không cần import/require gì thêm.
//
// Sheet dùng riêng cho 2 bảng này, KHÔNG khai báo trong SHEETS/FIELD_MAP
// của file chính — header cột được ghi thẳng bằng tiếng Anh (id, projectId,
// ...) khi sheet còn trống, vì addData/addDataBatch tự fallback dùng
// Object.keys(data) làm header khi không tìm thấy sheet đó trong FIELD_MAP.
// Nguồn ghi dữ liệu: plugin HICON-BIM cho SketchUp (.rbz) — xem
// sketchup-plugin/ trong repo — mỗi lần bấm "Scan / Đồng bộ" trong plugin.
// ============================================================

var BIM_SYNC_SHEETS = {
  bimModels: 'Model BIM',
  bimObjects: 'Object BIM'
};

// Xoá tất cả dòng của 1 sheet có cột `field` khớp `value` (helper local, cố
// tình không thêm vào file chính vì chỉ dùng ở đây).
function bimSyncDeleteRowsWhere(ss, sheetName, field, value) {
  var sheet = findSheet(ss, sheetName);
  if (!sheet) return 0;
  var headers = getHeaders(sheet);
  var colIdx = headers.indexOf(field);
  if (colIdx === -1) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  var removed = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] === value) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

// Trả về null nếu action không thuộc phạm vi file này (để handleRequest bên
// gsheets-api-v2.js tự in ra "Unknown action" như cũ).
function handleBimSyncAction(ss, action, params) {
  if (action === 'getBimModels') {
    return getAllData(ss, BIM_SYNC_SHEETS.bimModels);
  }
  if (action === 'addBimModel') {
    return addData(ss, BIM_SYNC_SHEETS.bimModels, JSON.parse(params.data));
  }
  if (action === 'updateBimModel') {
    return updateData(ss, BIM_SYNC_SHEETS.bimModels, params.id, JSON.parse(params.data));
  }
  if (action === 'deleteBimModel') {
    var deleted = deleteData(ss, BIM_SYNC_SHEETS.bimModels, params.id);
    bimSyncDeleteRowsWhere(ss, BIM_SYNC_SHEETS.bimObjects, 'modelId', params.id);
    return deleted;
  }
  if (action === 'getBimObjects') {
    return getAllData(ss, BIM_SYNC_SHEETS.bimObjects);
  }
  // Plugin SketchUp gọi action này mỗi lần bấm "Scan / Đồng bộ": xoá hết
  // Object cũ của modelId đó rồi ghi lại toàn bộ theo đúng trạng thái model
  // hiện tại — đơn giản và luôn đúng hơn so với diff từng object một.
  if (action === 'syncBimObjects') {
    var payload = JSON.parse(params.data);
    bimSyncDeleteRowsWhere(ss, BIM_SYNC_SHEETS.bimObjects, 'modelId', payload.modelId);
    var saved = (payload.objects && payload.objects.length)
      ? addDataBatch(ss, BIM_SYNC_SHEETS.bimObjects, payload.objects)
      : [];
    updateData(ss, BIM_SYNC_SHEETS.bimModels, payload.modelId, {
      objectCount: saved.length,
      syncedAt: new Date().toISOString(),
      syncedBy: payload.syncedBy || ''
    });
    return { success: true, count: saved.length };
  }
  return null;
}
