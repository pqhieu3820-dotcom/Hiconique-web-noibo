(function () {
  'use strict';

  var state = { objects: [], levels: [], config: {} };

  function call(action, payload) {
    if (payload !== undefined) sketchup[action](JSON.stringify(payload));
    else sketchup[action]();
  }

  function toast(msg, isError) {
    var el = document.getElementById('hbToast');
    el.textContent = msg;
    el.style.background = isError ? '#B0463B' : '#14181D';
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- Tabs ----------
  document.getElementById('hbTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.hb-tab');
    if (!btn) return;
    document.querySelectorAll('.hb-tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
    document.querySelectorAll('.hb-panel').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === btn.getAttribute('data-tab')); });
  });

  // ---------- Bootstrap / Settings ----------
  function renderBootstrap(data) {
    state.config = data.config || {};
    state.levels = data.levels || [];
    document.getElementById('hbFileName').textContent = (data.model && data.model.fileName) || '—';
    document.getElementById('hbGuid').textContent = (data.model && data.model.guid) || '—';
    var configured = state.config.apiUrl && state.config.projectId;
    document.getElementById('hbConnBadge').textContent = configured ? '● Đã cấu hình' : '● Chưa cấu hình';
    document.getElementById('hbConnBadge').classList.toggle('ok', !!configured);
    document.getElementById('hbProjectLabel').textContent = configured
      ? ('Dự án: ' + (state.config.projectName || state.config.projectId))
      : 'Chưa gán dự án — mở Cài đặt (⚙)';
    document.getElementById('hbCfgApiUrl').value = state.config.apiUrl || '';
    document.getElementById('hbCfgProjectId').value = state.config.projectId || '';
    document.getElementById('hbCfgProjectName').value = state.config.projectName || '';
    renderLevelList();
    addFilterCondition();
  }

  document.getElementById('hbSaveSettingsBtn').addEventListener('click', function () {
    call('saveSettings', {
      apiUrl: document.getElementById('hbCfgApiUrl').value.trim(),
      projectId: document.getElementById('hbCfgProjectId').value.trim(),
      projectName: document.getElementById('hbCfgProjectName').value.trim()
    });
  });

  // ---------- Objects ----------
  document.getElementById('hbScanObjectsBtn').addEventListener('click', function () {
    if (state.config.apiUrl && state.config.projectId) call('syncObjects');
    else call('scanObjects');
  });

  function renderObjects(objects) {
    state.objects = objects;
    document.getElementById('hbObjCount').textContent = objects.length;
    document.getElementById('hbObjTagged').textContent = objects.filter(function (o) { return o.tagName; }).length;
    document.getElementById('hbObjIfc').textContent = objects.filter(function (o) { return o.ifcClass; }).length;
    var list = document.getElementById('hbObjectsList');
    if (!objects.length) { list.innerHTML = '<div class="hb-empty">Chưa quét object nào — bấm "Scan / Đồng bộ".</div>'; return; }
    list.innerHTML = objects.slice(0, 200).map(function (o) {
      return '<div class="hb-row-card"><div class="top"><b>' + esc(o.defName) + '</b><span class="tag">' + esc(o.tagName || 'Chưa gán tag') + '</span></div>' +
        '<div class="meta">' + esc(o.group || '—') + (o.ifcClass ? ' · ' + esc(o.ifcClass) : '') + (o.materialName ? ' · VL: ' + esc(o.materialName) : '') + '</div>' +
        '<div class="meta">' + o.width + '×' + o.height + '×' + o.depth + ' m' + (o.level ? ' · ' + esc(o.level) : '') + ' · x' + o.instanceCount + '</div></div>';
    }).join('') + (objects.length > 200 ? '<div class="hb-empty">... và ' + (objects.length - 200) + ' object khác</div>' : '');
  }

  function renderSynced(data) {
    document.getElementById('hbLinkStatus').textContent = data.count + ' object đã đồng bộ';
    document.getElementById('hbLinkStatus').classList.add('ok');
    document.getElementById('hbSyncedAt').textContent = 'Vừa xong';
    renderObjects(data.objects);
    toast('Đã đồng bộ ' + data.count + ' object lên HICONIQUE Nội bộ.');
  }

  // ---------- Level ----------
  function renderLevelList() {
    var list = document.getElementById('hbLevelList');
    if (!state.levels.length) { list.innerHTML = '<div class="hb-empty">Chưa có tầng nào — bấm "Thêm tầng".</div>'; return; }
    list.innerHTML = state.levels.map(function (lv, i) {
      return '<div class="hb-row-card level-row" data-idx="' + i + '">' +
        '<input type="text" class="lv-name" value="' + esc(lv.name) + '">' +
        '<input type="number" step="0.1" class="lv-min" value="' + lv.elevationMin + '" title="Cao độ min (m)">' +
        '<input type="number" step="0.1" class="lv-max" value="' + lv.elevationMax + '" title="Cao độ max (m)">' +
        '<button class="level-remove" data-remove="' + i + '">✕</button></div>';
    }).join('');
  }

  document.getElementById('hbAddLevelBtn').addEventListener('click', function () {
    var n = state.levels.length + 1;
    state.levels.push({ name: 'Tầng ' + String(n).padStart(2, '0'), elevationMin: 0, elevationMax: 3.6 });
    renderLevelList();
  });

  document.getElementById('hbLevelFromSelectionBtn').addEventListener('click', function () { call('levelFromSelection'); });

  function applyLevelFromSelection(data) {
    var n = state.levels.length + 1;
    state.levels.push({ name: 'Tầng ' + String(n).padStart(2, '0'), elevationMin: data.elevationMin, elevationMax: data.elevationMax });
    renderLevelList();
  }

  document.getElementById('hbLevelList').addEventListener('click', function (e) {
    var idx = e.target.getAttribute('data-remove');
    if (idx == null) return;
    state.levels.splice(Number(idx), 1);
    renderLevelList();
  });

  document.getElementById('hbSaveLevelsBtn').addEventListener('click', function () {
    var rows = document.querySelectorAll('#hbLevelList .level-row');
    var levels = Array.prototype.map.call(rows, function (row) {
      return {
        name: row.querySelector('.lv-name').value.trim() || 'Tầng',
        elevationMin: parseFloat(row.querySelector('.lv-min').value) || 0,
        elevationMax: parseFloat(row.querySelector('.lv-max').value) || 0
      };
    });
    call('saveLevels', levels);
  });

  // ---------- Room/Space ----------
  document.getElementById('hbScanSpacesBtn').addEventListener('click', function () { call('scanSpaces'); });
  function renderSpaces(spaces) {
    document.getElementById('hbSpaceCount').textContent = spaces.length;
    document.getElementById('hbSpaceArea').textContent = spaces.reduce(function (s, r) { return s + r.area; }, 0).toFixed(1);
    var list = document.getElementById('hbSpaceList');
    if (!spaces.length) { list.innerHTML = '<div class="hb-empty">Chưa có Face nào gán tag !space.</div>'; return; }
    list.innerHTML = spaces.map(function (r) {
      return '<div class="hb-row-card"><div class="top"><b>' + esc(r.name) + '</b><span class="tag">' + r.area + ' m²</span></div>' +
        '<div class="meta">Cao ' + r.height + ' m · Cao độ sàn ' + r.elevation + ' m</div></div>';
    }).join('');
  }

  // ---------- Material ----------
  document.getElementById('hbScanMaterialsBtn').addEventListener('click', function () { call('scanMaterials'); });
  function renderMaterials(materials) {
    var list = document.getElementById('hbMaterialList');
    if (!materials.length) { list.innerHTML = '<div class="hb-empty">Model chưa dùng material nào.</div>'; return; }
    list.innerHTML = materials.map(function (m) {
      return '<div class="hb-row-card"><div class="top"><b>' + esc(m.name) + '</b><span class="tag">' + m.areaM2 + ' m²</span></div>' +
        (m.taxonomyLabel ? '<div class="meta">' + esc(m.taxonomyLabel) + '</div>' : '<div class="meta">Chưa khớp mã vật liệu chuẩn (m_xxx)</div>') + '</div>';
    }).join('');
  }

  // ---------- Filter ----------
  var FILTER_FIELDS = [
    ['level', 'Tầng'], ['group', 'Nhóm'], ['tagName', 'Tag'], ['ifcClass', 'IFC Class'],
    ['materialName', 'Vật liệu'], ['area', 'Diện tích (m²)'], ['width', 'Rộng (m)'], ['height', 'Cao (m)']
  ];
  var FILTER_OPS = [['eq', 'bằng'], ['contains', 'chứa'], ['gt', '>'], ['lt', '<']];

  function addFilterCondition() {
    var wrap = document.getElementById('hbFilterConditions');
    var row = document.createElement('div');
    row.className = 'hb-cond-row';
    row.innerHTML = '<select class="field">' + FILTER_FIELDS.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('') + '</select>' +
      '<select class="op">' + FILTER_OPS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>' +
      '<input type="text" class="value" placeholder="Giá trị">' +
      '<button class="level-remove">✕</button>';
    row.querySelector('.level-remove').addEventListener('click', function () { row.remove(); });
    wrap.appendChild(row);
  }
  document.getElementById('hbAddConditionBtn').addEventListener('click', addFilterCondition);

  function collectFilterRequest(mode) {
    var rows = document.querySelectorAll('#hbFilterConditions .hb-cond-row');
    var conditions = Array.prototype.map.call(rows, function (row) {
      return { field: row.querySelector('.field').value, op: row.querySelector('.op').value, value: row.querySelector('.value').value };
    }).filter(function (c) { return c.value !== ''; });
    var matchAll = document.querySelector('input[name=hbMatchMode]:checked').value === 'all';
    return { conditions: conditions, matchAll: matchAll, mode: mode };
  }
  document.getElementById('hbFilterHighlightBtn').addEventListener('click', function () { call('runFilter', collectFilterRequest('highlight')); });
  document.getElementById('hbFilterIsolateBtn').addEventListener('click', function () { call('runFilter', collectFilterRequest('isolate')); });
  document.getElementById('hbFilterClearBtn').addEventListener('click', function () { call('clearFilter'); });

  function renderFilterResult(data) {
    var el = document.getElementById('hbFilterResult');
    el.hidden = false;
    el.textContent = data.matched + ' / ' + data.total + ' object khớp điều kiện.';
  }

  // ---------- BOQ ----------
  document.getElementById('hbGenerateBoqBtn').addEventListener('click', function () { call('generateBoq'); });
  var lastBoqRows = [];
  function renderBoqPreview(data) {
    lastBoqRows = data.rows;
    document.getElementById('hbBoqMatched').textContent = data.rows.length;
    document.getElementById('hbBoqUnmatched').textContent = data.unmatched;
    var list = document.getElementById('hbBoqList');
    document.getElementById('hbPushBoqBtn').hidden = data.rows.length === 0;
    if (!data.rows.length) { list.innerHTML = '<div class="hb-empty">Không có object nào khớp tên với danh mục Sản phẩm.</div>'; return; }
    list.innerHTML = data.rows.map(function (r) {
      return '<div class="hb-row-card"><div class="top"><b>' + esc(r.name) + '</b><span class="tag">' + r.quantity.toFixed(2) + ' ' + esc(r.unit) + '</span></div></div>';
    }).join('');
  }
  document.getElementById('hbPushBoqBtn').addEventListener('click', function () { call('pushBoq', lastBoqRows); });

  // ---------- Ruby -> JS bridge ----------
  window.hiconBimReceive = function (event, payload) {
    switch (event) {
      case 'bootstrap': renderBootstrap(payload); break;
      case 'settingsSaved': state.config = payload; renderBootstrap({ config: payload, levels: state.levels, model: { fileName: document.getElementById('hbFileName').textContent, guid: document.getElementById('hbGuid').textContent } }); toast('Đã lưu cấu hình.'); break;
      case 'objects': renderObjects(payload.objects); break;
      case 'synced': renderSynced(payload); break;
      case 'levels': state.levels = payload.levels; renderLevelList(); toast('Đã lưu danh sách tầng.'); break;
      case 'levelFromSelection': applyLevelFromSelection(payload); break;
      case 'spaces': renderSpaces(payload.spaces); break;
      case 'materials': renderMaterials(payload.materials); break;
      case 'filterResult': renderFilterResult(payload); break;
      case 'filterCleared': document.getElementById('hbFilterResult').hidden = true; toast('Đã xoá bộ lọc.'); break;
      case 'boqPreview': renderBoqPreview(payload); break;
      case 'boqPushed': toast('Đã đẩy ' + payload.count + ' dòng lên BOQ dự án.'); break;
      case 'error': toast('[' + payload.label + '] ' + payload.message, true); break;
    }
  };

  call('ready');
})();
