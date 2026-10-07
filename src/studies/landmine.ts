import { add, bendJoint, BODY, mul, unit, v } from "./rig.js";
import type { MotionStudy } from "./rig.js";

type Key = readonly [time: number, value: number];
const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shape-preserving channels avoid pauses at every authored intermediate pose. */
function channel(keys: readonly Key[]): (time: number) => number {
  const tangents = keys.map((key, i) => {
    if (!i || i === keys.length - 1) return 0;
    const a = keys[i - 1], b = keys[i + 1];
    const before = (key[1] - a[1]) / (key[0] - a[0]);
    const after = (b[1] - key[1]) / (b[0] - key[0]);
    if (before * after <= 0) return 0;
    const first = 2 * (b[0] - key[0]) + key[0] - a[0];
    const second = b[0] - key[0] + 2 * (key[0] - a[0]);
    return (first + second) / (first / before + second / after);
  });
  return time => {
    if (time <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      if (time <= b[0]) return hermite(a[1], b[1], tangents[i - 1], tangents[i], (time - a[0]) / (b[0] - a[0]), b[0] - a[0]);
    }
    return keys.at(-1)![1];
  };
}
function hermite(a: number, b: number, fromVelocity: number, toVelocity: number, q: number, seconds: number): number {
  return (2 * q ** 3 - 3 * q * q + 1) * a + (q ** 3 - 2 * q * q + q) * seconds * fromVelocity
    + (-2 * q ** 3 + 3 * q * q) * b + (q ** 3 - q * q) * seconds * toVelocity;
}

const DURATION = 3.8;
const CONTACT_FROM_CAP = .09, WRIST_BELOW_CONTACT = .06, WRIST_RADIAL = .035;
const WRIST_RADIUS = 2 - CONTACT_FROM_CAP - WRIST_BELOW_CONTACT;
const TOP_ANGLE = .986;
const GRAVITY = 9.81;
const HOPS = [
  { start: .62, end: .91, lift: .095 },
  { start: 2.53, end: 2.80, lift: .080 },
] as const;
const launchY = .880, landingY = .835;
const velocity = (seconds: number): number => (landingY - launchY + .5 * GRAVITY * seconds * seconds) / seconds;
const leanAt = channel([[0, .06], [.38, .14], [.62, .045], [.78, .035], [.91, .065], [1.06, .14], [1.24, .065], [1.59, .065], [2.10, .07], [2.33, .13], [2.53, .05], [2.80, .07], [2.95, .13], [DURATION, .06]]);
const depthAt = channel([[0, 0], [.38, -.025], [.62, .025], [.91, .065], [1.06, .075], [1.59, .075], [2.10, .015], [2.33, -.01], [2.53, 0], [2.80, .015], [2.95, .015], [DURATION, 0]]);
const leftPitchAt = channel([[0, -.18], [.38, -.16], [.62, -.24], [.77, -.10], [.91, 0], [2.33, 0], [2.53, -.24], [2.665, -.10], [2.80, -.12], [2.95, -.18], [DURATION, -.18]]);
const rightPitchAt = channel([[0, 0], [.38, 0], [.62, -.24], [.77, -.10], [.91, -.10], [1.06, -.17], [2.33, -.17], [2.53, -.24], [2.665, -.10], [2.80, 0], [DURATION, 0]]);
const freeSwingAt = channel([[0, .10], [.38, .28], [.62, -.44], [.80, -.28], [1.06, .38], [1.24, .10], [1.59, .10], [2.10, .10], [2.33, .24], [2.53, -.24], [2.80, .20], [2.95, .32], [DURATION, .10]]);

/** Ballistic flight connects to drive/absorption with matched vertical velocity. */
function hipHeight(time: number): number {
  const firstSeconds = HOPS[0].end - HOPS[0].start, firstVelocity = velocity(firstSeconds);
  const secondSeconds = HOPS[1].end - HOPS[1].start, secondVelocity = velocity(secondSeconds);
  if (time < .38) return mix(.79, .70, smooth(time / .38));
  if (time < .62) return hermite(.70, launchY, 0, firstVelocity, (time - .38) / .24, .24);
  if (time < .91) { const t = time - .62; return launchY + firstVelocity * t - .5 * GRAVITY * t * t; }
  if (time < 1.06) return hermite(landingY, .750, firstVelocity - GRAVITY * firstSeconds, 0, (time - .91) / .15, .15);
  if (time < 1.24) return mix(.750, .82, smooth((time - 1.06) / .18));
  if (time < 1.59) return .82;
  if (time < 2.10) return mix(.82, .80, smooth((time - 1.59) / .51));
  if (time < 2.33) return mix(.80, .73, smooth((time - 2.10) / .23));
  if (time < 2.53) return hermite(.73, launchY, 0, secondVelocity, (time - 2.33) / .20, .20);
  if (time < 2.80) { const t = time - 2.53; return launchY + secondVelocity * t - .5 * GRAVITY * t * t; }
  if (time < 2.95) return hermite(landingY, .745, secondVelocity - GRAVITY * secondSeconds, 0, (time - 2.80) / .15, .15);
  return mix(.745, .79, smooth((time - 2.95) / (DURATION - 2.95)));
}

/** The anatomical wrist sits beside the sleeve, below the finger contact.
 * Its orbit remains a circle: solve that wrist circle against the shoulder,
 * rather than treating the endcap as the wrist and drawing a hand on top. */
function angleForReach(time: number, reach: number): number {
  const lean = leanAt(time);
  const vertical = hipHeight(time) + BODY.torso * Math.cos(lean) - .04;
  const horizontal = 1.62 - depthAt(time) - BODY.torso * Math.sin(lean);
  const radius = Math.hypot(vertical, horizontal), lateral = .24 + WRIST_RADIAL - BODY.shoulderHalf;
  const cosine = (radius * radius + lateral * lateral + WRIST_RADIUS * WRIST_RADIUS - reach * reach) / (2 * WRIST_RADIUS * radius);
  return Math.atan2(vertical, horizontal) + Math.acos(Math.max(-1, Math.min(1, cosine)));
}
const angleAt = channel([
  [0, angleForReach(0, .22)], [.38, angleForReach(.38, .19)], [.62, angleForReach(.62, .50)],
  [.74, TOP_ANGLE], [1.59, TOP_ANGLE], [2.10, angleForReach(2.10, .23)],
  [2.33, angleForReach(2.33, .215)], [2.53, angleForReach(2.53, .23)],
  [2.665, angleForReach(2.665, .26)], [2.80, angleForReach(2.80, .22)],
  [2.95, angleForReach(2.95, .215)], [DURATION, angleForReach(DURATION, .22)],
]);

/** Single-arm speed press: dip/drive → scissor hop → top hold → rack/reset hop. */
export const landmineStudy: MotionStudy = {
  id: "landmine-press",
  label: "Landmine Split-switch Push Press",
  chinese: "单手地雷杆换步推举",
  subtitle: "速度样板：侧握杆身、蹬伸小跳换步，最高点稳住后受控回肩并小跳复位",
  durationMs: DURATION * 1000,
  keyframes: [
    { phase: 0, label: "分腿持杆" }, { phase: .38 / DURATION, label: "屈膝蓄力" },
    { phase: .62 / DURATION, label: "蹬伸推起" }, { phase: .78 / DURATION, label: "腾空换步" },
    { phase: 1.06 / DURATION, label: "落地缓冲" }, { phase: 1.40 / DURATION, label: "最高点停稳" },
    { phase: 2.10 / DURATION, label: "受控回肩" }, { phase: 2.665 / DURATION, label: "小跳换回" },
  ],
  pose(phase) {
    const t = (phase >= 1 ? 0 : Math.max(0, phase)) * DURATION;
    let switchAmount = 0, footLift = 0;
    if (t >= HOPS[0].start && t <= HOPS[0].end) {
      const q = (t - HOPS[0].start) / (HOPS[0].end - HOPS[0].start);
      switchAmount = smooth(q);
      footLift = HOPS[0].lift * Math.sin(Math.PI * q);
    } else if (t > HOPS[0].end && t < HOPS[1].start) switchAmount = 1;
    else if (t >= HOPS[1].start && t <= HOPS[1].end) {
      const q = (t - HOPS[1].start) / (HOPS[1].end - HOPS[1].start);
      switchAmount = 1 - smooth(q);
      footLift = HOPS[1].lift * Math.sin(Math.PI * q);
    }
    const lean = leanAt(t), up = v(0, Math.cos(lean), Math.sin(lean));
    const forward = v(0, -Math.sin(lean), Math.cos(lean));
    const hip = v(0, hipHeight(t), depthAt(t)), shoulders = add(hip, mul(up, BODY.torso));
    const pivot = v(.24, .04, 1.62);
    const angle = angleAt(t), shaft = v(0, Math.sin(angle), -Math.cos(angle));
    const tip = add(pivot, mul(shaft, 2));
    const contact = add(tip, mul(shaft, -CONTACT_FROM_CAP));
    const workingWrist = add(add(contact, mul(shaft, -WRIST_BELOW_CONTACT)), v(WRIST_RADIAL, 0, 0));
    const at = (sign: -1 | 1) => {
      const h = add(hip, v(sign * BODY.hipHalf, 0, 0));
      const s = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const pitch = sign === -1 ? leftPitchAt(t) : rightPitchAt(t);
      const c = Math.cos(pitch), sine = Math.sin(pitch);
      const footForward = unit(v(sign * .025, 0, .18));
      // Roll about the planted front sole at along=.19 / localY=-.07.
      // The same construction in flight keeps the lowest complete shoe point
      // at footLift; changing ankle pitch never pulls its tip through the floor.
      const roll = .19 * (1 - c) - .07 * sine;
      const ankle = add(v(sign * .17, .07 * c - .19 * sine + footLift, sign * .24 * (1 - 2 * switchAmount)), mul(footForward, roll));
      const toe = add(add(ankle, mul(footForward, .17 * c + .045 * sine)), v(0, .17 * sine - .045 * c, 0));
      const knee = bendJoint(h, ankle, BODY.thigh, BODY.shin, v(sign * .10, 0, 1));
      const swing = freeSwingAt(t);
      const elbow = sign === 1
        ? bendJoint(s, workingWrist, BODY.upperArm, BODY.forearm, v(.16, -1, .15))
        : add(s, mul(unit(add(add(mul(up, -Math.cos(swing)), mul(forward, Math.sin(swing))), v(-.22, 0, 0))), BODY.upperArm));
      const wrist = sign === 1 ? workingWrist
        : add(elbow, mul(unit(add(add(mul(up, -Math.cos(swing + .70)), mul(forward, Math.sin(swing + .70))), v(-.07, 0, 0))), BODY.forearm));
      return { hip: h, shoulder: s, ankle, toe, knee, elbow, wrist };
    };
    const left = at(-1), right = at(1);
    return {
      joints: {
        head: add(shoulders, mul(up, .235)), neck: add(shoulders, mul(up, .115)),
        leftShoulder: left.shoulder, rightShoulder: right.shoulder,
        leftElbow: left.elbow, rightElbow: right.elbow,
        leftWrist: left.wrist, rightWrist: right.wrist,
        leftHip: left.hip, rightHip: right.hip,
        leftKnee: left.knee, rightKnee: right.knee,
        leftAnkle: left.ankle, rightAnkle: right.ankle,
        leftToe: left.toe, rightToe: right.toe,
      },
      feet: "air",
      footPitch: { left: leftPitchAt(t), right: rightPitchAt(t) },
      landmine: { pivot, tip, plateRadius: .17, hand: "right" },
      grips: { right: contact },
      camera: { yaw: 65, pitch: 9, viewBox: "-35 10 360 360" },
    };
  },
};
