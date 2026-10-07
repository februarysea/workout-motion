import { BODY, bendJoint, blend, rep, v } from "./rig.js";
import type { MotionStudy, Vec3 } from "./rig.js";

const PAD_HEIGHT = 0.53;
const HIP_HEIGHT = 0.64;
const HIP_Z = 0.26;
const SHOULDER_HEIGHT = 0.67;
// Preserve the shared rig's torso length while allowing a small natural arch.
const SHOULDER_Z = HIP_Z - Math.sqrt(BODY.torso ** 2 - (SHOULDER_HEIGHT - HIP_HEIGHT) ** 2);
const GRIP_HALF = 0.34;
const LOW_BAR_HEIGHT = 0.85;
const LOW_ELBOW_HEIGHT = LOW_BAR_HEIGHT - BODY.forearm;
const ELBOW_OUT = GRIP_HALF - BODY.shoulderHalf;
const ELBOW_DOWN = LOW_ELBOW_HEIGHT - SHOULDER_HEIGHT;
const ELBOW_FORWARD = Math.sqrt(BODY.upperArm ** 2 - ELBOW_OUT ** 2 - ELBOW_DOWN ** 2);
const LOW_BAR_Z = SHOULDER_Z + ELBOW_FORWARD;
const HIGH_BAR_Z = -0.25;
// A 2 mm reach reserve avoids an IK singularity and keeps a soft elbow at the top.
const TOP_REACH = BODY.upperArm + BODY.forearm - 0.002;
const HIGH_BAR_HEIGHT = SHOULDER_HEIGHT + Math.sqrt(TOP_REACH ** 2 - ELBOW_OUT ** 2 - (HIGH_BAR_Z - SHOULDER_Z) ** 2);
const ANKLE_Z = 0.70;

/** One fixed body rig, with a rigid bar and continuously solved two-bone arms. */
export const benchStudy: MotionStudy = {
  id: "bench-press",
  label: "Bench Press",
  chinese: "卧推",
  subtitle: "固定躯干与支撑，观察连续上推和回落",
  durationMs: 3600,
  pose(phase) {
    const amount = rep(phase);
    const barCenter = blend(v(0, LOW_BAR_HEIGHT, LOW_BAR_Z), v(0, HIGH_BAR_HEIGHT, HIGH_BAR_Z), amount);
    const leftShoulder = v(-BODY.shoulderHalf, SHOULDER_HEIGHT, SHOULDER_Z);
    const rightShoulder = v(BODY.shoulderHalf, SHOULDER_HEIGHT, SHOULDER_Z);
    const leftHip = v(-BODY.hipHalf, HIP_HEIGHT, HIP_Z);
    const rightHip = v(BODY.hipHalf, HIP_HEIGHT, HIP_Z);
    const leftAnkle = v(-0.22, 0.07, ANKLE_Z);
    const rightAnkle = v(0.22, 0.07, ANKLE_Z);
    const leftWrist = v(-GRIP_HALF, barCenter.y, barCenter.z);
    const rightWrist = v(GRIP_HALF, barCenter.y, barCenter.z);
    const elbow = (shoulder: Vec3, wrist: Vec3, side: number): Vec3 => bendJoint(
      shoulder,
      wrist,
      BODY.upperArm,
      BODY.forearm,
      v(side * ELBOW_OUT, ELBOW_DOWN, ELBOW_FORWARD),
    );

    return {
      joints: {
        head: v(0, PAD_HEIGHT + 0.105, SHOULDER_Z - 0.28),
        neck: v(0, 0.645, SHOULDER_Z - 0.125),
        leftShoulder,
        rightShoulder,
        leftElbow: elbow(leftShoulder, leftWrist, -1),
        rightElbow: elbow(rightShoulder, rightWrist, 1),
        leftWrist,
        rightWrist,
        leftHip,
        rightHip,
        leftKnee: bendJoint(leftHip, leftAnkle, BODY.thigh, BODY.shin, v(0, 0, 1)),
        rightKnee: bendJoint(rightHip, rightAnkle, BODY.thigh, BODY.shin, v(0, 0, 1)),
        leftAnkle,
        rightAnkle,
        leftToe: v(leftAnkle.x, 0.03, ANKLE_Z + 0.17),
        rightToe: v(rightAnkle.x, 0.03, ANKLE_Z + 0.17),
      },
      bar: { center: barCenter, halfLength: 0.9, plateRadius: 0.18, support: "hands" },
      bench: { height: PAD_HEIGHT, start: -0.68, end: 0.36, halfWidth: 0.165 },
    };
  },
};
