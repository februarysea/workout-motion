# workout-motion

**29 个连续 SVG 运动动画**，共用同一 H2 人物母版。
为训练记录、网站与应用制作的原创几何插画，无运行时依赖。

[English](README.md) · **简体中文**

[浏览动作库](https://jichunhou.me/workout-motion/) ·
[动作目录](#动作目录) · [商业授权](COMMERCIAL-LICENSE.md)

## 本地构建与预览

需要 Node.js 20+ 和 pnpm 10.28.2，唯一开发依赖是 TypeScript 5.9.3。
**项目尚未发布到 npm。** 下方示例直接使用本仓库构建出的文件。

```sh
git clone https://github.com/februarysea/workout-motion.git
cd workout-motion
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm build:site
pnpm dev
```

- 展示网站：http://127.0.0.1:4325/.site/index.html
- 可通过 `PORT` 设置其他端口。

`pnpm build` 生成 `dist/` 及 `assets/` 中的 29 张静态 SVG；
`pnpm build:site` 还会生成独立展示网站 `.site/`。
开发服务器不会监听或编译文件，修改源码后需要重新构建。

## 在网页中接入动画

**`/h2` 入口**对应构建产物 `dist/h2.js`，包含全部 29 个 H2 动作。
包根入口 `dist/index.js` 保留七个旧版绘图，其 ID 与 H2 重叠，不能重复计数。

构建后，将下面完整示例保存为仓库根目录的 `example.html`。
运行 `pnpm dev` 后打开 http://127.0.0.1:4325/example.html 。
接入其他网站时，将**整个 `dist/` 目录**及 `LICENSE`、`NOTICE` 放到 HTML 同级目录，
通过 HTTP 服务访问，不要直接以 `file://` 打开。

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>workout-motion 接入示例</title>
    <style>
      .motion {
        width: 320px;
        max-width: 100%;
        aspect-ratio: 1;
        background: #111;
        --figure-paper: #111;
        --figure-ink: #e9e9e9;
        --figure-detail: #bdbdbd;
        --figure-muted: #888;
      }
    </style>
  </head>
  <body>
    <div id="motion" class="motion"></div>
    <button id="toggle" type="button" disabled>播放动画</button>
    <p id="motion-note" hidden>已跟随系统的减少动态偏好暂停动画。</p>

    <script type="module">
      import { createPlayer } from './dist/h2.js';

      const button = document.querySelector('#toggle');
      const note = document.querySelector('#motion-note');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

      function updateControls(playing) {
        button.disabled = reducedMotion.matches;
        button.textContent = playing ? '暂停动画' : '播放动画';
        note.hidden = !reducedMotion.matches;
      }

      const player = createPlayer(document.querySelector('#motion'), 'bench-press', {
        autoplay: true,
        speed: 1,
        title: '卧推',
        onStateChange: updateControls,
      });

      button.addEventListener('click', () => {
        if (player.playing) player.pause();
        else player.play();
      });
      reducedMotion.addEventListener('change', () => updateControls(player.playing));
      updateControls(player.playing);

      // 其他控制：player.seek(0.35); player.setSpeed(0.75);
      // 移除容器或卸载组件前，调用 player.destroy()。
    </script>
  </body>
</html>
```

将 `bench-press` 替换为[动作目录](#动作目录)中的其他 ID 即可。
播放器尊重系统减少动态偏好，并在页面隐藏或容器离屏时暂停；
若仍有播放请求，恢复可见且符合播放条件后会继续。
保留可见的暂停按钮；接入框架时，在容器挂载后创建播放器，组件卸载时调用 `player.destroy()`。

## 元数据与播放器控制

```js
import { exerciseIds, getExercise } from './dist/h2.js';

console.log(exerciseIds.length); // 29
const exercise = getExercise('bench-press');
console.log(exercise.label, exercise.chinese, exercise.durationMs);
// 还包含 id、subtitle，以及可选的 keyframes [{ phase, label }]。
```

元数据已冻结；未知 ID 的 `getExercise` 返回 `undefined`。
如果自行将本仓库打包并安装到本地项目，对应模块路径为
`@februarysea/workout-motion/h2`；上面的浏览器示例直接导入构建文件。

| 播放器成员 | 行为 |
| --- | --- |
| `play()` / `pause()` | 请求播放或暂停，仍遵守可见性和减少动态偏好 |
| `seek(phase)` | 设置有限数值的相位，限制在 0–1；不会自动暂停 |
| `setSpeed(speed)` | 设置正的有限倍速，默认 `1` |
| `playing` / `progress` | 读取实际播放状态 / 当前相位 |
| `destroy()` | 移除 SVG，释放播放器的事件监听、可见性观察器与动画循环 |

`createPlayer` 支持 `autoplay`、`speed`、`phase`、`title`、`decorative`、
`respectReducedMotion` 和 `onStateChange`，请保留减少动态支持。
`createPlayer` 和 `renderSvg` 对未知 ID 或非法数值会抛出错误；完整类型见构建后的 `dist/h2.d.ts`。

## 使用静态 SVG

构建会为每个 H2 动作导出静态图，同时生成 `assets/manifest.json`、
`assets/LICENSE` 和 `assets/NOTICE`。无需 JavaScript 即可使用：

```html
<img
  src="./assets/bench-press.svg"
  alt="卧推动作示意图"
  width="320"
  height="320"
  style="max-width:100%;height:auto;background:#151718"
/>
```

这些文件使用默认深色配色，底色为 `#151718`。
通过 `<img>` 引用的外部 SVG 不会继承页面 CSS 变量。
需要嵌入当前主题和姿态的独立 SVG，可在[动作库网页](https://jichunhou.me/workout-motion/)中下载。

需要其他相位、内联 SVG，或在 Node/服务端渲染时：

```js
import { renderSvg } from './dist/h2.js';

const svg = renderSvg('bench-press', {
  phase: 0.35,       // 一个完整动作周期中的位置：0–1
  size: 320,
  title: '卧推动作示意图',
});

// 浏览器：添加 <div id="still" class="motion"></div>，沿用前面的样式。
document.querySelector('#still').innerHTML = svg;
// Node/SSR 中使用返回的 SVG 字符串；renderSvg 本身不需要 DOM。
```

每个动作使用自己的相机 viewBox，请整体缩放并保持宽高比例。
内联 SVG 继承 `--figure-paper`、`--figure-ink`、`--figure-detail`
和 `--figure-muted`；底色应与容器背景一致，以遮住后方轮廓。
当前绘制方式并非适配任意透明背景的消隐方案。
80 px 及以下的静态渲染会简化细节，动态播放器始终保留完整几何并随容器缩放。

## 动作目录

将下列 ID 原样传给 `getExercise`、`renderSvg` 或 `createPlayer`。

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

## 来源

代码与原创几何图稿由 AI 辅助制作，原始人物概念图不嵌入生成的 SVG。
项目起源于使用 [Workout Guide](https://github.com/bryllim/workout-guide) 的实验，
不包含其绘图，也不对其绘图重新授予许可。
这些插画用于界面展示，不替代经过专业验证的训练指导。

## 许可

[PolyForm Noncommercial 1.0.0](LICENSE) 允许的非商业使用免费，超出其允许用途的商业使用须取得[书面许可](COMMERCIAL-LICENSE.md)。
请保留来源和 [NOTICE](NOTICE)，具体以[完整条款](LICENSE)为准。
