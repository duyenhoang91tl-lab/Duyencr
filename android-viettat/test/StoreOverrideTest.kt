// Kiểm tra LÕI "bản cá nhân hoá mục CRM" (Data.kt) chạy THẬT trên JVM với org.json thật — không cần máy Android.
// Chạy: android-viettat/test/run-store-test.sh   (cần kotlinc + JDK + org.json; xem README-vi.md mục "Kiểm thử Data.kt")
import com.duyen.vietat.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

var fails = 0
fun ok(c: Boolean, m: String) { println((if (c) "ok   " else "FAIL ") + m); if (!c) fails++ }

fun crm(vararg items: Triple<String, String, List<String>>, kw: String = ""): JSONArray = JSONArray().also { a ->
    items.forEach { (id, abbr, opts) -> a.put(JSONObject().put("id", id).put("abbr", abbr).put("keyword", kw).put("nhom", "Mẫu tin").put("scope", "team")
        .put("options", JSONArray(opts)).put("updatedAt", 5)) }
}
fun snip(id: String) = Store.snippets.firstOrNull { it.id == id }
fun field(n: String) = Store::class.java.getDeclaredField(n).also { it.isAccessible = true }

fun main() {
    val dir = File.createTempFile("vt_store", "").let { it.delete(); it.mkdirs(); it }
    val f = File(dir, "data.json")
    field("file").set(Store, f)
    Store.folders += Folder("default", "Chung", 1)

    // 1) Nạp CRM bình thường
    ok(Store.replaceCrm(crm(Triple("A", "tt", listOf("Nội dung A gốc")), Triple("B", "nk", listOf("Nội dung B gốc")))) == 2, "replaceCrm: nạp 2 mục CRM")
    ok(Store.isCrm("crm_A") && snip("crm_A")!!.options == listOf("Nội dung A gốc") && !Store.isPersonal("crm_A"), "mục CRM nguyên bản, chưa cá nhân hoá")

    // 2) Cá nhân hoá A
    val a = snip("crm_A")!!
    Store.savePersonal(a.copy(abbr = "ttt", keyword = "túi tiền riêng", options = listOf("Bản SỬA của tôi", "Nội dung 2"), updatedAt = 99))
    ok(Store.isPersonal("crm_A") && snip("crm_A")!!.options == listOf("Bản SỬA của tôi", "Nội dung 2") && snip("crm_A")!!.abbr == "ttt", "savePersonal: danh sách đổi ngay sang bản sửa")
    ok(Store.match("ttt").size == 1 && Store.match("tt").isEmpty() && Store.match("túi").size == 1, "gõ tắt khớp theo viết tắt/từ khoá MỚI của bản cá nhân hoá")
    ok(f.readText().contains("\"overrides\"") && f.readText().contains("Bản SỬA của tôi"), "ghi bản cá nhân hoá vào data.json")

    // 3) ☁ CRM lần sau (CRM đã đổi nội dung A) -> bản sửa của tôi KHÔNG bị ghi đè; B lấy nội dung CRM mới
    Store.replaceCrm(crm(Triple("A", "tt", listOf("Nội dung A CRM ĐÃ ĐỔI")), Triple("B", "nk", listOf("Nội dung B CRM mới"))))
    ok(snip("crm_A")!!.options == listOf("Bản SỬA của tôi", "Nội dung 2") && snip("crm_A")!!.abbr == "ttt", "☁ CRM lần sau: GIỮ bản cá nhân hoá của A")
    ok(snip("crm_B")!!.options == listOf("Nội dung B CRM mới"), "mục B chưa sửa: lấy nội dung CRM mới")
    ok(snip("crm_A")!!.folderId == "crm_team_Mẫu tin", "bản cá nhân hoá vẫn nằm trong thư mục CRM")

    // 4) Lưu rồi đọc lại (khởi động lại app)
    val parse = Store::class.java.getDeclaredMethod("parse", String::class.java, Boolean::class.javaPrimitiveType).also { it.isAccessible = true }
    val text = f.readText()
    Store.folders.clear(); Store.snippets.clear(); Store.overrides.clear()
    parse.invoke(Store, text, true)
    ok(Store.isPersonal("crm_A") && snip("crm_A")!!.options == listOf("Bản SỬA của tôi", "Nội dung 2"), "khởi động lại: bản cá nhân hoá vẫn còn")
    Store.replaceCrm(crm(Triple("A", "tt", listOf("A CRM")), Triple("B", "nk", listOf("B CRM"))))
    ok(snip("crm_A")!!.options == listOf("Bản SỬA của tôi", "Nội dung 2"), "khởi động lại rồi ☁ CRM: vẫn giữ bản sửa")

    // 5) Khôi phục bản chung
    Store.restoreCrm("crm_A")
    ok(!Store.isPersonal("crm_A"), "restoreCrm: bỏ bản cá nhân hoá")
    Store.replaceCrm(crm(Triple("A", "tt", listOf("A CRM gốc mới")), Triple("B", "nk", listOf("B CRM"))))
    ok(snip("crm_A")!!.options == listOf("A CRM gốc mới") && snip("crm_A")!!.abbr == "tt", "sau ☁ CRM: A quay về nội dung chung của CRM")

    // 6) Mục gốc bị XOÁ trên CRM nhưng đã cá nhân hoá -> giữ thành mục riêng
    Store.savePersonal(snip("crm_B")!!.copy(options = listOf("B của tôi")))
    Store.replaceCrm(crm(Triple("A", "tt", listOf("A CRM"))))
    ok(snip("crm_B") == null && Store.orphaned == 1 && !Store.isPersonal("crm_B"), "CRM xoá mục B: bản cá nhân hoá không còn là mục CRM, orphaned=1")
    val kept = Store.snippets.firstOrNull { !Store.isCrm(it.id) && it.options == listOf("B của tôi") }
    ok(kept != null && kept.folderId == "default" && kept.abbr == "nk" && kept.updatedAt > 99, "…được GIỮ thành mục riêng (thư mục Chung): không mất dữ liệu")
    Store.replaceCrm(crm(Triple("A", "tt", listOf("A CRM"))))
    ok(Store.orphaned == 0 && Store.snippets.count { it.options == listOf("B của tôi") } == 1, "lần ☁ CRM sau: không nhân đôi mục riêng đã giữ")

    // 7) CRM trả danh sách RỖNG (lỗi máy chủ tạm thời) -> giữ nguyên bản cá nhân hoá, không chuyển thành mục riêng
    Store.savePersonal(snip("crm_A")!!.copy(options = listOf("A của tôi")))
    Store.replaceCrm(JSONArray())
    ok(Store.isPersonal("crm_A") && Store.orphaned == 0 && Store.snippets.none { it.options == listOf("A của tôi") }, "danh sách CRM rỗng (lỗi máy chủ): GIỮ bản cá nhân hoá, chưa chuyển")
    Store.replaceCrm(crm(Triple("A", "tt", listOf("A CRM"))))
    ok(snip("crm_A")!!.options == listOf("A của tôi"), "CRM trở lại bình thường: bản cá nhân hoá được áp lại")

    // 8) Nhập file (importJson) không kéo theo overrides của người khác
    val other = JSONObject().put("folders", JSONArray()).put("snippets", JSONArray())
        .put("overrides", JSONArray().put(JSONObject().put("id", "crm_Z").put("folderId", "x").put("abbr", "z").put("keyword", "").put("options", JSONArray(listOf("lạ"))).put("updatedAt", 1))).toString()
    Store.importJson(other)
    ok(!Store.isPersonal("crm_Z"), "nhập file: KHÔNG nhận bản cá nhân hoá từ file của người khác")

    // 9) Mục tự tạo trên máy không bị ảnh hưởng
    Store.snippets += Snippet("own1", "default", "own", "", listOf("riêng"), 1)
    Store.replaceCrm(crm(Triple("A", "tt", listOf("A CRM"))))
    ok(snip("own1") != null, "mục tự tạo trên máy vẫn còn sau ☁ CRM")

    println(if (fails == 0) "\nALL STORE-OVERRIDE TESTS PASSED" else "\nFAILED $fails")
    System.exit(if (fails == 0) 0 else 1)
}
