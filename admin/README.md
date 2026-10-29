# Selah 运营后台

Vue 3 + Vite + Pinia + Element Plus 的 Web 运营台，对接后端 `/api/admin-ops/`。

本地开发见仓库根 [`README.md`](../../README.md) 与 [`SELAH_DEV.md`](../../SELAH_DEV.md)。

---

## 快速启动

```bash
cd frontend/admin
npm install
npm run dev
# http://localhost:5173  （vite 代理 /api → 后端 8000）
```

默认运营账号：`selah_admin` / `SelahAdmin123!`（`super_admin`）。

---

## 目录结构

```
admin/
├── README.md
├── package.json
├── vite.config.js          # dev 代理 /api
└── src/
    ├── main.js             # 入口：Pinia + Router + Element Plus
    ├── App.vue
    ├── api/index.js        # Axios 封装 + 全部运营 API
    ├── router/index.js     # 路由 + token / perm 守卫
    ├── store/
    │   ├── auth.js         # 登录态、角色、权限码
    │   ├── tabs.js         # 多标签页
    │   └── sidebar.js      # 侧栏折叠与主题
    ├── components/
    │   ├── menu.js         # 菜单树 + filterMenuByPerms
    │   ├── Sidebar.vue
    │   ├── Header.vue
    │   ├── Tabs.vue
    │   └── ScopeFilter.vue # 语言 × 平台配置作用域
    ├── utils/pageCache.js
    └── views/              # 业务页（见下表）
```

---

## 菜单分区与权限

| 分区 | 页面 | 权限码 `meta.perm` |
| --- | --- | --- |
| 数据看板 | Dashboard | `ops` |
| 内容 | 语录 / 冷启池 / 主题 / 壁纸 / 内容举报 | `content` |
| 运营配置 | AI Provider / 签到额度 / 其他配置 / Onboarding / 安全词热线 / 安全审计 / AI 开场 | `ops` |
| 会员经营 | 会员商品 / 订单 | `ops` |
| 用户管理 | App 用户 / 后台用户 / 权限 | `app_users` / `staff` / `permissions` |

角色默认权限：`operator` ≈ 内容+运营+App用户；`admin` 另含后台用户；`super_admin` 全部。

登录仅记住账号，不存密码。Token 存在 `localStorage.admin_token`，请求头字段为 `token`。

---

## 关键约定

- 统一 `baseURL: '/api'`，业务成功码 `200` / `201`
- 配置类接口普遍带 `language` × `platform` 作用域（空 = 全部）
- 看板筛选：语言 / 国家 / 时间 / ios|android
- 成交与 ARPPU 依赖会员商品 `price_cents`（分）；试用记 0

---

## 页面一览

| 文件 | 用途 |
| --- | --- |
| `Login.vue` | 员工登录 |
| `Layout.vue` | 壳：侧栏 + 顶栏 + 多 Tab |
| `Dashboard.vue` | DAU/留存/充值/事件等看板 |
| `Quotes.vue` | 语录 CRUD / Excel·CSV 导入 |
| `ColdStart.vue` | 冷启池 + 70/30 比例配置 |
| `Topics.vue` / `Wallpapers.vue` | 主题 / 壁纸 |
| `ContentReports.vue` | 内容举报处理 |
| `AiProvider.vue` | AI 模型、系统 Prompt、API Base/Key |
| `Rewards.vue` | 签到爱心 / 新人额度 / Free 上限 |
| `Configs.vue` | 其余键值配置 |
| `Onboarding.vue` | 引导题 |
| `Safety.vue` / `SafetyAudits.vue` | 安全词·热线 / 审计 |
| `QuickPrompts.vue` | AI 开场句 |
| `MembershipProducts.vue` | 商店 SKU ↔ App plans |
| `Orders.vue` | IAP 订单状态 |
| `AppUsers.vue` / `StaffUsers.vue` / `Permissions.vue` | 用户与 RBAC |

---

> 最后更新：2026-08-07
