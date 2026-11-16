# Hướng dẫn cài đặt (Google Sheet + Apps Script + Google Login)

Làm một lần, mất khoảng 15 phút.

## 1. Tạo Google Sheet + Apps Script

1. Tạo một Google Sheet mới, đặt tên ví dụ **Baby Feed DB**.
2. Menu **Extensions → Apps Script**.
3. Xoá nội dung `Code.gs` mặc định, dán toàn bộ file [`apps-script/Code.gs`](../apps-script/Code.gs).
4. Bật hiển thị manifest: ⚙️ **Project Settings → Show "appsscript.json" manifest file in editor**,
   rồi thay nội dung `appsscript.json` bằng file [`apps-script/appsscript.json`](../apps-script/appsscript.json).
5. Chọn hàm `setup` trên thanh công cụ → **Run** → cấp quyền khi được hỏi.
   - Hàm này tạo 4 tab: `events`, `babies`, `members`, `sessions`.
   - Tự thêm email của bạn vào `members` với quyền `admin`, và một bé mặc định `b1`.

## 2. Tạo OAuth Client ID (Google Cloud Console)

1. Vào <https://console.cloud.google.com/> → tạo project mới (vd. `baby-feed`).
2. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type: **External**, điền tên app và email hỗ trợ.
   - Scopes: chỉ cần `openid`, `email`, `profile` (không nhạy cảm, không cần Google duyệt).
   - Bấm **Publish app** (hoặc để Testing và thêm email người nhà vào *Test users*).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `https://<domain-production>` (vd. `https://baby-feed.vercel.app`)
   - Không cần Redirect URI.
4. Copy **Client ID** (dạng `xxxx.apps.googleusercontent.com`).

## 3. Cấu hình và deploy Apps Script

1. Trong Apps Script: ⚙️ **Project Settings → Script Properties → Add property**
   - `CLIENT_ID` = Client ID vừa copy.
2. **Deploy → New deployment → Select type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Bấm Deploy → copy **Web app URL** (kết thúc bằng `/exec`).

> "Anyone" chỉ có nghĩa là URL gọi được. Mọi request đều phải có session token hợp lệ.
> Token chỉ được cấp cho email nằm trong tab `members` với `active = TRUE`.

**Khi sửa `Code.gs`**: vào **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
Làm vậy thì URL được giữ nguyên. Nếu tạo deployment mới, URL sẽ đổi.

## 4. Thêm người nhà

Mở tab `members`, thêm mỗi người một dòng:

| email | display_name | role | active |
|---|---|---|---|
| me@gmail.com | Mẹ | admin | TRUE |
| ba@gmail.com | Bà | member | TRUE |

- `admin`: sửa được thông tin bé trong app.
- Muốn thu hồi quyền: đặt `active = FALSE`. Có hiệu lực tối đa sau 5 phút (do cache).
- Người nhà **không cần** được share Google Sheet.

## 5. Chạy frontend

```bash
cd web
cp .env.example .env
# điền VITE_APPS_SCRIPT_URL và VITE_GOOGLE_CLIENT_ID
npm install
npm run dev        # http://localhost:5173
```

Để trống `VITE_APPS_SCRIPT_URL` thì app chạy **chế độ demo** (server giả lập trong localStorage), tiện cho việc phát triển UI.

### Thử trên điện thoại

- `npm run dev` có in địa chỉ LAN (vd. `http://192.168.1.10:5173`). Google Sign-In **không** chạy trên địa chỉ IP qua http,
  nên với IP LAN chỉ test được chế độ demo. Muốn test đăng nhập thật, deploy lên Vercel/Netlify
  (https) hoặc dùng tunnel https (vd. `cloudflared tunnel --url http://localhost:5173`), rồi thêm domain đó vào *Authorized JavaScript origins*.

## 6. Deploy production (Vercel)

1. Import repo vào Vercel, **Root Directory = `web`**, Framework = Vite.
2. Thêm Environment Variables `VITE_APPS_SCRIPT_URL`, `VITE_GOOGLE_CLIENT_ID`.
3. Thêm domain Vercel vào *Authorized JavaScript origins* của OAuth client.
4. Trên iPhone: mở bằng Safari → nút Chia sẻ → **Thêm vào MH chính**.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân / cách sửa |
|---|---|
| Nút Google báo `origin_mismatch` | Domain chưa có trong *Authorized JavaScript origins* (có thể mất vài phút để có hiệu lực) |
| "chưa được thêm vào danh sách gia đình" | Thêm email vào tab `members`, `active = TRUE` |
| `Script Property CLIENT_ID is not set` | Làm bước 3.1 |
| `Missing sheet "events"` | Chạy hàm `setup()` |
| Sửa code nhưng API không đổi | Phải deploy **New version** (xem mục 3) |
