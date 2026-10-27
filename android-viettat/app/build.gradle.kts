plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.duyen.vietat"
    compileSdk = 34
    defaultConfig { applicationId = "com.duyen.vietat"; minSdk = 26; targetSdk = 34; versionCode = 12; versionName = "1.11" }
    // KHÓA KÝ CỐ ĐỊNH (nằm trong repo, dùng chung cho mọi lần build): để bản APK mới CÀI ĐÈ được bản cũ trên điện thoại.
    // Khóa debug tự sinh của GitHub Actions đổi mỗi lần build -> Android báo xung đột chữ ký. Khóa này không bảo mật (repo công khai) —
    // chỉ dùng cài thủ công; muốn bảo mật/đưa lên Play Store thì tạo keystore riêng và để trong GitHub Secrets.
    signingConfigs {
        getByName("debug") {
            storeFile = file("keystore/viettat-debug.jks"); storePassword = "duyencrm2026"
            keyAlias = "duyencrm"; keyPassword = "duyencrm2026"
        }
    }
    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.core:core-ktx:1.13.1")
}
