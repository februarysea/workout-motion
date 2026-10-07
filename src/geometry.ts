import type { MotionPart, Point } from "./types.js";

export const p = (x: number, y: number): Point => ({ x, y });
export const n = (value: number): string => Number(value.toFixed(3)).toString();
export const xy = (point: Point): string => `${n(point.x)} ${n(point.y)}`;
export const lerp = (a: number, b: number, amount: number): number => a + (b - a) * amount;
export const mix = (a: Point, b: Point, amount: number): Point => p(lerp(a.x, b.x, amount), lerp(a.y, b.y, amount));
export const cycle = (phase: number): number => (1 - Math.cos(phase * Math.PI * 2)) / 2;
export const line = (...points: Point[]): string => points.map((point, index) => `${index ? "L" : "M"}${xy(point)}`).join(" ");
export const polygon = (...points: Point[]): string => `${line(...points)} Z`;
export const circle = (center: Point, radius: number): string => `M${n(center.x - radius)} ${n(center.y)} a${radius} ${radius} 0 1 0 ${radius * 2} 0 a${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`;
export const ink = (id: string, d: string, extras: Partial<MotionPart> = {}): MotionPart => ({ id, d, fill: "none", ...extras });
export const solid = (id: string, d: string, extras: Partial<MotionPart> = {}): MotionPart => ({ id, d, fill: "var(--exercise-paper, #050505)", ...extras });

/** Two rigid limb segments meeting at a joint, with a selectable bend direction. */
export function joint(start: Point, end: Point, upper: number, lower: number, bend: 1 | -1): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return p(start.x + upper, start.y);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return p(start.x + dx * along / distance - bend * dy * height / distance, start.y + dy * along / distance + bend * dx * height / distance);
}

/** A tapered outline around a joint chain, with round ends. */
export function limb(points: Point[], radius = 7): string {
  const normals = points.slice(1).map((point, index) => {
    const a = points[index];
    const length = Math.hypot(point.x - a.x, point.y - a.y) || 1;
    return p(-(point.y - a.y) / length, (point.x - a.x) / length);
  });
  const edges = points.map((point, index) => {
    const before = normals[Math.max(0, index - 1)];
    const after = normals[Math.min(index, normals.length - 1)];
    const x = before.x + after.x;
    const y = before.y + after.y;
    const length = Math.hypot(x, y) || 1;
    const taper = radius * (1 - index / (points.length - 1) * 0.28);
    return { left: p(point.x + x / length * taper, point.y + y / length * taper), right: p(point.x - x / length * taper, point.y - y / length * taper) };
  });
  const end = points.at(-1)!;
  const start = points[0];
  const left = edges.map((edge) => edge.left);
  const right = edges.map((edge) => edge.right).reverse();
  return `${line(...left)} Q${xy(end)} ${xy(right[0])} ${right.slice(1).map((point) => `L${xy(point)}`).join(" ")} Q${xy(start)} ${xy(left[0])} Z`;
}

/** A barbell kept rigid while its centre and angle change. */
export function barbell(id: string, center: Point, halfWidth = 55, angle = 0, plateRadius = 20): MotionPart[] {
  const along = p(Math.cos(angle), Math.sin(angle));
  const normal = p(-along.y, along.x);
  const at = (x: number, y = 0) => p(center.x + along.x * x + normal.x * y, center.y + along.y * x + normal.y * y);
  return [
    ink(`${id}-shaft`, line(at(-halfWidth - 10), at(halfWidth + 10)), { strokeWidth: 3 }),
    ...([-1, 1] as const).map((side) => solid(`${id}-plate-${side}`, polygon(at(side * halfWidth - 4, -plateRadius), at(side * halfWidth + 4, -plateRadius), at(side * halfWidth + 4, plateRadius), at(side * halfWidth - 4, plateRadius)), { strokeWidth: 2.5 })),
  ];
}
