/* Tab "Mô hình 3D" (pricing.html) — dựng nhanh mô hình nhà ở bằng khối (móng · tường · sàn · mái · lỗ mở) để LẤY KHỐI LƯỢNG, thao tác theo kiểu SketchUp.
   - Công cụ: Chọn · Di chuyển · Đẩy/Kéo (kéo chiều cao) · Hình chữ nhật (móng/sàn/mái/…) · Tường (vẽ đoạn thẳng ngang/dọc, có độ dày). Chuột giữa/phải = xoay, Shift+kéo = pan, lăn = zoom.
   - Mỗi cấu kiện có kích thước, thể tích V, diện tích mặt trên/đáy A, diện tích mặt tường 2 phía W (đã trừ lỗ mở cắt qua), chiều dài L. Gán hạng mục đơn giá DG-* (theo loại hoặc từng cấu kiện) + cơ sở tính → khối lượng, thành tiền → đẩy sang tab "Dự toán xây dựng".
   - Xuất COLLADA (.dae — SketchUp nhập trực tiếp), OBJ, CSV khối lượng. NHẬP .dae/.obj (từ SketchUp: File > Export > 3D Model > COLLADA) để tính V/A/W theo từng nhóm vật liệu rồi gán đơn giá.
   - File .skp là định dạng riêng của SketchUp, trình duyệt không ghi/đọc trực tiếp được → dùng .dae (SketchUp: File > Import > chọn .dae; Export > COLLADA để đưa ngược lại).
   Lưu theo từng dự án: localStorage 'pr-model:<id>'. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('m3dCanvasWrap')) return;

  var LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/ColladaLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js'];
  var TYPES = {
    foundation: { label: 'Móng', color: 0x9AA0A6, elev: -0.5, h: 0.5, basis: 'V' },
    wall: { label: 'Tường', color: 0xD9C9A8, elev: 0, h: 3.3, basis: 'V' },
    slab: { label: 'Sàn', color: 0x8FB3C9, elev: 3.3, h: 0.12, basis: 'A' },
    roof: { label: 'Mái', color: 0xC77B58, elev: 3.42, h: 0.1, basis: 'A' },
    opening: { label: 'Lỗ mở (cửa)', color: 0x6FA8DC, elev: 0.9, h: 1.2, basis: 'V' },
    other: { label: 'Khối khác', color: 0xB8A9C9, elev: 0, h: 1, basis: 'V' },
    mesh: { label: 'Nhập từ file', color: 0xC9C9C9, elev: 0, h: 1, basis: 'V' }
  };
  var BASIS = { V: 'Thể tích (m³)', A: 'Diện tích mặt trên/đáy (m²)', W: 'Diện tích mặt tường 2 phía (m²)', L: 'Chiều dài (m)', N: 'Số lượng (cái)' };
  var BASIS_UNIT = { V: 'm³', A: 'm²', W: 'm²', L: 'm', N: 'cái' };

  var S = { objects: [], typeItems: {}, set: { type: 'wall', elev: 0, h: 3.3, thick: 0.2, grid: 0.1 }, sel: null, tool: 'select' };
  var hist = [], seq = 0;
  var T, scene, camera, renderer, controls, ground, grid, objMeshes = {}, preview = null, raycaster, dirty = true, inited = false, loading = null;
  var entries = [], entriesProv = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f2(n) { return (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function fm(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  function pn(s) { var v = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(v) ? v : 0; }
  function key() { var el = $('prToolProjectSelect'); return 'pr-model:' + (el && el.value ? el.value : 'none'); }
  function province() { var el = $('prProvinceSelect'); return el ? el.value : ''; }
  function getObj(id) { return S.objects.filter(function (o) { return o.id === id; })[0]; }

  // ---------- lưu / hoàn tác ----------
  var saveTimer = null;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { try { localStorage.setItem(key(), JSON.stringify({ objects: S.objects, typeItems: S.typeItems, set: S.set })); } catch (e) { /* đầy bộ nhớ */ } }, 300); }
  function snapshot() { hist.push(JSON.stringify(S.objects)); if (hist.length > 60) hist.shift(); }
  function undo() { if (!hist.length) return; S.objects = JSON.parse(hist.pop()); S.sel = null; rebuildAll(); refreshUI(); save(); }
  function load() {
    var o = null; try { o = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (e) {}
    S.objects = o && Array.isArray(o.objects) ? o.objects : []; S.typeItems = (o && o.typeItems) || {};
    if (o && o.set) Object.assign(S.set, o.set);
    S.sel = null; hist = [];
    if (inited) { rebuildAll(); refreshUI(); }
    syncSettingsUI();
  }

  // ---------- khối lượng ----------
  function ovVol(a, b) { var x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), z = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z); return x > 0 && y > 0 && z > 0 ? x * y * z : 0; }
  function metrics() {
    var M = {};
    S.objects.forEach(function (o) {
      if (o.kind === 'mesh') { M[o.id] = { V: o.V, A: o.A, W: o.W, L: o.L, N: 1 }; return; }
      M[o.id] = { V: o.w * o.d * o.h, A: o.w * o.d, W: 2 * Math.max(o.w, o.d) * o.h, L: Math.max(o.w, o.d), N: 1 };
    });
    var opens = S.objects.filter(function (o) { return o.type === 'opening' && o.kind !== 'mesh'; });
    S.objects.forEach(function (o) {
      if (o.type !== 'wall' || o.kind === 'mesh') return;
      var th = Math.min(o.w, o.d) || 1;
      opens.forEach(function (op) { var v = ovVol(o, op); if (v > 0) { M[o.id].V -= v; M[o.id].W -= 2 * v / th; } });
      M[o.id].V = Math.max(0, M[o.id].V); M[o.id].W = Math.max(0, M[o.id].W);
    });
    // lỗ mở không tính vào khối lượng vật liệu
    opens.forEach(function (op) { M[op.id] = { V: 0, A: 0, W: 0, L: 0, N: 0, open: true }; });
    return M;
  }
  function effItem(o) { if (o.item) return { item: o.item, basis: o.basis || (TYPES[o.type] || TYPES.other).basis }; var t = S.typeItems[o.type]; return t && t.item ? { item: t.item, basis: t.basis || (TYPES[o.type] || TYPES.other).basis } : null; }
  function groups() {
    var M = metrics(), g = {};
    S.objects.forEach(function (o) {
      var e = effItem(o); if (!e || M[o.id].open) return;
      var k = (e.item.code || '') + '|' + e.item.name + '|' + e.basis;
      var q = M[o.id][e.basis] || 0;
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
    camera = new T.PerspectiveCamera(45, 1, 0.1, 2000); camera.position.set(14, 11, 16);
    renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    wrap.appendChild(renderer.domElement); renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    scene.add(new T.AmbientLight(0xffffff, 0.75)); var dl = new T.DirectionalLight(0xffffff, 0.7); dl.position.set(10, 20, 8); scene.add(dl);
    grid = new T.GridHelper(60, 60, 0xaab2bd, 0xd0d6de); scene.add(grid);
    var axes = new T.AxesHelper(2); axes.position.y = 0.01; scene.add(axes);
    ground = new T.Mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ visible: false })); scene.add(ground);
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
    var T3 = T, ty = TYPES[o.type] || TYPES.other, g = new T3.Group(); g.userData.id = o.id;
    if (o.kind === 'mesh') {
      var b = o.bbox; var geo = new T3.BoxGeometry(Math.max(0.02, b.max[0] - b.min[0]), Math.max(0.02, b.max[1] - b.min[1]), Math.max(0.02, b.max[2] - b.min[2]));
      var m = new T3.Mesh(geo, new T3.MeshLambertMaterial({ color: ty.color, transparent: true, opacity: 0.35 }));
      m.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2); g.add(m);
      g.add(new T3.LineSegments(new T3.EdgesGeometry(geo), new T3.LineBasicMaterial({ color: 0x555555 }))); g.children[1].position.copy(m.position);
      if (o.geo && o.geo.length) { var gm = new T3.BufferGeometry(); gm.setAttribute('position', new T3.Float32BufferAttribute(o.geo, 3)); gm.computeVertexNormals(); g.remove(m); g.remove(g.children[0]); var mm = new T3.Mesh(gm, new T3.MeshLambertMaterial({ color: ty.color, side: T3.DoubleSide })); g.add(mm); }
      return g;
    }
    var geo2 = new T3.BoxGeometry(Math.max(0.001, o.w), Math.max(0.001, o.h), Math.max(0.001, o.d));
    var mat = new T3.MeshLambertMaterial({ color: ty.color, transparent: o.type === 'opening', opacity: o.type === 'opening' ? 0.45 : 1 });
    var mesh = new T3.Mesh(geo2, mat); g.add(mesh);
    var edges = new T3.LineSegments(new T3.EdgesGeometry(geo2), new T3.LineBasicMaterial({ color: 0x2b2f36 })); g.add(edges);
    g.position.set(o.x + o.w / 2, o.y + o.h / 2, o.z + o.d / 2);
    return g;
  }
  function rebuildAll() {
    if (!inited) return;
    Object.keys(objMeshes).forEach(function (k) { scene.remove(objMeshes[k]); }); objMeshes = {};
    S.objects.forEach(function (o) { var g = mkMesh(o); objMeshes[o.id] = g; scene.add(g); });
    paintSel(); dirty = true;
  }
  function rebuildOne(o) {
    if (!inited) return; if (objMeshes[o.id]) scene.remove(objMeshes[o.id]);
    var g = mkMesh(o); objMeshes[o.id] = g; scene.add(g); paintSel(); dirty = true;
  }
  function paintSel() {
    Object.keys(objMeshes).forEach(function (id) {
      var g = objMeshes[id], on = id === S.sel;
      g.traverse(function (c) { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(on ? 0x553300 : 0x000000); if (c.isLineSegments) c.material.color.setHex(on ? 0xff8800 : 0x2b2f36); });
    }); dirty = true;
  }

  // ---------- điểm bắt ----------
  function snapV(v, axis) {
    var g = S.set.grid, best = Math.round(v / g) * g, bd = Math.abs(best - v), th = Math.max(0.15, g);
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
  function pick(e) {
    raycaster.setFromCamera(ndc(e), camera);
    var meshes = []; Object.keys(objMeshes).forEach(function (id) { objMeshes[id].traverse(function (c) { if (c.isMesh) { c.userData.oid = id; meshes.push(c); } }); });
    var hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].object.userData.oid : null;
  }

  // ---------- tạo đối tượng ----------
  function newObj(type, x, z, w, d, elev, h) {
    var ty = TYPES[type] || TYPES.other;
    var o = { id: 'm' + Date.now() + (seq++), kind: 'box', type: type, name: ty.label + ' ' + (S.objects.filter(function (x) { return x.type === type; }).length + 1), x: x, y: elev, z: z, w: w, d: d, h: h, item: null, basis: '' };
    return o;
  }
  function addObj(o) { snapshot(); S.objects.push(o); rebuildOne(o); S.sel = o.id; paintSel(); refreshUI(); save(); }

  // ---------- thao tác chuột ----------
  var drag = null;
  function status(msg) { $('m3dStatus').textContent = msg || ''; }
  function setPreview(o) {
    if (preview) { scene.remove(preview); preview = null; }
    if (o) { preview = mkMesh(o); preview.traverse(function (c) { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; } }); scene.add(preview); }
    dirty = true;
  }
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
        if (tool === 'move') { var hit = groundHit(e, o.y); drag = { mode: 'move', id: id2, start: hit, ox: o.x, oz: o.z }; }
        else {
          var dir = new T.Vector3(); camera.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
          drag = { mode: 'pull', id: id2, plane: new T.Plane(dir.clone().negate(), dir.clone().negate().dot(new T.Vector3(o.x + o.w / 2, 0, o.z + o.d / 2)) * -1) };
          drag.plane.setFromNormalAndCoplanarPoint(dir.clone().negate(), new T.Vector3(o.x + o.w / 2, o.y + o.h, o.z + o.d / 2));
        }
        return;
      }
      var hit2 = groundHit(e, tool === 'rect' || tool === 'wall' ? 0 : 0); if (!hit2) return;
      var px = snapV(hit2.x, 'x'), pz = snapV(hit2.z, 'z');
      if (!drag) { drag = { mode: tool, x: px, z: pz }; status(tool === 'rect' ? 'Bấm điểm góc đối diện…' : 'Bấm điểm cuối của tường…'); return; }
      // điểm thứ 2
      var o2 = buildFromDrag(px, pz);
      setPreview(null);
      if (o2) { addObj(o2); }
      if (tool === 'wall' && o2) { drag = { mode: 'wall', x: px, z: pz }; status('Tiếp tục vẽ tường (Esc để dừng)…'); } else { drag = null; status(''); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) { if (S.tool === 'rect' || S.tool === 'wall') { var h0 = groundHit(e, 0); if (h0) status('Điểm: x ' + f2(snapV(h0.x, 'x')) + ' · z ' + f2(snapV(h0.z, 'z')) + ' m'); } return; }
      if (drag.mode === 'move') {
        var h = groundHit(e, getObj(drag.id).y); if (!h || !drag.start) return;
        var o = getObj(drag.id), g = S.set.grid;
        o.x = Math.round((drag.ox + h.x - drag.start.x) / g) * g; o.z = Math.round((drag.oz + h.z - drag.start.z) / g) * g;
        rebuildOne(o); updateFields(o); return;
      }
      if (drag.mode === 'pull') {
        raycaster.setFromCamera(ndc(e), camera); var p = new T.Vector3(); if (!raycaster.ray.intersectPlane(drag.plane, p)) return;
        var o3 = getObj(drag.id), nh = Math.round((p.y - o3.y) / 0.05) * 0.05; if (nh < 0.02) nh = 0.02; o3.h = Math.round(nh * 1000) / 1000;
        rebuildOne(o3); updateFields(o3); status('Chiều cao ' + f2(o3.h) + ' m'); return;
      }
      var hh = groundHit(e, 0); if (!hh) return;
      var px = snapV(hh.x, 'x'), pz = snapV(hh.z, 'z'), o4 = buildFromDrag(px, pz, true);
      setPreview(o4); if (o4) status((drag.mode === 'rect' ? 'Dài ' + f2(o4.w) + ' × Rộng ' + f2(o4.d) : 'Dài tường ' + f2(Math.max(o4.w, o4.d)) + ' · dày ' + f2(Math.min(o4.w, o4.d))) + ' m');
    });
    cv.addEventListener('pointerup', function (e) {
      if (drag && (drag.mode === 'move' || drag.mode === 'pull')) { drag = null; refreshUI(); save(); status(''); }
    });
    cv.addEventListener('dblclick', function () { if (drag && drag.mode === 'wall') { drag = null; setPreview(null); status(''); } });
  }
  function buildFromDrag(px, pz, isPreview) {
    var st = S.set, type = drag.mode === 'wall' ? 'wall' : st.type;
    if (drag.mode === 'rect') {
      var w = Math.abs(px - drag.x), d = Math.abs(pz - drag.z); if (w < 0.05 || d < 0.05) return null;
      return newObj(type, Math.min(px, drag.x), Math.min(pz, drag.z), w, d, st.elev, st.h);
    }
    var dx = Math.abs(px - drag.x), dz = Math.abs(pz - drag.z), th = st.thick || 0.2;
    if (Math.max(dx, dz) < 0.05) return null;
    if (dx >= dz) return newObj('wall', Math.min(px, drag.x) - 0, drag.z - th / 2, dx, th, st.type === 'wall' ? st.elev : 0, st.type === 'wall' ? st.h : 3.3);
    return newObj('wall', drag.x - th / 2, Math.min(pz, drag.z), th, dz, st.type === 'wall' ? st.elev : 0, st.type === 'wall' ? st.h : 3.3);
  }
  document.addEventListener('keydown', function (e) {
    if (!inited || !$('m3dCanvasWrap').offsetParent) return;
    var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'Escape') { drag = null; setPreview(null); status(''); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); delSel(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (!e.ctrlKey) { var m = { v: 'select', m: 'move', p: 'pull', r: 'rect', w: 'wall' }[e.key.toLowerCase()]; if (m) setTool(m); }
  });
  function delSel() { if (!S.sel) return; snapshot(); S.objects = S.objects.filter(function (o) { return o.id !== S.sel; }); S.sel = null; rebuildAll(); refreshUI(); save(); }
  function dupSel() { var o = getObj(S.sel); if (!o || o.kind === 'mesh') return; snapshot(); var c = JSON.parse(JSON.stringify(o)); c.id = 'm' + Date.now() + (seq++); c.name = o.name + ' (bản sao)'; c.x += 1; c.z += 1; S.objects.push(c); S.sel = c.id; rebuildOne(c); refreshUI(); save(); }
  function setTool(t) { S.tool = t; drag = null; setPreview(null); Array.prototype.forEach.call(document.querySelectorAll('.m3d-tool'), function (b) { b.classList.toggle('active', b.getAttribute('data-tool') === t); }); status({ select: 'Bấm cấu kiện để chọn.', move: 'Kéo cấu kiện trên mặt phẳng.', pull: 'Kéo lên/xuống để đổi chiều cao.', rect: 'Bấm góc 1 rồi góc 2 (loại theo ô "Loại").', wall: 'Bấm điểm đầu, điểm cuối (tường ngang/dọc, dày theo ô "Dày").' }[t] || ''); }

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
    $('m3dType').value = S.set.type; $('m3dElev').value = S.set.elev; $('m3dH').value = S.set.h; $('m3dThick').value = S.set.thick; $('m3dGrid').value = S.set.grid;
  }
  function typeOptions(sel, skipMesh) { return Object.keys(TYPES).filter(function (k) { return !(skipMesh && k === 'mesh'); }).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + TYPES[k].label + '</option>'; }).join(''); }
  function refreshUI() { renderProps(); renderSummary(); paintSel(); }
  function updateFields(o) { ['x', 'y', 'z', 'w', 'd', 'h'].forEach(function (k) { var el = $('m3dF_' + k); if (el && document.activeElement !== el) el.value = Math.round(o[k] * 1000) / 1000; }); renderMetricsLine(o); }
  function renderMetricsLine(o) { var M = metrics()[o.id] || {}, el = $('m3dMetrics'); if (el) el.innerHTML = 'V = <b>' + f2(M.V) + ' m³</b> · A = <b>' + f2(M.A) + ' m²</b> · W = <b>' + f2(M.W) + ' m²</b> · L = <b>' + f2(M.L) + ' m</b>'; }
  function itemPicker(prefix, cur, onPick) {
    // ô tìm hạng mục DG-* + danh sách gợi ý; trả về HTML, gắn sự kiện qua delegation bên dưới
    return '<div class="m3d-item"><input class="pr-input m3d-itsearch" data-pk="' + prefix + '" placeholder="Gõ để tìm hạng mục DG-*…" value="' + esc(cur ? cur.name : '') + '" autocomplete="off">' + (cur ? '<div class="m3d-itinfo">' + esc((cur.code ? cur.code + ' · ' : '') + fm(priceOf(cur)) + ' ₫/' + (cur.unit || '')) + '</div>' : '') + '</div>';
  }
  function renderProps() {
    var o = getObj(S.sel), el = $('m3dProps');
    if (!o) { el.innerHTML = '<div class="m3d-hint">Chọn một cấu kiện trong khung 3D hoặc trong bảng để sửa kích thước và gán đơn giá. Phím tắt: V chọn · M di chuyển · P đẩy/kéo · R chữ nhật · W tường · Del xoá · Ctrl+Z hoàn tác.</div>'; return; }
    var isMesh = o.kind === 'mesh', ef = effItem(o), basis = o.basis || (ef ? ef.basis : (TYPES[o.type] || TYPES.other).basis);
    var num = function (k, lab) { return '<label>' + lab + '<input class="pr-input" id="m3dF_' + k + '" data-pf="' + k + '" type="number" step="0.05" value="' + Math.round(o[k] * 1000) / 1000 + '"' + (isMesh ? ' disabled' : '') + '></label>'; };
    el.innerHTML = '<div class="m3d-ptitle">Cấu kiện đang chọn</div>' +
      '<label>Tên<input class="pr-input" data-pf="name" value="' + esc(o.name) + '"></label>' +
      '<label>Loại<select class="pr-input" data-pf="type"' + (isMesh ? ' disabled' : '') + '>' + typeOptions(o.type, !isMesh) + '</select></label>' +
      (isMesh ? '<div class="m3d-hint">Nhập từ file · nhóm vật liệu: <b>' + esc(o.mat || '—') + '</b>. Chỉ dùng để tính khối lượng.</div>' :
        '<div class="m3d-grid3">' + num('x', 'X (m)') + num('z', 'Z (m)') + num('y', 'Cao độ đáy') + num('w', 'Dài X') + num('d', 'Rộng Z') + num('h', 'Cao') + '</div>') +
      '<div class="m3d-metrics" id="m3dMetrics"></div>' +
      '<div class="m3d-ptitle" style="margin-top:12px">Gán đơn giá (DG-*)</div>' + itemPicker('obj', o.item) +
      '<label>Tính khối lượng theo<select class="pr-input" data-pf="basis"><option value="">' + (ef && !o.item ? '(theo loại: ' + BASIS[basis] + ')' : 'Mặc định theo loại') + '</option>' + Object.keys(BASIS).map(function (b) { return '<option value="' + b + '"' + (o.basis === b ? ' selected' : '') + '>' + BASIS[b] + '</option>'; }).join('') + '</select></label>' +
      '<div class="m3d-pbtn"><button type="button" class="pr-btn pr-btn-sm" id="m3dDup"' + (isMesh ? ' disabled' : '') + '>Nhân bản</button><button type="button" class="pr-btn pr-btn-sm" id="m3dDel">Xoá</button>' + (o.item ? '<button type="button" class="pr-btn pr-btn-sm" id="m3dUnitem">Bỏ gán</button>' : '') + '</div>';
    renderMetricsLine(o);
  }
  function renderSummary() {
    var M = metrics(), rows = '', byType = {};
    S.objects.forEach(function (o) { if (M[o.id].open) { var t0 = byType.opening = byType.opening || { n: 0, V: 0, A: 0, W: 0, L: 0 }; t0.n++; return; } var t = byType[o.type] = byType[o.type] || { n: 0, V: 0, A: 0, W: 0, L: 0 }; t.n++; ['V', 'A', 'W', 'L'].forEach(function (k) { t[k] += M[o.id][k]; }); });
    var total = 0;
    Object.keys(TYPES).forEach(function (k) {
      if (!byType[k]) return; var t = byType[k], ti = S.typeItems[k] || {}, basis = ti.basis || TYPES[k].basis, q = t[basis] || 0, pr = ti.item ? priceOf(ti.item) : 0, amt = q * pr;
      if (k === 'opening') { rows += '<tr><td>' + TYPES[k].label + '</td><td class="num">' + t.n + '</td><td colspan="8" class="m3d-muted">Chỉ dùng để trừ vào tường (không tính vật liệu)</td></tr>'; return; }
      total += amt;
      rows += '<tr data-type="' + k + '"><td><b>' + TYPES[k].label + '</b></td><td class="num">' + t.n + '</td><td class="num">' + f2(t.V) + '</td><td class="num">' + f2(t.A) + '</td><td class="num">' + f2(t.W) + '</td><td class="num">' + f2(t.L) + '</td>' +
        '<td>' + itemPicker('type:' + k, ti.item) + '</td><td><select class="pr-input m3d-bs" data-bt="' + k + '">' + Object.keys(BASIS).map(function (b) { return '<option value="' + b + '"' + (basis === b ? ' selected' : '') + '>' + BASIS_UNIT[b] + ' — ' + BASIS[b].split(' (')[0] + '</option>'; }).join('') + '</select></td>' +
        '<td class="num">' + (ti.item ? f2(q) + ' ' + BASIS_UNIT[basis] : '—') + '</td><td class="num m3d-amt">' + (ti.item ? fm(amt) : '—') + '</td></tr>';
    });
    $('m3dSumRows').innerHTML = rows || '<tr><td colspan="10" class="m3d-muted" style="padding:22px;text-align:center">Chưa có cấu kiện. Dùng công cụ Hình chữ nhật / Tường để vẽ, hoặc Nhập file .dae/.obj từ SketchUp.</td></tr>';
    $('m3dTotal').textContent = fm(groups().reduce(function (s, g) { return s + g.qty * priceOf(g.item); }, 0));
    // danh sách cấu kiện
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
    // cơ sở tính theo ĐƠN VỊ của hạng mục: m³→V, m² (tường→W, còn lại→A), m→L, cái/bộ→N (tránh nhân nhầm m³ với đơn giá /m²)
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
      var t = boxTris(o), pos = t.v.map(function (p) { return p.map(function (n) { return n.toFixed(4); }).join(' '); }).join(' '), idx = t.f.map(function (f) { return f.join(' '); }).join(' ');
      var gid = 'geo' + i, nm = String(o.name).replace(/[<>&"]/g, '');
      geo += '<geometry id="' + gid + '" name="' + nm + '"><mesh><source id="' + gid + '-pos"><float_array id="' + gid + '-arr" count="24">' + pos + '</float_array><technique_common><accessor source="#' + gid + '-arr" count="8" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>' +
        '<vertices id="' + gid + '-v"><input semantic="POSITION" source="#' + gid + '-pos"/></vertices><triangles material="m" count="12"><input semantic="VERTEX" source="#' + gid + '-v" offset="0"/><p>' + idx + '</p></triangles></mesh></geometry>';
      nodes += '<node id="n' + i + '" name="' + nm + '"><instance_geometry url="#' + gid + '"><bind_material><technique_common><instance_material symbol="m" target="#mat_' + o.type + '"/></technique_common></bind_material></instance_geometry></node>';
    });
    var xml = '<?xml version="1.0" encoding="utf-8"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>HICONIQUE Hub</authoring_tool></contributor><unit meter="1" name="meter"/><up_axis>Y_UP</up_axis></asset>' +
      '<library_effects>' + fx + '</library_effects><library_materials>' + mt + '</library_materials><library_geometries>' + geo + '</library_geometries><library_visual_scenes><visual_scene id="Scene" name="Scene">' + nodes + '</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#Scene"/></scene></COLLADA>';
    download('mo-hinh-hiconique.dae', xml, 'model/vnd.collada+xml');
  }
  function exportObj() {
    var objs = S.objects.filter(function (o) { return o.kind !== 'mesh' && o.type !== 'opening'; }); if (!objs.length) { alert('Chưa có cấu kiện để xuất.'); return; }
    var out = '# HICONIQUE Hub (m)\n', off = 0;
    objs.forEach(function (o) { var t = boxTris(o); out += 'o ' + String(o.name).replace(/\s+/g, '_') + '\n'; t.v.forEach(function (p) { out += 'v ' + p.join(' ') + '\n'; }); t.f.forEach(function (f) { out += 'f ' + f.map(function (i) { return i + 1 + off; }).join(' ') + '\n'; }); off += 8; });
    download('mo-hinh-hiconique.obj', out);
  }
  function exportCsv() {
    var M = metrics(), L = [['Tên', 'Loại', 'Dài X', 'Rộng Z', 'Cao', 'Thể tích m3', 'DT mặt trên m2', 'DT mặt tường m2', 'Chiều dài m', 'Hạng mục DG', 'Mã', 'Cơ sở', 'Khối lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền']];
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
          var pos = g.getAttribute('position'); var idx = g.index ? g.index.array : null, n = idx ? idx.length : pos.count;
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
        status('Đã nhập ' + names.length + ' nhóm vật liệu từ ' + file.name + '. Gán đơn giá DG-* cho từng nhóm ở cột phải/bảng dưới.');
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
    $('m3dType').addEventListener('change', function () { S.set.type = this.value; var t = TYPES[this.value]; S.set.elev = t.elev; S.set.h = t.h; syncSettingsUI(); save(); });
    [['m3dElev', 'elev'], ['m3dH', 'h'], ['m3dThick', 'thick']].forEach(function (p) { $(p[0]).addEventListener('input', function () { S.set[p[1]] = pn(this.value); save(); }); });
    $('m3dGrid').addEventListener('change', function () { S.set.grid = pn(this.value) || 0.1; save(); });
    $('m3dUndo').addEventListener('click', undo);
    $('m3dDae').addEventListener('click', exportDae); $('m3dObj').addEventListener('click', exportObj); $('m3dCsv').addEventListener('click', exportCsv);
    $('m3dImport').addEventListener('click', function () { $('m3dFile').click(); });
    $('m3dFile').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f && inited) importFile(f); });
    $('m3dPush').addEventListener('click', pushToBoq);
    $('m3dClear').addEventListener('click', function () { if (!S.objects.length || !confirm('Xoá toàn bộ mô hình của dự án này?')) return; snapshot(); S.objects = []; S.sel = null; rebuildAll(); refreshUI(); save(); });
    $('m3dList').addEventListener('click', function (e) { var li = e.target.closest('.m3d-li'); if (li) { S.sel = li.getAttribute('data-oid'); refreshUI(); } });
    // thuộc tính cấu kiện
    var props = $('m3dProps');
    props.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-pf'); if (!k) { if (e.target.classList.contains('m3d-itsearch')) { loadEntries().then(function () { openBox(e.target); }); } return; }
      var o = getObj(S.sel); if (!o || k === 'type' || k === 'basis') return;
      if (k === 'name') o.name = e.target.value; else { var v = pn(e.target.value); if (['w', 'd', 'h'].indexOf(k) >= 0 && v <= 0) return; o[k] = v; rebuildOne(o); renderMetricsLine(o); renderSummary(); }
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
    // bảng tổng hợp theo loại
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
