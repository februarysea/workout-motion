import { cross, add, bendJoint, blend, BODY, mul, sub, unit, v } from "./rig.js";
import type { MotionStudy, StudyPose, Vec3 } from "./rig.js";

type Limb = { shoulder: Vec3; elbow: Vec3; wrist: Vec3; hip: Vec3; knee: Vec3; ankle: Vec3; toe: Vec3 };
type Apparatus = NonNullable<StudyPose["apparatus"]>;
const rod = (id: string, a: Vec3, b: Vec3, radius = .014) => ({ id, a, b, radius });
const cycle = (phase: number, turn = .42) => {
  const p = ((phase % 1) + 1) % 1;
  const t = p <= turn ? p / turn : (1 - p) / (1 - turn);
  return (1 - Math.cos(Math.PI * t)) / 2;
};
function joints(left: Limb, right: Limb, shoulders: Vec3, up = v(0, 1, 0)): StudyPose["joints"] {
  return {
    head: add(shoulders, mul(up, .235)), neck: add(shoulders, mul(up, .115)),
    leftShoulder: left.shoulder, rightShoulder: right.shoulder,
    leftElbow: left.elbow, rightElbow: right.elbow,
    leftWrist: left.wrist, rightWrist: right.wrist,
    leftHip: left.hip, rightHip: right.hip,
    leftKnee: left.knee, rightKnee: right.knee,
    leftAnkle: left.ankle, rightAnkle: right.ankle,
    leftToe: left.toe, rightToe: right.toe,
  };
}
function seat(height: number): Apparatus {
  return {
    pads: [{ id: "seat", center: v(0, height, -.035), axis: v(0, 0, 1), length: .36, width: .40, thickness: .06 }],
    rods: [rod("seat-post", v(0, .025, -.04), v(0, height - .06, -.04), .026),
      rod("seat-base", v(-.27, .025, -.04), v(.27, .025, -.04), .02)],
  };
}
/** A sparse floor-supported pulley frame, not a floating cable endpoint. */
function tower(height: number, forward: number, pulley: Vec3): Apparatus {
  return { rods: [
    rod("tower-post", v(0, .025, forward), v(0, height, forward), .023),
    rod("tower-base", v(-.32, .025, forward), v(.32, .025, forward), .024),
    rod("tower-foot", v(0, .025, forward - .17), v(0, .025, forward + .20), .023),
    rod("pulley-boom", v(0, height, forward), pulley, .02),
    rod("pulley-axle", add(pulley, v(-.048, 0, 0)), add(pulley, v(.048, 0, 0)), .025),
  ] };
}
const hands = (left: Limb, right: Limb, axis: Vec3): StudyPose["handholds"] => ({
  left: { center: left.wrist, axis }, right: { center: right.wrist, axis },
});

/** Original neutral-grip low cable row; no torso pumping or sliding contacts. */
export const seatedCableRowStudy: MotionStudy = {
  id: "seated-cable-row", label: "Seated Cable Row", chinese: "坐姿绳索划船",
  subtitle: "中立握低位绳索，肘向后拉至下肋，保持坐姿稳定", durationMs: 3600,
  keyframes: [{ phase: 0, label: "伸臂准备" }, { phase: .21, label: "肘向后拉" }, { phase: .42, label: "下肋收缩" }, { phase: .71, label: "受控伸臂" }],
  pose(phase) {
    const amount = cycle(phase), up = unit(v(0, 1, -.055));
    const hips = v(0, .57, 0), shoulders = add(hips, mul(up, BODY.torso));
    const handle = blend(v(0, 1.005, .60), v(0, .83, .18), amount);
    const side = (sign: -1 | 1): Limb => {
      const shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0));
      const contact = add(handle, v(sign * .13, 0, 0));
      // Solve the elbow against the handle with a short, straight hand added
      // to the forearm reach, then recover the anatomical wrist. The handle
      // width stays rigid and neither wrist sits in the middle of a shaft.
      const elbow = bendJoint(shoulder, contact, BODY.upperArm, BODY.forearm + .05, v(sign * .45, -.2, -1));
      const wrist = add(contact, mul(unit(sub(elbow, contact)), .05));
      const ankle = v(sign * .15, .13, .70);
      return { shoulder, hip, wrist, ankle,
        // Keep the elbow by the ribs, with the upper arm travelling backwards.
        // The previous wide pole flared the elbow and rotated its muscle side
        // across the camera even though the hand followed a quiet row path.
        elbow,
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(0, 1, .25)),
        toe: add(ankle, v(0, -.045, .17)) };
    };
    const left = side(-1), right = side(1), seatParts = seat(.47), pulley = v(0, .53, 1.08);
    const frame = tower(.53, 1.20, pulley), leftGrip = add(handle, v(-.13, 0, 0)), rightGrip = add(handle, v(.13, 0, 0));
    return {
      joints: joints(left, right, shoulders, up),
      handholds: { left: { center: leftGrip, axis: v(0, 1, 0), grip: "neutral" }, right: { center: rightGrip, axis: v(0, 1, 0), grip: "neutral" } },
      anatomy: { surfaceArms: true }, occlusion: "surface", feet: "air", shorts: { hipFlexion: true },
      apparatus: {
        rods: [...seatParts.rods!, ...frame.rods!,
          rod("row-handle-cross", add(handle, v(-.13, .075, 0)), add(handle, v(.13, .075, 0)), .012),
          rod("row-handle-left", add(leftGrip, v(0, -.075, 0)), add(leftGrip, v(0, .075, 0)), .013),
          rod("row-handle-right", add(rightGrip, v(0, -.075, 0)), add(rightGrip, v(0, .075, 0)), .013),
          rod("footrest-beam", v(-.29, .04, .77), v(.29, .04, .77), .02)],
        cables: [{ id: "row-cable", a: pulley, b: add(handle, v(0, .075, 0)) }],
        pads: [...seatParts.pads!, ...([-1, 1] as const).map(sign => ({ id: `row-foot-${sign}`, center: v(sign * .15, .055, .775), axis: v(0, 0, 1), length: .31, width: .16, thickness: .028 }))],
      },
      camera: { yaw: 62, pitch: 10, viewBox: "-5 115 315 225" },
    };
  },
};

/** Original wide pronated pulldown in front of the face, with seated supports. */
export const latPulldownStudy: MotionStudy = {
  id: "lat-pulldown", label: "Lat Pulldown", chinese: "高位下拉",
  subtitle: "宽正握胸前下拉，肘向下向后，坐垫和压腿垫稳定支撑", durationMs: 3700,
  keyframes: [{ phase: 0, label: "头顶伸臂" }, { phase: .21, label: "向下拉杆" }, { phase: .42, label: "胸前收缩" }, { phase: .71, label: "受控上放" }],
  pose(phase) {
    const amount = cycle(phase), up = unit(v(0, 1, -.14));
    const hips = v(0, .57, 0), shoulders = add(hips, mul(up, BODY.torso));
    const handle = v(0, 1.51 - .405 * amount, .20), pulley = v(0, 1.96, .20);
    const side = (sign: -1 | 1): Limb => {
      const shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0));
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0));
      const wrist = add(handle, v(sign * .40, 0, 0)), ankle = v(sign * .15, .07, .47);
      return { shoulder, hip, wrist, ankle,
        elbow: bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, v(sign * .55, -.8, -.3)),
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(0, .2, 1)),
        toe: add(ankle, v(0, -.045, .17)) };
    };
    const left = side(-1), right = side(1), seatParts = seat(.47), frame = tower(1.96, .91, pulley);
    return {
      joints: joints(left, right, shoulders, up), handholds: hands(left, right, v(1, 0, 0)), shorts: { hipFlexion: true },
      apparatus: {
        rods: [...seatParts.rods!, ...frame.rods!,
          rod("lat-handle", add(handle, v(-.56, 0, 0)), add(handle, v(.56, 0, 0)), .014),
          rod("thigh-pad-post", v(0, .025, .58), v(0, .645, .58), .018),
          rod("thigh-pad-arm", v(0, .645, .58), v(0, .645, .32), .016)],
        cables: [{ id: "lat-cable", a: pulley, b: handle }],
        pads: [...seatParts.pads!, { id: "thigh-pad", center: v(0, .685, .32), axis: v(0, 0, 1), length: .16, width: .48, thickness: .075 }],
      }, camera: { yaw: 43, pitch: 8, viewBox: "5 35 330 305" },
    };
  },
};

/** Forearm-driven straight-bar pressdown. Upper arms remain beside the ribs. */
export const tricepsPushdownStudy: MotionStudy = {
  id: "triceps-pushdown", label: "Cable Triceps Pushdown", chinese: "绳索三头下压",
  subtitle: "掌心朝下正握高位直杆，上臂贴侧固定，伸肘压至髋前", durationMs: 3300,
  keyframes: [{ phase: 0, label: "屈肘准备" }, { phase: .20, label: "伸肘下压" }, { phase: .40, label: "底端伸臂" }, { phase: .70, label: "屈肘回程" }],
  pose(phase) {
    const amount = cycle(phase, .40), up = unit(v(0, 1, .14));
    const hips = v(0, .92, -.015), shoulders = add(hips, mul(up, BODY.torso));
    const elbowX = .245, elbowForward = .025, elbowZ = shoulders.z + elbowForward, grip = .22;
    const drop = Math.sqrt(BODY.upperArm ** 2 - (elbowX - BODY.shoulderHalf) ** 2 - elbowForward ** 2);
    // The forearm starts close to horizontal (about 96° at the elbow), then
    // extends down. The fixed upper arm is almost vertical rather than held
    // forwards in a curl stance; the slight whole-torso lean does not pump.
    const forearm = Math.sqrt(BODY.forearm ** 2 - (grip - elbowX) ** 2), angle = 1.55 - 1.29 * amount;
    const handle = v(0, shoulders.y - drop - forearm * Math.cos(angle), elbowZ + forearm * Math.sin(angle));
    const side = (sign: -1 | 1): Limb => {
      const hip = add(hips, v(sign * BODY.hipHalf, 0, 0)), ankle = v(sign * .155, .07, 0);
      return { hip, ankle, shoulder: add(shoulders, v(sign * BODY.shoulderHalf, 0, 0)),
        elbow: v(sign * elbowX, shoulders.y - drop, elbowZ), wrist: add(handle, v(sign * grip, 0, 0)),
        knee: bendJoint(hip, ankle, BODY.thigh, BODY.shin, v(sign * .12, 0, 1)),
        toe: add(ankle, v(sign * .01, -.045, .17)) };
    };
    const left = side(-1), right = side(1), pulley = v(0, 2.06, .59), frame = tower(2.06, .93, pulley);
    const contact = (limb: Limb) => add(limb.wrist, mul(unit(sub(limb.wrist, limb.elbow)), .05));
    const leftGrip = contact(left), rightGrip = contact(right), shaft = blend(leftGrip, rightGrip, .5);
    return { joints: joints(left, right, shoulders, up),
      handholds: { left: { center: leftGrip, axis: v(1, 0, 0), grip: "pronated", palmNormal: unit(cross(v(1, 0, 0), sub(left.wrist, left.elbow))) }, right: { center: rightGrip, axis: v(1, 0, 0), grip: "pronated", palmNormal: unit(cross(v(1, 0, 0), sub(right.wrist, right.elbow))) } },
      occlusion: "surface",
      apparatus: { rods: [...frame.rods!, rod("pushdown-handle", add(shaft, v(-.32, 0, 0)), add(shaft, v(.32, 0, 0)), .013)],
        cables: [{ id: "pushdown-cable", a: pulley, b: shaft }] },
      camera: { yaw: 55, pitch: 8, viewBox: "5 20 335 325" },
    };
  },
};

/** Parallel-bar dip: fixed neutral grips, modest lean, bent suspended legs. */
export const dipStudy: MotionStudy = {
  id: "dip", label: "Parallel-bar Dip", chinese: "双杠臂屈伸",
  subtitle: "中立握双杠，屈臂下沉至上臂接近水平，再推起身体", durationMs: 3700,
  keyframes: [{ phase: 0, label: "直臂支撑" }, { phase: .29, label: "受控下沉" }, { phase: .58, label: "底端屈臂" }, { phase: .79, label: "推起身体" }],
  pose(phase) {
    const down = cycle(phase, .58), up = unit(v(0, 1, .15));
    const shoulders = v(0, 1.67 - .28 * down, .02 + .115 * down), hips = add(shoulders, mul(up, -BODY.torso));
    const side = (sign: -1 | 1): Limb => {
      const shoulder = add(shoulders, v(sign * BODY.shoulderHalf, 0, 0)), hip = add(hips, v(sign * BODY.hipHalf, 0, 0));
      const wrist = v(sign * .28, 1.10, 0);
      const knee = add(hip, mul(unit(v(0, -.94, -.34)), BODY.thigh));
      const ankle = add(knee, mul(unit(v(0, .12, -.99)), BODY.shin));
      return { shoulder, hip, wrist, knee, ankle,
        elbow: bendJoint(shoulder, wrist, BODY.upperArm, BODY.forearm, v(sign * .15, -.15, -1)),
        toe: add(ankle, v(0, -.045, .17)) };
    };
    const left = side(-1), right = side(1);
    return { joints: joints(left, right, shoulders, up), handholds: hands(left, right, v(0, 0, 1)), feet: "air",
      apparatus: { rods: ([-1, 1] as const).flatMap(sign => [
        rod(`dip-rail-${sign}`, v(sign * .28, 1.10, -.56), v(sign * .28, 1.10, .38), .018),
        rod(`dip-front-post-${sign}`, v(sign * .28, .025, .32), v(sign * .28, 1.10, .32), .021),
        rod(`dip-back-post-${sign}`, v(sign * .28, .025, -.50), v(sign * .28, 1.10, -.50), .021),
        rod(`dip-base-${sign}`, v(sign * .28, .025, -.62), v(sign * .28, .025, .44), .024),
      ]) }, camera: { yaw: 58, pitch: 9, viewBox: "0 35 360 310" },
    };
  },
};
