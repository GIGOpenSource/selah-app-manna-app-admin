# Figma → mobile-manna 帧对照表

真源：[Holy Bible](https://www.figma.com/design/lgJIqZllm9nKZivnZu1BSf/Holy-Bible?node-id=38-41) · `lgJIqZllm9nKZivnZu1BSf`  
规则：
- **有稿 100% 贴稿**；无稿按 `styles/manna-theme.scss` 自拟。
- **演示数据真源是 DB**：`seed_manna.py` 灌库 → Admin/API → 客户端。本地 `quizDemo`/`DEMO_*` 仅网络失败兜底，成功空列表显示空态。

状态：`缺` 无实现 · `偏` 有页未贴齐 · `齐` 已贴稿可验收 · `自拟` 无稿

| node | 帧名 | 路由 / 实现 | 入口 | 状态 |
|------|------|-------------|------|------|
| 279:364 | Home | pages/home/home | Tab Home | 齐 2026-08-10 |
| 591:2092 | Quiz首页 | pages/quiz/quiz | Tab Quiz | 齐 2026-08-10 |
| 576:1606 | Quiz | pagesA/quiz/play | 开局 | 齐 2026-08-10 |
| 591:1809 | Quiz-答对 | play 态 | 选对 | 齐 2026-08-10 |
| 591:1912 | Quiz-答错 | play 态 | 选错 | 齐 2026-08-10 |
| 648:1339 | 结果页面-通关 | pagesA/quiz/result | finish passed | 齐 2026-08-10 |
| 655:1732 | 结果页面-失败 | pagesA/quiz/result | finish fail | 齐 2026-08-10 |
| 728:640 | Quiz-Level2 | play 同壳 | Level 2 | 齐 2026-08-10 |
| 846:1053 | 解锁圣经故事 | pagesA/quiz/story-unlock | stories 未解锁 | 齐 2026-08-10 |
| 869:1497 | Quiz-圣经故事学习 | pagesA/quiz/story-learn | 解锁后/已解锁 | 齐 2026-08-10 |
| 880:1580 | Quiz-学习结束 | pagesA/quiz/story-done | 学完 GET | 齐 2026-08-10 |
| 882:1668 | Quiz-Level3-测试学习成果 | story-done → play | Test Now | 齐 2026-08-10 |
| 664:1867 | Quiz-InBible | pagesA/quiz/in-bible | play「In Bible」 | 齐 2026-08-10 |
| 440:862 | 听经 | pagesA/bible/listen | Bible FAB / Home 听 | 齐 2026-08-10 |
| 279:453 | Devotion-List | pages/devotion/list | Tab | 齐 2026-08-10 |
| 296:2040 | Devotion-详情 | pagesA/devotion/detail | 列表 | 齐 2026-08-10 |
| 296:2250 | Devotion-课节 | pagesA/devotion/session | 课节 | 齐 2026-08-10 |
| 312:2493 | Bible | pages/bible/bible | Tab | 齐 2026-08-10 |
| 329:742 | Bible-设置字体 | bible sheet | 设置 | 齐 2026-08-10 |
| 362:451 | Bible-笔记高光 | bible 长按 | 高亮/笔记/Amen | 齐 2026-08-10 |
| 401:558 | Bible-写笔记 | bible note sheet | 笔记 | 齐 2026-08-10 |
| 397:399 | Bible-经文祷告过 | Amen 态 | Amen | 齐 2026-08-10 |
| 413:3082 | versecard | pagesA/share/versecard | 分享 | 齐 2026-08-10 |
| 540:951 | Morning prayer | pagesA/prayer/prayer | Me 祷告统计 | 齐 2026-08-10 |
| 110:1162 | Night prayer | prayer?kind=night | 更多切换 | 齐 2026-08-10 |
| 938:1978 | 个人中心 | pages/profile/profile | Tab Me | 齐 2026-08-10 |
| 989:731 | 日历 | pagesA/calendar/calendar | Me | 齐 2026-08-10 |
| 994:2328 | 收藏 | pagesA/profile/collections | Me | 齐 2026-08-10 |
| 994:2703 | 故事卡 | story-learn 卡片流 | 学习页 | 齐 2026-08-10 |
| — | Welcome/Login/Settings/Legal | pagesA/* | 启动/设置 | 自拟 |
| — | Badges | pagesA/profile/badges | Me 菜单 | 齐 2026-08-10（无独立稿） |

更新约定：每贴齐一帧将状态改为 `齐` 并注明日期。演示内容以库内数据为准，不再标「demo」作主路径。
