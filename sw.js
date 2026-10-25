// Service worker TỐI THIỂU để trình duyệt cho "Cài đặt ứng dụng" (PWA). KHÔNG cache gì cả: CRM luôn lấy bản mới nhất từ mạng
// (tránh kẹt bản cũ sau khi deploy). Chỉ làm mới khi có phiên bản sw mới.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* để trình duyệt tự tải từ mạng */ });
