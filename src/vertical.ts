import type { ExerciseMotion, MotionPart } from "./types.js";
import { barbell, circle, cycle, ink, joint, lerp, limb, line, n, p, solid } from "./geometry.js";

function frontBody(offset: number, tucked = false): MotionPart[] {
  const parts: MotionPart[] = [
    solid("left-leg", limb(tucked ? [p(146, 205), p(137, 240), p(147, 259)] : [p(146, 205), p(139, 250), p(135, 285)], 11)),
    solid("right-leg", limb(tucked ? [p(174, 205), p(182, 240), p(174, 259)] : [p(174, 205), p(181, 250), p(185, 285)], 11)),
    solid("left-shoe", tucked ? "M140 254 H153 L155 264 H131 Q129 259 140 257 Z" : "M128 280 H141 L144 294 H117 Q114 288 128 286 Z"),
    solid("right-shoe", tucked ? "M169 254 H181 L182 257 Q193 259 190 264 H166 Z" : "M179 280 H192 L192 286 Q205 288 203 294 H176 Z"),
    solid("neck", "M151 101 H169 L171 125 H149 Z"),
    solid("head", "M147 76 Q160 66 173 76 L176 90 Q175 102 166 109 H154 Q145 102 144 90 Z"),
    ink("hair", "M146 84 L150 77 Q161 74 170 79 L174 85", { opacity: 0.65, strokeWidth: 1.5 }),
    ink("face", "M159 87 L157 96 H162 M155 101 H165", { opacity: 0.5, strokeWidth: 1.2 }),
    solid("shirt", "M149 118 Q160 127 171 118 L190 126 L182 161 L177 193 Q160 200 143 193 L138 161 L130 126 Z"),
    ink("chest", "M140 134 Q151 131 158 138 M180 134 Q169 131 162 138", { opacity: 0.48, strokeWidth: 1.4 }),
    ink("shirt-folds", "M146 160 L148 175 M174 160 L172 175 M154 186 H166", { opacity: 0.38, strokeWidth: 1.4 }),
    solid("shorts", "M143 192 Q160 199 177 192 L184 222 L164 226 L160 214 L156 226 L136 222 Z"),
    ink("shorts-seam", "M144 200 Q160 204 176 200 M160 204 V214", { opacity: 0.48, strokeWidth: 1.3 }),
  ];
  return parts.map((part) => ({ ...part, transform: `translate(0 ${n(offset)})` }));
}

export const overheadPress: ExerciseMotion = {
  id: "overhead-press",
  label: "Overhead Press",
  durationMs: 3000,
  pose(phase) {
    const height = lerp(127, 38, cycle(phase));
    const leftShoulder = p(133, 128);
    const rightShoulder = p(187, 128);
    const leftHand = p(112, height);
    const rightHand = p(208, height);
    const leftElbow = joint(leftShoulder, leftHand, 49, 47, -1);
    const rightElbow = joint(rightShoulder, rightHand, 49, 47, 1);
    return [
      ink("floor", line(p(95, 299), p(225, 299)), { opacity: 0.24 }),
      solid("left-arm", limb([leftShoulder, leftElbow, leftHand], 8)),
      solid("right-arm", limb([rightShoulder, rightElbow, rightHand], 8)),
      ...frontBody(0),
      ...barbell("load", p(160, height), 79, 0, 18),
      solid("left-hand", circle(leftHand, 4.7), { strokeWidth: 1.5 }),
      solid("right-hand", circle(rightHand, 4.7), { strokeWidth: 1.5 }),
    ];
  },
};

export const pullUp: ExerciseMotion = {
  id: "pull-up",
  label: "Pull-Up",
  durationMs: 3400,
  pose(phase) {
    const offset = lerp(26, -50, cycle(phase));
    const leftShoulder = p(133, 128 + offset);
    const rightShoulder = p(187, 128 + offset);
    const leftHand = p(102, 60);
    const rightHand = p(218, 60);
    const leftElbow = joint(leftShoulder, leftHand, 52, 50, -1);
    const rightElbow = joint(rightShoulder, rightHand, 52, 50, 1);
    return [
      ink("pull-up-bar", "M65 77 V60 H255 V77", { strokeWidth: 4 }),
      solid("left-arm", limb([leftShoulder, leftElbow, leftHand], 8)),
      solid("right-arm", limb([rightShoulder, rightElbow, rightHand], 8)),
      ...frontBody(offset, true),
      solid("left-hand", circle(leftHand, 4.7), { strokeWidth: 1.5 }),
      solid("right-hand", circle(rightHand, 4.7), { strokeWidth: 1.5 }),
    ];
  },
};
