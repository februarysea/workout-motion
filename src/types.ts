export type Point = { x: number; y: number };

/** Every pose uses the same ordered part IDs; only path geometry changes. */
export interface MotionPart {
  id: string;
  d: string;
  fill?: string;
  opacity?: number;
  strokeWidth?: number;
  transform?: string;
}

export interface ExerciseMotion {
  id: string;
  label: string;
  durationMs: number;
  /** A complete repetition, in the range [0, 1], on a 320 × 320 canvas. */
  pose: (phase: number) => MotionPart[];
}
