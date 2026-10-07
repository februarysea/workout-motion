import { add, bendJoint, BODY, mul, rep, v } from "./rig.js";
import type { MotionStudy } from "./rig.js";

/** Standing RDL: a hip hinge with a constant soft knee and quiet long arms. */
export const romanianStudy: MotionStudy = {
  id: "romanian-deadlift",
  label: "Romanian Deadlift",
  chinese: "罗马尼亚硬拉",
  subtitle: "从站立开始屈髋，膝角保持稳定，杠铃沿腿前下降",
  durationMs: 4200,
  pose(phase) {
    const amount = rep(phase);
    const shinAngle = .19 - .31 * amount;
    const kneeBend = .384;
    const thighAngle = shinAngle - kneeBend;
    const thighYZ = Math.sqrt(BODY.thigh ** 2 - .02 ** 2);
    const kneeCenter = v(0, .07 + BODY.shin * Math.cos(shinAngle), BODY.shin * Math.sin(shinAngle));
    const hipCenter = add(kneeCenter, v(0, thighYZ * Math.cos(thighAngle), thighYZ * Math.sin(thighAngle)));
    const lean = .025 + 1.195 * amount;
    const up = v(0, Math.cos(lean), Math.sin(lean));
    const shoulderCenter = add(hipCenter, mul(up, BODY.torso));
    // Keep the shaft on a vertical track just in front of the shins. The
    // shoulder passes over it as the hips retreat. A 2 mm reach reserve keeps
    // the arms nearly straight without an IK singularity or elbow pole flip.
    const grip = .27;
    const reach = BODY.upperArm + BODY.forearm - .002;
    const barZ = .11;
    const verticalReach = Math.sqrt(reach ** 2 - (grip - BODY.shoulderHalf) ** 2 - (barZ - shoulderCenter.z) ** 2);
    const barCenter = v(0, shoulderCenter.y - verticalReach, barZ);
    const side = (sign: -1 | 1) => {
      const shoulder = add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0));
      const hip = add(hipCenter, v(sign * BODY.hipHalf, 0, 0));
      const knee = add(kneeCenter, v(sign * .12, 0, 0));
      const ankle = v(sign * .12, .07, 0);
      const wrist = add(barCenter, v(sign * grip, 0, 0));
      const elbow = bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, v(sign * .06, 0, -1));
      return { shoulder, hip, knee, ankle, wrist, elbow, toe: v(sign * .14, .025, .18) };
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
      bar: { center: barCenter, halfLength: .9, plateRadius: .18, support: "hands", grip: "pronated" },
      camera: { yaw: 65, pitch: 9, viewBox: "0 0 360 360" },
    };
  },
};
