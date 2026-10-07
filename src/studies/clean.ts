import { add, bendJoint, BODY, cross, dot, length, mul, sub, unit, v } from "./rig.js";
import type { MotionStudy, StudyPose } from "./rig.js";

type Key = readonly [phase: number, value: number];

/** Monotone cubic channels keep the staged lift continuous without overshoot. */
export function cleanChannel(keys: readonly Key[]): (phase: number) => number {
  const slope = (index: number): number => {
    if (index === 0 || index === keys.length - 1) return 0;
    const [a, b, c] = [keys[index - 1], keys[index], keys[index + 1]];
    const before = (b[1] - a[1]) / (b[0] - a[0]);
    const after = (c[1] - b[1]) / (c[0] - b[0]);
    if (before * after <= 0) return 0;
    const first = 2 * (c[0] - b[0]) + b[0] - a[0];
    const second = c[0] - b[0] + 2 * (b[0] - a[0]);
    return (first + second) / (first / before + second / after);
  };
  const tangents = keys.map((_, index) => slope(index));
  return phase => {
    if (phase <= keys[0][0]) return keys[0][1];
    for (let index = 1; index < keys.length; index++) {
      const a = keys[index - 1], b = keys[index];
      if (phase <= b[0]) {
        const span = b[0] - a[0], t = (phase - a[0]) / span;
        return (2 * t ** 3 - 3 * t * t + 1) * a[1]
          + (t ** 3 - 2 * t * t + t) * span * tangents[index - 1]
          + (-2 * t ** 3 + 3 * t * t) * b[1]
          + (t ** 3 - t * t) * span * tangents[index];
      }
    }
    return keys.at(-1)![1];
  };
}

const hipHeight = cleanChannel([[0, .79], [.075, .885], [.11, .93], [.15, .91], [.19, .855], [.24, .74], [.42, .93], [.51, .93], [.72, .91], [1, .79]]);
const hipDepth = cleanChannel([[0, -.19], [.075, -.065], [.11, 0], [.15, -.008], [.19, -.042], [.24, -.10], [.42, 0], [.51, 0], [.72, -.04], [1, -.19]]);
const torsoLean = cleanChannel([[0, .72], [.075, .19], [.11, 0], [.15, .012], [.19, .04], [.24, .12], [.42, 0], [.51, 0], [.72, .10], [1, .72]]);
const lift = cleanChannel([[0, 0], [.11, 0], [.15, .56], [.19, .96], [.24, 1], [.48, 1], [.57, .8], [.72, 0], [1, 0]]);
const rack = cleanChannel([[0, 0], [.16, 0], [.24, 1], [.48, 1], [.64, 0], [1, 0]]);
const flare = cleanChannel([[0, 0], [.11, 0], [.15, 1], [.17, 1], [.24, 0], [.48, 0], [.57, .7], [.72, 0], [1, 0]]);
const flight = cleanChannel([[0, 0], [.075, 0], [.12, .018], [.16, .030], [.24, 0], [1, 0]]);

/** Internal pose inputs shared by the hang and floor-start variants. */
export interface CleanRigState {
  hipHeight: number;
  hipDepth: number;
  lean: number;
  lift: number;
  rack: number;
  flare: number;
  flight?: number;
  pullBarZ?: number;
}

/**
 * Experimental hang power clean, with an unchanged stance width: hang →
 * extension → high pull → turnover/quarter-squat catch → stand → controlled
 * unrack/reset. This is a staged illustration, not a simulation of bar inertia.
 */
export const cleanStudy: MotionStudy = {
  id: "hang-clean",
  label: "Hang Power Clean",
  chinese: "悬垂翻",
  subtitle: "实验样板：快速伸髋衔接翻肘，浅蹲接杠后受控复位",
  durationMs: 3800,
  keyframes: [
    { phase: 0, label: "悬垂" },
    { phase: .11, label: "伸髋" },
    { phase: .15, label: "提拉" },
    { phase: .205, label: "翻肘" },
    { phase: .24, label: "接杠" },
    { phase: .44, label: "站起" },
  ],
  pose(phase) {
    const t = phase >= 1 ? 0 : Math.max(0, phase);
    return cleanRigPose({ hipHeight: hipHeight(t), hipDepth: hipDepth(t), lean: torsoLean(t), lift: lift(t), rack: rack(t), flare: flare(t), flight: flight(t) });
  },
};

/** Fixed-length articulated body; the bar contact is separate from rack wrists. */
export function cleanRigPose(state: CleanRigState): StudyPose {
    const { lean, lift: amount, rack: frontRack, flare: out } = state;
    const rise = state.flight ?? 0;
    const up = v(0, Math.cos(lean), Math.sin(lean));
    const forward = v(0, -Math.sin(lean), Math.cos(lean));
    const hipCenter = v(0, state.hipHeight + rise, state.hipDepth);
    const shoulderCenter = add(hipCenter, mul(up, BODY.torso));
    const grip = .30;
    // The same shaft follows the leg-front track in the pull and ends on the
    // anterior shoulders. There is no hidden change of bar or grip width.
    const rackCenter = add(add(shoulderCenter, mul(forward, .09)), mul(up, .035));
    const pullBarZ = state.pullBarZ ?? .12;
    const barZ = pullBarZ + (rackCenter.z - pullBarZ) * amount;
    const armReach = BODY.upperArm + BODY.forearm - .003;
    const hangingY = shoulderCenter.y - Math.sqrt(armReach ** 2 - (grip - BODY.shoulderHalf) ** 2 - (barZ - shoulderCenter.z) ** 2);
    const barCenter = v(0, hangingY + (rackCenter.y - hangingY) * amount, barZ);

    const side = (sign: -1 | 1) => {
      const hip = add(hipCenter, v(sign * BODY.hipHalf, 0, 0));
      const shoulder = add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0));
      const ankle = v(sign * .17, .07 + rise, 0), toe = v(sign * .21, .025 + rise, .18);
      const knee = bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * .18, 0, 1));
      const contact = add(barCenter, v(sign * grip, 0, 0));
      // The bent wrist is behind the finger/shaft contact in the rack. Treating
      // that contact as the anatomical wrist forces a fixed-length forearm to
      // pull the elbow across the chest. The grip remains attached to the bar.
      const wrist = add(add(contact, mul(forward, -.064 * frontRack)), mul(up, .015 * frontRack));
      const delta = sub(wrist, shoulder), reach = length(delta), direction = unit(delta);
      const along = (BODY.upperArm ** 2 - BODY.forearm ** 2 + reach ** 2) / (2 * reach);
      const radius = Math.sqrt(Math.max(0, BODY.upperArm ** 2 - along ** 2));
      // Solve on one explicit elbow circle. Interpolating world-space IK poles
      // can pass parallel to the arm at turnover and flip the solution branch.
      const outside = unit(sub(v(sign, 0, 0), mul(direction, sign * direction.x)));
      const turn = mul(cross(direction, outside), sign);
      const rackPole = add(mul(forward, 1), v(sign * .12, 0, 0));
      const wrappedRackAngle = Math.atan2(dot(rackPole, turn), dot(rackPole, outside));
      // Always turn under the shaft on the same branch, including the return
      // through the ±π cut when the wrist passes shoulder height.
      const rackAngle = wrappedRackAngle > 0 ? wrappedRackAngle - 2 * Math.PI : wrappedRackAngle;
      const pullAngle = -1.35 + 1.50 * out;
      const angle = pullAngle + (rackAngle - pullAngle) * frontRack;
      const bend = add(mul(outside, Math.cos(angle)), mul(turn, Math.sin(angle)));
      const elbow = add(add(shoulder, mul(direction, along)), mul(bend, radius));
      return { hip, shoulder, ankle, toe, knee, wrist, contact, elbow };
    };
    const left = side(-1), right = side(1);
    return {
      joints: {
        head: add(shoulderCenter, mul(up, .235)),
        neck: add(shoulderCenter, mul(up, .115)),
        leftShoulder: left.shoulder, rightShoulder: right.shoulder,
        leftElbow: left.elbow, rightElbow: right.elbow,
        leftWrist: left.wrist, rightWrist: right.wrist,
        leftHip: left.hip, rightHip: right.hip,
        leftKnee: left.knee, rightKnee: right.knee,
        leftAnkle: left.ankle, rightAnkle: right.ankle,
        leftToe: left.toe, rightToe: right.toe,
      },
      grips: { left: left.contact, right: right.contact },
      feet: "air",
      bar: { center: barCenter, halfLength: .9, plateRadius: .18, support: "hands", grip: "pronated", frontRack },
      // A slightly more frontal view leaves the near elbow visible beside the
      // plate during turnover, while retaining the rack's forward depth.
      camera: { yaw: 32, pitch: 9, viewBox: "0 0 360 360" },
    };
}
