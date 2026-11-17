# 弹珠竞速 · 工坊试跑

八颗弹珠在随机生成的三维木质赛道上竞速的网页原型：真实刚体物理、实时排名、文字与语音解说、模拟观众弹幕、本地押注，以及每场随机播放的背景音乐。

技术栈：Vite 7 + three.js（渲染）+ Rapier（物理，1/360 秒步长）。

---

## 快速开始

环境要求：Node.js `^20.19.0` 或 `>=22.12.0`；浏览器需支持 WebAssembly、顶层 await 与 ES2022（Chrome / Edge / Firefox / Safari 近两年版本均可）。首次使用先在本目录执行 `npm install`。

### 方式 A：一键启动（推荐）

双击 `start-or-restart.cmd`，脚本会依次：构建最新源码 → 若已有本项目的预览进程则先停止 → 后台启动 `vite preview` → 轮询直到首页返回 200 → 打印地址。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/start-or-restart.ps1
```

- 访问或刷新 <http://127.0.0.1:4180/>
- 运行状态在 `.run/preview.json`，日志在 `.run/preview.log` 与 `.run/preview-error.log`
- 构建失败时不会停掉正在运行的旧版本
- 端口被其他程序占用时只提示、不会误杀别人的 Node 进程
- **注意**：该方式服务的是 `dist/` 静态构建，改完源码要再跑一次脚本才生效

### 方式 B：开发模式（热更新）

```sh
npm install
npm run dev
```

打开 <http://127.0.0.1:4180/>，改 `src/` 下的文件会热更新。端口使用 strictPort，4180 被上面的 preview 占用时需先停掉它（Ctrl+C 或再跑一次方式 A）。

> 提示：若页面看起来还是旧代码，先确认是哪种服务。`npm run dev` 支持热更新，`npm run preview` 与 `start-or-restart.cmd` 读的是 `dist/`，必须重新构建。

### 方式 C：手动构建与预览

```sh
npm run build     # 产物写入 dist/
npm run preview   # 预览 dist/，同样占用 4180
```

---

## 玩法与操作

1. 左侧「冠军押注」里选 1–4 颗弹珠，点「开始比赛」。
2. 倒计时结束弹珠落坡，实时排名、解说和弹幕同时开始。
3. 「再赛一场」会重新生成赛道并回到押注界面。

| 操作 | 说明 |
| --- | --- |
| `空格` | 开始比赛 / 暂停 / 继续 |
| `数字键 1–8` | 切换关注的弹珠（也可点左下角卡片选择） |
| 拖动、滚轮 | 进入自由镜头，自动跟拍停止 |
| 点镜头按钮 | 恢复自动跟拍（含导播镜头） |
| 悬停弹幕 | 该条弹幕暂停移动，移开继续 |
| 右上「设置」 | 音乐、音效、语音、弹幕、音量、解说音色与语速 |

### 押注规则

- 本地账户初始 **1000 珠**，每天可领 **100 珠**（按本机日期判断，刷新不清零）
- 无入场费，每选一颗弹珠 **5 珠**，最多选 4 颗
- 押中冠军：`5 × 8 球 × 0.95 = 38 珠`（含 5% 抽水），选几颗都不会让奖励翻倍
- 比赛中刷新、关页面或点「新一场」视为中断，已付珠子不退
- 这是纯本地单机积分，没有服务端账户，也没有联机对手

---

## 目录结构

```
outputs/web-game/
├─ index.html                 页面骨架：顶栏、押注面板、排名、解说、设置弹窗
├─ src/
│  ├─ main.js                 主程序：赛道生成、物理循环、镜头、UI 与各模块装配
│  ├─ rapier-adapter.js       Rapier 物理引擎适配层（含 cannon-es 风格 API）
│  ├─ race-position.js        沿赛道中心线的弧长进度，用于排名与间距
│  ├─ race-variation.js       按种子生成每场随机变化
│  ├─ betting.js              账户、押注、结算、每日奖励
│  ├─ race-commentary.js      事件驱动的实时解说引擎
│  ├─ live-commentary-corpus.js  现用解说语料（16 类 × 4 条 + 30 段赛段描写）
│  ├─ commentary-corpus*.js   旧版解说语料（100 + 200 条，已归档不再用于实时解说）
│  ├─ voice-commentary.js     SpeechSynthesis 语音播报
│  ├─ voice-settings.js       设置弹窗的音色、语速与开关绑定
│  ├─ race-danmaku.js         模拟观众弹幕：事件判定 + 车道排版
│  ├─ danmaku-corpus.js       弹幕语料（10 类，约 800 条）
│  ├─ director-camera.js      导播镜头选点
│  ├─ impact-audio.js         材质撞击音实时合成
│  ├─ style.css
│  └─ static/music/           背景音乐（ogg，自动收录）
├─ tools/                     启动脚本与各类检查脚本
├─ docs/                      语料可读版、弹幕说明、历史变更日志
├─ work/                      物理与赛道测试报告 JSON
├─ dist/                      生产构建产物（start-or-restart.cmd 与 preview 使用）
└─ .run/                      预览进程信息与日志
```

---

## 背景音乐

把 `.ogg` 文件放进 `src/static/music/` 即可，**不需要改代码**：`src/main.js` 用 `import.meta.glob` 自动收集目录内的全部曲目，构建时也只打包实际存在的文件。

- 每场比赛随机抽一首，尽量避免与上一场重复
- 播放状态显示在设置弹窗里；音量与开关保存在本机
- 文件缺失或无法解码时，状态栏会提示「音乐文件不可用，请检查 static/music」
- 目前收录 13 首；想精简直接删文件，重新构建即可

---

## 解说与弹幕

**实时解说**：0.5 秒取一次全部弹珠的位置快照，比较最近约 5 秒的名次与间距变化，事件确认后才播报（前四换位、相邻选手距离增减、末两名争位、三名以上升降、冠军冲线等）。所有数字来自真实比赛数据，解说使用独立随机源，不影响物理结果。文字播报显示最近三行并向上滚动。

**语音**：用浏览器自带的 SpeechSynthesis，从系统中文音色里挑，可设语速 0.70–1.50 与音色偏好。默认关闭，首次开启需要浏览器允许发声。实际效果取决于系统语音引擎。

**弹幕**：默认开启，三条基础轨道（可在 1–6 之间调），默认速度 1.5 倍，相邻两条至少间隔 4.5 秒。

- 每条弹幕从右侧进入、完整滑出左边界才移除；出现新赛况**不会**顶掉正在飞的弹幕
- 轨道数只是排版基准，三条满员时新消息照样上屏，叠加到余量最大的那条轨道，并把速度压到前一条之下，避免追尾成叠字
- 经过「实时排名」与「我的押注」面板时自动隐藏，避免压住读数
- 调整窗口大小只重排弹幕高度，不清空
- 比赛暂停或页面隐藏时停止移动与生成，不补发积压消息

---

## 本地存储

全部设置只存在当前浏览器，清站点数据即恢复默认。

| localStorage 键 | 内容 |
| --- | --- |
| `marble-race-wallet-v2` | 珠数、当前押注、每日领取日期 |
| `marble-race-media-settings-v1` | 音乐/音效开关、音乐音量 |
| `marble-race-voice-settings-v1` | 解说音色与语速 |
| `marble-race-danmaku-v1` | 弹幕总开关 |
| `marble-race-danmaku-settings-v1` | 弹幕基础条数与速度倍率 |

---

## 检查脚本

无画面仿真与断言检查，均在项目根目录用 `node` 直接运行。

| 命令 | 覆盖范围 | 当前状态 |
| --- | --- | --- |
| `node tools/check-physics.mjs [比赛种子] [赛道种子]` | 从起跑线跑到终点排次槽，检测掉出赛道、绕过落孔等 | 通过 |
| `node tools/check-danmaku.mjs` | 语料数量与去重、赛况触发、轨道超限叠加、面板遮挡、悬停、布局变更、暂停与开关 | 通过 |
| `node tools/check-corpus.mjs` | 解说语料数量、重复、占位符 | 通过 |
| `node tools/check-voice.mjs` | 中文音色选择、降级、情绪参数、积压控制、冠军优先 | 通过 |
| `node tools/check-director-camera.mjs` | 导播镜头选点 | 通过 |
| `node tools/check-betting.mjs` | 押注扣费、结算、每日奖励 | 过期（断言里的奖励仍按旧值 40 珠） |
| `node tools/check-commentary.mjs`、`check-race-position.mjs` | 解说句式、间距用词 | 过期（语料迭代后未同步） |
| `node tools/check-extended-layout.mjs`、`check-finish-receiver.mjs`、`check-new-sections.mjs` | 赛道结构抽查 | 过期（提取代码时缺 `bowlWoodMap`，需同步） |

`npm run test:physics` 等价于 `check-physics.mjs`。

---

## 已知限制

- `dist/` 与 `dist-nosound/` 是构建产物：`dist/` 已按当前源码重建，`dist-nosound/` 仍是旧构建，需要时重新生成。
- 预览模式不热更新，改完源码要重新构建；日常开发建议用 `npm run dev`。
- 画质与启动速度有取舍：为保证约 1.4 秒进入可操作，木纹使用简化纹理，护栏碰撞合并为静态网格。
- 语音效果、极端碰撞（超高速度、连续跳槽）尚未做逐项人工验证。
- 弹幕、解说、语音都是本地程序模拟，未连接真实观众或在线服务。

---

## 更多文档

- `docs/simulated-danmaku.md`：弹幕生成规则与语料分类
- `docs/live-race-commentary.md`：实时解说的判定逻辑
- `docs/commentary-corpus-*.md`：历史解说语料的完整可读版
- `docs/CHANGELOG.md`：从最初原型到现在的完整开发记录（数值可能已过期）
- `work/*-report.json`：物理与赛道的仿真测试报告
