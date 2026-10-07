import type { ExerciseMotion, MotionPart, Point } from "./types.js";
import { barbell, circle, cycle, ink, joint, limb, line, p, solid, xy } from "./geometry.js";

// Original path geometry. The feet, bones, and bar are independent rigid pieces;
// intermediate poses are calculated rather than cross-fading still drawings.
const nearAnkle = p(151, 280);
const farAnkle = p(133, 277);
const thighLength = 60;
const shinLength = 60;
const torsoLength = 73;
const armLength = 34;

interface BodyPose {
  hip: Point;
  lean: number;
  bar: Point;
  rack?: boolean;
}

function local(origin: Point, lean: number, x: number, y: number): Point {
  return p(origin.x + Math.cos(lean) * x - Math.sin(lean) * y,
    origin.y + Math.sin(lean) * x + Math.cos(lean) * y);
}

function shoe(id: string, ankle: Point, opacity = 1): MotionPart {
  return solid(id, `${line(p(ankle.x - 8, ankle.y - 4), p(ankle.x + 5, ankle.y - 3), p(ankle.x + 13, ankle.y + 4))} Q${xy(p(ankle.x + 23, ankle.y + 4))} ${xy(p(ankle.x + 22, ankle.y + 10))} L${xy(p(ankle.x - 10, ankle.y + 10))} Z`, { opacity });
}

function head(shoulder: Point, lean: number): MotionPart[] {
  const origin = local(shoulder, lean, 1, -27);
  const at = (x: number, y: number) => xy(local(origin, lean, x, y));
  return [
    solid("neck", limb([local(shoulder, lean, 0, -1), local(shoulder, lean, 0, -19)], 6)),
    solid("head", `M${at(-10, -5)} Q${at(-11, -16)} ${at(0, -16)} Q${at(11, -16)} ${at(11, -6)} L${at(15, 0)} L${at(11, 2)} L${at(10, 9)} Q${at(3, 14)} ${at(-4, 9)} L${at(-9, 5)} Z`),
    ink("hair", `M${at(-9, -5)} Q${at(-4, -12)} ${at(10, -8)}`, { opacity: 0.65, strokeWidth: 1.5 }),
    ink("ear", `M${at(-3, 0)} Q${at(-6, -5)} ${at(-7, -1)} Q${at(-7, 3)} ${at(-4, 4)}`, { strokeWidth: 1.4 }),
  ];
}

function torso(hip: Point, shoulder: Point, lean: number): MotionPart[] {
  const atHip = (x: number, y: number) => local(hip, lean, x, y);
  const atShoulder = (x: number, y: number) => local(shoulder, lean, x, y);
  return [
    solid("torso", `M${xy(atHip(-13, 3))} Q${xy(atHip(-17, -18))} ${xy(atShoulder(-17, 15))} Q${xy(atShoulder(-18, 0))} ${xy(atShoulder(-8, -3))} L${xy(atShoulder(9, -2))} Q${xy(atShoulder(22, 6))} ${xy(atShoulder(16, 26))} L${xy(atHip(12, 0))} Z`),
    ink("shirt-side", `M${xy(atShoulder(5, 17))} Q${xy(atHip(7, -27))} ${xy(atHip(5, -7))}`, { opacity: 0.45, strokeWidth: 1.2 }),
    ink("shirt-neck", `M${xy(atShoulder(-6, -2))} Q${xy(atShoulder(0, 9))} ${xy(atShoulder(9, -1))}`, { strokeWidth: 1.3 }),
    ink("waistband", line(atHip(-13, -5), atHip(13, -5)), { strokeWidth: 2 }),
  ];
}

function draw({ hip, lean, bar, rack = false }: BodyPose): MotionPart[] {
  const shoulder = local(hip, lean, 0, -torsoLength);
  const farHip = p(hip.x - 9, hip.y - 2);
  const nearKnee = joint(hip, nearAnkle, thighLength, shinLength, -1);
  const farKnee = joint(farHip, farAnkle, thighLength, shinLength, -1);
  const nearShoulder = p(shoulder.x + 7, shoulder.y + 2);
  const farShoulder = p(shoulder.x - 7, shoulder.y - 1);
  const nearHand = p(bar.x + 13, bar.y);
  const farHand = p(bar.x - 13, bar.y);
  const nearElbow = joint(nearShoulder, nearHand, armLength, armLength, rack ? 1 : -1);
  const farElbow = joint(farShoulder, farHand, armLength, armLength, rack ? -1 : 1);
  const shortsEnd = p(hip.x + (nearKnee.x - hip.x) * 0.45, hip.y + (nearKnee.y - hip.y) * 0.45);
  return [
    ink("floor", line(p(93, 292), p(202, 292)), { opacity: 0.22, strokeWidth: 1.5 }),
    solid("far-leg", limb([farHip, farKnee, farAnkle], 10.5), { opacity: 0.5 }),
    shoe("far-shoe", farAnkle, 0.5),
    solid("far-arm", limb([farShoulder, farElbow, farHand], 7), { opacity: 0.5 }),
    solid("near-leg", limb([hip, nearKnee, nearAnkle], 12)),
    ink("knee", `M${xy(p(nearKnee.x + 5, nearKnee.y - 4))} Q${xy(p(nearKnee.x + 10, nearKnee.y))} ${xy(p(nearKnee.x + 6, nearKnee.y + 5))}`, { opacity: 0.55, strokeWidth: 1.4 }),
    shoe("near-shoe", nearAnkle),
    solid("shorts", limb([p(hip.x - 2, hip.y - 3), shortsEnd], 15)),
    ink("shorts-hem", line(p(shortsEnd.x - 9, shortsEnd.y + 7), p(shortsEnd.x + 9, shortsEnd.y - 5)), { opacity: 0.55, strokeWidth: 1.4 }),
    ...head(shoulder, lean),
    ...torso(hip, shoulder, lean),
    solid("near-arm", limb([nearShoulder, nearElbow, nearHand], 8)),
    ink("arm-detail", line(p(nearShoulder.x + 3, nearShoulder.y + 6), p(nearElbow.x + 2, nearElbow.y - 5)), { opacity: 0.35, strokeWidth: 1.2 }),
    ...barbell("bar", bar, 47, 0, 19),
    solid("far-hand", circle(farHand, 4), { opacity: 0.8 }),
    solid("near-hand", circle(nearHand, 4.5)),
  ];
}

export const squat: ExerciseMotion = {
  id: "squat",
  label: "Squat",
  durationMs: 3400,
  pose(phase) {
    const depth = cycle(phase);
    const hip = p(140 - 30 * depth, 165 + 57 * depth);
    const lean = 0.1 + 0.44 * depth;
    const shoulder = local(hip, lean, 0, -torsoLength);
    return draw({ hip, lean, bar: p(shoulder.x - 1, shoulder.y - 4), rack: true });
  },
};

export const romanianDeadlift: ExerciseMotion = {
  id: "romanian-deadlift",
  label: "Romanian Deadlift",
  durationMs: 3600,
  pose(phase) {
    const hinge = cycle(phase);
    const hip = p(142 - 27 * hinge, 166 + 18 * hinge);
    const lean = 0.05 + 1.34 * hinge;
    const shoulder = local(hip, lean, 0, -torsoLength);
    return draw({ hip, lean, bar: p(shoulder.x + 7, shoulder.y + 63) });
  },
};

// A periodic monotone cubic curve is C1 across every stage and the loop seam.
// These coordinates describe an illustrative hang clean, not a technique guide.
// The last two values locate the bar relative to the shoulder, keeping the grip
// within arm reach as the torso changes angle.
const cleanStages = [
  [134, 180, 0.30, 16, 63], // hang, just above the knee
  [141, 164, -0.015, 24, 59], // extension
  [141, 163, 0.02, 27, 27], // pull under the rising bar
  [128, 202, 0.17, 16, 5], // shallow catch
  [141, 166, 0.02, 17, 6], // stand with the bar racked
  [141, 166, 0.02, 20, 60], // lower before the next repetition
] as const;

function cleanPoint(phase: number): number[] {
  const position = ((phase % 1 + 1) % 1) * cleanStages.length;
  const index = Math.floor(position);
  const t = position - index;
  const row = (offset: number) => cleanStages[(index + offset + cleanStages.length) % cleanStages.length];
  return row(0).map((value, column) => {
    const a = row(-1)[column];
    const b = value;
    const c = row(1)[column];
    const d = row(2)[column];
    const tangent = (before: number, after: number) => before * after <= 0 ? 0 : 2 * before * after / (before + after);
    const start = tangent(b - a, c - b);
    const end = tangent(c - b, d - c);
    return (2 * t ** 3 - 3 * t ** 2 + 1) * b + (t ** 3 - 2 * t ** 2 + t) * start
      + (-2 * t ** 3 + 3 * t ** 2) * c + (t ** 3 - t ** 2) * end;
  });
}

export const hangClean: ExerciseMotion = {
  id: "hang-clean",
  label: "Hang Clean",
  durationMs: 4200,
  pose(phase) {
    const [x, y, lean, barX, barY] = cleanPoint(phase);
    const hip = p(x, y);
    const shoulder = local(hip, lean, 0, -torsoLength);
    return draw({ hip, lean, bar: p(shoulder.x + barX, shoulder.y + barY) });
  },
};
