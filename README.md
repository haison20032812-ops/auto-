# WordPress Auto-Publisher Pro (Qwen + ChatGPT)

Hệ thống viết bài tự động hàng loạt và đăng tải đa kênh (Multi-site) bằng sự kết hợp giữa **Alibaba Qwen** (Nghiên cứu SEO & Viết nội dung chất lượng cao) + **OpenAI ChatGPT / DALL-E 3** (Thiết kế ảnh đại diện nổi bật) và tự động đăng tải lên hàng loạt website **WordPress** cùng lúc thông qua giao diện Web Dashboard trực quan và hiện đại.

---

## ✨ Tính Năng Nổi Bật

1. **Quản lý đa kênh (Multi-site)**:
   - Cho phép thêm, lưu trữ, kiểm tra kết nối (Test Connection) và xóa nhiều trang web WordPress khác nhau.
   - Hỗ trợ chọn nhanh các website mục tiêu bằng checkbox để đăng bài đồng thời.
2. **Đăng bài hàng loạt (Bulk Posting)**:
   - Nhập danh sách chủ đề bài viết cần tạo (mỗi dòng một chủ đề).
   - Hệ thống tự động lặp, viết bài viết chi tiết (>1000 từ) và đăng lần lượt.
3. **Tải & Đăng hình ảnh cục bộ (Cross-posting Images)**:
   - Tạo hình ảnh đại diện (Featured Image) bằng DALL-E 3, tự động chuyển đổi sang hình ảnh chất lượng cao từ Unsplash nếu tài khoản OpenAI hết hạn/hết lượt.
   - Quét toàn bộ ảnh minh họa chèn trong bài viết (Inline Images), tự động tải và upload lên thư viện Media của từng website riêng biệt, thay thế liên kết tương ứng trong HTML bài viết để đảm bảo ảnh hoạt động vĩnh viễn trên website mục tiêu.
4. **Tự động phân loại chuyên mục**:
   - Tự động quét và tìm chuyên mục `Tin tức` (hoặc `News`) trên từng website.
   - Nếu không tìm thấy, hệ thống tự động tạo mới chuyên mục `Tin tức` và gán bài viết vào đó.
5. **Bảng tiến độ trực quan (Progress Grid)**:
   - Giao diện trực quan hiển thị ma trận trạng thái thực tế của từng bài viết trên từng website (Chờ xử lý, Đang viết bài, Đang đăng bài, Hoàn thành có kèm link xem bài viết, Lỗi chi tiết).
   - Console log kỹ thuật hiển thị thời gian thực phía bên dưới.

---

## 🚀 Hướng Dẫn Khởi Động Ứng Dụng

### Bước 1: Khởi động Backend Server
1. Di chuyển tới thư mục:
   `C:\Users\admin\.gemini\antigravity\scratch\wordpress-auto-publisher\server`
2. Khởi động backend server:
   ```bash
   npm start
   ```
   *Mặc định backend sẽ chạy tại cổng `http://localhost:5000`.*

### Bước 2: Khởi động Frontend Client
1. Di chuyển tới thư mục:
   `C:\Users\admin\.gemini\antigravity\scratch\wordpress-auto-publisher\client`
2. Khởi động giao diện web:
   ```bash
   npm run dev
   ```
3. Truy cập đường dẫn hiển thị trên màn hình (thường là `http://localhost:5173`) để mở Web Dashboard.

---

## 🔑 Hướng Dẫn Cấu Hình WordPress REST API

Để công cụ có thể đăng bài lên WordPress của bạn, bạn cần lấy **Mật khẩu ứng dụng (Application Password)** từ WordPress:

1. Đăng nhập vào trang quản trị WordPress của bạn (ví dụ: `https://myblog.com/wp-admin`).
2. Vào mục **Thành viên** -> **Hồ sơ của bạn** (Users -> Profile).
3. Kéo xuống phần **Mật khẩu ứng dụng** (Application Passwords).
4. Nhập tên ứng dụng (ví dụ: `Auto-Publisher`) và bấm **Thêm mật khẩu ứng dụng mới** (Add New Application Password).
5. WordPress sẽ tạo một mật khẩu gồm 24 ký tự có dạng: `xxxx xxxx xxxx xxxx xxxx xxxx`.
6. Sao chép chuỗi mật khẩu này và dán vào trường **Mật khẩu ứng dụng (Application Password)** trên giao diện Web, nhập **Tài khoản đăng nhập (Username)** tương ứng của bạn và **URL website** (ví dụ: `https://myblog.com`).

*Lưu ý: WordPress yêu cầu trang web phải sử dụng HTTPS để REST API hoạt động an toàn.*
