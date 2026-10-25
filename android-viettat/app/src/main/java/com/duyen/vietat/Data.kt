package com.duyen.vietat

import android.content.Context
import androidx.compose.runtime.mutableStateListOf
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class Folder(val id: String, val name: String, val updatedAt: Long = 0)
data class Snippet(val id: String, val folderId: String, val abbr: String, val keyword: String, val options: List<String>, val updatedAt: Long = 0)

/** Nội dung dạng media được lưu trong chuỗi: [[img:tên_file]] hoặc [[aud:tên_file]] */
fun kindOf(o: String): String? = when {
    o.startsWith("[[img:") && o.endsWith("]]") -> "img"
    o.startsWith("[[aud:") && o.endsWith("]]") -> "aud"
    else -> null
}
fun mediaNameOf(o: String) = o.substring(6, o.length - 2)
fun labelOf(o: String) = when (kindOf(o)) { "img" -> "🖼 Hình ảnh"; "aud" -> "🎤 Ghi âm"; else -> o }

object Store {
    val mediaDir: File get() = File(file!!.parentFile, "media").also { it.mkdirs() }

    val folders = mutableStateListOf<Folder>()
    val snippets = mutableStateListOf<Snippet>()
    private var file: File? = null

    fun init(c: Context) {
        if (file != null) return
        file = File(c.filesDir, "data.json")
        runCatching { parse(file!!.readText(), true) }
        if (folders.isEmpty()) { folders += Folder("default", "Chung", 1); save() }
    }

    private fun parse(text: String, local: Boolean = false): Int {
        val o = JSONObject(text); var n = 0
        o.getJSONArray("folders").let { a ->
            for (i in 0 until a.length()) a.getJSONObject(i).let { j ->
                if (folders.none { it.id == j.getString("id") }) folders += Folder(j.getString("id"), j.getString("name"), j.optLong("updatedAt", 1))
            }
        }
        o.getJSONArray("snippets").let { a ->
            for (i in 0 until a.length()) a.getJSONObject(i).let { j ->
                val oa = j.getJSONArray("options")
                val sn = Snippet(j.getString("id"), j.getString("folderId"), j.getString("abbr"),
                    j.getString("keyword"), (0 until oa.length()).map { oa.getString(it) }, j.optLong("updatedAt", 1))
                val k = snippets.indexOfFirst { it.id == sn.id }
                if (k >= 0) snippets[k] = sn else snippets += sn
                n++
            }
        }
        if (local) o.optJSONArray("tombstones")?.let { a ->
            for (i in 0 until a.length()) a.getJSONObject(i).let { tomb[it.getString("id")] = it.getString("kind") to it.getLong("ts") }
        }
        return n
    }

    fun toJson(): String {
        val o = JSONObject()
        o.put("folders", JSONArray().also { a -> folders.forEach { a.put(JSONObject().put("id", it.id).put("name", it.name).put("updatedAt", it.updatedAt)) } })
        o.put("snippets", JSONArray().also { a ->
            snippets.forEach {
                a.put(JSONObject().put("id", it.id).put("folderId", it.folderId).put("abbr", it.abbr)
                    .put("keyword", it.keyword).put("options", JSONArray(it.options)).put("updatedAt", it.updatedAt))
            }
        })
        o.put("tombstones", JSONArray().also { a -> tomb.forEach { (id, v) -> a.put(JSONObject().put("id", id).put("kind", v.first).put("ts", v.second)) } })
        return o.toString(2)
    }

    /** Nhập từ file JSON, trả về số mục đã nhập (-1 nếu lỗi). */
    fun importJson(text: String): Int = runCatching { parse(text).also { save() } }.getOrDefault(-1)

    val tomb = mutableMapOf<String, Pair<String, Long>>()

    fun deleteSnippet(id: String) {
        snippets.removeAll { it.id == id }; tomb[id] = "snippet" to System.currentTimeMillis(); save()
    }
    fun deleteFolder(id: String) {
        snippets.filter { it.folderId == id }.forEach { deleteSnippet(it.id) }
        folders.removeAll { it.id == id }; tomb[id] = "folder" to System.currentTimeMillis(); save()
    }

    fun isCrm(id: String) = id.startsWith("crm_")

    /** Thay TOÀN BỘ mục lấy từ CRM (id bắt đầu "crm_") bằng danh sách mới; mục tự tạo trên máy giữ nguyên. Trả về số mục.
     *  Thư mục con (2026-10-25): CRM lưu nhóm dạng đường dẫn "Túi tiền/Cổ" → mỗi đường dẫn là 1 thư mục "CRM · Túi tiền › Cổ" (xếp theo tên nên
     *  các thư mục con đứng cạnh thư mục cha); mục "Của tôi" cũng chia theo nhóm. Ảnh kèm (images) của CRM chưa dùng trên Android — chỉ chèn chữ. */
    @Synchronized
    fun replaceCrm(a: JSONArray): Int {
        folders.removeAll { isCrm(it.id) }; snippets.removeAll { isCrm(it.id) }
        var n = 0
        val fresh = mutableListOf<Folder>()
        for (i in 0 until a.length()) {
            val j = a.getJSONObject(i)
            val oa = j.optJSONArray("options") ?: continue
            val abbr = j.optString("abbr").trim(); if (abbr.isEmpty() || oa.length() == 0) continue
            val mine = j.optString("scope") == "me"
            val nhom = j.optString("nhom").trim()
            val label = nhom.split('/').map { it.trim() }.filter { it.isNotEmpty() }.joinToString(" › ")
            val fid = if (mine) (if (nhom.isEmpty()) "crm_me" else "crm_me_" + nhom) else "crm_team_" + nhom
            val fname = if (mine) "CRM · Của tôi" + (if (label.isEmpty()) "" else " · " + label) else "CRM · " + label.ifEmpty { "Chung" }
            if (fresh.none { it.id == fid }) fresh += Folder(fid, fname, 1)
            snippets += Snippet("crm_" + j.optString("id", abbr), fid, abbr, j.optString("keyword"),
                (0 until oa.length()).map { oa.getString(it) }, j.optLong("updatedAt", 1))
            n++
        }
        folders.addAll(fresh.sortedBy { it.name })
        save(); return n
    }

    /** Các thay đổi cục bộ mới hơn mốc t, để đẩy lên server. */
    fun changesSince(t: Long): JSONArray = JSONArray().also { a ->
        folders.filter { it.updatedAt > t && !it.id.startsWith("crm_") }.forEach {
            a.put(JSONObject().put("id", it.id).put("kind", "folder").put("updated", it.updatedAt)
                .put("data", JSONObject().put("id", it.id).put("name", it.name).put("updatedAt", it.updatedAt)))
        }
        snippets.filter { it.updatedAt > t && !it.id.startsWith("crm_") }.forEach { s ->
            a.put(JSONObject().put("id", s.id).put("kind", "snippet").put("updated", s.updatedAt)
                .put("data", JSONObject().put("id", s.id).put("folderId", s.folderId).put("abbr", s.abbr)
                    .put("keyword", s.keyword).put("options", JSONArray(s.options)).put("updatedAt", s.updatedAt)))
        }
        tomb.filter { it.value.second > t }.forEach { (id, v) ->
            a.put(JSONObject().put("id", id).put("kind", v.first).put("updated", v.second).put("deleted", true))
        }
    }

    /** Áp thay đổi từ server (bản mới hơn thì thắng). Trả về số mục đã áp. */
    @Synchronized
    fun applyRemote(a: JSONArray): Int {
        var n = 0
        for (i in 0 until a.length()) {
            val c = a.getJSONObject(i); val id = c.getString("id"); val kind = c.getString("kind"); val up = c.getLong("updated")
            val localUp = (if (kind == "folder") folders.firstOrNull { it.id == id }?.updatedAt
                           else snippets.firstOrNull { it.id == id }?.updatedAt) ?: tomb[id]?.second ?: -1L
            if (up <= localUp) continue
            if (c.optBoolean("deleted")) {
                if (kind == "folder") folders.removeAll { it.id == id } else snippets.removeAll { it.id == id }
                tomb[id] = kind to up
            } else {
                val d = c.getJSONObject("data"); tomb.remove(id)
                if (kind == "folder") {
                    val f = Folder(id, d.getString("name"), up); val k = folders.indexOfFirst { it.id == id }
                    if (k >= 0) folders[k] = f else folders += f
                } else {
                    val oa = d.getJSONArray("options")
                    val sn = Snippet(id, d.getString("folderId"), d.getString("abbr"), d.optString("keyword"),
                        (0 until oa.length()).map { oa.getString(it) }, up)
                    val k = snippets.indexOfFirst { it.id == id }
                    if (k >= 0) snippets[k] = sn else snippets += sn
                }
            }
            n++
        }
        save(); return n
    }

    fun save() { file?.writeText(toJson()); cleanup() }

    private fun cleanup() {
        val used = snippets.flatMap { it.options }.filter { kindOf(it) != null }.map { mediaNameOf(it) }.toSet()
        mediaDir.listFiles()?.forEach { if (it.name !in used) it.delete() }
    }

    fun exportZip(out: OutputStream) {
        ZipOutputStream(out).use { z ->
            z.putNextEntry(ZipEntry("data.json")); z.write(toJson().toByteArray()); z.closeEntry()
            mediaDir.listFiles()?.forEach { f ->
                z.putNextEntry(ZipEntry("media/${f.name}")); f.inputStream().use { it.copyTo(z) }; z.closeEntry()
            }
        }
    }

    /** Nhập file .zip (có hình/ghi âm) hoặc .json cũ. */
    fun importAny(b: ByteArray): Int {
        if (b.size > 1 && b[0] == 'P'.code.toByte() && b[1] == 'K'.code.toByte()) {
            var json: String? = null
            ZipInputStream(b.inputStream()).use { z ->
                var e = z.nextEntry
                while (e != null) {
                    if (e.name == "data.json") json = String(z.readBytes())
                    else if (e.name.startsWith("media/") && !e.isDirectory)
                        File(mediaDir, File(e.name).name).outputStream().use { z.copyTo(it) }
                    e = z.nextEntry
                }
            }
            return json?.let { importJson(it) } ?: -1
        }
        return importJson(String(b))
    }

    /** Biến có sẵn: {ngày} {giờ} {thứ} {ngày mai}. Biến khác ({tên khách}...) được giữ lại và bôi đen để gõ đè. */
    fun given(full: String) = full.trim().split(Regex("\\s+")).last()

    fun resolve(t: String, name: String? = null): String {
        val vn = Locale("vi", "VN"); val now = Calendar.getInstance()
        fun f(p: String, c: Calendar = now) = SimpleDateFormat(p, vn).format(c.time)
        val tm = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) }
        var r = t.replace("{ngày mai}", f("dd/MM/yyyy", tm)).replace("{ngày}", f("dd/MM/yyyy"))
            .replace("{giờ}", f("HH:mm")).replace("{thứ}", f("EEEE"))
        if (name != null) r = r.replace("{tên đầy đủ}", name.trim()).replace("{tên khách}", given(name)).replace("{tên}", given(name))
        return r
    }

    /** Khớp chính xác từ viết tắt, hoặc từ khoá bắt đầu bằng từ đang gõ (>= 2 ký tự). */
    fun match(w: String): List<Snippet> = snippets.filter { s ->
        s.abbr.equals(w, true) ||
            (w.length >= 2 && s.keyword.split(",").map { it.trim() }.any { it.isNotEmpty() && it.startsWith(w, true) })
    }
}
