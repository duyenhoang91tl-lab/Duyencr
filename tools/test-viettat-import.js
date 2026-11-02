#!/usr/bin/env node
// Test (2026-10-25): CRM "Nhap tu app Viet Tat cu" (js/57-viettat.js: vtImportFile/_vtUnzip/_vtPlanImport). Zip that (deflate + stored) tao bang zlib.
// Can jsdom: NODE_PATH=<thu muc co node_modules/jsdom> node tools/test-viettat-import.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom (NODE_PATH)'); process.exit(0); }
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js', '57-viettat.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function zip(entries) { // entries: [{name,data:Buffer,store?}]
  const loc = [], cen = []; let off = 0;
  for (const e of entries) {
    const nm = Buffer.from(e.name), raw = e.data, comp = e.store ? raw : zlib.deflateRawSync(raw), crc = zlib.crc32 ? zlib.crc32(raw) : 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(e.store ? 0 : 8, 8); h.writeUInt32LE(crc >>> 0, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(e.store ? 0 : 8, 10); c.writeUInt32LE(crc >>> 0, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    loc.push(h, nm, comp); cen.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...loc, cd, end]);
}
const DATA = { folders: [{ id: 'default', name: 'Chung' }, { id: 'f1', name: 'Túi tiền/Cổ' }], tombstones: [], snippets: [
  { id: 's1', folderId: 'default', abbr: 'ch', keyword: 'chào', options: ['Chào {tên} ạ', 'Dạ em chào chị'] },
  { id: 's2', folderId: 'f1', abbr: 'gb', keyword: 'giá', options: ['Giá nhẫn', '[[img:a.jpg]]', '[[img:b.png]]', '[[aud:v.m4a]]'] },
  { id: 's3', folderId: 'f1', abbr: 'chỉ ảnh', keyword: '', options: ['[[img:a.jpg]]'] },
  { id: 's4', folderId: 'f1', abbr: 'am', keyword: '', options: ['[[aud:v.m4a]]'] },
  { id: 's5', folderId: 'f1', abbr: 'thieu', keyword: '', options: ['x', '[[img:khongco.jpg]]'] },
  { id: 's6', folderId: 'f1', abbr: 'CH', keyword: '', options: ['trùng ch'] } ] };
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
async function boot(o) {
  const dom = new JSDOM('<!doctype html><body><div id="vt-imp-msg"></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/', pretendToBeVisual: true });
  const w = dom.window, calls = [], up = []; o = o || {};
  w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream; w.Response = Response;
  w.gsUrl = 'https://gas.test/exec'; w.toast = () => {}; w.alert = () => {}; w.confirm = () => true;
  w.fetch = async (u, init) => { const b = init && init.body ? JSON.parse(init.body) : null; calls.push({ u, b });
    if (b && b.action === 'vietTatUploadImage') { up.push(b); return { json: async () => ({ ok: true, id: 'IMG_' + b.name.replace(/\W/g, '') + '_AAAAAAAAAA', name: b.name }) }; }
    if (b && b.action === 'saveVietTat') return { json: async () => (o.saveErr && o.saveErr(b.snippet) ? { error: 'loi gia' } : { ok: true, id: 'vt_' + calls.length }) };
    return { json: async () => ({ ok: true, snippets: [], canTeam: !!o.admin, me: 'Hoa' }) }; };
  w.eval('var currentPhone="";var allCustomers=[];'); w.eval(code); await sleep(10);
  w._vtCompress = undefined; w.eval('_vtCompress = function (f) { return Promise.resolve({ blob: f, name: f.name, mime: f.type }); };');
  w.eval('_vtSt.list = ' + JSON.stringify(o.have || []) + '; _vtSt.canTeam = ' + !!o.admin + ';');
  const asFile = (buf) => ({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) });
  return { w, calls, up, asFile, msg: () => w.document.getElementById('vt-imp-msg').textContent, saves: () => calls.filter((c) => c.b && c.b.action === 'saveVietTat').map((c) => c.b.snippet) };
}
(async () => {
  // 1) ke hoach nhap (thuan du lieu)
  let E = await boot();
  const plan = E.w._vtPlanImport(JSON.stringify(DATA), { 'media/a.jpg': 1, 'media/b.png': 1 });
  ok(plan.items.length === 5 && plan.audio === 2 && plan.missing === 1, 'plan: 5 muc (bo muc chi ghi am), 2 ghi am, 1 anh thieu: ' + JSON.stringify([plan.items.length, plan.audio, plan.missing]));
  ok(plan.items[0].nhom === '' && plan.items[1].nhom === 'Túi tiền-Cổ', 'thu muc "Chung" -> nhom rong; dau / trong ten thu muc doi thanh - (khong tao thu muc con ngoai y muon)');
  ok(plan.items[2].abbr === 'chỉ_ảnh', 'viet tat co khoang -> dau _');
  let thrown = ''; try { E.w._vtPlanImport('{"x":1}', null); } catch (e) { thrown = e.message; } ok(/snippets/.test(thrown), 'file sai dinh dang -> bao loi');

  // 2) nhap zip (deflate) day du
  const z = zip([{ name: 'data.json', data: Buffer.from(JSON.stringify(DATA)) }, { name: 'media/', data: Buffer.alloc(0), store: true }, { name: 'media/a.jpg', data: JPG }, { name: 'media/b.png', data: Buffer.from('PNGDATA'), store: true }]);
  E = await boot({}); await E.w.vtImportFile(E.asFile(z)); await sleep(20);
  const S = E.saves(), by = (a) => S.find((x) => x.abbr === a);
  ok(S.length === 4, 'luu 4 muc (5 muc co noi dung - CH trung "ch" trong cung lan nhap bi bo): ' + S.map((x) => x.abbr).join(','));
  ok(by('gb') && by('gb').images.length === 2 && JSON.stringify(by('gb').options) === '["Giá nhẫn"]' && by('gb').nhom === 'Túi tiền-Cổ' && by('gb').scope === 'me', 'muc gb: 2 anh, chi giu chu, dung nhom + scope me');
  ok(E.up.length === 2, 'anh dung chung (a.jpg o 2 muc) chi tai len 1 lan: ' + E.up.length + ' lan');
  ok(by('chỉ_ảnh') && by('chỉ_ảnh').options[0] === '[Ảnh] chỉ_ảnh' && by('chỉ_ảnh').images.length === 1, 'muc chi co anh -> them 1 dong chu giu cho (server bat buoc co chu)');
  ok(by('thieu') && by('thieu').images.length === 0, 'anh thieu trong zip -> van nhap phan chu');
  ok(/Đã nhập 4\/4 mục, 3 ảnh/.test(E.msg()) && /bỏ 2 ghi âm/.test(E.msg()) && /1 ảnh thiếu/.test(E.msg()), 'thong bao ket qua: ' + E.msg());
  ok(E.up[0].mimeType === 'image/jpeg' && E.up.some((u) => u.mimeType === 'image/png'), 'mime theo duoi file');

  // 3) json tran: khong co hinh; bo muc trung voi muc co san; admin chon Chung
  E = await boot({ admin: true, have: [{ abbr: 'CH', scope: 'team' }, { abbr: 'gb', scope: 'me' }] });
  await E.w.vtImportFile(E.asFile(Buffer.from(JSON.stringify(DATA)))); await sleep(20);
  ok(E.saves().length === 3 && !E.saves().some((x) => x.abbr === 'ch') && E.saves().every((x) => x.scope === 'team' && x.images.length === 0), 'json tran + admin->Chung: bo "ch" (da co), khong anh: ' + E.saves().map((x) => x.abbr));
  ok(E.saves().some((x) => x.abbr === 'gb'), '"gb" co san la muc RIENG, nhap vao Chung khong coi la trung');
  ok(/file \.json không có hình/.test(E.msg()), 'bao khong co hinh khi chon .json');

  // 4) loi tung muc khong chan cac muc khac; file rac
  E = await boot({ saveErr: (s) => s.abbr === 'gb' }); await E.w.vtImportFile(E.asFile(zip([{ name: 'data.json', data: Buffer.from(JSON.stringify(DATA)) }]))); await sleep(20);
  ok(E.saves().length === 3 && /Đã nhập 2\/3/.test(E.msg()) && /LỖI 1: gb/.test(E.msg()), '1 muc loi -> bao rieng, cac muc con lai van luu: ' + E.msg());
  E = await boot(); await E.w.vtImportFile(E.asFile(Buffer.from('khong phai json'))); ok(/❌/.test(E.msg()) && E.saves().length === 0, 'file rac -> bao loi, khong gui gi');
  E = await boot(); await E.w.vtImportFile(E.asFile(Buffer.concat([Buffer.from('PK'), Buffer.alloc(30)]))); ok(/❌/.test(E.msg()), 'zip hong -> bao loi');
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-IMPORT TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
