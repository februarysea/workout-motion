import { BODY } from "./rig.js";
import type { MotionStudy } from "./rig.js";
import { cleanChannel, cleanRigPose } from "./clean.js";

const START_LEAN = .95;
const START_HIP_Z = -.21;
const FLOOR_BAR_Z = .18;
const PLATE_RADIUS = .18;
const ARM_REACH = BODY.upperArm + BODY.forearm - .003;
const START_SHOULDER_Z = START_HIP_Z + BODY.torso * Math.sin(START_LEAN);
// Solve the starting height from the actual plate-ground contact and the same
// long arms used in the first pull; do not stretch the rig down to the floor.
const START_HIP_Y = PLATE_RADIUS + Math.sqrt(ARM_REACH ** 2 - .1 ** 2 - (FLOOR_BAR_Z - START_SHOULDER_Z) ** 2) - BODY.torso * Math.cos(START_LEAN);

const hipHeight = cleanChannel([[0, START_HIP_Y], [.13, .755], [.185, .825], [.23, .913], [.25, .93], [.278, .908], [.305, .842], [.345, .74], [.50, .93], [.56, .93], [.70, .91], [.82, .79], [.92, .64], [1, START_HIP_Y]]);
const hipDepth = cleanChannel([[0, START_HIP_Z], [.10, -.275], [.13, -.28], [.185, -.12], [.23, -.035], [.25, 0], [.278, -.008], [.305, -.042], [.345, -.10], [.50, 0], [.56, 0], [.70, -.04], [.82, -.19], [.92, -.25], [1, START_HIP_Z]]);
const lean = cleanChannel([[0, START_LEAN], [.13, START_LEAN], [.185, .56], [.23, .13], [.25, 0], [.278, .012], [.305, .04], [.345, .12], [.50, 0], [.56, 0], [.70, .10], [.82, .72], [.92, START_LEAN], [1, START_LEAN]]);
const lift = cleanChannel([[0, 0], [.25, 0], [.278, .56], [.305, .96], [.345, 1], [.54, 1], [.60, .8], [.70, 0], [1, 0]]);
const rack = cleanChannel([[0, 0], [.286, 0], [.345, 1], [.54, 1], [.66, 0], [1, 0]]);
const flare = cleanChannel([[0, 0], [.25, 0], [.278, 1], [.293, 1], [.345, 0], [.54, 0], [.60, .7], [.70, 0], [1, 0]]);
const flight = cleanChannel([[0, 0], [.224, 0], [.257, .018], [.285, .030], [.345, 0], [1, 0]]);
const barTrack = cleanChannel([[0, FLOOR_BAR_Z], [.13, .16], [.185, .12], [.82, .12], [.92, .16], [1, FLOOR_BAR_Z]]);

/** Floor-start power clean: moving first pull, quick second pull and high catch. */
export const powerCleanStudy: MotionStudy = {
  id: "power-clean",
  label: "Power Clean",
  chinese: "高翻",
  subtitle: "实验样板：地面起拉、过膝加速、浅蹲接杠与站起",
  durationMs: 4900,
  keyframes: [
    { phase: 0, label: "地面起始" },
    { phase: .155, label: "过膝" },
    { phase: .25, label: "伸髋发力" },
    { phase: .278, label: "提拉" },
    { phase: .32, label: "翻肘" },
    { phase: .345, label: "浅蹲接杠" },
    { phase: .52, label: "站起" },
  ],
  pose(phase) {
    const t = phase >= 1 ? 0 : Math.max(0, phase);
    return cleanRigPose({ hipHeight: hipHeight(t), hipDepth: hipDepth(t), lean: lean(t), lift: lift(t), rack: rack(t), flare: flare(t), flight: flight(t), pullBarZ: barTrack(t) });
  },
};
