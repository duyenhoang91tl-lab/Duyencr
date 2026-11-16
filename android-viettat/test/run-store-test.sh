#!/bin/bash
# Chạy StoreOverrideTest.kt trên JVM (không cần Android). Cần: kotlinc (>=1.9), JDK 17+ (javac), android.jar (chỉ để biên dịch), org.json (biên dịch từ mã nguồn stleary/JSON-java).
# Biến môi trường: KT=thư mục kotlinc  AJAR=đường dẫn android.jar  JSONSRC=thư mục chứa org/json/*.java
set -e
KT=${KT:-/tmp/kt/kotlinc}; AJAR=${AJAR:-/tmp/kt/android.jar}; JSONSRC=${JSONSRC:-/tmp/kt/json}
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="$HERE/../app/src/main/java/com/duyen/vietat"; OUT=$(mktemp -d)
mkdir -p "$OUT/json" "$OUT/stubs"
javac -d "$OUT/json" $(find "$JSONSRC" -path '*/src/main/java/org/json/*.java') 2>&1 | grep -v '^Note:' || true
cat > "$OUT/stubs/Compose.kt" <<'KT'
package androidx.compose.runtime
class SnapshotStateList<T> : java.util.ArrayList<T>()
fun <T> mutableStateListOf(vararg e: T): SnapshotStateList<T> { val l = SnapshotStateList<T>(); l.addAll(e); return l }
KT
"$KT/bin/kotlinc" -jvm-target 17 -cp "$OUT/json:$AJAR" -d "$OUT/out" "$SRC/Data.kt" "$HERE/StoreOverrideTest.kt" "$OUT/stubs/Compose.kt" 2>&1 | grep -v '^warning:' || true
java -cp "$OUT/out:$OUT/json:$KT/lib/kotlin-stdlib.jar:$AJAR" StoreOverrideTestKt
