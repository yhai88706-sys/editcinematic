========================================
📦 TỔNG QUAN DỰ ÁN
========================================
Tên dự án: **Cafe Order System**

Mô tả ngắn:
> Hệ thống web order cho quán cafe bán mang đi hoặc phục vụ tại bàn, chạy hoàn toàn offline (JSON Server + file HTML/JS).  
> Có giao diện riêng cho khách/thu ngân (order), nhân viên (staff), và quản lý (manager).

Công nghệ:
- HTML5 / CSS3 / JavaScript thuần
- JSON Server (mock backend)
- Responsive (tablet/mobile)
- Không cần framework hoặc database thật

========================================
🧩 DANH SÁCH TÍNH NĂNG HIỆN CÓ
========================================

### 🍵 1. Giao diện Order (index.html)
- Chọn loại đơn: **Mang đi** hoặc **Tại bàn (nhập số bàn)**
- Xem menu, lọc theo danh mục: Cà phê / Trà / Đá xay / Bánh / ⭐ Bán chạy
- Tìm kiếm món bằng tên
- Chọn size, đá, đường, ghi chú riêng cho từng món
- Giỏ hàng hiển thị rõ ràng, có tạm tính và tổng tiền
- Ghi chú chung cho đơn hàng
- Gửi đơn lên hệ thống (POST /orders)
- Chống **double click / double order**
- Hiển thị popup **thành công / lỗi / cảnh báo** bằng hàm `showMessage(type, text)`
- Tự động tạo mã đơn theo chuẩn:  
  `NB-YYYYMMDD-HHMMSS-XXX`
- Lưu **giỏ hàng tạm thời** vào `localStorage` (tránh mất khi reload)

---

### 👩‍🍳 2. Màn hình Nhân viên (staff.html)
- Hiển thị **đơn hàng hôm nay**
- Lọc theo trạng thái: All / New / Making / Done
- Chỉ được phép:
  - new → making
  - making → done
- Không được huỷ đơn hoặc sửa menu
- Auto refresh mỗi 8 giây (CONFIG.REFRESH_INTERVAL_MS)
- Âm thanh “bíp” khi có đơn mới
- Màu trạng thái rõ ràng:
  - 🟦 new  
  - 🟨 making  
  - 🟩 done  
  - ⬜ cancelled
- Giao diện tối ưu tablet (layout 2 cột, nút to dễ bấm)

---

### 🧑‍💼 3. Màn hình Quản lý (manager.html)
- Có **PIN đăng nhập** (CONFIG.MANAGER_PIN)
- Xem tất cả đơn hoặc chỉ đơn “hôm nay”
- Lọc theo trạng thái
- Đổi trạng thái đơn, bao gồm huỷ (`cancelled`)
- Quản lý menu:
  - Thêm / Sửa / Xoá sản phẩm
  - Ẩn / hiện món (`isActive`)
- Thống kê nhanh:
  - Tổng đơn hôm nay
  - Doanh thu (tổng đơn != cancelled)
- Khu vực **Debug ẩn (Ctrl+D)**:
  - Lần fetch gần nhất
  - Số đơn mỗi trạng thái
  - Cảnh báo nếu mất kết nối JSON Server

---

### 🧰 4. Các tiện ích kỹ thuật
- File `config.js` quản lý cấu hình:
  ```js
  const CONFIG = {
    API_BASE_URL: "http://localhost:4000",
    REFRESH_INTERVAL_MS: 8000,
    MANAGER_PIN: "2580",
    ENABLE_BEEP: true
  };

========================================
🧭 HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN
1️⃣ Cài đặt JSON Server
npm install -g json-server
2️⃣ Chạy server giả
json-server --watch db.json --port 4000
✅ Khi thành công, truy cập http://localhost:4000/orders
 và http://localhost:4000/products
 để kiểm tra API.
 3️⃣ Mở giao diện

Mở file index.html bằng Live Server hoặc trình duyệt.

Mở staff.html cho màn hình nhân viên.

Mở manager.html cho quản lý.
========================================
🧭 HƯỚNG DẪN SỬ DỤNG CÁC TÍNH NĂNG
📱 Trang Order (index.html)

Chọn Mang đi hoặc Tại bàn (nhập số bàn).

Chọn món → Tuỳ chỉnh size/đá/đường → Thêm vào giỏ.

Xem giỏ hàng, nhập ghi chú chung.

Bấm “Xác nhận Order”.

Popup hiển thị mã đơn và tổng tiền → đơn gửi sang hệ thống.

⚠ Nếu mất mạng hoặc server tắt, bạn sẽ thấy cảnh báo: “Không kết nối được máy chủ.”

👩‍🍳 Trang Nhân viên (staff.html)

Mặc định chỉ xem đơn hôm nay.

Lọc trạng thái bằng menu trên đầu.

Khi có đơn mới → màn hình tự refresh + phát tiếng bíp.

Click đơn để xem chi tiết → bấm đổi trạng thái:

“Đang pha” → “Hoàn thành”.

Không có nút huỷ hoặc chỉnh sửa menu.

🔔 Nếu 30 giây không thấy đơn mới, hãy kiểm tra lại JSON Server.

🧑‍💼 Trang Quản lý (manager.html)

Nhập PIN (mặc định 2580).

Xem danh sách tất cả đơn hoặc lọc “Hôm nay”.

Đổi trạng thái đơn:

new → making → done → cancelled.

Quản lý menu (thêm/sửa/xoá món).

Bấm Ctrl + D để mở khu Debug:

Hiện trạng hệ thống, thống kê trạng thái, cảnh báo kết nối.
