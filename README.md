# workout-motion

An SVG exercise animation library for training logs, fitness apps and websites.

**[Live demo](https://jichunhou.me/workout-motion/)** · **English** · [简体中文](README.zh-CN.md)

- **29 continuous animations** with a consistent visual style, with more to come.
- **No runtime dependencies**, with a framework-independent JavaScript API.
- **Playback and static output**: pause, seek, adjust speed, or render any frame as SVG.

| Squat | Bench Press | Deadlift | Pull-up |
| :---: | :---: | :---: | :---: |
| [![Squat](site/previews/squat.gif)](https://jichunhou.me/workout-motion/?lang=en&motion=squat) | [![Bench Press](site/previews/bench-press.gif)](https://jichunhou.me/workout-motion/?lang=en&motion=bench-press) | [![Deadlift](site/previews/conventional-deadlift.gif)](https://jichunhou.me/workout-motion/?lang=en&motion=conventional-deadlift) | [![Pull-up](site/previews/pull-up.gif)](https://jichunhou.me/workout-motion/?lang=en&motion=pull-up) |

Full motion loops at 2× speed. Click a preview for interactive playback.

## Getting started

Build the SVG assets from source with Node.js 20+ and pnpm 10.28.2:

```sh
git clone https://github.com/februarysea/workout-motion.git
cd workout-motion
pnpm install --frozen-lockfile
pnpm build
```

The build generates:

- `assets/<id>.svg` — one SVG for each of the 29 motions, ready to use as an image.
- `assets/manifest.json` — motion IDs, names, durations and SVG filenames.
- `dist/` — JavaScript modules and TypeScript declarations for rendering and playback.

The exported SVGs are static frames at phase `0.2`. Continuous animation uses the
JavaScript player.

## Render a specific frame

After building, use `renderSvg` in Node.js to generate an SVG at any point in a
motion. Save this example as `export-frame.mjs` in the repository root and run
`node export-frame.mjs`:

```js
import { writeFile } from 'node:fs/promises';
import { renderSvg } from './dist/h2.js';

const svg = renderSvg('squat', { phase: 0.5, size: 256, title: 'Squat' });
await writeFile('squat.svg', svg, 'utf8');
```

This creates `squat.svg`. `phase` selects a point in the motion from `0` to `1`;
`size` sets the SVG dimensions in pixels.

## API

The 29-motion library uses the **`/h2` entry**, built as `dist/h2.js`:

| Export | Purpose |
| --- | --- |
| `exerciseIds` | Read-only list of the 29 motion IDs |
| `getExercise(id)` | Frozen metadata: names, duration, subtitle and optional keyframes; `undefined` for an unknown ID |
| `createPlayer(element, id, options?)` | Mount an SVG animation and return its controls |
| `renderSvg(id, options?)` | Return a static SVG string; works in Node and SSR without a DOM |

For animation in an application, pass a mounted HTML element as `host`:

```js
import { createPlayer } from './dist/h2.js';

const player = createPlayer(host, 'bench-press', { autoplay: false });
```

Players expose `play()`, `pause()`, `seek(phase)`, `setSpeed(speed)`, `destroy()`,
and read-only `playing` / `progress`. Speed is a positive multiplier. Options
include `autoplay`, `phase`, `speed`, `title` and `onStateChange`.
Connect playback controls to these methods and keep a visible pause control.
Playback respects reduced motion and pauses when the page is hidden or the
player is offscreen. Call `destroy()` when removing the host.

## SVG appearance

Inline SVGs and players inherit four CSS variables. For example, apply a light
theme to a host with the `workout-motion` class:

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

Match the host background to `--figure-paper`, which masks hidden outlines, and
preserve the SVG's aspect ratio. For external SVGs in `<img>`, set
`background: #151718` to match the default paper color; they do not inherit page CSS variables.

## Exercises

Pass any of these IDs to `createPlayer`, `renderSvg` or `getExercise`.

<details>
<summary>All 29 motion IDs</summary>

| ID | Motion |
| --- | --- |
| `conventional-deadlift` | Conventional Deadlift |
| `sumo-deadlift` | Sumo Deadlift |
| `low-bar-squat` | Low-bar Back Squat |
| `reverse-lunge` | Reverse Lunge |
| `glute-bridge` | Glute Bridge |
| `hip-thrust` | Barbell Hip Thrust |
| `single-arm-dumbbell-row` | Single-arm Dumbbell Row |
| `incline-dumbbell-press` | Incline Dumbbell Press |
| `dumbbell-shoulder-press` | Dumbbell Shoulder Press |
| `hammer-curl` | Hammer Curl |
| `lateral-raise` | Lateral Raise |
| `seated-cable-row` | Seated Cable Row |
| `lat-pulldown` | Lat Pulldown |
| `triceps-pushdown` | Cable Triceps Pushdown |
| `dip` | Parallel-bar Dip |
| `bent-over-row` | Bent-over Barbell Row |
| `barbell-curl` | Barbell Curl |
| `front-squat` | Barbell Front Squat |
| `bench-press` | Bench Press |
| `squat` | Barbell Back Squat |
| `overhead-press` | Overhead Press |
| `romanian-deadlift` | Romanian Deadlift |
| `pull-up` | Pull-up |
| `landmine-press` | Landmine Split-switch Push Press |
| `hang-clean` | Hang Power Clean |
| `power-clean` | Power Clean |
| `box-jump` | Standing Box Jump |
| `depth-box-jump` | Drop-to-Box Jump |
| `lateral-box-jump` | Lateral Box Jump |

</details>

## License

Noncommercial use is free under [PolyForm Noncommercial 1.0.0](LICENSE); commercial
use outside its permissions requires [written permission](COMMERCIAL-LICENSE.md).
Retain attribution and [NOTICE](NOTICE); the [full terms](LICENSE) govern.
