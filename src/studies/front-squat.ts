import { cleanChannel, cleanRigPose } from "./clean.js";
import { bendJoint, BODY, v } from "./rig.js";
import type { MotionStudy } from "./rig.js";

const depth = cleanChannel([[0, 0], [.56, 1], [1, 0]]);

/**
 * Clean-grip front squat: the shaft rests on the anterior shoulders throughout
 * the repetition. The rack's separate wrist/contact anchors are shared with
 * the clean, while a world-forward elbow pole keeps the upper arms high as the
 * trunk inclines. This is an original pose sequence, not traced source footage.
 */
export const frontSquatStudy: MotionStudy = {
  id: "front-squat",
  label: "Barbell Front Squat",
  chinese: "杠铃前蹲",
  subtitle: "前架位托杠，高肘下蹲，脚掌持续支撑",
  durationMs: 3600,
  keyframes: [
    { phase: 0, label: "前架位" },
    { phase: .28, label: "受控下蹲" },
    { phase: .56, label: "最低点" },
    { phase: .78, label: "蹬地站起" },
  ],
  pose(phase) {
    const t = phase >= 1 ? 0 : Math.max(0, phase);
    const amount = depth(t), lean = .08 + .22 * amount;
    // Cancel the rack/torso horizontal offsets: a 5.5 cm bar track stays over
    // the foot support area without shifting the stance during a deep squat.
    const hipDepth = .055 - (BODY.torso + .035) * Math.sin(lean) - .09 * Math.cos(lean);
    const pose = cleanRigPose({
      hipHeight: .925 - .575 * amount,
      hipDepth,
      lean,
      lift: 1,
      rack: 1,
      flare: 0,
    });
    for (const [side, sign] of [["left", -1], ["right", 1]] as const) {
      pose.joints[`${side}Elbow`] = bendJoint(
        pose.joints[`${side}Shoulder`], pose.joints[`${side}Wrist`],
        BODY.upperArm, BODY.forearm, v(sign * .12, 0, 1),
      );
    }
    pose.camera = { yaw: 38, pitch: 9, viewBox: "0 0 360 360" };
    pose.shorts = { hipFlexion: true };
    return pose;
  },
};
