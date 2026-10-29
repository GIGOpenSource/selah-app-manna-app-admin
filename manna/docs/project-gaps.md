# mobile-manna 缺失与待办清单

对照：[figma-frame-map.md](./figma-frame-map.md) · 审计日 2026-08-14

**总览：** 路由骨架与后端契约完整；演示数据经 **灌库 → Admin/API → 客户端** 联通。P0 / Scope A / P2 / P3·P4、INT 批次、币/徽章/首页背景池已落地。**人工验收勾选以 [Doc/Manna测试清单.md](../../../Doc/Manna测试清单.md) 为准。** 下文仅为仍开放的非阻塞项。

---

## 未处理清单（开放项）

### A. UI 贴稿未齐（`偏`）

无。Home / Bible 主壳 / versecard 已贴齐（见 frame-map）。

无稿自拟（非阻塞）：Welcome / Login / Settings / Legal。

### B. 产品功能（多数已完成）

| 项 | 现状 | 说明 |
|----|------|------|
| VIP 页 | done：`pagesA/vip/vip` | 失败软降 `me_vip_soon` |
| Interstitial 夹层 | done：`pagesA/interstitial/interstitial` | 冷启可走 `personalize_intro`（CMS 有问卷时） |
| 祷告分享 | toast `share_soon` | 可接 `apiMannaSharePayload` + `share.js` |
| 听经定时 / 下载 / Voice | done | 见 listen 页 |
| Admin CMS | done | Testimonies / Tags / StatsCopies / Ledger |

### C. API 可选接线（非阻塞）

| API | 现状 | 建议 |
|-----|------|------|
| `apiQuizResult` | 结果页主要用 finish 的 query | 可选进 result 刷新 |
| `apiDevotionProgress` | 未调 | 列表进度聚合时再接 |
| `apiMannaStoryCards` | Me 故事走 quiz stories | 若要独立「故事卡」Tab 再接 |
| `apiMannaTestimonies` | Home testimony 卡仅切 Me | 独立证言阅读页仍缺 |
| `apiBibleTags` | 未用 | 标签筛选时再接 |

Onboarding：**非永远跳过**。后端有启用问卷且用户未 complete/skip 时走 `pagesA/onboarding/onboarding`。

### D. 内容 / 运维（非代码缺口）

| 项 | 说明 |
|----|------|
| 圣经全文 / 全量音频 | 种子默认核心章；需 `seed_manna.py --full` 或 `MANNA_BIBLE_FULL=1` + `BIBLE_AUDIO_ROOT` |
| Admin Placeholder | 无菜单死页，可删路由（可选清理） |

### E. 明确不做（勿再开坑）

- 用客户端 `DEMO_*` / `quizDemo` 当演示主路径（仅网络失败 catch 可 soft demo）  
- 用 Django fixtures 替代 `seed_manna.py`  

---

## 登录独立（已完成）

Manna 登录代码在 `mobile-manna` 内独立维护（fork Selah 流程，不共享前端包）。

| 维度 | 实现 |
|------|------|
| APP 名 | `APP_KEY=manna`；`X-App-Key` + `device-login`/`oauth-login` 的 `app_key` |
| 设备账号 | `manna_device_id`，值前缀 `manna-`；与 Selah `selah_device_id` 隔离 |
| 页缓存 | `manna_page_cache:` 前缀 |
| Welcome | Admin `WelcomeScreen` × app×语言×设备；客户端用 CMS 文案/图 |
| Login 文案 | AppConfig `login_title` / `login_subtitle`（白名单已暴露）；i18n 回落 |
| 后端同机多 App | 设备登录按 `(device_id, app_key)` 建新 uid，不 409、不改绑；OAuth 三方 ID 仍全局唯一 |
| 包内快照 | **仅** `export_manna_bootstrap.py` → `mobile-manna/static/bootstrap`（勿用 Selah 导出脚本/目录） |

**改展示：** Admin → Welcome / 配置（Scope=`manna` + 语言/设备）→ 客户端刷新；发版前重导 Manna bootstrap。

---

## 演示数据（真源 = 数据库）

```text
seed_manna.py (--covers)
    → DB (app_key=manna；language/platform 默认可空=全端)
    → Admin「Manna 内容」Scope(App名×语言×设备) 可查可改
    → /api/manna|quiz|bible|devotion|…
    → mobile-manna（X-App-Key / Accept-Language / X-Platform）
```

**灌库：**

```bash
cd backend
./uivsbe_env/bin/python scripts/seed_manna.py --covers
# 可选：--full / MANNA_BIBLE_FULL=1
```

**写入内容（节选）：** WelcomeScreen + login_title/subtitle、DailyVerse、PrayerContent（晨/晚）、DevotionSeries+Session、Quiz L1–L5+题目、Stories、BadgeDef、HomeCards、Bible 核心章；另有 `language=zh`×`platform=ios` 对照经文/晨祷行。

**Admin：** 8 个内容页已 `mode="browse"` + `browseScopeParams`；列表含 App名/语言/设备。Rules 仍用 exact。Welcome / AppConfig 按 Scope=`manna` 维护冷启与登录文案。

**验收：** Admin 改一条今日经文/祷告 → 客户端刷新应变；停后端时才可能出现本地 fallback。改 Welcome / `login_title` 后端上可见（或重导 bootstrap）。

**客户端策略：** HTTP 200 且空 → i18n 空态；仅 catch/网络失败可用 `quizDemo`/`bibleDemo`/页内 DEMO。

**H5 QA：** `App.vue` 默认 `debug_x_platform=ios`，便于命中带 platform 的库内行。

**发版 bootstrap（Manna 专用，勿与 Selah 混用）：**

```bash
cd backend
./uivsbe_env/bin/python scripts/export_manna_bootstrap.py
# 或：cd ../frontend/mobile-manna && npm run export:bootstrap
```

---

## 已完成（摘要）

| 块 | 状态 |
|----|------|
| P0 B1/B2/B3 | done |
| Admin Scope A（8 页 browse） | done |
| 演示灌库 + zh/ios 对照行 | done |
| P2 空态 / demo 降级 | done |
| P3 徽章 + Quiz Stories 入口 | done |
| P4 笔记/Amen/译本/日历日/祷告收藏/ActivityPing | done |
| 登录独立（APP×语言×设备 Welcome/Login） | done |
| 多数 Figma 帧标齐 | 见 frame-map（主路径帧均齐） |
| 首页日夜间背景池 | `utils/homeBg.js` + `static/ui/home/bgs` |
| Quiz play 实时预览余额 | 逐题 +10 / 首错 −10；`finish` 入账 |

---

## 验收清单

正式勾选见 [`Doc/Manna测试清单.md`](../../../Doc/Manna测试清单.md)。本表仅作工程自检提纲。

- [ ] Home 今日经文来自 API（与 Admin 今日经文一致）
- [ ] Quiz：levels → start → play（答对绿/答错 terra）→ finish → result
- [ ] Stories：列表/解锁/学习 → done → Test Now（需 `linked_level_id`）
- [ ] Devotion：列表 → 详情 → 课节完成（数字 id）
- [ ] Bible：章文 + 长按高亮/笔记/Amen + 译本切换 + 听经
- [ ] Prayer 晨/晚 + Amen + 收藏
- [ ] Me：统计/徽章/日历日详情/收藏
- [ ] Legal Help 热线（`apiHotlines`）
- [ ] Admin Scope=`manna` 能浏览种子行；改文案端上可见
