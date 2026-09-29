/**
 * Tìm kiếm thông minh toàn hệ thống (mức 1 — KHÔNG dùng AI, chạy ngay trên trình duyệt, miễn phí).
 * Nguồn: các trang/công cụ, đồng nghiệp, dự án, công việc, tài sản & vật tư, khách hàng (CRM), tài liệu, bảng tin.
 * Đọc dữ liệu đã có trong localStorage qua TaskManager (không gọi mạng khi gõ) → kết quả tức thì.
 *
 * - Bỏ dấu tiếng Việt: gõ "gian giao" vẫn ra "Giàn giáo", "may thuy binh" ra "Máy thủy bình".
 * - Nhiều từ = phải khớp TẤT CẢ các từ (thứ tự tuỳ ý): "mam gian giao villa".
 * - Chịu sai chính tả nhẹ nhưng CHẶT (chữ đầu phải đúng; từ 4 ký tự chỉ cho đảo chữ; từ dài mới cho sai 1-2 ký tự): "thuy bihn" vẫn ra "thủy bình".
 * - Xếp theo độ liên quan: khớp tên > khớp đầu từ > nằm trong nội dung; khớp cả cụm được cộng điểm.
 * - Lọc theo QUYỀN: nhân viên thường chỉ thấy công việc của mình và dự án mình tham gia; KHÔNG bao giờ đưa lương, tài chính,
 *   CCCD, số tài khoản… vào chỉ mục.
 * API: HiconiqueSearch.search(query, {group, limit}) → {items:[…], groups:[…]}; .setPages(list); .warm(cb); .rebuild().
 */
(function () {
  'use strict';

  var GROUP_ORDER = ['Trang & công cụ', 'Tài sản & vật tư', 'Dự án', 'Công việc', 'Khách hàng', 'Đồng nghiệp', 'Tài liệu', 'Bảng tin'];
  var pages = [];
  var index = null;          // mảng mục đã chuẩn hoá
  var lastWarm = 0;

  // ---------- chuẩn hoá ----------
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function words(s) { return s ? s.split(' ') : []; }
  function uniq(arr) { var seen = {}, out = []; arr.forEach(function (w) { if (w && !seen[w]) { seen[w] = 1; out.push(w); } }); return out; }

  // Khoảng cách chỉnh sửa Damerau–Levenshtein có chặn trên (đảo 2 ký tự liền nhau tính 1 lỗi: "bihn" ~ "binh")
  function lev(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var d = [], i, j;
    for (i = 0; i <= la; i++) { d[i] = [i]; }
    for (j = 0; j <= lb; j++) { d[0][j] = j; }
    for (i = 1; i <= la; i++) {
      var rowMin = max + 1;
      for (j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
    }
    return d[la][lb];
  }
  // Khớp gần đúng CHẶT (tránh kết quả rác): chữ đầu phải giống (lỗi gõ hiếm khi sai chữ đầu);
  // từ 4 ký tự chỉ cho đảo chữ hoặc giữ nguyên chữ cuối; từ 5–8 ký tự sai tối đa 1; từ ≥ 9 tối đa 2.
  function fuzzyMatch(w, t) {
    if (w.charAt(0) !== t.charAt(0)) return false;
    var n = t.length;
    if (n < 4) return false;
    var max = n >= 9 ? 2 : 1;
    if (n === 4) {   // từ ngắn: chỉ cho (a) đảo chữ ("bihn"~"binh") hoặc (b) thiếu/thừa/sai 1 chữ nhưng chữ cuối vẫn đúng ("bosh"~"bosch")
      if (lev(w, t, 1) > 1) return false;
      var sameEnds = w.charAt(w.length - 1) === t.charAt(3);
      var anagram = w.length === 4 && w.split('').sort().join('') === t.split('').sort().join('');
      return sameEnds || anagram;
    }
    return lev(w, t, max) <= max;
  }

  // ---------- nguồn dữ liệu ----------
  function TM() { return window.TaskManager || null; }
  function me() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function isManager(u) { return !!u && (u.roleLevel === 'admin' || u.roleLevel === 'manager'); }
  function safe(fn, fallback) { try { var v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function notHidden(x) { return x && !(x.visible === false || String(x.visible).toLowerCase() === 'false'); }
  function asList(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v) { try { var j = JSON.parse(v); if (Array.isArray(j)) return j; } catch (e) { /* dạng "a,b" */ } return v.split(','); }
    return [];
  }
  function memberName(id) { var m = safe(function () { return TM().getMember(id); }, null); return m ? (m.name || id) : ''; }

  function collect() {
    var out = [], t = TM(), u = me(), mgr = isManager(u);
    function push(group, title, sub, url, fields, extra) {
      out.push(Object.assign({ group: group, title: title || '—', sub: sub || '', url: url, fields: fields.filter(Boolean).join(' ') }, extra || {}));
    }

    pages.forEach(function (p) { push('Trang & công cụ', p.title, p.sub, p.url, [p.title, p.sub, p.keywords]); });
    if (!t) return out;

    safe(function () { return t.getEquipment(); }, []).forEach(function (e) {
      var stock = safe(function () { return JSON.parse(e.stock || '[]'); }, []);
      var locs = stock.map(function (r) { return r.loc; }).join(' ');
      var qty = stock.length ? stock.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0) : Number(e.qty) || 0;
      var supplyText = (e.qty !== '' && e.qty != null) || stock.length ? ' · tồn ' + qty + (e.unit ? ' ' + e.unit : '') : '';
      push('Tài sản & vật tư', e.name, [e.category, e.code, e.location || (stock[0] && stock[0].loc)].filter(Boolean).join(' · ') + supplyText,
        '/pages/equipment.html?q=' + encodeURIComponent(e.code || e.name),
        [e.name, e.code, e.brand, e.model, e.serial, e.category, e.location, locs, e.supplier, e.note, memberName(e.assigneeId)]);
    });

    safe(function () { return t.getProjects(); }, []).filter(notHidden).forEach(function (p) {
      var mine = mgr || (u && (asList(p.members).indexOf(u.id) !== -1 || p.createdBy === u.id));
      if (!mine) return;
      push('Dự án', p.name, [p.type, p.client, p.location].filter(Boolean).join(' · '), '/pages/projects.html',
        [p.name, p.type, p.client, p.investor, p.location, p.description, p.status]);
    });

    safe(function () { return t.getTasks(); }, []).filter(notHidden).forEach(function (k) {
      var ids = asList(k.assigneeIds);
      if (!ids.length && k.assigneeId) ids = [k.assigneeId];
      if (!mgr && !(u && (ids.indexOf(u.id) !== -1 || k.createdBy === u.id))) return;
      var proj = safe(function () { return t.getProject(k.projectId); }, null);
      push('Công việc', k.title, [proj && proj.name, ids.map(memberName).filter(Boolean).join(', '), k.status].filter(Boolean).join(' · '),
        '/pages/tasks-manager.html', [k.title, k.description, proj && proj.name, ids.map(memberName).join(' ')]);
    });

    safe(function () { return t.getCustomers(); }, []).forEach(function (c) {
      push('Khách hàng', c.name, [c.company, c.phone, c.stage].filter(Boolean).join(' · '),
        '/pages/crm.html?q=' + encodeURIComponent(c.name || c.phone || ''), [c.name, c.company, c.phone, c.email, c.address, c.note]);
    });

    safe(function () { return t.getMembers(); }, []).forEach(function (m) {
      if (m.status === 'inactive' || m.status === 'rejected') return;
      // KHÔNG đưa lương, CCCD, số tài khoản, ngày sinh vào chỉ mục
      push('Đồng nghiệp', m.name, [m.role || m.position, m.email].filter(Boolean).join(' · '), '/pages/team.html', [m.name, m.role, m.position, m.email, m.phone, m.id, m.departmentName, m.division]);
    });

    safe(function () { return t.getDocuments(); }, []).forEach(function (grp) {
      (grp.items || []).forEach(function (d) {
        push('Tài liệu', d.name, [grp.category, d.code].filter(Boolean).join(' · '), '/pages/wiki.html', [d.name, d.category, d.code]);
      });
    });

    safe(function () { return t.getNotices(); }, []).forEach(function (n) {
      push('Bảng tin', n.title, String(n.message || '').slice(0, 90), '/pages/notices.html', [n.title, n.message]);
    });
    return out;
  }

  function rebuild() {
    index = collect().map(function (it) {
      var titleN = norm(it.title), hayN = norm(it.fields);
      return {
        group: it.group, title: it.title, sub: it.sub, url: it.url,
        titleN: titleN, tWords: words(titleN), hayN: hayN,
        words: uniq(words(hayN)).slice(0, 80)
      };
    });
    return index.length;
  }

  // ---------- chấm điểm ----------
  function tokenScore(it, t) {
    var s = 0, i, w;
    for (i = 0; i < it.tWords.length; i++) {
      w = it.tWords[i];
      if (w === t) { s = 10; break; }
      if (w.indexOf(t) === 0 && s < 8) s = 8;
    }
    if (!s && it.titleN.indexOf(t) !== -1) s = 6;
    if (!s) {
      for (i = 0; i < it.words.length; i++) {
        w = it.words[i];
        if (w === t) { s = 5; break; }
        if (w.indexOf(t) === 0 && s < 4) s = 4;
      }
    }
    if (!s && it.hayN.indexOf(t) !== -1) s = 3;
    if (!s && t.length >= 4) {                       // sai chính tả nhẹ
      for (i = 0; i < it.tWords.length && !s; i++) if (fuzzyMatch(it.tWords[i], t)) s = 2;
      for (i = 0; i < it.words.length && !s; i++) if (fuzzyMatch(it.words[i], t)) s = 1.5;
    }
    return s;
  }

  function search(query, opts) {
    opts = opts || {};
    var qN = norm(query);
    if (!qN) return { items: [], groups: [], total: 0 };
    if (!index) rebuild();
    var toks = words(qN), scored = [];
    for (var i = 0; i < index.length; i++) {
      var it = index[i], total = 0, ok = true;
      for (var k = 0; k < toks.length; k++) {
        var s = tokenScore(it, toks[k]);
        if (!s) { ok = false; break; }
        total += s;
      }
      if (!ok) continue;
      if (toks.length > 1 && it.titleN.indexOf(qN) !== -1) total += 12;      // khớp nguyên cụm trong tên
      if (it.titleN.indexOf(qN) === 0) total += 6;
      if (it.group === 'Trang & công cụ') total += 1;
      scored.push({ it: it, score: total });
    }
    scored.sort(function (a, b) { return b.score - a.score || a.it.title.localeCompare(b.it.title, 'vi'); });
    var counts = {}, best = {};
    scored.forEach(function (r) { counts[r.it.group] = (counts[r.it.group] || 0) + 1; if (!best[r.it.group]) best[r.it.group] = r.score; });
    var groups = GROUP_ORDER.filter(function (g) { return counts[g]; })
      .sort(function (a, b) { return best[b] - best[a] || GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b); })
      .map(function (g) { return { name: g, count: counts[g] }; });
    var limit = opts.limit || 24, perGroup = opts.group ? limit : 4;
    var shown = {}, items = [];
    var pool = opts.group ? scored.filter(function (r) { return r.it.group === opts.group; }) : scored;
    pool.forEach(function (r) {
      var g = r.it.group;
      shown[g] = (shown[g] || 0) + 1;
      if (shown[g] <= perGroup && items.length < limit) items.push(r.it);
    });
    if (!opts.group) {                // nhóm liên quan nhất lên đầu; trong nhóm giữ thứ tự điểm (sort ổn định)
      var order = groups.map(function (g) { return g.name; });
      items = items.map(function (x, i) { return { x: x, i: i }; })
        .sort(function (a, b) { return order.indexOf(a.x.group) - order.indexOf(b.x.group) || a.i - b.i; })
        .map(function (o) { return o.x; });
    }
    return { items: items, groups: groups, total: scored.length };
  }

  // Nạp nền những nguồn chưa có trong bộ nhớ máy (tài sản, khách hàng) — chỉ đọc, không chặn giao diện
  function warm(cb) {
    var t = TM(), now = Date.now();
    if (!t || now - lastWarm < 60000) { if (cb) cb(); return; }
    lastWarm = now;
    var left = 0, done = function () { if (--left <= 0) { rebuild(); if (cb) cb(); } };
    if (t.loadEquipment) { left++; safe(function () { t.loadEquipment(done); }, null); }
    if (t.loadCrmData) { left++; safe(function () { t.loadCrmData(done); }, null); }
    if (!left && cb) cb();
  }

  window.addEventListener('hiconique:data-refreshed', function () { index = null; });
  window.HiconiqueSearch = {
    search: search,
    rebuild: rebuild,
    warm: warm,
    norm: norm,
    setPages: function (list) { pages = list || []; index = null; },
    groupOrder: GROUP_ORDER
  };
})();
