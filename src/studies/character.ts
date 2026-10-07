import { add, bendJoint, BODY, mul, unit, v } from "./rig.js";
import type { StudyPose } from "./rig.js";

/** The same body as the motion studies, relaxed for silhouette review. */
export function characterPose(): StudyPose {
  const at = (sign: -1 | 1) => {
    const shoulder=v(sign*BODY.shoulderHalf,1.42,0), hip=v(sign*BODY.hipHalf,.93,0);
    const elbow=add(shoulder,mul(unit(v(sign*.27,-.96,.07)),BODY.upperArm));
    const wrist=add(elbow,mul(unit(v(sign*.17,-.985,.025)),BODY.forearm));
    const ankle=v(sign*.15,.07,0), toe=v(sign*.18,.025,.18);
    const knee=bendJoint(hip,ankle,BODY.thigh,BODY.shin,v(sign*.15,0,1));
    return {shoulder,hip,elbow,wrist,knee,ankle,toe};
  };
  const left=at(-1), right=at(1);
  return {joints:{
    head:v(0,1.655,0),neck:v(0,1.535,0),
    leftShoulder:left.shoulder,rightShoulder:right.shoulder,
    leftElbow:left.elbow,rightElbow:right.elbow,leftWrist:left.wrist,rightWrist:right.wrist,
    leftHip:left.hip,rightHip:right.hip,leftKnee:left.knee,rightKnee:right.knee,
    leftAnkle:left.ankle,rightAnkle:right.ankle,leftToe:left.toe,rightToe:right.toe,
  },bar:{center:v(0,0,0),halfLength:.9,plateRadius:.18,support:"hands"}};
}
