/* SPC · Quy chuẩn kỹ thuật — hiển thị + thêm/sửa/duyệt/xóa.
   Mọi nhân viên thêm/sửa; XÓA chỉ Founder; người không phải Founder thêm/sửa → gửi đề xuất chờ Founder duyệt (xem task-data.js, khối SPC). */
(function () {
  'use strict';
  var state = { q: '', filter: 'all' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function user() { return (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null; }
  function isFounder() { return !!user() && TaskManager.isFounder(user()); }
  function toast(msg, ok) {
    var el = document.createElement('div'); el.className = 'spc-toast' + (ok === false ? ' bad' : ''); el.textContent = msg;
    document.body.appendChild(el); setTimeout(function () { el.classList.add('out'); }, 3200); setTimeout(function () { el.remove(); }, 3700);
  }
  function memberName(id) {
    var m = TaskManager.getMembers().filter(function (x) { return x.id === id; })[0];
    return m ? (m.name || id) : (id || '—');
  }
  function fmtRange(r) {
    var a = r.valueMin, b = r.valueMax, has = function (v) { return v !== '' && v != null && !isNaN(Number(v)); };
    if (has(a) && has(b)) return Number(a) === Number(b) ? '<span class="spc-num">' + esc(a) + '</span>' : '<span class="spc-num">' + esc(a) + '</span> <span>—</span> <span class="spc-num">' + esc(b) + '</span>';
    if (has(a)) return '<span class="spc-num">≥ ' + esc(a) + '</span>';
    if (has(b)) return '<span class="spc-num">≤ ' + esc(b) + '</span>';
    return '<span class="spc-num">—</span>';
  }
  function fmtText(r) {
    var has = function (v) { return v !== '' && v != null && !isNaN(Number(v)); };
    if (r.section !== 'height' && !has(r.valueMin) && !has(r.valueMax)) return '';
    return String(has(r.valueMin) ? r.valueMin : '') + (has(r.valueMin) && has(r.valueMax) ? ' — ' : '') + String(has(r.valueMax) ? r.valueMax : '') + ' ' + (r.unit || '');
  }
  function linksOf(r) {
    var arr = [];
    if (r.links) { try { var p = typeof r.links === 'string' ? JSON.parse(r.links) : r.links; if (Array.isArray(p)) arr = p; } catch (e) { arr = []; } }
    if (!arr.length && (r.linkLabel || r.linkUrl)) arr = [{ label: r.linkLabel || '', url: r.linkUrl || '' }];
    return arr.filter(function (x) { return x && (x.label || x.url); });
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'Xem tài liệu'; } }
  function linkHtml(r) {
    var ls = linksOf(r);
    if (!ls.length) return '';
    return ls.map(function (l) {
      var url = String(l.url || '').trim(), label = l.label || (url ? hostOf(url) : '');
      if (/^https?:\/\//i.test(url)) return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + ' ↗</a>';
      return '<span class="spc-link-off">' + esc(label) + '</span>';
    }).join('');
  }
  function linksText(r) { return linksOf(r).map(function (l) { return (l.label || '') + ' ' + (l.url || ''); }).join(' '); }
  function linkRowHtml(l) {
    return '<div class="spc-linkrow"><input class="lk-label" maxlength="80" placeholder="Tên liên kết (VD: Bản vẽ chi tiết)" value="' + esc(l.label || '') + '">' +
      '<input class="lk-url" placeholder="https://…" value="' + esc(l.url || '') + '"><button type="button" class="spc-lkdel" aria-label="Xóa link" title="Xóa link">×</button></div>';
  }
  function matches(r) {
    if (state.q) {
      var hay = [r.code, r.title, r.note, linksText(r), fmtText(r)].join(' ').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    if (state.filter === 'mine') return r.createdBy === (user() && user().id) || r.pendingBy === (user() && user().id);
    if (state.filter === 'pending') return r.status === 'pending' || !!r.pendingData;
    return true;
  }

  function badges(r) {
    var h = '';
    if (r.status === 'pending') h += '<span class="spc-tag wait">Chờ duyệt thêm mới</span>';
    else if (r.status === 'rejected') h += '<span class="spc-tag bad">Bị từ chối</span>';
    else if (r.pendingData) h += '<span class="spc-tag wait">Có đề xuất sửa chờ duyệt</span>';
    return h;
  }
  function cardActions(r) {
    var h = '<div class="spc-actions">';
    h += '<button type="button" class="spc-act" data-edit="' + esc(r.id) + '">Sửa</button>';
    if (isFounder()) h += '<button type="button" class="spc-act danger" data-del="' + esc(r.id) + '">Xóa</button>';
    return h + '</div>';
  }
  function cardNotes(r) {
    var h = '';
    if (r.status === 'rejected' && r.reviewNote) h += '<p class="spc-review">Lý do từ chối: ' + esc(r.reviewNote) + '</p>';
    else if (r.reviewNote && !r.pendingData) h += '<p class="spc-review">Đề xuất trước bị từ chối: ' + esc(r.reviewNote) + '</p>';
    if (r.pendingData) {
      var u = user();
      if (isFounder() || (u && r.pendingBy === u.id)) h += '<p class="spc-pend">Đề xuất của ' + esc(memberName(r.pendingBy)) + ': ' + esc(summ(r, r.pendingData)) + '</p>';
    }
    return h;
  }
  function summ(old, p) {
    var out = [], map = { title: 'Tên', note: 'Mô tả', unit: 'Đơn vị' };
    Object.keys(p).forEach(function (k) {
      if (k === 'links') { var a = linksText(old), b = linksText({ links: p.links }); if (a !== b) out.push('Link: ' + linksOf({ links: p.links }).length + ' liên kết (' + (linksOf({ links: p.links }).map(function (l) { return l.label || hostOf(l.url); }).join(', ') || 'đã xóa hết') + ')'); return; }
      if (k === 'linkLabel' || k === 'linkUrl') return;
      if (String(p[k] == null ? '' : p[k]) === String(old[k] == null ? '' : old[k])) return;
      if (k === 'valueMin' || k === 'valueMax') out.push((k === 'valueMin' ? 'Giá trị nhỏ nhất ' : 'Giá trị lớn nhất ') + (old[k] === '' || old[k] == null ? '—' : old[k]) + ' → ' + (p[k] === '' ? '—' : p[k]));
      else if (map[k]) out.push(map[k] + ': "' + (old[k] || '—') + '" → "' + (p[k] || '—') + '"');
    });
    return out.join(' · ') || 'không đổi';
  }

  function render() {
    if (typeof TaskManager === 'undefined') return;
    var u = user(), all = TaskManager.getSpcStandards(u), list = all.filter(matches);
    var heights = list.filter(function (r) { return r.section === 'height'; });
    var mats = list.filter(function (r) { return r.section !== 'height'; });

    $('spcHeights').innerHTML = heights.length ? heights.map(function (r) {
      return '<article class="spc-card' + (r.status !== 'approved' ? ' is-pending' : '') + '">' +
        '<header><span class="spc-id">' + esc(r.code) + '</span><h3>' + esc(r.title) + '</h3></header>' +
        '<p class="spc-value">' + fmtRange(r) + ' <small>' + esc(r.unit || 'mm') + '</small></p>' +
        '<p class="spc-note">' + esc(r.note) + '</p>' + (linkHtml(r) ? '<div class="spc-link">' + linkHtml(r) + '</div>' : '') +
        '<div class="spc-badges">' + badges(r) + '</div>' + cardNotes(r) + cardActions(r) + '</article>';
    }).join('') : '<p class="spc-empty">Không có quy chuẩn phù hợp.</p>';

    $('spcMaterials').innerHTML = mats.length ? mats.map(function (r) {
      return '<article class="page-block' + (r.status !== 'approved' ? ' is-pending' : '') + '">' +
        '<div class="spc-mat-head"><h3>' + esc(r.title) + '</h3><span class="spc-id sm">' + esc(r.code) + '</span></div>' +
        '<p>' + esc(r.note) + '</p>' + (linkHtml(r) ? '<div class="spc-link">' + linkHtml(r) + '</div>' : '') +
        '<div class="spc-badges">' + badges(r) + '</div>' + cardNotes(r) + cardActions(r) + '</article>';
    }).join('') : '<p class="spc-empty">Không có đặc tính vật liệu phù hợp.</p>';

    // Hộp "Chờ duyệt" — chỉ Founder
    var pend = all.filter(function (r) { return r.status === 'pending' || r.pendingData; });
    var box = $('spcPending');
    box.hidden = !(isFounder() && pend.length);
    if (isFounder()) {
      $('spcPendCount').textContent = pend.length;
      $('spcPendList').innerHTML = pend.map(function (r) {
        var isNew = r.status === 'pending';
        return '<div class="spc-pend-item"><div class="spc-pend-main"><span class="spc-id sm">' + esc(r.code) + '</span> <b>' + esc(r.title) + '</b> ' +
          '<span class="spc-tag wait">' + (isNew ? 'Thêm mới' : 'Chỉnh sửa') + '</span>' +
          '<div class="spc-pend-meta">Người gửi: ' + esc(memberName(r.pendingBy || r.createdBy)) + (r.pendingAt ? ' · ' + esc(String(r.pendingAt).slice(0, 10)) : '') + '</div>' +
          '<div class="spc-pend-diff">' + (isNew ? esc((fmtText(r) ? fmtText(r) + ' · ' : '') + (r.note || '')) : esc(summ(r, r.pendingData || {}))) + '</div></div>' +
          '<div class="spc-pend-btns"><button type="button" class="spc-btn ok" data-approve="' + esc(r.id) + '">Duyệt</button><button type="button" class="spc-btn" data-reject="' + esc(r.id) + '">Từ chối</button></div></div>';
      }).join('');
    }
    $('spcAddInfo').textContent = isFounder() ? 'Bạn là Founder — thêm/sửa có hiệu lực ngay.' : 'Thêm/sửa sẽ gửi cho Founder xét duyệt trước khi hiển thị chính thức.';
    $('spcCount').textContent = list.length + '/' + all.length + ' mục';
  }

  // ---------- modal ----------
  function openModal(html) {
    closeModal();
    var ov = document.createElement('div'); ov.className = 'spc-ov'; ov.id = 'spcModal';
    ov.innerHTML = '<div class="spc-modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
    return ov;
  }
  function closeModal() { var m = $('spcModal'); if (m) m.remove(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function openForm(rec) {
    var edit = !!rec, f = isFounder();
    var r = rec || { section: 'height', unit: 'mm' };
    var ov = openModal(
      '<div class="spc-mh"><div><div class="spc-mt">' + (edit ? 'Sửa quy chuẩn ' + esc(r.code) : 'Thêm quy chuẩn mới') + '</div>' +
      '<div class="spc-ms">' + (f ? 'Có hiệu lực ngay (Founder).' : 'Sẽ gửi Founder duyệt; quy chuẩn đang áp dụng giữ nguyên cho tới khi được duyệt.') + '</div></div><button type="button" class="spc-x" data-close aria-label="Đóng">×</button></div>' +
      '<form id="spcForm" class="spc-form">' +
      '<label>Nhóm</label><select id="sfSection"><option value="height">Quy chuẩn chiều cao (có giá trị mm)</option><option value="material">Đặc tính vật liệu</option></select>' +
      '<label>Tên quy chuẩn *</label><input id="sfTitle" required maxlength="120" placeholder="VD: Mặt bàn làm việc" value="' + esc(r.title || '') + '">' +
      '<div id="sfValRow"><div class="spc-two"><div><label>Giá trị nhỏ nhất</label><input id="sfMin" type="number" step="any" value="' + esc(r.valueMin === undefined ? '' : r.valueMin) + '"></div>' +
      '<div><label>Giá trị lớn nhất</label><input id="sfMax" type="number" step="any" value="' + esc(r.valueMax === undefined ? '' : r.valueMax) + '"></div>' +
      '<div><label>Đơn vị</label><input id="sfUnit" maxlength="12" value="' + esc(r.unit || 'mm') + '"></div></div></div>' +
      '<label>Mô tả / ghi chú *</label><textarea id="sfNote" rows="4" required placeholder="Phạm vi áp dụng, lưu ý kỹ thuật…">' + esc(r.note || '') + '</textarea>' +
      '<label>Link đính kèm <span class="spc-opt">(tuỳ chọn · thêm nhiều link)</span></label><div id="sfLinks"></div>' +
      '<button type="button" class="spc-addlink" id="sfAddLink">+ Thêm link</button>' +
      '<div class="spc-mf"><button type="button" class="spc-btn" data-close>Hủy</button><button type="submit" class="spc-btn pri">' + (f ? (edit ? 'Lưu thay đổi' : 'Thêm quy chuẩn') : 'Gửi đề xuất') + '</button></div></form>');
    $('sfSection').value = r.section || 'height';
    var box = $('sfLinks'), init = linksOf(r);
    (init.length ? init : [{}]).forEach(function (l) { box.insertAdjacentHTML('beforeend', linkRowHtml(l)); });
    $('sfAddLink').addEventListener('click', function () { box.insertAdjacentHTML('beforeend', linkRowHtml({})); box.lastChild.querySelector('.lk-label').focus(); });
    box.addEventListener('click', function (e) { var d = e.target.closest('.spc-lkdel'); if (!d) return; if (box.children.length > 1) d.parentNode.remove(); else d.parentNode.querySelectorAll('input').forEach(function (i) { i.value = ''; }); });
    function sync() { $('sfValRow').style.display = $('sfSection').value === 'height' ? '' : 'none'; }
    $('sfSection').addEventListener('change', sync); sync();
    ov.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });
    $('spcForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var links = [], bad = false;
      Array.prototype.forEach.call(document.querySelectorAll('#sfLinks .spc-linkrow'), function (row) {
        var lb = row.querySelector('.lk-label').value.trim(), u = row.querySelector('.lk-url').value.trim();
        if (!lb && !u) return;
        if (u && !/^https?:\/\//i.test(u)) { bad = true; return; }
        links.push({ label: lb, url: u });
      });
      if (bad) { toast('Đường dẫn phải bắt đầu bằng http:// hoặc https://', false); return; }
      var h = $('sfSection').value === 'height';
      var data = { section: h ? 'height' : 'material', title: $('sfTitle').value, note: $('sfNote').value, links: links, linkLabel: links[0] ? links[0].label : '', linkUrl: links[0] ? links[0].url : '',
        valueMin: h ? $('sfMin').value : '', valueMax: h ? $('sfMax').value : '', unit: h ? ($('sfUnit').value || 'mm') : '' };
      if (h && data.valueMin !== '' && data.valueMax !== '' && Number(data.valueMin) > Number(data.valueMax)) { toast('Giá trị nhỏ nhất không được lớn hơn giá trị lớn nhất.', false); return; }
      var u = user(), res;
      if (!u) { toast('Cần đăng nhập để thêm/sửa.', false); return; }
      // mục mặc định chưa có trên Sheet (founder chưa nạp): nạp trước rồi mới sửa
      if (edit && rec._default) { if (u && TaskManager.isFounder(u)) TaskManager.seedSpcDefaults(u); }
      res = edit ? TaskManager.updateSpcStandard(rec.id, data, u) : TaskManager.createSpcStandard(data, u);
      if (!res) { toast('Không lưu được (kiểm tra kết nối/quyền).', false); return; }
      closeModal(); render();
      toast(TaskManager.isFounder(u) ? 'Đã lưu.' : 'Đã gửi đề xuất — chờ Founder duyệt.');
    });
    setTimeout(function () { $('sfTitle').focus(); }, 30);
  }

  function confirmBox(title, msg, okLabel, danger, withReason, onOk) {
    var ov = openModal('<div class="spc-mh"><div class="spc-mt">' + esc(title) + '</div><button type="button" class="spc-x" data-close aria-label="Đóng">×</button></div>' +
      '<div class="spc-form"><p class="spc-cmsg">' + esc(msg) + '</p>' + (withReason ? '<label>Lý do (tuỳ chọn)</label><textarea id="spcReason" rows="3"></textarea>' : '') +
      '<div class="spc-mf"><button type="button" class="spc-btn" data-close>Hủy</button><button type="button" class="spc-btn ' + (danger ? 'danger-fill' : 'pri') + '" id="spcOk">' + esc(okLabel) + '</button></div></div>');
    ov.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });
    $('spcOk').addEventListener('click', function () { var r = withReason ? $('spcReason').value.trim() : ''; closeModal(); onOk(r); });
  }

  function byId(id) { return TaskManager.getSpcStandards(user()).filter(function (r) { return r.id === id; })[0]; }

  function bind() {
    $('spcAdd').addEventListener('click', function () { if (!user()) { toast('Cần đăng nhập.', false); return; } openForm(null); });
    $('spcSearch').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
    document.querySelectorAll('[data-spcfilter]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.filter = b.getAttribute('data-spcfilter');
        document.querySelectorAll('[data-spcfilter]').forEach(function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    document.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-edit]'))) { var r = byId(t.getAttribute('data-edit')); if (r) openForm(r); }
      else if ((t = e.target.closest('[data-del]'))) {
        var d = byId(t.getAttribute('data-del')); if (!d || !isFounder()) return;
        confirmBox('Xóa quy chuẩn', 'Xóa vĩnh viễn "' + d.title + '" (' + d.code + ')? Thao tác không hoàn tác được.', 'Xóa', true, false, function () {
          if (d._default) TaskManager.seedSpcDefaults(user());
          TaskManager.deleteSpcStandard(d.id, user()); render(); toast('Đã xóa.');
        });
      }
      else if ((t = e.target.closest('[data-approve]'))) { if (TaskManager.approveSpcStandard(t.getAttribute('data-approve'), user())) { render(); toast('Đã duyệt — nội dung hiển thị chính thức.'); } }
      else if ((t = e.target.closest('[data-reject]'))) {
        var id = t.getAttribute('data-reject');
        confirmBox('Từ chối đề xuất', 'Đề xuất sẽ không được áp dụng và người gửi nhận thông báo.', 'Từ chối', true, true, function (reason) {
          if (TaskManager.rejectSpcStandard(id, reason, user())) { render(); toast('Đã từ chối đề xuất.'); }
        });
      }
    });
  }

  var tries = 0;
  function boot() {
    if (typeof TaskManager === 'undefined' || typeof Auth === 'undefined') { if (tries++ < 60) setTimeout(boot, 150); return; }
    bind(); render();
    TaskManager.loadSpcData(function (has) {
      if (!has && isFounder() && TaskManager.seedSpcDefaults(user())) toast('Đã nạp 12 quy chuẩn mặc định lên Google Sheet.');
      render();
    });
    // thành viên/phiên đăng nhập có thể tới muộn hơn dữ liệu → vẽ lại 1 lần nữa
    setTimeout(render, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
