# Baby Feed 🍼

Webapp mobile-first (PWA) cho gia đình ghi lại cữ ăn, ngủ, thay tã của bé.
Dữ liệu lưu trên **Google Sheet** qua **Google Apps Script**, đăng nhập bằng **Google**.

```
apps-script/   Code.gs + appsscript.json: API dán vào Apps Script của Google Sheet
web/           Vite + React + TypeScript + Tailwind + PWA (Dexie cho offline)
docs/PLAN.md   Kiến trúc, schema, roadmap
docs/SETUP.md  Hướng dẫn tạo Sheet, OAuth Client ID, deploy từng bước
```

## Chạy nhanh (chế độ demo, không cần Google)

```bash
cd web
npm install
npm run dev
```

Mở <http://localhost:5173>, bấm **Vào chế độ demo**.

## Kết nối Google Sheet thật

Làm theo [docs/SETUP.md](docs/SETUP.md), sau đó tạo `web/.env`:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxx/exec
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

## Scripts (`web/`)

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server (mở được từ điện thoại cùng Wi-Fi) |
| `npm run build` | Type-check + build production (kèm service worker) |
| `npm run preview` | Xem bản build |
| `npm run lint` | oxlint |
| `npm run icons` | Tạo lại icon PWA từ `public/favicon.svg` |
