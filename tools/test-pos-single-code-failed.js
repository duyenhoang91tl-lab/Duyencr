// Duyen 2026-11-10 (chot 3): don Pos CHI 1 ma ma don goc Base That bai/Huy => loai khoi Bao cao B (vd 110T11). Chot 1: don "LEN LAI/DOI/BH" van tinh. Kiem nguon + logic that.
const fs=require('fs');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync(__dirname+'/../gas_v13.js','utf8');
ok(/singleCodesByRow\[pi\] = cds/.test(src),'luu ma cua don < nguong ghep');
ok(/singleCodesByRow\[pj\] && baseIdx/.test(src),'tra Base cho don 1 ma khi khong ghep');
const m=/singleCodesByRow\[pj\] && baseIdx && !(\/.*?\/)\.test\(_stripVN_/.exec(src);
ok(!!m,'co guard ghi chu lên lại/đổi/BH');
const re=eval(m[1]);
const strip=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d');
ok(!re.test(strip('110T11/2026\nSHIP QUA RỒI LẤY LẠI VÒNG KIM NHƯ Ý')),'110T11 (ghi chu thuong) => khong bi guard, se bi loai');
ok(re.test(strip('1192T10 (ĐỔI)')),'ghi chu ĐỔI => guard giu lai');
ok(re.test(strip('NG119T10 (LÊN LẠI ĐƠN HOÀN)')),'LÊN LẠI ĐƠN HOÀN => guard giu lai');
ok(re.test(strip('BH395T09 bảo hành')),'bảo hành => guard giu lai');
process.exit(bad?1:0);
