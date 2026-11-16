# Baby Feed: Plan

Webapp mobile-first (PWA) cho **gia đình** ghi lại cữ ăn, ngủ, thay tã của bé.
Database là **Google Sheet**, API là **Google Apps Script**, đăng nhập bằng **Google**.

## 1. Tham khảo

| App | Học được gì |
|---|---|
| Huckleberry | Màn hình chính tối giản, gợi ý giờ ăn/ngủ tiếp theo |
| Baby Tracker (Nighp) | Bấm giờ bú trái/phải, timeline theo ngày |
| Glow Baby | Nhiều người chăm dùng chung dữ liệu |
| Baby Daybook | Ghi lại trong 1–2 lần chạm, dark mode |
| Sprout / Nara Baby | Thống kê ngày/tuần |

Nguyên tắc:
- Ghi nhanh trong 1–2 lần chạm.
- Luôn thấy "Lần ăn cuối … trước".
- Timer lưu theo timestamp.
- Có dark mode cho ban đêm.
- Cả nhà dùng chung một nguồn dữ liệu.

## 2. Kiến trúc

```
[PWA React (Vite)]
   │  IndexedDB (Dexie): cache + hàng đợi offline, optimistic UI
   │  POST text/plain JSON  { action, token, ... }
   ▼
[Apps Script Web App]  Execute as: Me · Access: Anyone
   │  xác thực session token → whitelist `members`
   │  LockService khi ghi
   ▼
[Google Sheet]  events · babies · members · sessions
```

### Xác thực

1. Frontend dùng Google Identity Services để lấy **ID token**.
2. Gọi `login`. Apps Script xác minh token qua `oauth2.googleapis.com/tokeninfo`:
   - `aud == CLIENT_ID`
   - `email_verified == true`
   - email có trong `members` và `active = TRUE`
3. Apps Script cấp **session token** ngẫu nhiên, hạn 30 ngày. Sheet chỉ lưu SHA-256 của token.
4. Mọi request sau đó gửi kèm token. Kết quả xác thực được cache 5 phút bằng CacheService.
5. `created_by` / `updated_by` do server điền, client không gửi lên được.

### Đồng bộ

- Ghi local trước (`dirty = 1`, tăng `rev`), sau đó đẩy lên ở nền (`upsert`).
- Kéo về tăng dần bằng `list since=<serverTime>`, có 2 phút chồng lấn để không sót bản ghi.
- Không ghi đè bản ghi local đã sửa sau lần đẩy (so sánh `rev`).
- Gặp xung đột thì bản ghi sau cùng thắng. Xoá là xoá mềm (`deleted = TRUE`).
- Đồng bộ khi: mở app, mỗi 60s, khi có mạng trở lại, khi app quay lại foreground, và 0.8s sau mỗi lần ghi.

## 3. Cấu trúc Sheet

**events**:
`id, baby_id, type, start_at, end_at, side, left_sec, right_sec, amount_ml, milk_type, diaper, note, created_by, updated_by, created_at, updated_at, deleted`

Giá trị cho phép:
- `type`: breast | bottle | pump | diaper | sleep
- `side`: L | R | both
- `milk_type`: breast | formula
- `diaper`: wet | dirty | both

**Các tab khác:**
- **babies**: `id, name, birth_date, gender, updated_at`
- **members**: `email, display_name, role (admin|member), active`
- **sessions**: `token_hash, email, created_at, expires_at, user_agent`

## 4. API (Apps Script)

| action | Tham số | Trả về |
|---|---|---|
| `login` | `idToken` | `token, user, expiresAt` |
| `me` | `token` | `user, babies` |
| `list` | `token, since?` | `events, serverTime` |
| `upsert` | `token, events[]` | `events, serverTime` |
| `saveBaby` | `token, baby` (admin) | `babies` |
| `logout` | `token` | `ok` |

Mã lỗi: `UNAUTHORIZED`, `INVALID_TOKEN`, `NOT_MEMBER`, `FORBIDDEN`, `BAD_REQUEST`, `SERVER_ERROR`.

## 5. Tính năng & tiến độ

### Giai đoạn 1–2: MVP ✅ (đã code)

- [x] Đăng nhập Google, whitelist `members`, session 30 ngày.
- [x] Bú mẹ: bấm giờ trái/phải (tạm dừng, chuyển bên), hoặc nhập tay.
- [x] Bình sữa (ml, sữa mẹ/công thức), hút sữa (ml, bên).
- [x] Thay tã (ướt/bẩn/cả hai), ngủ (bấm giờ hoặc nhập tay).
- [x] Trang chủ:
  - [x] Lần ăn cuối và gợi ý cữ tiếp theo.
  - [x] Tổng kết hôm nay.
  - [x] Nút ghi nhanh.
- [x] Nhật ký theo ngày, sửa/xoá.
- [x] Thống kê 7 ngày.
- [x] Offline-first + PWA (cài lên màn hình chính), dark mode, safe-area.
- [x] Hiển thị ai đã ghi ("bởi …"), trạng thái đồng bộ.
- [x] Chế độ demo khi chưa cấu hình Apps Script.

### Giai đoạn 3

- [ ] Timer dùng chung giữa các máy: lưu sự kiện đang chạy với `end_at` rỗng.
- [ ] Nhiều bé (chọn bé đang xem).
- [ ] Quản lý `members` ngay trong app (admin).
- [ ] Biểu đồ đẹp hơn (Recharts), so sánh theo tuần.

### Giai đoạn 4

- [ ] Nhắc cữ tiếp theo bằng Web Push. iOS 16.4+ hỗ trợ khi app đã cài lên màn hình chính; cần thêm time-based trigger trong Apps Script.
- [ ] Theo dõi cân nặng/chiều cao (tab `growth`), biểu đồ percentile WHO.
- [ ] Xuất CSV/PDF gửi bác sĩ.

## 6. Giới hạn đã biết

- Mỗi request Apps Script mất ~1–2s. Đã giảm ảnh hưởng nhờ optimistic UI và đồng bộ ở nền.
- `list` đọc toàn bộ tab `events`. Ổn với vài chục nghìn dòng (nhiều năm dữ liệu của một gia đình).
- Timer đang chạy chỉ thấy trên máy đã bấm cho đến khi lưu (xem giai đoạn 3).
- Thu hồi quyền một member có hiệu lực sau tối đa 5 phút (do cache).
