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

[Download v0.1.0](https://github.com/februarysea/workout-motion/releases/download/v0.1.0/workout-motion-0.1.0.zip)
and unzip it. The ready-to-use bundle includes all JavaScript modules and TypeScript
declarations in `dist/`, 29 static SVGs and their catalog in `assets/`, and the
license files. No compilation is needed.

- **Static image:** use `assets/<id>.svg` in an image tag, document or design.
- **Interactive animation:** use `dist/h2.js` with the examples below. Keep the
  entire `dist/` directory together; `h2.js` imports other modules from it.
- **Source build:** use the build instructions below if you want to edit the library.

An exported SVG is a **static frame**, sampled at phase `0.2`. Continuous playback
uses the JavaScript player; downloading an SVG does not create an animated image.

### JavaScript

Save this as `index.html` beside the extracted `dist/` directory and serve the
folder with your development server. Open its HTTP URL, rather than opening the
HTML as a local file, so the browser can load ES modules.

<details>
<summary>Complete HTML example</summary>

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workout motion</title>
<div id="motion" style="width:320px;max-width:100%;aspect-ratio:1;background:#151718"></div>
<button id="toggle" type="button">Play</button>
<label>Speed
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
    title: 'Bench press',
    onStateChange(playing) {
      button.textContent = playing ? 'Pause' : 'Play';
    },
  });
  button.textContent = player.playing ? 'Pause' : 'Play';
  button.onclick = () => player.playing ? player.pause() : player.play();
  document.querySelector('#speed').onchange = (event) => {
    player.setSpeed(Number(event.target.value));
  };
  // Before removing the motion container: player.destroy();
</script>
</html>
```

</details>

The player respects reduced motion and pauses when the page is hidden or the
container is offscreen. Keep a visible pause control and call `destroy()` before
removing a player from an application.

### React

Copy the bundle's complete `dist/` directory to `src/workout-motion/` in your
React app, then save the component below as `src/WorkoutMotion.jsx`. No React
adapter package is required.

<details>
<summary>React component with playback control</summary>

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
      title: getExercise(id).label,
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
        {playing ? 'Pause' : 'Play'}
      </button>
    </figure>
  );
}
```

Use it as `<WorkoutMotion id="bench-press" speed={1.5} />`. Changing `id` destroys
the old player and creates the new one; changing `speed` keeps the current
progress. Cleanup also runs on unmount, including React's development Strict Mode
setup/cleanup cycle. See [React's Effect lifecycle](https://react.dev/reference/react/useEffect).

</details>

### npm

The npm package is not published yet. After the first release, install it with
`pnpm add @februarysea/workout-motion@0.1.0` and replace the relative imports above with:

```js
import { createPlayer, getExercise, renderSvg } from '@februarysea/workout-motion/h2';
```

The **`/h2` entry contains all 29 current motions**. The package root retains
seven older drawings for compatibility.

### Build from source

Requires Node.js 20+ and pnpm 10.28.2:

```sh
git clone https://github.com/februarysea/workout-motion.git
cd workout-motion
pnpm install --frozen-lockfile
pnpm build
```

This builds the library into `dist/` and exports the 29 SVGs into `assets/`.
`assets/manifest.json` lists their IDs, names, durations and filenames.

## Render a specific frame

Use `renderSvg` in Node.js to generate a static SVG at any point in a motion.
Save this as `export-frame.mjs` beside `dist/` in the downloaded bundle or built
source repository, then run `node export-frame.mjs`:

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

Players expose `play()`, `pause()`, `seek(phase)`, `setSpeed(speed)`, `destroy()`,
and read-only `playing` / `progress`. Speed is a positive multiplier. Options
include `autoplay`, `phase`, `speed`, `title` and `onStateChange`.

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
