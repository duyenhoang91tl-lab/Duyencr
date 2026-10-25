package com.duyen.vietat

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
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
            override fun onPageFinished(view: WebView, url: String?) { view.evaluateJavascript(hookJs, null); this@CrmWeb.canBack = view.canGoBack() }
            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) { this@CrmWeb.canBack = view.canGoBack() }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, e: WebResourceError) {
                if (request.isForMainFrame) this@CrmWeb.error = "Không tải được CRM (${e.description}). Kiểm tra mạng rồi bấm Tải lại."
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) { this@CrmWeb.progress = newProgress }
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
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Duyên CRM", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
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
