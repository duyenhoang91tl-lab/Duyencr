package com.duyen.vietat

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * THƯ MỤC MẸ/CON dạng dropdown cây (14/11/2026).
 * NGUYÊN NHÂN GỐC lỗi "app chưa hiển thị thư mục mẹ-con": app lưu thư mục PHẲNG (Folder.name = "CRM · Túi tiền › Cổ") và hiện thành
 * từng chip độc lập, không có cấp mẹ/con, chọn "Túi tiền" cũng không ra mục của "Túi tiền › Cổ". Ở đây KHÔNG đổi dữ liệu/đồng bộ:
 * chỉ DỰNG CÂY từ tên thư mục (tách theo " › " và phần đầu theo " · ") để hiện dropdown xổ/thu.
 */
class FNode(val key: String, val label: String, val depth: Int) {
    var folderId: String? = null                 // có giá trị nếu đây là 1 thư mục thật (chứa được mục); null = chỉ là nhóm mẹ
    val kids = LinkedHashMap<String, FNode>()
    val ids = mutableListOf<String>()            // id mọi thư mục thật nằm tại hoặc dưới nút này (chọn mẹ = gồm cả con cháu)
}

object FolderTree {
    const val SEP = " › "

    /** "CRM · Của tôi · Túi tiền › Cổ" → [CRM, Của tôi, Túi tiền, Cổ]; "Chung" → [Chung]. */
    fun segs(name: String): List<String> {
        val parts = name.split(SEP).map { it.trim() }.filter { it.isNotEmpty() }
        if (parts.isEmpty()) return listOf(name.ifBlank { "(không tên)" })
        val head = parts[0].split(" · ").map { it.trim() }.filter { it.isNotEmpty() }
        return (head + parts.drop(1)).ifEmpty { listOf(name.ifBlank { "(không tên)" }) }
    }

    fun build(folders: List<Folder>): List<FNode> {
        val roots = LinkedHashMap<String, FNode>()
        for (f in folders) {
            var level: LinkedHashMap<String, FNode> = roots
            var key = ""
            var last: FNode? = null
            val sg = segs(f.name)
            for (i in sg.indices) {
                val s = sg[i]
                key = if (i == 0) s else key + SEP + s
                val k = key
                val depth = i
                val node = level.getOrPut(s) { FNode(k, s, depth) }
                node.ids.add(f.id)
                level = node.kids
                last = node
            }
            val l = last
            if (l != null && l.folderId == null) l.folderId = f.id
        }
        return roots.values.toList()
    }

    /** Danh sách dòng đang hiện (nút con chỉ hiện khi cha nằm trong tập `open`). */
    fun flatten(nodes: List<FNode>, open: Set<String>, out: MutableList<FNode> = mutableListOf()): MutableList<FNode> {
        for (n in nodes) {
            out.add(n)
            if (n.key in open) flatten(n.kids.values.toList(), open, out)
        }
        return out
    }

    fun index(nodes: List<FNode>, out: MutableMap<String, FNode> = HashMap()): Map<String, FNode> {
        for (n in nodes) { out[n.key] = n; index(n.kids.values.toList(), out) }
        return out
    }

    /** Khoá các nút cha của `key` (để tự xổ tới thư mục đang chọn). */
    fun ancestors(key: String): Set<String> {
        val p = key.split(SEP)
        return (1 until p.size).map { p.take(it).joinToString(SEP) }.toSet()
    }
}

/**
 * Hộp chọn thư mục dạng cây: bấm ▸/▾ = xổ/thu thư mục con (thụt lề theo cấp), bấm tên = chọn.
 * - showAll: thêm dòng "Tất cả" (bộ lọc danh sách); onPick(null) = Tất cả.
 * - canPick(node): false (vd nhóm mẹ không phải thư mục thật, khi chọn nơi LƯU mục) → bấm tên chỉ xổ/thu.
 * - count(node): số mục hiện cạnh tên (0 = ẩn).
 */
@Composable
fun FolderTreeDialog(
    title: String,
    folders: List<Folder>,
    selectedKey: String?,
    showAll: Boolean,
    count: (FNode) -> Int,
    canPick: (FNode) -> Boolean,
    onPick: (FNode?) -> Unit,
    onDismiss: () -> Unit
) {
    val roots = FolderTree.build(folders)
    var open by remember { mutableStateOf(if (selectedKey != null) FolderTree.ancestors(selectedKey) else emptySet<String>()) }
    val rows = FolderTree.flatten(roots, open)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                if (showAll) item {
                    TextButton({ onPick(null) }) {
                        Text("Tất cả", fontWeight = if (selectedKey == null) FontWeight.Bold else FontWeight.Normal)
                    }
                }
                items(rows, key = { it.key }) { n ->
                    val isOpen = n.key in open
                    val c = count(n)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Spacer(Modifier.width((n.depth * 18).dp))
                        if (n.kids.isNotEmpty()) TextButton({ open = if (isOpen) open - n.key else open + n.key }) { Text(if (isOpen) "▾" else "▸") }
                        else Spacer(Modifier.width(48.dp))
                        TextButton({
                            if (canPick(n)) onPick(n) else if (n.kids.isNotEmpty()) open = open + n.key
                        }) {
                            Text(n.label + (if (c > 0) " ($c)" else ""),
                                fontWeight = if (n.key == selectedKey) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onDismiss) { Text("Đóng") } }
    )
}
