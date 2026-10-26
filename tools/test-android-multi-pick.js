// Test (tĩnh) chống tái phát: app Android (WebView) PHẢI bật chọn NHIỀU ảnh khi <input type=file multiple>.
// NGUYÊN NHÂN GỐC từng gặp: FileChooserParams.createIntent() KHÔNG tự đặt EXTRA_ALLOW_MULTIPLE → bộ chọn ảnh chỉ cho chọn 1 ảnh.
// (Không biên dịch được Kotlin ở đây — build thật do GitHub Actions "Build Android VietTat"/"check-android" kiểm tra.)
const fs=require('fs');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const kt=fs.readFileSync('android-viettat/app/src/main/java/com/duyen/vietat/CrmWeb.kt','utf8');
const i=kt.indexOf('override fun onShowFileChooser');ok(i>0,'có onShowFileChooser');
let d=0,j=kt.indexOf('{',i),e=j;for(let k=j;k<kt.length;k++){if(kt[k]=='{')d++;else if(kt[k]=='}'){d--;if(!d){e=k;break}}}
const body=kt.slice(i,e+1);
const iCreate=body.indexOf('p.createIntent()'),iMode=body.indexOf('MODE_OPEN_MULTIPLE'),iExtra=body.indexOf('Intent.EXTRA_ALLOW_MULTIPLE'),iLaunch=body.indexOf('launchChooser?.invoke(');
ok(iCreate>0&&iMode>iCreate&&iExtra>iMode&&iLaunch>iExtra,'onShowFileChooser: createIntent() → nếu MODE_OPEN_MULTIPLE thì putExtra(EXTRA_ALLOW_MULTIPLE, true) → rồi mới mở bộ chọn (đúng thứ tự)');
ok(/p\.mode\s*==\s*WebChromeClient\.FileChooserParams\.MODE_OPEN_MULTIPLE/.test(body)&&/putExtra\(Intent\.EXTRA_ALLOW_MULTIPLE,\s*true\)/.test(body),'điều kiện đúng: chỉ bật chọn nhiều khi ô web có "multiple" (ô 1 file vẫn chọn 1)');
ok(!/launchChooser\?\.invoke\(p\.createIntent\(\)\)/.test(kt),'KHÔNG còn mở bộ chọn bằng createIntent() trần (nguyên nhân lỗi cũ)');
ok(/FileChooserParams\.parseResult\(code, data\)/.test(kt),'kết quả đọc bằng parseResult (đọc được cả ClipData nhiều ảnh)');
ok(/^import android\.content\.Intent$/m.test(kt)&&/^import android\.webkit\.WebChromeClient$/m.test(kt),'đủ import Intent + WebChromeClient');
const g=fs.readFileSync('android-viettat/app/build.gradle.kts','utf8'),m=/versionCode = (\d+); versionName = "([^"]+)"/.exec(g);
ok(m&&+m[1]>=9,'versionCode ≥ 9 (cao hơn bản 1.7/8 để cài đè được): '+(m&&m[0]));
// phía web: các ô chọn ảnh phải có multiple
const idx=fs.readFileSync('index.html','utf8');
for(const id of ['vt-f-files','task-f-img-input','task-cm-img-input','bc-compose-imgs']){const t=new RegExp('<input[^>]*id="'+id+'"[^>]*>').exec(idx);ok(t&&/\bmultiple\b/.test(t[0]),'web: ô #'+id+' có thuộc tính multiple');}
const vt=fs.readFileSync('js/57-viettat.js','utf8');ok(/function vtUploadFiles\(list\)\s*\{\s*return _vtUploadFiles\(Array\.prototype\.slice\.call\(list/.test(vt),'web: vtUploadFiles COPY danh sách file trước khi ô bị reset (this.value="")');
process.exit(bad?1:0);
