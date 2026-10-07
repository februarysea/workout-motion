import { add, blend, BODY, mul, v } from "./rig.js";
import type { MotionStudy } from "./rig.js";

/**
 * Original H2 overhand bent-over row: a fixed hinge, soft knees, and a pull
 * toward the upper abdomen/lower ribs. Motion principles, not artwork, from
 * ACE: https://www.acefitness.org/resources/everyone/exercise-library/12/bent-over-row/
 * The 38% pull / 62% return has no authored holds or duplicated endpoint frames.
 */
export const bentOverRowStudy: MotionStudy = {
  id: "bent-over-row",
  label: "Bent-over Barbell Row",
  chinese: "俯身杠铃划船",
  subtitle: "正握、屈髋稳定，肘向后拉至上腹，再受控伸臂",
  durationMs: 3600,
  keyframes: [
    { phase: 0, label: "屈髋伸臂" },
    { phase: .19, label: "向后划船" },
    { phase: .38, label: "上腹收缩" },
    { phase: .69, label: "受控下放" },
  ],
  pose(phase) {
    const cycle = ((phase % 1) + 1) % 1;
    const travel = cycle <= .38 ? cycle / .38 : (1 - cycle) / .62;
    const amount = (1 - Math.cos(Math.PI * travel)) / 2;

    // Fixed lower-body geometry prevents the row becoming a repeated deadlift.
    const shinAngle = .064, thighAngle = -.50, lean = 1.15;
    const kneeCenter = v(0, .07 + BODY.shin * Math.cos(shinAngle), BODY.shin * Math.sin(shinAngle));
    const thighYZ = Math.sqrt(BODY.thigh ** 2 - .035 ** 2);
    const hipCenter = add(kneeCenter, v(0, thighYZ * Math.cos(thighAngle), thighYZ * Math.sin(thighAngle)));
    const up = v(0, Math.cos(lean), Math.sin(lean));
    const front = v(0, -Math.sin(lean), Math.cos(lean));
    const shoulderCenter = add(hipCenter, mul(up, BODY.torso));

    // Solve in a consistent Y/Z elbow plane. The positive 7 cm lateral offset
    // keeps each elbow outside the ribcage; the same branch bends backwards
    // throughout the rep, including its nearly extended beginning.
    const grip = .30, upperX = .070, lowerX = grip - BODY.shoulderHalf - upperX;
    const upperYZ = Math.sqrt(BODY.upperArm ** 2 - upperX ** 2);
    const lowerYZ = Math.sqrt(BODY.forearm ** 2 - lowerX ** 2);
    const hang = add(shoulderCenter, v(0, -(upperYZ + lowerYZ - .003), 0));
    // The shaft approaches the torso surface from in front. It never crosses
    // the centreline or relies on painter order to conceal a penetrating bar.
    const pulled = add(add(hipCenter, mul(up, .30)), mul(front, .137));
    const barCenter = blend(hang, pulled, amount);
    const side = (sign: -1 | 1) => {
      const shoulder = add(shoulderCenter, v(sign * BODY.shoulderHalf, 0, 0));
      const wrist = add(barCenter, v(sign * grip, 0, 0));
      const dy = wrist.y - shoulder.y, dz = wrist.z - shoulder.z;
      const reach = Math.hypot(dy, dz);
      const along = (upperYZ ** 2 - lowerYZ ** 2 + reach ** 2) / (2 * reach);
      const bend = Math.sqrt(Math.max(0, upperYZ ** 2 - along ** 2));
      const elbow = v(sign * (BODY.shoulderHalf + upperX),
        shoulder.y + (dy * along - dz * bend) / reach,
        shoulder.z + (dz * along + dy * bend) / reach);
      return {
        shoulder, elbow, wrist,
        hip: add(hipCenter, v(sign * BODY.hipHalf, 0, 0)),
        knee: add(kneeCenter, v(sign * .135, 0, 0)),
        ankle: v(sign * .135, .07, 0),
        toe: v(sign * .155, .025, .18),
      };
    };
    const left = side(-1), right = side(1);
    return {
      joints: {
        head: add(shoulderCenter, mul(up, .235)),
        neck: add(shoulderCenter, mul(up, .115)),
        leftShoulder: left.shoulder, rightShoulder: right.shoulder,
        leftElbow: left.elbow, rightElbow: right.elbow,
        leftWrist: left.wrist, rightWrist: right.wrist,
        leftHip: left.hip, rightHip: right.hip,
        leftKnee: left.knee, rightKnee: right.knee,
        leftAnkle: left.ankle, rightAnkle: right.ankle,
        leftToe: left.toe, rightToe: right.toe,
      },
      bar: { center: barCenter, halfLength: .90, plateRadius: .16, support: "hands", grip: "pronated" },
      camera: { yaw: 62, pitch: 9, viewBox: "15 90 330 255" },
    };
  },
};
