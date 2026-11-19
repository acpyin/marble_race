# 弹珠目录与收集

## 总览

共 28 款弹珠，每场用 Fisher-Yates 洗牌随机抽 8 颗上场（`pickMarbles`），所以押注和收集都有意义。物理、排名、UI 始终只处理 8 颗，随机化只发生在选角阶段。

所有定义集中在 `src/marbles.js` 的 `MARBLE_CATALOG`，格式为 `[中文名, 颜色, 样式]`。中文名是稳定 id，收集记录与多语言译名都用它作键。

## 28 款清单

### 经典 8 款（保留原样）

| 名称 | 颜色 | 样式 |
| --- | --- | --- |
| 青岚 | 青绿 | glass 透射玻璃 |
| 紫罗 | 紫 | glass |
| 星渊 | 深蓝紫 | stars 星空 |
| 银河 | 蓝 | galaxy 星云 |
| 烈焰 | 橙红 | fire 火焰 |
| 甜旋 | 粉 | candy 螺旋糖纹 |
| 金辉 | 金 | metal 金属 |
| 翠羽 | 绿 | glass |

### 新增 20 款

| 名称 | 颜色 | 样式 | 视觉主题 |
| --- | --- | --- | --- |
| 极光 | 青绿 | aurora | 虹彩透射玻璃 |
| 琥珀 | 蜜橙 | amber | 通透树脂 |
| 深海 | 蔚蓝 | deepsea | 深蓝宝石 |
| 樱雪 | 粉红 | sakura | 柔和半透 |
| 薄荷 | 薄荷绿 | mint | 果冻质感 |
| 星云 | 紫粉 | nebula | 紫红星云漩涡 |
| 陨星 | 暗红 | meteor | 燃烧陨石 |
| 极夜 | 靛蓝 | polar | 深夜繁星 |
| 光谱 | 品红 | spectrum | 多色螺旋 |
| 黑洞 | 墨黑 | void | 暗色金属 + 吸积盘 |
| 斑马 | 黑白 | zebra | 斜条纹 |
| 波点 | 红白 | dots | 圆点 |
| 糖虹 | 粉紫 | prism | 糖果螺旋 |
| 云纹 | 灰白 | marble | 大理石纹 |
| 虎纹 | 琥珀 | tiger | 虎皮条纹 |
| 铬金 | 银白 | chrome | 镜面金属 |
| 玫瑰金 | 粉金 | rosegold | 暖色金属 |
| 青铜 | 古铜 | bronze | 复古金属 |
| 珍珠 | 乳白 | pearl | 珠光虹彩透射 |
| 熔岩 | 橙红 | lava | 熔岩裂纹 |

## 材质与预览

`makeMarbleMaterial` 按样式分三类：

- **透射玻璃**（glass/aurora/amber/deepsea/sakura/mint/pearl）：`MeshPhysicalMaterial` + transmission .72 + clearcoat；aurora/pearl 额外加 `iridescence` 虹彩
- **金属**（metal/chrome/rosegold/bronze）：metalness .82 + 低粗糙度 + 高环境反射
- **纹理**（其余）：canvas 程序化纹理（火焰/星云/星空/条纹/波点/大理石/吸积盘/螺旋），贴到清漆材质上

`makePatternTexture` 用 768×384 canvas 画纹理，种子固定所以每次生成一致。`marblePreview` 把同一张纹理（或纯色球 + 玻璃高光）映射成 96×96 的 2D 预览图，押注按钮、关注卡片、排行榜、宝箱共用这套预览，避免额外 WebGL 渲染。

## 收集机制

- `src/collection.js` 用 localStorage 键 `marble-race-collection-v1` 保存 `{ 中文名: { count, firstAt, lastAt } }`，读取时校验结构，损坏数据回退空对象
- 结算时（`main.js` 的 `checkFinish`）只有押中冠军才调用 `vault.recordWin(w.nameKey)`：新款标记为新收集并让进度徽标弹一下，旧款累加次数
- `src/vault.js` 负责右下角入口与弹窗：28 款全展示，已收集显示真实预览 + 译名 + 次数 + 首次日期，未收集显示灰色剪影 + `???`
- 切换语言时 `refreshLocalizedUi()` 会调用 `vault.refresh()`，名称和文案跟随当前语言

## 扩展新弹珠

1. 在 `MARBLE_CATALOG` 加一行 `[名称, 颜色, 样式]`；复用现有样式或用新样式（新样式需在 `makePatternTexture` 加分支，纯玻璃/金属则加到对应 Set）
2. 在五份语言包的 `racers` 里补译名（键为中文名）
3. 更新宝箱进度分母自动变为 29（用 `MARBLE_CATALOG.length`）；README 和本文件的数字需手动更新
4. 运行 `node tools/check-marbles.mjs` 与 `node tools/check-i18n.mjs`
