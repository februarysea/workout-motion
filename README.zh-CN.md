# workout-motion

用于训练记录、健身应用和网站的 SVG 运动动画库。

**[在线演示](https://jichunhou.me/workout-motion/)** · [English](README.md) · **简体中文**

- **29 个连续动画**，共用一致的视觉风格，持续扩充中。
- **零运行时依赖**，JavaScript API 不绑定框架。
- **动态与静态输出**：暂停、定位、调速，或将任意姿态渲染为 SVG。

| 深蹲 | 卧推 | 硬拉 | 引体向上 |
| :---: | :---: | :---: | :---: |
| [![深蹲](site/previews/squat.gif)](https://jichunhou.me/workout-motion/?lang=zh&motion=squat) | [![卧推](site/previews/bench-press.gif)](https://jichunhou.me/workout-motion/?lang=zh&motion=bench-press) | [![硬拉](site/previews/conventional-deadlift.gif)](https://jichunhou.me/workout-motion/?lang=zh&motion=conventional-deadlift) | [![引体向上](site/previews/pull-up.gif)](https://jichunhou.me/workout-motion/?lang=zh&motion=pull-up) |

以上为 2 倍速的完整动作循环动画，点击预览可进入交互演示。

## 快速开始

[下载 v0.1.0 构建包](https://github.com/februarysea/workout-motion/releases/download/v0.1.0/workout-motion-0.1.0.zip)
并解压即可使用，无须自行编译。包内包含 `dist/` 下的完整 JavaScript 模块与
TypeScript 类型声明、`assets/` 下的 29 个静态 SVG 及动作目录，以及许可文件。

- **使用静态图片**：将 `assets/<id>.svg` 用于图片标签、文档或设计稿。
- **嵌入交互动画**：通过 `dist/h2.js` 接入，示例见下方。请保留完整 `dist/`
  目录，`h2.js` 还会引用其中其他模块。
- **修改动作库源码**：使用下方的源码构建命令。

导出的 SVG 是动作进度 `0.2` 处的**静态帧**。连续动画由 JavaScript 播放器驱动，
下载 SVG 并不会得到一张自动播放的动图。

### JavaScript

将以下内容保存为解压目录中的 `index.html`，与 `dist/` 同级。使用你的开发服务器
访问该目录的 HTTP 地址；浏览器需要通过 HTTP 加载 ES 模块，不能直接双击 HTML 文件。

<details>
<summary>完整 HTML 示例</summary>

```html
<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>运动动画</title>
<div id="motion" style="width:320px;max-width:100%;aspect-ratio:1;background:#151718"></div>
<button id="toggle" type="button">播放</button>
<label>速度
  <select id="speed">
    <option value="0.5">0.5×</option>
    <option value="1" selected>1×</option>
    <option value="2">2×</option>
  </select>
</label>
<script type="module">
  import { createPlayer } from './dist/h2.js';

  const button = document.querySelector('#toggle');
  const player = createPlayer(document.querySelector('#motion'), 'bench-press', {
    title: '卧推',
    onStateChange(playing) {
      button.textContent = playing ? '暂停' : '播放';
    },
  });
  button.textContent = player.playing ? '暂停' : '播放';
  button.onclick = () => player.playing ? player.pause() : player.play();
  document.querySelector('#speed').onchange = (event) => {
    player.setSpeed(Number(event.target.value));
  };
  // 移除动作容器之前调用：player.destroy();
</script>
</html>
```

</details>

播放器尊重系统的减少动态偏好，在页面隐藏或容器离屏时暂停。请保留可见的暂停控件，
在应用中移除播放器之前调用 `destroy()`。

### React

将构建包的完整 `dist/` 目录复制为 React 应用中的 `src/workout-motion/`，
再将以下组件保存为 `src/WorkoutMotion.jsx`。不需要额外的 React 适配包。

<details>
<summary>带播放控件的 React 组件</summary>

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPlayer, getExercise } from './workout-motion/h2.js';

export default function WorkoutMotion({ id = 'squat', speed = 1 }) {
  const host = useRef(null);
  const player = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    const instance = createPlayer(host.current, id, {
      title: getExercise(id).chinese,
      onStateChange(value) {
        if (mounted) setPlaying(value);
      },
    });
    player.current = instance;
    setPlaying(instance.playing);
    return () => {
      mounted = false;
      instance.destroy();
      player.current = null;
    };
  }, [id]);

  useEffect(() => {
    player.current?.setSpeed(speed);
  }, [id, speed]);

  return (
    <figure>
      <div ref={host} style={{ width: 320, maxWidth: '100%', aspectRatio: '1', background: '#151718' }} />
      <button type="button" onClick={() => {
        const instance = player.current;
        if (instance) instance.playing ? instance.pause() : instance.play();
      }}>
        {playing ? '暂停' : '播放'}
      </button>
    </figure>
  );
}
```

使用方式：`<WorkoutMotion id="bench-press" speed={1.5} />`。切换 `id` 会销毁旧播放器，
再创建新播放器；调整 `speed` 会保留当前进度。组件卸载时也会清理，兼容 React 开发模式下
Strict Mode 的额外创建与清理过程。参见 [React Effect 生命周期](https://react.dev/reference/react/useEffect)。

</details>

### npm

npm 包尚未发布。首次发布后，可运行 `pnpm add @februarysea/workout-motion@0.1.0`，
并将以上示例的相对路径导入改为：

```js
import { createPlayer, getExercise, renderSvg } from '@februarysea/workout-motion/h2';
```

**`/h2` 入口包含当前完整的 29 个动作**；包的根入口保留七个旧版绘图以兼容已有用法。

### 从源码构建

需要 Node.js 20+ 和 pnpm 10.28.2：

```sh
git clone https://github.com/februarysea/workout-motion.git
cd workout-motion
pnpm install --frozen-lockfile
pnpm build
```

命令将动作库编译到 `dist/`，并将 29 个 SVG 导出到 `assets/`。
`assets/manifest.json` 列出动作 ID、名称、时长与文件名。

## 生成指定姿态的 SVG

在 Node.js 中调用 `renderSvg`，可以生成动作任意进度的静态 SVG。
将下面的示例保存为 `export-frame.mjs`，放在下载构建包或源码构建目录中，与 `dist/` 同级，
然后执行 `node export-frame.mjs`：

```js
import { writeFile } from 'node:fs/promises';
import { renderSvg } from './dist/h2.js';

const svg = renderSvg('squat', { phase: 0.5, size: 256, title: '深蹲' });
await writeFile('squat.svg', svg, 'utf8');
```

这会生成 `squat.svg`。`phase` 表示动作进度，范围为 `0` 到 `1`；
`size` 指定 SVG 的像素尺寸。

## API

29 个动作的接口位于 **`/h2` 入口**，构建后对应 `dist/h2.js`：

| 导出 | 用途 |
| --- | --- |
| `exerciseIds` | 包含 29 个动作 ID 的只读列表 |
| `getExercise(id)` | 返回冻结的名称、时长、副标题与可选关键帧元数据；未知 ID 返回 `undefined` |
| `createPlayer(element, id, options?)` | 挂载 SVG 动画并返回控制接口 |
| `renderSvg(id, options?)` | 返回静态 SVG 字符串，可在 Node 和 SSR 中使用，无需 DOM |

播放器提供 `play()`、`pause()`、`seek(phase)`、`setSpeed(speed)`、`destroy()`，
以及只读的 `playing` / `progress`。倍速为正数。
选项包括 `autoplay`、`phase`、`speed`、`title` 和 `onStateChange`。

## SVG 样式

内联 SVG 和播放器继承四个 CSS 变量。例如，为带有 `workout-motion` 类名的容器设置浅色主题：

```css
.workout-motion {
  width: 320px;
  max-width: 100%;
  aspect-ratio: 1;
  background: var(--figure-paper);
  --figure-paper: #f4f1e9;
  --figure-ink: #252720;
  --figure-detail: #55594d;
  --figure-muted: #83877a;
}
```

`--figure-paper` 用于遮住后方轮廓，应与容器背景保持一致；缩放时保留 SVG 的宽高比例。
通过 `<img>` 使用外部 SVG 时，请设置 `background: #151718` 以匹配默认底色；它不会继承页面 CSS 变量。

## 动作目录

将以下 ID 传给 `createPlayer`、`renderSvg` 或 `getExercise`。

<details>
<summary>全部 29 个动作 ID</summary>

| ID | 动作 |
| --- | --- |
| `conventional-deadlift` | 传统硬拉 |
| `sumo-deadlift` | 相扑硬拉 |
| `low-bar-squat` | 低杠深蹲 |
| `reverse-lunge` | 后撤弓步蹲 |
| `glute-bridge` | 臀桥 |
| `hip-thrust` | 杠铃臀推 |
| `single-arm-dumbbell-row` | 单臂哑铃划船 |
| `incline-dumbbell-press` | 上斜哑铃卧推 |
| `dumbbell-shoulder-press` | 站姿哑铃推举 |
| `hammer-curl` | 锤式弯举 |
| `lateral-raise` | 哑铃侧平举 |
| `seated-cable-row` | 坐姿绳索划船 |
| `lat-pulldown` | 高位下拉 |
| `triceps-pushdown` | 绳索三头下压 |
| `dip` | 双杠臂屈伸 |
| `bent-over-row` | 俯身杠铃划船 |
| `barbell-curl` | 杠铃弯举 |
| `front-squat` | 杠铃前蹲 |
| `bench-press` | 卧推 |
| `squat` | 杠铃后蹲 |
| `overhead-press` | 杠铃推举 |
| `romanian-deadlift` | 罗马尼亚硬拉 |
| `pull-up` | 引体向上 |
| `landmine-press` | 单手地雷杆换步推举 |
| `hang-clean` | 悬垂翻 |
| `power-clean` | 高翻 |
| `box-jump` | 双脚跳箱 |
| `depth-box-jump` | 落下反弹跳箱 |
| `lateral-box-jump` | 侧向跳箱 |

</details>

## 许可

[PolyForm Noncommercial 1.0.0](LICENSE) 允许的非商业使用免费，超出其允许用途的商业使用须取得[书面许可](COMMERCIAL-LICENSE.md)。
请保留来源和 [NOTICE](NOTICE)，具体以[完整条款](LICENSE)为准。
