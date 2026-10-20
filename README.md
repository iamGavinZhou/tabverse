# Tabverse

**English** | [简体中文](#简体中文)

A Chrome new tab extension inspired by Toby. It organizes your frequently used pages in a three-level structure — **Space → Group → Tab** — replacing the new tab page. Data is stored locally in the browser and can be manually synced to your own GitHub repository for use across devices.

---

## Features

- **Three-level structure**: Space → Group → Tab.
- **Spaces**: create, rename, change color, delete.
- **Groups**: create, rename, delete, drag to reorder.
- **Tabs**: icon, title, URL; edit and delete; drag to reorder within a group or move across groups.
- **Drag to create**: drag a link in from the address bar, a page, bookmarks, or another window to create a tab automatically, with the title and icon detected.
- **Open tabs panel**: a right-side panel to drag open tabs into a group, or save a whole window as a group in one click.
- **Responsive layout**: columns adjust to window width; the sidebar collapses on narrow screens.
- **Theme**: light / dark / follow system.
- **Languages**: Chinese / English / follow browser.

## Requirements

Node.js 18 or newer (developed on v22).

```bash
node -v
```

## Build & package

Run from the project root:

```bash
npm install      # install dependencies (first time or when deps change)
npm run build    # production build to dist/
npm run zip      # build, then package dist/ into tabverse.zip (for the Web Store)
npm run dev      # dev mode with hot reload
npm run icons    # regenerate the extension icons
```

`dist/` is the complete, loadable extension.

## Install in Chrome (load unpacked)

1. Run `npm run build` so that `dist/` exists.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the **`dist/` directory** (not the project root).
6. Open a **new tab** to see Tabverse.

### Updating after code changes

1. Run `npm run build` again.
2. On `chrome://extensions`, click the **refresh icon (⟳)** on the Tabverse card (this is the card's refresh, not the browser address-bar refresh).
3. Close the old new tab and open a new one.

### Sharing with others

Send `tabverse.zip`; the recipient unzips it and uses **Load unpacked** on the extracted folder. Locally loaded extensions do **not** auto-update.

## Usage

- **Spaces**: managed in the left sidebar — add, rename, recolor, delete.
- **Groups**: "New Group" at the top right; drag group headers to reorder; rename / delete.
- **Tabs**: drag items from the open tabs panel, or drag web links from the browser, into a group to auto-create a tab. Drag to reorder within or across groups. Hover a tab for edit / delete. Click a tab to open it in a new tab.
- **Open tabs panel**: toggle at the top right; "Save as group" saves a whole window.
- **Settings** (bottom left): theme, language, GitHub sync, JSON import/export, page-info fetch permission.

## GitHub sync

Data lives locally by default. Configure GitHub to share across devices.

1. **Create a repo** on GitHub — **Private is recommended** (it contains all your saved URLs).
2. **Create a Fine-grained Token** at `https://github.com/settings/personal-access-tokens/new`:
   - **Resource owner**: your account.
   - **Repository access**: Only select repositories → your repo.
   - **Permissions → Repository permissions → Contents**: **Read and write** (easy to miss).
   - Copy the `github_pat_` token (shown only once).
3. **In Settings → GitHub sync**, fill in owner, repo, branch (usually `main`), file path (e.g. `tabverse.json`), and token. Click **Test connection**, then **Save**.

Sync behavior:
- **Pull**: automatic on browser startup.
- **Push**: **manual** — after editing, the sidebar sync button shows "Unsynced changes"; click to push (one commit). Nothing is auto-committed while editing.
- **Multi-device**: install and use the same config on another device.
- **Conflicts**: when both sides changed, entities merge by `updatedAt`; deletions are recorded as tombstones so deleted items are not re-added.

The token is stored in plaintext only in your local browser and is never written into the GitHub data file.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` / `unlimitedStorage` | Local data storage |
| `tabs` | Read open tabs (panel, title lookup) |
| `favicon` | Read site icons from Chrome's cache |
| `https://api.github.com/*` | GitHub sync |
| `<all_urls>` (optional) | Fetch page title/icon on drop; requested only after you grant it in Settings |

## FAQ

- **Sync returns 403 `Resource not accessible by personal access token`**: the token lacks Contents read/write. Edit the token, set Contents to Read and write, and retry (no need to re-enter it).
- **Test succeeds but sync fails**: the test only verifies reading repo info; syncing needs write access, so it is still likely a Contents permission issue.
- **Icon shows a default globe**: that site's favicon isn't cached. Grant "page info fetching" in Settings, or set the icon URL manually when editing a tab.
- **Code changes have no effect**: rebuild, click the refresh icon on `chrome://extensions`, then reopen a new tab.
- **No load button**: Developer mode on `chrome://extensions` is off.

## Publish to the Chrome Web Store (optional)

1. Register a developer account at `https://chrome.google.com/webstore/devconsole` (one-time $5 fee).
2. `npm run zip` to create `tabverse.zip`.
3. New Item → upload the zip → provide a 128×128 icon, at least one 1280×800 screenshot, a description, category (Productivity), a privacy policy URL, and permission justifications.
4. Submit for review; once approved it installs from the store and auto-updates.

Version history: see [CHANGELOG.md](./CHANGELOG.md).

---
---

<a id="简体中文"></a>

# Tabverse（简体中文）

[English](#tabverse) | **简体中文**

一个仿 Toby 的 Chrome 新标签页扩展。按「**空间 Space → 分组 Group → 标签 Tab**」三层结构整理常用网页，替换浏览器新标签页。数据保存在浏览器本地，并可手动同步到你自己的 GitHub 仓库，实现多设备共用。

---

## 功能特性

- **三层结构**：空间 Space → 分组 Group → 标签 Tab。
- **空间**：新建、改名、改颜色、删除。
- **分组**：新建、改名、删除，拖拽排序。
- **标签**：展示图标 / 名称 / URL；编辑与删除；组内拖拽排序，支持跨组移动。
- **拖入自动创建**：从地址栏、页面链接、书签或其他窗口拖入网页，自动识别标题与图标并新建标签。
- **已打开标签页面板**：右侧面板可将打开的标签拖入分组，或将整个窗口一键保存为分组。
- **自适应布局**：分组与标签随窗口宽度自动调整列数；窄屏下侧栏折叠。
- **外观**：浅色 / 深色 / 跟随系统主题。
- **多语言**：中文 / 英文 / 跟随浏览器。

## 环境准备

需要本机安装 **Node.js 18 或更高版本**（开发时使用 v22）。

```bash
node -v
```

## 编译与打包

在项目根目录执行：

```bash
npm install      # 安装依赖（首次或依赖变动时）
npm run build    # 生产构建，产物输出到 dist/
npm run zip      # 构建并把 dist/ 打包为 tabverse.zip（用于上架商店）
npm run dev      # 开发模式，带热更新
npm run icons    # 重新生成扩展图标
```

`dist/` 目录就是可被 Chrome 加载的完整扩展。

## 在 Chrome 中安装（本地加载）

1. 先执行 `npm run build`，确保 `dist/` 存在。
2. 打开 `chrome://extensions`。
3. 打开右上角 **开发者模式**。
4. 点 **加载已解压的扩展程序**。
5. 选择项目里的 **`dist/` 目录**（不是项目根目录）。
6. 新开一个标签页即可看到 Tabverse。

### 改了代码后如何更新

1. 重新 `npm run build`。
2. 在 `chrome://extensions` 找到 Tabverse 卡片，点右下角的**刷新图标（⟳）**（是扩展卡片上的刷新，不是浏览器地址栏的刷新）。
3. 关掉旧的新标签页，重开一个。

### 分发给他人

把 `tabverse.zip` 发给对方，解压后用「加载已解压的扩展程序」选解压出的文件夹。本地加载的扩展**不会自动更新**。

## 基本使用

- **空间**：左侧栏管理，可新建、改名、改颜色、删除。
- **分组**：右上角「新建分组」；拖拽分组标题排序；可改名、删除。
- **标签**：把面板里打开的标签，或浏览器里的网页链接拖进分组即自动创建；可组内或跨组拖拽；悬停出现编辑/删除；点击在新标签页打开。
- **已打开标签页面板**：右上角按钮开关；可整窗「保存为分组」。
- **设置**（左下角）：主题、语言、GitHub 同步、JSON 导入导出、网页信息抓取授权。

## GitHub 同步

数据默认只存在本地。配置 GitHub 后可多设备共用。

1. **建一个仓库**，**建议设为 Private**（含你所有收藏网址）。
2. **生成 Fine-grained Token**：打开 `https://github.com/settings/personal-access-tokens/new`
   - **Resource owner**：你的账号。
   - **Repository access**：Only select repositories → 勾选该仓库。
   - **Permissions → Repository permissions → Contents**：设为 **Read and write**（最容易漏）。
   - 复制 `github_pat_` 开头的 Token（只显示一次）。
3. **在设置 → GitHub 同步**填入：仓库所有者、仓库名、分支（一般 `main`）、文件路径（如 `tabverse.json`）、Token。点「测试连接」→「保存」。

同步行为：
- **拉取**：浏览器启动时自动拉取远端数据。
- **推送**：**手动**。编辑后侧栏同步按钮显示「有未同步的修改」，点一下推送（一次 commit），编辑时不会自动提交。
- **多设备**：另一台设备装好、填相同配置即可。
- **冲突**：两端都改过时按条目更新时间合并，删除以墓碑记录，不会把已删数据加回来。

Token 仅明文保存在本机浏览器，不会写进 GitHub 的数据文件。

## 权限说明

| 权限 | 用途 |
|---|---|
| `storage` / `unlimitedStorage` | 本地数据存储 |
| `tabs` | 读取已打开标签页（面板、标题识别） |
| `favicon` | 读取站点图标缓存 |
| `https://api.github.com/*` | GitHub 同步 |
| `<all_urls>`（可选） | 拖入网页时抓取标题/图标，仅在用户授权后使用 |

## 常见问题

- **同步报 403 `Resource not accessible by personal access token`**：Token 缺 Contents 读写权限。编辑 Token 把 Contents 改为 Read and write 后重试，无需重填。
- **测试连接成功但同步失败**：测试只验证读取仓库信息，同步需要写权限，仍可能是 Contents 权限问题。
- **图标显示成默认地球**：该站点图标未缓存。可授权「网页信息获取」，或在编辑标签时手动填图标 URL。
- **改了代码没生效**：确认重新构建，并在 `chrome://extensions` 点了扩展的刷新图标，再重开新标签页。
- **看不到加载按钮**：`chrome://extensions` 的「开发者模式」没打开。

## 上架 Chrome 应用商店（可选）

1. 注册开发者账号：`https://chrome.google.com/webstore/devconsole`（一次性 5 美元）。
2. `npm run zip` 生成 `tabverse.zip`。
3. New Item → 上传 zip → 提供 128×128 图标、至少 1 张 1280×800 截图、详细说明、分类（生产工具）、隐私政策网址、权限用途说明。
4. 提交审核，通过后即可在商店安装并自动更新。

版本记录：见 [CHANGELOG.md](./CHANGELOG.md)。
