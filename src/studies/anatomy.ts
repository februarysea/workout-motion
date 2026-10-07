import { add, blend, cross, mul, sub, unit, v } from "./rig.js";
import type { StudyPose, Vec3 } from "./rig.js";

export interface AnatomyLandmark {
  id: string;
  points: Vec3[];
  width: number;
  /** Average outward surface normal, for back-face suppression by the renderer. */
  normal: Vec3;
}

// The H2 chest has a broad, quiet silhouette. Keeping these cross-sections in
// step with the torso volume prevents anatomy lines from becoming floating decals.
const SECTIONS = [
  [.02, .152, .086], [.16, .146, .092], [.34, .140, .096],
  [.54, .170, .117], [.78, .215, .125], [.96, .215, .100],
  [1.04, .142, .077],
] as const;

function section(t: number): { width: number; depth: number } {
  for (let i = 1; i < SECTIONS.length; i++) {
    const a = SECTIONS[i - 1], b = SECTIONS[i];
    if (t <= b[0]) {
      const amount = Math.max(0, (t - a[0]) / (b[0] - a[0]));
      return { width: a[1] + (b[1] - a[1]) * amount, depth: a[2] + (b[2] - a[2]) * amount };
    }
  }
  const last = SECTIONS[SECTIONS.length - 1];
  return { width: last[1], depth: last[2] };
}

/**
 * The same H2 pectoral / abdominal drawing in the body's own coordinate frame.
 * t runs from the hip line to the shoulder line; x is lateral distance in metres.
 * It therefore follows a lying bench pose and a leaning squat without screen-space
 * redrawing. All IDs remain present at every phase, including invisible far-side lines.
 */
export function torsoLandmarks(pose: StudyPose): AnatomyLandmark[] {
  const joints = pose.joints;
  const hips = blend(joints.leftHip, joints.rightHip, .5);
  const shoulders = blend(joints.leftShoulder, joints.rightShoulder, .5);
  const axis = unit(sub(shoulders, hips));
  const side = unit(sub(joints.rightShoulder, joints.leftShoulder));
  const front = unit(cross(side, axis));
  const landmarks: AnatomyLandmark[] = [];
  type Local = readonly [t: number, x: number];

  const surface = ([t, x]: Local): { point: Vec3; normal: Vec3 } => {
    const { width, depth } = section(t);
    const lateral = Math.max(-.94, Math.min(.94, x / width));
    const forward = Math.sqrt(1 - lateral * lateral);
    return {
      point: add(add(blend(hips, shoulders, t), mul(side, lateral * width)), mul(front, depth * forward)),
      normal: unit(add(mul(side, lateral / width), mul(front, forward / depth))),
    };
  };
  const stroke = (id: string, coordinates: readonly Local[], width = 1.08) => {
    const samples = coordinates.map(surface);
    const normal = unit(samples.reduce((sum, sample) => add(sum, sample.normal), v(0, 0, 0)));
    landmarks.push({ id, points: samples.map(sample => sample.point), width, normal });
  };

  for (const [name, sign] of [["left", -1], ["right", 1]] as const) {
    const paired = (id: string, points: readonly Local[], width?: number) =>
      stroke(`anatomy-${name}-${id}`, points.map(([t, x]) => [t, x * sign]), width);

    // The low pectoral border is the principal H2 recognition cue. The inner
    // edge joins a short sternum line without making a closed chest plate.
    paired("clavicle", [[1.012, .020], [1.025, .071], [1.010, .132], [.969, .181]], 1.12);
    paired("pectoral", [[.796, .006], [.737, .018], [.695, .077], [.718, .140], [.857, .195]], 1.22);

    // Six-pack: one rounded upper arch, two short divisions, and a continuous
    // outer boundary. The centre stays mostly open, avoiding a ladder motif.
    paired("rectus-top", [[.607, .010], [.586, .039], [.546, .069], [.499, .078]], 1.10);
    paired("rectus-side", [[.499, .078], [.410, .075], [.312, .068], [.205, .060]], 1.05);
    paired("rectus-middle", [[.440, .010], [.432, .040], [.438, .072]], 1.04);
    paired("rectus-lower", [[.321, .010], [.313, .039], [.320, .065]], 1.04);

    paired("oblique", [[.611, .151], [.506, .131], [.395, .109], [.290, .094], [.202, .082]], 1.06);
    // Only two serratus notches per side: enough shape without hatching.
    paired("serratus-upper", [[.644, .150], [.600, .132], [.583, .111]], .94);
    paired("serratus-lower", [[.543, .129], [.503, .110], [.489, .092]], .94);
  }

  stroke("anatomy-sternum", [[.954, 0], [.885, 0], [.805, 0]], 1.10);
  stroke("anatomy-linea-upper", [[.601, 0], [.536, 0], [.475, 0]], .95);
  stroke("anatomy-linea-lower", [[.407, 0], [.347, 0], [.279, 0], [.205, 0]], .95);

  // These small neck tendons share the animated neck axis, including the head
  // clearance in the overhead press. They do not prescribe a fixed upright neck.
  for (const [name, sign] of [["left", -1], ["right", 1]] as const) {
    const lower = surface([1.015, sign * .027]).point;
    const upper = add(add(joints.neck, mul(side, sign * .028)), mul(front, .043));
    const middle = add(blend(lower, upper, .52), mul(side, sign * .005));
    landmarks.push({
      id: `anatomy-${name}-neck-tendon`,
      points: [lower, middle, upper],
      width: .98,
      normal: unit(add(front, mul(side, sign * .25))),
    });
  }

  // A navel is a short open mark, kept lighter than the main abdominal arcs.
  stroke("anatomy-navel", [[.275, -.004], [.264, 0], [.274, .004]], .88);
  return landmarks;
}
