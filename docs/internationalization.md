# 多语言实现说明

界面、弹幕、实时解说、赛段名、选手名与语音音色都按当前语言切换，支持
`zh-CN`、`en`、`ru`、`fr`、`ja` 五种。

## 文件结构

```
src/i18n/
├─ index.js              语言注册表、t()、名称/语料查询、IP 检测、DOM 应用
├─ commentary.js         解说语料的按语言取用 + 赛段描写选择（按赛段编号）
└─ locales/
   ├─ zh.js              中文基准（复用 src/danmaku-corpus.js 与 live-commentary-corpus.js）
   ├─ en.js              英文（自带 en/danmaku.js、en/commentary.js 两个子文件）
   ├─ ru.js
   ├─ fr.js
   └─ ja.js
```

每个语言包的结构一致：

| 字段 | 内容 |
| --- | --- |
| `ui` | 界面文案，135 个键，含占位符（`{count}`、`{reward}` 等） |
| `racers` / `woods` | 键是中文原名，值是译名。内部逻辑一律用中文键 |
| `stages` / `modules` | 44 个赛段标签与 4 个组合名，同样中文作键 |
| `danmaku` | 11 个分类的观众弹幕，占位符 `{name} {rival} {gain} {stage} {speed}` |
| `commentary.live` | 37 类解说事件，占位符 `{name} {rival} {gain} {rank} {oldRank} {gapText} {names} {stage} {reason}` |
| `commentary.stageDetails` | 30 段赛段描写（按赛道第 1–30 段） |
| `commentary.openingDetails` | 第 3 段按开场变体取用，中文标签作键 |
| `commentary.moduleDetails` | 第 30–39 段按模块类型取用 |
| `commentary.keyStageFocus` | 12 个关键赛段的点评，数字作键 |
| `lengthScale` | 文案长度系数，用于解说选句的长度分档（中文 1，日 1.05，英 1.8，法 1.85，俄 1.9） |

## 语言选择

1. `?lang=xx` 覆盖一切（不写入本地存储）。
2. 本地存储 `marble-race-locale-v1`：具体语言码直接使用；`auto` 表示跟随网络。
3. 「自动」模式先查 IP 地区，失败后用 `navigator.language`：
   - `ipapi.co/country/` → `ipwho.is` → `api.country.is`，1.6 秒超时，任一成功即止
   - 结果写入 `sessionStorage` 的 `marble-race-geo-v1`，缓存 6 小时
4. 地区映射：俄语区（RU/BY/KZ/KG/UZ 等）→ `ru`；法语区（FR/BE/CH/CA 及非洲法语国家）→ `fr`；JP → `ja`；CN/TW/HK/MO/SG → `zh-CN`；其余 → `en`。

首屏先用浏览器语言渲染，IP 查询返回后若语言不同再整体切换，不阻塞启动。

## 运行时切换

`setLocale()` 会触发 `onLocaleChange`，`refreshLocalizedUi()` 负责一次性重刷：

- 静态标记（`data-i18n` / `data-i18n-aria` / `data-i18n-title`）与 `<html lang>`、标题、描述
- 选手名（改 `marble.name`，排行榜、关注卡片、押注按钮、冠军卡同步）
- 押注面板、赛道信息、解说空闲文案、赛段名、音乐状态、设置弹窗内的数值
- 语音音色列表按新语言重建；正在飞的弹幕会被清空，避免中英混排

## 新增一种语言

1. 复制 `src/i18n/locales/en.js` 为 `xx.js`，翻译 `ui`、`racers`、`woods`、`stages`、`modules`、`danmaku`、`commentary`。
2. 在 `src/i18n/index.js` 的 `LOCALES`、`SUPPORTED` 里注册，必要时补 `ALIASES` 与 `COUNTRY_LOCALE`。
3. 在 `index.html` 的 `#languageSelect` 里加一个 `<option value="xx">`。
4. 运行 `node tools/check-i18n.mjs`，它会逐键比对键位、占位符、语料数量，并检查非中文语言包里是否残留中文。

## 校验

```sh
node tools/check-i18n.mjs
```

覆盖：5 个语言包的 `ui` 键集合一致、占位符一致、赛段/选手/木纹键一致、弹幕 11 类且每类 ≥12 条、解说 37 类事件齐全、30 条赛段描写、12 个关键赛段、`index.html` 里出现的键都存在、俄/法/英语言包无残留中文。
