// Test tiêu đề cột "Tỷ lệ chốt theo Sale — từng Page": hiện cả Tổng Page và PKD. Chạy: node tools/test-page-pkd-header.js
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/../js/11-fn-srload.js','utf8');
const grab=n=>{const a=src.indexOf('function '+n+'(');let d=0,i=src.indexOf('{',a);for(let k=i;k<src.length;k++){if(src[k]=='{')d++;if(src[k]=='}'&&--d==0)return src.slice(a,k+1);}};
const ctx={esc:x=>x,_srState:{dateTo:'2026-11-20'},SALE_CHANNELS:{a:'online',b:'offline'},_saleChannelOn_:(n)=>ctx.SALE_CHANNELS[n]||''};
vm.createContext(ctx);
vm.runInContext(['_srKdInScope_','_srKdScopeRows_','_srPageTotals_','_srPageThHtml_'].map(grab).join('\n'),ctx);
const mk=(n,h,c)=>({name:n,perPage:{K:{held:h,closed:c}},total:{held:h,closed:c}});
const scbp={pages:[{pageName:'P1',kenhBan:'K'}],rows:[mk('a',100,10),mk('b',100,20),mk('Public API',800,1)]};
let ok=true;const t=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
let h=ctx._srPageThHtml_(scbp);
t(/Tổng[^]*3\.1%[^]*\(31\/1000\)/.test(h),'tong Page 31/1000 = 3.1%: '+h);
t(/PKD[^]*15%[^]*\(30\/200\)/.test(h),'PKD 30/200 = 15%');
ctx.SALE_CHANNELS={}; h=ctx._srPageThHtml_(scbp);
t(!/PKD/.test(h),'chua phan loai -> khong hien PKD');
ctx.SALE_CHANNELS={a:'online',b:'offline','Public API':'online'}; h=ctx._srPageThHtml_(scbp);
t(!/PKD/.test(h),'moi nguoi deu KD -> khong lap them dong');
console.log(ok?'OK':'FAILED');process.exit(ok?0:1);
