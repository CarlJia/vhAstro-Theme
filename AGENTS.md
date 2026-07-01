# Repository Guidelines

## 项目结构与模块组织

这是一个基于 Astro 的静态博客主题。核心源码在 `src/`：`pages/` 定义路由页面，`layouts/` 放通用布局，`components/` 放可复用 Astro 组件，`scripts/` 放浏览器端交互脚本，`styles/` 放全局 Less 样式，`utils/` 放构建与内容辅助函数。博客文章位于 `src/content/blog/`，页面数据配置位于 `src/page_data/`，站点主配置在 `src/config.ts`。静态图片、字体、第三方脚本等资源放在 `public/assets/`。部署和发文脚本位于 `script/`。

## 构建、测试与开发命令

- `pnpm install`：安装依赖，推荐使用 pnpm。
- `pnpm dev`：启动本地 Astro 开发服务器。
- `pnpm build`：生成生产静态站点，也是当前主要验证命令。
- `pnpm preview`：本地预览 `dist/` 构建结果。
- `pnpm newpost '文章标题'`：通过 `script/newpost.js` 创建新文章。
- `pnpm deploy:sftp` / `pnpm deploy:ftp`：构建并上传到对应服务器；先复制并配置 `sftp-config.example.js`。

## 编码风格与命名约定

项目使用 TypeScript、Astro 和 Less，模块为 ESM。保持现有缩进风格：配置对象和示例代码多使用制表符，Astro/TS 文件遵循就近文件格式。组件目录使用 PascalCase，例如 `src/components/Header/Header.astro` 与同名 `Header.less` 成对维护。工具函数使用 camelCase，例如 `getPostInfo.ts`。样式类名沿用现有 `vh-` 前缀和语义化命名。

## 测试与验证指南

仓库当前未配置专用测试框架或覆盖率门槛。提交前至少运行 `pnpm build`，确认 Astro 内容集合、路由和静态资源均可通过生产构建。涉及页面交互、样式或移动端布局时，再运行 `pnpm dev` 手动检查首页、文章页、归档、分类、标签、留言和友情链接等受影响页面。

## 提交与 Pull Request 指南

提交历史采用简洁的 Conventional Commit 风格，例如 `feat: 添加 Stalwart Mail 邮件服务器部署指南`、`feat(ftp): 添加ftp/sftp上传方式`。建议使用 `type(scope): 描述`，描述保持中文、聚焦用户可见变化。PR 应包含变更摘要、验证命令结果、相关 issue 或背景链接；涉及 UI、主题样式或内容展示时附截图。部署相关变更需说明配置项、环境变量或兼容性影响。

## 安全与配置提示

不要提交真实服务器凭据、Token 或私有域名配置。SFTP/FTP 请基于 `sftp-config.example.js` 创建本地配置文件，并确认其不包含敏感信息后再提交。新增外链脚本、评论服务或统计代码时，同步更新 `src/config.ts` 文档化其开关和默认值。
