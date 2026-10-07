import { add, cross, mul, unit, v } from "./rig.js";
import type { StudyPose } from "./rig.js";

/** Shared shoe coordinates for the renderer and apparatus-clearance checks. */
export function shoeGeometry(pose: StudyPose, side: "left" | "right") {
  const ankle = pose.joints[`${side}Ankle`], toe = pose.joints[`${side}Toe`];
  const forward = unit(v(toe.x - ankle.x, 0, toe.z - ankle.z));
  const across = unit(cross(v(0, 1, 0), forward));
  const pitch = pose.footPitch?.[side] ?? 0, c = Math.cos(pitch), s = Math.sin(pitch);
  const horizontal = Math.hypot(toe.x - ankle.x, toe.z - ankle.z);
  const footLength = horizontal * c + (toe.y - ankle.y) * s;
  const lift = pose.feet === "air" ? ankle.y - .085 : 0;
  const point = (along: number, lateral: number, height: number) => {
    // Keep the original arithmetic for existing motions, so opting into ankle
    // articulation cannot change any already-reviewed flat-foot illustration.
    if (pitch === 0) return add(add(ankle, mul(forward, along)), add(mul(across, lateral), v(0, height + lift - ankle.y, 0)));
    const localY = height - .085;
    return add(add(ankle, mul(forward, along * c - localY * s)), add(mul(across, lateral), v(0, along * s + localY * c, 0)));
  };
  const rings = [[-.065, .043, .068], [0, .052, .108], [.085, .053, .066], [footLength + .02, .045, .044]];
  const points = rings.flatMap(([along, width, top]) => [point(along, -width, .015), point(along, width, .015), point(along, -width, top), point(along, width, top)]);
  return { point, points, forward, across, footLength };
}
