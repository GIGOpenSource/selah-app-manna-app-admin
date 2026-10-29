# Manna Mobile（uni-app）

独立客户端工程，与 Selah `mobile/` **禁止双向污染业务页**。

- `config/config.js` → `APP_KEY = 'manna'`
- 请求头：`token` + `X-App-Key: manna` + `X-Platform`
- Tab：**Home / Quiz / Devotion / Bible / Me**
- 共用服务端：`backend`；运营台：`frontend/admin`
- 页面地图与规范：[`Doc/前端维护文档.md`](../../Doc/前端维护文档.md) §3
- 币规则：[`Doc/Manna币方案.md`](../../Doc/Manna币方案.md)（答题页右上角为**实时预览**，`finish` 才入账）

## 本地

```bash
cd frontend/mobile-manna
npm install
npm run dev:h5   # 默认端口 5175
```

后端需已启动（默认 `http://127.0.0.1:8000/api`）。种子：`backend/scripts/seed_manna.py --covers`。

## 结构

| 路径 | 说明 |
| --- | --- |
| `pages/` | 5 个 Tab |
| `pagesA/` | 分包：答题 / 祷告 / 听经 / Me 子页等（`pages.json` 为准，约 32 路由） |
| `utils/homeBg.js` | 首页日夜间背景池 |
| `static/bootstrap/` | 冷启快照（`export_manna_bootstrap.py`） |
| `docs/figma-frame-map.md` | 贴稿对照 |
