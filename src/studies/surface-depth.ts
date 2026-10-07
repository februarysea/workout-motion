import { blend, dot, length, sub, unit, v } from "./rig.js";
import type { StudyPose, Vec3 } from "./rig.js";
import type { StudyPath } from "./draw.js";
import { garmentGeometry, garmentRingPoints } from "./shorts.js";
import { clipLineOutside, flattenPath, pointInPolygon } from "./contours.js";

/** Opt-in visible-surface ordering for close hanging arms and low hand-held bars. */
export function refineSurfaceDepth(pose: StudyPose, original: StudyPath[]): StudyPath[] {
  const parts = original.map(part => ({ ...part })), byId = new Map(parts.map(part => [part.id, part]));
  const yaw = (pose.camera?.yaw ?? 42) * Math.PI / 180, pitch = (pose.camera?.pitch ?? 9) * Math.PI / 180;
  const view = v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const depth = (p: Vec3): number => dot(p, view);
  const j = pose.joints, garment = garmentGeometry(pose);
  const shift = (ids: string[], target: number, baseId: string): void => {
    const base = byId.get(baseId);
    if (!base) return;
    const delta = target - base.depth;
    for (const id of ids) { const part = byId.get(id); if (part) part.depth += delta; }
  };
  const surface = (a: Vec3, b: Vec3, radius: number): number =>
    depth(blend(a, b, .5)) + radius * Math.sqrt(Math.max(0, 1 - dot(unit(sub(b, a)), view) ** 2));
  const yokeDepth = Math.max(...garment.pelvis.flatMap(ring => garmentRingPoints(ring)).map(depth), (byId.get("torso")?.depth ?? -Infinity) + .030);
  shift(["shorts", "shorts-yoke-outline", "waistband"], yokeDepth + .001, "shorts");

  for (const side of ["left", "right"] as const) {
    const sleeve = garment.legs.find(leg => leg.name === side)!;
    const sleeveDepth = Math.max(...sleeve.rings.flatMap(ring => garmentRingPoints(ring)).map(depth));
    shift([`${side}-shorts-leg`, `${side}-shorts-outline`, `${side}-shorts-hem`], sleeveDepth, `${side}-shorts-leg`);
    const shoulder = j[`${side}Shoulder`], elbow = j[`${side}Elbow`], wrist = j[`${side}Wrist`];
    const upper = surface(shoulder, elbow, .079), forearm = surface(elbow, wrist, .055);
    shift([`${side}-upper-arm`, `${side}-upper-arm-outline`, `${side}-deltoid`, `${side}-biceps`, `${side}-triceps`], upper, `${side}-upper-arm`);
    shift([`${side}-forearm`, `${side}-forearm-outline`, `${side}-forearm-tendon`], forearm, `${side}-forearm`);
    shift([`${side}-elbow-fill`, `${side}-elbow-outline`, `${side}-elbow-crease`], depth(elbow) + .036, `${side}-elbow-fill`);
    // The long leg silhouette contains a knee closer than its thigh midpoint.
    // Its own cloth remains in front of the proximal leg. This also preserves
    // the conventional deadlift's genuinely hidden far forearm at the knee.
    const hip = j[`${side}Hip`], knee = j[`${side}Knee`], ankle = j[`${side}Ankle`];
    const legSurface = Math.max(surface(hip, knee, .098), depth(knee) + .061, surface(knee, ankle, .077));
    const legDepth = Math.min(legSurface, sleeveDepth - .006);
    shift([`${side}-leg`, `${side}-quadriceps`, `${side}-quadriceps-inner`, `${side}-calf`, `${side}-shin`], legDepth, `${side}-leg`);
    const shoe = byId.get(`${side}-shoe`);
    if (shoe) shift([`${side}-shoe`, `${side}-sole`, `${side}-laces`], Math.max(shoe.depth, legDepth + .004), `${side}-shoe`);
    const hand = byId.get(`${side}-hand`);
    if (hand) {
      const contact = pose.handholds?.[side]?.center ?? pose.handContacts?.[side]?.center ?? pose.grips?.[side] ?? wrist;
      // Join to the same wrist cylinder; never borrow the head or opposite arm.
      const handDepth = Math.max(depth(contact) + .045, forearm + .002);
      shift(parts.filter(part => part.id.startsWith(`${side}-`) && /-(?:hand|thumb|grip|finger-\d|wrist-crease)$/.test(part.id)).map(part => part.id), handDepth, `${side}-hand`);
    }
  }

  const polygons = new Map<string, ReturnType<typeof flattenPath>>();
  const polygonOf = (part: StudyPath): ReturnType<typeof flattenPath> => {
    let polygon = polygons.get(part.id);
    if (!polygon) { polygon = flattenPath(part.d); polygons.set(part.id, polygon); }
    return polygon;
  };
  const intersects = (line: StudyPath, mask: StudyPath): boolean => {
    const polygons = polygonOf(mask);
    for (const path of flattenPath(line.d)) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps, point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (polygons.some(polygon => pointInPolygon(point, polygon))) return true;
      }
    }
    return false;
  };
  // The torso is one long painted shape, so its lower end must stay under
  // its own waistband. Where a hanging forearm crosses that waistband in
  // front of the pelvis, resolve that local pair without raising the far knee.
  const hips = blend(j.leftHip, j.rightHip, .5);
  for (const side of ["left", "right"] as const) {
    const arm = byId.get(`${side}-forearm`), wrist = j[`${side}Wrist`];
    if (!arm || wrist.z <= hips.z + .04) continue;
    let target = arm.depth;
    for (const id of ["shorts", `${side}-shorts-leg`]) {
      const mask = byId.get(id);
      if (mask && intersects(arm, mask)) target = Math.max(target, mask.depth + .008);
    }
    shift([`${side}-forearm`, `${side}-forearm-outline`, `${side}-forearm-tendon`], target, `${side}-forearm`);
    const hand = byId.get(`${side}-hand`);
    if (hand) shift(parts.filter(part => part.id.startsWith(`${side}-`) && /-(?:hand|thumb|grip|finger-\d|wrist-crease)$/.test(part.id)).map(part => part.id), Math.max(hand.depth, target + .002), `${side}-hand`);
  }
  const aheadOfLegAt = (point: Vec3, side: "left" | "right"): boolean => {
    for (const [a, b] of [[j[`${side}Ankle`], j[`${side}Knee`]], [j[`${side}Knee`], j[`${side}Hip`]]] as const) {
      if (point.y < Math.min(a.y, b.y) - .12 || point.y > Math.max(a.y, b.y) + .12 || Math.abs(b.y - a.y) < 1e-6) continue;
      const t = Math.max(0, Math.min(1, (point.y - a.y) / (b.y - a.y)));
      if (point.z > blend(a, b, t).z + .012) return true;
    }
    return false;
  };
  const bar = pose.bar;
  if (bar?.support === "hands" && bar.kind !== "pull-up-bar") {
    const masks = parts.filter(part => /^(?:shorts|left-shorts-leg|right-shorts-leg|left-leg|right-leg)$/.test(part.id));
    const segments = [-bar.halfLength, -.65 * (bar.halfLength / .9), -.34, 0, .34, .65 * (bar.halfLength / .9), bar.halfLength];
    for (let i = 0; i < segments.length - 1; i++) {
      const part = byId.get(`bar-${i}`);
      if (!part) continue;
      part.depth = depth(v(bar.center.x + (segments[i] + segments[i + 1]) / 2, bar.center.y, bar.center.z));
      for (const mask of masks) {
        const side = mask.id.startsWith("left-") ? "left" : "right";
        if (aheadOfLegAt(bar.center, side) && intersects(part, mask)) part.depth = Math.max(part.depth, mask.depth + .006);
      }
    }
    for (const side of ["left", "right"] as const) {
      const hand = byId.get(`${side}-hand`), wrist = j[`${side}Wrist`];
      if (!hand) continue;
      let target = hand.depth;
      for (const mask of masks) if (aheadOfLegAt(wrist, side) && intersects(hand, mask)) target = Math.max(target, mask.depth + .012);
      shift(parts.filter(part => part.id.startsWith(`${side}-`) && /-(?:hand|thumb|grip|finger-\d|wrist-crease)$/.test(part.id)).map(part => part.id), target, `${side}-hand`);
    }
    // The palm wraps its own shaft. Stroke clipping keeps that local contact
    // intact even if a long shaft section crosses several clothing depths.
    const hands = [byId.get("left-hand"), byId.get("right-hand")].filter((part): part is StudyPath => !!part);
    for (let i = 0; i < segments.length - 1; i++) {
      const part = byId.get(`bar-${i}`);
      if (part) part.d = clipLineOutside(part.d, hands.flatMap(polygonOf));
    }
  }
  // Hand-held apparatus can use any world axis (e.g. vertical neutral row
  // grips). Find rods by geometric contact, never by an X-axis assumption or ID.
  const bodyMasks = parts.filter(part => /^(?:torso|shorts|left-shorts-leg|right-shorts-leg|left-leg|right-leg)$/.test(part.id));
  const shoulders = blend(j.leftShoulder, j.rightShoulder, .5);
  const aheadOfMask = (point: Vec3, mask: StudyPath): boolean => {
    if (mask.id !== "torso") return aheadOfLegAt(point, mask.id.startsWith("left-") ? "left" : "right");
    const t = (point.y - hips.y) / (shoulders.y - hips.y || 1);
    return t >= 0 && t <= 1.15 && point.z > blend(hips, shoulders, t).z + .085;
  };
  for (const rod of pose.apparatus?.rods ?? []) {
    const axis = unit(sub(rod.b, rod.a)), extent = length(sub(rod.b, rod.a));
    const holding = (["left", "right"] as const).filter(side => {
      const hold = pose.handholds?.[side];
      if (!hold || Math.abs(dot(unit(hold.axis), axis)) < .95) return false;
      const delta = sub(hold.center, rod.a), along = dot(delta, axis);
      return along >= -.005 && along <= extent + .005 && length(sub(delta, v(axis.x * along, axis.y * along, axis.z * along))) < .025;
    });
    if (!holding.length) continue;
    const hands = holding.map(side => byId.get(`${side}-hand`)).filter((part): part is StudyPath => !!part);
    for (let i = 0; i < 8; i++) {
      const part = byId.get(`apparatus-${rod.id}-${i}`);
      if (!part) continue;
      const center = blend(rod.a, rod.b, (i + .5) / 8);
      part.depth = depth(center) + (rod.radius ?? .012);
      for (const mask of bodyMasks) if (aheadOfMask(center, mask) && intersects(part, mask)) part.depth = Math.max(part.depth, mask.depth + .006);
      part.d = clipLineOutside(part.d, hands.flatMap(polygonOf));
    }
  }
  return parts;
}
