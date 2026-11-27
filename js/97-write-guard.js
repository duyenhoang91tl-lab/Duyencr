// ════════════════════════════════════════════════════════════════════
//  BÁO LỖI KHI GHI DỮ LIỆU LÊN MÁY CHỦ (26/11/2026, "chuyên nghiệp hóa" bước 4)
//  NGUYÊN NHÂN GỐC: nhiều chỗ ghi nền (CS chăm sóc đơn, đội/Team, xoá công việc, chia data) gọi fetch POST rồi `.catch(function(){})` / `catch(e){}` RỖNG ⇒ mất mạng hoặc
//  máy chủ trả {ok:false,error} thì người dùng vẫn tưởng đã lưu, tới lúc dữ liệu "tự mất" mới biết. Các hàm dưới đây báo rõ, không làm hỏng luồng cũ:
//    _writeFail_(what, why)  hiện cảnh báo (hộp thoại js/96 nếu có, không thì toast) — cùng 1 việc chỉ báo 1 lần / 20 giây để không dồn dập khi mất mạng.
//    _writeCheck_(what)      trả hàm dùng trong .then(...) hoặc gọi trực tiếp với Response: đọc BẢN SAO json, báo nếu ok:false / có error; luôn trả lại Response nguyên vẹn.
//    _writeCatch_(what)      dùng thay .catch(function(){}) — báo lỗi mạng.
//  KHÔNG dùng cho các lần ghi nhật ký (saveAudit) vì mất 1 dòng nhật ký không đáng làm phiền người dùng.
// ════════════════════════════════════════════════════════════════════
var _writeFailLast_ = {};
function _writeFail_(what, why){
  var key = String(what || ''), now = Date.now();
  try { console.warn('[ghi dữ liệu thất bại]', what, why || ''); } catch(e){}
  if (_writeFailLast_[key] && now - _writeFailLast_[key] < 20000) return;
  _writeFailLast_[key] = now;
  var msg = '⚠ Chưa lưu được ' + (what || 'dữ liệu') + ' lên máy chủ' + (why ? ' (' + String(why).slice(0, 160) + ')' : '') + '.\nKiểm tra mạng rồi thử lại — thay đổi này có thể chưa được ghi.';
  try { if (typeof uiAlert === 'function') uiAlert(msg); else if (typeof toast === 'function') toast(msg.split('\n')[0]); } catch(e){}
}
function _writeCheck_(what){
  return function(r){
    try {
      if (r && r.ok === false) _writeFail_(what, 'HTTP ' + r.status);
      else if (r && typeof r.clone === 'function') r.clone().json().then(function(d){ if (d && (d.ok === false || d.error)) _writeFail_(what, d.error || d.message || 'máy chủ từ chối'); }).catch(function(){});
    } catch(e){}
    return r;
  };
}
function _writeCatch_(what){ return function(e){ _writeFail_(what, e && e.message); }; }
