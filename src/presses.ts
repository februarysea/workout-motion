import type { ExerciseMotion, Point } from "./types.js";
import { barbell, circle, cycle, ink, joint, lerp, limb, line, n, p, polygon, solid, xy } from "./geometry.js";

/** Original side-view artwork. The bar follows a shallow up-and-back press path. */
export const benchPress: ExerciseMotion = {
  id: "bench-press",
  label: "Bench Press",
  durationMs: 3300,
  pose(phase) {
    const extension = cycle(phase);
    const load = p(lerp(125, 108, extension), lerp(155, 92, extension));
    const farShoulder = p(96, 179);
    const nearShoulder = p(104, 184);
    const farHand = p(load.x - 10, load.y);
    const nearHand = p(load.x + 10, load.y);
    const farElbow = joint(farShoulder, farHand, 47, 45, 1);
    const nearElbow = joint(nearShoulder, nearHand, 49, 47, 1);

    return [
      ink("floor", line(p(30, 282), p(280, 282)), { opacity: 0.24 }),
      solid("bench-support-left", polygon(p(65, 213), p(73, 213), p(77, 278), p(61, 278))),
      solid("bench-support-right", polygon(p(177, 213), p(185, 213), p(193, 278), p(177, 278))),
      ink("bench-feet", `${line(p(49, 279), p(88, 279))} ${line(p(169, 279), p(201, 279))}`, { strokeWidth: 3 }),
      solid("bench-pad", "M46 207 Q46 203 51 203 H196 Q201 203 201 208 V216 H46 Z"),
      solid("far-leg", limb([p(159, 202), p(197, 231), p(190, 271)], 10), { opacity: 0.58 }),
      solid("far-shoe", "M182 267 L197 267 L203 275 Q212 276 209 280 H178 L178 274 Z", { opacity: 0.58 }),
      solid("far-arm", limb([farShoulder, farElbow, farHand], 7), { opacity: 0.55 }),
      solid("neck", "M72 179 L90 176 L96 191 L74 196 Z"),
      solid("head", "M69 170 Q54 169 50 182 Q47 194 60 199 Q73 202 79 192 L83 189 L78 185 Q77 174 69 170 Z"),
      ink("hair", "M51 184 Q55 173 64 175 L74 178", { opacity: 0.65 }),
      ink("ear", "M70 184 Q65 181 65 188 Q66 192 70 190", { strokeWidth: 1.4 }),
      solid("shirt", "M82 177 Q107 167 130 179 L161 188 L170 201 L157 210 Q132 203 111 203 L89 199 L78 189 Z"),
      ink("shirt-folds", "M119 185 Q131 192 145 194 M98 196 L113 198", { opacity: 0.42, strokeWidth: 1.3 }),
      solid("near-leg", limb([p(169, 205), p(218, 231), p(229, 271)], 11)),
      solid("shorts", "M150 186 L169 191 L188 206 L180 226 L160 216 L147 204 Z"),
      ink("shorts-seam", "M165 196 L176 212", { opacity: 0.48, strokeWidth: 1.4 }),
      ink("knee", "M214 225 Q223 228 225 235", { opacity: 0.45, strokeWidth: 1.3 }),
      solid("near-shoe", "M222 267 L235 267 L240 274 Q255 274 255 281 H219 L217 275 Z"),
      ink("shoe-sole", line(p(221, 277), p(247, 278)), { opacity: 0.48, strokeWidth: 1.3 }),
      solid("near-arm", limb([nearShoulder, nearElbow, nearHand], 8)),
      ink("upper-arm-detail", line(p((nearShoulder.x + nearElbow.x) / 2, (nearShoulder.y + nearElbow.y) / 2 + 2), p(nearElbow.x - 4, nearElbow.y - 1)), { opacity: 0.4, strokeWidth: 1.2 }),
      ...barbell("load", load, 56, 0, 19),
      solid("far-hand", circle(farHand, 4.2), { strokeWidth: 1.5 }),
      solid("near-hand", circle(nearHand, 4.6), { strokeWidth: 1.5 }),
    ];
  },
};

/** Fixed floor pivot and a rigid 185-unit shaft, with both hands on its free end. */
export const landminePress: ExerciseMotion = {
  id: "landmine-press",
  label: "Landmine Press",
  durationMs: 3500,
  pose(phase) {
    const extension = cycle(phase);
    const anchor = p(279, 282);
    const angle = lerp(-2.30, -1.90, extension);
    const along = p(Math.cos(angle), Math.sin(angle));
    const normal = p(-along.y, along.x);
    const at = (distance: number, offset = 0): Point => p(anchor.x + along.x * distance + normal.x * offset, anchor.y + along.y * distance + normal.y * offset);
    const nearHand = at(185);
    const farHand = at(179);
    const farShoulder = p(113, 126);
    const nearShoulder = p(123, 130);
    const farElbow = joint(farShoulder, farHand, 55, 54, 1);
    const nearElbow = joint(nearShoulder, nearHand, 53, 51, 1);
    const plate = polygon(at(162, -18), at(170, -18), at(170, 18), at(162, 18));

    return [
      ink("floor", line(p(40, 287), p(295, 287)), { opacity: 0.24 }),
      solid("far-leg", limb([p(109, 195), p(86, 233), p(70, 274)], 10), { opacity: 0.58 }),
      solid("far-shoe", "M64 269 L78 274 L78 281 L55 284 L48 281 Q48 276 62 274 Z", { opacity: 0.58 }),
      solid("far-arm", limb([farShoulder, farElbow, farHand], 7), { opacity: 0.56 }),
      solid("neck", "M107 105 L122 105 L126 126 L108 129 Z"),
      solid("head", "M104 78 Q117 75 124 88 L124 96 L129 101 L124 105 Q125 116 116 119 L104 112 Q94 104 96 93 Q96 83 104 78 Z"),
      ink("hair", "M98 94 Q99 82 109 84 L121 88", { opacity: 0.65 }),
      ink("ear", "M111 96 Q106 92 106 99 Q107 104 111 103", { strokeWidth: 1.4 }),
      solid("shirt", "M108 119 Q120 119 132 129 L127 155 L125 188 Q116 198 99 190 L97 164 L96 137 Q96 126 108 119 Z"),
      ink("shirt-folds", "M103 150 L105 169 M114 180 L122 177", { opacity: 0.42, strokeWidth: 1.3 }),
      solid("near-leg", limb([p(116, 195), p(151, 231), p(157, 275)], 11)),
      solid("shorts", "M99 185 Q113 191 125 185 L140 205 L130 222 L115 214 L102 208 L94 203 Z"),
      ink("shorts-seam", "M113 193 L126 210", { opacity: 0.48, strokeWidth: 1.4 }),
      ink("knee", "M146 225 Q155 226 156 235", { opacity: 0.45, strokeWidth: 1.3 }),
      solid("near-shoe", "M150 270 L165 270 L172 277 Q184 276 185 284 H148 L145 279 Z"),
      ink("shoe-sole", line(p(152, 280), p(179, 281)), { opacity: 0.48, strokeWidth: 1.3 }),
      solid("near-arm", limb([nearShoulder, nearElbow, nearHand], 8)),
      ink("upper-arm-detail", line(p((nearShoulder.x + nearElbow.x) / 2 - 2, (nearShoulder.y + nearElbow.y) / 2), p(nearElbow.x + 1, nearElbow.y - 5)), { opacity: 0.4, strokeWidth: 1.2 }),
      ink("shaft", line(anchor, at(191)), { strokeWidth: 3.5 }),
      solid("plate", plate, { strokeWidth: 2.6 }),
      ink("plate-rim", line(at(164, -13), at(164, 13)), { opacity: 0.45, strokeWidth: 1.3 }),
      solid("floor-anchor", `M266 286 L${xy(anchor)} L291 286 Z`),
      solid("anchor-pivot", circle(anchor, 3.7), { strokeWidth: 1.7 }),
      solid("far-hand", circle(farHand, 4.2), { strokeWidth: 1.5 }),
      solid("near-hand", circle(nearHand, 4.6), { strokeWidth: 1.5 }),
      ink("grip", `M${n(nearHand.x - normal.x * 2.3)} ${n(nearHand.y - normal.y * 2.3)} L${n(nearHand.x + normal.x * 2.3)} ${n(nearHand.y + normal.y * 2.3)}`, { strokeWidth: 1, opacity: 0.5 }),
    ];
  },
};
