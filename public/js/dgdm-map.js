/* Gợi ý ánh xạ mã cũ trên app (DG-) → mã mới theo Form Mã công việc v2 — 2026-10-02. Chỉ là GỢI Ý để người dùng duyệt trên pages/dgdm.html; không ghi gì vào Sheet.
 * Công tác: mã cũ → mã hạng mục (cột C của DM_GIAI_DOAN). Mã công việc mới = [mã hạng mục]-[STT 3 số] theo thứ tự mã cũ trong hạng mục.
 * Vật tư:  tên/nhóm → nhóm tài nguyên VL-xx (NHOM_TAI_NGUYEN). Mã mới = VL-[xx]-[STT 4 số].
 * Gộp: chỉ gộp 2 dòng thành 1 mã khi TÊN và ĐVT khớp 100% (người dùng chốt 02/10/2026); mã cũ của dòng gộp ghi chung "A; B". */
(function (global) {
  'use strict';
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim(); }

  // ---------- CÔNG TÁC: mã cũ → hạng mục (khoảng mã cùng tiền tố) ----------
  var R = [];   // [tiền tố, từ, đến, hạng mục]
  function r(p, a, b, hm) { R.push([p, a, b, hm]); }
  // 01 Chuẩn bị, phá dỡ & công tác tạm
  r('AA', 1, 1, 'PDCB-VS'); r('AA', 2, 2, 'PDCB-KS'); r('AA', 3, 3, 'BP-LT'); r('AA', 4, 5, 'BP-AT'); r('AA', 6, 8, 'PDCB-DP'); r('AA', 9, 9, 'PDCB-KC'); r('AA', 10, 10, 'PDCB-VC');
  // 02 Đất, móng, cọc
  r('AB', 1, 4, 'TH-DD'); r('AB', 5, 5, 'TH-BT'); r('AB', 6, 11, 'TH-EC'); r('AB', 12, 12, 'TH-DD'); r('AB', 13, 13, 'TH-XD'); r('AB', 14, 14, 'TH-CT'); r('AB', 15, 15, 'TH-CP');
  // 03 Bê tông, cốt thép, cốp pha
  r('AC', 1, 6, 'TH-CT'); r('AC', 7, 10, 'TH-CP'); r('AC', 11, 15, 'TH-BT'); r('AC', 16, 16, 'TH-CN');
  // 04 Xây, trát, láng
  r('AD', 1, 6, 'TH-XD'); r('AD', 7, 10, 'TH-TR'); r('AD', 11, 13, 'TH-CN'); r('AD', 14, 14, 'TH-TR');
  // 05 Chống thấm, mái, cách nhiệt
  r('AE', 1, 8, 'TH-WS'); r('AE', 9, 15, 'TH-MA');
  // 06 Gạch ốp lát, đá, sàn
  r('AF', 1, 9, 'HT-OL'); r('AF', 10, 12, 'HT-DA'); r('AF', 13, 15, 'HT-GO'); r('AF', 16, 16, 'HT-OL');
  // 07 Trần, vách, sơn
  r('AG', 1, 9, 'HT-TC'); r('AG', 10, 14, 'HT-SN'); r('AG', 15, 15, 'NT-RM');
  // 08 Cửa, kính, lan can, kim loại
  r('AH', 1, 5, 'HT-NK'); r('AH', 6, 8, 'HT-CG'); r('AH', 9, 10, 'HT-CK'); r('AH', 11, 11, 'HT-KK'); r('AH', 12, 13, 'HT-LC'); r('AH', 14, 15, 'HT-CK');
  // 09 Thiết bị vệ sinh
  r('AI', 1, 13, 'MEP-P-VS'); r('AI', 14, 14, 'MEP-M-TG');
  // 10 Điện
  r('AJ', 1, 6, 'MEP-E-TB'); r('AJ', 7, 8, 'MEP-E-EL'); r('AJ', 9, 11, 'MEP-E-TD'); r('AJ', 12, 14, 'MEP-E-TB'); r('AJ', 15, 16, 'MEP-E-CM');
  // 11 Cấp thoát nước
  r('AK', 1, 2, 'MEP-P-CN'); r('AK', 3, 5, 'MEP-P-TN'); r('AK', 6, 7, 'MEP-P-CN'); r('AK', 8, 10, 'MEP-P-TN'); r('AK', 11, 12, 'MEP-P-CN'); r('AK', 13, 13, 'MEP-P-TN'); r('AK', 14, 14, 'MEP-P-CN'); r('AK', 15, 15, 'TH-NG');
  // 12 Điều hòa, thông gió
  r('AL', 1, 8, 'MEP-M-DH'); r('AL', 9, 12, 'MEP-M-TG');
  // 13 Nội thất gỗ
  r('AM', 1, 3, 'NT-MC'); r('AM', 4, 4, 'HT-DA'); r('AM', 5, 5, 'HT-KK'); r('AM', 6, 14, 'NT-MC'); r('AM', 15, 15, 'NT-DR'); r('AM', 16, 16, 'NT-RM');
  // 00 Bảng tóm tắt nền tảng (W01–W30): ánh xạ riêng (nếu trùng 100% tên + ĐVT với AA–AM thì được gộp)
  var W = { 1: 'TH-DD', 2: 'TH-DD', 3: 'TH-BT', 4: 'TH-CT', 5: 'TH-CP', 6: 'TH-BT', 7: 'TH-XD', 8: 'TH-XD', 9: 'TH-XD', 10: 'TH-TR', 11: 'TH-TR', 12: 'TH-CN', 13: 'TH-WS', 14: 'TH-WS', 15: 'HT-OL', 16: 'HT-OL', 17: 'HT-SN', 18: 'HT-SN', 19: 'HT-TC', 20: 'TH-KS', 21: 'HT-NK', 22: 'HT-DA', 23: 'MEP-E-TB', 24: 'MEP-E-TB', 25: 'MEP-P-CN', 26: 'MEP-P-TN', 27: 'MEP-P-VS', 28: 'MEP-M-DH', 29: 'NT-MC', 30: 'NT-MC' };
  // Dòng nên người dùng xem kỹ (ranh giới giữa 2 hạng mục / tên mơ hồ)
  var REVIEW = {
    AA05: 'Lưới bao che: BP-AT (an toàn & rào chắn) hay BP-BC (bao che bảo vệ)?', AB12: 'Vải địa kỹ thuật: TH-DD hay nằm trong TH-EC?', AB05: 'Bê tông lót móng: TH-BT hay TH-DD?', AD06: 'Xây gạch kính: TH-XD hay HT-KK?',
    AE14: 'Máng xối inox: TH-MA hay HT-IX?', AE15: 'Phễu thu mái: TH-MA hay TH-WS?', AG15: 'Dán giấy tường: NT-RM (mành rèm & giấy dán tường) hay HT-SN?', AH12: 'Lan can kính trụ inox: HT-LC (lan can cầu thang) hay HT-KK / HT-IX?',
    AH13: 'Lan can kính pad hông: HT-LC hay HT-KK?', AH15: 'Cổng sắt hộp: HT-CK hay NGT-HR (hàng rào & cổng)?', AI14: 'Quạt hút WC: MEP-M-TG hay MEP-P-VS?', AJ12: 'Đèn downlight: MEP-E-TB hay NT-DE (đèn trang trí)?',
    AJ13: 'Đèn ốp trần: MEP-E-TB hay NT-DE?', AJ14: 'LED hắt: MEP-E-TB hay NT-DE?', AK15: 'Bể tự hoại composite: TH-NG hay MEP-P-TN?', AM04: 'Mặt đá bếp quartz: HT-DA hay NT-MC?', AM05: 'Kính ốp bếp: HT-KK hay NT-MC?',
    W02: 'Vận chuyển đất thải: TH-DD hay PDCB-VC?', W20: 'Mái tôn khung thép hộp: TH-KS hay TH-MA?'
  };

  function hmOfCt(code) {
    var m = /^([A-Z]+)(\d+)$/.exec(String(code || '')); if (!m) return null;
    if (m[1] === 'W') return W[Number(m[2])] || null;
    var n = Number(m[2]);
    for (var i = 0; i < R.length; i++) if (R[i][0] === m[1] && n >= R[i][1] && n <= R[i][2]) return R[i][3];
    return null;
  }

  // ---------- VẬT TƯ: nhóm tài nguyên theo từ khoá ----------
  var VL_RULES = [   // [nhóm, regex trên tên đã bỏ dấu]
    ['PK', /(ray am|ray hop|tay nang|gia bat|thung rac am|chi canh|tay co thuy luc|tay co|nang ha)/],
    ['PK', /\b(ban le|tay nam|khoa |ray (truot|hoc|bi)|ke goc|oc vit|chot|ve phu kien|nep inox ray)\b|phu kien/],
    ['DR', /\b(sofa|rem |mang rem|tranh|tham |den (chum|tha|tuong|trang tri|ray)|decor|ghe |cay gia|chau |giay dan tuong|gia dan tuong)\b/],
    ['CK', /\b(cua |cua$|vach kinh|kinh (cuong|an toan|op|tam|gia)|nhom |lan can|inox|thep hop|sat hop|cong |khung thep|ton (cuon|lan)|hoa sat)\b/],
    ['CP', /(bat chuon|go hop|van phu phim|cay chong|gian giao|cop pha|ty ren|xa go|coc chong|dau chong)/],
    ['MC', /\b(mdf|mfc|plywood|laminate|melamine|go (cong nghiep|tu nhien|oc|soi)|tu bep|tu ao|giuong|ban (lam viec|trang diem|an)|tu lavabo|ke tv|van (go|cong nghiep|oc))\b/],
    ['CT', /(thanh truong no|bang can nuoc|keo pu|keo silicone|bong thuy tinh|panel eps|phu thu mai|sika|kova|mang (khos|khò|bitum|chong tham|khop)|bitum|chong tham|phu gia|epoxy|polyurethane|waterstop|tinh the|xps|cach nhiet|bong khoang|bentonite|quet |xu ly moi|chong moi)/],
    ['BT', /(be tong|vua |vua$|phi bom|bom can|coc btct|coc be tong)/],
    ['XD', /(xi mang|^cat |cat (be tong|xay|vang|nen|san)|^da |da (1x2|0x4|4x6|hoc|dam)|cap phoi|gach (dat nung|dac|aac|ong|khong nung|xay|bloc)|^gach \d|vai dia|cu tram|dat (dap|san)|tro bay)/],
    ['DN', /\b(day (cv|cadivi|dien|cap|mang|cat6|tv|loa)|cap (dien|mang|cat|dong truc|nguon)|ong luon|ong gen|cong tac|o cam|mcb|rccb|mccb|aptomat|tu dien|den (led|downlight|op tran|panel|tuyp)|downlight|camera|chuong cua|cat6|router|tiep dia|mang cap|hop noi|dau (noi|cos)|may cat|bang dien)\b/],
    ['NN', /\b(ong (ppr|upvc|pvc|hdpe|dong|thep ma|nuoc)|van |co noi|tee |cut |cong thoat|phu thu|ga (thoat|thu)|bao on|bo loc)\b|ppr|upvc/],
    ['TB', /\b(bon (cau|inox|tam|nuoc|rua)|lavabo|voi |sen |binh nuoc nong|binh nong lanh|dieu hoa|bom |quat |may (rua|nuoc|lanh|hut)|bep |hut mui|lo (nuong|vi)|tu lanh|thang may|be tu hoai|thiet bi (ve sinh|bep)|chau rua|guong|dieu khien|dau (phun|bao)|cassette|giau tran)\b/],
    ['HT', /(lam (nhua|go)|tam (calcium|tieu am)|vai dan tuong|nep chi|gach (the|terrazzo|kinh)|gach (op|lat|ceramic|porcelain|mosaic|gia go|khong lo)|ceramic|porcelain|granite|marble|quartz|da (op|lat|cau thang|bac|mat tien)|keo dan gach|chit ron|ron |bot ba|^son |son (lot|phu|noi|ngoai|epoxy|pu)|thach cao|tran |vach |san (go|nhua|spc|vinyl)|ton |ngoi |tam lop|op tuong|mosaic|la phong|len chan tuong)/],
    ['TP', /\b(thep|luoi thep|coupler|tam deck|vi keo|inox tam)\b/]
  ];
  var VL_LETTER_DEFAULT = { A: 'TP', B: 'HT', C: 'DN', D: 'MC', E: 'XD', F: 'CP', G: 'XD', H: 'CT', I: 'HT', J: 'HT', K: 'HT', L: 'CK', M: 'CK', N: 'TB', O: 'DN', P: 'NN', Q: 'TB', R: 'MC' };
  function suggestVl(name, code) {
    var n = norm(name), L = String(code || '').replace(/[0-9]/g, '').toUpperCase();
    for (var i = 0; i < VL_RULES.length; i++) if (VL_RULES[i][1].test(n)) return { grp: VL_RULES[i][0], conf: 'auto' };
    if ('FHIJKLNOQ'.indexOf(L) !== -1 && L) return { grp: VL_LETTER_DEFAULT[L], conf: 'auto' };   // nhóm app chỉ có 1 nhóm tài nguyên gợi ý
    return { grp: VL_LETTER_DEFAULT[L] || 'PT', conf: 'review', reason: 'Không khớp từ khoá; tạm theo chữ cái nhóm app (' + L + ')' };
  }

  // ---------- sinh bảng ánh xạ ----------
  // rows ct: [{code, name, unit, group}]  → {list:[{old, merged:[old…], name, unit, hm, newCode, review, reason}], pending:[…]}
  function buildCt(rows, overrides) {
    overrides = overrides || {};
    var seen = {}, out = [], byKey = {}, counters = {};
    rows.forEach(function (r) {
      var key = norm(r.name) + '|' + norm(r.unit), hm = overrides[r.code] || hmOfCt(r.code), rev = REVIEW[r.code] || (hm ? '' : 'Chưa có quy tắc cho mã này');
      if (byKey[key] && byKey[key].hm === hm) { byKey[key].merged.push(r.code); return; }   // chỉ gộp khi tên + ĐVT khớp 100% (và cùng hạng mục)
      var e = { old: r.code, merged: [r.code], name: r.name, unit: r.unit, hm: hm, spec: r.spec || '', group: r.group || '', review: rev, manual: !!overrides[r.code] };
      byKey[key] = e; out.push(e);
    });
    out.forEach(function (e) { if (e.hm) { counters[e.hm] = (counters[e.hm] || 0) + 1; e.newCode = e.hm + '-' + ('00' + counters[e.hm]).slice(-3); } else e.newCode = ''; });
    return out;
  }
  function buildVt(rows, overrides) {
    overrides = overrides || {};
    var byKey = {}, out = [], counters = {};
    rows.forEach(function (r) {
      var key = norm(r.name) + '|' + norm(r.unit), s = suggestVl(r.name, r.code), grp = overrides[r.code] || s.grp;
      if (byKey[key] && byKey[key].grp === grp) { byKey[key].merged.push(r.code); return; }
      var e = { old: r.code, merged: [r.code], name: r.name, unit: r.unit, grp: grp, spec: r.spec || '', group: r.group || '', review: overrides[r.code] ? '' : (s.conf === 'review' ? s.reason : ''), manual: !!overrides[r.code] };
      byKey[key] = e; out.push(e);
    });
    out.forEach(function (e) { counters[e.grp] = (counters[e.grp] || 0) + 1; e.newCode = 'VL-' + e.grp + '-' + ('000' + counters[e.grp]).slice(-4); });
    return out;
  }
  global.DgdmMap = { norm: norm, hmOfCt: hmOfCt, suggestVl: suggestVl, buildCt: buildCt, buildVt: buildVt, REVIEW: REVIEW };
})(window);
