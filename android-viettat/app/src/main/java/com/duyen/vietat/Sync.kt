package com.duyen.vietat

import android.content.Context
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.atomic.AtomicBoolean

object Sync {
    private val busy = AtomicBoolean(false)

    fun configured(c: Context) = c.getSharedPreferences("sync", 0).let {
        it.getString("url", "").orEmpty().startsWith("http") && it.getString("key", "").orEmpty().length >= 16
    }

    private fun call(c: Context, method: String, path: String, body: ByteArray? = null, type: String = "application/json"): Pair<Int, ByteArray> {
        val p = c.getSharedPreferences("sync", 0)
        val con = URL(p.getString("url", "")!!.trim().trimEnd('/') + path).openConnection() as HttpURLConnection
        con.requestMethod = method; con.connectTimeout = 15000; con.readTimeout = 60000
        con.setRequestProperty("Authorization", "Bearer " + p.getString("key", ""))
        if (body != null) {
            con.doOutput = true; con.setRequestProperty("Content-Type", type); con.setFixedLengthStreamingMode(body.size)
            con.outputStream.use { it.write(body) }
        }
        val code = con.responseCode
        val data = (if (code < 400) con.inputStream else con.errorStream)?.use { it.readBytes() } ?: ByteArray(0)
        con.disconnect()
        return code to data
    }

    /** Chạy trên luồng nền. Trả về thông báo trạng thái. */
    fun run(c: Context): String {
        if (!busy.compareAndSet(false, true)) return ""
        return try {
            val p = c.getSharedPreferences("sync", 0)
            val start = System.currentTimeMillis()
            val out = Store.changesSince(p.getLong("pushed", 0))
            val req = JSONObject().put("since", p.getLong("since", 0)).put("changes", out)
            val (code, bytes) = call(c, "POST", "/api/sync", req.toString().toByteArray())
            if (code == 401) return "Mã đồng bộ không hợp lệ (cần ≥ 16 ký tự)"
            if (code != 200) return "Lỗi server ($code)"
            val r = JSONObject(String(bytes))
            val got = Store.applyRemote(r.getJSONArray("changes"))

            val (mc, mb) = call(c, "GET", "/api/media")
            if (mc == 200) {
                val remote = JSONArray(String(mb)).let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
                // Chỉ đồng bộ ảnh của mục TỰ TẠO trên máy; ảnh lấy từ CRM (crm_…) tải từ CRM, không đẩy lên server đồng bộ riêng
                val need = Store.snippets.filter { !Store.isCrm(it.id) }.flatMap { it.options }.filter { kindOf(it) != null }.map { mediaNameOf(it) }.toSet()
                for (n in need) {
                    val f = File(Store.mediaDir, n)
                    if (f.exists() && n !in remote) call(c, "PUT", "/api/media/$n", f.readBytes(), "application/octet-stream")
                    else if (!f.exists() && n in remote) call(c, "GET", "/api/media/$n").let { (k, b) -> if (k == 200) f.writeBytes(b) }
                }
            }
            p.edit().putLong("since", r.getLong("now") - 2000).putLong("pushed", start).apply()
            "Đã đồng bộ (↑${out.length()} ↓$got)"
        } catch (e: Exception) {
            "Lỗi đồng bộ: ${e.message}"
        } finally { busy.set(false) }
    }
}

/** ĐỌC kho "Viết tắt" của CRM (sheet VietTat qua Google Apps Script): mục CHUNG của team + mục RIÊNG của chính mình (theo tên CS). Chỉ đọc — sửa trên CRM. */
object Crm {
    const val DEFAULT_URL = "https://script.google.com/macros/s/AKfycbx3QT6YIzQ7SQEwQPkljVeEdmTSBQQSxtTp2hTFYOeCKB_K4BHcUTSLi54LlmB9q_E6sQ/exec"
    const val DEFAULT_WEB = "https://duyen-crm-web.duyenhoang91-tl.workers.dev"
    private val busy = AtomicBoolean(false)
    fun prefs(c: Context) = c.getSharedPreferences("crm", 0)

    /** Trạng thái hiện trên tab Viết tắt (Compose theo dõi được): kết quả lần cập nhật gần nhất + tài khoản CRM đang kết nối. */
    var lastStatus by mutableStateOf("")
    var who by mutableStateOf("")

    // KẾT NỐI TỰ ĐỘNG (2026-10-26): không còn nhập tên CS / địa chỉ web. Web CRM luôn là DEFAULT_WEB; địa chỉ dữ liệu lấy thẳng từ CRM đang chạy trong app
    // (biến gsUrl của web) — chưa đọc được thì dùng DEFAULT_URL; tên + quyền lấy từ PHIÊN ĐĂNG NHẬP CRM (token) nên mục "của tôi" khớp đúng chủ sở hữu.
    fun webUrl(c: Context) = DEFAULT_WEB
    fun url(c: Context) = prefs(c).getString("gs", "").orEmpty().trim().let { if (it.startsWith("https://script.google.com/")) it else DEFAULT_URL }
    fun name(c: Context) = prefs(c).getString("name", "").orEmpty().trim()
    /** Token phiên CRM còn hạn (rỗng nếu chưa đăng nhập / hết hạn — web CRM tự yêu cầu đăng nhập lại). */
    fun token(c: Context): String {
        val p = prefs(c); val t = p.getString("token", "").orEmpty().trim(); val x = p.getLong("tokenExp", 0L)
        return if (t.isNotEmpty() && (x <= 0L || x > System.currentTimeMillis())) t else ""
    }
    /** Đã kết nối = có phiên CRM còn hạn (hoặc, bản cũ, đã lưu tên CS). */
    fun configured(c: Context) = token(c).isNotEmpty() || name(c).isNotEmpty()

    /** Lưu danh tính đọc được từ web CRM. Trả về true nếu có thay đổi (đăng nhập lần đầu, đổi tài khoản, đổi token). */
    fun setIdentity(c: Context, token: String, exp: Long, name: String, gs: String): Boolean {
        val p = prefs(c)
        val changed = p.getString("token", "") != token || p.getString("name", "") != name.trim()
        if (changed || p.getLong("tokenExp", 0L) != exp || p.getString("gs", "") != gs.trim()) {
            p.edit().putString("token", token).putLong("tokenExp", exp).putString("name", name.trim()).putString("gs", gs.trim()).apply()
        }
        if (name.trim().isNotEmpty()) who = name.trim()
        return changed
    }

    /** Phần định danh gắn vào địa chỉ gọi CRM: ưu tiên token phiên (CRM tự biết bạn là ai), không có thì dùng tên đã lưu từ bản cũ. */
    private fun authQuery(c: Context): String {
        val t = token(c)
        return if (t.isNotEmpty()) "&token=" + URLEncoder.encode(t, "UTF-8") else "&by=" + URLEncoder.encode(name(c), "UTF-8")
    }

    /** Tải 1 ảnh CRM (Drive) về thư mục media dưới tên crm_<id>.<đuôi>; đã có thì dùng lại, không tải lại. Trả về tên file hoặc null nếu lỗi. */
    private fun fetchImage(base: String, c: Context, id: String): String? {
        Store.mediaDir.listFiles()?.firstOrNull { it.name.startsWith("crm_$id.") && it.length() > 0 }?.let { return it.name }
        return try {
            val full = base + (if (base.contains('?')) "&" else "?") + "action=vietTatImage&id=" + URLEncoder.encode(id, "UTF-8") + authQuery(c)
            val con = URL(full).openConnection() as HttpURLConnection
            con.requestMethod = "GET"; con.connectTimeout = 15000; con.readTimeout = 60000; con.instanceFollowRedirects = true
            val code = con.responseCode
            val body = (if (code < 400) con.inputStream else con.errorStream)?.use { String(it.readBytes()) }.orEmpty()
            con.disconnect()
            if (code != 200) return null
            val j = JSONObject(body)
            if (!j.optBoolean("ok")) return null
            val ext = when (j.optString("mimeType")) { "image/png" -> "png"; "image/webp" -> "webp"; "image/gif" -> "gif"; else -> "jpg" }
            val fname = "crm_$id.$ext"
            File(Store.mediaDir, fname).writeBytes(Base64.decode(j.getString("base64"), Base64.DEFAULT))
            fname
        } catch (e: Exception) { null }
    }

    /** Chạy trên luồng nền. Trả về thông báo trạng thái ("" nếu đang chạy dở). */
    fun pull(c: Context): String = pullImpl(c).also { if (it.isNotEmpty()) lastStatus = it }

    private fun pullImpl(c: Context): String {
        if (!busy.compareAndSet(false, true)) return ""
        return try {
            val base = url(c)
            val full = base + (if (base.contains('?')) "&" else "?") + "action=vietTat" + authQuery(c)
            val con = URL(full).openConnection() as HttpURLConnection
            con.requestMethod = "GET"; con.connectTimeout = 15000; con.readTimeout = 60000; con.instanceFollowRedirects = true
            val code = con.responseCode
            val body = (if (code < 400) con.inputStream else con.errorStream)?.use { String(it.readBytes()) }.orEmpty()
            con.disconnect()
            if (code != 200) return "Lỗi CRM ($code)"
            val r = JSONObject(body)
            if (r.has("error")) return "CRM báo lỗi: " + r.optString("error")
            if (r.optString("me").isNotEmpty()) who = r.optString("me")
            val arr = r.getJSONArray("snippets")
            val ids = LinkedHashSet<String>()
            for (i in 0 until arr.length()) arr.getJSONObject(i).optJSONArray("images")?.let { ia ->
                for (k in 0 until ia.length()) ia.optJSONObject(k)?.optString("id")?.takeIf { it.isNotEmpty() }?.let { ids += it }
            }
            val files = HashMap<String, String>(); var failed = 0
            for (id in ids) { val f = fetchImage(base, c, id); if (f != null) files[id] = f else failed++ }
            val n = Store.replaceCrm(arr, files)
            "Đã cập nhật từ CRM ($n mục" + (if (ids.isNotEmpty()) ", ${files.size} hình" else "") + (if (failed > 0) ", $failed hình lỗi" else "") + ")"
        } catch (e: Exception) {
            "Lỗi cập nhật CRM: ${e.message}"
        } finally { busy.set(false) }
    }
}
