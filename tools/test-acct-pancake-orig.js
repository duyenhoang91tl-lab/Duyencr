#!/usr/bin/env node
// Tên gốc = tên trên Pancake khi tạo/sửa tài khoản (js/15 _pkOrigNameOf_, _acctPancakeFirst_). Chạy: node tools/test-acct-pancake-orig.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','15-fn-hidelogin.js'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1);}return '';}
let fail=0;const t=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++;};
const mk=nameMap=>{const ctx={};vm.createContext(ctx);vm.runInContext('var _pkState='+JSON.stringify({nameMap})+';\n'+fn('_pkOrigNameOf_')+'\n'+fn('_acctPancakeFirst_'),ctx);return ctx;};
let c=mk({'Yến NTH':'yenNTH2004','Lê Ninh':'ninhnga99','Chung':'yennth|ninhnga99'});
t(c._pkOrigNameOf_(['yennth','yenNTH2004'])==='Yến NTH','tên Pancake gắn vào 1 trong các tên của người → là tên gốc');
t(c._pkOrigNameOf_(['yennth'])==='', 'tên Pancake chia cho NGƯỜI KHÁC (Chung = yennth|ninhnga99) không lấy làm gốc khi chỉ có yennth');
t(c._pkOrigNameOf_(['yennth','ninhnga99'])==='Chung'||c._pkOrigNameOf_(['yennth','ninhnga99'])==='Lê Ninh','tên Pancake mà MỌI sale của nó đều thuộc người này thì lấy được');
t(c._acctPancakeFirst_(['yennth','yenNTH2004']).join()==='Yến NTH,yennth,yenNTH2004','tên Pancake lên đầu, các tên khác giữ nguyên thứ tự');
t(c._acctPancakeFirst_(['yenNTH2004','Yến NTH','yennth']).join()==='Yến NTH,yenNTH2004,yennth','đã có tên Pancake trong danh sách → chuyển lên đầu, không nhân đôi');
t(c._acctPancakeFirst_(['abc','def']).join()==='abc,def','không khớp tên Pancake nào → giữ nguyên');
t(mk({})._acctPancakeFirst_(['a','b']).join()==='a,b','chưa tải Khớp tên Pancake → giữ nguyên, không lỗi');
const c2={};vm.createContext(c2);vm.runInContext(fn('_pkOrigNameOf_')+fn('_acctPancakeFirst_'),c2);
t(c2._acctPancakeFirst_(['a','b']).join()==='a,b','thiếu _pkState (js/16 chưa nạp) → không lỗi');
const c3=mk({'Ninh':'ninhnga99','ninh':'ninhnga99'});
t(c3._pkOrigNameOf_(['ninhnga99'])==='Ninh'||c3._pkOrigNameOf_(['ninhnga99'])==='ninh','nhiều tên Pancake cùng khớp → chọn 1 tên ổn định');
t(c._pkOrigNameOf_(['Yến NTH'])==='Yến NTH','tên đã là tên Pancake → chính nó');
console.log(fail?'\n'+fail+' LỖI':'\nTẤT CẢ ĐẠT');process.exit(fail?1:0);
