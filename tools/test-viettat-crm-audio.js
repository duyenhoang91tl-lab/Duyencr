#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — dinh kem TEP GHI AM co san (khong can bam ghi am): chon nhieu tep, tai len tuan tu, tran 10 tep / 10MB, nghe thu, go, luu gui `audios`.
// Nap NGUYEN js/57-viettat.js + khoi #vt-section cua index.html trong jsdom. Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-crm-audio.js
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can `npm i jsdom` (NODE_PATH)'); process.exit(0); }
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js', '57-viettat.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const m = html.match(/<div id="vt-section"[\s\S]*?<div id="vt-list"[^>]*><\/div>\s*<\/div>/); ok(!!m, 'index.html co khoi #vt-section');
ok(/id="vt-f-audfiles"[^>]*accept="audio\/\*/.test(html) && /id="vt-f-audbtn"/.test(html) && /id="vt-f-auds"/.test(html), 'form co ô chọn tệp ghi âm (accept audio/*) + nút + danh sách');
const AUDSAVED = { id: 'SAVEDAUDIOAAAAAAAA', name: 'loi chao.m4a' };
const SN = [{ id: 'vt_a', abbr: 'chao', keyword: '', options: ['Chào'], scope: 'team', nhom: 'X', audios: [AUDSAVED, { id: 'SAVEDAUDIOBBBBBBBB', name: 'bao gia.mp3' }, { id: 'SAVEDAUDIOCCCCCCCC', name: 'c.wav' }, { id: 'SAVEDAUDIODDDDDDDD', name: 'd.ogg' }] },
            { id: 'vt_b', abbr: 'khong', keyword: '', options: ['Không ghi âm'], scope: 'team', nhom: '' }];
async function boot(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body>' + m[0] + '</body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window, calls = [], alerts = [], played = [], revoked = []; let seq = 0;
  w.gsUrl = 'https://gas.test/exec'; w.toast = () => {}; w.alert = (t) => alerts.push(t); w.confirm = () => true; w.switchTab = () => {};
  w.URL.createObjectURL = (b) => 'blob:' + (++seq); w.URL.revokeObjectURL = (u) => revoked.push(u);
  w.Audio = function (u) { this.src = u; this.play = () => { played.push(u); return Promise.resolve(); }; this.pause = () => {}; };
  w.fetch = async (u, init) => {
    calls.push({ u, body: init && init.body });
    if (/action=vietTatAudio/.test(u)) return { json: async () => (o.audioGet ? o.audioGet(u) : { ok: true, base64: Buffer.from('xyz').toString('base64'), mimeType: 'audio/mp4' }) };
    if (init && init.body && /"action":"vietTatUploadAudio"/.test(init.body)) return { json: async () => (o.upload ? o.upload(JSON.parse(init.body)) : { ok: true, id: 'UPA_' + JSON.parse(init.body).name.replace(/\W/g, '') + '_ZZZZZZZZ', name: JSON.parse(init.body).name }) };
    if (/action=vietTat/.test(u)) return { json: async () => ({ ok: true, snippets: o.snippets || SN, canTeam: true, me: 'Duyen' }) };
    return { json: async () => (o.save || { ok: true, id: 'vt_new' }) };
  };
  w.eval('var currentPhone="";var allCustomers=[];'); w.eval(code); await sleep(10);
  const $ = (id) => w.document.getElementById(id);
  return { w, calls, alerts, played, revoked, $ };
}
const mkFile = (w, name, type, data, size) => { const f = new w.File([data || 'abc'], name, { type }); if (size) Object.defineProperty(f, 'size', { value: size }); return f; };
(async () => {
  // (a) danh sach: muc co tep ghi am hien "🎤 N tep"
  let E = await boot(); E.w.switchTab('zaloai'); E.w.loadVietTat(true); await sleep(20);
  const list = E.$('vt-list');
  ok(/🎤 4 tệp ghi âm/.test(list.textContent) && /loi chao\.m4a/.test(list.textContent) && /…/.test(list.textContent), 'danh sach: muc co 4 tep hien "🎤 4 tệp ghi âm: tên 3 tệp đầu …"');
  ok(list.querySelectorAll('.vt-auds').length === 1, 'muc khong co tep ghi am thi khong hien dong 🎤');

  // (b) mo muc co tep -> form hien san 4 tep; nghe thu tep da luu -> tai byte qua vietTatAudio
  E.w.vtOpenForm('vt_a');
  ok(E.$('vt-f-auds').children.length === 4 && /4\/10/.test(E.$('vt-f-audcount').textContent), 'mo muc cu: form hien 4 tep (4/10)');
  E.calls.length = 0; await E.w.vtPlayAud(0); await sleep(10);
  const g = E.calls.find((c) => /action=vietTatAudio/.test(c.u));
  ok(g && /id=SAVEDAUDIOAAAAAAAA/.test(g.u) && E.played.length === 1, 'nghe thu tep da luu: GET vietTatAudio theo id, roi phat');
  E.calls.length = 0; await E.w.vtPlayAud(0); ok(!E.calls.some((c) => /action=vietTatAudio/.test(c.u)) && E.played.length === 2, 'nghe lai: dung ban da tai (khong tai lai)');
  let E2 = await boot({ audioGet: () => ({ ok: false, error: 'Tep ghi am nay khong thuoc muc nao' }) }); E2.w.switchTab('zaloai'); E2.w.loadVietTat(true); await sleep(20); E2.w.vtOpenForm('vt_a');
  await E2.w.vtPlayAud(1); ok(/Không nghe thử được/.test(E2.$('vt-f-audmsg').textContent) && E2.played.length === 0, 'server tu choi: bao loi, khong phat');

  // (c) chon nhieu tep ghi am: tai TUAN TU (1 request / tep), bo tep khong phai am thanh, nhan tep Android mime la
  let inflight = 0, peak = 0;
  const U = await boot({ snippets: [], upload: async (b) => { inflight++; peak = Math.max(peak, inflight); await sleep(10); inflight--; return { ok: true, id: 'UPA_' + b.name.replace(/\W/g, '') + '_ZZZZZZZZ', name: b.name }; } });
  U.w.vtOpenForm();
  await U.w.vtUploadAudios([mkFile(U.w, 'a.m4a', 'audio/x-m4a', 'AAA'), mkFile(U.w, 'b.mp3', 'audio/mpeg', 'BBB'), mkFile(U.w, 'zalo.3gp', 'video/3gpp', 'CCC'), mkFile(U.w, 'anh.jpg', 'image/jpeg'), mkFile(U.w, 'ghi.amr', '', 'DDD')]);
  const ups = U.calls.filter((c) => c.body && /vietTatUploadAudio/.test(c.body)).map((c) => JSON.parse(c.body));
  ok(ups.length === 4 && ups.every((x) => x.base64.length > 0), 'chon 5 tep (1 la anh): 4 request vietTatUploadAudio, bo tep anh');
  ok(Buffer.from(ups[0].base64, 'base64').toString() === 'AAA' && ups[0].name === 'a.m4a' && ups[0].mimeType === 'audio/x-m4a', 'noi dung base64 + ten + mime gui dung');
  ok(ups.some((x) => x.name === 'zalo.3gp' && x.mimeType === 'video/3gpp') && ups.some((x) => x.name === 'ghi.amr' && x.mimeType === ''), 'nhan tep .3gp (mime video/3gpp) va .amr (khong mime) nhờ duoi tep');
  ok(peak === 1, 'tai tuan tu tung tep (peak=' + peak + ')');
  ok(U.$('vt-f-auds').children.length === 4 && /4\/10/.test(U.$('vt-f-audcount').textContent) && /Đã tải lên 4 tệp ghi âm/.test(U.$('vt-f-audmsg').textContent) && /1 tệp không phải âm thanh/.test(U.$('vt-f-audmsg').textContent) && /Lưu/.test(U.$('vt-f-audmsg').textContent), 'form: 4 tep, bao ket qua + nhac bam Luu');
  ok(U.$('vt-f-audbtn').disabled === false && /Chọn tệp ghi âm/.test(U.$('vt-f-audbtn').textContent), 'xong: nut bat lai');
  // nghe thu tep vua chon: dung ban cuc bo, khong goi server
  U.calls.length = 0; await U.w.vtPlayAud(0); ok(U.played.length === 1 && !U.calls.length, 'tep vua chon: nghe tu ban cuc bo, KHONG goi server');
  // luu: gui audios
  U.$('vt-f-abbr').value = 'gm'; U.$('vt-f-opts').querySelector('textarea').value = 'Xin chao'; U.calls.length = 0; await U.w.vtSave(); await sleep(10);
  const sv = JSON.parse(U.calls.find((c) => c.body && /saveVietTat/.test(c.body)).body).snippet;
  ok(sv.audios.length === 4 && sv.audios[0].id.indexOf('UPA_a') === 0 && !('url' in sv.audios[0]) && Array.isArray(sv.images), 'Luu: gui 4 {id,name} (khong kem url cuc bo) + images');
  // go bot
  U.w.vtOpenForm(); await U.w.vtUploadAudios([mkFile(U.w, 'x.wav', 'audio/wav')]); U.w.vtRemoveAud(0);
  ok(U.$('vt-f-auds').children.length === 0 && U.revoked.length >= 1, 'go tep: bo khoi danh sach + giai phong blob');
  // sua muc: go 1 tep -> gui danh sach con lai; go het -> gui []
  E.w.vtOpenForm('vt_a'); E.w.vtRemoveAud(1); E.calls.length = 0; await E.w.vtSave(); await sleep(10);
  ok(JSON.parse(E.calls.find((c) => c.body && /saveVietTat/.test(c.body)).body).snippet.audios.map((x) => x.id).join() === 'SAVEDAUDIOAAAAAAAA,SAVEDAUDIOCCCCCCCC,SAVEDAUDIODDDDDDDD', 'sua muc: go tep thu 2 -> gui 3 tep con lai');
  E.w.vtOpenForm('vt_a'); [0, 0, 0, 0].forEach(() => E.w.vtRemoveAud(0)); E.calls.length = 0; await E.w.vtSave(); await sleep(10);
  ok(JSON.stringify(JSON.parse(E.calls.find((c) => c.body && /saveVietTat/.test(c.body)).body).snippet.audios) === '[]', 'go het tep: gui audios = [] (de server go that)');
  E.w.vtOpenForm('vt_b'); ok(E.$('vt-f-auds').children.length === 0 && E.$('vt-f-audmsg').textContent === '', 'mo muc khac: danh sach tep reset, khong dinh tep cua muc truoc');

  // (d) gioi han: tep >10MB bi bo qua; tran 10 tep
  const B = await boot({ snippets: [] }); B.w.vtOpenForm(); B.calls.length = 0;
  await B.w.vtUploadAudios([mkFile(B.w, 'dai.wav', 'audio/wav', 'x', 11 * 1048576), mkFile(B.w, 'ok.wav', 'audio/wav')]);
  ok(B.calls.filter((c) => c.body && /vietTatUploadAudio/.test(c.body)).length === 1 && /Bỏ qua 1 tệp quá 10\.0 MB/.test(B.$('vt-f-audmsg').textContent), 'tep > 10MB bi bo qua (khong gui), tep ok van tai');
  await B.w.vtUploadAudios([mkFile(B.w, 'chi-lon.wav', 'audio/wav', 'x', 12 * 1048576)]);
  ok(/quá lớn/.test(B.$('vt-f-audmsg').textContent) && B.calls.filter((c) => c.body && /vietTatUploadAudio/.test(c.body)).length === 1, 'chi chon toan tep qua lon: bao loi, khong gui');
  const T = await boot({ snippets: [] }); T.w.vtOpenForm(); T.calls.length = 0;
  await T.w.vtUploadAudios(Array.from({ length: 12 }, (_, i) => mkFile(T.w, 'f' + i + '.mp3', 'audio/mpeg')));
  ok(T.calls.filter((c) => c.body && /vietTatUploadAudio/.test(c.body)).length === 10 && T.$('vt-f-auds').children.length === 10 && /Bỏ qua 2 tệp vì mỗi mục tối đa 10/.test(T.$('vt-f-audmsg').textContent), 'chon 12 tep: chi tai 10, bao bo qua 2');
  await T.w.vtUploadAudios([mkFile(T.w, 'them.mp3', 'audio/mpeg')]); ok(/tối đa 10/.test(T.$('vt-f-audmsg').textContent) && T.calls.filter((c) => c.body && /vietTatUploadAudio/.test(c.body)).length === 10, 'da du 10: chon them bi chan ngay');
  // (e) loi server tung tep
  let k = 0; const F = await boot({ snippets: [], upload: async (b) => (++k === 2 ? { ok: false, error: 'Chi nhan tep ghi am / am thanh' } : { ok: true, id: 'UPF_' + k + '_ZZZZZZZZZZZZZZ', name: b.name }) });
  F.w.vtOpenForm(); await F.w.vtUploadAudios([mkFile(F.w, 'a.mp3', 'audio/mpeg'), mkFile(F.w, 'b.mp3', 'audio/mpeg'), mkFile(F.w, 'c.mp3', 'audio/mpeg')]);
  ok(F.$('vt-f-auds').children.length === 2 && /1 tệp lỗi/.test(F.$('vt-f-audmsg').textContent) && /b\.mp3/.test(F.$('vt-f-audmsg').textContent), '1 tep loi: bao rieng, 2 tep con lai van them');
  // (f) Luu khi dang tai: chan; dong form / mo muc khac giua chung: bo ket qua
  const P = await boot({ snippets: [], upload: async (b) => { await sleep(40); return { ok: true, id: 'UPP_' + b.name.replace(/\W/g, '') + '_ZZZZZZZZ', name: b.name }; } });
  P.w.vtOpenForm(); const pend = P.w.vtUploadAudios([mkFile(P.w, 'p1.mp3', 'audio/mpeg'), mkFile(P.w, 'p2.mp3', 'audio/mpeg')]); await sleep(10);
  P.$('vt-f-abbr').value = 'x'; P.$('vt-f-opts').querySelector('textarea').value = 'y'; P.calls.length = 0; await P.w.vtSave();
  ok(P.alerts.some((a) => /Đang tải tệp ghi âm/.test(a)) && !P.calls.some((c) => c.body && /saveVietTat/.test(c.body)), 'bam Luu khi dang tai tep: chan + nhac doi (khong mat tep)');
  P.w.vtOpenForm(); await pend; await sleep(60);
  ok(P.$('vt-f-auds').children.length === 0 && P.$('vt-f-audbtn').disabled === false, 'mo form khac giua luc tai: ket qua tai do KHONG chui sang muc moi');
  console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
