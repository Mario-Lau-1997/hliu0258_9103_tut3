# 逐步开发说明

这些是本次实际完成、测试的开发步骤。代码与测试由 ChatGPT/Codex 协助完成；
记录不代表 Mario 已亲自编写、测试或完成三次个人贡献。已有来源说明予以保留。

## 第一轮：可靠的触屏和键盘控制

**问题**：旧版的 pointerup、pointercancel、lostpointercapture 没有检查指针 ID。
第二根手指离开时可能结束第一根手指的拖动。旧版也无法用键盘从空白场景创建波源，
重叠波源不易分别选择。

**修改**：
- `js/input-controls.js`：只有当前拖动指针可以结束操作；增加 `addSource()` 和 `selectSource()`。
- `js/ui.js`、`index.html`：增加 Add source 按钮、Choose a source 下拉框和 A 快捷键。
- `style.css`：给新控件增加响应式样式与焦点轮廓。
- `sketch.js`：将新增控制接入主程序。

**证据**：
- `revisions/01-before-fix.tap`：旧代码确实未通过指针归属测试。
- `revisions/01-unit.tap`：修改后 10 项单元测试通过（原有 6 项 + 新增 4 项）。
- `revisions/01-browser.json`：6 项浏览器检查通过，包括真实浏览器触屏事件。
- 浏览器：Chrome Headless Shell 131；自动化模拟触屏不等于真实手机实机测试。

**提交说明建议**：`Fix touch drag ownership and add keyboard source controls`

**你可以亲自验证**（以下不是已完成的个人测试记录）：
1. 打开 `index.html`，点击 Clear，用 Tab 聚焦 Add source，按 Enter。
2. 聚焦画布按 A，再从下拉框选择第一个波源，用方向键移动它。
3. 在自己的触屏设备上试两根手指：第二根松开后，第一根应仍能拖动。
4. 记录设备、浏览器、日期、实际结果和你进一步修改的内容。

**简单英文解释**：
The old code could stop a drag when another finger was lifted. The revised code checks
the pointer ID. It also lets people add and select sources with the keyboard.

## 如何运行测试

数学及交互逻辑测试：`node --test tests/*.test.cjs`。
浏览器测试：安装 Playwright，并按 `tests/browser.cjs` 顶部说明设置浏览器路径；
运行 `node tests/revisions.cjs`。作品本身直接打开 `index.html` 即可，无须 Node。

## 来源补充

MDN contributors. (n.d.). *PointerEvent: pointerId property*. MDN Web Docs.
https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId

## 第二轮：撤销与重做

**问题**：探索时误删、清空或改变参数后，旧版无法回到先前的设置。

**修改**：
- 新增 `js/scene-state.js`：将波源、参数、随机种子、选中 ID 存成小型数据快照。
- 新增 `js/scene-history.js`：最多记录 30 次编辑。`begin()` 记录起点，`commit()` 记录完整操作。
- 接入指针拖动、滑块、删除、添加、相位、重置、清空和随机种子。
- 新增 Undo / Redo 按钮及 Ctrl/Cmd + Z、Ctrl/Cmd + Shift + Z 快捷键。
- 选择波源本身不算一次作品修改；撤销后继续修改会清除旧的重做分支。

**证据**：`revisions/02-unit.tap` 有 16 项通过；`revisions/02-browser.json` 有 11 项通过。
新测试覆盖长拖动合并、快照独立、30 步上限、撤销未结束的滑块操作、恢复原始相位和种子。

**提交说明建议**：`Add bounded undo and redo for scene editing`

**你可以亲自验证**：暂停，拖动一个波源，再点 Undo / Redo；清空后 Undo 应恢复全部波源；
Undo 后再反转相位，Redo 应变为不可用。记录实际观察。

**限制**：恢复作品参数，不恢复之前每条粒子轨迹；轨迹会重新开始。
动画时钟保持当前值，所以比较图形时先暂停。历史记录只在当前页面保留。

**简单英文解释**：
Undo makes exploration easier. A whole drag is stored as one edit. The program
keeps small copies of the scene settings. It keeps up to thirty edits to limit memory use.
