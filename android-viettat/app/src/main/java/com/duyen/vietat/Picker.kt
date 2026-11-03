package com.duyen.vietat

import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File

/**
 * Bảng chọn nội dung GỌN kiểu bảng chọn ảnh của Android/Google Photos (Duyên yêu cầu 2026-10-27):
 *  - chữ: thẻ gọn (tối đa 3 dòng); hình + ghi âm: LƯỚI 3 cột ô vuông nhỏ, dấu tích tròn ở góc trên trái;
 *  - chạm = chọn / bỏ chọn, chọn NHIỀU chữ + nhiều hình cùng lúc; NHẤN GIỮ một hình = xem to (chạm để đóng);
 *  - thanh nổi phía dưới: ✕ đóng · "Đã chọn n" · Chia sẻ · Chèn;
 *  - cao tối đa ~50% màn hình (do ExpanderService quyết định qua [heightPx]); tự đổi sáng/tối theo hệ thống.
 * Chỉ dựng giao diện; việc chèn/gửi do [onInsert]/[onShare] (ExpanderService) làm, nhận các lựa chọn đã chọn theo đúng thứ tự trong danh sách.
 */
class Picker(
    private val ctx: Context,
    private val options: List<String>,
    private val name: String?,
    private val heightPx: Int,
    private val onInsert: (List<String>) -> Unit,
    private val onShare: (List<String>) -> Unit,
    private val onClose: () -> Unit,
) {
    private val d = ctx.resources.displayMetrics.density
    private fun dp(v: Int) = (v * d).toInt()
    private val MP = ViewGroup.LayoutParams.MATCH_PARENT
    private val WC = ViewGroup.LayoutParams.WRAP_CONTENT

    private val dark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private val cBg = if (dark) 0xFF1F1F21.toInt() else 0xFFF8F7F5.toInt()
    private val cCard = if (dark) 0xFF2A2A2D.toInt() else Color.WHITE
    private val cLine = if (dark) 0xFF3C3C40.toInt() else 0xFFDDDDDD.toInt()
    private val cText = if (dark) 0xFFEEEEEE.toInt() else 0xFF111111.toInt()
    private val cSub = if (dark) 0xFFAAAAAA.toInt() else 0xFF666666.toInt()
    private val cAccent = if (dark) 0xFF6FA0FF.toInt() else 0xFF1E66F5.toInt()
    private val cBar = if (dark) 0xFF38383B.toInt() else 0xFFECEAF0.toInt()
    private val cTint = if (dark) 0xFF2B3A55.toInt() else 0xFFDCE8FE.toInt()

    private val selected = LinkedHashSet<Int>()
    private val frames = HashMap<Int, View>()
    private val marks = HashMap<Int, TextView>()
    private val tiles = HashSet<Int>()
    private lateinit var title: TextView
    private lateinit var count: TextView
    private lateinit var btnInsert: TextView
    private lateinit var btnShare: TextView
    private lateinit var preview: ImageView

    fun selectedOptions(): List<String> = selected.sorted().map { options[it] }

    private fun decode(path: String, target: Int): Bitmap? = runCatching {
        val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, b)
        var s = 1
        while (b.outWidth / (s * 2) >= target && b.outHeight / (s * 2) >= target) s *= 2
        BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = s })
    }.getOrNull()

    private fun pathOf(opt: String) = File(Store.mediaDir, mediaNameOf(opt)).absolutePath

    private fun box(fill: Int, stroke: Int, strokeDp: Int, radiusDp: Int) = GradientDrawable().apply {
        setColor(fill); cornerRadius = radiusDp * d; setStroke(dp(strokeDp), stroke)
    }

    private fun round(v: View, radiusDp: Int) {
        v.clipToOutline = true
        v.outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, radiusDp * d)
            }
        }
    }

    private fun styleMark(mk: TextView, on: Boolean) {
        mk.text = if (on) "✓" else ""
        mk.background = if (on) box(cAccent, Color.WHITE, 2, 12) else box(0x33000000, Color.WHITE, 2, 12)
    }

    private fun refresh() {
        val n = selected.size
        title.text = if (name != null) "Khách: ${Store.given(name)}  ·  chạm để chọn nhiều mục" else "Chạm để chọn nhiều mục"
        count.text = if (n == 0) "Chưa chọn" else "Đã chọn $n"
        count.setTextColor(if (n == 0) cSub else cText)
        btnShare.alpha = if (n == 0) 0.4f else 1f
        btnInsert.alpha = if (n == 0) 0.4f else 1f
        for ((i, v) in frames) {
            val on = i in selected
            if (i in tiles) {
                val p = if (on) dp(6) else 0
                v.setPadding(p, p, p, p)
                v.setBackgroundColor(if (on) cTint else cCard)
            } else {
                v.background = box(if (on) cTint else cCard, if (on) cAccent else cLine, if (on) 2 else 1, 12)
            }
            marks[i]?.let { styleMark(it, on) }
        }
    }

    private fun toggle(i: Int) { if (!selected.add(i)) selected.remove(i); refresh() }

    private fun showPreview(opt: String) {
        preview.setImageBitmap(decode(pathOf(opt), 1600))
        preview.visibility = View.VISIBLE
    }

    private fun textCard(i: Int, opt: String): View {
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        val mk = TextView(ctx).apply {
            textSize = 14f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp(24), dp(24)).apply { rightMargin = dp(10) }
        }
        marks[i] = mk; row.addView(mk)
        row.addView(TextView(ctx).apply {
            text = Store.resolve(opt, name); textSize = 15f; setTextColor(cText)
            maxLines = 3; ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, WC, 1f)
        })
        row.layoutParams = LinearLayout.LayoutParams(MP, WC).apply { topMargin = dp(6) }
        row.setOnClickListener { toggle(i) }
        frames[i] = row
        return row
    }

    private fun tile(i: Int, opt: String, cell: Int, col: Int): View {
        val f = FrameLayout(ctx)
        if (kindOf(opt) == "img") {
            val iv = ImageView(ctx).apply { scaleType = ImageView.ScaleType.CENTER_CROP; setImageBitmap(decode(pathOf(opt), 320)) }
            f.addView(iv, FrameLayout.LayoutParams(MP, MP))
            f.setOnLongClickListener { showPreview(opt); true }
        } else {
            f.addView(TextView(ctx).apply {
                text = "🎤\nGhi âm"; textSize = 13f; setTextColor(cSub); gravity = Gravity.CENTER
            }, FrameLayout.LayoutParams(MP, MP))
        }
        val mk = TextView(ctx).apply { textSize = 14f; setTextColor(Color.WHITE); gravity = Gravity.CENTER }
        f.addView(mk, FrameLayout.LayoutParams(dp(24), dp(24), Gravity.TOP or Gravity.START).apply { topMargin = dp(6); leftMargin = dp(6) })
        marks[i] = mk; frames[i] = f; tiles += i
        round(f, 8)
        f.setOnClickListener { toggle(i) }
        f.layoutParams = LinearLayout.LayoutParams(cell, cell).apply { rightMargin = if (col < 2) dp(4) else 0; topMargin = dp(4) }
        return f
    }

    fun build(): View {
        val root = FrameLayout(ctx).apply { background = box(cBg, cBg, 0, 20); elevation = 12 * d }
        round(root, 20)

        val col = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        col.addView(View(ctx).apply { background = box(0x55888888, 0x55888888, 0, 2) },
            LinearLayout.LayoutParams(dp(36), dp(4)).apply { gravity = Gravity.CENTER_HORIZONTAL; topMargin = dp(8) })
        title = TextView(ctx).apply {
            textSize = 13f; setTextColor(cSub); setPadding(dp(16), dp(8), dp(16), dp(4))
        }
        col.addView(title)

        val list = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(10), dp(2), dp(10), dp(84)) }
        options.indices.filter { kindOf(options[it]) == null }.forEach { list.addView(textCard(it, options[it])) }
        val cell = (ctx.resources.displayMetrics.widthPixels - dp(20) - dp(8)) / 3
        options.indices.filter { kindOf(options[it]) != null }.chunked(3).forEach { idx ->
            val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
            idx.forEachIndexed { c, i -> row.addView(tile(i, options[i], cell, c)) }
            list.addView(row)
        }
        col.addView(ScrollView(ctx).apply { addView(list) }, LinearLayout.LayoutParams(MP, 0, 1f))
        root.addView(col, FrameLayout.LayoutParams(MP, MP))

        val bar = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = box(cBar, cBar, 0, 28); elevation = 6 * d
            setPadding(dp(6), dp(6), dp(8), dp(6))
        }
        bar.addView(TextView(ctx).apply {
            text = "✕"; textSize = 20f; setTextColor(cText); gravity = Gravity.CENTER
            setOnClickListener { onClose() }
        }, LinearLayout.LayoutParams(dp(44), dp(44)))
        count = TextView(ctx).apply { textSize = 16f; typeface = Typeface.DEFAULT_BOLD }
        bar.addView(count, LinearLayout.LayoutParams(0, WC, 1f).apply { leftMargin = dp(6) })
        btnShare = TextView(ctx).apply {
            text = "Chia sẻ"; textSize = 15f; setTextColor(cAccent); typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setOnClickListener { if (selected.isNotEmpty()) onShare(selectedOptions()) }
        }
        bar.addView(btnShare)
        btnInsert = TextView(ctx).apply {
            text = "Chèn"; textSize = 15f; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
            background = box(cAccent, cAccent, 0, 22)
            setPadding(dp(22), dp(10), dp(22), dp(10))
            setOnClickListener { if (selected.isNotEmpty()) onInsert(selectedOptions()) }
        }
        bar.addView(btnInsert)
        root.addView(bar, FrameLayout.LayoutParams(MP, WC, Gravity.BOTTOM).apply { setMargins(dp(10), 0, dp(10), dp(10)) })

        preview = ImageView(ctx).apply {
            visibility = View.GONE; setBackgroundColor(0xEE000000.toInt()); scaleType = ImageView.ScaleType.FIT_CENTER
            setOnClickListener { visibility = View.GONE }
        }
        root.addView(preview, FrameLayout.LayoutParams(MP, MP))

        refresh()
        return root
    }
}
