// Test hien thi anh/ghi am (dau hieu [[ml:...]]) trong chat noi bo: node tools/test-mlib-chat.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../js/43-teamchat.js','utf8');
const a=src.indexOf('var ML_RE'), b=src.indexOf('function mentionsMe');
const ctx={S:{me:{username:'a'}},esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
vm.createContext(ctx); vm.runInContext(src.slice(a,b)+';this.fmt=fmtText;',ctx);
const id='ABCDEFGHIJKLM';
let h=ctx.fmt('xin chao [[ml:image|https://drive.google.com/uc?export=view&id='+id+'|Anh dep]] ok');
assert(/<img class="tc-img"[^>]+thumbnail\?id=ABCDEFGHIJKLM/.test(h)&&/xin chao/.test(h)&&/ok/.test(h));
h=ctx.fmt('[[ml:audio|https://drive.google.com/uc?export=download&id='+id+'|Ghi am]]'); assert(/<audio controls/.test(h));
h=ctx.fmt('[[ml:image|https://evil.com/x.png|a]]'); assert(!/<img/.test(h),'URL la khong duoc ve anh');
h=ctx.fmt('[[ml:image|https://drive.google.com/uc?export=view&id='+id+'"onerror="x|a]]'); assert(!/onerror="x/.test(h)||!/<img[^>]*onerror/.test(h));
assert.strictEqual(ctx.fmt('thuong https://a.com'),'thuong <a href="https://a.com" target="_blank" rel="noopener noreferrer">https://a.com</a>');
console.log('OK test-mlib-chat');
