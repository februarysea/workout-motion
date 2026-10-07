import { add, bendJoint, BODY, v } from "./rig.js";
import type { MotionStudy } from "./rig.js";

/**
 * Original standing supinated barbell curl with stationary upper arms.
 * Motion principles (palms up, quiet chest, elbows beside the body) from ACE:
 * https://www.acefitness.org/resources/everyone/exercise-library/70/bicep-curl/
 * Artwork, proportions, camera and continuous motion curves are original.
 */
export const barbellCurlStudy: MotionStudy = {
  id: "barbell-curl",
  label: "Barbell Curl",
  chinese: "杠铃弯举",
  subtitle: "反握、上臂稳定，屈肘提起杠铃，再缓慢下放",
  durationMs: 3400,
  keyframes: [
    { phase: 0, label: "伸臂起始" },
    { phase: .21, label: "屈肘提起" },
    { phase: .42, label: "顶端收缩" },
    { phase: .71, label: "受控下放" },
  ],
  pose(phase) {
    const cycle = ((phase % 1) + 1) % 1;
    const travel = cycle <= .42 ? cycle / .42 : (1 - cycle) / .58;
    const amount = (1 - Math.cos(Math.PI * travel)) / 2;
    const hipCenter = v(0, .93, 0);
    const shoulderCenter = add(hipCenter, v(0, BODY.torso, 0));
    const elbowX = .255, elbowZ = .09, grip = .28;
    const upperDrop = Math.sqrt(BODY.upperArm ** 2 - (elbowX - BODY.shoulderHalf) ** 2 - elbowZ ** 2);
    const forearmYZ = Math.sqrt(BODY.forearm ** 2 - (grip - elbowX) ** 2);
    // A small forward set leaves shaft clearance at the thighs. Only the
    // forearm rotates: no moving IK pole, shoulder lift or lumbar swing.
    const angle = .14 + 2.41 * amount;
    const elbowCenter = add(shoulderCenter, v(0, -upperDrop, elbowZ));
    const barCenter = add(elbowCenter, v(0, -forearmYZ * Math.cos(angle), forearmYZ * Math.sin(angle)));
    const side = (sign: -1 | 1) => {
      const hip = add(hipCenter, v(sign * BODY.hipHalf, 0, 0));
      const ankle = v(sign * .16, .07, 0);
      return {
        hip, ankle,
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * .12, 0, 1)),
        toe: v(sign * .18, .025, .18),
        shoulder: add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0)),
        elbow: add(elbowCenter, v(sign * elbowX, 0, 0)),
        wrist: add(barCenter, v(sign * grip, 0, 0)),
      };
    };
    const left = side(-1), right = side(1);
    return {
      joints: {
        head: add(shoulderCenter, v(0, .235, 0)),
        neck: add(shoulderCenter, v(0, .115, 0)),
        leftShoulder: left.shoulder, rightShoulder: right.shoulder,
        leftElbow: left.elbow, rightElbow: right.elbow,
        leftWrist: left.wrist, rightWrist: right.wrist,
        leftHip: left.hip, rightHip: right.hip,
        leftKnee: left.knee, rightKnee: right.knee,
        leftAnkle: left.ankle, rightAnkle: right.ankle,
        leftToe: left.toe, rightToe: right.toe,
      },
      bar: { center: barCenter, halfLength: .90, plateRadius: .13, support: "hands", grip: "supinated" },
      camera: { yaw: 48, pitch: 9, viewBox: "0 0 360 360" },
    };
  },
};
