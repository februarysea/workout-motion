import { add, bendJoint, blend, BODY, mul, sub, unit, v } from "./rig.js";
import type { MotionStudy, StudyPose, Vec3 } from "./rig.js";

type Pair = [number, number];
type Frame = {
  hip: Vec3; ankles: [Vec3, Vec3]; lean: number; arms: number;
  elbows?: number; pitches?: Pair; roll?: number; armSplit?: number;
};
type JumpBox = NonNullable<StudyPose["boxes"]>[number];
const G = 9.81, HEIGHT = .60, STAND = .93, HALF_STANCE = .17;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (time: number, start: number, end: number) => clamp((time - start) / (end - start));
const pitchOf = (frame: Frame): Pair => frame.pitches ?? [0, 0];
const hermite = (a: number, b: number, va: number, vb: number, t: number, seconds: number) =>
  (2 * t ** 3 - 3 * t * t + 1) * a + (t ** 3 - 2 * t * t + t) * seconds * va
  + (-2 * t ** 3 + 3 * t * t) * b + (t ** 3 - t * t) * seconds * vb;
const hermitePoint = (a: Vec3, b: Vec3, va: Vec3, vb: Vec3, t: number, seconds: number) =>
  v(hermite(a.x, b.x, va.x, vb.x, t, seconds), hermite(a.y, b.y, va.y, vb.y, t, seconds), hermite(a.z, b.z, va.z, vb.z, t, seconds));

/** Cubic channels have a shared tangent at internal keys, rather than stopping at every pose. */
function channel(keys: readonly (readonly [number, number])[], q: number): number {
  const x = clamp(q);
  let i = 0;
  while (i < keys.length - 2 && x > keys[i + 1][0]) i++;
  const [ta, a] = keys[i], [tb, b] = keys[i + 1], before = keys[Math.max(0, i - 1)], after = keys[Math.min(keys.length - 1, i + 2)];
  const va = i ? (b - before[1]) / (tb - before[0]) : 0;
  const vb = i + 1 < keys.length - 1 ? (after[1] - a) / (after[0] - ta) : 0;
  return hermite(a, b, va, vb, (x - ta) / (tb - ta), tb - ta);
}
function interpolate(a: Frame, b: Frame, q: number): Frame {
  const t = smooth(q), ap = pitchOf(a), bp = pitchOf(b);
  return { hip: blend(a.hip, b.hip, t), ankles: [blend(a.ankles[0], b.ankles[0], t), blend(a.ankles[1], b.ankles[1], t)],
    lean: lerp(a.lean, b.lean, t), arms: lerp(a.arms, b.arms, t), elbows: lerp(a.elbows ?? .16, b.elbows ?? .16, t),
    pitches: [lerp(ap[0], bp[0], t), lerp(ap[1], bp[1], t)], roll: lerp(a.roll ?? 0, b.roll ?? 0, t), armSplit: lerp(a.armSplit ?? 0, b.armSplit ?? 0, t) };
}
const stance = (center: Vec3, surface = 0): [Vec3, Vec3] => [add(center, v(-HALF_STANCE, surface + .07, 0)), add(center, v(HALF_STANCE, surface + .07, 0))];
const rotateFoot = (z: number, y: number, pitch: number) => v(0, y * Math.cos(pitch) + z * Math.sin(pitch), z * Math.cos(pitch) - y * Math.sin(pitch));
/** Rolling about the forefoot keeps its ground contact stationary while the heel rises. */
function toePlant(flat: Vec3, pitch: number): Vec3 {
  return sub(add(flat, v(0, -.07, .19)), rotateFoot(.19, -.07, pitch));
}
function planted(frame: Frame, flats: [Vec3, Vec3], pitch: number): Frame {
  return { ...frame, pitches: [pitch, pitch], ankles: [toePlant(flats[0], pitch), toePlant(flats[1], pitch)] };
}
function launchVelocity(from: Frame, to: Frame, seconds: number): Vec3 {
  return v((to.hip.x - from.hip.x) / seconds, (to.hip.y - from.hip.y) / seconds + G * seconds / 2, (to.hip.z - from.hip.z) / seconds);
}

/** Ballistic body travel; leg retraction, arms and ankles have distinct timing. */
function flight(from: Frame, to: Frame, q: number, seconds: number): Frame {
  const velocity = launchVelocity(from, to, seconds), elapsed = q * seconds;
  const hip = add(from.hip, mul(velocity, elapsed));
  hip.y -= G * elapsed * elapsed / 2;
  const tuck = .20 * Math.sin(Math.PI * q) ** 2;
  const ankles = from.ankles.map((foot, i) => {
    const end = to.ankles[i], point = blend(foot, end, smooth(q));
    const legDrop = lerp(from.hip.y - foot.y, to.hip.y - end.y, smooth(q)) - tuck;
    point.y = hip.y - legDrop;
    return point;
  }) as [Vec3, Vec3];
  const pitch = channel([[0, pitchOf(from)[0]], [.24, -.18], [.58, .10], [1, pitchOf(to)[0]]], q);
  return { hip, ankles, pitches: [pitch, pitch],
    lean: channel([[0, from.lean], [.25, .08], [.62, .28], [1, to.lean]], q),
    arms: channel([[0, from.arms], [.12, 2.05], [.60, .78], [1, to.arms]], q),
    elbows: channel([[0, from.elbows ?? .7], [.20, .72], [.57, 1.30], [1, to.elbows ?? .7]], q),
    roll: lerp(from.roll ?? 0, to.roll ?? 0, smooth(q)),
  };
}

function absorb(from: Frame, flatFeet: [Vec3, Vec3], velocity: Vec3, q: number, seconds: number): Frame {
  const elapsed = q * seconds, brake = Math.min(elapsed, .10), distanceTime = brake - brake * brake / .20;
  const frame: Frame = {
    hip: v(from.hip.x + velocity.x * distanceTime, hermite(from.hip.y, HEIGHT + .59, velocity.y, 0, q, seconds), from.hip.z + velocity.z * distanceTime),
    ankles: flatFeet, lean: lerp(from.lean, .37, smooth(q)), arms: lerp(from.arms, .20, smooth(q)),
    elbows: lerp(from.elbows ?? .7, .42, smooth(q)), roll: (from.roll ?? 0) * (1 - smooth(q)),
  };
  return planted(frame, flatFeet, lerp(pitchOf(from)[0], 0, smooth(elapsed / .065)));
}

/** A single continuous arc, with earlier horizontal progress when stepping down. */
function swingFoot(from: Vec3, to: Vec3, q: number): Vec3 {
  if (to.y < from.y - .03) q = clamp(q / .90);
  const up = to.y - from.y, progress = (up < -.03 ? 1 - (1 - smooth(q)) ** 3.5 : smooth(q) ** (up > .03 ? 1.25 : 1));
  const point = blend(from, to, progress);
  const vertical = up < -.03 ? smooth(at(q, .20, 1)) : up > .03 ? 1 - (1 - q) ** 3 : smooth(q);
  point.y = from.y + up * vertical + .070 * Math.sin(Math.PI * q);
  return point;
}

/** Hip tangents carry through successive steps; the support shoe remains planted. */
function walk(frames: Frame[], times: number[], time: number): Frame {
  let index = 0;
  while (index < frames.length - 2 && time > times[index + 1]) index++;
  const a = frames[index], b = frames[index + 1], seconds = times[index + 1] - times[index], q = at(time, times[index], times[index + 1]);
  const velocity = (i: number) => {
    if (i === 0 || i === frames.length - 1) return v(0, 0, 0);
    const tangent = mul(sub(frames[i + 1].hip, frames[i - 1].hip), 1 / (times[i + 1] - times[i - 1]));
    // Reverse vertical travel at a real weight-transfer minimum; averaging the
    // neighbours here would create an extra single-leg squat after contact.
    if ((frames[i].hip.y - frames[i - 1].hip.y) * (frames[i + 1].hip.y - frames[i].hip.y) <= 0) tangent.y = 0;
    return tangent;
  };
  const moving: 0 | 1 = index % 2 === 0 ? 0 : 1, support = moving === 0 ? 1 : 0;
  const frame = interpolate(a, b, q), sway = Math.sin(Math.PI * q), supportSign = support ? 1 : -1;
  frame.hip = hermitePoint(a.hip, b.hip, velocity(index), velocity(index + 1), q, seconds);
  frame.hip.x += supportSign * .023 * sway * (1 - 2 * smooth(q));
  if (a.hip.y > b.hip.y + .15) {
    if (Math.abs(b.hip.x - a.hip.x) > .2) frame.hip.x -= .20 * sway * sway;
    else frame.hip.z -= .13 * sway;
  }
  frame.hip.y -= .012 * sway * sway;
  frame.ankles[moving] = swingFoot(a.ankles[moving], b.ankles[moving], q);
  frame.ankles[support] = a.ankles[support];
  frame.pitches = [0, 0];
  frame.pitches[moving] = .14 * Math.sin(Math.PI * (b.ankles[moving].y < a.ankles[moving].y - .03 ? clamp(q / .90) : q));
  frame.armSplit = (moving ? 1 : -1) * .24 * sway;
  frame.elbows = lerp(a.elbows ?? .16, b.elbows ?? .16, smooth(q)) + .12 * sway;
  frame.roll = supportSign * .025 * sway;
  return frame;
}

function skeleton(frame: Frame, boxes: JumpBox[], camera: NonNullable<StudyPose["camera"]>): StudyPose {
  const roll = frame.roll ?? 0, c = Math.cos(roll), s = Math.sin(roll);
  const up = v(s, c * Math.cos(frame.lean), c * Math.sin(frame.lean));
  const across = v(c, -s * Math.cos(frame.lean), -s * Math.sin(frame.lean));
  const forward = v(0, -Math.sin(frame.lean), Math.cos(frame.lean));
  const shoulders = add(frame.hip, mul(up, BODY.torso)), pitches = pitchOf(frame);
  const side = (sign: -1 | 1, index: 0 | 1) => {
    const hip = add(frame.hip, v(sign * BODY.hipHalf, 0, 0)), shoulder = add(shoulders, mul(across, sign * BODY.shoulderHalf));
    const ankle = frame.ankles[index], knee = bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * .08, 0, 1));
    const angle = frame.arms + sign * (frame.armSplit ?? 0), bend = frame.elbows ?? .16;
    const upper = unit(add(add(mul(forward, Math.sin(angle)), mul(up, -Math.cos(angle))), mul(across, sign * .13)));
    const lower = unit(add(add(mul(forward, Math.sin(angle + bend)), mul(up, -Math.cos(angle + bend))), mul(across, sign * .05)));
    const elbow = add(shoulder, mul(upper, BODY.upperArm)), wrist = add(elbow, mul(lower, BODY.forearm));
    return { hip, shoulder, ankle, knee, elbow, wrist, toe: add(ankle, rotateFoot(.17, -.045, pitches[index])) };
  };
  const left = side(-1, 0), right = side(1, 1);
  return { joints: {
    head: add(shoulders, mul(up, .235)), neck: add(shoulders, mul(up, .115)),
    leftShoulder: left.shoulder, rightShoulder: right.shoulder, leftElbow: left.elbow, rightElbow: right.elbow,
    leftWrist: left.wrist, rightWrist: right.wrist, leftHip: left.hip, rightHip: right.hip,
    leftKnee: left.knee, rightKnee: right.knee, leftAnkle: left.ankle, rightAnkle: right.ankle, leftToe: left.toe, rightToe: right.toe,
  }, feet: "air", footPitch: { left: pitches[0], right: pitches[1] }, boxes, camera };
}

function directJump(lateral: boolean): (phase: number) => StudyPose {
  const direction = lateral ? v(1, 0, 0) : v(0, 0, 1);
  const point = (distance: number, height = 0, back = 0) => add(mul(direction, distance), v(0, height, -back));
  // The near shoe starts 24 cm from the box face (23.7 cm laterally).
  // Keep the walk-off landing farther back than takeoff so each return footfall has room.
  const start = lateral ? -.37 : -.40, target = lateral ? .40 : .30, exit = lateral ? -.50 : -.56;
  const boxes: JumpBox[] = [{ id: "target", center: point(target), width: .62, depth: .54, height: HEIGHT }];
  const camera = lateral ? { yaw: 25, pitch: 10, viewBox: "-15 -25 390 390" } : { yaw: -55, pitch: 10, viewBox: "-15 -25 390 390" };
  const grounded = stance(point(start)), onBox = stance(point(target), HEIGHT), onExit = stance(point(exit));
  const standing: Frame = { hip: point(start, STAND), ankles: grounded, lean: .025, arms: .06, elbows: .18 };
  const crouch: Frame = { hip: lateral ? point(start - .13, .64, .14) : point(start, .64, .24), ankles: grounded, lean: .40, arms: -.70, elbows: .30, roll: lateral ? -.07 : 0 };
  const launch = planted({ hip: lateral ? point(start + .09, .985, .015) : point(start, 1.005, .02), ankles: grounded, lean: .12, arms: 1.95, elbows: .36, roll: lateral ? .05 : 0 }, grounded, -.48);
  const touchdown = planted({ hip: point(target, HEIGHT + .75, .09), ankles: onBox, lean: .23, arms: .60, elbows: .72, roll: lateral ? .035 : 0 }, onBox, -.12);
  const velocity = launchVelocity(launch, touchdown, .52), incoming = add(velocity, v(0, -G * .52, 0));
  const compressed = absorb(touchdown, onBox, incoming, 1, .20);
  const top: Frame = { hip: point(target, HEIGHT + STAND), ankles: onBox, lean: .02, arms: .05, elbows: .24 };
  const downLeft: Frame = { hip: point(lateral ? exit + .20 : exit + .06, lateral ? .80 : .90), ankles: [onExit[0], onBox[1]], lean: .13, arms: .10, elbows: .3 };
  const downBoth: Frame = { hip: point(exit, .91), ankles: onExit, lean: .05, arms: .06, elbows: .3 };
  const backLeft: Frame = { hip: point((start + exit) / 2, .88), ankles: [grounded[0], onExit[1]], lean: .08, arms: .08, elbows: .3 };
  const recovery = [top, downLeft, downBoth, backLeft, standing], times = [1.82, 2.45, 3, 3.4, 3.82];
  return phase => {
    const time = (phase >= 1 ? 0 : Math.max(0, phase)) * 4;
    let frame: Frame;
    if (time < .45) frame = interpolate(standing, crouch, time / .45);
    else if (time < .68) {
      const q = at(time, .45, .68);
      frame = interpolate(crouch, launch, q);
      frame.hip = hermitePoint(crouch.hip, launch.hip, v(0, 0, 0), velocity, q, .23);
      // Heel lift is concentrated into terminal extension, after the arm swing starts.
      frame = planted(frame, grounded, -.48 * smooth(at(q, .44, 1)));
      frame.arms = lerp(crouch.arms, launch.arms, smooth(Math.min(1, q * 1.14)));
      frame.elbows = channel([[0, .30], [.50, .62], [1, .36]], q);
    } else if (time < 1.20) frame = flight(launch, touchdown, at(time, .68, 1.20), .52);
    else if (time < 1.40) frame = absorb(touchdown, onBox, incoming, at(time, 1.20, 1.40), .20);
    else if (time < 1.82) frame = interpolate(compressed, top, at(time, 1.40, 1.82));
    else if (time < 3.82) frame = walk(recovery, times, time);
    else frame = standing;
    return skeleton(frame, boxes, camera);
  };
}

const directFrames = (lateral: boolean) => [
  { phase: 0, label: lateral ? "侧向站位" : "双脚站位" }, { phase: .45 / 4, label: "预摆蓄力" },
  { phase: .68 / 4, label: "摆臂蹬地" }, { phase: .90 / 4, label: lateral ? "侧向收腿" : "腾空收腿" },
  { phase: 1.20 / 4, label: "前脚掌落箱" }, { phase: 1.40 / 4, label: "落跟缓冲" },
  { phase: 1.82 / 4, label: "箱上站起" }, { phase: 2.75 / 4, label: "自然迈步复位" },
];
export const boxJumpStudy: MotionStudy = {
  id: "box-jump", label: "Standing Box Jump", chinese: "双脚跳箱",
  subtitle: "预摆、蹬地、腾空收腿与落跟缓冲；以连贯迈步回到起点",
  durationMs: 4000, keyframes: directFrames(false), pose: directJump(false),
};
export const lateralBoxJumpStudy: MotionStudy = {
  id: "lateral-box-jump", label: "Lateral Box Jump", chinese: "侧向跳箱",
  subtitle: "保持面朝前侧向腾空，摆臂与身体转移错开，落箱后连贯迈步复位",
  durationMs: 4000, keyframes: directFrames(true), pose: directJump(true),
};

function dropSequence(): (phase: number) => StudyPose {
  // Ground contact leaves a 24 cm toe-to-box gap; the low drop platform stays 20 cm.
  const start = -1.05, ground = -.35, target = .35, exit = -.38, returnFloor = -.54, lowHeight = .20;
  const point = (z: number, y = 0) => v(0, y, z);
  const lowFeet = stance(point(start), lowHeight), groundFeet = stance(point(ground)), targetFeet = stance(point(target), HEIGHT);
  const exitFeet = stance(point(exit)), returnFeet = stance(point(returnFloor));
  const boxes: JumpBox[] = [
    { id: "drop-platform", center: point(start), width: .76, depth: .60, height: lowHeight },
    { id: "target", center: point(target), width: .62, depth: .54, height: HEIGHT },
  ];
  const standing: Frame = { hip: point(start, lowHeight + STAND), ankles: lowFeet, lean: .025, arms: .06, elbows: .18 };
  const edge: Frame = { hip: point(-.68, 1.03), ankles: [v(-HALF_STANCE, .32, -.50), lowFeet[1]], lean: .10, arms: -.38, elbows: .38 };
  const contact = planted({ hip: point(ground - .04, edge.hip.y - G * .22 ** 2 / 2), ankles: groundFeet, lean: .16, arms: .18, elbows: .65 }, groundFeet, -.09);
  const dropVelocity = v(0, 0, (contact.hip.z - edge.hip.z) / .22);
  const load: Frame = { hip: point(contact.hip.z + dropVelocity.z * .045, .69), ankles: groundFeet, lean: .29, arms: .58, elbows: .74 };
  const launch = planted({ hip: point(ground + .10, 1.005), ankles: groundFeet, lean: .12, arms: 1.95, elbows: .36 }, groundFeet, -.48);
  const touchdown = planted({ hip: point(target - .09, HEIGHT + .75), ankles: targetFeet, lean: .23, arms: .60, elbows: .72 }, targetFeet, -.12);
  const velocity = launchVelocity(launch, touchdown, .52), incoming = add(velocity, v(0, -G * .52, 0));
  const compressed = absorb(touchdown, targetFeet, incoming, 1, .20);
  const top: Frame = { hip: point(target, HEIGHT + STAND), ankles: targetFeet, lean: .02, arms: .05, elbows: .24 };
  const downLeft: Frame = { hip: point(exit + .02, .90), ankles: [exitFeet[0], targetFeet[1]], lean: .13, arms: .10, elbows: .3 };
  const downBoth: Frame = { hip: point(exit, .91), ankles: exitFeet, lean: .05, arms: .06, elbows: .3 };
  const backLeft: Frame = { hip: point((exit + returnFloor) / 2, .86), ankles: [returnFeet[0], exitFeet[1]], lean: .08, arms: .08, elbows: .3 };
  const backBoth: Frame = { hip: point(returnFloor, .91), ankles: returnFeet, lean: .04, arms: .06, elbows: .3 };
  const upLeft: Frame = { hip: point((returnFloor + start) / 2, .86), ankles: [lowFeet[0], returnFeet[1]], lean: .11, arms: .09, elbows: .3 };
  const recovery = [top, downLeft, downBoth, backLeft, backBoth, upLeft, standing], times = [2.02, 2.62, 3.15, 3.51, 3.87, 4.32, 4.82];
  return phase => {
    const time = (phase >= 1 ? 0 : Math.max(0, phase)) * 5;
    let frame: Frame;
    if (time < .43) {
      const q = time / .43;
      frame = interpolate(standing, edge, q);
      frame.ankles[0] = swingFoot(standing.ankles[0], edge.ankles[0], q);
      frame.hip = hermitePoint(standing.hip, edge.hip, v(0, 0, 0), dropVelocity, q, .43);
      frame.roll = .03 * Math.sin(Math.PI * q);
    } else if (time < .65) {
      const q = at(time, .43, .65), elapsed = q * .22, hip = add(edge.hip, mul(dropVelocity, elapsed));
      hip.y -= G * elapsed * elapsed / 2;
      const ankles = edge.ankles.map((foot, index) => {
        const ankle = blend(foot, contact.ankles[index], q);
        ankle.y += (index === 0 ? .035 : .16) * Math.sin(Math.PI * q);
        return ankle;
      }) as [Vec3, Vec3];
      frame = { ...interpolate(edge, contact, q), hip, ankles };
    } else if (time < .74) {
      const q = at(time, .65, .74);
      frame = interpolate(contact, load, q);
      frame.hip.y = hermite(contact.hip.y, load.hip.y, -G * .22, 0, q, .09);
      frame.hip.z = hermite(contact.hip.z, load.hip.z, dropVelocity.z, 0, q, .09);
      frame = planted(frame, groundFeet, -.09 * (1 - smooth(q)));
    } else if (time < .88) {
      const q = at(time, .74, .88);
      frame = interpolate(load, launch, q);
      frame.hip = hermitePoint(load.hip, launch.hip, v(0, 0, 0), velocity, q, .14);
      frame = planted(frame, groundFeet, -.48 * smooth(at(q, .38, 1)));
    } else if (time < 1.40) frame = flight(launch, touchdown, at(time, .88, 1.40), .52);
    else if (time < 1.60) frame = absorb(touchdown, targetFeet, incoming, at(time, 1.40, 1.60), .20);
    else if (time < 2.02) frame = interpolate(compressed, top, at(time, 1.60, 2.02));
    else if (time < 4.82) frame = walk(recovery, times, time);
    else frame = standing;
    return skeleton(frame, boxes, { yaw: -55, pitch: 10, viewBox: "-40 -25 440 390" });
  };
}
export const depthBoxJumpStudy: MotionStudy = {
  id: "depth-box-jump", label: "Drop-to-Box Jump", chinese: "落下反弹跳箱",
  subtitle: "迈出低台、前脚掌触地立即反弹，落箱吸收冲击后连贯迈步返回",
  durationMs: 5000,
  keyframes: [
    { phase: 0, label: "低台站位" }, { phase: .43 / 5, label: "迈出低台" },
    { phase: .65 / 5, label: "前脚掌触地" }, { phase: .88 / 5, label: "蹬地反弹" },
    { phase: 1.10 / 5, label: "腾空收腿" }, { phase: 1.40 / 5, label: "前脚掌落箱" },
    { phase: 1.60 / 5, label: "落跟缓冲" }, { phase: 2.02 / 5, label: "箱上站起" },
  ], pose: dropSequence(),
};
