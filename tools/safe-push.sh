#!/bin/bash
# tools/safe-push.sh — PUSH AN TOÀN: luôn MERGE khi remote có commit mới. KHÔNG force-push / reset / rebase.
# Dùng:  TK=<token của tin nhắn hiện tại> bash tools/safe-push.sh [nhánh=main]
# (Token chỉ nằm trong biến môi trường của lệnh này — không ghi file, không lưu remote URL.)
# Quy tắc đầy đủ: docs/crm-kb/01-rules-and-deploy.md mục "QUY TẮC GIT".
set -u
BR="${1:-main}"
H=()
if [ -n "${TK:-}" ]; then AUTH=$(printf 'x-access-token:%s' "$TK" | base64 -w0); H=(-c "http.extraheader=Authorization: Basic $AUTH"); fi
g() { git ${H[@]+"${H[@]}"} "$@"; }

syntax_check() {   # quy tắc 4: không push code chưa syntax-check (bỏ qua nếu repo không có/không có node)
  command -v node >/dev/null 2>&1 || return 0
  [ -f gas_v13.js ] && { node -c gas_v13.js || return 1; }
  for f in js/*.js; do [ -f "$f" ] && { node -c "$f" || return 1; }; done
  return 0
}

for i in 1 2 3; do
  g fetch origin "$BR" || { echo "fetch lỗi"; exit 1; }
  if ! git merge-base --is-ancestor "origin/$BR" HEAD; then
    echo ">> origin/$BR có commit mới → MERGE (bắt buộc merge, không rebase)"
    if ! git merge --no-edit "origin/$BR"; then
      echo "!! XUNG ĐỘT: mở file có <<<<<<<, GIỮ thay đổi của CẢ HAI bên, git add, git commit, chạy kiểm tra, rồi chạy lại script."
      echo "!! KHÔNG dùng reset --hard / push --force / rebase để 'cho xong'."
      exit 2
    fi
    echo ">> Đã merge. Kiểm tra lại thay đổi của mình còn nguyên trước khi tin kết quả."
  fi
  syntax_check || { echo "!! Syntax lỗi sau merge — sửa rồi chạy lại (chưa push gì)"; exit 4; }
  if g push origin "HEAD:$BR"; then
    g fetch origin "$BR" >/dev/null 2>&1
    if git merge-base --is-ancestor HEAD "origin/$BR"; then echo "✅ ĐÃ LÊN origin/$BR: $(git rev-parse --short HEAD)"; exit 0; fi
    echo "!! Push báo OK nhưng commit KHÔNG nằm trong origin/$BR — có ai ghi đè lịch sử. DỪNG, báo người dùng, KHÔNG force-push."; exit 5
  fi
  echo ">> push bị từ chối (có người push xen vào), thử lại $i/3 bằng merge"
done
exit 3
