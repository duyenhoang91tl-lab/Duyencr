// Test (tĩnh) chống tái phát: app Android (WebView) PHẢI cho chọn NHIỀU ảnh khi <input type=file multiple>.
// Lịch sử: (1) bản ≤1.7 mở bộ chọn bằng FileChooserParams.createIntent() trần — hàm này KHÔNG đặt EXTRA_ALLOW_MULTIPLE nên chỉ chọn được 1 ảnh;
// (2) bản 1.9 thay bằng bảng "Máy ảnh / Ảnh / Tệp / Ghi âm" (showAttachMenu) và Photo Picker của Android 13+ (ACTION_PICK_IMAGES) cho "Ảnh".
// Test kiểm tra MÃ NGUỒN (không biên dịch được Kotlin ở sandbox) — build thật do GitHub Actions "Build Android VietTat"/"check-android" kiểm tra.
const fs=require('fs');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const kt=fs.readFileSync('android-viettat/app/src/main/java/com/duyen/vietat/CrmWeb.kt','utf8');
function body(name){const i=kt.search(new RegExp('fun '+name+'\\('));if(i<0)return null;let d=0,j=kt.indexOf('{',i),e=j;for(let k=j;k<kt.length;k++){if(kt[k]=='{')d++;else if(kt[k]=='}'){d--;if(!d){e=k;break}}}return kt.slice(i,e+1)}
const photos=body('pickPhotos'),menu=body('showAttachMenu'),files=body('pickFiles'),audio=body('pickAudioFiles'),uris=body('pickedUris'),chooser=(()=>{const i=kt.indexOf('override fun onShowFileChooser');if(i<0)return null;let d=0,j=kt.indexOf('{',i),e=j;for(let k=j;k<kt.length;k++){if(kt[k]=='{')d++;else if(kt[k]=='}'){d--;if(!d){e=k;break}}}return kt.slice(i,e+1)})();
ok(!!photos&&!!menu&&!!files&&!!audio&&!!uris&&!!chooser,'có đủ các hàm: onShowFileChooser, showAttachMenu, pickPhotos, pickFiles, pickAudioFiles, pickedUris');
// Photo Picker Android 13+
ok(/Build\.VERSION\.SDK_INT\s*>=\s*33/.test(photos)&&/Intent\(MediaStore\.ACTION_PICK_IMAGES\)/.test(photos),'Ảnh: dùng Photo Picker hệ thống (MediaStore.ACTION_PICK_IMAGES) chỉ khi Android 13+ (SDK_INT >= 33)');
ok(/if \(multi\) i\.putExtra\(MediaStore\.EXTRA_PICK_IMAGES_MAX,\s*MediaStore\.getPickImagesMaxLimit\(\)\)/.test(photos),'Photo Picker: ô có "multiple" → cho chọn tối đa getPickImagesMaxLimit() ảnh (ô 1 ảnh vẫn chọn 1)');
ok(/setType\("image\/\*"\)/.test(photos)&&/if \(multi\) fallback\.putExtra\(Intent\.EXTRA_ALLOW_MULTIPLE,\s*true\)/.test(photos),'Máy dưới Android 13 / Photo Picker không mở được: dự phòng GET_CONTENT image/* + EXTRA_ALLOW_MULTIPLE');
ok(photos.indexOf('ACTION_PICK_IMAGES')<photos.indexOf('launch(fallback'),'thứ tự: thử Photo Picker trước, rồi mới dự phòng');
// Tệp / ghi âm
ok(/if \(multi\) i\.putExtra\(Intent\.EXTRA_ALLOW_MULTIPLE,\s*true\)/.test(files)&&/if \(multi\) i\.putExtra\(Intent\.EXTRA_ALLOW_MULTIPLE,\s*true\)/.test(audio),'Tệp + file ghi âm: cũng bật EXTRA_ALLOW_MULTIPLE khi ô có "multiple"');
// multi lấy từ ô web
ok(/val multi = p\.mode == WebChromeClient\.FileChooserParams\.MODE_OPEN_MULTIPLE/.test(menu)&&/pickPhotos\(multi\)/.test(menu)&&/pickFiles\(.*,\s*multi\)/.test(menu)&&/pickAudioFiles\(multi\)/.test(menu),'showAttachMenu: multi = MODE_OPEN_MULTIPLE (ô web có multiple) và truyền cho Ảnh / Tệp / Ghi âm');
ok(/showAttachMenu\(p\)/.test(chooser)&&!/launchChooser\?\.invoke\(p\.createIntent\(\)\)/.test(kt),'onShowFileChooser mở bảng chọn; KHÔNG còn mở bằng createIntent() trần (nguyên nhân lỗi cũ)');
// đọc kết quả nhiều ảnh
ok(/clipData/.test(uris)&&/itemCount/.test(uris)&&/cd\.getItemAt\(it\)\.uri/.test(uris)&&/d\.data/.test(uris),'pickedUris: đọc cả ClipData nhiều ảnh (Photo Picker/GET_CONTENT) lẫn Uri đơn');
const g=fs.readFileSync('android-viettat/app/build.gradle.kts','utf8'),m=/versionCode = (\d+); versionName = "([^"]+)"/.exec(g);
ok(m&&+m[1]>=10,'versionCode ≥ 10 (bản có bảng chọn + Photo Picker): '+(m&&m[0]));
// phía web: các ô chọn ảnh phải có multiple
const idx=fs.readFileSync('index.html','utf8');
for(const id of ['vt-f-files','task-f-img-input','task-cm-img-input','bc-compose-imgs']){const t=new RegExp('<input[^>]*id="'+id+'"[^>]*>').exec(idx);ok(t&&/\bmultiple\b/.test(t[0]),'web: ô #'+id+' có thuộc tính multiple');}
const vt=fs.readFileSync('js/57-viettat.js','utf8');ok(/function vtUploadFiles\(list\)\s*\{\s*return _vtUploadFiles\(Array\.prototype\.slice\.call\(list/.test(vt),'web: vtUploadFiles COPY danh sách file trước khi ô bị reset (this.value="")');
process.exit(bad?1:0);
