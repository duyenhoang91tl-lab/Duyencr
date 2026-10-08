
var _openTipId = 'tier-tooltip';
function openTierTooltip(e, id) {
  e.stopPropagation();
  closeTierTooltip();
  _openTipId = id || 'tier-tooltip';
  var tt = document.getElementById(_openTipId);
  if (!tt) return;

  // Ẩn trước để đo kích thước thực
  tt.style.visibility = 'hidden';
  tt.style.display = 'block';
  tt.style.maxHeight = '';
  tt.style.overflowY = '';

  var ttH = tt.offsetHeight;
  var ttW = tt.offsetWidth || 310;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var cx = e.clientX;
  var cy = e.clientY;
  var gap = 10;

  // Tính left: ưu tiên bên phải con trỏ, clamp vào viewport
  var left = cx;
  if (left + ttW + gap > vw) left = vw - ttW - gap;
  if (left < gap) left = gap;

  // Tính top: ưu tiên bên dưới con trỏ; nếu không đủ chỗ thì lên trên
  var spaceBelow = vh - cy - gap;
  var spaceAbove = cy - gap;
  var top;
  if (spaceBelow >= ttH || spaceBelow >= spaceAbove) {
    // Mở xuống dưới, giới hạn chiều cao nếu cần
    top = cy + gap;
    var maxH = vh - top - gap;
    if (ttH > maxH) {
      tt.style.maxHeight = maxH + 'px';
      tt.style.overflowY = 'auto';
    }
  } else {
    // Mở lên trên
    var maxH = spaceAbove;
    if (ttH > maxH) {
      tt.style.maxHeight = maxH + 'px';
      tt.style.overflowY = 'auto';
    }
    top = cy - Math.min(ttH, maxH) - gap;
    if (top < gap) top = gap;
  }

  tt.style.left = left + 'px';
  tt.style.top  = top + 'px';
  tt.style.visibility = 'visible';

  // Đóng khi click ra ngoài
  setTimeout(function() {
    document.addEventListener('click', _closeTierOnOutside, { once: true });
  }, 0);
}
function closeTierTooltip() {
  ['tier-tooltip','hang-tooltip'].forEach(function(id){
    var t = document.getElementById(id);
    if (t) { t.style.display = 'none'; t.style.visibility = ''; }
  });
  document.removeEventListener('click', _closeTierOnOutside);
}
function _closeTierOnOutside(e) {
  var tt = document.getElementById(_openTipId);
  if (tt && !tt.contains(e.target)) { tt.style.display = 'none'; tt.style.visibility = ''; }
}
