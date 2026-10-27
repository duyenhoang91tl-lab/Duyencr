package com.duyen.vietat

import android.accessibilityservice.AccessibilityService
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.PixelFormat
import android.widget.ImageView
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout
import android.widget.TextView

class ExpanderService : AccessibilityService() {
    private var popup: View? = null
    private val wm get() = getSystemService(WINDOW_SERVICE) as WindowManager

    override fun onServiceConnected() { Store.init(this); Diag.connectedAt = System.currentTimeMillis() }

    private var lastText = ""

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        if (e.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
            e.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED) return
        val pkg = e.packageName?.toString().orEmpty()
        Diag.events++
        if (e.packageName == packageName) { Diag.note(pkg, "", "bỏ qua vì đang gõ TRONG app Duyên CRM — hãy gõ ở app chat khác (Zalo/Messenger/Pancake)"); hide(); return }
        val n = e.source ?: rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (n == null) { Diag.note(pkg, "", "KHÔNG lấy được ô gõ (app này chặn Trợ năng đọc ô nhập)"); return }
        if (n.isPassword || n.isShowingHintText) { Diag.note(pkg, "", "bỏ qua: ô mật khẩu hoặc ô đang hiện chữ gợi ý"); hide(); return }
        var text = n.text?.toString().orEmpty()
        if (text.isEmpty() && e.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) text = e.text.joinToString("")
        if (text.isEmpty()) { Diag.note(pkg, "", "ô gõ trống (app không đưa chữ cho Trợ năng đọc?)"); hide(); return }
        if (text.last().isWhitespace()) { Diag.note(pkg, text, "chữ cuối là khoảng trắng — gõ viết tắt xong KHÔNG bấm cách"); hide(); return }
        val toks = Regex("\\S+").findAll(text).toList()
        var span = ""; var typed: String? = null; var hits: List<Snippet> = emptyList()
        // Kiểu "viết tắt + tên", ví dụ: ch Thanh Huyền (chỉ với nội dung có {tên})
        for (k in 1..2) {
            if (toks.size <= k) break
            val a = toks[toks.size - 1 - k]
            val h = Store.snippets.filter { it.abbr.equals(a.value, true) && it.options.any { o -> o.contains("{tên") } }
            if (h.isNotEmpty()) { hits = h; span = text.substring(a.range.first); typed = toks.takeLast(k).joinToString(" ") { it.value }; break }
        }
        if (hits.isEmpty()) { span = toks.last().value; hits = Store.match(span) }
        if (hits.isEmpty()) {
            Diag.note(pkg, text, "không khớp mục nào với \"$span\" (máy có ${Store.snippets.size} mục viết tắt)")
            hide(); return
        }
        if (popup != null && text == lastText) return
        lastText = text
        val name = typed ?: if (hits.any { s -> s.options.any { it.contains("{tên") } }) findName() else null
        Diag.note(pkg, text, "khớp ${hits.size} mục với \"$span\" → hiện màn chọn")
        try { show(n, text, span, hits, name) }
        catch (ex: Exception) { Diag.note(pkg, text, "KHÔNG hiện được màn chọn: ${ex.javaClass.simpleName} ${ex.message.orEmpty()}") }
    }

    /** Lấy tên khách từ màn hình: dòng "Tới: <tên>" (bình luận) hoặc tiêu đề phía trên (tin nhắn). */
    private fun findName(): String? {
        val root = rootInActiveWindow ?: return null
        class T(val s: String, val r: Rect, val desc: Boolean, val click: Boolean)
        val all = ArrayList<T>()
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null || depth > 30 || all.size > 300) return
            val tx = n.text?.toString()?.trim()
            val ds = n.contentDescription?.toString()?.trim()
            val s = if (!tx.isNullOrEmpty()) tx else ds
            if (!s.isNullOrEmpty() && !n.isEditable) all += T(s, Rect().also { n.getBoundsInScreen(it) }, tx.isNullOrEmpty(), n.isClickable)
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        val i = all.indexOfFirst { it.s.trimEnd(':').trim().equals("Tới", true) || it.s.startsWith("Tới:") }
        if (i >= 0) {
            val inline = all[i].s.substringAfter(':', "").trim()
            if (inline.isNotEmpty()) return inline
            return all.getOrNull(i + 1)?.s?.takeIf { it.length in 2..60 }
        }
        val h = resources.displayMetrics.heightPixels * 0.14
        val bad = setOf("tin nhắn mới", "tin nhắn", "bình luận")
        return all.filter { it.r.top >= 0 && it.r.top < h && it.s.lowercase() !in bad && it.s.length in 2..60 && it.s.any { c -> c.isLetter() } }
            .sortedWith(compareBy<T>({ it.desc }, { it.r.top / 40 }, { it.r.left }))
            .firstOrNull { !(it.desc && it.click) }?.s
    }

    /** Màn chọn TO (Picker): cuộn, chọn nhiều chữ + hình, bấm đúp hình để phóng/thu. Không giới hạn số lựa chọn như popup cũ (≤8). */
    private fun show(n: AccessibilityNodeInfo, text: String, word: String, hits: List<Snippet>, name: String?) {
        hide()
        val d = resources.displayMetrics.density
        fun dp(v: Int) = (v * d).toInt()
        val sh = resources.displayMetrics.heightPixels
        val r = Rect().also { n.getBoundsInScreen(it) }
        // Cao hết cỡ phần màn hình nằm TRÊN ô gõ (để không che ô gõ), tối thiểu 260dp, tối đa 80% màn hình
        val heightPx = (r.top - dp(24)).coerceIn(dp(260), (sh * 0.8f).toInt())
        val picker = Picker(this, hits.flatMap { it.options }, name, heightPx,
            onInsert = { sel -> applySelection(n, text, word, sel, name, share = false); hide() },
            onShare = { sel -> applySelection(n, text, word, sel, name, share = true); hide() },
            onClose = { hide() })
        val box = picker.build()
        val lp = WindowManager.LayoutParams(
            (resources.displayMetrics.widthPixels * 0.96).toInt(), heightPx,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = (sh - r.top + dp(8)).coerceAtLeast(dp(80))
        }
        wm.addView(box, lp); popup = box
    }

    private fun setText(n: AccessibilityNodeInfo, t: String): Boolean {
        fun go() = n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, t)
        })
        if (go()) return true
        n.refresh()   // node có thể đã cũ sau khi màn chọn hiện → làm mới rồi thử lại 1 lần
        return go()
    }

    /**
     * NGUYÊN NHÂN GỐC "bấm mà không ra gì" (Duyên 2026-10-27): nhiều app chat (Zalo/Messenger/Pancake…) KHÔNG nhận ACTION_SET_TEXT —
     * performAction trả false nhưng code cũ bỏ qua kết quả nên không chèn gì và không báo gì. Dự phòng: chọn đúng đoạn viết tắt rồi DÁN
     * (clipboard); nếu app cũng không cho dán thì để nội dung trong clipboard + báo để người dùng nhấn giữ > Dán.
     */
    private fun pasteFallback(n: AccessibilityNodeInfo, text: String, word: String, filled: String): Boolean {
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("viettat", filled))
        val base = (text.length - word.length).coerceAtLeast(0)
        n.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, base)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, text.length)
        })
        val ok = n.performAction(AccessibilityNodeInfo.ACTION_PASTE)
        if (!ok) Toast.makeText(this, "Đã sao chép nội dung — nhấn giữ ô chat > Dán", Toast.LENGTH_LONG).show()
        return ok
    }

    /** Thay đoạn viết tắt cuối ô bằng nội dung `filled`; thử SET_TEXT trước, thất bại thì dán. Ghi kết quả vào Diag. */
    private fun replaceTail(n: AccessibilityNodeInfo, text: String, word: String, filled: String): Boolean {
        val full = text.dropLast(word.length) + filled
        if (setText(n, full)) { Diag.lastInsert = "SET_TEXT thành công (${filled.length} ký tự)"; return true }
        val ok = pasteFallback(n, text, word, filled)
        Diag.lastInsert = if (ok) "SET_TEXT bị app từ chối → đã DÁN thành công" else "SET_TEXT và DÁN đều bị app từ chối → nội dung đã nằm trong clipboard (nhấn giữ ô > Dán)"
        return ok
    }

    private fun insertText(n: AccessibilityNodeInfo, text: String, word: String, opt: String, name: String?) {
        val filled = Store.resolve(opt, name)
        val newText = text.dropLast(word.length) + filled
        val m = Regex("\\{[^}]+\\}").find(filled)
        val base = text.length - word.length
        val st = if (m != null) base + m.range.first else newText.length
        val en = if (m != null) base + m.range.last + 1 else newText.length
        if (!replaceTail(n, text, word, filled)) return   // đã dán/sao chép → không đặt vùng chọn theo nội dung cũ
        n.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, st)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, en)
        })
    }

    /**
     * Áp các lựa chọn đã chọn (theo thứ tự trong danh sách). Chữ: 1 lựa chọn chữ → chèn như cũ (con trỏ nhảy vào chỗ {…} còn trống);
     * nhiều chữ → nối bằng xuống dòng. Hình/ghi âm: Android chỉ dán được 1 hình vào ô chat nên 1 hình (nút Chèn) → sao chép + dán;
     * nhiều hình, có ghi âm, hoặc bấm Chia sẻ → mở bảng chia sẻ của Android (ACTION_SEND / ACTION_SEND_MULTIPLE).
     */
    private fun applySelection(n: AccessibilityNodeInfo, text: String, word: String, sel: List<String>, name: String?, share: Boolean) {
        val texts = sel.filter { kindOf(it) == null }
        val media = sel.filter { kindOf(it) != null }
        if (texts.size == 1 && media.isEmpty()) { insertText(n, text, word, texts[0], name); return }
        replaceTail(n, text, word, texts.joinToString("\n") { Store.resolve(it, name) })
        if (media.isEmpty()) return
        val uris = media.mapNotNull { m ->
            File(Store.mediaDir, mediaNameOf(m)).takeIf { it.exists() }?.let { FileProvider.getUriForFile(this, "$packageName.files", it) }
        }
        if (uris.isEmpty()) { Toast.makeText(this, "Không tìm thấy file", Toast.LENGTH_SHORT).show(); return }
        val allImg = media.all { kindOf(it) == "img" }
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newUri(contentResolver, "viettat", uris[0]))
        if (uris.size == 1 && allImg && !share) {
            n.performAction(AccessibilityNodeInfo.ACTION_PASTE)
            Toast.makeText(this, "Đã dán. Nếu chưa thấy, nhấn giữ ô chat > Dán", Toast.LENGTH_LONG).show()
            return
        }
        val send = Intent(if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
            type = if (allImg) "image/*" else if (media.all { kindOf(it) == "aud" }) "audio/*" else "*/*"
            if (uris.size == 1) putExtra(Intent.EXTRA_STREAM, uris[0]) else putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
            clipData = ClipData.newRawUri("", uris[0]).also { cd -> for (k in 1 until uris.size) cd.addItem(ClipData.Item(uris[k])) }
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(send, "Gửi qua").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun hide() { popup?.let { runCatching { wm.removeView(it) } }; popup = null; lastText = "" }
    override fun onInterrupt() = hide()
    override fun onDestroy() { Diag.connectedAt = 0L; hide(); super.onDestroy() }
}
