import { getExercise, renderSvg } from "./index.js";

export interface PlayerOptions {
  autoplay?: boolean;
  speed?: number;
  phase?: number;
  respectReducedMotion?: boolean;
  onStateChange?: (playing: boolean) => void;
}

export interface WorkoutPlayer {
  play(): void;
  pause(): void;
  seek(phase: number): void;
  setSpeed(speed: number): void;
  destroy(): void;
  readonly playing: boolean;
  readonly progress: number;
}

function validSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) throw new RangeError("speed must be positive and finite");
  return speed;
}

/** Mount one SVG player. Importing this module itself never accesses the DOM. */
export function createPlayer(host: HTMLElement, id: string, options: PlayerOptions = {}): WorkoutPlayer {
  const exercise = getExercise(id);
  if (!exercise) throw new RangeError(`Unknown exercise: ${id}`);
  let speed = validSpeed(options.speed ?? 1);
  let phase = options.phase ?? 0;
  if (!Number.isFinite(phase)) throw new RangeError("phase must be finite");
  phase = Math.max(0, Math.min(1, phase));
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error("createPlayer requires a browser document");
  host.innerHTML = renderSvg(id, { phase });
  const svg = host.querySelector<SVGSVGElement>("svg")!;
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.display = "block";
  const paths = [...svg.querySelectorAll<SVGPathElement>("[data-part]")];
  const media = win.matchMedia("(prefers-reduced-motion: reduce)");
  let wantsPlayback = options.autoplay ?? true;
  let inView = !("IntersectionObserver" in win);
  let running = false;
  let destroyed = false;
  let frame = 0;
  let lastTime: number | null = null;

  const paint = () => {
    exercise.pose(phase).forEach((part, index) => {
      paths[index].setAttribute("d", part.d);
      if (part.transform) paths[index].setAttribute("transform", part.transform);
    });
  };
  const tick = (time: number) => {
    if (!running || destroyed) return;
    if (lastTime !== null) phase = (phase + (time - lastTime) * speed / exercise.durationMs) % 1;
    lastTime = time;
    paint();
    frame = win.requestAnimationFrame(tick);
  };
  const sync = () => {
    const shouldRun = !destroyed && wantsPlayback && inView && !doc.hidden && !(media.matches && options.respectReducedMotion !== false);
    if (running === shouldRun) return;
    running = shouldRun;
    lastTime = null;
    if (running) frame = win.requestAnimationFrame(tick);
    else win.cancelAnimationFrame(frame);
    options.onStateChange?.(running);
  };
  const observer = "IntersectionObserver" in win ? new win.IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  }) : null;
  observer?.observe(host);
  doc.addEventListener("visibilitychange", sync);
  media.addEventListener("change", sync);
  sync();

  return {
    play() { if (!destroyed) { wantsPlayback = true; sync(); } },
    pause() { wantsPlayback = false; sync(); },
    seek(value) {
      if (!Number.isFinite(value)) throw new RangeError("phase must be finite");
      if (destroyed) return;
      phase = Math.max(0, Math.min(1, value));
      lastTime = null;
      paint();
    },
    setSpeed(value) { speed = validSpeed(value); lastTime = null; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      sync();
      observer?.disconnect();
      doc.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
      svg.remove();
    },
    get playing() { return running; },
    get progress() { return phase; },
  };
}
