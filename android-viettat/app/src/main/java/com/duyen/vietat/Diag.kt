package com.duyen.vietat

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Nhật ký CHẨN ĐOÁN gõ tắt (trong bộ nhớ, cùng tiến trình với Dịch vụ Trợ năng). Màn "Viết tắt" → 🩺 Kiểm tra gõ tắt hiện nội dung này để biết
 * gõ tắt hỏng ở bước nào: dịch vụ chưa chạy / chưa có mục nào / Android không gửi sự kiện / không khớp mục / chèn chữ thất bại.
 */
object Diag {
    @Volatile var connectedAt = 0L
    @Volatile var events = 0
    @Volatile var lastEventAt = 0L
    @Volatile var lastPkg = ""
    @Volatile var lastTail = ""
    @Volatile var lastWhy = ""
    @Volatile var lastInsert = ""

    private fun t(ms: Long): String = if (ms <= 0L) "chưa có" else SimpleDateFormat("HH:mm:ss", Locale("vi", "VN")).format(Date(ms))

    fun note(pkg: String, tail: String, why: String) {
        lastEventAt = System.currentTimeMillis(); lastPkg = pkg; lastTail = tail.takeLast(40); lastWhy = why
    }

    /**
     * GÕ THỬ ngay trong app (không cần mở Zalo/Messenger): mô phỏng ĐÚNG cách ExpanderService khớp mục từ chữ đang gõ
     * (kiểu "viết tắt + tên" trước, rồi từ cuối cùng) và nói rõ khớp mục nào hoặc vì sao không khớp. Không chèn gì, chỉ trả lời.
     */
    fun trial(text: String): String {
        if (text.isBlank()) return "Gõ thử một viết tắt (vd: ch) để xem app khớp mục nào."
        if (text.last().isWhitespace()) return "Chữ cuối là khoảng trắng → dịch vụ sẽ BỎ QUA. Gõ viết tắt xong KHÔNG bấm cách."
        if (Store.snippets.isEmpty()) return "Trên máy chưa có mục viết tắt nào → bấm ☁ CRM để tải về (cần đúng Tên CS)."
        val toks = Regex("\\S+").findAll(text).toList()
        var span = ""; var typed: String? = null; var hits: List<Snippet> = emptyList()
        for (k in 1..2) {   // kiểu "viết tắt + tên", ví dụ: ch Thanh Huyền (chỉ với nội dung có {tên})
            if (toks.size <= k) break
            val a = toks[toks.size - 1 - k]
            val h = Store.snippets.filter { it.abbr.equals(a.value, true) && it.options.any { o -> o.contains("{tên") } }
            if (h.isNotEmpty()) { hits = h; span = text.substring(a.range.first); typed = toks.takeLast(k).joinToString(" ") { it.value }; break }
        }
        if (hits.isEmpty()) { span = toks.last().value; hits = Store.match(span) }
        if (hits.isEmpty()) return "❌ KHÔNG khớp mục nào với \"$span\" (máy có ${Store.snippets.size} mục). Kiểm tra: viết tắt đã tạo/đã tải về chưa, gõ đúng chữ chưa."
        val names = hits.joinToString(", ") { it.abbr + if (Store.isCrm(it.id)) " (CRM)" else "" }
        return "✅ Khớp ${hits.size} mục với \"$span\": $names" + (typed?.let { " · tên khách: $it" } ?: "") + " → ngoài app chat sẽ hiện màn chọn."
    }

    fun report(): String {
        val total = Store.snippets.size
        val crm = Store.snippets.count { Store.isCrm(it.id) }
        val sb = StringBuilder()
        sb.append(if (connectedAt > 0L) "✅ Dịch vụ Trợ năng đang chạy (kết nối lúc ${t(connectedAt)})"
                  else "❌ Dịch vụ Trợ năng CHƯA chạy → vào Cài đặt > Trợ năng > \"Viết Tắt\": bật (nếu đang bật thì TẮT rồi BẬT lại; Xiaomi: bật Tự khởi động + Pin \"Không hạn chế\" cho Duyên CRM)")
        sb.append("\n")
        sb.append(if (total == 0) "❌ Trên máy chưa có mục viết tắt nào → bấm ☁ CRM để tải về (cần đúng Tên CS)"
                  else "✅ Mục viết tắt trên máy: $total (từ CRM $crm, tự tạo ${total - crm})")
        sb.append("\n")
        sb.append(if (events == 0) "❌ Android CHƯA gửi sự kiện gõ nào cho app → mở Zalo/Messenger/Pancake (KHÔNG phải app này), gõ vài chữ, rồi bấm Làm mới"
                  else "Sự kiện gõ đã nhận: $events (gần nhất ${t(lastEventAt)}, app: ${lastPkg.ifEmpty { "?" }})")
        if (lastWhy.isNotEmpty()) sb.append("\nLần gõ gần nhất: \"$lastTail\" → $lastWhy")
        if (lastInsert.isNotEmpty()) sb.append("\nLần chèn gần nhất: $lastInsert")
        return sb.toString()
    }
}
