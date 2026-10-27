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
import androidx.compose.ui.text.style.TextOverflow
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(crm: CrmWeb) {
    val ctx = LocalContext.current
    var sel by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<Snippet?>(null) }
    var newFolder by remember { mutableStateOf(false) }
    var q by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    // Đọc kho Viết tắt của CRM (chung + của tôi) — kết nối mặc định, không còn hộp cài đặt; tên CS tự lấy từ tài khoản đăng nhập CRM.
    val doSync = { thread { status = Crm.pull(ctx) }; Unit }
    LaunchedEffect(Unit) { crm.detectName(); doSync() }
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

    Scaffold(floatingActionButton = {
        FloatingActionButton(onClick = { editing = Snippet("", sel ?: Store.folders.first().id, "", "", listOf("")) }) { Text("+") }
    }) { pad ->
        Column(Modifier.padding(pad).padding(12.dp)) {
            Button(onClick = { ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }, Modifier.fillMaxWidth()) {
                Text("Bật dịch vụ \"Viết Tắt\" trong Trợ năng")
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton({ exporter.launch("viettat-backup.zip") }, Modifier.weight(1f)) { Text("Xuất file") }
                OutlinedButton({ importer.launch(arrayOf("application/json", "text/*", "*/*")) }, Modifier.weight(1f)) { Text("Nhập file") }
                OutlinedButton({ crm.detectName(); doSync() }, Modifier.weight(1f)) { Text("☁ CRM") }
            }
            if (status.isNotEmpty()) Text(status, style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth().padding(top = 8.dp), singleLine = true,
                label = { Text("Tìm viết tắt, từ khoá, nội dung") })
            Spacer(Modifier.height(8.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(sel == null, { sel = null }, { Text("Tất cả") }) }
                items(Store.folders) { f -> FilterChip(sel == f.id, { sel = f.id }, { Text(f.name) }) }
                item { AssistChip({ newFolder = true }, { Text("+ Thư mục") }) }
            }
            if (sel != null && sel != "default" && !Store.isCrm(sel!!)) TextButton({
                sel?.let { Store.deleteFolder(it) }; sel = null; doSync()
            }) { Text("Xoá thư mục này") }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                items(Store.snippets.filter { x ->
                    (sel == null || x.folderId == sel) && (q.isBlank() || listOf(x.abbr, x.keyword).plus(x.options).any { it.contains(q, true) })
                }) { s ->
                    Card(onClick = {
                        if (Store.isCrm(s.id)) Toast.makeText(ctx, "Mục lấy từ CRM — sửa trên CRM (tab Zalo AI → Viết tắt), rồi bấm ☁ CRM để cập nhật", Toast.LENGTH_LONG).show()
                        else editing = s
                    }, Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text(s.abbr, style = MaterialTheme.typography.titleMedium)
                            if (s.keyword.isNotBlank()) Text("Từ khoá: ${s.keyword}", style = MaterialTheme.typography.bodySmall)
                            Text("${s.options.size} nội dung · ${labelOf(s.options.firstOrNull().orEmpty())}", maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
    editing?.let { SnippetDialog(it) { editing = null; doSync() } }
    if (newFolder) {
        var name by remember { mutableStateOf("") }
        AlertDialog(onDismissRequest = { newFolder = false }, title = { Text("Thư mục mới") },
            text = { OutlinedTextField(name, { name = it }, singleLine = true, label = { Text("Tên thư mục") }) },
            confirmButton = { TextButton({
                if (name.isNotBlank()) { Store.folders += Folder(UUID.randomUUID().toString(), name.trim(), System.currentTimeMillis()); Store.save() }
                newFolder = false; doSync()
            }) { Text("Tạo") } })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SnippetDialog(s: Snippet, onDone: () -> Unit) {
    val ctx = LocalContext.current
    var abbr by remember { mutableStateOf(s.abbr) }
    var kw by remember { mutableStateOf(s.keyword) }
    var folder by remember { mutableStateOf(s.folderId) }
    val opts = remember { s.options.toMutableStateList() }
    var rec by remember { mutableStateOf<MediaRecorder?>(null) }
    var recName by remember { mutableStateOf("") }

    fun copyIn(u: android.net.Uri, def: String): String {
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(ctx.contentResolver.getType(u)) ?: def
        val name = "${UUID.randomUUID()}.$ext"
        ctx.contentResolver.openInputStream(u)?.use { i -> File(Store.mediaDir, name).outputStream().use { i.copyTo(it) } }
        return name
    }
    val pickImg = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { u ->
        if (u != null) opts.add("[[img:${copyIn(u, "jpg")}]]")
    }
    val pickAud = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { u ->
        if (u != null) opts.add("[[aud:${copyIn(u, "m4a")}]]")
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

    AlertDialog(onDismissRequest = onDone,
        title = { Text(if (s.id.isEmpty()) "Thêm viết tắt" else "Sửa viết tắt") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(abbr, { abbr = it }, singleLine = true, label = { Text("Viết tắt (vd: stk)") })
                OutlinedTextField(kw, { kw = it }, singleLine = true, label = { Text("Từ khoá (cách nhau dấu phẩy)") })
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Store.folders.forEach { f -> FilterChip(folder == f.id, { folder = f.id }, { Text(f.name) }) }
                }
                opts.forEachIndexed { i, o ->
                    if (kindOf(o) != null) {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text("${i + 1}. ${labelOf(o)}", Modifier.weight(1f))
                            TextButton({ opts.removeAt(i) }) { Text("✕") }
                        }
                    } else OutlinedTextField(o, { opts[i] = it }, label = { Text("Nội dung ${i + 1}") },
                        supportingText = { if (i == 0) Text("Biến: {ngày} {giờ} {thứ} {ngày mai} · {tên} = tên khách, tự lấy từ màn hình (hoặc gõ: viết tắt + tên) · {tên đầy đủ}") },
                        modifier = Modifier.fillMaxWidth())
                }
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    TextButton({ opts.add("") }) { Text("+ Nội dung") }
                    TextButton({ pickImg.launch("image/*") }) { Text("+ Hình ảnh") }
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
                val n = Snippet(s.id.ifEmpty { UUID.randomUUID().toString() }, folder, abbr.trim(), kw.trim(), opts.filter { it.isNotBlank() }, System.currentTimeMillis())
                if (n.abbr.isNotEmpty() && n.options.isNotEmpty()) {
                    val i = Store.snippets.indexOfFirst { it.id == n.id }
                    if (i >= 0) Store.snippets[i] = n else Store.snippets += n
                    Store.save()
                }
                onDone()
            }) { Text("Lưu") }
        },
        dismissButton = {
            Row {
                if (s.id.isNotEmpty()) TextButton({ Store.deleteSnippet(s.id); onDone() }) { Text("Xoá") }
                TextButton(onDone) { Text("Huỷ") }
            }
        })
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
