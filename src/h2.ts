import { createStudyPlayer, renderStudy, reviewStudies } from "./review.js";
import type { PlayerOptions, WorkoutPlayer } from "./player.js";

export type { WorkoutPlayer } from "./player.js";

export interface H2Exercise {
  readonly id: string;
  readonly label: string;
  readonly chinese: string;
  readonly subtitle: string;
  readonly durationMs: number;
  readonly keyframes?: readonly Readonly<{ phase: number; label: string }>[];
}

export interface H2SvgOptions {
  phase?: number;
  size?: number;
  title?: string;
  decorative?: boolean;
}

export interface H2PlayerOptions extends PlayerOptions {
  title?: string;
  decorative?: boolean;
}

const catalog = new Map<string, H2Exercise>(reviewStudies.map((study) => {
  const { id, label, chinese, subtitle, durationMs, keyframes } = study;
  const metadata: H2Exercise = Object.freeze({
    id, label, chinese, subtitle, durationMs,
    ...(keyframes ? { keyframes: Object.freeze(keyframes.map((keyframe) => Object.freeze({ ...keyframe }))) } : {}),
  });
  return [id, metadata];
}));

export const exerciseIds: readonly string[] = Object.freeze([...catalog.keys()]);

/** Immutable metadata; the internal joint rig and pose functions remain private. */
export function getExercise(id: string): H2Exercise | undefined {
  return catalog.get(id);
}

function requireExercise(id: string): H2Exercise {
  const exercise = getExercise(id);
  if (!exercise) throw new RangeError(`Unknown exercise: ${id}`);
  return exercise;
}

/** Render one H2 pose without accessing the DOM; size <= 80 uses thumbnail detail. */
export function renderSvg(id: string, options: H2SvgOptions = {}): string {
  const exercise = requireExercise(id);
  return renderStudy(id, { ...options, title: options.title ?? exercise.chinese });
}

/** Mount the full-detail H2 player; size its host with CSS and destroy on unmount. */
export function createPlayer(host: HTMLElement, id: string, options: H2PlayerOptions = {}): WorkoutPlayer {
  const exercise = requireExercise(id);
  return createStudyPlayer(host, id, { ...options, title: options.title ?? exercise.chinese });
}
