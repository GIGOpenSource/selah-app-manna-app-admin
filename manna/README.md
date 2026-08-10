# Manna Mobile（uni-app）

独立客户端工程，与 Selah `mobile/` **禁止双向污染业务页**。

- `config/config.js` → `APP_KEY = 'manna'`
- 请求头：`token` + `X-App-Key: manna` + `X-Platform`
- Tab：Home / Quiz / Devotion / Bible / Me
- 共用服务端：`fast_base/backend`；运营台：`frontend/admin`

## 本地

```bash
cd fast_base/frontend/mobile-manna
npm install
npm run dev:h5   # 默认端口 5175
```

后端需已启动（默认 `http://127.0.0.1:8000/api`）。

## Phase 0 AC

- [x] H5 能启动
- [x] device-login 通（`app_key=manna`）
- [x] 5 Tab 可切换占位页
