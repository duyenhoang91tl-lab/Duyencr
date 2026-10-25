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

    override fun onServiceConnected() { Store.init(this) }

    private var lastText = ""

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        if (e.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
            e.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED) return
        if (e.packageName == packageName) { hide(); return }
        val n = e.source ?: rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return
        if (n.isPassword || n.isShowingHintText) { hide(); return }
        var text = n.text?.toString().orEmpty()
        if (text.isEmpty() && e.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) text = e.text.joinToString("")
        if (text.isEmpty() || text.last().isWhitespace()) { hide(); return }
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
        if (hits.isEmpty()) { hide(); return }
        if (popup != null && text == lastText) return
        lastText = text
        val name = typed ?: if (hits.any { s -> s.options.any { it.contains("{tên") } }) findName() else null
        show(n, text, span, hits, name)
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

    private fun show(n: AccessibilityNodeInfo, text: String, word: String, hits: List<Snippet>, name: String?) {
        hide()
        val d = resources.displayMetrics.density
        fun dp(v: Int) = (v * d).toInt()
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply { setColor(0xFFFFFFFF.toInt()); cornerRadius = 16 * d; setStroke(dp(1), 0xFFCCCCCC.toInt()) }
            elevation = 8 * d
        }
        box.addView(TextView(this).apply {
            this.text = (if (name != null) "Khách: ${Store.given(name)}  ·  " else "") + "Chọn nội dung  ·  ✕"; textSize = 12f; setTextColor(0xFF888888.toInt())
            setPadding(dp(16), dp(8), dp(16), dp(4)); setOnClickListener { hide() }
        })
        hits.flatMap { it.options }.take(8).forEach { opt ->
            val kind = kindOf(opt)
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(16), dp(10), dp(16), dp(10))
            }
            if (kind == "img") {
                val bmp = runCatching {
                    BitmapFactory.decodeFile(File(Store.mediaDir, mediaNameOf(opt)).absolutePath,
                        BitmapFactory.Options().apply { inSampleSize = 8 })
                }.getOrNull()
                row.addView(ImageView(this).apply {
                    setImageBitmap(bmp); scaleType = ImageView.ScaleType.CENTER_CROP
                    layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).apply { rightMargin = dp(12) }
                })
            }
            row.addView(TextView(this).apply {
                this.text = if (kind == null) Store.resolve(opt, name) else labelOf(opt); maxLines = 2; ellipsize = TextUtils.TruncateAt.END
                textSize = 15f; setTextColor(0xFF111111.toInt())
            })
            row.setOnClickListener {
                if (kind == null) insertText(n, text, word, opt, name) else sendMedia(n, text, word, opt, share = kind == "aud")
                hide()
            }
            if (kind != null) row.setOnLongClickListener { sendMedia(n, text, word, opt, share = true); hide(); true }
            box.addView(row)
        }
        val r = Rect().also { n.getBoundsInScreen(it) }
        val lp = WindowManager.LayoutParams(
            (resources.displayMetrics.widthPixels * 0.92).toInt(), WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = (resources.displayMetrics.heightPixels - r.top + dp(8)).coerceAtLeast(dp(80))
        }
        wm.addView(box, lp); popup = box
    }

    private fun setText(n: AccessibilityNodeInfo, t: String) =
        n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, t)
        })

    private fun insertText(n: AccessibilityNodeInfo, text: String, word: String, opt: String, name: String?) {
        val filled = Store.resolve(opt, name)
        val newText = text.dropLast(word.length) + filled
        val m = Regex("\\{[^}]+\\}").find(filled)
        val base = text.length - word.length
        val st = if (m != null) base + m.range.first else newText.length
        val en = if (m != null) base + m.range.last + 1 else newText.length
        setText(n, newText)
        n.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, st)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, en)
        })
    }

    /** share=false: sao chép + dán vào ô chat. share=true: mở bảng chia sẻ của Android. */
    private fun sendMedia(n: AccessibilityNodeInfo, text: String, word: String, opt: String, share: Boolean) {
        val f = File(Store.mediaDir, mediaNameOf(opt))
        if (!f.exists()) { Toast.makeText(this, "Không tìm thấy file", Toast.LENGTH_SHORT).show(); return }
        val uri = FileProvider.getUriForFile(this, "$packageName.files", f)
        val isImg = kindOf(opt) == "img"
        setText(n, text.dropLast(word.length))
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager)
            .setPrimaryClip(ClipData.newUri(contentResolver, "viettat", uri))
        if (share) {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = if (isImg) "image/*" else "audio/*"
                putExtra(Intent.EXTRA_STREAM, uri); clipData = ClipData.newRawUri("", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(send, "Gửi qua").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } else {
            n.performAction(AccessibilityNodeInfo.ACTION_PASTE)
            Toast.makeText(this, "Đã dán. Nếu chưa thấy, nhấn giữ ô chat > Dán", Toast.LENGTH_LONG).show()
        }
    }

    private fun hide() { popup?.let { runCatching { wm.removeView(it) } }; popup = null; lastText = "" }
    override fun onInterrupt() = hide()
    override fun onDestroy() { hide(); super.onDestroy() }
}
