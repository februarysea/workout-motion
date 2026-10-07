import { benchPress, landminePress } from "./presses.js";
import { overheadPress, pullUp } from "./vertical.js";
import { squat, romanianDeadlift, hangClean } from "./lower.js";
import type { ExerciseMotion } from "./types.js";

export type { ExerciseMotion, MotionPart, Point } from "./types.js";
export { createPlayer } from "./player.js";
export type { PlayerOptions, WorkoutPlayer } from "./player.js";

const motions = [benchPress, overheadPress, landminePress, squat, romanianDeadlift, pullUp, hangClean] as const;
export const exerciseIds: readonly string[] = Object.freeze(motions.map((motion) => motion.id));
const catalog = new Map(motions.map((motion) => [motion.id, motion]));

export function getExercise(id: string): ExerciseMotion | undefined {
  return catalog.get(id);
}

export interface SvgOptions {
  phase?: number;
  size?: number;
  title?: string;
}

const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);

/** A self-contained still pose; safe to call in Node or during server rendering. */
export function renderSvg(id: string, { phase = 0, size = 320, title }: SvgOptions = {}): string {
  const exercise = getExercise(id);
  if (!exercise) throw new RangeError(`Unknown exercise: ${id}`);
  if (!Number.isFinite(phase)) throw new RangeError("phase must be finite");
  if (!Number.isFinite(size) || size <= 0) throw new RangeError("size must be positive and finite");
  const label = title ?? exercise.label;
  const parts = exercise.pose(Math.max(0, Math.min(1, phase))).map((part) => `<path data-part="${escapeXml(part.id)}" d="${escapeXml(part.d)}" fill="${escapeXml(part.fill ?? "none")}" opacity="${part.opacity ?? 1}" stroke-width="${part.strokeWidth ?? 2.5}"${part.transform ? ` transform="${escapeXml(part.transform)}"` : ""}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="${size}" height="${size}" role="img" aria-label="${escapeXml(label)}" stroke="currentColor" color="#e7e5e4" stroke-linecap="round" stroke-linejoin="round"><title>${escapeXml(label)}</title>${parts}</svg>`;
}
