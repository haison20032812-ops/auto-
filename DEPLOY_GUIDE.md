# HƯỚNG DẪN TRIỂN KHAI ONLINE (VERCEL & RENDER)

Dự án này đã được tối ưu hóa để triển khai chạy online hoàn toàn miễn phí 24/7. Dưới đây là các bước cụ thể:

---

## BƯỚC 1: KHỞI TẠO MONGODB ATLAS (DATABASE CLOUD)
1. Đăng ký tài khoản miễn phí tại [MongoDB Atlas](https://www.mongodb.com/).
2. Tạo một Cluster mới (chọn gói **M0 FREE**).
3. Thiết lập bảo mật:
   - **Database Access**: Tạo 1 user (ví dụ: `admin`) kèm mật khẩu.
   - **Network Access**: Thêm địa chỉ IP `0.0.0.0/0` (để Render có thể truy cập được).
4. Lấy chuỗi kết nối (Connection String):
   - Chọn **Connect** -> **Drivers** -> Copy chuỗi kết nối dạng:
     `mongodb+srv://admin:<password>@cluster0.xxxx.mongodb.net/wp_publisher?retryWrites=true&w=majority`
   - Thay `<password>` bằng mật khẩu của user bạn vừa tạo.

---

## BƯỚC 2: DEPLOY BACKEND LÊN RENDER
1. Đăng nhập [Render.com](https://render.com/) bằng tài khoản GitHub của bạn.
2. Bấm **New +** -> **Web Service**.
3. Kết nối với repository GitHub `auto-`.
4. Điền các cấu hình:
   - **Name**: `wordpress-publisher-api` (tùy chọn)
   - **Region**: Chọn khu vực gần nhất (ví dụ: Singapore / Oregon)
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Chọn **Advanced** -> **Add Environment Variable**:
   - Key: `MONGODB_URI`
   - Value: *Điền chuỗi kết nối MongoDB Atlas ở Bước 1*.
6. Bấm **Deploy Web Service**.
7. Đợi Render deploy xong, hãy copy đường dẫn URL backend ở góc trên cùng bên trái giao diện Render (ví dụ: `https://wordpress-publisher-api.onrender.com`).

---

## BƯỚC 3: DEPLOY FRONTEND LÊN VERCEL
1. Đăng nhập [Vercel.com](https://vercel.com/) bằng tài khoản GitHub.
2. Bấm **Add New** -> **Project**.
3. Import repository `auto-`.
4. Điền cấu hình:
   - **Root Directory**: Chọn thư mục `client`.
   - **Framework Preset**: Chọn `Vite` (Vercel tự nhận diện).
5. Mở phần **Environment Variables** -> Thêm biến:
   - Key: `VITE_API_URL`
   - Value: *Điền URL backend của Render bạn vừa lấy ở Bước 2* (ví dụ: `https://wordpress-publisher-api.onrender.com`).
6. Bấm **Deploy**.

Sau khi hoàn tất, Vercel sẽ cấp cho bạn đường dẫn truy cập website trực tuyến chính thức của bạn!
