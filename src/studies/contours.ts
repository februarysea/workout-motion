export interface Point2 { x: number; y: number }

const mix = (a: Point2, b: Point2, t: number): Point2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const distance = (a: Point2, b: Point2): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Flatten the M/L/C/Q/Z paths emitted by our body-contour helpers. Each move
 * starts a separate polyline; only Z closes it. This is deliberately not a
 * general SVG parser (arcs, shorthand curves and transforms are not supported).
 */
export function flattenPath(d: string): Point2[][] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const paths: Point2[][] = [];
  let index = 0, command = "", cursor: Point2 = { x: 0, y: 0 }, origin = cursor;
  let path: Point2[] = [];
  const number = (): number => {
    const token = tokens[index++];
    const value = token === undefined ? NaN : Number(token);
    if (!Number.isFinite(value)) throw new SyntaxError("Incomplete or non-finite contour coordinates");
    return value;
  };
  const append = (point: Point2): void => { path.push(point); cursor = point; };
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    if (!/^[mMlLcCqQzZ]$/.test(command)) throw new SyntaxError(`Unsupported contour command: ${command || "(missing)"}`);
    const relative = command === command.toLowerCase();
    const kind = command.toUpperCase();
    if (kind === "Z") {
      if (path.length && distance(cursor, origin) > 1e-10) append({ ...origin });
      cursor = origin;
      command = "";
      continue;
    }
    const start = cursor;
    const point = (): Point2 => ({ x: number() + (relative ? start.x : 0), y: number() + (relative ? start.y : 0) });
    if (kind === "M") {
      cursor = point();
      origin = cursor;
      path = [cursor];
      paths.push(path);
      command = relative ? "l" : "L";
    } else if (kind === "L") {
      if (!path.length) { path = [start]; paths.push(path); }
      append(point());
    } else {
      if (!path.length) { path = [start]; paths.push(path); }
      const first = point(), second = point(), end = kind === "C" ? point() : second;
      // Sixteen subdivisions are sufficient for the small, smooth body paths;
      // clipping below independently samples long straight segments as well.
      for (let step = 1; step <= 16; step++) {
        const t = step / 16, u = 1 - t;
        append(kind === "C" ? {
          x: u ** 3 * start.x + 3 * u * u * t * first.x + 3 * u * t * t * second.x + t ** 3 * end.x,
          y: u ** 3 * start.y + 3 * u * u * t * first.y + 3 * u * t * t * second.y + t ** 3 * end.y,
        } : {
          x: u * u * start.x + 2 * u * t * first.x + t * t * end.x,
          y: u * u * start.y + 2 * u * t * first.y + t * t * end.y,
        });
      }
    }
  }
  return paths;
}

interface PolygonBounds {
  points: Point2[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function bounds(points: Point2[]): PolygonBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  return { points, minX, minY, maxX, maxY };
}

/** Filled simple polygon containment, including its boundary. */
export function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const epsilon = 1e-7;
  for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i++) {
    const a = polygon[previous], b = polygon[i];
    // Most edges are nowhere near this scanline. Avoid an allocation and a
    // square root per edge; a cross product is enough for boundary proximity.
    if (point.y < Math.min(a.y, b.y) - epsilon || point.y > Math.max(a.y, b.y) + epsilon || point.x > Math.max(a.x, b.x) + epsilon) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (point.x >= Math.min(a.x, b.x) - epsilon) {
      const lengthSquared = dx * dx + dy * dy;
      const area = (point.x - a.x) * dy - (point.y - a.y) * dx;
      const along = (point.x - a.x) * dx + (point.y - a.y) * dy;
      if (lengthSquared > 0 && along >= 0 && along <= lengthSquared && area * area < epsilon * epsilon * lengthSquared) return true;
    }
    if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + dx * (point.y - a.y) / dy) inside = !inside;
  }
  return inside;
}

/**
 * Keep only stroke portions outside a union of filled polygons. Half-pixel
 * sampling finds contour crossings, and bisection places the new ends without
 * screen-bound assumptions. Bounding boxes reject unrelated surfaces before
 * containment checks. Samples locate crossings but do not add redundant output
 * vertices: only original flattened vertices and clipping endpoints are emitted.
 */
export function clipLineOutside(d: string, occluders: Point2[][], keepInside = false): string {
  const polygons = occluders.filter(polygon => polygon.length >= 3).map(bounds);
  if (!polygons.length) return keepInside ? "M0,0" : d;
  const hidden = (point: Point2): boolean => {
    for (const polygon of polygons) {
      if (point.x >= polygon.minX && point.x <= polygon.maxX && point.y >= polygon.minY && point.y <= polygon.maxY && pointInPolygon(point, polygon.points)) return !keepInside;
    }
    return keepInside;
  };
  const number = (value: number): string => String(+value.toFixed(3));
  const xy = (point: Point2): string => `${number(point.x)},${number(point.y)}`;
  let result = "", clipped = false;
  for (const path of flattenPath(d)) {
    if (!path.length) continue;
    let previous = path[0], previousHidden = hidden(previous);
    if (!previousHidden) result += `M${xy(previous)}`;
    else clipped = true;
    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1], end = path[i];
      const minX = Math.min(start.x, end.x), minY = Math.min(start.y, end.y), maxX = Math.max(start.x, end.x), maxY = Math.max(start.y, end.y);
      // Entire line segments outside every occluder need no extra sampling.
      if (!keepInside && !polygons.some(polygon => maxX >= polygon.minX && minX <= polygon.maxX && maxY >= polygon.minY && minY <= polygon.maxY)) {
        result += `L${xy(end)}`;
        previous = end;
        previousHidden = false;
        continue;
      }
      const steps = Math.max(1, Math.min(4096, Math.ceil(distance(start, end) / .5)));
      for (let step = 1; step <= steps; step++) {
        const current = mix(start, end, step / steps), currentHidden = hidden(current);
        if (currentHidden) clipped = true;
        if (currentHidden !== previousHidden) {
          let before = previous, after = current;
          for (let iteration = 0; iteration < 12; iteration++) {
            const midpoint = mix(before, after, .5);
            if (hidden(midpoint) === previousHidden) before = midpoint;
            else after = midpoint;
          }
          const crossing = mix(before, after, .5);
          result += `${currentHidden ? "L" : "M"}${xy(crossing)}`;
        }
        if (!currentHidden && step === steps) result += `L${xy(current)}`;
        previous = current;
        previousHidden = currentHidden;
      }
    }
  }
  return clipped ? result || "M0,0" : d;
}

/** Keep a muscle detail within the surface that owns it. */
export function clipLineInside(d: string, boundary: Point2[][]): string {
  return clipLineOutside(d, boundary, true);
}
