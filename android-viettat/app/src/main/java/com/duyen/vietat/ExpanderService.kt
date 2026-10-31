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
import android.os.Build
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
        // Nhiều hình (+ ghi âm) mà KHÔNG bấm "Chia sẻ" → đưa vào Thư viện máy rồi mở BỘ CHỌN ẢNH của app chat (Zalo…): chọn nhiều ảnh như gửi thường, gửi thẳng vào khung chat đang mở.
        if (!share && Build.VERSION.SDK_INT >= 29 && media.any { kindOf(it) == "img" } && media.size > 1) { sendViaChatGallery(media); return }
        val uris = media.mapNotNull { m ->
            File(Store.mediaDir, mediaNameOf(m)).takeIf { it.exists() }?.let { FileProvider.getUriForFile(this, "$packageName.files", it) }
        }
        if (uris.isEmpty()) { Toast.makeText(this, "Không tìm thấy file", Toast.LENGTH_SHORT).show(); return }
        val allImg = media.all { kindOf(it) == "img" }
        // Đúng 1 hình + "Chèn" → dán thẳng vào ô chat. Ghi âm/tệp lẫn vào, hoặc bấm "Chia sẻ" → bảng chia sẻ Android.
        if (allImg && !share && uris.size == 1) { pasteImages(uris, 0, n); return }
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newUri(contentResolver, "viettat", uris[0]))
        shareChooser(uris, allImg, media.all { kindOf(it) == "aud" })
    }

    /**
     * NGUYÊN NHÂN GỐC "dán nhiều ảnh vẫn không được" (Duyên 2026-10-31): Android/Zalo chỉ nhận dán 1 hình qua clipboard, và ACTION_PASTE nối tiếp không đưa nhiều hình
     * vào khung chat; bảng chia sẻ chung thì bắt chọn lại người nhận. Cách làm: lưu các hình (đúng thứ tự, hình 1 mới nhất → nằm đầu danh sách) vào album "VietTat" của Thư viện,
     * ghi âm vào Tải xuống/VietTat, rồi BẤM HỘ nút ảnh của app chat → hiện bộ chọn nhiều ảnh quen thuộc của chính Zalo (tick, "Gửi (n)") và gửi vào đúng cuộc trò chuyện đang mở.
     */
    private fun sendViaChatGallery(media: List<String>) {
        Thread {
            val imgs = media.filter { kindOf(it) == "img" }.map { File(Store.mediaDir, mediaNameOf(it)) }.filter { it.exists() }
            val auds = media.filter { kindOf(it) == "aud" }.map { File(Store.mediaDir, mediaNameOf(it)) }.filter { it.exists() }
            val okImg = saveMedia(imgs, true); val okAud = saveMedia(auds, false)
            ui.post {
                if (okImg == 0) { Toast.makeText(this, "Không lưu được hình vào Thư viện", Toast.LENGTH_LONG).show(); return@post }
                ui.postDelayed({
                    val clicked = clickChatGalleryButton()
                    val msg = (if (clicked) "Chọn $okImg hình đầu danh sách (album VietTat) rồi bấm Gửi" else "Bấm nút ẢNH của app chat, chọn $okImg hình đầu danh sách (album VietTat)") +
                        (if (okAud > 0) ".\nGhi âm ($okAud): Tải xuống/VietTat — gửi bằng nút Tệp." else "")
                    Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                }, 500)
            }
        }.start()
    }

    /** Lưu file vào MediaStore (không cần quyền từ Android 10). Hình k có ngày chụp = now − k giây → hình 1 mới nhất = đầu danh sách, tick từ trái sang phải đúng thứ tự. */
    private fun saveMedia(files: List<File>, image: Boolean): Int {
        var ok = 0
        val nowMs = System.currentTimeMillis()
        files.forEachIndexed { k, f ->
            try {
                val ext = f.extension.lowercase()
                val mime = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: if (image) "image/jpeg" else "audio/mp4"
                val v = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, "vt_${nowMs}_${k}.${ext.ifEmpty { if (image) "jpg" else "m4a" }}")
                    put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, if (image) "Pictures/VietTat" else "Download/VietTat")
                    if (image) {
                        put(android.provider.MediaStore.Images.Media.DATE_TAKEN, nowMs - k * 1000L)
                        put(android.provider.MediaStore.MediaColumns.DATE_ADDED, (nowMs / 1000) - k)
                    }
                }
                val base = if (image) android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI else android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI
                val u = contentResolver.insert(base, v) ?: return@forEachIndexed
                contentResolver.openOutputStream(u)?.use { o -> f.inputStream().use { it.copyTo(o) } }
                ok++
            } catch (ex: Exception) { Diag.lastInsert = "lưu Thư viện lỗi: ${ex.javaClass.simpleName} ${ex.message.orEmpty()}" }
        }
        return ok
    }

    /** Bấm hộ nút "ảnh" của app chat: tìm nút ở dải dưới màn hình có mô tả/chữ chứa ảnh|hình|photo|gallery|image… (rightmost). Ghi các nút thấy được vào Diag để chỉnh lại nếu app đổi nhãn. */
    private fun clickChatGalleryButton(): Boolean {
        val root = rootInActiveWindow ?: run { Diag.lastInsert = "mở bộ chọn ảnh: không đọc được màn hình"; return false }
        val h = resources.displayMetrics.heightPixels
        val re = Regex("ảnh|hình|photo|gallery|image|picture|media|thư viện|album", RegexOption.IGNORE_CASE)
        val seen = ArrayList<String>(); var best: AccessibilityNodeInfo? = null; var bestLeft = -1
        fun walk(n: AccessibilityNodeInfo?, d: Int) {
            if (n == null || d > 30) return
            val r = Rect().also { n.getBoundsInScreen(it) }
            val str = listOfNotNull(n.contentDescription?.toString(), n.text?.toString(), n.viewIdResourceName).joinToString("|")
            if (r.top > h * 0.75 && !n.isEditable && r.width() > 0) {
                if (str.isNotEmpty() && seen.size < 14) seen += "${str.take(30)}@${r.left}"
                if (str.isNotEmpty() && re.containsMatchIn(str) && r.left > bestLeft) { best = n; bestLeft = r.left }
            }
            for (i in 0 until n.childCount) walk(n.getChild(i), d + 1)
        }
        walk(root, 0)
        var t: AccessibilityNodeInfo? = best
        while (t != null && !t.isClickable) t = t.parent
        val ok = t?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
        Diag.lastInsert = "mở bộ chọn ảnh: " + (if (ok) "đã bấm nút ảnh" else "KHÔNG thấy nút ảnh") + " · nút ở dải dưới: " + seen.joinToString(" ; ")
        return ok
    }

    private val ui = android.os.Handler(android.os.Looper.getMainLooper())

    /**
     * NGUYÊN NHÂN GỐC "chọn nhiều hình mà không vào khung chat" (Duyên 2026-10-27): Android chỉ dán được MỘT hình mỗi lần, nên code cũ với ≥2 hình
     * mở bảng chia sẻ chung (sang Zalo lại phải chọn người nhận). Nay dán TUẦN TỰ: đặt hình i vào clipboard → ACTION_PASTE ở ô gõ đang lấy nét → chờ
     * app chat nhận xong (1,6 giây) → hình kế tiếp. Hình đầu bị từ chối → dự phòng bảng chia sẻ; hình sau bị từ chối → báo còn bao nhiêu hình chưa dán.
     */
    private fun pasteImages(uris: List<android.net.Uri>, i: Int, first: AccessibilityNodeInfo) {
        if (i >= uris.size) { Toast.makeText(this, "Đã dán ${uris.size} hình", Toast.LENGTH_SHORT).show(); return }
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newUri(contentResolver, "viettat", uris[i]))
        val node = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: first.also { it.refresh() }
        val ok = node.performAction(AccessibilityNodeInfo.ACTION_PASTE)
        Diag.lastInsert = "dán hình ${i + 1}/${uris.size}: " + if (ok) "app nhận" else "app TỪ CHỐI dán"
        if (!ok) {
            if (i == 0) { Toast.makeText(this, "App chat không cho dán hình → mở bảng chia sẻ", Toast.LENGTH_LONG).show(); shareChooser(uris, true, false) }
            else Toast.makeText(this, "Đã dán $i hình, còn ${uris.size - i} hình app chat không nhận → bấm Chia sẻ để gửi nốt", Toast.LENGTH_LONG).show()
            return
        }
        ui.postDelayed({ pasteImages(uris, i + 1, node) }, 1600)
    }

    private fun shareChooser(uris: List<android.net.Uri>, allImg: Boolean, allAud: Boolean) {
        val send = Intent(if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
            type = if (allImg) "image/*" else if (allAud) "audio/*" else "*/*"
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
