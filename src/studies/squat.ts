import type { MotionStudy, Vec3 } from "./rig.js";
import { add, bendJoint, BODY, mul, rep, v } from "./rig.js";

/**
 * High-bar back squat. A shared, fixed-length rig performs a below-knee-depth
 * repetition with a planted, slightly turned-out stance. The bar is supported
 * across the upper back; its centre stays approximately over the mid-foot.
 */
export const squatStudy: MotionStudy = {
  id: "squat",
  label: "Barbell Back Squat",
  chinese: "杠铃后蹲",
  subtitle: "高杠后蹲，观察膝髋协同和稳定支撑",
  durationMs: 3800,
  pose(phase) {
    const depth = rep(phase);
    const lean = 0.08 + 0.52 * depth;
    const up = v(0, Math.cos(lean), Math.sin(lean));
    const forward = v(0, -Math.sin(lean), Math.cos(lean));

    // At the top, the 0.86 m vertical hip-to-ankle distance leaves the shared
    // 0.87 m leg almost extended. The bottom hip is visibly below the knees.
    // Solve the horizontal hip position from the torso and upper-back offsets
    // so the bar stays 3 cm ahead of the ankle line throughout the deeper rep.
    const hipZ = 0.03 - (BODY.torso + 0.035) * Math.sin(lean) + 0.055 * Math.cos(lean);
    const hipCenter = v(0, 0.93 - 0.57 * depth, hipZ);
    const shoulderCenter = add(hipCenter, mul(up, BODY.torso));
    const barCenter = add(add(shoulderCenter, mul(forward, -0.055)), mul(up, 0.035));

    const side = (sign: -1 | 1) => {
      const hip = add(hipCenter, v(sign * BODY.hipHalf, 0, 0));
      const shoulder = add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0));
      const ankle = v(sign * 0.18, 0.07, 0);
      const toe = v(sign * 0.22, 0.025, 0.18);
      const wrist = add(barCenter, v(sign * 0.36, 0, 0));

      // Knees bend forward, with a small lateral component aligned to the feet.
      const knee = bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * 0.30, 0, 1));
      // The upper arms point down/back while the wrists remain on the rigid bar.
      // Using the torso basis keeps this fold consistent through the descent.
      const elbowPole: Vec3 = add(add(mul(up, -1), mul(forward, -0.45)), v(sign * 0.05, 0, 0));
      const elbow = bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, elbowPole);
      return { hip, shoulder, ankle, toe, wrist, knee, elbow };
    };

    const left = side(-1);
    const right = side(1);
    return {
      joints: {
        head: add(shoulderCenter, mul(up, 0.235)),
        neck: add(shoulderCenter, mul(up, 0.115)),
        leftShoulder: left.shoulder,
        rightShoulder: right.shoulder,
        leftElbow: left.elbow,
        rightElbow: right.elbow,
        leftWrist: left.wrist,
        rightWrist: right.wrist,
        leftHip: left.hip,
        rightHip: right.hip,
        leftKnee: left.knee,
        rightKnee: right.knee,
        leftAnkle: left.ankle,
        rightAnkle: right.ankle,
        leftToe: left.toe,
        rightToe: right.toe,
      },
      bar: { center: barCenter, halfLength: 0.90, plateRadius: 0.18, support: "upper-back" },
    };
  },
};
