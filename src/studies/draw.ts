import { add, blend, cross, dot, mul, sub, unit, v } from "./rig.js";
import type { StudyPose, Vec3 } from "./rig.js";
import { characterPose } from "./character.js";
import { gripFrame } from "./grip.js";
import { torsoLandmarks } from "./anatomy.js";
import { garmentGeometry, garmentRingPoint, garmentRingPoints } from "./shorts.js";
import { clipLineInside, clipLineOutside, flattenPath } from "./contours.js";
import { shoeGeometry } from "./feet.js";
import { refineSurfaceDepth } from "./surface-depth.js";

type P = { x: number; y: number };
export interface StudyPath { id: string; d: string; fill: string; stroke: string; width: number; depth: number }
function makeRenderer(angle: number, tiltAngle = 9) {
const RAD = Math.PI / 180;
const yaw = angle * RAD, tilt = tiltAngle * RAD;
const right = v(Math.cos(yaw), 0, -Math.sin(yaw));
const up = v(-Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), -Math.cos(yaw) * Math.sin(tilt));
const view = v(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
const SCALE = 132;
const PAPER = "var(--figure-paper,#151718)", INK = "var(--figure-ink,#e5e4e2)";
const DETAIL = "var(--figure-detail,#cecdca)", MUTED = "var(--figure-muted,#969b9e)";
// Surface polygons only hide the far contours. They have exactly the canvas
// colour; the H2 character is drawn entirely by the surrounding strokes.
const SKIN = PAPER;
const project = (p: Vec3): P => ({ x: 180 + dot(p, right) * SCALE, y: 315 - dot(p, up) * SCALE });
const depth = (p: Vec3) => dot(p, view);
const n = (value: number) => +value.toFixed(2);
const xy = (p: P) => `${n(p.x)},${n(p.y)}`;
const midpoint = (a: Vec3, b: Vec3) => blend(a, b, .5);

/** Closed Catmull–Rom contour with conservative tangents at flexed joints. */
function contour(points: P[], tension = .75): string {
  let d = `M${xy(points[0])}`;
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length], b = points[i];
    const c = points[(i + 1) % points.length], e = points[(i + 2) % points.length];
    d += `C${xy({x:b.x+(c.x-a.x)*tension/6,y:b.y+(c.y-a.y)*tension/6})} ${xy({x:c.x-(e.x-b.x)*tension/6,y:c.y-(e.y-b.y)*tension/6})} ${xy(c)}`;
  }
  return d + "Z";
}
function line(points: Vec3[]): string { return points.map((p, i) => `${i ? "L" : "M"}${xy(project(p))}`).join(""); }
function polygon(points: Vec3[]): string { return line(points) + "Z"; }
function silhouette(points: Vec3[], tension = .18): string {
  const sorted=points.map(project).sort((a,b)=>a.x-b.x||a.y-b.y);
  const turn=(a:P,b:P,c:P)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=(p:P[])=>{const edge:P[]=[];for(const point of p){while(edge.length>1&&turn(edge[edge.length-2],edge[edge.length-1],point)<=0)edge.pop();edge.push(point);}return edge;};
  const lower=half(sorted),upper=half([...sorted].reverse());
  return contour([...lower.slice(0,-1),...upper.slice(0,-1)],tension);
}
function smoothLine(points: Vec3[]): string {
  const p=points.map(project);
  let d=`M${xy(p[0])}`;
  for(let i=0;i<p.length-1;i++) {
    const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],e=p[Math.min(p.length-1,i+2)];
    d+=`C${xy({x:b.x+(c.x-a.x)/6,y:b.y+(c.y-a.y)/6})} ${xy({x:c.x-(e.x-b.x)/6,y:c.y-(e.y-b.y)/6})} ${xy(c)}`;
  }
  return d;
}

function muscleLine(start: Vec3, end: Vec3, stops: number[], offsets: number[], surface = false): string {
  const a=project(start),b=project(end),dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.hypot(dx,dy)||1;
  const projection=surface?Math.min(1,len/(Math.hypot(end.x-start.x,end.y-start.y,end.z-start.z)*SCALE||1)):1;
  const points=stops.map((t,i)=>({x:a.x+dx*t-dy/len*offsets[i]*SCALE*projection,y:a.y+dy*t+dx/len*offsets[i]*SCALE*projection}));
  let d=`M${xy(points[0])}`;
  for(let i=0;i<points.length-1;i++) {
    const before=points[Math.max(0,i-1)],here=points[i],next=points[i+1],after=points[Math.min(points.length-1,i+2)];
    d+=`C${xy({x:here.x+(next.x-before.x)/6,y:here.y+(next.y-before.y)/6})} ${xy({x:next.x-(after.x-here.x)/6,y:next.y-(after.y-here.y)/6})} ${xy(next)}`;
  }
  return d;
}

/** Project the silhouette of an elliptical cross-section along a body axis. */
function sectionSupport(side: Vec3, front: Vec3, rx: number, rz: number, normal: P): P {
  const sx = dot(side, right) * SCALE, sy = -dot(side, up) * SCALE;
  const fx = dot(front, right) * SCALE, fy = -dot(front, up) * SCALE;
  const a = (sx * normal.x + sy * normal.y) * rx;
  const b = (fx * normal.x + fy * normal.y) * rz;
  const h = Math.hypot(a, b) || 1;
  return { x: (sx * rx * a + fx * rz * b) / h, y: (sy * rx * a + fy * rz * b) / h };
}
function volume(rings: { center: Vec3; rx: number; rz: number }[], side: Vec3, front: Vec3): string {
  const a = project(rings[0].center), b = project(rings[rings.length - 1].center);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const normal = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const left: P[] = [], rightEdge: P[] = [];
  for (const ring of rings) {
    const center = project(ring.center), offset = sectionSupport(side, front, ring.rx, ring.rz, normal);
    left.push({x:center.x+offset.x,y:center.y+offset.y});
    rightEdge.push({x:center.x-offset.x,y:center.y-offset.y});
  }
  return contour([...left, ...rightEdge.reverse()]);
}

function limb(a: Vec3, joint: Vec3, end: Vec3, radii: number[]): string {
  const incoming=blend(a,joint,.85), outgoing=blend(joint,end,.18);
  const rounded=(t:number)=>add(add(mul(incoming,(1-t)**2),mul(joint,2*(1-t)*t)),mul(outgoing,t*t));
  const positions = [a,blend(a,joint,.22),blend(a,joint,.58),rounded(.15),rounded(.5),
    rounded(.85),blend(joint,end,.4),blend(joint,end,.76),end];
  const points = positions.map(project);
  const left: P[] = [], rightEdge: P[] = [];
  for (let i=0;i<points.length;i++) {
    const before = points[Math.max(0,i-1)], after = points[Math.min(points.length-1,i+1)];
    const len = Math.hypot(after.x-before.x,after.y-before.y)||1;
    const normal = {x:-(after.y-before.y)/len,y:(after.x-before.x)/len};
    const r = radii[i]*SCALE;
    left.push({x:points[i].x+normal.x*r,y:points[i].y+normal.y*r});
    rightEdge.push({x:points[i].x-normal.x*r,y:points[i].y-normal.y*r});
  }
  return contour([...left, ...rightEdge.reverse()], .88);
}

/** Separate straight arm sections stay well behaved when one bone faces the camera. */
function armSection(a: Vec3, b: Vec3, stops: number[], radii: number[]): { fill: string; outline: string } {
  const start=project(a), end=project(b), dx=end.x-start.x, dy=end.y-start.y;
  const len=Math.hypot(dx,dy)||1, normal={x:-dy/len,y:dx/len};
  const edges=[1,-1].map(sign=>stops.map((t,i)=>({
    x:start.x+dx*t+normal.x*radii[i]*SCALE*sign,
    y:start.y+dy*t+normal.y*radii[i]*SCALE*sign,
  })));
  const curve=(points:P[])=>{
    let d=`M${xy(points[0])}`;
    for(let i=0;i<points.length-1;i++) {
      const before=points[Math.max(0,i-1)], here=points[i], next=points[i+1], after=points[Math.min(points.length-1,i+2)];
      d+=`C${xy({x:here.x+(next.x-before.x)/8,y:here.y+(next.y-before.y)/8})} ${xy({x:next.x-(after.x-here.x)/8,y:next.y-(after.y-here.y)/8})} ${xy(next)}`;
    }
    return d;
  };
  const left=curve(edges[0]), rightEdge=curve(edges[1].reverse());
  // Cap fills close the silhouette; the outline stays open at shoulder/elbow/wrist.
  return {fill:left+rightEdge.replace(/^M/,"L")+"Z",outline:left+rightEdge};
}

function disk(center: Vec3, radius: number): string {
  const points = Array.from({length:32},(_,i) => project(add(center,v(0,Math.cos(i*Math.PI/16)*radius,Math.sin(i*Math.PI/16)*radius))));
  return contour(points,1);
}

return function draw(pose: StudyPose, equipment = true): StudyPath[] {
  let parts: StudyPath[] = [];
  const push = (id: string, d: string, z: number, fill = PAPER, stroke = INK, width = 1.55) => {
    parts.push({id,d,fill,stroke,width,depth:z});
  };
  const j = pose.joints;
  const hips = midpoint(j.leftHip,j.rightHip), shoulders = midpoint(j.leftShoulder,j.rightShoulder);
  const axis = unit(sub(shoulders,hips)), side = unit(sub(j.rightShoulder,j.leftShoulder));
  const front = unit(cross(side,axis));
  const torsoDepth = depth(blend(hips,shoulders,.55));
  const ring=(t:number,rx:number,rz:number) => ({center:blend(hips,shoulders,t),rx,rz});
  const torsoShape=volume([ring(.02,.152,.086),ring(.16,.146,.092),ring(.34,.140,.096),ring(.54,.170,.117),ring(.78,.215,.125),ring(.96,.215,.100),ring(1.04,.142,.077),ring(1.14,.057,.052)],side,front);
  const torsoPolygon=flattenPath(torsoShape);
  // A torso-aligned deltoid has a continuous projection, even as a raised upper
  // arm passes vertical. Its visible boundary is the union of chest + arm +
  // shoulder, not a screen-space cap whose chosen side can suddenly flip.
  const shoulderJoints=(["left","right"] as const).map(name=>{
    const center=project(add(j[`${name}Shoulder`],mul(axis,-.012)));
    const axes:[[Vec3,number],[Vec3,number],[Vec3,number]]=[[side,.078],[axis,.055],[front,.065]];
    const basis=axes.map(([direction,radius])=>({x:dot(direction,right)*radius*SCALE,y:-dot(direction,up)*radius*SCALE}));
    const xx=basis.reduce((sum,p)=>sum+p.x*p.x,0),xyCov=basis.reduce((sum,p)=>sum+p.x*p.y,0),yy=basis.reduce((sum,p)=>sum+p.y*p.y,0);
    const polygon=Array.from({length:32},(_,i)=>{
      const x=Math.cos(i*Math.PI/16),y=Math.sin(i*Math.PI/16);
      const radius=Math.sqrt(xx*x*x+2*xyCov*x*y+yy*y*y);
      return {x:center.x+(xx*x+xyCov*y)/radius,y:center.y+(xyCov*x+yy*y)/radius};
    });
    return {name,polygon,d:contour(polygon,1)};
  });

  // Quiet floor reference and grounded contact shadows.
  push("floor",line([v(-.65,0,.15),v(.65,0,.15)]),-10,"none",MUTED,.6);
  pose.groundContacts?.forEach((contact, index) => {
    push(`support-floor-${index}`,line([add(contact,v(-.16,0,0)),add(contact,v(.16,0,0))]),-10,"none",MUTED,.6);
  });
  // New apparatus is opt-in; accepted barbell/bench artwork retains its paths.
  if(equipment) {
    const ring=(center:Vec3,axis:Vec3,radius:number)=>{
      const tangent=unit(cross(axis,Math.abs(axis.y)<.9?v(0,1,0):v(1,0,0)));
      const radial=unit(cross(axis,tangent));
      return Array.from({length:24},(_,i)=>add(center,add(mul(tangent,Math.cos(i*Math.PI/12)*radius),mul(radial,Math.sin(i*Math.PI/12)*radius))));
    };
    const rod=(id:string,a:Vec3,b:Vec3,width:number,stroke=DETAIL)=>{
      for(let i=0;i<8;i++) {
        const start=blend(a,b,i/8),end=blend(a,b,(i+1)/8);
        push(`${id}-${i}`,line([start,end]),depth(midpoint(start,end)),"none",stroke,width);
      }
    };
    for(const bar of pose.apparatus?.rods??[]) rod(`apparatus-${bar.id}`,bar.a,bar.b,Math.min(3.2,(bar.radius??.012)*2*SCALE),MUTED);
    for(const cable of pose.apparatus?.cables??[]) rod(`cable-${cable.id}`,cable.a,cable.b,1.1,MUTED);
    for(const pad of pose.apparatus?.pads??[]) {
      const along=unit(pad.axis),across=v(1,0,0);
      let normal=unit(cross(along,across));
      if(normal.y<0)normal=mul(normal,-1);
      const corner=(x:number,z:number,lower=false)=>add(add(add(pad.center,mul(across,x*pad.width/2)),mul(along,z*pad.length/2)),mul(normal,lower?-pad.thickness:0));
      const top=[corner(-1,-1),corner(1,-1),corner(1,1),corner(-1,1)],bottom=[corner(-1,-1,true),corner(1,-1,true),corner(1,1,true),corner(-1,1,true)];
      for(let i=0;i<4;i++) {
        const points=[top[i],top[(i+1)%4],bottom[(i+1)%4],bottom[i]];
        push(`pad-${pad.id}-side-${i}`,polygon(points),points.reduce((sum,p)=>sum+depth(p),0)/4,PAPER,MUTED,1.1);
      }
      push(`pad-${pad.id}-top`,polygon(top),depth(pad.center)-.008,PAPER,DETAIL,1.4);
    }
    for(const dumbbell of pose.dumbbells??[]) {
      const axis=unit(dumbbell.axis);
      rod(`dumbbell-${dumbbell.id}-shaft`,add(dumbbell.center,mul(axis,-dumbbell.halfLength)),add(dumbbell.center,mul(axis,dumbbell.halfLength)),2.6,INK);
      for(const sign of [-1,1]) {
        const center=add(dumbbell.center,mul(axis,sign*dumbbell.halfLength));
        const a=add(center,mul(axis,-.018)),b=add(center,mul(axis,.018));
        const near=depth(a)>depth(b)?a:b;
        push(`dumbbell-${dumbbell.id}-${sign}-edge`,silhouette([...ring(a,axis,dumbbell.plateRadius),...ring(b,axis,dumbbell.plateRadius)],.4),depth(near)-.001,PAPER,DETAIL,1.2);
        push(`dumbbell-${dumbbell.id}-${sign}-face`,contour(ring(near,axis,dumbbell.plateRadius).map(project),.9),depth(near),PAPER,INK,1.45);
        push(`dumbbell-${dumbbell.id}-${sign}-hub`,contour(ring(near,axis,.016).map(project),.9),depth(near)+.001,PAPER,MUTED,.8);
      }
    }
  }
  if(equipment) for(const box of pose.boxes??[]) {
    const {center,width,height,depth:extent}=box;
    const corner=(x:number,y:number,z:number)=>add(center,v(x*width/2,y*height,z*extent/2));
    const sx=view.x>=0?1:-1,sz=view.z>=0?1:-1;
    const faces=[
      {id:"top",points:[corner(-1,1,-1),corner(1,1,-1),corner(1,1,1),corner(-1,1,1)]},
      {id:"side",points:[corner(sx,0,-1),corner(sx,0,1),corner(sx,1,1),corner(sx,1,-1)]},
      {id:"front",points:[corner(-1,0,sz),corner(1,0,sz),corner(1,1,sz),corner(-1,1,sz)]},
    ];
    const above=[j.leftAnkle,j.rightAnkle].filter(p=>p.y>=center.y+height+.065&&Math.abs(p.x-center.x)<width/2+.02&&Math.abs(p.z-center.z)<extent/2+.02);
    const physical=faces.map(face=>face.points.reduce((sum,p)=>sum+depth(p),0)/4);
    // A top face cannot hide a shoe resting above it merely because the shoe
    // is on the far half of the box. Keep the supported silhouette in front.
    const shift=above.length===2?Math.min(0,...above.map(p=>depth(p)-.18-Math.max(...physical))):0;
    faces.forEach((face,index)=>push(`box-${box.id}-${face.id}`,polygon(face.points),physical[index]+shift,PAPER,index===0?INK:DETAIL,index===0?1.55:1.2));
  }
  if (pose.bench) {
    const b = pose.bench;
    const corners = (height: number) => [v(-b.halfWidth,height,b.start),v(b.halfWidth,height,b.start),v(b.halfWidth,height,b.end),v(-b.halfWidth,height,b.end)];
    const top = corners(b.height), bottom = corners(b.height-.065);
    for (const [index,z] of [b.start+.14,b.end-.12].entries()) {
      const center = v(0,b.height-.1,z);
      push(`bench-leg-${index}`,line([center,v(0,.05,z)]),-5,"none",MUTED,5);
      push(`bench-foot-${index}`,line([v(-.24,.035,z),v(.24,.035,z)]),-5,"none",MUTED,3);
    }
    for(let i=0;i<4;i++) {
      const next=(i+1)%4;
      push(`bench-side-${i}`,polygon([top[i],top[next],bottom[next],bottom[i]]),-3+(i*.001),PAPER,MUTED,1.1);
    }
    push("bench-pad",polygon(top),-2.5,PAPER,DETAIL,1.4);
    push("bench-pad-seam",line([v(-b.halfWidth+.025,b.height+.002,b.start+.045),v(b.halfWidth-.025,b.height+.002,b.start+.045)]),-2.4,"none",MUTED,.8);
  }

  // Shared body master: both views use the same muscle widths and joint lengths.
  for (const [name, sign] of [["left",-1],["right",1]] as const) {
    const hip=j[`${name}Hip`], knee=j[`${name}Knee`], ankle=j[`${name}Ankle`];
    const shoulder=j[`${name}Shoulder`], elbow=j[`${name}Elbow`], wrist=j[`${name}Wrist`];
    const legZ=depth(blend(hip,knee,.55));
    const edge=INK;
    push(`${name}-leg`,limb(hip,knee,ankle,[.09,.098,.088,.061,.052,.056,.077,.049,.029]),legZ,SKIN,edge);
    push(`${name}-quadriceps`,muscleLine(hip,knee,[.31,.48,.68,.84,.91],[sign*.018,sign*.033,sign*.038,sign*.020,0]),legZ+.001,"none",DETAIL,1.08);
    push(`${name}-quadriceps-inner`,muscleLine(hip,knee,[.36,.60,.82,.92,.94],[-sign*.012,-sign*.030,-sign*.034,-sign*.017,-sign*.003]),legZ+.0012,"none",DETAIL,1.03);
    push(`${name}-calf`,muscleLine(knee,ankle,[.13,.32,.49,.74,.88],[-sign*.01,-sign*.035,-sign*.031,-sign*.012,0]),legZ+.002,"none",DETAIL,1.03);
    push(`${name}-shin`,muscleLine(knee,ankle,[.18,.42,.68,.84],[sign*.024,sign*.031,sign*.017,sign*.008]),legZ+.0022,"none",DETAIL,.96);
    const { point:fp, across:footSide, footLength, points:shoe }=shoeGeometry(pose,name);
    // One uninterrupted shoe envelope. The near sole is a single line, so no
    // hidden far sole can cross the upper in the front / side character views.
    const soleSide=dot(footSide,view)>=0?1:-1;
    push(`${name}-shoe`,silhouette(shoe,.42),depth(ankle)+.025,PAPER,edge,1.4);
    push(`${name}-sole`,smoothLine([fp(-.058,soleSide*.042,.031),fp(.07,soleSide*.052,.031),fp(footLength+.018,soleSide*.041,.030)]),depth(ankle)+.03,"none",DETAIL,.95);
    push(`${name}-laces`,line([fp(.046,-.028,.093),fp(.046,.028,.093)]),depth(ankle)+.031,"none",DETAIL,.8);

    const upperDepth=depth(midpoint(shoulder,elbow));
    const upperZ=upperDepth;
    const forearmDepth=depth(midpoint(elbow,wrist));
    // Free forearms use their visible cylindrical surface, just as the jump
    // cuffs below use a fabric surface; the far arm retains its physical depth.
    const forearmFacing=dot(unit(sub(wrist,elbow)),view);
    const forearmZ=forearmDepth+(pose.boxes?.length ? .055*Math.sqrt(Math.max(0,1-forearmFacing**2)) : 0);
    const upperArm=armSection(shoulder,elbow,[0,.22,.58,.9,1],[.071,.079,.065,.043,.036]);
    const forearm=armSection(elbow,wrist,[0,.12,.4,.76,1],[.036,.045,.055,.036,.025]);
    push(`${name}-upper-arm`,upperArm.fill,upperZ,SKIN,"none");
    const joint=shoulderJoints.find(joint=>joint.name===name)!;
    push(`${name}-upper-arm-outline`,clipLineOutside(upperArm.outline,[joint.polygon]),upperZ+.0002,"none",edge);
    push(`${name}-shoulder-fill`,joint.d,depth(shoulder)-.0001,SKIN,"none");
    push(`${name}-shoulder-contour`,clipLineOutside(joint.d,[...torsoPolygon,...flattenPath(upperArm.fill)]),depth(shoulder)+.0003,"none",INK,1.55);
    push(`${name}-forearm`,forearm.fill,forearmZ,SKIN,"none");
    push(`${name}-forearm-outline`,forearm.outline,forearmZ+.0002,"none",edge);
    push(`${name}-deltoid`,muscleLine(shoulder,elbow,[.035,.14,.29,.40,.45],[-sign*.055,-sign*.050,-sign*.026,sign*.004,sign*.019],pose.anatomy?.surfaceArms),upperZ+.0004,"none",DETAIL,1.13);
    push(`${name}-biceps`,muscleLine(shoulder,elbow,[.32,.47,.69,.83,.90],[sign*.023,sign*.033,sign*.035,sign*.013,-sign*.007],pose.anatomy?.surfaceArms),upperZ+.0005,"none",DETAIL,1.05);
    push(`${name}-triceps`,muscleLine(shoulder,elbow,[.40,.59,.79,.89],[-sign*.025,-sign*.035,-sign*.017,-sign*.005],pose.anatomy?.surfaceArms),upperZ+.0006,"none",DETAIL,.98);
    push(`${name}-forearm-tendon`,muscleLine(elbow,wrist,[.18,.37,.63,.87],[-sign*.018,-sign*.032,-sign*.018,0],pose.anatomy?.surfaceArms),forearmZ+.0004,"none",DETAIL,1.02);
    const ep=project(elbow), wp=project(wrist), sp=project(shoulder), radius=.036*SCALE;
    const elbowZ=depth(elbow)+.0005;
    push(`${name}-elbow-fill`,`M${n(ep.x-radius)},${n(ep.y)}a${n(radius)},${n(radius)} 0 1 0 ${n(radius*2)},0a${n(radius)},${n(radius)} 0 1 0 ${n(-radius*2)},0Z`,elbowZ,SKIN,"none");
    const ux=ep.x-sp.x, uy=ep.y-sp.y, fx=wp.x-ep.x, fy=wp.y-ep.y;
    const ul=Math.hypot(ux,uy)||1, fl=Math.hypot(fx,fy)||1, turn=ux*fy-uy*fx;
    const outside=turn>=0?-1:1;
    const arcStart={x:ep.x-uy/ul*radius*outside,y:ep.y+ux/ul*radius*outside};
    const arcEnd={x:ep.x-fy/fl*radius*outside,y:ep.y+fx/fl*radius*outside};
    push(`${name}-elbow-outline`,`M${xy(arcStart)}A${n(radius)},${n(radius)} 0 0 ${turn>=0?1:0} ${xy(arcEnd)}`,elbowZ+.0002,"none",edge);
    // A short inner elbow crease, never a hinge dot.
    const tangent={x:wp.x-sp.x,y:wp.y-sp.y}, tl=Math.hypot(tangent.x,tangent.y)||1;
    const crease=`M${n(ep.x-tangent.y/tl*2.2)},${n(ep.y+tangent.x/tl*2.2)}q${n(tangent.x/tl*3)},${n(tangent.y/tl*3)} ${n(tangent.x/tl*5)},${n(tangent.y/tl*5)}`;
    push(`${name}-elbow-crease`,crease,elbowZ+.0004,"none",DETAIL,.95);
  }

  const garment=garmentGeometry(pose);
  const yoke=silhouette(garment.pelvis.flatMap(ring=>garmentRingPoints(ring)),.35);
  const sleeves=garment.legs.map(leg=>({leg,d:silhouette(leg.rings.flatMap(ring=>garmentRingPoints(ring)),.3)}));
  const garmentFront=Math.max(torsoDepth+.025,...garment.pelvis.flatMap(ring=>garmentRingPoints(ring)).map(depth));
  // Sleeve cross-sections follow each femur; hide all joining seams inside the
  // pelvis yoke rather than drawing one rigid, torso-aligned shorts silhouette.
  const yokePolygon=flattenPath(yoke);
  for(const {leg,d} of sleeves){
    const sleeveDepth=garmentFront+depth(leg.hem.center)-depth(hips);
    // Jump arms sweep beside the cuffs. Reusing the pelvis's foremost depth
    // and adding the thigh offset counts the near-side displacement twice,
    // so an inflated cuff layer can erase a physically nearer forearm.
    // Use the authored sleeve envelope for these free-arm poses instead.
    const z=pose.boxes?.length
      ? Math.max(...leg.rings.flatMap(ring=>garmentRingPoints(ring)).map(depth))
      : sleeveDepth+(Math.min(garmentFront+.005,sleeveDepth)-sleeveDepth)*garment.hingeBlend;
    push(`${leg.name}-shorts-leg`,d,z,PAPER,"none");
    const hem=leg.hem;
    const hemCenter=project(hem.center);
    const opening=garmentRingPoints(hem).map(project).map(p=>({x:hemCenter.x+(p.x-hemCenter.x)*1.025,y:hemCenter.y+(p.y-hemCenter.y)*1.025}));
    // The open cuff has a near edge only: its far half is hidden by the thigh,
    // not drawn as a closed circular socket around the leg.
    push(`${leg.name}-shorts-outline`,clipLineOutside(d,[...yokePolygon,opening]),z+.001,"none",INK,1.4);
    const nearest=Math.atan2(dot(hem.front,view)*hem.rz,dot(hem.side,view)*hem.rx);
    // As the thigh faces the viewer, its exposed front hides more of the
    // opening. Narrow that rim continuously instead of exposing a round socket.
    const facing=Math.abs(dot(leg.axis,view));
    const halfArc=Math.PI/2-facing*facing*Math.PI/5;
    const hemArc=Array.from({length:17},(_,i)=>garmentRingPoint(hem,nearest-halfArc+i*halfArc/8));
    push(`${leg.name}-shorts-hem`,smoothLine(hemArc),z+.002,"none",INK,1.2);
  }
  push("shorts",yoke,garmentFront+.01,PAPER,"none");
  // Grow the hinge-only torso mask from the hip centre, so its outline is
  // gradually hidden instead of disappearing as soon as a hinge begins.
  const hipPoint=project(hips);
  const garmentTorsoMask=garment.hingeBlend>0?torsoPolygon.map(polygon=>polygon.map(point=>({
    x:hipPoint.x+(point.x-hipPoint.x)*garment.hingeBlend,
    y:hipPoint.y+(point.y-hipPoint.y)*garment.hingeBlend,
  }))):[];
  push("shorts-yoke-outline",clipLineOutside(yoke,[...garmentTorsoMask,...sleeves.flatMap(({d})=>flattenPath(d))]),garmentFront+.011,"none",INK,1.4);

  push("torso",torsoShape,torsoDepth,SKIN,"none");
  push("torso-outline",clipLineOutside(torsoShape,shoulderJoints.map(joint=>joint.polygon)),torsoDepth+.001,"none",INK,1.55);
  // Surface landmarks of the rib cage, pectorals and abdomen. These follow the
  // torso frame in lying, bent and standing poses, instead of a shirt decal.
  torsoLandmarks(pose).forEach((mark,index)=>{
    const visible=dot(mark.normal,view)>.08;
    push(mark.id,smoothLine(mark.points),torsoDepth+.012+index*.0001,"none",visible?DETAIL:"none",mark.width);
  });
  const waist=garment.waistband[1];
  const waistNear=Math.atan2(dot(waist.front,view)*waist.rz,dot(waist.side,view)*waist.rx);
  push("waistband",smoothLine(Array.from({length:17},(_,i)=>garmentRingPoint(waist,waistNear-Math.PI/2+i*Math.PI/16))),garmentFront+.013,"none",DETAIL,.9);

  // Neck and head share the torso frame, so lying and standing figures match.
  const neckBase=add(shoulders,mul(axis,-.008));
  push("neck",volume([{center:neckBase,rx:.06,rz:.055},{center:j.neck,rx:.047,rz:.046},{center:add(j.head,mul(axis,-.083)),rx:.05,rz:.048}],side,front),torsoDepth-.001,SKIN);
  const headAxis=unit(sub(j.head,j.neck)),headFront=unit(cross(side,headAxis));
  const hp=(x:number,y:number,z:number)=>add(add(add(j.head,mul(side,x)),mul(headAxis,y)),mul(headFront,z));
  const headRings=[[-.113,.034,.043],[-.076,.059,.069],[-.012,.078,.090],[.084,.077,.087],[.127,.068,.074]];
  const skull=headRings.flatMap(([height,rx,rz])=>Array.from({length:12},(_,i)=>hp(Math.cos(i*Math.PI/6)*rx,height,Math.sin(i*Math.PI/6)*rz)));
  push("head",silhouette(skull),depth(j.head)+.012,SKIN,INK,1.5);
  // H2's cropped hair, angular jaw and restrained brow/nose survive projection;
  // hair is an empty outline with no coloured cap or realistic facial shading.
  const faceVisible=dot(headFront,view)>.06;
  const hairline=[hp(-.068,.037,.043),hp(-.045,.042,.071),hp(-.045,.095,.070),hp(.064,.095,.043)];
  push("hair",line(hairline),depth(j.head)+.020,"none",faceVisible?INK:"none",1.2);
  const facePoints=[hp(.044,.021,.074),hp(.010,.033,.090),hp(.005,-.026,.090),hp(.022,-.030,.088)];
  push("face-profile",line(facePoints),depth(j.head)+.021,"none",faceVisible?DETAIL:"none",1.08);
  push("ear",smoothLine([hp(.076,.025,.004),hp(.092,.033,.015),hp(.092,-.005,.022),hp(.077,-.021,.009)]),depth(j.head)+.023,"none",INK,1);

  // A rigid bar with circular plates perpendicular to its X axis. Splitting the
  // shaft lets the near and far ends occlude the figure consistently.
  const bar=pose.bar;
  const frontBar=bar?.support==="hands";
  const bodyFront=Math.max(torsoDepth+.025,depth(j.head)+.035);
  const bodyBack=Math.min(torsoDepth-.025,depth(j.neck)-.035);
  const barLength=bar?.halfLength??0;
  const segments=[-barLength,-.65*(barLength/.9),-.34,0,.34,.65*(barLength/.9),barLength];
  if(equipment&&bar) for(let i=0;i<segments.length-1;i++) {
    const a=add(bar.center,v(segments[i],0,0)), b=add(bar.center,v(segments[i+1],0,0));
    const physicalDepth=depth(midpoint(a,b));
    const central=i>=1&&i<=4;
    const z=central&&bar.depthPolicy!=="physical"?(frontBar?Math.max(physicalDepth,bodyFront):Math.min(physicalDepth,bodyBack)):physicalDepth;
    push(`bar-${i}`,line([a,b]),z,"none",INK,2.7);
  }
  if(equipment&&bar&&bar.kind!=="pull-up-bar") for(const sign of [-1,1]) {
    const center=add(bar.center,v(sign*.72,0,0));
    const outer=add(center,v(.026,0,0));
    const inner=add(center,v(-.026,0,0));
    push(`plate-${sign}-back`,disk(inner,bar.plateRadius),depth(inner),PAPER,DETAIL,1.2);
    // Projected thickness avoids the mismatched front-view discs in v0.
    push(`plate-${sign}-rim`,polygon([add(inner,v(0,bar.plateRadius,0)),add(outer,v(0,bar.plateRadius,0)),add(outer,v(0,-bar.plateRadius,0)),add(inner,v(0,-bar.plateRadius,0))]),depth(center),PAPER,DETAIL,1);
    push(`plate-${sign}-face`,disk(outer,bar.plateRadius),depth(outer)+.001,PAPER,INK,1.6);
    push(`plate-${sign}-ring`,disk(outer,bar.plateRadius*.72),depth(outer)+.002,"none",MUTED,.7);
    push(`plate-${sign}-hub`,disk(outer,.025),depth(outer)+.003,PAPER,DETAIL,1);
  }

  if(equipment&&bar?.kind==="pull-up-bar") for(const sign of [-1,1]) {
    const end=add(bar.center,v(sign*bar.halfLength,0,0));
    push(`pull-up-mount-${sign}`,line([add(end,v(0,.17,-.13)),add(end,v(0,.17,0)),end]),depth(end)-.005,"none",MUTED,2.1);
  }

  if(equipment&&pose.landmine) {
    const {pivot,tip,plateRadius}=pose.landmine;
    const shaft=unit(sub(tip,pivot)),crosswise=v(1,0,0),radial=unit(cross(shaft,crosswise));
    const ringPoints=(center:Vec3,radius:number)=>Array.from({length:32},(_,i)=>add(center,add(mul(crosswise,Math.cos(i*Math.PI/16)*radius),mul(radial,Math.sin(i*Math.PI/16)*radius))));
    const disc=(center:Vec3,radius:number)=>contour(ringPoints(center,radius).map(project),1);
    for(let i=0;i<8;i++) {
      const a=blend(pivot,tip,i/8),b=blend(pivot,tip,(i+1)/8);
      push(`landmine-shaft-${i}`,line([a,b]),depth(midpoint(a,b)),"none",INK,2.8);
    }
    // The palm wraps the sleeve below its end. A visible continuation above
    // the fist distinguishes a neutral side grip from a hand cupping the cap.
    const sleeveStart=add(tip,mul(shaft,-.21));
    push("landmine-sleeve",silhouette([...ringPoints(sleeveStart,.025),...ringPoints(tip,.025)],.25),depth(midpoint(sleeveStart,tip))+.008,PAPER,INK,1.15);
    push("landmine-end-cap",disc(tip,.025),depth(tip)+.012,PAPER,DETAIL,.85);
    const plateCenter=blend(pivot,tip,.85),faceA=add(plateCenter,mul(shaft,.018)),faceB=add(plateCenter,mul(shaft,-.018));
    const near=depth(faceA)>depth(faceB)?faceA:faceB;
    // One extruded plate silhouette, not two disconnected floating ellipses.
    push("landmine-plate-back",silhouette([...ringPoints(faceA,plateRadius),...ringPoints(faceB,plateRadius)],.5),depth(near)-.001,PAPER,DETAIL,1.2);
    push("landmine-plate-face",disc(near,plateRadius),depth(near),PAPER,INK,1.6);
    push("landmine-plate-ring",disc(near,plateRadius*.72),depth(near)+.001,"none",MUTED,.7);
    push("landmine-plate-hub",disc(near,.026),depth(near)+.002,PAPER,DETAIL,1);
    push("landmine-pivot",silhouette([add(pivot,v(-.075,-.025,-.08)),add(pivot,v(.075,-.025,-.08)),add(pivot,v(.075,-.025,.08)),add(pivot,v(-.075,-.025,.08)),add(pivot,v(0,.035,0))]),depth(pivot)+.015,PAPER,INK,1.4);
  }

  for(const name of ["left","right"] as const) {
    const wrist=j[`${name}Wrist`], elbow=j[`${name}Elbow`];
    const frame=gripFrame(pose,name);
    const gp=(x:number,y:number,z:number)=>add(add(add(frame.center,mul(frame.across,x)),mul(frame.along,y)),mul(frame.palm,z));
    const holding=equipment&&(!!bar||pose.landmine?.hand===name||!!pose.handholds?.[name]);
    const contact=pose.handContacts?.[name];
    if(contact) {
      const normal=unit(contact.normal),forward=unit(contact.forward),lateral=unit(cross(normal,forward));
      const at=(x:number,y:number,z:number)=>add(add(add(contact.center,mul(lateral,x)),mul(forward,y)),mul(normal,z));
      const samples=[[-.033,-.044],[-.041,.005],[-.032,.053],[-.026,.075],[.026,.075],[.035,.025],[.034,-.035]];
      const surface=samples.flatMap(([x,y])=>[at(x,y,-.014),at(x,y,.014)]);
      const wristStart=add(wrist,mul(frame.reach,-.016));
      surface.push(add(wristStart,mul(lateral,-.024)),add(wristStart,mul(lateral,.024)));
      const handDepth=Math.max(...surface.map(depth))+.004;
      push(`${name}-hand`,silhouette(surface,.22),handDepth,SKIN,INK,1.12);
      const thumbSign=name==="left"?1:-1;
      push(`${name}-thumb`,smoothLine([at(thumbSign*.030,-.022,.009),at(thumbSign*.058,.006,.003),at(thumbSign*.050,.029,-.002)]),handDepth+.001,"none",INK,1.05);
      for(let finger=0;finger<3;finger++) push(`${name}-finger-${finger}`,smoothLine([at((finger-1)*.015,.032,.014),at((finger-1)*.014,.069,.010)]),handDepth+.002,"none",DETAIL,.55);
      continue;
    }
    if(!holding) {
      const reach=unit(sub(wrist,elbow));
      const palmDirection=unit(cross(v(1,0,0),reach));
      const palm=volume([{center:wrist,rx:.026,rz:.02},{center:add(wrist,mul(reach,.043)),rx:.040,rz:.021},{center:add(wrist,mul(reach,.087)),rx:.032,rz:.017},{center:add(wrist,mul(reach,.12)),rx:.021,rz:.009}],v(1,0,0),palmDirection);
      push(`${name}-hand`,palm,depth(wrist)+.035,SKIN,INK,1.2);
      const thumbSign=name==="left"?1:-1;
      push(`${name}-thumb`,smoothLine([add(wrist,add(mul(reach,.01),v(thumbSign*.023,0,.015))),add(wrist,add(mul(reach,.046),v(thumbSign*.052,0,.015))),add(wrist,add(mul(reach,.066),v(thumbSign*.034,0,.01)))]),depth(wrist)+.036,"none",INK,1.2);
      for(let finger=0;finger<3;finger++) push(`${name}-finger-${finger}`,line([add(wrist,add(mul(reach,.07),v((finger-1)*.017,0,.022))),add(wrist,add(mul(reach,.106),v((finger-1)*.016,0,.017)))]),depth(wrist)+.038,"none",MUTED,.6);
      continue;
    }
    if(pose.handholds?.[name]?.grip) {
      // A fist wraps a shaft beyond the anatomical wrist. The older neutral
      // sleeve loft put the shaft through the wrist and elongated the palm.
      const hp=(x:number,y:number,z:number)=>gp(x,y,z);
      const orientedPalm=!!pose.handholds[name]?.palmNormal;
      const shellOffset=orientedPalm?-.007:.007;
      const wristStart=add(wrist,mul(frame.reach,-.018));
      const shell:Vec3[]=[];
      for(const [along,radius] of [[-.040,.022],[-.026,.030],[.018,.032],[.041,.023]]) {
        for(let i=0;i<12;i++) {
          const angle=i*Math.PI/6;
          shell.push(hp(radius*Math.cos(angle),along,shellOffset+radius*Math.sin(angle)));
        }
      }
      for(let i=0;i<8;i++) {
        const angle=i*Math.PI/4;
        shell.push(add(add(wristStart,mul(frame.along,Math.cos(angle)*.023)),mul(frame.across,Math.sin(angle)*.020)));
      }
      const gripDepth=Math.max(depth(frame.center),depth(wrist))+.037;
      push(`${name}-hand`,silhouette(shell,.18),gripDepth,SKIN,INK,1.13);
      const facing=Math.atan2(dot(view,frame.palm),dot(view,frame.across));
      for(const [index,along] of [-.022,0,.022].entries()) {
        const points=orientedPalm
          ?[hp(.017,along,-.030),hp(-.016,along,-.035),hp(-.030,along,-.012)]
          :[-.48,0,.48].map(offset=>hp(Math.cos(facing+offset)*.029,along,.007+Math.sin(facing+offset)*.029));
        push(`${name}-finger-${index}`,smoothLine(points),gripDepth+.002,"none",MUTED,.55);
      }
      const direction=dot(frame.thumb,frame.along)>=0?1:-1;
      const thumb=[hp(.017,direction*.040,.014),hp(.030,direction*.025,.029),hp(.024,direction*.003,.034),hp(.012,direction*.007,.037),hp(.014,direction*.025,.026)];
      push(`${name}-thumb`,contour(thumb.map(project),.28),gripDepth+.003,SKIN,INK,.9);
      push(`${name}-grip`,smoothLine(orientedPalm
        ?[hp(-.016,-.028,-.031),hp(-.023,0,-.033),hp(-.016,.028,-.031)]
        :[hp(-.022,-direction*.027,.019),hp(-.028,0,.026),hp(-.019,direction*.025,.020)]),gripDepth+.001,"none",DETAIL,.65);
      push(`${name}-wrist-crease`,line([add(wrist,mul(frame.along,-.018)),add(wrist,mul(frame.along,.018))]),gripDepth+.002,"none",MUTED,.5);
      continue;
    }
    if(pose.landmine?.hand===name||pose.handholds?.[name]) {
      // Longitudinal neutral grip: along follows the shaft, the wrist joins
      // beside it, and the fingers curl across it instead of under the end.
      const gripDepth=Math.max(depth(frame.center),depth(wrist))+.045;
      const wristStart=add(wrist,mul(frame.reach,-.038));
      const grip=volume([
        {center:wristStart,rx:.025,rz:.022},
        {center:gp(.008,-.035,0),rx:.036,rz:.030},
        {center:gp(.003,.005,0),rx:.039,rz:.032},
        {center:gp(0,.040,0),rx:.030,rz:.027},
      ],frame.across,frame.palm);
      push(`${name}-hand`,grip,gripDepth,SKIN,INK,1.2);
      const face=dot(frame.palm,view)>0?1:-1;
      // Four finger folds run circumferentially around the sleeve. The thumb
      // crosses them diagonally toward the projecting end of the bar.
      for(const [index,y] of [-.025,-.006,.013,.029].entries()) {
        push(`${name}-finger-${index}`,smoothLine([gp(-.025,y,face*.022),gp(-.004,y+.004,face*.034),gp(.025,y+.002,face*.025)]),gripDepth+.002,"none",DETAIL,.65);
      }
      push(`${name}-grip`,smoothLine([gp(.031,-.026,face*.012),gp(.037,.004,face*.015),gp(.022,.036,face*.015)]),gripDepth+.0025,"none",DETAIL,.75);
      const thumb=[gp(.031,-.020,face*.027),gp(.043,.005,face*.024),gp(.023,.035,face*.033),gp(.012,.033,face*.039),gp(.020,.017,face*.040),gp(.021,-.006,face*.034)];
      push(`${name}-thumb`,contour(thumb.map(project),.45),gripDepth+.003,SKIN,INK,.95);
      push(`${name}-wrist-crease`,smoothLine([gp(-.018,-.053,face*.021),gp(.004,-.050,face*.024),gp(.022,-.045,face*.022)]),gripDepth+.004,"none",MUTED,.65);
      continue;
    }
    const wristStart=add(wrist,mul(frame.reach,-.072));
    const grip=volume([{center:wristStart,rx:.026,rz:.023},{center:gp(0,-.034,-.006),rx:.037,rz:.03},{center:gp(0,.017,0),rx:.043,rz:.036},{center:gp(0,.043,.002),rx:.034,rz:.023}],frame.across,frame.palm);
    const gripDepth=Math.max(depth(frame.center),frontBar&&bar?.depthPolicy!=="physical"?bodyFront:-Infinity)+.045;
    push(`${name}-hand`,grip,gripDepth,SKIN,INK,1.2);
    const thumbSign=frame.thumb.x;
    const thumb=[gp(thumbSign*.024,-.048,-.01),gp(thumbSign*.052,-.016,.014),gp(thumbSign*.049,.003,.033),gp(thumbSign*.013,.014,.036),gp(thumbSign*.005,-.003,.024),gp(thumbSign*.025,-.012,.014)];
    push(`${name}-thumb`,contour(thumb.map(project),.55),gripDepth+.003,SKIN,INK,.95);
    const face=dot(frame.palm,view)>0?1:-1;
    push(`${name}-grip`,smoothLine([gp(-.032,.024,face*.028),gp(-.009,.03,face*.031),gp(.014,.028,face*.031),gp(.033,.018,face*.027)]),gripDepth+.002,"none",DETAIL,.7);
    for(const [index,x] of [-.023,-.006,.012,.028].entries()) {
      push(`${name}-finger-${index}`,smoothLine([gp(x,.025,face*.024),gp(x,.01,face*.037),gp(x,-.004,face*.031)]),gripDepth+.0025,"none",MUTED,.55);
    }
    push(`${name}-wrist-crease`,smoothLine([gp(-.022,-.059,face*.023),gp(0,-.057,face*.024),gp(.022,-.059,face*.023)]),gripDepth+.004,"none",MUTED,.65);
  }
  if(pose.occlusion==="surface") parts=refineSurfaceDepth(pose,parts);
  if(pose.anatomy?.surfaceArms) {
    for(const name of ["left","right"] as const) {
      const upper=flattenPath(parts.find(p=>p.id===`${name}-upper-arm`)!.d);
      const forearm=flattenPath(parts.find(p=>p.id===`${name}-forearm`)!.d);
      const hand=flattenPath(parts.find(p=>p.id===`${name}-hand`)!.d);
      for(const suffix of ["deltoid","biceps","triceps"]) {
        const mark=parts.find(p=>p.id===`${name}-${suffix}`)!;
        mark.d=clipLineOutside(clipLineInside(mark.d,upper),forearm);
      }
      const tendon=parts.find(p=>p.id===`${name}-forearm-tendon`)!;
      tendon.d=clipLineOutside(clipLineInside(tendon.d,forearm),hand);
    }
  }
  return parts.sort((a,b)=>a.depth-b.depth);
};
}

const benchRenderer = makeRenderer(112,18), standingRenderer = makeRenderer(42);
// A more lateral squat view keeps the flexed thighs and turning hems readable.
const squatRenderer = makeRenderer(60);
const motionRenderers=new Map<string,ReturnType<typeof makeRenderer>>();
export function drawStudy(pose: StudyPose): StudyPath[] {
  if(pose.camera) {
    const {yaw,pitch=9}=pose.camera,key=`${yaw}/${pitch}`;
    if(!motionRenderers.has(key))motionRenderers.set(key,makeRenderer(yaw,pitch));
    return motionRenderers.get(key)!(pose);
  }
  return (pose.bench ? benchRenderer : pose.bar?.support === "upper-back" ? squatRenderer : standingRenderer)(pose);
}

export type CharacterView = "front" | "three-quarter" | "side";
const characterRenderers = {front:makeRenderer(0),"three-quarter":makeRenderer(42),side:makeRenderer(82)};
export function drawCharacter(view: CharacterView): StudyPath[] {
  return characterRenderers[view](characterPose(),false);
}

export function pathsMarkup(parts: StudyPath[]): string {
  return parts.map(p=>`<path data-part="${p.id}" d="${p.d}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.width}"/>`).join("");
}
