import { cleanChannel } from "./clean.js";
import { add, bendJoint, BODY, mul, v } from "./rig.js";
import type { MotionStudy, StudyPose } from "./rig.js";

const PLATE_RADIUS = .225;
const LONG_ARM = BODY.upperArm + BODY.forearm - .0015;
// A smooth pull, a 170 ms standing transition, then a slower controlled return.
// The endpoints are floor contacts; this is not a standing RDL loop.
const lift = cleanChannel([[0, 0], [.20, .40], [.46, 1], [.50, 1], [.77, .40], [1, 0]]);
// Interpolate the torso's vertical reach, not its angle. This keeps hips
// rising throughout the transition while the knees retreat before the shaft
// passes them; angle-only interpolation made the conventional shaft cut knees.
const trunkOpening = cleanChannel([[0, 0], [.30, 0], [1, 1]]);
const torsoAngle = (start: number, amount: number): number =>
  Math.acos(Math.cos(start) + (Math.cos(.025) - Math.cos(start)) * trunkOpening(amount));
const conventionalLean = (amount: number) => torsoAngle(1.08, amount);
const sumoLean = (amount: number) => torsoAngle(.88, amount);
const shoulderTrack = cleanChannel([[0, .18], [.20, .17], [.55, .10], [1, .02]]);

interface DeadliftVariant {
  stanceHalf: number;
  gripHalf: number;
  toeAngle: number;
  kneeOut: number;
  topBarHeight: number;
  lean: (amount: number) => number;
  cameraYaw: number;
}

/**
 * The rigid shaft is the vertical target. Long arms determine shoulder height;
 * an authored hip-hinge angle then determines the fixed-length trunk and hips.
 * Planted ankle targets solve both legs. During the initial leg drive, the
 * torso angle stays nearly constant; later the trunk opens toward standing.
 */
function deadliftPose(phase: number, variant: DeadliftVariant): StudyPose {
  const t = phase >= 1 ? 0 : Math.max(0, phase), amount = lift(t);
  const lean = variant.lean(amount), up = v(0, Math.cos(lean), Math.sin(lean));
  const barCenter = v(0, PLATE_RADIUS + (variant.topBarHeight - PLATE_RADIUS) * amount, .13);
  const shoulderZ = shoulderTrack(amount);
  const across = variant.gripHalf - BODY.shoulderHalf;
  const shoulderY = barCenter.y + Math.sqrt(LONG_ARM ** 2 - across ** 2 - (barCenter.z - shoulderZ) ** 2);
  const shoulders = v(0, shoulderY, shoulderZ), hips = add(shoulders, mul(up, -BODY.torso));
  const side = (sign: -1 | 1) => {
    const hip = add(hips, v(sign * BODY.hipHalf, 0, 0));
    const shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
    const ankle = v(sign * variant.stanceHalf, .07, 0);
    const toe = add(ankle, v(sign * .18 * Math.sin(variant.toeAngle), -.045, .18 * Math.cos(variant.toeAngle)));
    const wrist = add(barCenter, v(sign * variant.gripHalf, 0, 0));
    // Small outward/backward poles keep long-arm elbows on one branch. The
    // sumo knees flex outward toward the deliberately turned-out feet.
    const elbow = bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, v(sign * .10, 0, -1));
    const knee = bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * variant.kneeOut, 0, 1));
    return { hip, shoulder, ankle, toe, wrist, elbow, knee };
  };
  const left = side(-1), right = side(1);
  return {
    joints: {
      head: add(shoulders, mul(up, .235)), neck: add(shoulders, mul(up, .115)),
      leftShoulder: left.shoulder, rightShoulder: right.shoulder,
      leftElbow: left.elbow, rightElbow: right.elbow,
      leftWrist: left.wrist, rightWrist: right.wrist,
      leftHip: left.hip, rightHip: right.hip,
      leftKnee: left.knee, rightKnee: right.knee,
      leftAnkle: left.ankle, rightAnkle: right.ankle,
      leftToe: left.toe, rightToe: right.toe,
    },
    bar: { center: barCenter, halfLength: .9, plateRadius: PLATE_RADIUS, support: "hands", grip: "pronated" },
    shorts: { hipFlexion: true },
    occlusion: "surface",
    groundContacts: [v(-variant.stanceHalf, 0, 0), v(variant.stanceHalf, 0, 0)],
    camera: { yaw: variant.cameraYaw, pitch: 9, viewBox: "0 0 360 360" },
  };
}

const keyframes = [
  { phase: 0, label: "杠片触地" },
  { phase: .12, label: "蹬地起拉" },
  { phase: .24, label: "越膝伸髋" },
  { phase: .46, label: "站直锁定" },
  { phase: .68, label: "屈髋回落" },
  { phase: .90, label: "屈膝还杠" },
] as const;

export const conventionalDeadliftStudy: MotionStudy = {
  id: "conventional-deadlift", label: "Conventional Deadlift", chinese: "传统硬拉",
  subtitle: "窄站距、双正握在膝外，从地面起拉至站直后受控还杠",
  durationMs: 4200, keyframes,
  pose: phase => deadliftPose(phase, {
    stanceHalf: .145, gripHalf: .29, toeAngle: .14, kneeOut: .10,
    topBarHeight: .854, lean: conventionalLean, cameraYaw: 50,
  }),
};

export const sumoDeadliftStudy: MotionStudy = {
  id: "sumo-deadlift", label: "Sumo Deadlift", chinese: "相扑硬拉",
  subtitle: "宽站距、脚尖外转、双正握在膝内，膝沿脚尖方向打开",
  durationMs: 4300, keyframes,
  pose: phase => deadliftPose(phase, {
    stanceHalf: .38, gripHalf: .155, toeAngle: .60, kneeOut: 1.185,
    topBarHeight: .804, lean: sumoLean, cameraYaw: 30,
  }),
};
