import { cleanChannel } from "./clean.js";
import { add, bendJoint, BODY, cross, mul, unit, v } from "./rig.js";
import type { JointName, MotionStudy, Vec3 } from "./rig.js";

type SidePose = { shoulder: Vec3; elbow: Vec3; wrist: Vec3; hip: Vec3; knee: Vec3; ankle: Vec3; toe: Vec3 };
const phase01 = (phase: number) => phase >= 1 ? 0 : Math.max(0, phase);
function joints(left: SidePose, right: SidePose, head: Vec3, neck: Vec3): Record<JointName, Vec3> {
  return { head, neck, leftShoulder: left.shoulder, rightShoulder: right.shoulder,
    leftElbow: left.elbow, rightElbow: right.elbow, leftWrist: left.wrist, rightWrist: right.wrist,
    leftHip: left.hip, rightHip: right.hip, leftKnee: left.knee, rightKnee: right.knee,
    leftAnkle: left.ankle, rightAnkle: right.ankle, leftToe: left.toe, rightToe: right.toe };
}
const toeAt = (ankle: Vec3, pitch = 0): Vec3 => add(ankle, v(0,
  -.045 * Math.cos(pitch) + .17 * Math.sin(pitch),
  .17 * Math.cos(pitch) + .045 * Math.sin(pitch)));
const squatDepth = cleanChannel([[0, 0], [.56, 1], [1, 0]]);

/** Posterior-deltoid bar position with a longer hip hinge than the high-bar study. */
export const lowBarSquatStudy: MotionStudy = {
  id: "low-bar-squat", label: "Low-bar Back Squat", chinese: "低杠深蹲",
  subtitle: "杠落后三角肌，髋后移与躯干前倾，脚掌稳定支撑", durationMs: 3900,
  keyframes: [{phase: 0, label: "低杠站位"}, {phase: .28, label: "屈髋下蹲"}, {phase: .56, label: "髋低于膝"}, {phase: .78, label: "髋肩同升"}],
  pose(phase) {
    const amount = squatDepth(phase01(phase)), lean = .13 + .68 * amount;
    const up = v(0, Math.cos(lean), Math.sin(lean)), forward = v(0, -Math.sin(lean), Math.cos(lean));
    // The low bar is 6.5 cm down the trunk and 8 cm behind the shoulder centre.
    // Solve hips from a mid-foot shaft track rather than sliding the feet.
    const hips = v(0, .925 - .565 * amount, .035 - (BODY.torso - .065) * Math.sin(lean) + .08 * Math.cos(lean));
    const shoulders = add(hips, mul(up, BODY.torso));
    const barCenter = add(add(shoulders, mul(up, -.065)), mul(forward, -.08));
    const side = (sign: -1 | 1): SidePose => {
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0)), shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const ankle = v(sign * .195, .07, 0), wrist = add(barCenter, v(sign * .37, 0, 0));
      return { hip, shoulder, ankle, wrist, toe: v(sign * .23, .025, .175),
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * .26, 0, 1)),
        elbow: bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, add(mul(up, -1), mul(forward, -.28))) };
    };
    return { joints: joints(side(-1), side(1), add(shoulders, mul(up, .235)), add(shoulders, mul(up, .115))),
      bar: { center: barCenter, halfLength: .9, plateRadius: .18, support: "upper-back" },
      shorts: { hipFlexion: true }, camera: { yaw: 48, pitch: 9, viewBox: "0 0 360 360" } };
  },
};

const lungeStep = cleanChannel([[0, 0], [.25, 1], [.72, 1], [1, 0]]);
const lungeDown = cleanChannel([[0, 0], [.25, .50], [.53, 1], [.72, .50], [1, 0]]);
const rearLift = cleanChannel([[0, 0], [.11, .065], [.25, 0], [.72, 0], [.86, .085], [1, 0]]);
const rearPitch = cleanChannel([[0, 0], [.25, -.65], [.72, -.65], [1, 0]]);

/** The left foot steps back, lands on its forefoot, and returns beside the right. */
export const reverseLungeStudy: MotionStudy = {
  id: "reverse-lunge", label: "Reverse Lunge", chinese: "后撤弓步蹲",
  subtitle: "一脚后撤下沉，前脚蹬地，后脚收回并腿站起", durationMs: 4100,
  keyframes: [{phase: 0, label: "并腿站位"}, {phase: .16, label: "后撤跨步"}, {phase: .53, label: "后膝近地"}, {phase: .72, label: "前脚蹬起"}, {phase: .88, label: "收腿回位"}],
  pose(phase) {
    const t = phase01(phase), stride = lungeStep(t), amount = lungeDown(t), pitch = rearPitch(t);
    const lean = .06 + .10 * amount, up = v(0, Math.cos(lean), Math.sin(lean)), forward = v(0, -Math.sin(lean), Math.cos(lean));
    const hips = v(.025 * stride, .92 - .415 * amount, -.29 * stride);
    const shoulders = add(hips, mul(up, BODY.torso));
    const side = (sign: -1 | 1): SidePose => {
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0)), shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const rear = sign === -1, shoePitch = rear ? pitch : 0;
      // Distal sole center is the world anchor. Pitch rotates the whole rear
      // shoe about its ball, and a smooth swing raises it clear of the floor.
      const contactZ = .19 - .69 * stride;
      const ankle = rear ? v(-.10, -.19 * Math.sin(pitch) + .07 * Math.cos(pitch) + rearLift(t),
        contactZ - (.19 * Math.cos(pitch) + .07 * Math.sin(pitch))) : v(.10, .07, 0);
      const wrist = add(add(add(shoulders, v(sign * .085, 0, 0)), mul(up, -.145)), mul(forward, .245));
      return { hip, shoulder, ankle, wrist, toe: toeAt(ankle, shoePitch),
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * .035, 0, 1)),
        elbow: bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, add(v(sign * .5, 0, 0), mul(up, -1))) };
    };
    return { joints: joints(side(-1), side(1), add(shoulders, mul(up, .235)), add(shoulders, mul(up, .115))),
      feet: "air", footPitch: { left: pitch }, shorts: { hipFlexion: true },
      groundContacts: [v(.10, 0, 0), v(-.10, 0, -.50)],
      camera: { yaw: 65, pitch: 9, viewBox: "0 0 360 360" } };
  },
};

const bridgeLift = cleanChannel([[0, 0], [.40, 1], [.47, 1], [1, 0]]);

/** Bodyweight floor bridge: shoulder support and both flat feet remain fixed. */
export const gluteBridgeStudy: MotionStudy = {
  id: "glute-bridge", label: "Glute Bridge", chinese: "臀桥",
  subtitle: "肩背留在地面，脚掌支撑，伸髋至肩髋膝接近一线", durationMs: 3400,
  keyframes: [{phase: 0, label: "仰卧屈膝"}, {phase: .20, label: "脚掌推地"}, {phase: .40, label: "伸髋顶点"}, {phase: .72, label: "受控下放"}],
  pose(phase) {
    const amount = bridgeLift(phase01(phase)), shoulders = v(0, .135, -.5);
    const hipHeight = .135 + .18 * amount;
    const hips = v(0, hipHeight, shoulders.z + Math.sqrt(BODY.torso ** 2 - (hipHeight - shoulders.y) ** 2));
    const side = (sign: -1 | 1): SidePose => {
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0)), shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const ankle = v(sign * .14, .07, .49), wrist = v(sign * .28, .058, .04);
      return { hip, shoulder, ankle, wrist, toe: toeAt(ankle),
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(0, 1, 0)),
        elbow: bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, v(sign, -.08, 0)) };
    };
    const neck = add(shoulders, v(0, 0, -.115));
    const head = add(neck, mul(unit(v(0, -.01, -.12)), .12));
    return { joints: joints(side(-1), side(1), head, neck),
      shorts: { hipFlexion: true }, groundContacts: [v(-.14, 0, .49), v(.14, 0, .49), v(0, 0, -.5)],
      camera: { yaw: 112, pitch: 19, viewBox: "35 188 290 160" } };
  },
};

const thrustLift = cleanChannel([[0, 0], [.38, 1], [.46, 1], [1, 0]]);
const THRUST_CONTACT = v(0, .38, -.30);

/** Fixed scapular surface contact at the bench edge, with a hip-supported bar. */
export const hipThrustStudy: MotionStudy = {
  id: "hip-thrust", label: "Barbell Hip Thrust", chinese: "杠铃臀推",
  subtitle: "上背以凳沿为支点，双脚不滑动，杠铃随骨盆升降", durationMs: 3700,
  keyframes: [{phase: 0, label: "上背靠凳"}, {phase: .19, label: "蹬地伸髋"}, {phase: .38, label: "髋膝齐平"}, {phase: .73, label: "屈髋回落"}],
  pose(phase) {
    const amount = thrustLift(phase01(phase)), angle = .70 * (1 - amount);
    const up = v(0, Math.sin(angle), -Math.cos(angle)), forward = unit(cross(v(1, 0, 0), up));
    const backCenter = add(THRUST_CONTACT, mul(forward, .12));
    const shoulders = add(backCenter, mul(up, .10)), hips = add(shoulders, mul(up, -BODY.torso));
    const barCenter = add(add(hips, mul(forward, .105)), mul(up, -.015));
    const side = (sign: -1 | 1): SidePose => {
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0)), shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const ankle = v(sign * .17, .07, .53), wrist = add(barCenter, v(sign * .32, 0, 0));
      return { hip, shoulder, ankle, wrist, toe: toeAt(ankle),
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(0, 1, 0)),
        elbow: bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, add(v(sign, 0, 0), mul(forward, -.25))) };
    };
    const neck = add(shoulders, mul(unit(add(mul(up, .11), mul(forward, .035))), .115));
    const head = add(neck, mul(unit(add(mul(up, .125), mul(forward, .020))), .120));
    return { joints: joints(side(-1), side(1), head, neck),
      bar: { center: barCenter, halfLength: .9, plateRadius: .18, support: "hands", depthPolicy: "physical" },
      bench: { height: .38, start: -.85, end: -.28, halfWidth: .27 },
      apparatus: { rods: [{ id: "hip-thrust-pad", a: add(barCenter, v(-.17, 0, 0)), b: add(barCenter, v(.17, 0, 0)), radius: .045 }] },
      shorts: { hipFlexion: true }, groundContacts: [v(-.17, 0, .53), v(.17, 0, .53)],
      camera: { yaw: 108, pitch: 16, viewBox: "0 137 360 215" } };
  },
};
