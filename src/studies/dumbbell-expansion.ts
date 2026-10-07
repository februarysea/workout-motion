import { add, bendJoint, blend, BODY, dot, mul, sub, unit, v } from "./rig.js";
import type { MotionStudy, StudyPose, Vec3 } from "./rig.js";

// All geometry and continuous trajectories are authored here. Movement references
// inform constraints, never artwork.
const amountAt = (phase: number, peak = .42) => {
  const t = ((phase % 1) + 1) % 1;
  const travel = t <= peak ? t / peak : (1 - t) / (1 - peak);
  return (1 - Math.cos(Math.PI * travel)) / 2;
};
const frames = (start: string, rising: string, top: string, peak = .42) => [
  { phase: 0, label: start }, { phase: peak / 2, label: rising },
  { phase: peak, label: top }, { phase: (1 + peak) / 2, label: "受控还原" },
];
const X = v(1, 0, 0);
/** The handle belongs in the fist, distal to the wrist joint, not through it. */
const dumbbellHold = (elbow: Vec3, wrist: Vec3, axis: Vec3, grip: "pronated" | "neutral") => {
  const reach = unit(sub(wrist, elbow));
  // The handle crosses the palm orthogonally to the forearm; unlike a single
  // rigid bar, independent dumbbells can tilt slightly instead of bending wrists.
  const shaft = grip === "pronated" ? unit(sub(axis, mul(reach, dot(axis, reach)))) : axis;
  return { center: add(wrist, mul(reach, .055)), axis: shaft, grip };
};
function standingJoints(): StudyPose["joints"] {
  const hip = v(0, .93, 0), shoulder = add(hip, v(0, BODY.torso, 0));
  const side = (s: -1 | 1) => {
    const h = add(hip, v(s * BODY.hipHalf, 0, 0)), a = v(s * .16, .07, 0);
    return { hip: h, ankle: a, knee: bendJoint(h, a, BODY.thigh, BODY.shin, v(s * .12, 0, 1)),
      toe: v(s * .18, .025, .18), shoulder: add(shoulder, v(s * BODY.shoulderHalf, 0, 0)) };
  };
  const l = side(-1), r = side(1);
  return { head: add(shoulder, v(0, .235, 0)), neck: add(shoulder, v(0, .115, 0)),
    leftShoulder: l.shoulder, rightShoulder: r.shoulder,
    leftElbow: v(0, 0, 0), rightElbow: v(0, 0, 0), leftWrist: v(0, 0, 0), rightWrist: v(0, 0, 0),
    leftHip: l.hip, rightHip: r.hip, leftKnee: l.knee, rightKnee: r.knee,
    leftAnkle: l.ankle, rightAnkle: r.ankle, leftToe: l.toe, rightToe: r.toe };
}
const db = (id: string, center: Vec3, axis: Vec3, radius = .078) => ({ id, center, axis, halfLength: .125, plateRadius: radius });
const neutralAxis = (elbow: Vec3, wrist: Vec3) => {
  const reach = unit(sub(wrist, elbow));
  return unit(v(0, reach.z, -reach.y));
};

export const singleArmDumbbellRowStudy: MotionStudy = {
  id: "single-arm-dumbbell-row", label: "Single-arm Dumbbell Row", chinese: "单臂哑铃划船",
  subtitle: "左手与左膝支撑长凳，右肘向后划，躯干保持稳定", durationMs: 3600,
  keyframes: frames("支撑伸臂", "右肘后拉", "肘过躯干", .40),
  pose(phase) {
    const a = amountAt(phase, .40), up = v(0, .24, Math.sqrt(1 - .24 ** 2));
    const hip = v(0, .905, -.15), shoulder = add(hip, mul(up, BODY.torso));
    const leftHip = add(hip, v(-BODY.hipHalf, 0, 0)), rightHip = add(hip, v(BODY.hipHalf, 0, 0));
    const leftKnee = add(leftHip, v(0, -BODY.thigh, 0));
    // The shin rests above the pad instead of sinking through its top surface.
    const leftAnkle = add(leftKnee, v(0, .035, -Math.sqrt(BODY.shin ** 2 - .035 ** 2)));
    const rightAnkle = v(.25, .07, -.17);
    const leftShoulder = add(shoulder, v(-BODY.shoulderHalf, 0, 0));
    const rightShoulder = add(shoulder, v(BODY.shoulderHalf, 0, 0));
    const leftWrist = v(-.20, .465, shoulder.z + .025);
    const rightWrist = blend(add(rightShoulder, v(.07, -.58, 0)), v(.29, .815, -.035), a);
    const rightElbow = bendJoint(rightShoulder, rightWrist, BODY.upperArm, BODY.forearm, v(.2, .5, -1));
    const axis = neutralAxis(rightElbow, rightWrist);
    const hold = dumbbellHold(rightElbow, rightWrist, axis, "neutral");
    return {
      joints: { head: add(shoulder, mul(up, .235)), neck: add(shoulder, mul(up, .115)),
        leftShoulder, rightShoulder,
        leftElbow: bendJoint(leftShoulder, leftWrist, BODY.upperArm, BODY.forearm, v(-1, 0, .2)), rightElbow,
        leftWrist, rightWrist, leftHip, rightHip, leftKnee,
        rightKnee: bendJoint(rightHip, rightAnkle, BODY.thigh, BODY.shin, v(.2, 0, 1)),
        leftAnkle, rightAnkle, leftToe: add(leftAnkle, v(0, -.16 * Math.sin(.55), -.16 * Math.cos(.55))), rightToe: v(.28, .025, .01) },
      dumbbells: [db("right", hold.center, axis, .085)],
      handholds: { right: hold },
      handContacts: { left: { center: v(leftWrist.x, .434, leftWrist.z + .045), forward: v(0, 0, 1), normal: v(0, 1, 0) } },
      apparatus: {
        pads: [{ id: "row-bench", center: v(-.15, .42, .145), axis: v(0, 0, 1), length: .91, width: .42, thickness: .07 }],
        rods: [
          { id: "row-bench-front-leg", a: v(-.15, .04, .40), b: v(-.15, .36, .40), radius: .025 },
          { id: "row-bench-rear-leg", a: v(-.15, .04, -.20), b: v(-.15, .36, -.20), radius: .025 },
          { id: "row-bench-front-foot", a: v(-.39, .035, .40), b: v(.09, .035, .40), radius: .025 },
          { id: "row-bench-rear-foot", a: v(-.39, .035, -.20), b: v(.09, .035, -.20), radius: .025 },
        ],
      },
      feet: "air", footPitch: { left: -.55 }, shorts: { hipFlexion: true }, groundContacts: [rightAnkle],
      camera: { yaw: 62, pitch: 11, viewBox: "25 125 310 230" },
    };
  },
};

export const inclineDumbbellPressStudy: MotionStudy = {
  id: "incline-dumbbell-press", label: "Incline Dumbbell Press", chinese: "上斜哑铃卧推",
  subtitle: "30°上斜凳支撑背部，双脚着地，向上推起并自然靠拢", durationMs: 3600,
  keyframes: frames("胸侧起始", "上推内收", "伸臂顶端"),
  pose(phase) {
    const a = amountAt(phase), up = v(0, .5, -Math.sqrt(.75)), normal = v(0, Math.sqrt(.75), .5);
    const hip = v(0, .58, .25), shoulder = add(hip, mul(up, BODY.torso));
    const side = (s: -1 | 1) => {
      const h = add(hip, v(s * BODY.hipHalf, 0, 0)), sh = add(shoulder, v(s * BODY.shoulderHalf, 0, 0));
      const ankle = v(s * .24, .07, .69);
      const wrist = blend(add(sh, v(s * .205, .165, .20)), add(sh, v(s * .035, .568, .01)), a);
      // A tucked corridor, rather than a free 3D pole that first flares the
      // elbows out and then folds them in. At the bottom, forearms stack over
      // the elbows; the YZ branch stays continuous through the full press.
      const upperX = .205 - .130 * a, lowerX = Math.abs(wrist.x) - BODY.shoulderHalf - upperX;
      const upperYZ = Math.sqrt(BODY.upperArm ** 2 - upperX ** 2), lowerYZ = Math.sqrt(BODY.forearm ** 2 - lowerX ** 2);
      const dy = wrist.y - sh.y, dz = wrist.z - sh.z, distance = Math.hypot(dy, dz);
      const along = (upperYZ ** 2 - lowerYZ ** 2 + distance ** 2) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upperYZ ** 2 - along ** 2));
      const elbow = v(s * (BODY.shoulderHalf + upperX), sh.y + (dy * along - dz * height) / distance,
        sh.z + (dz * along + dy * height) / distance);
      return { hip: h, shoulder: sh, ankle, knee: bendJoint(h, ankle, BODY.thigh, BODY.shin, v(s * .12, 0, 1)),
        toe: v(s * .26, .025, .87), wrist, elbow, hold: dumbbellHold(elbow, wrist, X, "pronated") };
    };
    const l = side(-1), r = side(1);
    const padCenter = add(add(hip, mul(up, .34)), mul(normal, -.102));
    return {
      joints: { head: add(shoulder, mul(up, .235)), neck: add(shoulder, mul(up, .115)),
        leftShoulder: l.shoulder, rightShoulder: r.shoulder, leftElbow: l.elbow, rightElbow: r.elbow,
        leftWrist: l.wrist, rightWrist: r.wrist, leftHip: l.hip, rightHip: r.hip,
        leftKnee: l.knee, rightKnee: r.knee, leftAnkle: l.ankle, rightAnkle: r.ankle, leftToe: l.toe, rightToe: r.toe },
      dumbbells: [db("left", l.hold.center, l.hold.axis, .087), db("right", r.hold.center, r.hold.axis, .087)],
      handholds: { left: l.hold, right: r.hold },
      anatomy: { surfaceArms: true },
      apparatus: { pads: [
        { id: "incline-back", center: padCenter, axis: up, length: .93, width: .32, thickness: .065 },
        { id: "incline-seat", center: v(0, .477, .37), axis: v(0, 0, 1), length: .30, width: .36, thickness: .065 },
      ], rods: [
        { id: "incline-support", a: v(0, .10, -.31), b: add(padCenter, mul(up, .15)), radius: .025 },
        { id: "incline-base", a: v(0, .07, -.53), b: v(0, .07, .52), radius: .03 },
        { id: "incline-seat-leg", a: v(0, .07, .39), b: v(0, .44, .39), radius: .025 },
        { id: "incline-front-foot", a: v(-.3, .03, .48), b: v(.3, .03, .48), radius: .025 },
        { id: "incline-rear-foot", a: v(-.3, .03, -.47), b: v(.3, .03, -.47), radius: .025 },
      ] },
      shorts: { hipFlexion: true }, camera: { yaw: 52, pitch: 11, viewBox: "20 105 310 250" },
    };
  },
};

export const dumbbellShoulderPressStudy: MotionStudy = {
  id: "dumbbell-shoulder-press", label: "Dumbbell Shoulder Press", chinese: "站姿哑铃推举",
  subtitle: "双脚稳定、肘在体侧稍向前，独立哑铃向上推至头顶", durationMs: 3500,
  keyframes: frames("肩侧起始", "上推", "头顶伸展"),
  pose(phase) {
    const a = amountAt(phase), joints = standingJoints();
    for (const [side, sign] of [["left", -1], ["right", 1]] as const) {
      const sh = joints[`${side}Shoulder`];
      // Keep the hands wider through the middle; convergence comes toward
      // lockout. The elbow corridor follows that path without the old sudden
      // lateral flare and strong inward forearm tilt.
      const wrist = add(sh, v(sign * (.20 - .165 * a * a), .08 + .487 * a, .16 - .15 * a));
      const upperX = .205 - .130 * a * a, lowerX = Math.abs(wrist.x) - BODY.shoulderHalf - upperX;
      const upperYZ = Math.sqrt(BODY.upperArm ** 2 - upperX ** 2), lowerYZ = Math.sqrt(BODY.forearm ** 2 - lowerX ** 2);
      const dy = wrist.y - sh.y, dz = wrist.z - sh.z, distance = Math.hypot(dy, dz);
      const along = (upperYZ ** 2 - lowerYZ ** 2 + distance ** 2) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upperYZ ** 2 - along ** 2));
      joints[`${side}Wrist`] = wrist;
      joints[`${side}Elbow`] = v(sign * (BODY.shoulderHalf + upperX), sh.y + (dy * along - dz * height) / distance,
        sh.z + (dz * along + dy * height) / distance);
    }
    const leftHold = dumbbellHold(joints.leftElbow, joints.leftWrist, X, "pronated"), rightHold = dumbbellHold(joints.rightElbow, joints.rightWrist, X, "pronated");
    return { joints, dumbbells: [db("left", leftHold.center, leftHold.axis), db("right", rightHold.center, rightHold.axis)],
      handholds: { left: leftHold, right: rightHold },
      camera: { yaw: 35, pitch: 9, viewBox: "15 25 330 330" } };
  },
};

export const hammerCurlStudy: MotionStudy = {
  id: "hammer-curl", label: "Hammer Curl", chinese: "锤式弯举",
  subtitle: "双手中立握，上臂贴近体侧，哑铃随前臂转动而不折腕", durationMs: 3300,
  keyframes: frames("体侧垂臂", "屈肘提起", "顶端收缩"),
  pose(phase) {
    const a = amountAt(phase), joints = standingJoints(), angle = .10 + 2.30 * a;
    const axes: Vec3[] = [];
    for (const [side, sign] of [["left", -1], ["right", 1]] as const) {
      const sh = joints[`${side}Shoulder`], dx = .09, dz = .055;
      const elbow = add(sh, v(sign * dx, -Math.sqrt(BODY.upperArm ** 2 - dx ** 2 - dz ** 2), dz));
      const wrist = add(elbow, v(0, -BODY.forearm * Math.cos(angle), BODY.forearm * Math.sin(angle)));
      joints[`${side}Elbow`] = elbow; joints[`${side}Wrist`] = wrist; axes.push(neutralAxis(elbow, wrist));
    }
    const leftHold = dumbbellHold(joints.leftElbow, joints.leftWrist, axes[0], "neutral"), rightHold = dumbbellHold(joints.rightElbow, joints.rightWrist, axes[1], "neutral");
    return { joints, dumbbells: [db("left", leftHold.center, axes[0], .073), db("right", rightHold.center, axes[1], .073)],
      handholds: { left: leftHold, right: rightHold },
      camera: { yaw: 40, pitch: 9, viewBox: "20 70 315 285" } };
  },
};

export const lateralRaiseStudy: MotionStudy = {
  id: "lateral-raise", label: "Lateral Raise", chinese: "哑铃侧平举",
  subtitle: "肘保持微屈，双臂向侧方稍向前抬至肩高，再受控落下", durationMs: 3400,
  keyframes: frames("体侧预备", "侧向抬臂", "肩高顶端", .43),
  pose(phase) {
    const a = amountAt(phase, .43), joints = standingJoints(), angle = .12 + (Math.PI / 2 - .12) * a;
    for (const [side, sign] of [["left", -1], ["right", 1]] as const) {
      const sh = joints[`${side}Shoulder`];
      // A fixed 12 degree elbow bend, with the forearm slightly forward of the
      // upper arm, avoids the locked straight-line "T" character silhouette.
      const upper = v(sign * Math.sin(angle) * .985, -Math.cos(angle), Math.sin(angle) * Math.sqrt(1 - .985 ** 2));
      const forward = v(-sign * Math.sqrt(1 - .985 ** 2), 0, .985);
      const forearm = add(mul(upper, Math.cos(.21)), mul(forward, Math.sin(.21)));
      const elbow = add(sh, mul(upper, BODY.upperArm));
      const wrist = add(elbow, mul(forearm, BODY.forearm));
      joints[`${side}Elbow`] = elbow; joints[`${side}Wrist`] = wrist;
    }
    const axis = v(0, .13 * a, Math.sqrt(1 - (.13 * a) ** 2));
    return { joints, dumbbells: [db("left", joints.leftWrist, axis, .065), db("right", joints.rightWrist, axis, .065)],
      handholds: { left: { center: joints.leftWrist, axis }, right: { center: joints.rightWrist, axis } },
      camera: { yaw: 25, pitch: 9, viewBox: "10 65 340 290" } };
  },
};
