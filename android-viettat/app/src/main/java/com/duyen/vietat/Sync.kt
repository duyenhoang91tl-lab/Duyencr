package com.duyen.vietat

import android.content.Context
import android.util.Base64
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
    private val busy = AtomicBoolean(false)
    fun prefs(c: Context) = c.getSharedPreferences("crm", 0)
    fun url(c: Context) = prefs(c).getString("url", "").orEmpty().trim().ifEmpty { DEFAULT_URL }
    fun name(c: Context) = prefs(c).getString("name", "").orEmpty().trim()
    const val DEFAULT_WEB = "https://duyen-crm-web.duyenhoang91-tl.workers.dev"
    fun webUrl(c: Context) = prefs(c).getString("web", "").orEmpty().trim().ifEmpty { DEFAULT_WEB }
    // Địa chỉ web CRM + địa chỉ dữ liệu đều có mặc định sẵn → luôn sẵn sàng; Tên CS tự lấy từ tài khoản đang đăng nhập trong tab CRM (CrmWeb.detectName), chưa có thì chỉ lấy mục CHUNG của team.
    fun configured(c: Context) = url(c).isNotEmpty()

    /** Tải 1 ảnh CRM (Drive) về thư mục media dưới tên crm_<id>.<đuôi>; đã có thì dùng lại, không tải lại. Trả về tên file hoặc null nếu lỗi. */
    private fun fetchImage(base: String, c: Context, id: String): String? {
        Store.mediaDir.listFiles()?.firstOrNull { it.name.startsWith("crm_$id.") && it.length() > 0 }?.let { return it.name }
        return try {
            val full = base + (if (base.contains('?')) "&" else "?") + "action=vietTatImage&id=" + URLEncoder.encode(id, "UTF-8") + "&by=" + URLEncoder.encode(name(c), "UTF-8")
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
    fun pull(c: Context): String {
        if (!busy.compareAndSet(false, true)) return ""
        return try {
            val base = url(c)
            val full = base + (if (base.contains('?')) "&" else "?") + "action=vietTat&by=" + URLEncoder.encode(name(c), "UTF-8")
            val con = URL(full).openConnection() as HttpURLConnection
            con.requestMethod = "GET"; con.connectTimeout = 15000; con.readTimeout = 60000; con.instanceFollowRedirects = true
            val code = con.responseCode
            val body = (if (code < 400) con.inputStream else con.errorStream)?.use { String(it.readBytes()) }.orEmpty()
            con.disconnect()
            if (code != 200) return "Lỗi CRM ($code) — máy chủ CRM (Apps Script) đang lỗi hoặc quá tải, thử lại sau ít phút"
            // Apps Script lỗi thường trả TRANG HTML thay vì JSON → trước đây hiện thông báo khó hiểu "Value <!DOCTYPE… cannot be converted to JSONObject"
            if (body.trimStart().startsWith("<")) return "Máy chủ CRM trả trang lỗi thay vì dữ liệu (mã $code) — Apps Script đang lỗi hoặc chưa triển khai xong. Thử lại sau vài phút."
            val r = JSONObject(body)
            if (r.has("error")) return "CRM báo lỗi: " + r.optString("error")
            val arr = r.getJSONArray("snippets")
            var teamN = 0; var mineN = 0
            for (i in 0 until arr.length()) { if (arr.getJSONObject(i).optString("scope") == "me") mineN++ else teamN++ }
            val ids = LinkedHashSet<String>()
            for (i in 0 until arr.length()) arr.getJSONObject(i).optJSONArray("images")?.let { ia ->
                for (k in 0 until ia.length()) ia.optJSONObject(k)?.optString("id")?.takeIf { it.isNotEmpty() }?.let { ids += it }
            }
            val files = HashMap<String, String>(); var failed = 0
            for (id in ids) { val f = fetchImage(base, c, id); if (f != null) files[id] = f else failed++ }
            val n = Store.replaceCrm(arr, files)
            // Báo rõ chung/riêng: nếu đã lưu mục RIÊNG trên CRM mà riêng = 0 thì Tên CS trong app chưa khớp tên tài khoản CRM (mục riêng chỉ gửi cho đúng chủ).
            "Đã cập nhật từ CRM ($n mục: chung $teamN, riêng $mineN" + (if (ids.isNotEmpty()) ", ${files.size} hình" else "") + (if (failed > 0) ", $failed hình lỗi" else "") + ")" +
                (if (n == 0) " ⚠ CRM chưa có mục viết tắt nào cho bạn (tạo ở CRM → Zalo AI → ⌨️ Viết tắt)" else "") +
                (if (n > 0 && mineN == 0) " ⚠ Chưa thấy mục RIÊNG của \"${name(c)}\": nếu bạn đã lưu mục riêng trên CRM thì Tên CS (☁ CRM) chưa giống tên tài khoản CRM" else "")
        } catch (e: Exception) {
            "Lỗi cập nhật CRM: ${e.message}"
        } finally { busy.set(false) }
    }
}
