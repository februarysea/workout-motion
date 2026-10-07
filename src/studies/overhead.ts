import type { MotionStudy } from "./rig.js";
import { add, bendJoint, BODY, mul, rep, v } from "./rig.js";

// Zero first/second derivatives where the bar begins/finishes moving backward.
const smooth = (amount: number): number => {
  const t = Math.max(0, Math.min(1, amount));
  return t ** 3 * (t * (6 * t - 15) + 10);
};

/** Standing bilateral barbell press with a stable torso and a small head-clearance arc. */
export const overheadStudy: MotionStudy = {
  id: "overhead-press",
  label: "Overhead Press",
  chinese: "杠铃推举",
  subtitle: "站姿推举，观察上推轨迹和头部避让空间",
  durationMs: 3600,
  pose(phase) {
    const extension = rep(phase);
    const hipCenter = v(0, 0.93, 0);
    const shoulderCenter = add(hipCenter, v(0, BODY.torso, 0));

    // CrossFit's shoulder-press mechanics describe a slight head retreat and
    // elbows below/in front of the rack, followed by a directly overhead finish:
    // https://library.crossfit.com/free/pdf/PushpressJan03.pdf (page 2).
    // Let the head make room, so the load needs only a small, early backward arc.
    const backward = smooth((extension - 0.35) / 0.55);
    const barCenter = v(0, shoulderCenter.y + 0.015 + 0.5595 * extension, 0.115 * (1 - backward));
    const headAngle = (0.20 + 0.12 * smooth(extension / 0.20)) * (1 - smooth((extension - 0.42) / 0.38));
    const neckAxis = v(0, Math.cos(headAngle), -Math.sin(headAngle));

    const side = (sign: -1 | 1) => {
      const shoulder = add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0));
      const hip = add(hipCenter, v(sign * BODY.hipHalf, 0, 0));
      const ankle = v(sign * 0.18, 0.07, 0);
      const toe = v(sign * 0.22, 0.025, 0.18);
      const wrist = add(barCenter, v(sign * 0.33, 0, 0));
      const knee = bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * 0.22, 0, 1));
      // Keep a tucked, symmetric elbow corridor rather than rotating around a
      // free 3D pole. The same forward-bending Y/Z intersection is used for the
      // whole repetition; no branch flip or near-parallel pole is possible.
      const upperX = 0.070 - 0.003 * extension;
      const lowerX = 0.33 - BODY.shoulderHalf - upperX;
      const upperYZ = Math.sqrt(BODY.upperArm ** 2 - upperX ** 2);
      const lowerYZ = Math.sqrt(BODY.forearm ** 2 - lowerX ** 2);
      const dy = wrist.y - shoulder.y, dz = wrist.z - shoulder.z;
      const reach = Math.hypot(dy, dz);
      const along = (upperYZ ** 2 - lowerYZ ** 2 + reach ** 2) / (2 * reach);
      const bend = Math.sqrt(Math.max(0, upperYZ ** 2 - along ** 2));
      const elbow = v(
        sign * (BODY.shoulderHalf + upperX),
        shoulder.y + (dy * along - dz * bend) / reach,
        shoulder.z + (dz * along + dy * bend) / reach,
      );
      return { shoulder, hip, ankle, toe, wrist, knee, elbow };
    };

    const left = side(-1);
    const right = side(1);
    return {
      joints: {
        head: add(shoulderCenter, mul(neckAxis, 0.235)),
        neck: add(shoulderCenter, mul(neckAxis, 0.115)),
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
      bar: { center: barCenter, halfLength: 0.90, plateRadius: 0.18, support: "hands" },
    };
  },
};
