import { add, blend, cross, dot, mul, sub, unit } from "./rig.js";
import type { StudyPose, Vec3 } from "./rig.js";

export interface GarmentRing {
  center: Vec3;
  /** Across the fabric cross-section; always points toward the body's right. */
  side: Vec3;
  /** Forward face of the fabric cross-section. */
  front: Vec3;
  rx: number;
  rz: number;
}

export interface ShortsSleeve {
  name: "left" | "right";
  /** Hip-to-knee direction; the hem lies in the plane perpendicular to it. */
  axis: Vec3;
  side: Vec3;
  front: Vec3;
  rings: GarmentRing[];
  hem: GarmentRing;
  /** Outer seam follows the thigh, including at the deepest squat position. */
  outerSeam: Vec3[];
}

export interface GarmentGeometry {
  /** Continuous deep hip-hinge correction; zero for the three visual benchmarks. */
  hingeBlend: number;
  waistband: [GarmentRing, GarmentRing];
  pelvis: GarmentRing[];
  legs: [ShortsSleeve, ShortsSleeve];
  /** A surface seam landmark, not a point fixed below the torso. */
  crotch: Vec3;
}

/** Sample a physical ring; renderers can select its visible arc by camera depth. */
export function garmentRingPoint(ring: GarmentRing, angle: number): Vec3 {
  return add(ring.center, add(mul(ring.side, Math.cos(angle) * ring.rx), mul(ring.front, Math.sin(angle) * ring.rz)));
}

export function garmentRingPoints(ring: GarmentRing, count = 32): Vec3[] {
  return Array.from({ length: count }, (_, i) => garmentRingPoint(ring, i * Math.PI * 2 / count));
}

/**
 * A small pelvis yoke and two separate, femur-skinned fabric sleeves. The old
 * flat outline moved each hem's centre but kept its edge and crotch in the torso
 * frame. At deep flexion that left the shorts hanging vertically over horizontal
 * thighs. Here every sleeve section and seam rotates with its own femur.
 *
 * The proximal rings overlap the pelvis yoke, which should be drawn over their
 * tops without an internal joining stroke. It is one continuous garment surface,
 * not two visible capped cylinders. Only the distal ring is a visible hem.
 */
export function garmentGeometry(pose: StudyPose): GarmentGeometry {
  const j = pose.joints;
  const hips = blend(j.leftHip, j.rightHip, .5);
  const shoulders = blend(j.leftShoulder, j.rightShoulder, .5);
  const up = unit(sub(shoulders, hips));
  const side = unit(sub(j.rightHip, j.leftHip));
  const front = unit(cross(side, up));
  const down = unit(add(unit(sub(j.leftKnee, j.leftHip)), unit(sub(j.rightKnee, j.rightHip))));
  // A deep hinge needs fabric to bridge the trunk and nearly upright thighs.
  // A squat folds the thighs toward the trunk instead; preserve that garment,
  // along with the supported bench pose. Both hinge gates vary smoothly.
  const hingeAmount = !pose.bench ? Math.max(0, Math.min(1, (.85 - up.y) / .50)) : 0;
  const uprightLegAmount = Math.max(0, Math.min(1, (-down.y - .40) / .30));
  const hinge = hingeAmount * hingeAmount * (3 - 2 * hingeAmount)
    * uprightLegAmount * uprightLegAmount * (3 - 2 * uprightLegAmount);

  const sleeve = (name: "left" | "right", sign: -1 | 1): ShortsSleeve => {
    const hip = j[`${name}Hip`], knee = j[`${name}Knee`];
    const axis = unit(sub(knee, hip));
    const sleeveSide = unit(sub(side, mul(axis, dot(side, axis))));
    const sleeveFront = unit(cross(sleeveSide, mul(axis, -1)));
    // A deeply flexed thigh must not carry an upright circular sleeve root
    // below the pelvis as a second round buttock. Keep its root in the pelvic
    // frame and progressively skin the following rings toward the femur. The
    // cuff remains exactly thigh-aligned. Existing studies opt out entirely.
    const flexAmount = pose.shorts?.hipFlexion ? Math.max(0, Math.min(1, (dot(axis, up) + .25) / .65)) : 0;
    const flex = flexAmount * flexAmount * (3 - 2 * flexAmount);
    const section = (t: number, rx: number, rz: number, pelvisInfluence = 0): GarmentRing => {
      const influence = flex * pelvisInfluence;
      if (influence === 0) return { center: blend(hip, knee, t), side: sleeveSide, front: sleeveFront, rx, rz };
      const ringSide = unit(blend(sleeveSide, side, influence));
      const blendedFront = blend(sleeveFront, front, influence);
      const ringFront = unit(sub(blendedFront, mul(ringSide, dot(blendedFront, ringSide))));
      return { center: blend(hip, knee, t), side: ringSide, front: ringFront, rx, rz };
    };
    const rings = [
      // The yoke covers the proximal fabric. Taper its hidden sleeve root in
      // a hinge so it does not poke out behind the pelvis as a second cuff.
      section(0, .102 - .021 * hinge - .025 * flex, .107 - .024 * hinge - .025 * flex, 1),
      section(.08, .104 - .008 * hinge - .013 * flex, .108 - .009 * hinge - .014 * flex, .70),
      section(.26, .104, .106, .15),
      section(.43, .100, .098),
    ];
    const hem = rings[rings.length - 1];
    return {
      name, axis, side: sleeveSide, front: sleeveFront, rings, hem,
      outerSeam: rings.map(section => add(section.center, mul(sleeveSide, sign * section.rx))),
    };
  };

  const legs: [ShortsSleeve, ShortsSleeve] = [sleeve("left", -1), sleeve("right", 1)];
  const crotch = add(hips, mul(down, .080));

  // Reusing the trunk frame for every pelvis ring turns the widest ring into a
  // vertical disc at the hip, producing a round "ball" above a disconnected
  // trouser leg. Blend the lower fabric frames toward the femurs instead.
  const thighUp = mul(down, -1);
  const fabricFrame = (influence: number): Vec3 => hinge === 0 ? front : unit(cross(side, unit(blend(up, thighUp, influence * hinge))));
  const ring = (center: Vec3, rx: number, rz: number, influence = 0): GarmentRing => ({
    center, rx, rz, side, front: fabricFrame(influence),
  });
  const waistband: [GarmentRing, GarmentRing] = [
    ring(add(hips, mul(up, .084)), .160, .100 - .010 * hinge, .28),
    ring(add(hips, mul(up, .059)), .169, .107 - .011 * hinge, .28),
  ];
  return {
    hingeBlend: hinge,
    waistband,
    // The waist still overlaps the torso. Below it, compact transition rings
    // join the hip roots to the upper thighs without an inflated rear cap.
    pelvis: [waistband[0], waistband[1],
      ring(hips, .193 - .019 * hinge, .116 - .018 * hinge, .62),
      ring(add(hips, mul(down, .025 + .025 * hinge)), .181 - .009 * hinge, .106 - .007 * hinge, .85)],
    legs,
    crotch,
  };
}
