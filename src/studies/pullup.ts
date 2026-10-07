import { add, bendJoint, BODY, mul, rep, unit, v } from "./rig.js";
import type { MotionStudy } from "./rig.js";

const BAR_HEIGHT = 2.08;
const BAR_FORWARD = .16;
// A visibly wider pronated grip, kept within the same fixed-length arm rig.
const GRIP_HALF = .40;
// Retain a tiny extension reserve so the two-bone solution never reaches its
// singular straight-line branch at the loop boundary.
const HANG_REACH = BODY.upperArm + BODY.forearm - .002;
const HANG_GAP = Math.sqrt(HANG_REACH ** 2 - (GRIP_HALF - BODY.shoulderHalf) ** 2 - BAR_FORWARD ** 2);
const TOP_GAP = .105;

/** Strict pronated pull-up: fixed shaft/grips, a controlled vertical body path. */
export const pullupStudy: MotionStudy = {
  id: "pull-up",
  label: "Pull-up",
  chinese: "引体向上",
  subtitle: "较宽正握固定横杠，身体整体上拉与受控回落",
  durationMs: 4000,
  pose(phase) {
    const rise = rep(phase);
    const shoulderCenter = v(0, BAR_HEIGHT - HANG_GAP + (HANG_GAP - TOP_GAP) * rise, 0);
    const hips = add(shoulderCenter, v(0, -BODY.torso, 0));
    const side = (sign: -1 | 1) => {
      const shoulder = add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0));
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0));
      const wrist = v(sign * GRIP_HALF, BAR_HEIGHT, BAR_FORWARD);
      // One outward/backward branch throughout: elbows descend alongside the
      // ribs rather than changing sides as the shoulders approach the shaft.
      const elbow = bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, v(sign * .40, -.40, -.20));
      // These small, constant knee angles travel with the pelvis. There is no
      // leg kick, ankle crossing or changing horizontal body position.
      const knee = add(hip, mul(unit(v(0, -.985, .173)), BODY.thigh));
      const ankle = add(knee, mul(unit(v(0, -.993, -.118)), BODY.shin));
      const toe = add(ankle, v(0, -.045, .170));
      return { shoulder, hip, wrist, elbow, knee, ankle, toe };
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
      bar: {
        center: v(0, BAR_HEIGHT, BAR_FORWARD), halfLength: .72,
        plateRadius: 0, support: "hands", kind: "pull-up-bar", grip: "pronated",
      },
      feet: "air",
      camera: { yaw: 32, pitch: 7, viewBox: "0 -8 360 360" },
    };
  },
};
