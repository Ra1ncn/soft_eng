# 前端视觉系统

## 范围与分支

视觉分支：`feat/ui-theme`。基于 `chore/phase1-foundation` 的 `218e1f8`，因为开始时 main 只有初始化文件、基础 PR #1 尚未合并。最初采用基础分支作为 base，只展示视觉改动。代码 review 时，基础 PR #1 已合并，主题 PR #2 的 base 已调整为 main；后续统一从最新 main 创建业务分支。

开始前已阅读 README、docs/api.md 和 client，实际启动原前端并取得 HTTP 200。现有页面只有首页、教师/学生占位页，没有 B/C 业务页面。本次保留 /teacher 和 /student 路径，重做外观与英文文案，新增 /ui-preview（仅开发模式开放，生产构建隐藏入口和路由）。

未改后端、数据库、docs/api.md、shared/contracts.ts、client/src/lib/apiFetch.ts 或其测试。没有新增业务 API 调用；预览页交互仅为本地组件演示，不会提交数据。没有 UI 组件库、Tailwind 或深色模式。

## 设计变量与字体

`client/src/styles/tokens.css` 完整保留任务指定的颜色、圆角、阴影值，没有新增颜色。另增加字体、内容最大宽度（1120px）、间距和焦点环变量。颜色字面值只允许出现在 tokens.css；组件使用 var(...) 或继承 currentColor。transparent 表示无色，不是额外调色板颜色。

- 页面暖灰、卡片白色、辅助面板 sage，主按钮绿色，次按钮白色，深色按钮深灰。
- Card 默认白底、1px 边框、20px 圆角；导航和按钮为胶囊形。
- Button 最小高度 48px，底部 4px 实色阴影；按下平移 4px 并移除阴影。
- warning 状态复用 sage 背景和黑色文字，配警示图标；没有为 warning 新增黄色。
- 为保持文字可读性，disabled 控件使用现有 dark 文字和 secondary-edge 背景，没有将 #999 用于低对比度小字。
- 标题 h1/h2/h3：Source Serif 4，500；正文：Figtree，400/500/600。
- npm 包名无变化：`@fontsource/source-serif-4@5.3.1`、`@fontsource/figtree@5.3.0`，均 OFL-1.1。仅导入本项目需要的 Latin 子集与字重，自托管，不请求外部字体 CDN。中文按指定系统字体栈回退。
- 首页图形与图标为项目内原创 SVG / CSS 几何图形；未访问、下载或引用参考站素材、字体、图片和品牌文案。

## 组件接口

统一从 `client/src/components/ui/index.ts` 导入，均使用 TypeScript 和 CSS Modules。

| 组件 | 用法 |
| --- | --- |
| Button | 原生 button 属性；variant 为 primary / secondary / dark；支持 loading、loadingLabel、disabled。默认 type=button，提交表单须明确 type=submit |
| ButtonLink | React Router Link 属性及相同 variant；用于页面导航，不把链接嵌套在 button 中 |
| Card | 原生 div 属性，可传 className；默认白底、边框、20px 圆角和轻阴影 |
| TextInput / Textarea | 原生输入属性，加 label、hint、error；自动关联 label 和描述，错误时设置 aria-invalid，可用受控 value/onChange |
| AnswerOption | 原生 input 属性；type=radio 或 checkbox、label、description；支持 checked/onChange、name/value、disabled 和 ref |
| StatusBadge | status=success / warning / error / neutral；文字和图标共同表达状态，children 可替换默认文案 |
| PageShell | 页面容器、跳过导航链接、统一 TopNav、main、footer 和响应式间距；已在应用根部挂载一次，业务页不要重复嵌套 |
| TopNav | 白色胶囊导航，保留 Teacher/Student 路径，自动标识当前入口 |
| Icon | 自绘几何线条的装饰性 SVG；搭配可读文字，默认 aria-hidden |
| QuestionNav | Numbered jump list: a sticky left column on desktop and a top strip at 700px and below. `items` takes `targetId` and optional `hasError`. Each target needs `tabIndex={-1}` and a `scroll-margin-top`. |

AnswerOption 保留真实 radio/checkbox，视觉隐藏原生外观但不使用 display:none。单选使用同一 name，复选可多选。输入的 accessible name 由 label 指定，description 单独关联；父层用 fieldset / legend 给题目分组。选中时有勾、绿色描边和深色指示器，不能只靠颜色判断。

StatusBadge 默认不设置 aria-live，避免静态列表被重复播报；保存完成等动态消息可在父层用 role=status / aria-live=polite，或向组件传递合适的原生 ARIA 属性。

## B 接手示例

保留已有状态、表单提交函数与接口调用，只替换呈现组件。页面布局已由根 PageShell 提供。

```tsx
import { Button, Card, TextInput, Textarea } from "../../components/ui";

<Card>
  <form onSubmit={handleSubmit}>
    <TextInput label="Quiz title" value={title}
      onChange={(event) => setTitle(event.target.value)} error={fields.title} />
    <Textarea label="Question" value={prompt}
      onChange={(event) => setPrompt(event.target.value)} />
    <Button type="submit" loading={isSaving} loadingLabel="Saving quiz…">
      Save quiz
    </Button>
  </form>
</Card>
```

上述变量和 handleSubmit 由 B 自己的业务逻辑提供，组件不会调用 API。表单字段间距放在业务页 CSS Module；颜色、字体和圆角引用 tokens。

## C 接手示例

```tsx
import { AnswerOption, Button, StatusBadge } from "../../components/ui";

<fieldset>
  <legend>{question.prompt}</legend>
  {question.options.map((option) => (
    <AnswerOption key={option.id}
      type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
      name={question.id} value={option.id} label={option.text}
      checked={selectedIds.includes(option.id)}
      onChange={() => toggleOption(question, option.id)} />
  ))}
</fieldset>
<Button type="submit" loading={isSubmitting}>Submit answers</Button>
<StatusBadge status="success">Submitted successfully</StatusBadge>
```

toggleOption、单选/多选状态、接口调用和提交状态由 C/D 维护。示例 StatusBadge 仅在业务上确实提交成功时显示。完整可交互演示见 `/ui-preview`。

## 实际验证（2026-11-04，macOS arm64）

| 检查 | 实际结果 |
| --- | --- |
| `npm run typecheck` | client/server/shared 全部通过 |
| `npm test` | 原有 4 个测试文件、37 项全部通过 |
| `npm run build` | 成功；字体输出为本地 WOFF/WOFF2；保留既有 React Router 的非阻塞 use client 指令警告 |
| `npm run dev` | Vite 5173 和 Express 3001 同时启动；原版启动检查和主题版均成功 |
| 浏览器字体检查 | document.fonts 状态 loaded；标题字体 Source Serif 4、weight 500；正文 Figtree |
| 390×844 与 1280×900 | 首页、/teacher、/student、/ui-preview 共 8 个场景实际打开，scrollWidth 等于视口宽度，没有横向滚动；已保存全部截图 |
| 键盘 | Tab 跳过 disabled/loading 控件；Enter 触发 Save changes 并显示本地反馈；输入框/textarea 可输入；Down 切换原生 radio；Space 切换两个 checkbox；焦点环为 teal 3px |
| 文本对比度 | 按 WCAG sRGB 公式计算，13 组主要文字组合全部 ≥4.5:1；最低为 success/sage 4.63:1，绿色按钮黑字 9.87:1，深色按钮白字 12.82:1 |
| 颜色与素材搜索 | 前端源文件外部品牌字符串 0 匹配；tokens.css 以外 HEX/RGB/HSL 颜色字面值 0 匹配；没有外部图片/字体 CDN 引用 |
| 接口和业务保护 | `git diff --exit-code chore/phase1-foundation -- server shared docs/api.md client/src/lib` 成功，无差异；没有新增 quiz/submission 请求 |
| 动效 | 实现并检查 prefers-reduced-motion 覆盖：缩短过渡、停止无限 spinner；没有模拟操作系统减弱动态开关，不把它记为浏览器实测 |
| 浏览器控制台 | 八场景浏览时没有捕获到 console error |
| 生产样式页隔离 | Vite preview 5174 实测 `/ui-preview` 显示未找到页面，页脚不显示开发入口；开发模式该页正常可用 |

机器上的 Node 使用既有独立工具目录，运行前需按基础报告配置 PATH。本次仅做前端视觉验收，不重新启动数据库或重跑迁移。

详细观察：[布局数据](ui-theme/layout-checks.json)、[键盘结果](ui-theme/keyboard-checks.json)、[对比度数据](ui-theme/contrast-checks.json)。

| 页面 | 390px | 1280px |
| --- | --- | --- |
| 首页 | [截图](ui-theme/home-390.png) | [截图](ui-theme/home-1280.png) |
| Teacher | [截图](ui-theme/teacher-390.png) | [截图](ui-theme/teacher-1280.png) |
| Student | [截图](ui-theme/student-390.png) | [截图](ui-theme/student-1280.png) |
| UI preview | [截图](ui-theme/ui-preview-390.png) | [截图](ui-theme/ui-preview-1280.png) |

[键盘聚焦截图](ui-theme/keyboard-focus.png)。

## 差异与后续事项

- 仓库和基准分支在 prompt 中未填写：沿用当前任务仓库，最初因基础 PR 未合并采用堆叠 PR；基础合并后已调整到 main，主题 diff 不包含后端改动。
- 提供了 ButtonLink 和 Icon 两个辅助导出，以保持导航语义与统一图标；没有额外依赖。
- 字体包名与指定名称一致；未改变指定颜色。新增变量仅覆盖排版、间距、焦点环和宽度。
- B/C 业务页尚未存在，因此本次统一的是已有占位页；将来业务实现仍需按本规范绑定原状态和调用。
- 已按用户授权完成代码 review，并将 PR base 调整为 main；组员仍可补充视觉和组件接口意见。本机验收不代表跨浏览器/其他设备的完整无障碍认证。
