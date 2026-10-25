package com.duyen.vietat

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File

/**
 * Màn chọn nội dung khi bấm viết tắt (Duyên yêu cầu 2026-10-25):
 *  - danh sách CUỘN, hiện hết mọi lựa chọn (chữ + hình), chọn NHIỀU cái 1 lúc;
 *  - hình hiện bằng chính hình (không còn chữ "Hình ảnh"), thẻ to dễ nhìn;
 *  - bấm 1 lần = chọn / bỏ chọn; bấm ĐÚP vào hình = phóng to xem full, bấm đúp lần nữa = thu nhỏ lại;
 *  - nút cuối: Đóng · Chia sẻ · Chèn (n).
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

    private val selected = LinkedHashSet<Int>()
    private val cards = HashMap<Int, View>()
    private val marks = HashMap<Int, TextView>()
    private val zoomed = HashSet<Int>()
    private val imgViews = HashMap<Int, ImageView>()
    private val thumbs = HashMap<Int, Bitmap?>()
    private val bigs = HashMap<Int, Bitmap?>()
    private lateinit var title: TextView
    private lateinit var btnInsert: TextView
    private lateinit var btnShare: TextView

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

    private fun button(label: String, fill: Int, textColor: Int, weight: Float) = TextView(ctx).apply {
        text = label; textSize = 15f; setTextColor(textColor); gravity = Gravity.CENTER
        background = box(fill, fill, 1, 12)
        setPadding(dp(8), dp(12), dp(8), dp(12))
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, weight).apply { leftMargin = dp(4); rightMargin = dp(4) }
    }

    private fun refresh() {
        val n = selected.size
        title.text = (if (name != null) "Khách: ${Store.given(name)}  ·  " else "") +
            (if (n == 0) "Bấm để chọn (chọn được nhiều)" else "Đã chọn $n")
        btnInsert.text = if (n == 0) "Chèn" else "Chèn ($n)"
        btnShare.text = if (n == 0) "Chia sẻ" else "Chia sẻ ($n)"
        btnInsert.alpha = if (n == 0) 0.45f else 1f
        btnShare.alpha = if (n == 0) 0.45f else 1f
        for ((i, v) in cards) {
            val on = i in selected
            v.background = box(if (on) 0xFFE8F0FE.toInt() else Color.WHITE, if (on) 0xFF1E66F5.toInt() else 0xFFD0D0D0.toInt(), if (on) 3 else 1, 12)
            marks[i]?.apply {
                text = if (on) "✓" else ""
                background = box(if (on) 0xFF1E66F5.toInt() else 0x66FFFFFF.toInt(), if (on) 0xFF1E66F5.toInt() else 0xFF9E9E9E.toInt(), 2, 14)
            }
        }
    }

    private fun toggle(i: Int) { if (!selected.add(i)) selected.remove(i); refresh() }

    /** Phóng/thu hình ở thẻ i: phóng = hiện NGUYÊN hình (vừa khung, nền đen) cao gần hết màn chọn; thu = ô thu nhỏ cắt giữa. */
    private fun toggleZoom(i: Int) {
        val iv = imgViews[i] ?: return
        if (zoomed.remove(i)) {
            iv.scaleType = ImageView.ScaleType.CENTER_CROP
            iv.layoutParams = iv.layoutParams.apply { height = dp(170) }
            iv.setImageBitmap(thumbs[i])
        } else {
            zoomed += i
            val big = bigs.getOrPut(i) { decode(pathOf(options[i]), 1600) } ?: thumbs[i]
            iv.scaleType = ImageView.ScaleType.FIT_CENTER
            iv.layoutParams = iv.layoutParams.apply { height = (heightPx * 0.78f).toInt() }
            iv.setImageBitmap(big)
        }
        iv.requestLayout()
    }

    private fun gestures(v: View, i: Int, canZoom: Boolean) {
        val gd = GestureDetector(ctx, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true
            override fun onSingleTapConfirmed(e: MotionEvent): Boolean { toggle(i); return true }
            override fun onDoubleTap(e: MotionEvent): Boolean { if (canZoom) toggleZoom(i) else toggle(i); return true }
        })
        v.setOnTouchListener { _, ev -> gd.onTouchEvent(ev); true }
    }

    fun build(): View {
        val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            background = box(0xFFF6F7F9.toInt(), 0xFFCCCCCC.toInt(), 1, 16)
            elevation = 10 * d
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, heightPx)
        }
        title = TextView(ctx).apply {
            textSize = 14f; setTextColor(0xFF444444.toInt()); setPadding(dp(16), dp(12), dp(16), dp(6))
        }
        root.addView(title)

        val list = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(10), dp(4), dp(10), dp(10)) }
        options.forEachIndexed { i, opt ->
            val kind = kindOf(opt)
            val card: View
            if (kind == "img") {
                val frame = FrameLayout(ctx)
                val iv = ImageView(ctx).apply {
                    scaleType = ImageView.ScaleType.CENTER_CROP; setBackgroundColor(Color.BLACK)
                    layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(170))
                }
                thumbs[i] = decode(pathOf(opt), 640)
                iv.setImageBitmap(thumbs[i]); imgViews[i] = iv
                frame.addView(iv)
                val mk = TextView(ctx).apply {
                    textSize = 16f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
                    layoutParams = FrameLayout.LayoutParams(dp(30), dp(30), Gravity.TOP or Gravity.END).apply { topMargin = dp(8); rightMargin = dp(8) }
                }
                marks[i] = mk; frame.addView(mk)
                card = frame
            } else {
                val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), dp(14), dp(12), dp(14)) }
                val mk = TextView(ctx).apply {
                    textSize = 16f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(dp(30), dp(30)).apply { rightMargin = dp(12) }
                }
                marks[i] = mk; row.addView(mk)
                row.addView(TextView(ctx).apply {
                    text = if (kind == null) Store.resolve(opt, name) else labelOf(opt)
                    textSize = 16f; setTextColor(0xFF111111.toInt()); maxLines = 8
                })
                card = row
            }
            card.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) }
            cards[i] = card
            gestures(card, i, canZoom = kind == "img")
            list.addView(card)
        }
        root.addView(ScrollView(ctx).apply {
            addView(list)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
        })

        val bar = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(8), dp(6), dp(8), dp(10)) }
        val close = button("✕ Đóng", 0xFFE0E0E0.toInt(), 0xFF333333.toInt(), 0.8f).apply { setOnClickListener { onClose() } }
        btnShare = button("Chia sẻ", 0xFF5F6B7A.toInt(), Color.WHITE, 1f).apply {
            setOnClickListener { if (selected.isNotEmpty()) onShare(selectedOptions()) }
        }
        btnInsert = button("Chèn", 0xFF1E66F5.toInt(), Color.WHITE, 1.2f).apply {
            setOnClickListener { if (selected.isNotEmpty()) onInsert(selectedOptions()) }
        }
        bar.addView(close); bar.addView(btnShare); bar.addView(btnInsert)
        root.addView(bar)
        refresh()
        return root
    }
}
