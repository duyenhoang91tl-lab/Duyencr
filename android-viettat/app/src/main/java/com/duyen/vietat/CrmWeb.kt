package com.duyen.vietat

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.view.ViewGroup
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceResponse
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import java.io.File

/**
 * Chạy web CRM (https://…workers.dev) trong app: đăng nhập/phiên giữ nguyên, nút Back quay lại trang trước, chọn file để nhập,
 * hộp thoại xác nhận/thông báo của CRM (alert/confirm/prompt), XUẤT FILE (Excel…) qua bảng chia sẻ của Android.
 * Dữ liệu 100% là của CRM trên web — app chỉ là "vỏ" nên mọi tính năng mới của CRM có ngay, không cần cài lại app.
 */
class CrmWeb(private val act: Activity) {
    var progress by mutableStateOf(0)
    var canBack by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    /** Nhật ký chẩn đoán: lỗi JavaScript / lỗi tải file của trang (hiện trong app khi có lỗi, để biết vì sao trang trắng). */
    val logs = mutableStateListOf<String>()
    /** Cắt token đăng nhập khỏi URL trước khi ghi nhật ký (người dùng hay sao chép nhật ký gửi cho người khác). */
    private fun safeUrl(u: String) = u.replace(Regex("(token|demo|adminKey)=[^&]*"), "$1=…")
    fun log(msg: String) { act.runOnUiThread { if (logs.size >= 40) logs.removeAt(0); logs.add(msg) } }
    fun info(): String {
        val wv = try { WebView.getCurrentWebViewPackage()?.let { it.packageName + " " + it.versionName } ?: "?" } catch (e: Exception) { "?" }
        return "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) · ${Build.MANUFACTURER} ${Build.MODEL}\nWebView: $wv\nURL: ${Crm.webUrl(act)}"
    }
    var launchChooser: ((Intent) -> Unit)? = null
    private var fileCb: ValueCallback<Array<Uri>>? = null

    private fun home() = Crm.webUrl(act)

    fun load() { error = null; web.loadUrl(home()) }

    fun onChooserResult(code: Int, data: Intent?) {
        fileCb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(code, data)); fileCb = null
    }

    /** Lưu file do trang tạo ra (blob/data) vào bộ nhớ đệm rồi mở bảng chia sẻ để lưu/mở (Excel, Drive, Zalo…). */
    inner class Bridge {
        @JavascriptInterface
        fun save(name: String, mime: String, b64: String) {
            try {
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "file" }
                val dir = File(act.cacheDir, "dl").also { it.mkdirs() }
                dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 86_400_000L) it.delete() }
                val f = File(dir, safe); f.writeBytes(bytes)
                val uri = FileProvider.getUriForFile(act, act.packageName + ".files", f)
                act.runOnUiThread {
                    val i = Intent(Intent.ACTION_SEND).apply {
                        type = mime.ifBlank { "application/octet-stream" }
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    Toast.makeText(act, "Đã tạo file $safe — chọn nơi lưu/mở", Toast.LENGTH_LONG).show()
                    runCatching { act.startActivity(Intent.createChooser(i, "Lưu / mở: $safe")) }
                }
            } catch (e: Exception) {
                act.runOnUiThread { Toast.makeText(act, "Không lưu được file: ${e.message}", Toast.LENGTH_LONG).show() }
            }
        }
    }

    // Móc vào thẻ <a download href="blob:...">.click()/dispatchEvent (cách SheetJS/XLSX.writeFile xuất file) để chuyển file sang app.
    // SỬA TRANG TRẮNG (21-25/10/2026): CRM đặt `.app{height:calc(100vh - 50px)}`; trang được nạp lúc WebView chưa có kích thước (chưa gắn lên màn hình) nên
    // đơn vị vh bị kẹt = 0 -> .app/.main cao 0, nội dung trắng (quét trang: `.app [0,50 411x0]` dù innerHeight=410..722). Ép chiều cao theo innerHeight THẬT và cập nhật khi đổi kích thước.
    private val vhFixJs = """
(function(){
  if (window.__vhFix) { window.__vhFixRun && window.__vhFixRun(); return; } window.__vhFix = 1;
  var st = document.createElement('style'); st.id = '__vhfix'; document.head.appendChild(st);
  function run(){ var h = window.innerHeight; if (!h || h < 120) return;
    st.textContent = '.app{height:' + (h - 50) + 'px!important}body.rpt-mode .app{height:' + h + 'px!important}'; }
  window.__vhFixRun = run; run();
  window.addEventListener('resize', run); window.addEventListener('orientationchange', run);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', run);
  setTimeout(run, 500); setTimeout(run, 1500); setTimeout(run, 4000);
})();
"""

    // QUÉT TRANG (chẩn đoán): kích thước, phần tử đang nằm ở giữa màn hình (phát hiện lớp phủ trắng/loading), phần tử phủ lớn, các thẻ con của body.
    private val probeJs = """
(function(){
  function d(e){ if(!e) return 'null'; var r=e.getBoundingClientRect(); var cs=getComputedStyle(e);
    return e.tagName+'#'+e.id+'.'+String(e.className && e.className.baseVal === undefined ? e.className : '').slice(0,50)+' ['+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+'] disp='+cs.display+' pos='+cs.position+' z='+cs.zIndex+' bg='+cs.backgroundColor+' op='+cs.opacity+' vis='+cs.visibility; }
  var w=innerWidth,h=innerHeight,o=[];
  o.push('viewport '+w+'x'+h+' dpr='+devicePixelRatio+' scrollW='+document.documentElement.scrollWidth+' scrollH='+document.documentElement.scrollHeight);
  o.push('online='+navigator.onLine+' chữ-trong-trang='+document.body.innerText.length+' số-phần-tử='+document.getElementsByTagName('*').length);
  [[w/2,h*0.35],[w/2,h*0.65],[30,h*0.5]].forEach(function(p){ o.push('tại ('+Math.round(p[0])+','+Math.round(p[1])+'): '+d(document.elementFromPoint(p[0],p[1]))); });
  var cover=[]; document.querySelectorAll('body *').forEach(function(e){ var cs=getComputedStyle(e);
    if((cs.position==='fixed'||cs.position==='absolute')&&cs.display!=='none'&&cs.visibility!=='hidden'){ var r=e.getBoundingClientRect(); if(r.width>w*0.6&&r.height>h*0.4) cover.push(d(e)); } });
  o.push('phủ lớn: '+(cover.length ? '\n  '+cover.slice(0,5).join('\n  ') : 'không'));
  o.push('html.class='+document.documentElement.className+' | body.class='+document.body.className);
  o.push('HTML '+d(document.documentElement)); o.push('BODY '+d(document.body));
  var vis=[].slice.call(document.body.children).filter(function(e){ return e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&getComputedStyle(e).display!=='none'; });
  vis.slice(0,10).forEach(function(e){ o.push('body> '+d(e)+' con='+e.children.length+' chữ='+(e.innerText||'').length); });
  var app=document.querySelector('.app');
  if(app){ o.push('APP con='+app.children.length); [].slice.call(app.children).slice(0,8).forEach(function(e){ o.push('  app> '+d(e)+' con='+e.children.length+' chữ='+(e.innerText||'').length); }); }
  var dv=document.getElementById('data-view');
  if(dv){ o.push('DATA-VIEW '+d(dv)+' con='+dv.children.length); [].slice.call(dv.children).slice(0,10).forEach(function(e){ o.push('  dv> '+d(e)+' chữ='+(e.innerText||'').length); }); }
  return o.join('\n');
})()
"""

    private fun probeDecode(raw: String?): String = try { org.json.JSONTokener(raw ?: "null").nextValue()?.toString() ?: "(rỗng)" } catch (e: Exception) { raw ?: "(lỗi đọc)" }
    fun probe() { web.evaluateJavascript(probeJs) { r -> log("QUÉT TRANG:\n" + probeDecode(r)) } }

    private val hookJs = """
(function(){
  if (window.__dlHook) return; window.__dlHook = 1;
  function grab(a){
    var name = a.getAttribute('download') || 'file';
    fetch(a.href).then(function(r){ return r.blob(); }).then(function(b){
      var fr = new FileReader();
      fr.onload = function(){ AndroidDl.save(name, b.type || 'application/octet-stream', String(fr.result).split(',')[1] || ''); };
      fr.readAsDataURL(b);
    });
  }
  function isDl(a){ return a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href); }
  var oc = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ if (isDl(this)) { grab(this); return; } return oc.apply(this, arguments); };
  var od = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function(e){ if (e && e.type === 'click' && isDl(this)) { grab(this); return true; } return od.apply(this, arguments); };
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (isDl(a)) { e.preventDefault(); grab(a); }
  }, true);
})();
"""

    val web: WebView = WebView(act).apply {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true); builtInZoomControls = true; displayZoomControls = false
            javaScriptCanOpenWindowsAutomatically = false
            mediaPlaybackRequiresUserGesture = true
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString + " DuyenCRM-Android/1.1"
        }
        WebView.setWebContentsDebuggingEnabled(true)   // chrome://inspect trên máy tính khi cần soi sâu
        addJavascriptInterface(Bridge(), "AndroidDl")
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                val scheme = u.scheme.orEmpty()
                if (scheme == "blob" || scheme == "data" || scheme == "about" || scheme == "javascript") return false
                if ((scheme == "http" || scheme == "https") && u.host == Uri.parse(home()).host) return false
                // tel:, zalo:, mailto:, link web khác… -> mở bằng app tương ứng
                runCatching { act.startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) { this@CrmWeb.error = null }
            override fun onPageCommitVisible(view: WebView, url: String?) { view.evaluateJavascript(vhFixJs, null) }
            override fun onPageFinished(view: WebView, url: String?) {
                view.evaluateJavascript(hookJs, null); view.evaluateJavascript(vhFixJs, null); this@CrmWeb.canBack = view.canGoBack()
                view.postDelayed({ probe() }, 7000)   // 7 giây sau khi tải: tự quét trang để biết vì sao trắng
            }
            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) { this@CrmWeb.canBack = view.canGoBack() }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, e: WebResourceError) {
                if (request.isForMainFrame) this@CrmWeb.error = "Không tải được CRM (${e.description}). Kiểm tra mạng rồi bấm Tải lại."
                this@CrmWeb.log("MẠNG ${e.description}: ${safeUrl(request.url.toString())}")
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, r: WebResourceResponse) {
                this@CrmWeb.log("HTTP ${r.statusCode}: ${safeUrl(request.url.toString())}")
            }
            override fun onRenderProcessGone(view: WebView, d: RenderProcessGoneDetail): Boolean {
                this@CrmWeb.log("WebView bị dừng (hết bộ nhớ/lỗi: crash=${d.didCrash()}). Mở lại app.")
                this@CrmWeb.error = "Trình duyệt web của máy bị dừng. Đóng app rồi mở lại."
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) { this@CrmWeb.progress = newProgress }
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) this@CrmWeb.log("JS: ${m.message()} (${m.sourceId().substringAfterLast('/')}:${m.lineNumber()})")
                return true
            }
            override fun onShowFileChooser(w: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = cb
                return try { launchChooser?.invoke(p.createIntent()); launchChooser != null } catch (e: Exception) { fileCb = null; false }
            }
            override fun onJsAlert(v: WebView, url: String?, message: String?, r: JsResult): Boolean {
                AlertDialog.Builder(act).setMessage(message).setCancelable(false).setPositiveButton("OK") { _, _ -> r.confirm() }.show(); return true
            }
            override fun onJsConfirm(v: WebView, url: String?, message: String?, r: JsResult): Boolean {
                AlertDialog.Builder(act).setMessage(message).setCancelable(false)
                    .setPositiveButton("OK") { _, _ -> r.confirm() }.setNegativeButton("Huỷ") { _, _ -> r.cancel() }.show(); return true
            }
            override fun onJsPrompt(v: WebView, url: String?, message: String?, def: String?, r: JsPromptResult): Boolean {
                val et = EditText(act); et.setText(def.orEmpty())
                AlertDialog.Builder(act).setMessage(message).setView(et).setCancelable(false)
                    .setPositiveButton("OK") { _, _ -> r.confirm(et.text.toString()) }.setNegativeButton("Huỷ") { _, _ -> r.cancel() }.show(); return true
            }
        }
    }
}

@Composable
fun CrmWebScreen(crm: CrmWeb) {
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { crm.onChooserResult(it.resultCode, it.data) }
    DisposableEffect(Unit) { crm.launchChooser = { launcher.launch(it) }; onDispose { } }
    BackHandler(enabled = crm.canBack) { crm.web.goBack() }
    var showLog by remember { mutableStateOf(false) }
    if (showLog) {
        val text = crm.info() + "\n\n" + crm.logs.joinToString("\n")
        AlertDialog(onDismissRequest = { showLog = false }, title = { Text("Chẩn đoán trang CRM") },
            text = { Column(Modifier.heightIn(max = 380.dp).verticalScroll(rememberScrollState())) {
                TextButton({ crm.probe() }) { Text("🔍 Quét lại trang") }
                Text(text, style = MaterialTheme.typography.bodySmall)
            } },
            confirmButton = {
                val ctx = androidx.compose.ui.platform.LocalContext.current
                TextButton({
                    (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("chuan-doan", text))
                    Toast.makeText(ctx, "Đã sao chép — dán gửi cho người hỗ trợ", Toast.LENGTH_SHORT).show()
                }) { Text("Sao chép") }
            },
            dismissButton = { TextButton({ crm.logs.clear(); showLog = false }) { Text("Xoá & đóng") } })
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Duyên CRM", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
            if (crm.logs.isNotEmpty()) TextButton({ showLog = true }) { Text("⚠ ${crm.logs.size} lỗi") }
            TextButton({ crm.error = null; crm.web.reload() }) { Text("↻ Tải lại") }
        }
        if (crm.progress in 1..99) LinearProgressIndicator(progress = { crm.progress / 100f }, modifier = Modifier.fillMaxWidth())
        Box(Modifier.weight(1f).fillMaxWidth()) {
            AndroidView(factory = { crm.web.also { (it.parent as? ViewGroup)?.removeView(it) } }, modifier = Modifier.fillMaxSize())
            crm.error?.let { msg ->
                Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(msg)
                    Button({ crm.load() }, Modifier.padding(top = 12.dp)) { Text("Tải lại") }
                }
            }
        }
    }
}
