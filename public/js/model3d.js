/* Tab "Mô hình 3D" (pricing.html) — dựng nhanh mô hình nhà ở bằng khối để LẤY KHỐI LƯỢNG, thao tác theo kiểu SketchUp/CAD.
   TRỤC (giống SketchUp): X, Y = mặt bằng; Z = chiều cao (trục đứng). (Nội bộ Three.js: x→X, z→Y, y→Z.)
   - Cấu kiện: móng · cổ móng · giằng móng · cột · dầm · tường · lanh tô · sàn · mái · lỗ mở (cửa, tự trừ vào tường) · khối khác.
   - Vẽ: bắt điểm 3D (góc, trung điểm, tâm mặt; hoặc lưới) → NHẬP KÍCH THƯỚC TRỰC TIẾP như CAD: gõ số (mm/cm/m), Tab đổi ô (Dài ↔ Cao ↔ Dày…), Enter xong, Esc huỷ.
     Hình chữ nhật: Dài X · Rộng Y · Cao Z | Đường (tường, dầm, giằng, lanh tô): Dài · Cao · Dày (Dày đặt sẵn, VD tường 220) | Điểm (cột, cổ móng): Rộng X · Rộng Y · Cao.
   - Mỗi cấu kiện: V thể tích, A diện tích mặt trên/đáy, W diện tích mặt tường 2 phía (trừ lỗ mở), L chiều dài (cột/cổ móng: chiều cao). Gán hạng mục DG-* theo loại hoặc từng cấu kiện → khối lượng, thành tiền → đẩy sang "Dự toán xây dựng".
   - Xuất COLLADA .dae (SketchUp: File > Import; Z lên), OBJ, CSV; nhập .dae/.obj từ SketchUp (tách theo nhóm vật liệu). File .skp trình duyệt không đọc/ghi trực tiếp được.
   Lưu theo dự án: localStorage 'pr-model:<id>'. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('m3dCanvasWrap')) return;

  var LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/ColladaLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js'];
  // kind: rect (vẽ chữ nhật) · line (đường: tường, dầm…) · point (cột, cổ móng) — quyết định công cụ nào dùng loại này
  var TYPES = {
    foundation: { label: 'Móng', color: 0x9AA0A6, elev: -1.0, h: 0.4, basis: 'V', kind: 'rect' },
    neck: { label: 'Cổ móng', color: 0xA9A29A, elev: -0.6, h: 1.05, basis: 'V', kind: 'point', sec: 0.3 },
    gbeam: { label: 'Giằng móng', color: 0x8E8A84, elev: -0.4, h: 0.4, basis: 'V', kind: 'line', sec: 0.3 },
    column: { label: 'Cột', color: 0xC0B7AD, elev: 0.45, h: 2.85, basis: 'V', kind: 'point', sec: 0.22 },
    beam: { label: 'Dầm', color: 0xB59F82, elev: 2.9, h: 0.4, basis: 'V', kind: 'line', sec: 0.22 },
    wall: { label: 'Tường', color: 0xD9C9A8, elev: 0, h: 3.3, basis: 'V', kind: 'line', sec: 0.22 },
    lintel: { label: 'Lanh tô', color: 0xA89984, elev: 2.4, h: 0.2, basis: 'V', kind: 'line', sec: 0.22 },
    slab: { label: 'Sàn', color: 0x8FB3C9, elev: 3.3, h: 0.12, basis: 'A', kind: 'rect' },
    roof: { label: 'Mái', color: 0xC77B58, elev: 3.42, h: 0.1, basis: 'A', kind: 'rect' },
    opening: { label: 'Lỗ mở (cửa)', color: 0x6FA8DC, elev: 0.9, h: 1.2, basis: 'V', kind: 'rect' },
    other: { label: 'Khối khác', color: 0xB8A9C9, elev: 0, h: 1, basis: 'V', kind: 'rect' },
    mesh: { label: 'Nhập từ file', color: 0xC9C9C9, elev: 0, h: 1, basis: 'V', kind: 'rect' }
  };
  var BASIS = { V: 'Thể tích (m³)', A: 'Diện tích mặt trên/đáy (m²)', W: 'Diện tích mặt tường 2 phía (m²)', L: 'Chiều dài (m)', N: 'Số lượng (cái)' };
  var BASIS_UNIT = { V: 'm³', A: 'm²', W: 'm²', L: 'm', N: 'cái' };
  var UNITS = { mm: 0.001, cm: 0.01, m: 1 };

  var S = { objects: [], typeItems: {}, set: { type: 'wall', elev: 0, h: 3.3, thick: 0.22, grid: 0.1, unit: 'mm', snap3d: 1, snapBase: 'bottom' }, sel: null, tool: 'select' };
  var hist = [], seq = 0;
  var T, scene, camera, renderer, controls, ground, grid, objMeshes = {}, preview = null, marker = null, raycaster, dirty = true, inited = false, loading = null;
  var entries = [], entriesProv = '', cands = null, D = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f2(n) { return (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function fm(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  function pn(s) { var v = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(v) ? v : 0; }
  function us() { return UNITS[S.set.unit] || 0.001; }
  function toU(v) { return Math.round((Number(v) || 0) / us() * 1000) / 1000; }
  function fromU(v) { return (Number(v) || 0) * us(); }
  function ustep() { return S.set.unit === 'mm' ? 10 : S.set.unit === 'cm' ? 1 : 0.05; }
  function key() { var el = $('prToolProjectSelect'); return 'pr-model:' + (el && el.value ? el.value : 'none'); }
  function province() { var el = $('prProvinceSelect'); return el ? el.value : ''; }
  function getObj(id) { return S.objects.filter(function (o) { return o.id === id; })[0]; }

  // ---------- lưu / hoàn tác ----------
  var saveTimer = null;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { try { localStorage.setItem(key(), JSON.stringify({ objects: S.objects, typeItems: S.typeItems, set: S.set })); } catch (e) { /* đầy bộ nhớ */ } }, 300); }
  function snapshot() { hist.push(JSON.stringify(S.objects)); if (hist.length > 60) hist.shift(); }
  function undo() { if (!hist.length) return; S.objects = JSON.parse(hist.pop()); S.sel = null; cands = null; rebuildAll(); refreshUI(); save(); }
  function load() {
    var o = null; try { o = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (e) {}
    S.objects = o && Array.isArray(o.objects) ? o.objects : []; S.typeItems = (o && o.typeItems) || {};
    if (o && o.set) Object.assign(S.set, o.set);
    if (!TYPES[S.set.type] || TYPES[S.set.type].kind === undefined) S.set.type = 'wall';
    S.sel = null; hist = []; cands = null;
    if (inited) { rebuildAll(); refreshUI(); }
    syncSettingsUI();
  }

  // ---------- khối lượng ----------
  function ovVol(a, b) { var x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), z = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z); return x > 0 && y > 0 && z > 0 ? x * y * z : 0; }
  function metrics() {
    var M = {};
    S.objects.forEach(function (o) {
      if (o.kind === 'mesh') { M[o.id] = { V: o.V, A: o.A, W: o.W, L: o.L, N: 1 }; return; }
      var L = (o.type === 'column' || o.type === 'neck') ? o.h : Math.max(o.w, o.d);
      M[o.id] = { V: o.w * o.d * o.h, A: o.w * o.d, W: 2 * Math.max(o.w, o.d) * o.h, L: L, N: 1 };
    });
    var opens = S.objects.filter(function (o) { return o.type === 'opening' && o.kind !== 'mesh'; });
    S.objects.forEach(function (o) {
      if (o.type !== 'wall' || o.kind === 'mesh') return;
      var th = Math.min(o.w, o.d) || 1;
      opens.forEach(function (op) { var v = ovVol(o, op); if (v > 0) { M[o.id].V -= v; M[o.id].W -= 2 * v / th; } });
      M[o.id].V = Math.max(0, M[o.id].V); M[o.id].W = Math.max(0, M[o.id].W);
    });
    opens.forEach(function (op) { M[op.id] = { V: 0, A: 0, W: 0, L: 0, N: 0, open: true }; });
    return M;
  }
  function effItem(o) { if (o.item) return { item: o.item, basis: o.basis || (TYPES[o.type] || TYPES.other).basis }; var t = S.typeItems[o.type]; return t && t.item ? { item: t.item, basis: t.basis || (TYPES[o.type] || TYPES.other).basis } : null; }
  function groups() {
    var M = metrics(), g = {};
    S.objects.forEach(function (o) {
      var e = effItem(o); if (!e || M[o.id].open) return;
      var k = (e.item.code || '') + '|' + e.item.name + '|' + e.basis, q = M[o.id][e.basis] || 0;
      if (!g[k]) g[k] = { item: e.item, basis: e.basis, qty: 0, n: 0 };
      g[k].qty += q; g[k].n++;
    });
    return Object.keys(g).map(function (k) { return g[k]; });
  }
  function priceOf(item) { return Math.round((item.low + item.high) / 2 / 1000) * 1000 || Math.round((item.low + item.high) / 2); }

  // ---------- nạp thư viện 3D ----------
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Không tải được ' + src)); }; document.head.appendChild(s); }); }
  function ensureLibs() {
    if (window.THREE && THREE.OrbitControls) return Promise.resolve();
    if (loading) return loading;
    loading = LIBS.reduce(function (p, s) { return p.then(function () { return loadScript(s); }); }, Promise.resolve());
    return loading;
  }

  // ---------- khởi tạo cảnh ----------
  function init() {
    T = window.THREE;
    var wrap = $('m3dCanvasWrap');
    scene = new T.Scene(); scene.background = new T.Color(0xEEF1F5);
    camera = new T.PerspectiveCamera(45, 1, 0.05, 2000); camera.position.set(14, 11, 16);
    renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    wrap.insertBefore(renderer.domElement, wrap.firstChild); renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    scene.add(new T.AmbientLight(0xffffff, 0.75)); var dl = new T.DirectionalLight(0xffffff, 0.7); dl.position.set(10, 20, 8); scene.add(dl);
    grid = new T.GridHelper(60, 60, 0xaab2bd, 0xd0d6de); scene.add(grid);
    // trục kiểu SketchUp: X đỏ, Y xanh lá (mặt bằng), Z xanh dương (đứng)
    [[1, 0, 0, 0xe53935], [0, 0, 1, 0x43a047], [0, 1, 0, 0x1e88e5]].forEach(function (a) {
      scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0.005, 0), new T.Vector3(a[0] * 2, 0.005 + a[1] * 2, a[2] * 2)]), new T.LineBasicMaterial({ color: a[3] })));
    });
    var lg = document.createElement('div'); lg.className = 'm3d-legend'; lg.innerHTML = '<span style="color:#e53935">X</span> · <span style="color:#43a047">Y</span> mặt bằng · <span style="color:#1e88e5">Z</span> chiều cao'; wrap.appendChild(lg);
    ground = new T.Mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ visible: false })); scene.add(ground);
    marker = new T.Mesh(new T.SphereGeometry(1, 12, 10), new T.MeshBasicMaterial({ color: 0x00c853, depthTest: false })); marker.renderOrder = 999; marker.visible = false; scene.add(marker);
    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = { LEFT: -1, MIDDLE: T.MOUSE.ROTATE, RIGHT: T.MOUSE.ROTATE };
    controls.enableDamping = false; controls.target.set(0, 1, 0); controls.addEventListener('change', function () { dirty = true; });
    raycaster = new T.Raycaster();
    new ResizeObserver(resize).observe(wrap); resize();
    bindPointer(renderer.domElement);
    inited = true;
    rebuildAll();
    (function loop() { requestAnimationFrame(loop); if (dirty && wrap.clientWidth > 0) { dirty = false; renderer.render(scene, camera); } })();
  }
  function resize() { var w = $('m3dCanvasWrap'); if (!renderer || !w.clientWidth) return; renderer.setSize(w.clientWidth, w.clientHeight); camera.aspect = w.clientWidth / w.clientHeight; camera.updateProjectionMatrix(); dirty = true; }

  // ---------- dựng lưới hiển thị ----------
  function mkMesh(o) {
    var ty = TYPES[o.type] || TYPES.other, g = new T.Group(); g.userData.id = o.id;
    if (o.kind === 'mesh') {
      var b = o.bbox, geo = new T.BoxGeometry(Math.max(0.02, b.max[0] - b.min[0]), Math.max(0.02, b.max[1] - b.min[1]), Math.max(0.02, b.max[2] - b.min[2]));
      var ctr = new T.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      if (o.geo && o.geo.length) {
        var gm = new T.BufferGeometry(); gm.setAttribute('position', new T.Float32BufferAttribute(o.geo, 3)); gm.computeVertexNormals();
        g.add(new T.Mesh(gm, new T.MeshLambertMaterial({ color: ty.color, side: T.DoubleSide })));
      } else {
        var m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: ty.color, transparent: true, opacity: 0.35 })); m.position.copy(ctr); g.add(m);
        var ls = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: 0x555555 })); ls.position.copy(ctr); g.add(ls);
      }
      return g;
    }
    var geo2 = new T.BoxGeometry(Math.max(0.001, o.w), Math.max(0.001, o.h), Math.max(0.001, o.d));
    g.add(new T.Mesh(geo2, new T.MeshLambertMaterial({ color: ty.color, transparent: o.type === 'opening', opacity: o.type === 'opening' ? 0.45 : 1 })));
    g.add(new T.LineSegments(new T.EdgesGeometry(geo2), new T.LineBasicMaterial({ color: 0x2b2f36 })));
    g.position.set(o.x + o.w / 2, o.y + o.h / 2, o.z + o.d / 2);
    return g;
  }
  function rebuildAll() {
    if (!inited) return;
    Object.keys(objMeshes).forEach(function (k) { scene.remove(objMeshes[k]); }); objMeshes = {}; cands = null;
    S.objects.forEach(function (o) { var g = mkMesh(o); objMeshes[o.id] = g; scene.add(g); });
    paintSel(); dirty = true;
  }
  function rebuildOne(o) {
    if (!inited) return; if (objMeshes[o.id]) scene.remove(objMeshes[o.id]);
    var g = mkMesh(o); objMeshes[o.id] = g; scene.add(g); cands = null; paintSel(); dirty = true;
  }
  function paintSel() {
    Object.keys(objMeshes).forEach(function (id) {
      var g = objMeshes[id], on = id === S.sel;
      g.traverse(function (c) { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(on ? 0x553300 : 0x000000); if (c.isLineSegments) c.material.color.setHex(on ? 0xff8800 : 0x2b2f36); });
    }); dirty = true;
  }

  // ---------- bắt điểm 3D ----------
  function candidates() {
    if (cands) return cands;
    cands = [];
    S.objects.forEach(function (o) {
      if (o.kind === 'mesh') return;
      var xs = [o.x, o.x + o.w], ys = [o.y, o.y + o.h], zs = [o.z, o.z + o.d], mx = o.x + o.w / 2, my = o.y + o.h / 2, mz = o.z + o.d / 2;
      xs.forEach(function (x) { ys.forEach(function (y) { zs.forEach(function (z) { cands.push({ v: new T.Vector3(x, y, z), k: 'góc' }); }); }); });
      ys.forEach(function (y) { zs.forEach(function (z) { cands.push({ v: new T.Vector3(mx, y, z), k: 'trung điểm' }); }); });
      xs.forEach(function (x) { zs.forEach(function (z) { cands.push({ v: new T.Vector3(x, my, z), k: 'trung điểm' }); }); });
      xs.forEach(function (x) { ys.forEach(function (y) { cands.push({ v: new T.Vector3(x, y, mz), k: 'trung điểm' }); }); });
      ys.forEach(function (y) { cands.push({ v: new T.Vector3(mx, y, mz), k: 'tâm mặt' }); });
    });
    return cands;
  }
  function screenOf(v) { var p = v.clone().project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, behind: p.z > 1 || p.z < -1 }; }
  function snapV(v, axis) {
    var g = S.set.grid, best = Math.round(v / g) * g, bd = Math.abs(best - v), th = Math.max(0.12, g);
    S.objects.forEach(function (o) {
      if (o.kind === 'mesh') return;
      var c = axis === 'x' ? [o.x, o.x + o.w] : [o.z, o.z + o.d];
      c.forEach(function (e) { var d = Math.abs(e - v); if (d < th && d < bd - 1e-9) { best = e; bd = d; } });
    });
    return Math.round(best * 1000) / 1000;
  }
  function ndc(e) { var r = renderer.domElement.getBoundingClientRect(); return new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  function groundHit(e, elev) {
    raycaster.setFromCamera(ndc(e), camera);
    var pl = new T.Plane(new T.Vector3(0, 1, 0), -(elev || 0)), p = new T.Vector3();
    return raycaster.ray.intersectPlane(pl, p) ? p : null;
  }
  // trả {x, y(=cao độ Z), z(=Y mặt bằng), kind, hard}; hard = bắt được điểm 3D thật
  function snapAt(e) {
    var r = renderer.domElement.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = 15;
    if (S.set.snap3d && inited) candidates().forEach(function (c) { var p = screenOf(c.v); if (p.behind) return; var d = Math.hypot(p.x - mx, p.y - my) - (c.k === 'góc' ? 4 : 0); if (d < bd) { bd = d; best = c; } });
    if (best) return { x: best.v.x, y: best.v.y, z: best.v.z, kind: best.k, hard: true };
    var elev = D ? D.p1.y : S.set.elev, h = groundHit(e, elev);
    if (!h) return null;
    return { x: snapV(h.x, 'x'), y: elev, z: snapV(h.z, 'z'), kind: 'lưới', hard: false };
  }
  function showMarker(s) {
    if (!marker) return; if (!s) { marker.visible = false; dirty = true; return; }
    marker.visible = true; marker.position.set(s.x, s.y, s.z); marker.material.color.setHex(s.kind === 'góc' ? 0x00c853 : s.kind === 'lưới' ? 0xff9800 : 0x00bcd4);
    var sc = camera.position.distanceTo(marker.position) * 0.011; marker.scale.set(sc, sc, sc); dirty = true;
  }
  function pick(e) {
    raycaster.setFromCamera(ndc(e), camera);
    var meshes = []; Object.keys(objMeshes).forEach(function (id) { objMeshes[id].traverse(function (c) { if (c.isMesh) { c.userData.oid = id; meshes.push(c); } }); });
    var hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].object.userData.oid : null;
  }

  // ---------- tạo đối tượng ----------
  function newObj(type, x, z, w, d, elev, h) {
    var ty = TYPES[type] || TYPES.other;
    return { id: 'm' + Date.now() + (seq++), kind: 'box', type: type, name: ty.label + ' ' + (S.objects.filter(function (x) { return x.type === type; }).length + 1), x: x, y: elev, z: z, w: w, d: d, h: h, item: null, basis: '' };
  }
  function addObj(o) { snapshot(); S.objects.push(o); cands = null; rebuildOne(o); S.sel = o.id; paintSel(); refreshUI(); save(); }

  // ---------- vẽ có nhập kích thước (kiểu CAD) ----------
  function status(msg) { $('m3dStatus').textContent = msg || ''; }
  function setPreview(o) {
    if (preview) { scene.remove(preview); preview = null; }
    if (o) { preview = mkMesh(o); preview.traverse(function (c) { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; } }); scene.add(preview); }
    dirty = true;
  }
  var FIELDS = {
    rect: [['w', 'Dài X'], ['d', 'Rộng Y'], ['h', 'Cao Z']],
    line: [['len', 'Dài'], ['h', 'Cao Z'], ['th', 'Dày']],
    point: [['a', 'Rộng X'], ['b', 'Rộng Y'], ['h', 'Cao Z']]
  };
  function drawType() {
    var t = S.set.type, k = (TYPES[t] || {}).kind;
    if (D.tool === 'line') return k === 'line' ? t : 'wall';
    if (D.tool === 'point') return k === 'point' ? t : 'column';
    return t;
  }
  function beginDraw(tool, s) {
    D = { tool: tool, p1: { x: s.x, y: s.y, z: s.z }, hard: s.hard, mouse: { x: s.x, z: s.z }, vals: {}, lock: {} };
    var typ = drawType(), ty = TYPES[typ] || TYPES.other;
    D.typ = typ;
    // chiều cao / dày mặc định: ô cài đặt nếu đúng loại đang chọn, ngược lại mặc định của loại
    D.defH = typ === S.set.type ? S.set.h : ty.h; D.defTh = (typ === S.set.type ? S.set.thick : ty.sec) || ty.sec || 0.22;
    D.defElev = typ === S.set.type ? S.set.elev : ty.elev;
    if (!s.hard) D.p1.y = D.defElev;
    renderDim(); updateDraft();
    status('Bắt điểm xong — gõ kích thước (' + S.set.unit + '), Tab đổi ô, Enter xác nhận, Esc huỷ. Hoặc bấm điểm tiếp theo.');
  }
  function cancelDraw() { D = null; setPreview(null); showMarker(null); var d = $('m3dDim'); if (d) { d.classList.remove('on'); d.innerHTML = ''; } status(''); }
  function draftObj() {
    if (!D) return null;
    var m = D.mouse, p = D.p1, v = D.vals, L = D.lock, h = L.h ? v.h : D.defH, o = null, th, w, d, x, z;
    if (D.tool === 'rect') {
      var dx = m.x - p.x, dz = m.z - p.z; w = L.w ? v.w : Math.abs(dx); d = L.d ? v.d : Math.abs(dz);
      x = dx < 0 ? p.x - w : p.x; z = dz < 0 ? p.z - d : p.z;
    } else if (D.tool === 'line') {
      var ax = m.x - p.x, az = m.z - p.z, alongX = Math.abs(ax) >= Math.abs(az), sg = (alongX ? ax : az) < 0 ? -1 : 1;
      var len = L.len ? v.len : Math.abs(alongX ? ax : az); th = L.th ? v.th : D.defTh;
      D.dir = { alongX: alongX, sg: sg, len: len };
      if (alongX) { w = len; d = th; x = sg > 0 ? p.x : p.x - len; z = p.z - th / 2; } else { w = th; d = len; x = p.x - th / 2; z = sg > 0 ? p.z : p.z - len; }
    } else {
      w = L.a ? v.a : D.defTh; d = L.b ? v.b : D.defTh; x = p.x - w / 2; z = p.z - d / 2;
    }
    if (!(w > 0.004 && d > 0.004 && h > 0.004)) return null;
    var elev = D.hard ? (S.set.snapBase === 'top' ? p.y - h : p.y) : D.defElev;
    o = newObj(D.typ, x, z, w, d, elev, h);
    return o;
  }
  function liveVals(o) {
    var r = {};
    if (D.tool === 'rect') { r.w = o.w; r.d = o.d; r.h = o.h; } else if (D.tool === 'line') { r.len = D.dir ? D.dir.len : 0; r.h = o.h; r.th = D.dir && D.dir.alongX ? o.d : o.w; } else { r.a = o.w; r.b = o.d; r.h = o.h; }
    return r;
  }
  function updateDraft() {
    var o = draftObj(); setPreview(o);
    if (!o) return;
    var lv = liveVals(o), inputs = $('m3dDim').querySelectorAll('input[data-k]');
    Array.prototype.forEach.call(inputs, function (inp) { var k = inp.getAttribute('data-k'); if (!D.lock[k] && lv[k] != null) inp.value = toU(lv[k]); });
  }
  function renderDim() {
    var el = $('m3dDim'); el.classList.add('on');
    el.innerHTML = FIELDS[D.tool].map(function (f) { return '<label>' + f[1] + ' (' + S.set.unit + ')<input data-k="' + f[0] + '" inputmode="decimal" autocomplete="off"></label>'; }).join('') + '<span class="m3d-dimhint">Tab: ô kế · Enter: xong · Esc: huỷ</span>';
    var first = el.querySelector('input'); if (first) { first.focus(); first.select(); }
  }
  function commitDraft() {
    var o = draftObj(); if (!o) { cancelDraw(); return; }
    var wasLine = D.tool === 'line', keep = { h: D.lock.h ? D.vals.h : null, th: D.lock.th ? D.vals.th : null }, dir = D.dir, p1 = D.p1, hard = D.hard, tool = D.tool;
    setPreview(null);
    addObj(o);
    if (wasLine && dir) { // vẽ nối tiếp: điểm cuối thành điểm đầu đoạn kế
      var ex = dir.alongX ? (dir.sg > 0 ? o.x + o.w : o.x) : o.x + o.w / 2, ez = dir.alongX ? o.z + o.d / 2 : (dir.sg > 0 ? o.z + o.d : o.z);
      D = { tool: tool, p1: { x: ex, y: p1.y, z: ez }, hard: hard, mouse: { x: ex, z: ez }, vals: {}, lock: {}, typ: o.type, defH: o.h, defTh: dir.alongX ? o.d : o.w, defElev: o.y };
      renderDim(); if (keep.h != null) { var ih = $('m3dDim').querySelector('[data-k=h]'); if (ih) { ih.value = toU(keep.h); D.vals.h = keep.h; D.lock.h = true; ih.classList.add('lk'); } }
      if (keep.th != null) { var it = $('m3dDim').querySelector('[data-k=th]'); if (it) { it.value = toU(keep.th); D.vals.th = keep.th; D.lock.th = true; it.classList.add('lk'); } }
      status('Tiếp tục đoạn kế (Esc để dừng).'); updateDraft();
    } else { cancelDraw(); }
  }
  function bindDim() {
    var el = $('m3dDim');
    el.addEventListener('input', function (e) {
      var inp = e.target.closest('input[data-k]'); if (!inp || !D) return;
      var k = inp.getAttribute('data-k'), v = fromU(pn(inp.value));
      if (inp.value.trim() === '' || !(v > 0)) { D.lock[k] = false; inp.classList.remove('lk'); } else { D.vals[k] = v; D.lock[k] = true; inp.classList.add('lk'); }
      updateDraft();
    });
    el.addEventListener('keydown', function (e) {
      var inputs = Array.prototype.slice.call(el.querySelectorAll('input[data-k]')), i = inputs.indexOf(e.target);
      if (e.key === 'Tab') { e.preventDefault(); var n = inputs[(i + (e.shiftKey ? inputs.length - 1 : 1)) % inputs.length]; if (n) { n.focus(); n.select(); } }
      else if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelDraw(); }
    });
  }

  // ---------- thao tác chuột ----------
  var drag = null;
  function bindPointer(cv) {
    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var tool = S.tool;
      if (tool === 'select') { var id = pick(e); S.sel = id; paintSel(); refreshUI(); return; }
      if (tool === 'move' || tool === 'pull') {
        var id2 = pick(e); if (!id2) { S.sel = null; paintSel(); refreshUI(); return; }
        S.sel = id2; paintSel(); refreshUI();
        var o = getObj(id2); if (o.kind === 'mesh') { status('Cấu kiện nhập từ file chỉ để tính khối lượng, không sửa hình khối.'); return; }
        snapshot(); cv.setPointerCapture(e.pointerId);
        if (tool === 'move') { drag = { mode: 'move', id: id2, start: groundHit(e, o.y), ox: o.x, oz: o.z }; }
        else {
          var dir = new T.Vector3(); camera.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
          drag = { mode: 'pull', id: id2, plane: new T.Plane() }; drag.plane.setFromNormalAndCoplanarPoint(dir.clone().negate(), new T.Vector3(o.x + o.w / 2, o.y + o.h, o.z + o.d / 2));
        }
        return;
      }
      // công cụ vẽ: rect / line / point
      var s = snapAt(e); if (!s) return;
      if (!D) { beginDraw(tool, s); return; }
      if (D.tool === 'point') { commitDraft(); return; }
      D.mouse = { x: s.x, z: s.z }; updateDraft(); commitDraft();
    });
    cv.addEventListener('pointermove', function (e) {
      if (drag) {
        if (drag.mode === 'move') {
          var o = getObj(drag.id), h = groundHit(e, o.y); if (!h || !drag.start) return; var g = S.set.grid;
          o.x = Math.round((drag.ox + h.x - drag.start.x) / g) * g; o.z = Math.round((drag.oz + h.z - drag.start.z) / g) * g; rebuildOne(o); updateFields(o);
        } else {
          raycaster.setFromCamera(ndc(e), camera); var p = new T.Vector3(); if (!raycaster.ray.intersectPlane(drag.plane, p)) return;
          var o3 = getObj(drag.id), nh = Math.round((p.y - o3.y) / 0.01) * 0.01; if (nh < 0.01) nh = 0.01; o3.h = Math.round(nh * 1000) / 1000; rebuildOne(o3); updateFields(o3); status('Cao Z = ' + toU(o3.h) + ' ' + S.set.unit);
        }
        return;
      }
      if (S.tool !== 'rect' && S.tool !== 'line' && S.tool !== 'point') return;
      var s = snapAt(e); showMarker(s); if (!s) return;
      if (D) { if (D.tool !== 'point') { D.mouse = { x: s.x, z: s.z }; updateDraft(); } }
      else status('Điểm: X ' + toU(s.x) + ' · Y ' + toU(s.z) + ' · Z ' + toU(s.y) + ' ' + S.set.unit + (s.hard ? ' — bắt ' + s.kind : ' — lưới'));
    });
    cv.addEventListener('pointerup', function () { if (drag) { drag = null; refreshUI(); save(); status(''); } });
    cv.addEventListener('pointerleave', function () { if (!D) showMarker(null); });
    cv.addEventListener('dblclick', function () { if (D && D.tool === 'line') cancelDraw(); });
  }
  // KHÔNG còn phím tắt chọn công cụ (V/M/P/R/W đã bỏ). Chỉ giữ: Esc huỷ, Delete xoá, Ctrl+Z hoàn tác; đang vẽ thì gõ số là vào ô kích thước.
  document.addEventListener('keydown', function (e) {
    if (!inited || !$('m3dCanvasWrap').offsetParent) return;
    var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (e.key === 'Escape' && D) { cancelDraw(); return; }
    if (D && !typing && /^[0-9.,]$/.test(e.key)) { var f = $('m3dDim').querySelector('input[data-k]'); if (f) f.focus(); return; }
    if (typing) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); delSel(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
  function delSel() { if (!S.sel) return; snapshot(); S.objects = S.objects.filter(function (o) { return o.id !== S.sel; }); S.sel = null; cands = null; rebuildAll(); refreshUI(); save(); }
  function dupSel() { var o = getObj(S.sel); if (!o || o.kind === 'mesh') return; snapshot(); var c = JSON.parse(JSON.stringify(o)); c.id = 'm' + Date.now() + (seq++); c.name = o.name + ' (bản sao)'; c.x += 1; c.z += 1; S.objects.push(c); S.sel = c.id; rebuildOne(c); refreshUI(); save(); }
  var TOOL_HINT = { select: 'Bấm cấu kiện để chọn.', move: 'Kéo cấu kiện trên mặt bằng.', pull: 'Kéo cấu kiện lên/xuống để đổi chiều cao Z.', rect: 'Bắt điểm góc → gõ Dài X, Rộng Y, Cao Z (Tab đổi ô, Enter xong).', line: 'Bắt điểm đầu → gõ Dài, Cao, Dày (loại tường/dầm/giằng/lanh tô; Tab đổi ô, Enter xong, vẽ nối tiếp được).', point: 'Bắt điểm đặt cột / cổ móng → gõ tiết diện và chiều cao (Enter xong).' };
  function setTool(t) { S.tool = t; cancelDraw(); Array.prototype.forEach.call(document.querySelectorAll('.m3d-tool'), function (b) { b.classList.toggle('active', b.getAttribute('data-tool') === t); }); status(TOOL_HINT[t] || ''); }

  // ---------- chế độ xem ----------
  function bboxAll() { var b = new T.Box3(); Object.keys(objMeshes).forEach(function (k) { b.expandByObject(objMeshes[k]); }); if (b.isEmpty()) b.set(new T.Vector3(-5, 0, -5), new T.Vector3(5, 3, 5)); return b; }
  function view(kind) {
    var b = bboxAll(), c = b.getCenter(new T.Vector3()), sz = b.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z, 4) * 1.4;
    controls.target.copy(c);
    var pos = { top: [0.001, 1, 0], front: [0, 0.35, 1], right: [1, 0.35, 0], iso: [0.8, 0.65, 0.9] }[kind] || [0.8, 0.65, 0.9];
    camera.position.set(c.x + pos[0] * r * 1.6, c.y + pos[1] * r * 1.6, c.z + pos[2] * r * 1.6); camera.lookAt(c); controls.update(); dirty = true;
  }

  // ---------- giao diện bảng ----------
  function syncSettingsUI() {
    if (!$('m3dType')) return;
    $('m3dType').value = S.set.type; $('m3dUnit').value = S.set.unit; $('m3dGrid').value = String(S.set.grid);
    $('m3dElev').value = toU(S.set.elev); $('m3dH').value = toU(S.set.h); $('m3dThick').value = toU(S.set.thick);
    ['m3dElev', 'm3dH', 'm3dThick'].forEach(function (id) { $(id).step = ustep(); });
    $('m3dSnap3d').value = S.set.snap3d ? '1' : '0'; $('m3dSnapBase').value = S.set.snapBase || 'bottom';
    Array.prototype.forEach.call(document.querySelectorAll('.m3d-u'), function (s) { s.textContent = '(' + S.set.unit + ')'; });
  }
  function typeOptions(sel, skipMesh) { return Object.keys(TYPES).filter(function (k) { return !(skipMesh && k === 'mesh'); }).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + TYPES[k].label + '</option>'; }).join(''); }
  function refreshUI() { renderProps(); renderSummary(); paintSel(); }
  function updateFields(o) { ['x', 'y', 'z', 'w', 'd', 'h'].forEach(function (k) { var el = $('m3dF_' + k); if (el && document.activeElement !== el) el.value = toU(o[k]); }); renderMetricsLine(o); }
  function renderMetricsLine(o) { var M = metrics()[o.id] || {}, el = $('m3dMetrics'); if (el) el.innerHTML = 'V = <b>' + f2(M.V) + ' m³</b> · A = <b>' + f2(M.A) + ' m²</b> · W = <b>' + f2(M.W) + ' m²</b> · L = <b>' + f2(M.L) + ' m</b>'; }
  function itemPicker(prefix, cur) {
    return '<div class="m3d-item"><input class="pr-input m3d-itsearch" data-pk="' + prefix + '" placeholder="Gõ để tìm hạng mục DG-*…" value="' + esc(cur ? cur.name : '') + '" autocomplete="off">' + (cur ? '<div class="m3d-itinfo">' + esc((cur.code ? cur.code + ' · ' : '') + fm(priceOf(cur)) + ' ₫/' + (cur.unit || '')) + '</div>' : '') + '</div>';
  }
  function renderProps() {
    var o = getObj(S.sel), el = $('m3dProps');
    if (!o) { el.innerHTML = '<div class="m3d-hint">Chọn một cấu kiện trong khung 3D hoặc trong bảng để sửa kích thước và gán đơn giá. Vẽ: chọn công cụ → bắt điểm → gõ kích thước (Tab đổi ô, Enter xong). Del xoá · Ctrl+Z hoàn tác · Esc huỷ.</div>'; return; }
    var isMesh = o.kind === 'mesh', ef = effItem(o), basis = o.basis || (ef ? ef.basis : (TYPES[o.type] || TYPES.other).basis), u = '(' + S.set.unit + ')';
    var num = function (k, lab) { return '<label>' + lab + '<input class="pr-input" id="m3dF_' + k + '" data-pf="' + k + '" type="number" step="' + ustep() + '" value="' + toU(o[k]) + '"' + (isMesh ? ' disabled' : '') + '></label>'; };
    el.innerHTML = '<div class="m3d-ptitle">Cấu kiện đang chọn</div>' +
      '<label>Tên<input class="pr-input" data-pf="name" value="' + esc(o.name) + '"></label>' +
      '<label>Loại<select class="pr-input" data-pf="type"' + (isMesh ? ' disabled' : '') + '>' + typeOptions(o.type, !isMesh) + '</select></label>' +
      (isMesh ? '<div class="m3d-hint">Nhập từ file · nhóm vật liệu: <b>' + esc(o.mat || '—') + '</b>. Chỉ dùng để tính khối lượng.</div>' :
        '<div class="m3d-grid3">' + num('x', 'X ' + u) + num('z', 'Y ' + u) + num('y', 'Z đáy ' + u) + num('w', 'Dài X ' + u) + num('d', 'Rộng Y ' + u) + num('h', 'Cao Z ' + u) + '</div>') +
      '<div class="m3d-metrics" id="m3dMetrics"></div>' +
      '<div class="m3d-ptitle" style="margin-top:12px">Gán đơn giá (DG-*)</div>' + itemPicker('obj', o.item) +
      '<label>Tính khối lượng theo<select class="pr-input" data-pf="basis"><option value="">' + (ef && !o.item ? '(theo loại: ' + BASIS[basis] + ')' : 'Mặc định theo loại') + '</option>' + Object.keys(BASIS).map(function (b) { return '<option value="' + b + '"' + (o.basis === b ? ' selected' : '') + '>' + BASIS[b] + '</option>'; }).join('') + '</select></label>' +
      '<div class="m3d-pbtn"><button type="button" class="pr-btn pr-btn-sm" id="m3dDup"' + (isMesh ? ' disabled' : '') + '>Nhân bản</button><button type="button" class="pr-btn pr-btn-sm" id="m3dDel">Xoá</button>' + (o.item ? '<button type="button" class="pr-btn pr-btn-sm" id="m3dUnitem">Bỏ gán</button>' : '') + '</div>';
    renderMetricsLine(o);
  }
  function renderSummary() {
    var M = metrics(), rows = '', byType = {};
    S.objects.forEach(function (o) { if (M[o.id].open) { var t0 = byType.opening = byType.opening || { n: 0, V: 0, A: 0, W: 0, L: 0 }; t0.n++; return; } var t = byType[o.type] = byType[o.type] || { n: 0, V: 0, A: 0, W: 0, L: 0 }; t.n++; ['V', 'A', 'W', 'L'].forEach(function (k) { t[k] += M[o.id][k]; }); });
    Object.keys(TYPES).forEach(function (k) {
      if (!byType[k]) return; var t = byType[k], ti = S.typeItems[k] || {}, basis = ti.basis || TYPES[k].basis, q = t[basis] || 0, pr = ti.item ? priceOf(ti.item) : 0, amt = q * pr;
      if (k === 'opening') { rows += '<tr><td>' + TYPES[k].label + '</td><td class="num">' + t.n + '</td><td colspan="8" class="m3d-muted">Chỉ dùng để trừ vào tường (không tính vật liệu)</td></tr>'; return; }
      rows += '<tr data-type="' + k + '"><td><b>' + TYPES[k].label + '</b></td><td class="num">' + t.n + '</td><td class="num">' + f2(t.V) + '</td><td class="num">' + f2(t.A) + '</td><td class="num">' + f2(t.W) + '</td><td class="num">' + f2(t.L) + '</td>' +
        '<td>' + itemPicker('type:' + k, ti.item) + '</td><td><select class="pr-input m3d-bs" data-bt="' + k + '">' + Object.keys(BASIS).map(function (b) { return '<option value="' + b + '"' + (basis === b ? ' selected' : '') + '>' + BASIS_UNIT[b] + ' — ' + BASIS[b].split(' (')[0] + '</option>'; }).join('') + '</select></td>' +
        '<td class="num">' + (ti.item ? f2(q) + ' ' + BASIS_UNIT[basis] : '—') + '</td><td class="num m3d-amt">' + (ti.item ? fm(amt) : '—') + '</td></tr>';
    });
    $('m3dSumRows').innerHTML = rows || '<tr><td colspan="10" class="m3d-muted" style="padding:22px;text-align:center">Chưa có cấu kiện. Dùng công cụ Chữ nhật / Đường / Điểm để vẽ, hoặc Nhập file .dae/.obj từ SketchUp.</td></tr>';
    $('m3dTotal').textContent = fm(groups().reduce(function (s, g) { return s + g.qty * priceOf(g.item); }, 0));
    $('m3dList').innerHTML = S.objects.map(function (o) { var mm = M[o.id]; return '<div class="m3d-li' + (o.id === S.sel ? ' on' : '') + '" data-oid="' + o.id + '"><span class="m3d-dot" style="background:#' + (TYPES[o.type] || TYPES.other).color.toString(16).padStart(6, '0') + '"></span><span class="nm">' + esc(o.name) + '</span><span class="v">' + (mm.open ? 'lỗ mở' : f2(mm.V) + ' m³') + '</span></div>'; }).join('') || '<div class="m3d-muted" style="padding:8px">Chưa có cấu kiện</div>';
  }

  // ---------- tìm hạng mục DG-* ----------
  function loadEntries() {
    var p = province(); if (!p) { entries = []; return Promise.resolve(); }
    if (entriesProv === p && entries.length) return Promise.resolve();
    return PriceLookup.loadProvince(p).then(function (it) { entries = it || []; entriesProv = p; });
  }
  var box = null, boxFor = null;
  function closeBox() { if (box) { box.remove(); box = null; boxFor = null; } }
  function openBox(inp) {
    var q = inp.value.trim(); if (q.length < 2) { closeBox(); return; }
    var list = PriceLookup.search(entries, q, 12);
    if (!box) { box = document.createElement('div'); box.className = 'boq-sug'; document.body.appendChild(box); }
    boxFor = inp; var r = inp.getBoundingClientRect(), w = Math.max(r.width, 420);
    box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px'; box.style.top = (r.bottom + 4) + 'px'; box.style.width = w + 'px';
    box.innerHTML = list.length ? list.map(function (e, i) { return '<div class="it" data-i="' + i + '"><div class="nm"><span class="tg">' + esc(e.kind || '') + '</span>' + esc(e.name) + '</div><div class="pr">' + fm(priceOf(e)) + ' ₫/' + esc(e.unit || '') + '</div><div class="mt">' + esc((e.code ? e.code + ' · ' : '') + (e.spec || '')) + '</div></div>'; }).join('') : '<div class="em">Không thấy hạng mục khớp (chọn tỉnh/thành ở đầu trang).</div>';
    box._list = list;
  }
  function basisForUnit(unit, type) {
    var u = String(unit || '').toLowerCase().replace(/\s/g, '');
    if (/m3|m³/.test(u)) return 'V';
    if (/m2|m²/.test(u)) return type === 'wall' ? 'W' : 'A';
    if (/^(m|md|mét)$/.test(u)) return 'L';
    if (/cái|bộ|chiếc|cây|tấm|điểm/.test(u)) return 'N';
    return '';
  }
  function pickItem(pk, e) {
    var it = { code: e.code || '', name: e.name, unit: e.unit || '', low: e.low, high: e.high, kind: e.kind || '' };
    snapshot();
    if (pk === 'obj') { var o = getObj(S.sel); if (o) { o.item = it; o.basis = basisForUnit(it.unit, o.type) || ''; } }
    else { var t = pk.slice(5); S.typeItems[t] = S.typeItems[t] || {}; S.typeItems[t].item = it; S.typeItems[t].basis = basisForUnit(it.unit, t) || (TYPES[t] || TYPES.other).basis; }
    save(); refreshUI();
  }

  // ---------- xuất / nhập ----------
  function download(name, text, mime) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function boxTris(o) {
    var x0 = o.x, x1 = o.x + o.w, y0 = o.y, y1 = o.y + o.h, z0 = o.z, z1 = o.z + o.d;
    var v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    var f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
    return { v: v, f: f };
  }
  function exportDae() {
    var objs = S.objects.filter(function (o) { return o.kind !== 'mesh' && o.type !== 'opening'; });
    if (!objs.length) { alert('Chưa có cấu kiện để xuất.'); return; }
    var fx = '', mt = '', geo = '', nodes = '';
    Object.keys(TYPES).forEach(function (k) {
      var c = TYPES[k].color, r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
      fx += '<effect id="fx_' + k + '"><profile_COMMON><technique sid="common"><lambert><diffuse><color>' + r.toFixed(3) + ' ' + g.toFixed(3) + ' ' + b.toFixed(3) + ' 1</color></diffuse></lambert></technique></profile_COMMON></effect>';
      mt += '<material id="mat_' + k + '" name="' + TYPES[k].label + '"><instance_effect url="#fx_' + k + '"/></material>';
    });
    objs.forEach(function (o, i) {
      var t = boxTris(o);
      // Z lên như SketchUp: (x, Y mặt bằng = z nội bộ, Z cao = y nội bộ); đổi trục đảo chiều nên đảo thứ tự đỉnh mặt
      var pos = t.v.map(function (p) { return [p[0], p[2], p[1]].map(function (n) { return n.toFixed(4); }).join(' '); }).join(' '), idx = t.f.map(function (f) { return [f[0], f[2], f[1]].join(' '); }).join(' ');
      var gid = 'geo' + i, nm = String(o.name).replace(/[<>&"]/g, '');
      geo += '<geometry id="' + gid + '" name="' + nm + '"><mesh><source id="' + gid + '-pos"><float_array id="' + gid + '-arr" count="24">' + pos + '</float_array><technique_common><accessor source="#' + gid + '-arr" count="8" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>' +
        '<vertices id="' + gid + '-v"><input semantic="POSITION" source="#' + gid + '-pos"/></vertices><triangles material="m" count="12"><input semantic="VERTEX" source="#' + gid + '-v" offset="0"/><p>' + idx + '</p></triangles></mesh></geometry>';
      nodes += '<node id="n' + i + '" name="' + nm + '"><instance_geometry url="#' + gid + '"><bind_material><technique_common><instance_material symbol="m" target="#mat_' + o.type + '"/></technique_common></bind_material></instance_geometry></node>';
    });
    var xml = '<?xml version="1.0" encoding="utf-8"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>HICONIQUE Hub</authoring_tool></contributor><unit meter="1" name="meter"/><up_axis>Z_UP</up_axis></asset>' +
      '<library_effects>' + fx + '</library_effects><library_materials>' + mt + '</library_materials><library_geometries>' + geo + '</library_geometries><library_visual_scenes><visual_scene id="Scene" name="Scene">' + nodes + '</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#Scene"/></scene></COLLADA>';
    download('mo-hinh-hiconique.dae', xml, 'model/vnd.collada+xml');
  }
  function exportObj() {
    var objs = S.objects.filter(function (o) { return o.kind !== 'mesh' && o.type !== 'opening'; }); if (!objs.length) { alert('Chưa có cấu kiện để xuất.'); return; }
    var out = '# HICONIQUE Hub (m, Y lên)\n', off = 0;
    objs.forEach(function (o) { var t = boxTris(o); out += 'o ' + String(o.name).replace(/\s+/g, '_') + '\n'; t.v.forEach(function (p) { out += 'v ' + p.join(' ') + '\n'; }); t.f.forEach(function (f) { out += 'f ' + f.map(function (i) { return i + 1 + off; }).join(' ') + '\n'; }); off += 8; });
    download('mo-hinh-hiconique.obj', out);
  }
  function exportCsv() {
    var M = metrics(), L = [['Tên', 'Loại', 'Dài X (m)', 'Rộng Y (m)', 'Cao Z (m)', 'Thể tích m3', 'DT mặt trên m2', 'DT mặt tường m2', 'Chiều dài m', 'Hạng mục DG', 'Mã', 'Cơ sở', 'Khối lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền']];
    S.objects.forEach(function (o) { var m = M[o.id], e = effItem(o), q = e ? m[e.basis] || 0 : 0, pr = e ? priceOf(e.item) : 0; L.push([o.name, (TYPES[o.type] || {}).label, o.w || '', o.d || '', o.h || '', f2(m.V), f2(m.A), f2(m.W), f2(m.L), e ? e.item.name : '', e ? e.item.code : '', e ? BASIS_UNIT[e.basis] : '', e ? f2(q) : '', e ? e.item.unit : '', e ? pr : '', e ? Math.round(q * pr) : '']); });
    download('khoi-luong-mo-hinh.csv', '﻿' + L.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n'), 'text/csv;charset=utf-8');
  }
  function importFile(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['dae', 'obj'].indexOf(ext) < 0) { alert('Chỉ nhập được .dae (COLLADA) hoặc .obj. Trong SketchUp: File > Export > 3D Model > COLLADA (.dae). File .skp trình duyệt không đọc được.'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var root;
        if (ext === 'dae') root = new T.ColladaLoader().parse(rd.result, '').scene; else root = new T.OBJLoader().parse(rd.result);
        root.updateMatrixWorld(true);
        var groupsByMat = {}, scale = pn($('m3dImpScale').value) || 1;
        root.traverse(function (m) {
          if (!m.isMesh || !m.geometry) return;
          var g = m.geometry.clone().applyMatrix4(m.matrixWorld); if (scale !== 1) g.scale(scale, scale, scale);
          var mat = Array.isArray(m.material) ? m.material[0] : m.material, mname = (mat && mat.name) || m.name || 'Không tên';
          var pos = g.getAttribute('position'), idx = g.index ? g.index.array : null, n = idx ? idx.length : pos.count;
          var gp = groupsByMat[mname] = groupsByMat[mname] || { V: 0, A: 0, W: 0, S: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], verts: [] };
          var a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3(), nrm = new T.Vector3();
          for (var i = 0; i < n; i += 3) {
            var ia = idx ? idx[i] : i, ib = idx ? idx[i + 1] : i + 1, ic = idx ? idx[i + 2] : i + 2;
            a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
            gp.V += a.dot(nrm.copy(b).cross(c)) / 6;
            e1.copy(b).sub(a); e2.copy(c).sub(a); nrm.copy(e1).cross(e2); var ar = nrm.length() / 2; if (ar < 1e-12) continue; nrm.normalize();
            gp.S += ar; if (nrm.y > 0.7) gp.A += ar; else if (Math.abs(nrm.y) < 0.3) gp.W += ar;
            [a, b, c].forEach(function (p) { ['x', 'y', 'z'].forEach(function (k, j) { if (p[k] < gp.min[j]) gp.min[j] = p[k]; if (p[k] > gp.max[j]) gp.max[j] = p[k]; }); gp.verts.push(Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000, Math.round(p.z * 1000) / 1000); });
          }
        });
        var names = Object.keys(groupsByMat); if (!names.length) { alert('Không đọc được hình khối nào trong file.'); return; }
        snapshot();
        names.forEach(function (nm) {
          var gp = groupsByMat[nm];
          S.objects.push({ id: 'm' + Date.now() + (seq++), kind: 'mesh', type: 'mesh', name: 'Nhóm: ' + nm, mat: nm, V: Math.abs(gp.V), A: gp.A, W: gp.W, L: Math.max(gp.max[0] - gp.min[0], gp.max[2] - gp.min[2]), bbox: { min: gp.min, max: gp.max }, geo: gp.verts.length <= 60000 ? gp.verts : null, item: null, basis: '' });
        });
        rebuildAll(); refreshUI(); save(); view('iso');
        status('Đã nhập ' + names.length + ' nhóm vật liệu từ ' + file.name + '. Gán đơn giá DG-* cho từng nhóm ở bảng bên dưới.');
      } catch (er) { console.error(er); alert('Không đọc được file: ' + (er && er.message || er)); }
    };
    rd.readAsText(file);
  }
  function pushToBoq() {
    var gs = groups(); if (!gs.length) { alert('Chưa gán đơn giá DG-* cho cấu kiện/loại nào.'); return; }
    if (!window.HiconiqueBoq) { alert('Tab Dự toán xây dựng chưa sẵn sàng.'); return; }
    gs.forEach(function (g) { if (g.qty > 0) window.HiconiqueBoq.addLine(g.item, Math.round(g.qty * 100) / 100); });
    alert('Đã đưa ' + gs.length + ' hạng mục sang tab "Dự toán xây dựng" (khối lượng lấy từ mô hình).');
  }

  // ---------- sự kiện giao diện ----------
  function bindUI() {
    Array.prototype.forEach.call(document.querySelectorAll('.m3d-tool'), function (b) { b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); }); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-m3dview]'), function (b) { b.addEventListener('click', function () { if (inited) view(b.getAttribute('data-m3dview')); }); });
    $('m3dType').innerHTML = typeOptions(S.set.type, true);
    $('m3dType').addEventListener('change', function () { S.set.type = this.value; var t = TYPES[this.value]; S.set.elev = t.elev; S.set.h = t.h; if (t.sec) S.set.thick = t.sec; syncSettingsUI(); save(); });
    $('m3dUnit').addEventListener('change', function () { S.set.unit = this.value; syncSettingsUI(); renderProps(); save(); });
    [['m3dElev', 'elev'], ['m3dH', 'h'], ['m3dThick', 'thick']].forEach(function (p) { $(p[0]).addEventListener('input', function () { var v = fromU(pn(this.value)); if (p[1] === 'elev' || v > 0) { S.set[p[1]] = v; save(); } }); });
    $('m3dGrid').addEventListener('change', function () { S.set.grid = pn(this.value) || 0.1; save(); });
    $('m3dSnap3d').addEventListener('change', function () { S.set.snap3d = this.value === '1' ? 1 : 0; save(); });
    $('m3dSnapBase').addEventListener('change', function () { S.set.snapBase = this.value; save(); });
    $('m3dUndo').addEventListener('click', undo);
    $('m3dDae').addEventListener('click', exportDae); $('m3dObj').addEventListener('click', exportObj); $('m3dCsv').addEventListener('click', exportCsv);
    $('m3dImport').addEventListener('click', function () { $('m3dFile').click(); });
    $('m3dFile').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f && inited) importFile(f); });
    $('m3dPush').addEventListener('click', pushToBoq);
    $('m3dClear').addEventListener('click', function () { if (!S.objects.length || !confirm('Xoá toàn bộ mô hình của dự án này?')) return; snapshot(); S.objects = []; S.sel = null; cands = null; rebuildAll(); refreshUI(); save(); });
    $('m3dList').addEventListener('click', function (e) { var li = e.target.closest('.m3d-li'); if (li) { S.sel = li.getAttribute('data-oid'); refreshUI(); } });
    bindDim();
    var props = $('m3dProps');
    props.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-pf'); if (!k) { if (e.target.classList.contains('m3d-itsearch')) { loadEntries().then(function () { openBox(e.target); }); } return; }
      var o = getObj(S.sel); if (!o || k === 'type' || k === 'basis') return;
      if (k === 'name') o.name = e.target.value; else { var v = fromU(pn(e.target.value)); if (['w', 'd', 'h'].indexOf(k) >= 0 && v <= 0) return; o[k] = v; rebuildOne(o); renderMetricsLine(o); renderSummary(); }
      save();
    });
    props.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-pf'), o = getObj(S.sel); if (!o) return;
      if (k === 'type') { snapshot(); o.type = e.target.value; rebuildOne(o); refreshUI(); save(); }
      else if (k === 'basis') { o.basis = e.target.value; refreshUI(); save(); }
      else if (k && k !== 'name') { snapshot(); }
    });
    props.addEventListener('focusin', function (e) { if (e.target.classList.contains('m3d-itsearch')) loadEntries().then(function () { openBox(e.target); }); });
    props.addEventListener('click', function (e) {
      if (e.target.id === 'm3dDel') delSel(); else if (e.target.id === 'm3dDup') dupSel();
      else if (e.target.id === 'm3dUnitem') { var o = getObj(S.sel); if (o) { snapshot(); o.item = null; o.basis = ''; refreshUI(); save(); } }
    });
    var sum = $('m3dSumRows');
    sum.addEventListener('input', function (e) { if (e.target.classList.contains('m3d-itsearch')) loadEntries().then(function () { openBox(e.target); }); });
    sum.addEventListener('focusin', function (e) { if (e.target.classList.contains('m3d-itsearch')) loadEntries().then(function () { openBox(e.target); }); });
    sum.addEventListener('change', function (e) { var t = e.target.getAttribute('data-bt'); if (t) { S.typeItems[t] = S.typeItems[t] || {}; S.typeItems[t].basis = e.target.value; save(); renderSummary(); } });
    document.addEventListener('mousedown', function (e) {
      var it = e.target.closest && e.target.closest('.boq-sug .it');
      if (it && box && boxFor && box._list) { e.preventDefault(); var ent = box._list[Number(it.getAttribute('data-i'))], pk = boxFor.getAttribute('data-pk'); closeBox(); if (ent) pickItem(pk, ent); return; }
      if (box && !box.contains(e.target) && !(e.target.classList && e.target.classList.contains('m3d-itsearch'))) closeBox();
    });
  }

  // ---------- kích hoạt khi mở tab ----------
  var started = false;
  function start() {
    if (started) { if (inited) { resize(); dirty = true; } return; }
    started = true;
    $('m3dLoading').style.display = 'flex';
    ensureLibs().then(function () { $('m3dLoading').style.display = 'none'; init(); load(); refreshUI(); setTool(S.tool); view('iso'); }).catch(function (er) { started = false; $('m3dLoading').textContent = 'Không tải được thư viện 3D (cần Internet): ' + er.message; });
  }
  bindUI(); syncSettingsUI();
  Array.prototype.forEach.call(document.querySelectorAll('.pr-tab-btn'), function (b) { b.addEventListener('click', function () { if (b.getAttribute('data-tab') === 'model3d') setTimeout(start, 50); }); });
  var ps = $('prToolProjectSelect'); if (ps) ps.addEventListener('change', function () { if (inited) load(); });
  if (document.querySelector('.pr-tab-btn.active') && document.querySelector('.pr-tab-btn.active').getAttribute('data-tab') === 'model3d') setTimeout(start, 200);
})();
