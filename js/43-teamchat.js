// ═══════════════════════════════════════════════════════════════════════════════════════
//  CHAT NOI BO (client) — CS nhan tin cho nhau: kenh chung / kenh team / nhom rieng / 1-1.
//  Backend: gas/23_Chat.gs (7 action chat*). Moi request kem token phien (localStorage ome_sess_token); server tu xac dinh
//  nguoi gui + kiem quyen kenh, client chi hien thi. Tai khoan demo/chua dang nhap that KHONG dung duoc chat.
//  Cho tin moi = poll nhe `chatPoll` (4s khi dang mo tab Chat, 12s khi o tab khac, 45s khi tab trinh duyet an).
//  Trang thai "da doc" luu theo may (localStorage ome_chat_lr_<user>), khong dong bo giua cac may.
//  Quy uoc: MOI chuoi tu nguoi dung (ten, tin nhan) di qua esc() truoc khi vao innerHTML.
// ═══════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var S = { me: null, chans: [], users: [], active: 'general', msgs: {}, more: {}, last: 0, chver: -1, dver: -1,
    started: false, timer: null, busy: false, lastRead: {}, lrLoaded: false, reply: null, sending: false,
    authFail: false, panelOn: false, firstPoll: true, title0: '' };
  var POLL_ACTIVE = 4000, POLL_IDLE = 12000, POLL_HIDDEN = 45000, MAX_LEN = 2000;

  function $(id) { return document.getElementById(id); }
  function tok() { try { return localStorage.getItem('ome_sess_token') || ''; } catch (e) { return ''; } }
  function gs() { return (typeof gsUrl !== 'undefined' && gsUrl) ? gsUrl : ''; }
  function say(m) { if (typeof toast === 'function') toast(m); }

  async function apiGet(action, params) {
    var u = gs(), t = tok();
    if (!u || !t) return { ok: false, code: 'NOLOGIN', error: 'Chat can dang nhap bang tai khoan that.' };
    var q = 'action=' + action + '&token=' + encodeURIComponent(t);
    for (var k in (params || {})) q += '&' + k + '=' + encodeURIComponent(params[k]);
    try { var r = await fetch(u + (u.indexOf('?') >= 0 ? '&' : '?') + q, { redirect: 'follow' }); return await r.json(); }
    catch (e) { return { ok: false, code: 'NET', error: 'Mat ket noi may chu.' }; }
  }
  async function apiPost(action, body) {
    var u = gs(), t = tok();
    if (!u || !t) return { ok: false, code: 'NOLOGIN', error: 'Chat can dang nhap bang tai khoan that.' };
    try {
      var r = await fetch(u, { method: 'POST', redirect: 'follow', body: JSON.stringify(Object.assign({ action: action, token: t }, body || {})) });
      return await r.json();
    } catch (e) { return { ok: false, code: 'NET', error: 'Mat ket noi may chu.' }; }
  }

  // ───────────── tien ich hien thi ─────────────
  function uName(un) { for (var i = 0; i < S.users.length; i++) if (S.users[i].username === un) return S.users[i].name || un; return un; }
  function chById(id) { for (var i = 0; i < S.chans.length; i++) if (S.chans[i].id === id) return S.chans[i]; return null; }
  function dmId(a, b) { return 'dm:' + [a, b].sort().join('|'); }
  function chName(c) {
    if (!c) return '';
    if (c.type === 'dm') { var o = (c.members || []).filter(function (m) { return m !== S.me.username; })[0] || ''; return uName(o); }
    return c.name;
  }
  function chIcon(c) { return c.type === 'general' ? '📢' : c.type === 'team' ? '👥' : c.type === 'public' ? '#' : c.type === 'private' ? '🔒' : '✉'; }
  function colorOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return 'hsl(' + h + ',45%,42%)'; }
  function initials(n) { n = String(n || '?').trim(); var p = n.split(/\s+/); return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function dayLabel(ts) {
    var d = new Date(ts), n = new Date(), y = new Date(); y.setDate(n.getDate() - 1);
    if (dayKey(ts) === dayKey(n.getTime())) return 'Hôm nay';
    if (dayKey(ts) === dayKey(y.getTime())) return 'Hôm qua';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  // Van ban -> HTML an toan: tach URL ra truoc, escape tung phan, roi to mau @nhac-ten.
  function fmtText(t) {
    var parts = String(t).split(/(https?:\/\/[^\s<>"']+)/g), out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) out += '<a href="' + esc(parts[i]) + '" target="_blank" rel="noopener noreferrer">' + esc(parts[i]) + '</a>';
      else out += esc(parts[i]).replace(/(^|\s)@([\w.\-]+)/g, function (m, sp, nm) {
        var mine = S.me && nm.toLowerCase() === S.me.username;
        return sp + '<span class="tc-mention' + (mine ? ' me' : '') + '">@' + nm + '</span>';
      });
    }
    return out.replace(/\n/g, '<br>');
  }
  function mentionsMe(m) { return !!S.me && new RegExp('(^|\\s)@' + S.me.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w.\\-])', 'i').test(m.t); }

  // ───────────── da doc / chua doc ─────────────
  function lrKey() { return 'ome_chat_lr_' + (S.me ? S.me.username : ''); }
  function loadLR() {
    S.lrLoaded = false;
    try { var raw = localStorage.getItem(lrKey()); if (raw) { S.lastRead = JSON.parse(raw) || {}; S.lrLoaded = true; } } catch (e) { S.lastRead = {}; }
  }
  function saveLR() { try { localStorage.setItem(lrKey(), JSON.stringify(S.lastRead)); S.lrLoaded = true; } catch (e) {} }
  function unread(ch) {
    var lr = S.lastRead[ch] || 0, n = 0, a = S.msgs[ch] || [];
    for (var i = 0; i < a.length; i++) if (!a[i].tmp && a[i].u !== S.me.username && a[i].id > lr) n++;
    return n;
  }
  function unreadMention(ch) {
    var lr = S.lastRead[ch] || 0, a = S.msgs[ch] || [];
    for (var i = 0; i < a.length; i++) if (!a[i].tmp && a[i].u !== S.me.username && a[i].id > lr && mentionsMe(a[i])) return true;
    return false;
  }
  function totalUnread() { var n = 0; S.chans.forEach(function (c) { n += unread(c.id); }); return n; }
  function markRead(ch) {
    var a = S.msgs[ch] || [], mx = S.lastRead[ch] || 0;
    for (var i = 0; i < a.length; i++) if (!a[i].tmp && a[i].id > mx) mx = a[i].id;
    if (mx !== (S.lastRead[ch] || 0)) { S.lastRead[ch] = mx; saveLR(); }
    renderBadges();
  }
  function renderBadges() {
    var n = S.me ? totalUnread() : 0, b = $('tb-teamchat');
    if (b) { b.textContent = n > 99 ? '99+' : n; b.style.display = n ? '' : 'none'; b.style.background = n ? '#fee2e2' : ''; b.style.color = n ? '#991b1b' : ''; }
    var t = $('sn-toggle'); if (t) t.classList.toggle('tc-unread', n > 0);
    if (!S.title0) S.title0 = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = (n ? '(' + (n > 99 ? '99+' : n) + ') ' : '') + S.title0;
    renderSide(); miniRenderAll();
  }

  // ───────────── du lieu: kenh + tin nhan ─────────────
  function addMsg(m) {
    var a = S.msgs[m.c] || (S.msgs[m.c] = []);
    for (var i = a.length - 1; i >= 0; i--) if (a[i].id === m.id) return false;
    a.push(m);
    if (a.length > 1 && !a[a.length - 2].tmp && a[a.length - 2].id > m.id) a.sort(function (x, y) { return (x.tmp ? Infinity : x.id) - (y.tmp ? Infinity : y.id); });
    return true;
  }
  async function reloadChannels() {
    var r = await apiGet('chatChannels');
    if (!r.ok) return r;
    S.me = r.me; S.users = r.users || []; S.chans = r.channels || []; S.chver = r.chver;
    if (!chById(S.active) && !S.pendingDm) S.active = 'general';
    if (S.pendingDm && !chById(S.pendingDm.id)) S.chans.push(S.pendingDm);
    renderSide(); renderHead(); miniSync(); miniRenderAll();
    return r;
  }
  async function loadHistory(ch, before) {
    var p = { channel: ch, limit: 50 }; if (before) p.before = before;
    var r = await apiGet('chatHistory', p);
    if (!r.ok) { if (r.error && r.code !== 'NET') say(r.error); return false; }
    (r.msgs || []).forEach(addMsg);
    S.more[ch] = !!r.more;
    return true;
  }
  async function reloadActive() {
    var ch = S.active; S.msgs[ch] = (S.msgs[ch] || []).filter(function (m) { return m.tmp; });
    await loadHistory(ch); renderMsgs(true); markRead(ch);
  }

  // ───────────── vong poll ─────────────
  function schedule() {
    clearTimeout(S.timer);
    if (!S.started) return;
    S.timer = setTimeout(tick, document.hidden ? POLL_HIDDEN : (S.panelOn ? POLL_ACTIVE : POLL_IDLE));
  }
  async function tick() {
    if (S.busy || S.authFail) { schedule(); return; }
    S.busy = true;
    try {
      var r = await apiGet('chatPoll', { since: S.last });
      if (r.code === 'AUTH') { S.authFail = true; S.started = false; if (S.panelOn) renderMsgs(); }
      else if (r.ok) await onPoll(r);
    } catch (e) {}
    S.busy = false; schedule();
  }
  async function onPoll(r) {
    var needCh = (r.chver !== S.chver), fresh = [], i;
    for (i = 0; i < r.msgs.length; i++) {
      var m = r.msgs[i];
      if (!chById(m.c)) needCh = true;
      if (addMsg(m)) fresh.push(m);
    }
    S.last = Math.max(S.last, r.last || 0);
    if (needCh) await reloadChannels();
    if (S.dver === -1) S.dver = r.dver;
    else if (r.dver !== S.dver) { S.dver = r.dver; if (S.started) { await reloadActive(); miniReloadAll(); } }
    if (S.firstPoll) {                       // lan dau tren may nay: coi tin hien co la da doc, tranh bao hang tram tin chua doc
      S.firstPoll = false;
      if (!S.lrLoaded) { S.chans.forEach(function (c) { var a = S.msgs[c.id] || [], mx = 0; a.forEach(function (x) { if (x.id > mx) mx = x.id; }); if (mx) S.lastRead[c.id] = mx; }); saveLR(); }
    } else {
      var viewing = S.panelOn && !document.hidden;
      var theirs = fresh.filter(function (m) { return m.u !== S.me.username && !(viewing && m.c === S.active) && !miniViewing(m.c); });
      if (theirs.length) { var t = theirs[theirs.length - 1], c = chById(t.c); say('💬 ' + t.n + (c && c.type !== 'dm' ? ' (' + chName(c) + ')' : '') + ': ' + t.t.slice(0, 60)); }
    }
    if (S.panelOn && fresh.some(function (m) { return m.c === S.active; })) { renderMsgs(); if (!document.hidden) markRead(S.active); }
    S.mini.wins.forEach(function (w) { if (fresh.some(function (m) { return m.c === w.id; })) miniRenderWin(w, false); });
    miniMarkVisible();
    renderBadges();
  }
  async function start() {
    if (S.started || S.busy || !tok() || !gs()) return;
    S.busy = true;
    var r = await reloadChannels();
    S.busy = false;
    if (!r || !r.ok) { if (r && r.code === 'AUTH') S.authFail = true; return; }
    S.authFail = false; S.started = true; S.firstPoll = true; S.last = 0; S.dver = -1;
    loadLR();
    await tick();
    miniRestore();   // sau tick dau (de moc 'da doc' lan dau tren may duoc dat truoc khi cua so nho tu danh dau da doc)
  }
  function stop() { miniReset(); S.started = false; clearTimeout(S.timer); S.me = null; S.pendingDm = null; S.active = 'general'; S.reply = null; S.chans = []; S.msgs = {}; S.last = 0; S.chver = -1; renderBadges(); }

  // ───────────── giao dien ─────────────
  function ensurePanel() {
    if ($('tab-teamchat')) return;
    var dv = $('data-view'); if (!dv) return;
    var p = document.createElement('div');
    p.id = 'tab-teamchat'; p.className = 'main'; p.style.cssText = 'display:none;flex:1;overflow:hidden;flex-direction:column';
    p.innerHTML =
      '<div class="tc-wrap" id="tc-wrap">' +
        '<div class="tc-side"><div class="tc-side-h">💬 Chat nội bộ</div><div class="tc-chlist" id="tc-chlist"></div>' +
          '<div class="tc-side-f"><button class="btn sm" onclick="tcNewDm()">✉ Nhắn riêng</button><button class="btn sm" onclick="tcNewChannel()">＋ Tạo nhóm</button></div></div>' +
        '<div class="tc-main"><div class="tc-head"><button class="btn sm tc-back" onclick="tcBack()">←</button><div class="tc-title" id="tc-title"></div>' +
          '<button class="btn sm" id="tc-manage" onclick="tcManage()" style="display:none" title="Thành viên / cài đặt">⚙</button></div>' +
          '<div class="tc-msgs" id="tc-msgs"></div><div class="tc-reply" id="tc-reply" style="display:none"></div>' +
          '<div class="tc-comp"><textarea id="tc-input" rows="1" maxlength="' + MAX_LEN + '" placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"></textarea>' +
          '<button class="btn primary" id="tc-send" onclick="tcSend()">Gửi</button></div></div>' +
      '</div>';
    dv.appendChild(p);
    var ta = $('tc-input');
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); tcSend(); } });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    $('tc-chlist').addEventListener('click', function (e) {   // data-ch + uy quyen su kien: id kenh (ten team do admin dat) khong bao gio vao chuoi JS
      var el = e.target.closest ? e.target.closest('.tc-ch') : null;
      if (el && el.getAttribute('data-ch')) tcSelect(el.getAttribute('data-ch'));
    });
    $('tc-msgs').addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.tc-msg') : null;
      if (el && !e.target.closest('a,button')) el.classList.toggle('sel');
    });
  }
  function renderSide() {
    var box = $('tc-chlist'); if (!box || !S.me) return;
    var groups = [['Kênh', ['general', 'team', 'public']], ['Nhóm riêng', ['private']], ['Tin nhắn riêng', ['dm']]], h = '';
    groups.forEach(function (g) {
      var list = S.chans.filter(function (c) { return g[1].indexOf(c.type) !== -1; });
      if (g[0] === 'Tin nhắn riêng') list.sort(function (a, b) { return lastTs(b.id) - lastTs(a.id); });
      if (!list.length) return;
      h += '<div class="tc-sec">' + g[0] + '</div>';
      list.forEach(function (c) {
        var n = unread(c.id), on = c.id === S.active;
        h += '<div class="tc-ch' + (on ? ' on' : '') + (n ? ' has' : '') + '" data-ch="' + esc(c.id) + '">' +
          '<span class="tc-ch-i">' + chIcon(c) + '</span><span class="tc-ch-n">' + esc(chName(c)) + '</span>' +
          (n ? '<span class="tc-ch-b' + (unreadMention(c.id) ? ' men' : '') + '">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</div>';
      });
    });
    box.innerHTML = h;
  }
  function lastTs(ch) { var a = S.msgs[ch] || []; return a.length ? a[a.length - 1].ts || 0 : 0; }
  function renderHead() {
    var c = chById(S.active), t = $('tc-title'), mb = $('tc-manage'); if (!t) return;
    if (!c) { t.innerHTML = ''; if (mb) mb.style.display = 'none'; return; }
    var sub = c.type === 'private' ? (c.members.length + ' thành viên') : c.type === 'dm' ? '' : (c.desc || '');
    t.innerHTML = '<b>' + chIcon(c) + ' ' + esc(chName(c)) + '</b>' + (sub ? '<span class="tc-sub">' + esc(sub) + '</span>' : '');
    if (mb) mb.style.display = (c.type === 'private' || (c.type === 'public' && c.canManage)) ? '' : 'none';
  }
  function renderMsgs(stick) {
    var box = $('tc-msgs'); if (!box) return;
    if (S.authFail) { box.innerHTML = '<div class="tc-empty">Phiên đăng nhập đã hết hạn — đăng nhập lại để dùng chat.</div>'; return; }
    if (!tok()) { box.innerHTML = '<div class="tc-empty">Chat chỉ dùng được khi đăng nhập bằng tài khoản thật (không dùng ở chế độ test).</div>'; return; }
    if (!S.me) { box.innerHTML = '<div class="tc-empty">Đang kết nối chat…</div>'; return; }
    var near = box.scrollHeight - box.scrollTop - box.clientHeight < 90, prevH = box.scrollHeight, prevT = box.scrollTop;
    var a = S.msgs[S.active] || [], h = '', lastDay = '', lastU = '', lastTs0 = 0;
    if (S.more[S.active]) h += '<div class="tc-more"><button class="btn sm" onclick="tcOlder()">Xem tin cũ hơn</button></div>';
    if (!a.length) h += '<div class="tc-empty">Chưa có tin nhắn nào. Hãy là người nói trước 👋</div>';
    a.forEach(function (m) {
      var dk = dayKey(m.ts || Date.now());
      if (dk !== lastDay) { h += '<div class="tc-day"><span>' + dayLabel(m.ts || Date.now()) + '</span></div>'; lastDay = dk; lastU = ''; }
      var mine = m.u === S.me.username, grp = (m.u === lastU && (m.ts - lastTs0) < 300000);
      var q = '';
      if (m.r) { var ref = (S.msgs[S.active] || []).filter(function (x) { return String(x.id) === String(m.r); })[0]; q = '<div class="tc-quote">↩ ' + (ref ? '<b>' + esc(ref.n) + '</b>: ' + esc(ref.t.slice(0, 80)) : 'tin nhắn trước đó') + '</div>'; }
      h += '<div class="tc-msg' + (mine ? ' mine' : '') + (grp ? ' grp' : '') + (m.tmp ? ' tmp' : '') + (mentionsMe(m) && !mine ? ' men' : '') + '" data-id="' + m.id + '">' +
        (grp ? '<div class="tc-av ph"></div>' : '<div class="tc-av" style="background:' + colorOf(m.u) + '">' + esc(initials(m.n)) + '</div>') +
        '<div class="tc-bd">' + (grp ? '' : '<div class="tc-who"><b>' + esc(m.n) + '</b><span>' + hhmm(m.ts) + '</span></div>') + q +
        '<div class="tc-tx">' + fmtText(m.t) + '</div></div>' +
        (m.tmp ? '<div class="tc-st">đang gửi…</div>' : '<div class="tc-acts"><button title="Trả lời" onclick="tcReply(\'' + m.id + '\')">↩</button>' +
          ((mine || S.me.role === 'admin') ? '<button title="Xoá" onclick="tcDel(\'' + m.id + '\')">🗑</button>' : '') + '</div>') + '</div>';
      lastU = m.u; lastTs0 = m.ts;
    });
    box.innerHTML = h;
    if (stick || near) box.scrollTop = box.scrollHeight; else box.scrollTop = prevT + (box.scrollHeight - prevH);
  }
  function renderReply() {
    var b = $('tc-reply'); if (!b) return;
    if (!S.reply) { b.style.display = 'none'; return; }
    b.style.display = ''; b.innerHTML = '↩ Trả lời <b>' + esc(S.reply.n) + '</b>: ' + esc(S.reply.t.slice(0, 80)) + ' <button class="btn sm" onclick="tcReply(null)">✕</button>';
  }

  // ───────────── thao tac nguoi dung (global cho onclick) ─────────────
  window.tcSelect = async function (id) {
    S.active = id; S.reply = null; renderReply();
    if (S.pendingDm && S.pendingDm.id !== id) S.pendingDm = null;
    var w = $('tc-wrap'); if (w) w.classList.add('mob-conv');
    renderSide(); renderHead(); renderMsgs(true);
    if (!S.msgs[id] || !S.msgs[id].length) { await loadHistory(id); }
    if (S.active === id) { renderMsgs(true); markRead(id); }
  };
  window.tcBack = function () { var w = $('tc-wrap'); if (w) w.classList.remove('mob-conv'); };
  window.tcOlder = async function () {
    var a = (S.msgs[S.active] || []).filter(function (m) { return !m.tmp; }); if (!a.length) return;
    await loadHistory(S.active, a[0].id); renderMsgs();
  };
  window.tcReply = function (id) {
    if (id == null) { S.reply = null; renderReply(); return; }
    var m = (S.msgs[S.active] || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (m) { S.reply = m; renderReply(); var ta = $('tc-input'); if (ta) ta.focus(); }
  };
  window.tcDel = async function (id) {
    if (!confirm('Xoá tin nhắn này? Mọi người trong kênh sẽ không còn thấy.')) return;
    var r = await apiPost('chatDelete', { id: id });
    if (!r.ok) { say(r.error || 'Không xoá được tin nhắn'); return; }
    var a = S.msgs[S.active] || []; S.msgs[S.active] = a.filter(function (m) { return String(m.id) !== String(id); });
    S.dver = r.dver; renderMsgs(); renderBadges();
  };
  window.tcSend = async function () {
    var ta = $('tc-input'); if (!ta || S.sending || !S.me) return;
    var text = ta.value.trim(); if (!text) return;
    if (text.length > MAX_LEN) { say('Tin nhắn quá dài (tối đa ' + MAX_LEN + ' ký tự)'); return; }
    var ch = S.active, reply = S.reply ? S.reply.id : '';
    S.sending = true; $('tc-send').disabled = true;
    var tmp = { id: 't' + Date.now(), c: ch, u: S.me.username, n: S.me.name, t: text, ts: Date.now(), r: reply ? String(reply) : '', tmp: true };
    (S.msgs[ch] || (S.msgs[ch] = [])).push(tmp);
    ta.value = ''; ta.style.height = 'auto'; S.reply = null; renderReply(); renderMsgs(true);
    var r = await apiPost('chatSend', { channel: ch, text: text, replyTo: reply ? String(reply) : '' });
    S.msgs[ch] = (S.msgs[ch] || []).filter(function (m) { return m !== tmp; });
    if (r.ok) {
      addMsg(r.msg); S.last = Math.max(S.last, r.last || 0);
      if (S.pendingDm && S.pendingDm.id === ch) { S.pendingDm = null; await reloadChannels(); }
      markRead(ch);
    } else {
      if (r.code === 'AUTH') { S.authFail = true; }
      say(r.error || 'Gửi không được, thử lại'); if (!ta.value) ta.value = text;
    }
    S.sending = false; $('tc-send').disabled = false;
    if (S.active === ch) renderMsgs(true);
    renderSide();
  };

  // ───────────── hop thoai: nhan rieng / tao nhom / quan ly ─────────────
  function modal(html) {
    var ov = document.createElement('div'); ov.className = 'tc-ov';
    ov.innerHTML = '<div class="tc-box">' + html + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov); return ov;
  }
  function userPick(ov, selected, single) {
    var list = ov.querySelector('.tc-ulist'), q = ov.querySelector('.tc-usearch');
    function draw() {
      var s = (q.value || '').toLowerCase(), h = '';
      S.users.filter(function (u) { return u.username !== S.me.username && (!s || (u.name + ' ' + u.username + ' ' + u.team).toLowerCase().indexOf(s) !== -1); }).forEach(function (u) {
        h += '<label class="tc-urow"><input type="' + (single ? 'radio' : 'checkbox') + '" name="cu" value="' + esc(u.username) + '"' + (selected.indexOf(u.username) !== -1 ? ' checked' : '') + '> ' +
          '<span class="tc-av sm" style="background:' + colorOf(u.username) + '">' + esc(initials(u.name)) + '</span> <span>' + esc(u.name) + '</span><small>' + esc(u.team || u.username) + '</small></label>';
      });
      list.innerHTML = h || '<div class="tc-empty">Không có ai khớp.</div>';
    }
    list.addEventListener('change', function (e) {
      var v = e.target.value, i = selected.indexOf(v);
      if (single) { selected.length = 0; selected.push(v); } else if (e.target.checked && i === -1) selected.push(v); else if (!e.target.checked && i !== -1) selected.splice(i, 1);
    });
    q.addEventListener('input', draw); draw();
  }
  window.tcNewDm = function (toMini) {
    if (!S.me) return;
    var sel = [], ov = modal('<h3>✉ Nhắn riêng</h3><input class="tc-usearch" placeholder="Tìm tên / team…"><div class="tc-ulist"></div>' +
      '<div class="tc-bf"><button class="btn" data-x>Huỷ</button><button class="btn primary" data-ok>Mở chat</button></div>');
    userPick(ov, sel, true);
    ov.querySelector('[data-x]').onclick = function () { ov.remove(); };
    ov.querySelector('[data-ok]').onclick = function () {
      if (!sel.length) { say('Chọn 1 người để nhắn'); return; }
      var id = dmId(S.me.username, sel[0]);
      if (!chById(id)) { S.pendingDm = { id: id, name: '', type: 'dm', desc: '', members: [S.me.username, sel[0]], canManage: false, pending: true }; S.chans.push(S.pendingDm); }
      ov.remove(); if (toMini === true) miniOpen(id); else tcSelect(id);
    };
  };
  window.tcNewChannel = function (toMini) {
    if (!S.me) return;
    var sel = [], isAdmin = S.me.role === 'admin';
    var ov = modal('<h3>＋ Tạo nhóm / kênh</h3><input id="tc-nm" maxlength="40" placeholder="Tên nhóm (tối đa 40 ký tự)"><input id="tc-ds" maxlength="200" placeholder="Mô tả (không bắt buộc)">' +
      (isAdmin ? '<label class="tc-opt"><input type="checkbox" id="tc-pub"> Kênh chung (mọi nhân viên đều thấy và vào được)</label>' : '') +
      '<div id="tc-mbwrap"><div class="tc-sec">Thành viên</div><input class="tc-usearch" placeholder="Tìm tên / team…"><div class="tc-ulist"></div></div>' +
      '<div class="tc-bf"><button class="btn" data-x>Huỷ</button><button class="btn primary" data-ok>Tạo</button></div>');
    userPick(ov, sel, false);
    var pub = ov.querySelector('#tc-pub');
    if (pub) pub.onchange = function () { ov.querySelector('#tc-mbwrap').style.display = pub.checked ? 'none' : ''; };
    ov.querySelector('[data-x]').onclick = function () { ov.remove(); };
    ov.querySelector('[data-ok]').onclick = async function () {
      var name = ov.querySelector('#tc-nm').value.trim(), type = (pub && pub.checked) ? 'public' : 'private';
      if (!name) { say('Nhập tên nhóm'); return; }
      if (type === 'private' && !sel.length) { say('Chọn ít nhất 1 thành viên'); return; }
      this.disabled = true;
      var r = await apiPost('chatCreateChannel', { name: name, type: type, desc: ov.querySelector('#tc-ds').value.trim(), members: sel });
      if (!r.ok) { say(r.error || 'Không tạo được'); this.disabled = false; return; }
      ov.remove(); await reloadChannels(); if (toMini === true) miniOpen(r.channel.id); else tcSelect(r.channel.id);
    };
  };
  window.tcManage = function () {
    var c = chById(S.active); if (!c || (c.type !== 'private' && c.type !== 'public')) return;
    var sel = (c.members || []).slice(), mgr = !!c.canManage;
    var ov = modal('<h3>⚙ ' + esc(chName(c)) + '</h3>' +
      (mgr ? '<input id="tc-nm" maxlength="40" value="' + esc(c.name) + '"><input id="tc-ds" maxlength="200" value="' + esc(c.desc || '') + '" placeholder="Mô tả">' : '') +
      (c.type === 'private' ? '<div class="tc-sec">Thành viên (' + c.members.length + ')</div>' + (mgr ? '<input class="tc-usearch" placeholder="Tìm tên / team…"><div class="tc-ulist"></div>' :
        '<div class="tc-mlist">' + c.members.map(function (m) { return '<span class="tc-chip">' + esc(uName(m)) + '</span>'; }).join('') + '</div>') : '') +
      '<div class="tc-bf">' + (c.type === 'private' ? '<button class="btn" data-leave style="color:var(--red)">Rời nhóm</button>' : '') +
      (mgr ? '<button class="btn" data-arch style="color:var(--red)">Lưu trữ</button>' : '') + '<span style="flex:1"></span><button class="btn" data-x>Đóng</button>' + (mgr ? '<button class="btn primary" data-ok>Lưu</button>' : '') + '</div>');
    if (mgr && c.type === 'private') userPick(ov, sel, false);
    function done() { ov.remove(); reloadChannels().then(function () { if (!chById(S.active)) { S.active = 'general'; } renderHead(); renderMsgs(true); }); }
    ov.querySelector('[data-x]').onclick = function () { ov.remove(); };
    var lv = ov.querySelector('[data-leave]');
    if (lv) lv.onclick = async function () { if (!confirm('Rời khỏi nhóm này?')) return; var r = await apiPost('chatUpdateChannel', { id: c.id, leave: true }); if (r.ok) done(); else say(r.error || 'Không rời được'); };
    var ar = ov.querySelector('[data-arch]');
    if (ar) ar.onclick = async function () { if (!confirm('Lưu trữ kênh này? Kênh sẽ biến mất khỏi danh sách của mọi người.')) return; var r = await apiPost('chatUpdateChannel', { id: c.id, archived: true }); if (r.ok) done(); else say(r.error || 'Không lưu trữ được'); };
    var ok = ov.querySelector('[data-ok]');
    if (ok) ok.onclick = async function () {
      var body = { id: c.id, name: ov.querySelector('#tc-nm').value.trim(), desc: ov.querySelector('#tc-ds').value.trim() };
      if (c.type === 'private') { body.addMembers = sel.filter(function (m) { return c.members.indexOf(m) === -1; }); body.removeMembers = c.members.filter(function (m) { return sel.indexOf(m) === -1; }); }
      this.disabled = true; var r = await apiPost('chatUpdateChannel', body);
      if (r.ok) done(); else { say(r.error || 'Không lưu được'); this.disabled = false; }
    };
  };

  // ───────────── cua so chat nho (dock goc duoi phai, kieu Zalo/Pancake) ─────────────
  // 1 danh sach kenh (thu gon/mo) + toi da 3 cua so hoi thoai nho, dung CHUNG du lieu S.msgs / poll / da-doc voi tab Chat day du.
  // Chi hien khi dang o tab khac (o tab Chat da co khung day du). Trang thai (mo/thu gon) nho theo may: localStorage ome_chat_mini_<user>.
  // Moi chuoi nguoi dung di qua esc()/textContent; id kenh chi nam trong thuoc tinh data-ch (khong vao chuoi JS).
  var MINI_W = 340, MINI_MAX = 3;
  S.mini = { listOpen: false, wins: [], q: '', hidden: false, justDragged: false };
  function miniKey() { return 'ome_chat_mini_' + (S.me ? S.me.username : ''); }
  function miniSave() {
    try { localStorage.setItem(miniKey(), JSON.stringify({ l: S.mini.listOpen ? 1 : 0, h: S.mini.hidden ? 1 : 0, w: S.mini.wins.map(function (w) { return [w.id, w.min ? 1 : 0]; }) })); } catch (e) {}
  }
  function miniMax() { var room = (window.innerWidth || 1200) - 76 - 290 - 20; return Math.max(1, Math.min(MINI_MAX, Math.floor(room / (MINI_W + 10)))); }
  function miniWin(id) { for (var i = 0; i < S.mini.wins.length; i++) if (S.mini.wins[i].id === id) return S.mini.wins[i]; return null; }
  function miniViewing(ch) { var w = miniWin(ch); return !!w && !w.min && !S.mini.hidden && !S.panelOn && !document.hidden; }   // dock thu nho hang = khong ai dang xem -> tin van tinh chua doc
  function miniMarkVisible() { S.mini.wins.forEach(function (w) { if (miniViewing(w.id)) markRead(w.id); }); }

  // ───────────── keo-tha + thu nho hang (2026-10-16) ─────────────
  // Vi tri luu theo may + tai khoan: localStorage ome_chat_pos_<user> = { d:{r,b}, b:{r,b} } (d = dock, b = bong bong thu nho; r/b = khoang cach toi
  // mep PHAI / DUOI man hinh — giu nguyen cach neo cu nen cua so moi mo van mo rong sang trai va len tren). Khong luu = vi tri mac dinh theo CSS
  // (goc duoi phai, tu nhuong cho Tro ly AI). Da keo di thi dung vi tri nguoi dung chon, khong tu dich nua.
  function posKey() { return 'ome_chat_pos_' + (S.me ? S.me.username : ''); }
  function posLoad() { try { return JSON.parse(localStorage.getItem(posKey()) || '{}') || {}; } catch (e) { return {}; } }
  function posSave(which, p) { var all = posLoad(); all[which] = p; try { localStorage.setItem(posKey(), JSON.stringify(all)); } catch (e) {} }
  // Giu phan tieu de luon nam trong man hinh de con cho bam keo lai: dock giu thanh tieu de danh sach (rong 280) + dinh khong bi tran len tren.
  function posClamp(el, which, r, b) {
    var W = window.innerWidth || 1200, H = window.innerHeight || 800;
    var keep = which === 'b' ? (el.offsetWidth || 48) : 280;
    var maxR = Math.max(0, W - keep), maxB = Math.max(0, H - Math.max(el.offsetHeight || 40, 40));
    return { r: Math.min(Math.max(0, r), maxR), b: Math.min(Math.max(0, b), maxB) };
  }
  function posApply() {
    var all = posLoad();
    [['d', $('tc-mini')], ['b', $('tc-bubble')]].forEach(function (x) {
      var el = x[1], p = all[x[0]]; if (!el) return;
      if (p && isFinite(p.r) && isFinite(p.b)) { var c = posClamp(el, x[0], p.r, p.b); el.style.right = c.r + 'px'; el.style.bottom = c.b + 'px'; }
      else { el.style.right = ''; el.style.bottom = ''; }
    });
  }
  function posReclamp(el, which) {   // cua so moi mo lam dock cao them / man hinh thu nho -> keo nguoc vao vung nhin thay
    if (!el || !el.style.right) return;
    var c = posClamp(el, which, parseFloat(el.style.right) || 0, parseFloat(el.style.bottom) || 0);
    if (c.r + 'px' !== el.style.right) el.style.right = c.r + 'px';
    if (c.b + 'px' !== el.style.bottom) el.style.bottom = c.b + 'px';
  }
  // Keo bang thanh tieu de (handleSel); nut/o nhap ben trong tieu de van bam binh thuong. Keo < 5px = coi la CLICK (mo/thu danh sach nhu cu).
  // Sau 1 lan keo that, chan dung 1 su kien click tiep theo (neu khong thanh tieu de se bi bam nham "thu/mo").
  function miniDrag(el, handleSel, which) {
    var st = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var h = e.target.closest ? e.target.closest(handleSel) : null;
      if (!h || (e.target.closest && e.target.closest('button,input,textarea,a,select'))) return;
      var rc = el.getBoundingClientRect();
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, r: (window.innerWidth || 1200) - rc.right, b: (window.innerHeight || 800) - rc.bottom, moved: false };
      try { h.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved) { if (Math.abs(dx) + Math.abs(dy) < 5) return; st.moved = true; el.classList.add('tcm-dragging'); }
      var c = posClamp(el, which, st.r - dx, st.b - dy);
      el.style.right = c.r + 'px'; el.style.bottom = c.b + 'px';
    });
    function end(e) {
      if (!st || (e && e.pointerId !== st.id)) return;
      var moved = st.moved; st = null; el.classList.remove('tcm-dragging');
      if (moved) { S.mini.justDragged = true; setTimeout(function () { S.mini.justDragged = false; }, 120); posSave(which, { r: parseFloat(el.style.right) || 0, b: parseFloat(el.style.bottom) || 0 }); }
    }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('click', function (e) { if (S.mini.justDragged) { S.mini.justDragged = false; e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault(); } }, true);
  }
  // Bong bong 💬 khi "thu nho hang": cung keo duoc, co huy hieu chua doc, bam de mo lai dock nhu truoc.
  function miniBubble() {
    var b = $('tc-bubble'); if (b) return b;
    b = document.createElement('div'); b.id = 'tc-bubble'; b.className = 'off';
    b.title = 'Chat nội bộ — bấm để mở lại · kéo để di chuyển';
    b.innerHTML = '💬<span class="tcm-nb" id="tcb-badge" style="display:none">0</span>';
    document.body.appendChild(b);
    miniDrag(b, '#tc-bubble', 'b');
    b.addEventListener('click', function () { S.mini.hidden = false; miniSave(); miniRenderAll(); miniMarkVisible(); });
    posApply();
    return b;
  }

  function miniDock() {
    var d = $('tc-mini'); if (d) return d;
    d = document.createElement('div'); d.id = 'tc-mini'; d.className = 'off';
    d.innerHTML = '<div class="tcm-list" id="tcm-list">' +
      '<div class="tcm-lh" data-act="list" title="Bấm để mở/thu danh sách · Kéo để di chuyển"><span>💬 Chat nội bộ</span><span class="tcm-nb" id="tcm-lbadge" style="display:none">0</span><span class="tcm-sp"></span>' +
        '<button data-act="newdm" title="Nhắn riêng">✉</button><button data-act="newch" title="Tạo nhóm">＋</button><button data-act="hide" title="Thu nhỏ hẳn thành biểu tượng 💬">–</button></div>' +
      '<div class="tcm-lp"><input class="tcm-q" placeholder="Tìm kênh / người…"><div class="tcm-lbody" id="tcm-lbody"></div></div></div>';
    document.body.appendChild(d);
    miniDrag(d, '.tcm-lh,.tcm-wh', 'd');   // phai dang ky TRUOC miniClick de chan duoc click sau khi keo
    posApply();
    d.addEventListener('click', miniClick);
    d.addEventListener('keydown', function (e) {
      if (e.target.tagName !== 'TEXTAREA' || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      var el = e.target.closest('.tcm-win'), w = el ? miniWin(el.getAttribute('data-ch')) : null;
      if (w) { e.preventDefault(); miniSend(w); }
    });
    d.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('tcm-q')) { S.mini.q = t.value; miniRenderListBody(); }
      else if (t.tagName === 'TEXTAREA') { t.style.height = 'auto'; t.style.height = Math.min(90, t.scrollHeight) + 'px'; }
    });
    return d;
  }
  function miniClick(e) {
    var a = e.target.closest ? e.target.closest('[data-act]') : null; if (!a) return;
    var act = a.getAttribute('data-act'), win = a.closest('.tcm-win'), ch = a.getAttribute('data-ch') || (win ? win.getAttribute('data-ch') : ''), w = ch ? miniWin(ch) : null;
    if (act === 'list') { S.mini.listOpen = !S.mini.listOpen; miniSave(); miniRenderAll(); if (S.mini.listOpen) { var q = $('tc-mini').querySelector('.tcm-q'); if (q) q.focus(); } }
    else if (act === 'newdm') { e.stopPropagation(); tcNewDm(true); }
    else if (act === 'newch') { e.stopPropagation(); tcNewChannel(true); }
    else if (act === 'hide') { e.stopPropagation(); S.mini.hidden = true; miniSave(); miniRenderAll(); }
    else if (act === 'open') miniOpen(ch);
    else if (act === 'wmin' && w) { w.min = !w.min; miniSave(); miniRenderWin(w, true); if (!w.min) { miniMarkVisible(); var ta = w.el.querySelector('textarea'); if (ta) ta.focus(); } else renderBadges(); }
    else if (act === 'wclose' && w) miniClose(ch);
    else if (act === 'wsend' && w) miniSend(w);
    else if (act === 'older' && w) { var arr = (S.msgs[ch] || []).filter(function (m) { return !m.tmp; }); if (arr.length) loadHistory(ch, arr[0].id).then(function () { w.sig = ''; miniRenderWin(w); }); }
    else if (act === 'wfull' && w) {
      miniClose(ch);
      var tabEl = document.querySelector('.tab[data-bar-id="tab-teamchat"]');
      if (typeof switchTab === 'function') { switchTab('teamchat', tabEl); setTimeout(function () { tcSelect(ch); }, 0); }
    }
  }
  function miniBuildWin(w) {
    var el = document.createElement('div'); el.className = 'tcm-win'; el.setAttribute('data-ch', w.id);
    el.innerHTML = '<div class="tcm-wh" data-act="wmin"><span class="tcm-wt"></span><span class="tcm-nb" style="display:none"></span><span class="tcm-sp"></span>' +
      '<button data-act="wfull" title="Mở trong tab Chat nội bộ">⤢</button><button data-act="wmin" title="Thu gọn / mở">–</button><button data-act="wclose" title="Đóng">×</button></div>' +
      '<div class="tcm-wb"><div class="tcm-msgs"></div><div class="tcm-comp"><textarea rows="1" maxlength="' + MAX_LEN + '" placeholder="Nhập tin nhắn…"></textarea>' +
      '<button data-act="wsend" title="Gửi">➤</button></div></div>';
    return el;
  }
  function miniSync() {
    var d = miniDock();
    S.mini.wins = S.mini.wins.filter(function (w) { var ok = !!chById(w.id); if (!ok && w.el) w.el.remove(); return ok; });
    S.mini.wins.forEach(function (w) { if (!w.el) w.el = miniBuildWin(w); d.appendChild(w.el); });
  }
  function miniRenderListBody() {
    var box = $('tcm-lbody'); if (!box || !S.me) return;
    var q = (S.mini.q || '').toLowerCase(), list = S.chans.filter(function (c) { return !q || chName(c).toLowerCase().indexOf(q) !== -1; });
    list.sort(function (a, b) { return lastTs(b.id) - lastTs(a.id) || chName(a).localeCompare(chName(b)); });
    var h = '';
    list.forEach(function (c) {
      var n = unread(c.id), arr = S.msgs[c.id] || [], last = arr.length ? arr[arr.length - 1] : null;
      var prev = last ? (last.u === S.me.username ? 'Bạn' : last.n) + ': ' + last.t.slice(0, 40) : (c.desc || '');
      h += '<div class="tcm-it' + (n ? ' has' : '') + '" data-act="open" data-ch="' + esc(c.id) + '">' +
        '<div class="tc-av" style="background:' + colorOf(c.id) + '">' + esc(c.type === 'dm' ? initials(chName(c)) : chIcon(c)) + '</div>' +
        '<div class="tcm-im"><div class="tcm-in">' + esc(chName(c)) + '</div><div class="tcm-ip">' + esc(prev) + '</div></div>' +
        (n ? '<span class="tcm-nb' + (unreadMention(c.id) ? ' men' : '') + '">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</div>';
    });
    box.innerHTML = h || '<div class="tc-empty">Không có kênh nào khớp.</div>';
  }
  function miniMsgsHtml(ch) {
    var a = S.msgs[ch] || [], h = '', lastDay = '', lastU = '', lastT = 0;
    if (S.more[ch]) h += '<div class="tc-more"><button class="btn sm" data-act="older">Xem tin cũ hơn</button></div>';
    if (!a.length) h += '<div class="tc-empty">Chưa có tin nhắn nào 👋</div>';
    a.forEach(function (m) {
      var dk = dayKey(m.ts || Date.now());
      if (dk !== lastDay) { h += '<div class="tc-day"><span>' + dayLabel(m.ts || Date.now()) + '</span></div>'; lastDay = dk; lastU = ''; }
      var mine = m.u === S.me.username, grp = (m.u === lastU && (m.ts - lastT) < 300000);
      h += '<div class="tc-msg' + (mine ? ' mine' : '') + (grp ? ' grp' : '') + (m.tmp ? ' tmp' : '') + (mentionsMe(m) && !mine ? ' men' : '') + '">' +
        (grp ? '<div class="tc-av ph"></div>' : '<div class="tc-av" style="background:' + colorOf(m.u) + '">' + esc(initials(m.n)) + '</div>') +
        '<div class="tc-bd">' + (grp ? '' : '<div class="tc-who"><b>' + esc(m.n) + '</b><span>' + hhmm(m.ts) + '</span></div>') +
        '<div class="tc-tx">' + fmtText(m.t) + '</div></div>' + (m.tmp ? '<div class="tc-st">đang gửi…</div>' : '') + '</div>';
      lastU = m.u; lastT = m.ts;
    });
    return h;
  }
  function miniRenderWin(w, stick) {
    var el = w.el; if (!el || !S.me) return;
    var c = chById(w.id), n = unread(w.id), nb = el.querySelector('.tcm-wh .tcm-nb');
    el.querySelector('.tcm-wt').textContent = c ? chIcon(c) + ' ' + chName(c) : '…';
    nb.textContent = n > 99 ? '99+' : n; nb.style.display = (n && w.min) ? '' : 'none'; nb.classList.toggle('men', unreadMention(w.id));
    el.classList.toggle('min', !!w.min);
    if (w.min) return;
    var a = S.msgs[w.id] || [], sig = a.length + '|' + (a.length ? a[a.length - 1].id : '') + '|' + (S.more[w.id] ? 1 : 0) + '|' + S.authFail;
    if (sig === w.sig && !stick) return;
    w.sig = sig;
    var box = el.querySelector('.tcm-msgs'), near = box.scrollHeight - box.scrollTop - box.clientHeight < 70, prevH = box.scrollHeight, prevT = box.scrollTop;
    box.innerHTML = S.authFail ? '<div class="tc-empty">Phiên đăng nhập đã hết hạn — đăng nhập lại để dùng chat.</div>' : miniMsgsHtml(w.id);
    if (stick || near) box.scrollTop = box.scrollHeight; else box.scrollTop = prevT + (box.scrollHeight - prevH);
  }
  function miniRenderAll() {
    var d = $('tc-mini'); if (!d) { if (!S.me) return; d = miniDock(); }
    var show = !!S.me && !S.panelOn && !S.authFail;
    var bub = miniBubble();
    d.classList.toggle('off', !show || !!S.mini.hidden);        // dock bi an khi nguoi dung thu nho hang -> chi con bong bong
    bub.classList.toggle('off', !show || !S.mini.hidden);
    if (!show) return;
    var lst = $('tcm-list'), b = $('tcm-lbadge'), n = totalUnread();
    var bb = $('tcb-badge'); if (bb) { bb.textContent = n > 99 ? '99+' : n; bb.style.display = n ? '' : 'none'; }
    bub.classList.toggle('has', n > 0);
    if (S.mini.hidden) { posReclamp(bub, 'b'); return; }
    lst.classList.toggle('open', !!S.mini.listOpen);
    b.textContent = n > 99 ? '99+' : n; b.style.display = n ? '' : 'none';
    if (S.mini.listOpen) miniRenderListBody();
    S.mini.wins.forEach(function (w) { miniRenderWin(w); });
    posReclamp(d, 'd');
  }
  function miniOpen(id) {
    if (!S.me || !chById(id)) return;
    var w = miniWin(id);
    if (w) w.min = false;
    else {
      w = { id: id, min: false, el: null, sending: false, sig: '' };
      S.mini.wins.unshift(w);
      while (S.mini.wins.length > miniMax()) { var old = S.mini.wins.pop(); if (old.el) old.el.remove(); }
    }
    miniSave(); miniSync(); miniRenderAll(); miniRenderWin(w, true);
    var ta = w.el && w.el.querySelector('textarea'); if (ta) ta.focus();
    if (!S.msgs[id] || !S.msgs[id].length) loadHistory(id).then(function () { miniRenderWin(w, true); miniMarkVisible(); });
    else miniMarkVisible();
  }
  function miniClose(id) {
    var w = miniWin(id); if (!w) return;
    if (w.el) w.el.remove();
    S.mini.wins = S.mini.wins.filter(function (x) { return x !== w; });
    miniSave(); renderBadges();
  }
  function miniReset() {
    S.mini.wins.forEach(function (w) { if (w.el) w.el.remove(); });
    S.mini.wins = []; S.mini.q = '';
    var d = $('tc-mini'); if (d) d.classList.add('off');
  }
  function miniRestore() {
    var raw = null; try { raw = JSON.parse(localStorage.getItem(miniKey()) || 'null'); } catch (e) {}
    miniReset();
    S.mini.listOpen = !!(raw && raw.l);
    S.mini.hidden = !!(raw && raw.h);
    if (raw && raw.w) raw.w.slice(0, miniMax()).forEach(function (x) { if (chById(x[0])) S.mini.wins.push({ id: x[0], min: !!x[1], el: null, sending: false, sig: '' }); });
    miniSync(); posApply(); miniRenderAll();
    S.mini.wins.forEach(function (w) {
      if (!S.msgs[w.id] || !S.msgs[w.id].length) loadHistory(w.id).then(function () { miniRenderWin(w, true); miniMarkVisible(); });
      else { miniRenderWin(w, true); }
    });
    miniMarkVisible();
  }
  function miniReloadAll() {   // tin bi xoa (dver doi): nap lai lich su cac cua so dang mo (kenh dang xem o tab Chat do reloadActive lo)
    S.mini.wins.forEach(function (w) {
      if (w.id === S.active && S.panelOn) return;
      S.msgs[w.id] = (S.msgs[w.id] || []).filter(function (m) { return m.tmp; });
      loadHistory(w.id).then(function () { miniRenderWin(w, true); });
    });
  }
  async function miniSend(w) {
    var ta = w.el && w.el.querySelector('textarea'); if (!ta || w.sending || !S.me) return;
    var text = ta.value.trim(); if (!text) return;
    if (text.length > MAX_LEN) { say('Tin nhắn quá dài (tối đa ' + MAX_LEN + ' ký tự)'); return; }
    var ch = w.id; w.sending = true;
    var tmp = { id: 't' + Date.now(), c: ch, u: S.me.username, n: S.me.name, t: text, ts: Date.now(), r: '', tmp: true };
    (S.msgs[ch] || (S.msgs[ch] = [])).push(tmp);
    ta.value = ''; ta.style.height = 'auto'; miniRenderWin(w, true);
    var r = await apiPost('chatSend', { channel: ch, text: text, replyTo: '' });
    S.msgs[ch] = (S.msgs[ch] || []).filter(function (m) { return m !== tmp; });
    if (r.ok) {
      addMsg(r.msg); S.last = Math.max(S.last, r.last || 0);
      if (S.pendingDm && S.pendingDm.id === ch) { S.pendingDm = null; await reloadChannels(); }
      markRead(ch);
    } else {
      if (r.code === 'AUTH') S.authFail = true;
      say(r.error || 'Gửi không được, thử lại'); if (!ta.value) ta.value = text;
    }
    w.sending = false; miniRenderWin(w, true);
    if (S.panelOn && S.active === ch) renderMsgs(true);
    renderSide(); renderBadges();
  }
  window.addEventListener('resize', function () {
    posReclamp($('tc-mini'), 'd'); posReclamp($('tc-bubble'), 'b');   // thu nho cua so trinh duyet: keo dock/bong bong vao lai vung nhin thay
    var mx = miniMax(); if (S.mini.wins.length <= mx) return;
    while (S.mini.wins.length > mx) { var old = S.mini.wins.pop(); if (old.el) old.el.remove(); }
    miniSave();
  });

  // ───────────── gan vao app ─────────────
  function enter() {
    ensurePanel(); S.panelOn = true;
    if (!S.started) { start().then(function () { renderSide(); renderHead(); renderMsgs(true); if (S.me) { loadIfEmpty(); } }); }
    renderSide(); renderHead(); renderMsgs(true); loadIfEmpty();
    if (S.started) { clearTimeout(S.timer); tick(); }
  }
  async function loadIfEmpty() {
    var ch = S.active;
    if (S.me && (!S.msgs[ch] || !S.msgs[ch].length) && chById(ch)) { await loadHistory(ch); if (S.active === ch) renderMsgs(true); }
    if (S.me && S.active === ch) markRead(ch);
  }
  var _prevSwitch = switchTab;
  switchTab = function (tab, el) {
    _prevSwitch(tab, el);
    var p = $('tab-teamchat');
    S.panelOn = (tab === 'teamchat');
    document.body.classList.toggle('tc-on', tab === 'teamchat');
    miniRenderAll(); if (tab !== 'teamchat') miniMarkVisible();   // CSS: an banner deploy (co dinh goc duoi phai) de khong che nut Gui
    if (tab === 'teamchat') { ensurePanel(); p = $('tab-teamchat'); if (p) p.style.display = 'flex'; enter(); }
    else if (p) p.style.display = 'none';
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.started) { clearTimeout(S.timer); tick(); if (S.panelOn) markRead(S.active); miniMarkVisible(); } });
  // Tu khoi dong sau khi dang nhap (de huy hieu chua doc chay ca khi chua mo tab Chat); dung lai khi dang xuat.
  setInterval(function () {
    var has = !!tok() && !!gs();
    if (has && !S.started && !S.busy && !S.authFail) start();
    else if (!has && (S.started || S.me)) stop();
    else if (has && S.authFail && tok()) { /* cho nguoi dung dang nhap lai: token moi se khac token cu */ }
  }, 3000);
  var _lastTok = tok();
  setInterval(function () { var t = tok(); if (t !== _lastTok) { _lastTok = t; S.authFail = false; if (S.started) stop(); } }, 2000);
})();
