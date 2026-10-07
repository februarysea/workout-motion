# workout-motion

**29 continuous SVG exercise animations**, built around one shared H2 character.
Original geometric artwork for training logs, websites and apps, with no runtime dependencies.

**English** · [简体中文](README.zh-CN.md)

[Explore the gallery](https://jichunhou.me/workout-motion/) ·
[Motion catalog](#motion-catalog) · [Commercial permission](COMMERCIAL-LICENSE.md)

## Build and preview

Requires Node.js 20+ and pnpm 10.28.2. TypeScript 5.9.3 is the only development dependency.
**This project has not been published to npm.** The examples below use files built from this repository.

```sh
git clone https://github.com/februarysea/workout-motion.git
cd workout-motion
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm build:site
pnpm dev
```

- Showcase: http://127.0.0.1:4325/.site/index.html
- Set `PORT` to change the local port.

`pnpm build` creates `dist/` and 29 static SVGs in `assets/`.
`pnpm build:site` also creates the standalone showcase in `.site/`.
The development server does not watch or compile files; rebuild after source changes.

## Add an animation to a webpage

The **`/h2` entry**, built as `dist/h2.js`, provides all 29 H2 motions.
The package root (`dist/index.js`) retains seven legacy drawings with overlapping
IDs; they are not additional motions.

After building, save this complete example as `example.html` in the repository root.
Run `pnpm dev` and open http://127.0.0.1:4325/example.html .
For another website, copy the **entire `dist/` directory**, along with `LICENSE`
and `NOTICE`, next to the HTML file. Serve it over HTTP; do not open it with `file://`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>workout-motion example</title>
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
    <button id="toggle" type="button" disabled>Play animation</button>
    <p id="motion-note" hidden>Animation is paused by your reduced-motion preference.</p>

    <script type="module">
      import { createPlayer } from './dist/h2.js';

      const button = document.querySelector('#toggle');
      const note = document.querySelector('#motion-note');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

      function updateControls(playing) {
        button.disabled = reducedMotion.matches;
        button.textContent = playing ? 'Pause animation' : 'Play animation';
        note.hidden = !reducedMotion.matches;
      }

      const player = createPlayer(document.querySelector('#motion'), 'bench-press', {
        autoplay: true,
        speed: 1,
        title: 'Bench press',
        onStateChange: updateControls,
      });

      button.addEventListener('click', () => {
        if (player.playing) player.pause();
        else player.play();
      });
      reducedMotion.addEventListener('change', () => updateControls(player.playing));
      updateControls(player.playing);

      // Other controls: player.seek(0.35); player.setSpeed(0.75);
      // Call player.destroy() before removing its host or unmounting a component.
    </script>
  </body>
</html>
```

Replace `bench-press` with any ID in the [catalog](#motion-catalog).
The player respects reduced motion, pauses while its document is hidden or its
host is offscreen, and resumes when eligible if playback is still requested.
Keep the visible pause control. When integrating into a framework, mount after the
host exists and call `player.destroy()` during component cleanup.

## Metadata and player controls

```js
import { exerciseIds, getExercise } from './dist/h2.js';

console.log(exerciseIds.length); // 29
const exercise = getExercise('bench-press');
console.log(exercise.label, exercise.chinese, exercise.durationMs);
// Also available: id, subtitle, and optional keyframes [{ phase, label }].
```

Metadata is frozen. `getExercise` returns `undefined` for an unknown ID.
If you package and install this repository locally, its equivalent module specifier
is `@februarysea/workout-motion/h2`; the browser example uses built files directly.

| Player member | Behavior |
| --- | --- |
| `play()` / `pause()` | Request or pause playback; visibility and motion preferences still apply |
| `seek(phase)` | Set a finite phase, clamped to 0–1; does not automatically pause |
| `setSpeed(speed)` | Set a positive finite multiplier; default is `1` |
| `playing` / `progress` | Read actual playback state / current phase |
| `destroy()` | Remove the SVG and release the player's listeners, observer and animation loop |

`createPlayer` options include `autoplay`, `speed`, `phase`, `title`, `decorative`,
`respectReducedMotion` and `onStateChange`. Keep reduced-motion support enabled.
`createPlayer` and `renderSvg` throw for unknown IDs or invalid numeric values.
Complete types are generated in `dist/h2.d.ts`.

## Use a static SVG

The build exports a ready-to-use still for every H2 motion, plus `assets/manifest.json`,
`assets/LICENSE` and `assets/NOTICE`. To display one without JavaScript:

```html
<img
  src="./assets/bench-press.svg"
  alt="Bench press illustration"
  width="320"
  height="320"
  style="max-width:100%;height:auto;background:#151718"
/>
```

These files use dark fallback colors, with `#151718` as the paper color.
An external SVG loaded through `<img>` does not inherit the page's CSS variables.
For a self-contained SVG in the current gallery theme and pose, use the
[gallery's SVG download](https://jichunhou.me/workout-motion/).

For a different phase, inline rendering, or Node/server-side rendering:

```js
import { renderSvg } from './dist/h2.js';

const svg = renderSvg('bench-press', {
  phase: 0.35,       // Position within one complete cycle: 0–1
  size: 320,
  title: 'Bench press illustration',
});

// Browser: add <div id="still" class="motion"></div> with the styles above.
document.querySelector('#still').innerHTML = svg;
// In Node/SSR, use the returned SVG string; renderSvg itself requires no DOM.
```

Each motion has an authored camera viewBox. Scale the whole SVG and preserve its
aspect ratio. Inline SVGs inherit `--figure-paper`, `--figure-ink`,
`--figure-detail` and `--figure-muted`; match paper to the host background so
farther outlines stay hidden. The artwork does not provide background-independent
transparent occlusion. Static renders at 80 px or below simplify detail;
live players retain their full geometry and scale with the host.

## Motion catalog

Use these exact IDs with `getExercise`, `renderSvg` and `createPlayer`.

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

## Origins

The code and original geometric artwork were created with AI assistance;
the original character concept images are not embedded in generated SVGs.
The project grew out of an experiment with [Workout Guide](https://github.com/bryllim/workout-guide),
whose artwork is not included or relicensed here.
These are interface illustrations, not professionally validated exercise guidance.

## License

Noncommercial use is free under [PolyForm Noncommercial 1.0.0](LICENSE); commercial
use outside its permissions requires [written permission](COMMERCIAL-LICENSE.md).
Retain attribution and [NOTICE](NOTICE); the [full terms](LICENSE) govern.
