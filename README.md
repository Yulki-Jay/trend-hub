# TrendHub · 资讯聚合平台

实时抓取 **GitHub Trending 热门开源项目**、主动发现尚未登榜的有趣仓库，以及 **全网热点新闻**（科技 / 经济 / 政治），
配套独立管理后台，可配置定时任务并每日向指定邮箱推送数据汇总。

---

## 一、产品需求方案 (PRD)

### 1. 产品定位
面向开发者与资讯关注者的一站式聚合平台。用户无需登录即可浏览开源热榜与实时热点，
管理员通过后台掌控抓取节奏、数据源与邮件推送。

### 2. 用户角色
| 角色 | 说明 | 入口 |
|------|------|------|
| 访客 | 浏览热榜/新闻，无需登录，不显示收藏和不感兴趣操作 | `/` 前台 |
| 注册用户 | 收藏项目/新闻/论文、管理探索偏好 | `/login` 注册或登录 |
| 管理员 | 拥有 `admin` 角色，配置数据源、定时任务、账号和邮件推送 | `/admin`（服务端权限保护）|

### 3. 核心功能
1. **GitHub Trending 抓取**：来源 `https://github.com/trending`，支持按语言、时间范围（日/周/月）抓取，记录 star、今日新增 star、fork、描述、作者。
2. **GitHub 探索推荐**：通过 GitHub Search API 建立候选池，综合项目新鲜度、活跃度、Star 增长和质量评分进行多样化推荐，并排除最近已进入 Trending 的项目。
3. **热点新闻聚合**：聚合科技、经济、政治等多分类 RSS 源，去重、清洗、分类存储。
4. **前台展示**：
   - 首页热榜与新闻双栏 / Tab 切换
   - 分类筛选、关键词搜索、时间范围切换
   - 卡片式布局，深浅色主题，响应式，加载/骨架动画
   - 用户注册登录，收藏与“不感兴趣”偏好按账号保存
5. **管理后台**：
   - 独立管理系统壳、侧边导航与移动端导航
   - 运营概览：内容规模、任务健康和最近活动
   - GitHub 运营：热榜语言、探索数量及模块级抓取
   - 新闻源与论文运营：数据源、分类、API 配额配置
   - 定时任务与邮件推送：cron、SMTP、收件人与汇总规模
   - 用户管理：角色分配、账号停用和管理员自保护
   - 管理员账号：用户名、邮箱和密码维护
6. **邮件推送**：每日定时将 Top 开源项目 + 热点新闻汇总成 HTML 邮件发送至指定邮箱。

### 4. 补充完善的实用配套功能（产品增值）
- **收藏 / 稍后读**（登录后按账号存储）
- **数据统计看板**：抓取量趋势、分类分布、热度 Top
- **RSS / JSON 输出**：平台自身对外提供聚合订阅源
- **搜索与高级筛选**：跨热榜+新闻全文检索
- **失败告警**：抓取或邮件失败时后台标红并可邮件告警
- **数据去重与归档**：历史快照，避免重复条目
- **暗黑模式 & 多语言就绪**
- **接口限流 & 简单缓存**：降低对源站压力

### 5. 非功能需求
- 端口固定 `43080`
- 单机部署，SQLite 零依赖存储
- 抓取带 UA、超时、重试，遵守源站频率
- 管理后台密码保护 + 简单会话

### 6. 技术架构
- **全栈框架**：Next.js 14 (App Router) — 前台 + API + 后台一体
- **存储**：SQLite (better-sqlite3)
- **抓取**：cheerio（HTML）+ rss-parser（RSS）
- **调度**：node-cron（进程内常驻）
- **邮件**：nodemailer (SMTP)
- **样式**：TailwindCSS

### 7. 数据模型
- `repos` GitHub 热榜项目
- `explore_repos` GitHub 探索候选池与推荐评分
- `repo_snapshots` 探索项目 Star/Fork 每日快照
- `users`、`user_sessions` 用户账号与会话
- `user_favorites`、`user_dismissals` 用户收藏和探索偏好
- `news` 新闻条目
- `sources` 新闻/数据源配置
- `settings` 全局配置（SMTP、后台密码、cron 等）
- `recipients` 邮件收件人
- `job_logs` 任务运行日志

---

## 二、快速开始

```bash
npm install
npm run init-db     # 初始化数据库与默认数据源
npm run dev         # 开发模式  http://localhost:43080
# 或
npm run build && npm start
```

默认管理员账号：用户名 `admin`，密码 `admin123`。首次登录后请在后台“管理员账号”中修改。
未登录访问 `/admin` 会跳转登录页，普通用户访问会返回首页。

## 三、环境变量（可选，后台亦可配置）
```
ADMIN_PASSWORD=admin123
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@trendhub.local
GITHUB_TOKEN=github_pat_xxx
COOKIE_SECURE=0
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=you@qq.com
SMTP_PASS=your_smtp_token
SMTP_FROM=TrendHub <you@qq.com>
```

`GITHUB_TOKEN` 可选，但推荐配置，用于提高 GitHub Search API 配额。Token 只在服务端读取，不会写入 SQLite 或返回前端；仅需公开仓库读取权限。

通过 HTTPS 部署时将 `COOKIE_SECURE` 设置为 `1`；本地 HTTP 运行保持为 `0`。
