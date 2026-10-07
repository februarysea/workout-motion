import { cross, dot, length, mul, sub, unit, v } from "./rig.js";
import type { StudyPose } from "./rig.js";

/** A pronated bar grip: mirrored thumbs point inwards; the palm faces away
 * from the head in the bench pose. Unlike v02, this is not one global cuff
 * pasted onto both wrists. Wrist positions are the rig's bar-contact anchors. */
export function gripFrame(pose: StudyPose, name: "left" | "right") {
  const wrist=pose.joints[`${name}Wrist`], elbow=pose.joints[`${name}Elbow`];
  const reach=unit(sub(wrist,elbow));
  const hold=pose.handholds?.[name];
  if(hold) {
    const along=unit(hold.axis);
    let radial=sub(sub(wrist,hold.center),mul(along,dot(sub(wrist,hold.center),along)));
    if(length(radial)<.01) radial=sub(mul(reach,-1),mul(along,dot(mul(reach,-1),along)));
    if(length(radial)<.01) {
      const fallback=Math.abs(along.x)<.8?v(name==="left"?-1:1,0,0):v(0,0,1);
      radial=sub(fallback,mul(along,dot(fallback,along)));
    }
    const palm=hold.palmNormal
      ?unit(sub(hold.palmNormal,mul(along,dot(hold.palmNormal,along))))
      :unit(radial);
    const across=unit(cross(along,palm));
    const thumb=hold.grip==="pronated"?mul(along,name==="left"?1:-1):along;
    return {center:hold.center,reach,along,across,palm,thumb};
  }
  const onLandmine=pose.landmine?.hand===name;
  if (onLandmine) {
    const center=pose.grips?.[name]??wrist;
    // A neutral side grip: thumb runs along the shaft, palm sits beside it.
    // The fixed radial wrist offset prevents a frame flip during lockout.
    const along=unit(sub(pose.landmine!.tip,pose.landmine!.pivot));
    const contactToWrist=sub(wrist,center);
    const palm=unit(sub(contactToWrist,mul(along,dot(contactToWrist,along))));
    const across=unit(cross(along,palm));
    return {center,reach,along,across,palm,thumb:along};
  }
  const across=v(1,0,0);
  const along=unit(v(0,reach.y,reach.z));
  const palm=mul(unit(cross(across,along)),pose.bar?.grip==="supinated"?-1:1);
  return {center:pose.grips?.[name]??wrist,reach,along,across,palm,thumb:v(name==="left"?1:-1,0,0)};
}
