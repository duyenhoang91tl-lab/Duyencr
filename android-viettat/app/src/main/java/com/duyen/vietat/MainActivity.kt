package com.duyen.vietat

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.webkit.MimeTypeMap
import android.widget.Toast
import android.graphics.BitmapFactory
import android.media.MediaPlayer
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.core.content.ContextCompat
import java.io.File
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import java.util.UUID
import kotlin.concurrent.thread

class MainActivity : ComponentActivity() {
    private lateinit var crm: CrmWeb
    override fun onCreate(b: Bundle?) {
        super.onCreate(b); Store.init(this)
        crm = CrmWeb(this)
        thread { Crm.pull(this) }   // nạp sẵn kho Viết tắt từ CRM để gõ tắt dùng được ngay (kết nối mặc định, không hỏi gì)
        if (b == null) crm.load() else crm.web.restoreState(b)
        setContent { MaterialTheme { Root(crm) } }
    }
    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); crm.web.saveState(out) }
    override fun onPause() { super.onPause(); crm.web.onPause() }
    override fun onResume() { super.onResume(); crm.web.onResume(); crm.detectName() }
    override fun onDestroy() { crm.web.destroy(); super.onDestroy() }
}

/** App "Duyên CRM": tab CRM (web CRM trong app) + tab Viết tắt (gõ tắt, dữ liệu lấy từ CRM). */
@Composable
fun Root(crm: CrmWeb) {
    var tab by remember { mutableStateOf(0) }
    Scaffold(bottomBar = {
        NavigationBar {
            NavigationBarItem(tab == 0, { tab = 0 }, { Text("🏠") }, label = { Text("CRM") })
            NavigationBarItem(tab == 1, { tab = 1 }, { Text("⌨") }, label = { Text("Viết tắt") })
        }
    }) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) { if (tab == 0) CrmWebScreen(crm) else App(crm) }
    }
}

/** Dịch vụ Trợ năng "Viết Tắt" đang bật chưa (đọc từ cài đặt hệ thống) — để hiện trạng thái ngay đầu màn hình thay vì bắt Duyên mở Cài đặt xem. */
fun serviceOn(ctx: android.content.Context): Boolean = runCatching {
    Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty().contains(ctx.packageName)
}.getOrDefault(false)

/**
 * Hộp "🩺 Kiểm tra gõ tắt" (mở từ menu ⋮): cho biết gõ tắt hỏng ở bước nào bằng `Diag.report()` và có ô GÕ THỬ viết tắt (`Diag.trial`).
 * NGUYÊN NHÂN GỐC báo cáo "❌ CHƯA gửi sự kiện gõ nào" dù gõ tắt ở Zalo đã hiện màn chọn (video Duyên 2026-10-27): báo cáo chỉ tính 1 LẦN lúc mở rồi đứng yên
 * khi Duyên sang Zalo gõ và quay lại → hiện số liệu CŨ. Nay tự đọc lại mỗi giây khi hộp đang mở.
 */
@Composable
fun DiagDialog(onDone: () -> Unit) {
    var report by remember { mutableStateOf(Diag.report()) }
    var test by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { while (true) { report = Diag.report(); kotlinx.coroutines.delay(1000) } }
    AlertDialog(onDismissRequest = onDone, title = { Text("🩺 Kiểm tra gõ tắt") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(report, style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(test, { test = it }, singleLine = true, label = { Text("Gõ thử viết tắt (vd: ch)") }, modifier = Modifier.fillMaxWidth())
                Text(Diag.trial(test), style = MaterialTheme.typography.bodySmall)
                Text("Mẹo: gõ viết tắt ở app chat khác (Zalo/Messenger/Pancake), KHÔNG bấm cách; quay lại đây, báo cáo trên tự cập nhật mỗi giây.", style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = { TextButton(onDone) { Text("Đóng") } })
}

/**
 * Màn Viết tắt (thiết kế lại 14/11/2026): ĐẦU MÀN HÌNH là 1 thẻ trạng thái (xanh = dịch vụ đang bật, đỏ nhạt = chưa bật + nút Bật) kèm kết quả đồng bộ CRM;
 * Xuất/Nhập/Cập nhật CRM/Kiểm tra gập vào menu ⋮ (trước đây 4 nút chiếm gần nửa màn hình); ô tìm kiếm bo tròn; mỗi mục là thẻ có viết tắt đậm,
 * nhãn ☁ CRM (mục từ CRM, chỉ sửa trên CRM), từ khoá, xem trước nội dung, số nội dung/hình/ghi âm; có trạng thái trống và nút "+ Thêm viết tắt" không che mục cuối.
 * Logic dữ liệu (Store/Crm/thư mục cây/hộp sửa) GIỮ NGUYÊN — chỉ đổi cách hiển thị.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(crm: CrmWeb) {
    val ctx = LocalContext.current
    var selKey by remember { mutableStateOf<String?>(null) }   // khoá nút cây thư mục đang lọc (null = Tất cả)
    var pickFolder by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Snippet?>(null) }
    var newFolder by remember { mutableStateOf(false) }
    var q by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var menu by remember { mutableStateOf(false) }
    var diag by remember { mutableStateOf(false) }
    var on by remember { mutableStateOf(serviceOn(ctx)) }
    // Đọc kho Viết tắt của CRM (chung + của tôi) — kết nối mặc định, không còn hộp cài đặt; tên CS tự lấy từ tài khoản đăng nhập CRM.
    val doSync = { thread { status = Crm.pull(ctx) }; Unit }
    LaunchedEffect(Unit) { crm.detectName(); doSync() }
    LaunchedEffect(Unit) { while (true) { on = serviceOn(ctx); kotlinx.coroutines.delay(1500) } }
    val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { u ->
        if (u != null) runCatching { ctx.contentResolver.openOutputStream(u)?.use { Store.exportZip(it) } }
            .onSuccess { Toast.makeText(ctx, "Đã xuất file", Toast.LENGTH_SHORT).show() }
    }
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { u ->
        if (u != null) {
            val t = runCatching { ctx.contentResolver.openInputStream(u)?.use { it.readBytes() } }.getOrNull()
            val n = if (t == null) -1 else Store.importAny(t)
            Toast.makeText(ctx, if (n >= 0) "Đã nhập $n mục" else "File không hợp lệ", Toast.LENGTH_SHORT).show()
        }
    }

    // Thư mục mẹ/con dạng cây (xem FolderTree.kt): chọn mẹ = lọc cả con cháu.
    val node = selKey?.let { FolderTree.index(FolderTree.build(Store.folders))[it] }
    val selIds = node?.ids?.toSet()
    val shown = Store.snippets.filter { x ->
        (selIds == null || x.folderId in selIds) && (q.isBlank() || listOf(x.abbr, x.keyword).plus(x.options).any { it.contains(q, true) })
    }
    Scaffold(floatingActionButton = {
        ExtendedFloatingActionButton(onClick = {
            // Mục mới KHÔNG được rơi vào thư mục CRM (bị xoá mỗi lần ☁ CRM) → về "default" nếu đang đứng trong thư mục CRM.
            val fid = (node?.folderId ?: node?.ids?.firstOrNull() ?: Store.folders.first().id).let { if (Store.isCrm(it)) "default" else it }
            editing = Snippet("", fid, "", "", listOf(""))
        }) { Text("+ Thêm viết tắt") }
    }) { pad ->
        Column(Modifier.padding(pad).padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(
                containerColor = if (on) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.errorContainer)) {
                Row(Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp, end = 4.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(if (on) "● Viết tắt đang bật" else "○ Chưa bật dịch vụ Viết Tắt", style = MaterialTheme.typography.titleSmall)
                        Text(if (on) "Gõ viết tắt ở Zalo, Messenger, Pancake…" else "Bật trong Cài đặt › Trợ năng để gõ tắt hoạt động", style = MaterialTheme.typography.bodySmall)
                        if (status.isNotEmpty()) Text(status, style = MaterialTheme.typography.bodySmall, maxLines = 4, overflow = TextOverflow.Ellipsis)
                    }
                    if (!on) Button({ ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }) { Text("Bật") }
                    Box {
                        IconButton({ menu = true }) { Text("⋮", style = MaterialTheme.typography.titleLarge) }
                        DropdownMenu(menu, { menu = false }) {
                            DropdownMenuItem({ Text("☁ Cập nhật từ CRM") }, { menu = false; crm.detectName(); doSync() })
                            DropdownMenuItem({ Text("Xuất file") }, { menu = false; exporter.launch("viettat-backup.zip") })
                            DropdownMenuItem({ Text("Nhập file") }, { menu = false; importer.launch(arrayOf("application/json", "text/*", "*/*")) })
                            DropdownMenuItem({ Text("🩺 Kiểm tra gõ tắt") }, { menu = false; diag = true })
                            if (on) DropdownMenuItem({ Text("Mở cài đặt Trợ năng") }, { menu = false; ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) })
                        }
                    }
                }
            }
            OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(28.dp),
                placeholder = { Text("Tìm viết tắt, từ khoá, nội dung") },
                trailingIcon = { if (q.isNotEmpty()) TextButton({ q = "" }) { Text("✕") } })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                AssistChip({ pickFolder = true }, { Text("📁 " + (node?.key ?: "Tất cả") + " ▾", maxLines = 1, overflow = TextOverflow.Ellipsis) }, Modifier.weight(1f, fill = false))
                AssistChip({ newFolder = true }, { Text("+ Thư mục") })
                Spacer(Modifier.weight(1f))
                Text("${shown.size} mục", style = MaterialTheme.typography.labelMedium)
            }
            val delId = node?.folderId
            if (delId != null && delId != "default" && !Store.isCrm(delId)) TextButton({
                Store.deleteFolder(delId); selKey = null; doSync()
            }) { Text("Xoá thư mục này") }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 88.dp)) {
                if (shown.isEmpty()) item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = androidx.compose.ui.Alignment.Center) {
                        Text(if (q.isBlank()) "Thư mục này chưa có viết tắt.\nBấm \"+ Thêm viết tắt\" hoặc chọn 📁 Tất cả." else "Không tìm thấy \"$q\"", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                items(shown) { s ->
                    val crmItem = Store.isCrm(s.id)
                    val nImg = s.options.count { kindOf(it) == "img" }
                    val nAud = s.options.count { kindOf(it) == "aud" }
                    val preview = s.options.firstOrNull { kindOf(it) == null }.orEmpty()
                    // Mục CRM cũng bấm vào xem được ĐỦ nội dung và sửa CÁ NHÂN HOÁ (chỉ trên máy này) — SnippetDialog xử lý theo Store.isCrm(s.id).
                    Card(onClick = { editing = s }, Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                Text(s.abbr, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                if (crmItem) Text(if (Store.isPersonal(s.id)) "☁ CRM · ✎ cá nhân hoá" else "☁ CRM", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                            }
                            if (s.keyword.isNotBlank()) Text(s.keyword, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (preview.isNotBlank()) Text(preview, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("${s.options.size} nội dung" + (if (nImg > 0) " · 🖼 $nImg" else "") + (if (nAud > 0) " · 🎤 $nAud" else ""), style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
    if (diag) DiagDialog { diag = false }
    editing?.let { SnippetDialog(it) { editing = null; doSync() } }
    if (pickFolder) FolderTreeDialog("Chọn thư mục", Store.folders, selKey, true,
        count = { n -> Store.snippets.count { it.folderId in n.ids } },
        canPick = { true },
        onPick = { n -> selKey = n?.key; pickFolder = false },
        onDismiss = { pickFolder = false })
    if (newFolder) {
        // Thư mục con: gõ "Mẹ › Con" (đang đứng trong 1 thư mục tự tạo thì điền sẵn tên mẹ). Cây dựng từ tên nên không đổi dữ liệu/đồng bộ.
        var name by remember { mutableStateOf(if (node != null && !node.key.startsWith("CRM")) node.key + " › " else "") }
        AlertDialog(onDismissRequest = { newFolder = false }, title = { Text("Thư mục mới") },
            text = { OutlinedTextField(name, { name = it }, singleLine = true, label = { Text("Tên thư mục") },
                supportingText = { Text("Thư mục con: gõ  Mẹ › Con  (vd: Túi tiền › Cổ)") }) },
            confirmButton = { TextButton({
                val nm = name.trim().trimEnd('›', ' ')
                if (nm.isNotBlank()) { Store.folders += Folder(UUID.randomUUID().toString(), nm, System.currentTimeMillis()); Store.save() }
                newFolder = false; doSync()
            }) { Text("Tạo") } })
    }
}

/** Hình thu nhỏ để XEM trong hộp sửa (giải mã giảm kích thước, tránh tràn bộ nhớ với ảnh lớn); null nếu tệp chưa có/hỏng. */
private fun thumb(path: String, target: Int = 480): androidx.compose.ui.graphics.ImageBitmap? = runCatching {
    val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, b)
    var sample = 1
    while (b.outWidth / (sample * 2) >= target && b.outHeight / (sample * 2) >= target) sample *= 2
    BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
}.getOrNull()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SnippetDialog(s: Snippet, onDone: () -> Unit) {
    val ctx = LocalContext.current
    // Mục lấy từ CRM (id "crm_…"): xem đủ nội dung + sửa thành BẢN CÁ NHÂN HOÁ chỉ trên máy này (Store.savePersonal); không xoá được, không đổi thư mục.
    val crm = Store.isCrm(s.id)
    val personal = crm && Store.isPersonal(s.id)
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    var playing by remember { mutableStateOf("") }
    var abbr by remember { mutableStateOf(s.abbr) }
    var kw by remember { mutableStateOf(s.keyword) }
    var folder by remember { mutableStateOf(s.folderId) }
    var pickFolderDlg by remember { mutableStateOf(false) }
    val opts = remember { s.options.toMutableStateList() }
    var rec by remember { mutableStateOf<MediaRecorder?>(null) }
    var recName by remember { mutableStateOf("") }

    fun copyIn(u: android.net.Uri, def: String): String {
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(ctx.contentResolver.getType(u)) ?: def
        val name = "${UUID.randomUUID()}.$ext"
        (ctx.contentResolver.openInputStream(u) ?: error("không mở được tệp")).use { i -> File(Store.mediaDir, name).outputStream().use { i.copyTo(it) } }
        return name
    }
    // NGUYÊN NHÂN GỐC (14/11/2026): trước đây dùng GetContent() = bộ chọn đúng 1 tệp/lần nên "+ Hình ảnh" không chọn được nhiều ảnh cùng lúc
    // (phải bấm lại từng ảnh một). GetMultipleContents() cho chọn nhiều; mỗi ảnh thành 1 lựa chọn [[img:..]] riêng, giữ đúng thứ tự đã chọn.
    // Một tệp lỗi (không đọc được) chỉ bỏ qua tệp đó, không làm mất các tệp còn lại.
    val pickImg = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { us ->
        var bad = 0
        us.forEach { u -> runCatching { opts.add("[[img:${copyIn(u, "jpg")}]]") }.onFailure { bad++ } }
        if (bad > 0) Toast.makeText(ctx, "$bad ảnh không đọc được, đã bỏ qua", Toast.LENGTH_SHORT).show()
    }
    val pickAud = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { us ->
        var bad = 0
        us.forEach { u -> runCatching { opts.add("[[aud:${copyIn(u, "m4a")}]]") }.onFailure { bad++ } }
        if (bad > 0) Toast.makeText(ctx, "$bad tệp âm thanh không đọc được, đã bỏ qua", Toast.LENGTH_SHORT).show()
    }
    fun startRec() {
        val name = "${UUID.randomUUID()}.m4a"
        val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(ctx) else @Suppress("DEPRECATION") MediaRecorder()
        runCatching {
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setOutputFile(File(Store.mediaDir, name).absolutePath)
            r.prepare(); r.start()
            rec = r; recName = name
        }.onFailure { r.release(); Toast.makeText(ctx, "Không ghi âm được", Toast.LENGTH_SHORT).show() }
    }
    fun stopRec() {
        rec?.let { runCatching { it.stop() }; it.release() }
        rec = null; opts.add("[[aud:$recName]]")
    }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { if (it) startRec() }
    DisposableEffect(Unit) { onDispose { rec?.let { r -> runCatching { r.stop() }; r.release() } } }
    fun stopPlay() { player?.let { runCatching { it.stop() }; it.release() }; player = null; playing = "" }
    fun togglePlay(name: String) {
        val was = playing; stopPlay()
        if (was == name) return
        val f = File(Store.mediaDir, name)
        if (!f.exists()) { Toast.makeText(ctx, "Tệp ghi âm chưa có trên máy — bấm ⋮ › ☁ Cập nhật từ CRM", Toast.LENGTH_SHORT).show(); return }
        runCatching {
            val mp = MediaPlayer()
            mp.setDataSource(f.absolutePath); mp.setOnCompletionListener { playing = "" }; mp.prepare(); mp.start()
            player = mp; playing = name
        }.onFailure { Toast.makeText(ctx, "Không phát được tệp này", Toast.LENGTH_SHORT).show() }
    }
    DisposableEffect(Unit) { onDispose { player?.let { p -> runCatching { p.stop() }; p.release() } } }

    AlertDialog(onDismissRequest = onDone,
        title = { Text(if (s.id.isEmpty()) "Thêm viết tắt" else if (crm) "Mục từ CRM" else "Sửa viết tắt") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (crm) Text(if (personal) "✎ Đang dùng BẢN CÁ NHÂN HOÁ của bạn — chỉ áp dụng trên máy này, không đổi trên CRM."
                    else "☁ Mục lấy từ CRM. Bạn xem đủ nội dung và sửa được — bản sửa CHỈ áp dụng trên máy này (không đổi trên CRM, người khác không bị ảnh hưởng).",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                if (personal) OutlinedButton({
                    Store.restoreCrm(s.id)
                    Toast.makeText(ctx, "Đang lấy lại bản chung từ CRM…", Toast.LENGTH_SHORT).show()
                    onDone()   // App gọi lại ☁ CRM sau khi đóng hộp → bản chung quay lại
                }, Modifier.fillMaxWidth()) { Text("↩ Khôi phục bản chung từ CRM") }
                OutlinedTextField(abbr, { abbr = it }, singleLine = true, label = { Text("Viết tắt (vd: stk)") })
                OutlinedTextField(kw, { kw = it }, singleLine = true, label = { Text("Từ khoá (cách nhau dấu phẩy)") })
                if (crm) Text("📁 " + (Store.folders.firstOrNull { it.id == folder }?.name ?: "CRM"), style = MaterialTheme.typography.bodySmall)
                else OutlinedButton({ pickFolderDlg = true }, Modifier.fillMaxWidth()) {
                    Text("📁 " + (Store.folders.firstOrNull { it.id == folder }?.name ?: "Chung") + "  ▾", maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                // NGUYÊN NHÂN GỐC (Duyên 16/11) "không thấy nút thêm tin nhắn" + "chữ lẫn hình khó xem": trước đây vẽ theo THỨ TỰ trong danh sách nên chữ/hình xen kẽ,
                // còn nút "+ Nội dung" nằm ở hàng nút CUỐI (cuộn ngang) sau cả chục hình. Nay chia 3 phần có tiêu đề + số lượng, nút thêm nằm ngay dưới từng phần, ô chữ có ✕.
                val textIdx = opts.indices.filter { kindOf(opts[it]) == null }
                val imgIdx = opts.indices.filter { kindOf(opts[it]) == "img" }
                val audIdx = opts.indices.filter { kindOf(opts[it]) == "aud" }

                @Composable
                fun mediaRow(i: Int, o: String) {
                    // XEM đủ: hình hiện thu nhỏ, ghi âm có nút ▶ Nghe.
                    val isImg = kindOf(o) == "img"
                    val mname = mediaNameOf(o)
                    val mf = File(Store.mediaDir, mname)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(labelOf(o), Modifier.weight(1f))
                            if (!isImg && mf.exists()) TextButton({ togglePlay(mname) }) { Text(if (playing == mname) "■ Dừng" else "▶ Nghe") }
                            TextButton({ if (playing == mname) stopPlay(); opts.removeAt(i) }) { Text("✕") }
                        }
                        if (isImg) {
                            val bmp = remember(o) { thumb(mf.absolutePath) }
                            if (bmp != null) Image(bmp, null, Modifier.fillMaxWidth().heightIn(max = 220.dp), contentScale = ContentScale.Fit)
                            else Text("(hình chưa có trên máy — bấm ⋮ › ☁ Cập nhật từ CRM)", style = MaterialTheme.typography.bodySmall)
                        } else if (!mf.exists()) Text("(tệp ghi âm chưa có trên máy — bấm ⋮ › ☁ Cập nhật từ CRM)", style = MaterialTheme.typography.bodySmall)
                    }
                }

                Text("💬 Tin nhắn mẫu (${textIdx.size})", style = MaterialTheme.typography.titleSmall)
                textIdx.forEachIndexed { k, i ->
                    Row(verticalAlignment = androidx.compose.ui.Alignment.Top) {
                        OutlinedTextField(opts[i], { opts[i] = it }, label = { Text("Nội dung ${k + 1}") },
                            supportingText = { if (k == 0) Text("Biến: {ngày} {giờ} {thứ} {ngày mai} · {tên} = tên khách, tự lấy từ màn hình (hoặc gõ: viết tắt + tên) · {tên đầy đủ}") },
                            modifier = Modifier.weight(1f))
                        TextButton({ opts.removeAt(i) }) { Text("✕") }
                    }
                }
                OutlinedButton({ opts.add("") }, Modifier.fillMaxWidth()) { Text("+ Thêm tin nhắn mẫu") }

                Text("🖼 Hình ảnh (${imgIdx.size})", style = MaterialTheme.typography.titleSmall)
                imgIdx.forEach { i -> mediaRow(i, opts[i]) }
                OutlinedButton({ pickImg.launch("image/*") }, Modifier.fillMaxWidth()) { Text("+ Thêm hình ảnh") }

                Text("🎤 Ghi âm / âm thanh (${audIdx.size})", style = MaterialTheme.typography.titleSmall)
                audIdx.forEach { i -> mediaRow(i, opts[i]) }
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    TextButton({
                        if (rec != null) stopRec()
                        else if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startRec()
                        else perm.launch(Manifest.permission.RECORD_AUDIO)
                    }) { Text(if (rec != null) "■ Dừng ghi" else "● Ghi âm") }
                    TextButton({ pickAud.launch("audio/*") }) { Text("+ File âm thanh") }
                }
            }
        },
        confirmButton = {
            TextButton({
                if (rec != null) stopRec()
                val n = Snippet(s.id.ifEmpty { UUID.randomUUID().toString() }, folder, abbr.trim(), kw.trim(), opts.filter { it.isNotBlank() }.let { l -> l.filter { kindOf(it) == null } + l.filter { kindOf(it) == "img" } + l.filter { kindOf(it) == "aud" } }, System.currentTimeMillis())
                if (n.abbr.isNotEmpty() && n.options.isNotEmpty()) {
                    if (crm) Store.savePersonal(n)   // mục CRM → bản cá nhân hoá (☁ CRM áp lại, không bị ghi đè)
                    else {
                        val i = Store.snippets.indexOfFirst { it.id == n.id }
                        if (i >= 0) Store.snippets[i] = n else Store.snippets += n
                        Store.save()
                    }
                }
                stopPlay()
                onDone()
            }) { Text("Lưu") }
        },
        dismissButton = {
            Row {
                if (s.id.isNotEmpty() && !crm) TextButton({ Store.deleteSnippet(s.id); onDone() }) { Text("Xoá") }
                TextButton(onDone) { Text("Huỷ") }
            }
        })
    if (pickFolderDlg) {
        val own = Store.folders.filter { !Store.isCrm(it.id) }   // mục tự tạo không được lưu vào thư mục CRM (bị ghi đè khi ☁ CRM)
        val curName = own.firstOrNull { it.id == folder }?.name
        FolderTreeDialog("Lưu vào thư mục", own, curName?.let { FolderTree.segs(it).joinToString(FolderTree.SEP) }, false,
            count = { n -> Store.snippets.count { it.folderId in n.ids } },
            canPick = { it.folderId != null },
            onPick = { n -> n?.folderId?.let { folder = it }; pickFolderDlg = false },
            onDismiss = { pickFolderDlg = false })
    }
}

@Composable
fun CrmDialog(onDone: () -> Unit, onSave: () -> Unit) {
    // Viết tắt đã MẶC ĐỊNH nối sẵn với CRM (Crm.DEFAULT_URL / DEFAULT_WEB) nên hộp này chỉ còn hỏi Tên CS — không còn chữ "Kết nối" và 2 ô địa chỉ.
    // Địa chỉ đã lưu riêng trên máy (nếu từng đổi) vẫn được giữ nguyên: Lưu chỉ ghi "name", không đụng "url"/"web".
    val ctx = LocalContext.current
    val p = Crm.prefs(ctx)
    var name by remember { mutableStateOf(Crm.name(ctx)) }
    AlertDialog(onDismissRequest = onDone, title = { Text("Cập nhật viết tắt") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Nhập đúng tên CS của bạn (giống tên trong CRM) để thấy cả mục viết tắt riêng của bạn. Mục chung của team luôn có.", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(name, { name = it }, singleLine = true, label = { Text("Tên CS của bạn") }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton({
                if (name.isNotBlank()) { p.edit().putString("name", name.trim()).apply(); onSave() }
                onDone()
            }) { Text("Lưu & cập nhật") }
        },
        dismissButton = { TextButton(onDone) { Text("Huỷ") } })
}
