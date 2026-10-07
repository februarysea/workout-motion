import { conventionalDeadliftStudy, sumoDeadliftStudy } from "./studies/deadlifts.js";
import { bentOverRowStudy } from "./studies/bent-over-row.js";
import { barbellCurlStudy } from "./studies/barbell-curl.js";
import { frontSquatStudy } from "./studies/front-squat.js";
import { lowBarSquatStudy, reverseLungeStudy, gluteBridgeStudy, hipThrustStudy } from "./studies/lower-expansion.js";
import { singleArmDumbbellRowStudy, inclineDumbbellPressStudy, dumbbellShoulderPressStudy, hammerCurlStudy, lateralRaiseStudy } from "./studies/dumbbell-expansion.js";
import { seatedCableRowStudy, latPulldownStudy, tricepsPushdownStudy, dipStudy } from "./studies/cable-dip.js";
import { benchStudy } from "./studies/bench.js";
import { squatStudy } from "./studies/squat.js";
import { overheadStudy } from "./studies/overhead.js";
import { romanianStudy } from "./studies/romanian.js";
import { pullupStudy } from "./studies/pullup.js";
import { landmineStudy } from "./studies/landmine.js";
import { cleanStudy } from "./studies/clean.js";
import { powerCleanStudy } from "./studies/power-clean.js";
import { boxJumpStudy, depthBoxJumpStudy, lateralBoxJumpStudy } from "./studies/box-jumps.js";
import { drawStudy, drawCharacter, pathsMarkup } from "./studies/draw.js";
import type { CharacterView } from "./studies/draw.js";
import type { PlayerOptions, WorkoutPlayer } from "./player.js";

/** B05 review catalog: 29 motions; visual review status is maintained in review/app.js. */
export const benchmarkStudies = [benchStudy, squatStudy, overheadStudy] as const;
export const batchAStudies = [bentOverRowStudy, barbellCurlStudy, frontSquatStudy] as const;
export const batchBStudies = [lowBarSquatStudy, reverseLungeStudy, gluteBridgeStudy, hipThrustStudy, singleArmDumbbellRowStudy, inclineDumbbellPressStudy, dumbbellShoulderPressStudy, hammerCurlStudy, lateralRaiseStudy, seatedCableRowStudy, latPulldownStudy, tricepsPushdownStudy, dipStudy] as const;
export const deadliftStudies = [conventionalDeadliftStudy, sumoDeadliftStudy] as const;
export const reviewStudies = [...deadliftStudies, ...batchBStudies, ...batchAStudies, ...benchmarkStudies, romanianStudy, pullupStudy, landmineStudy, cleanStudy, powerCleanStudy, boxJumpStudy, depthBoxJumpStudy, lateralBoxJumpStudy] as const;

function find(id: string) {
  const study = reviewStudies.find(study => study.id === id);
  if (!study) throw new RangeError(`Unknown study: ${id}`);
  return study;
}
function phaseValue(value: number) {
  if (!Number.isFinite(value)) throw new RangeError("phase must be finite");
  return Math.max(0,Math.min(1,value));
}
function speedValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError("speed must be positive and finite");
  return value;
}

const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);

export function renderStudy(id: string, options: { phase?: number; size?: number; title?: string; decorative?: boolean } = {}): string {
  const study = find(id);
  const phase = phaseValue(options.phase ?? 0), size = options.size ?? 360;
  if (!Number.isFinite(size) || size <= 0) throw new RangeError("size must be positive and finite");
  const pose=study.pose(phase);
  let parts=drawStudy(pose);
  if(size<=80) parts=parts.filter(p=>!/(ear|face-profile|crease|laces|plate-.*-ring|bench-pad-seam|clavicle|oblique|rectus|abdominal|sternum|linea-|serratus|navel|biceps|triceps|tendon|quadriceps-inner|calf|shin|brow|mouth|finger)/.test(p.id)).map(p=>({...p,width:p.width*1.4}));
  const viewBox=pose.camera?.viewBox??(id==="bench-press"?"25 80 300 300":"0 0 360 360");
  const accessibility = options.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${escapeXml(options.title ?? `${study.label}: H2 motion study`)}"`;
  const title = options.decorative ? "" : `<title>${escapeXml(options.title ?? `${study.chinese} · H2 动态样板`)}</title>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" ${accessibility} focusable="false" stroke-linejoin="round" stroke-linecap="round">${title}<g data-figure="">${pathsMarkup(parts)}</g></svg>`;
}

export function renderCharacter(options: {view?:CharacterView;size?:number} = {}): string {
  const view=options.view??"three-quarter",size=options.size??256;
  if(!["front","three-quarter","side"].includes(view))throw new RangeError("Unknown character view");
  if(!Number.isFinite(size)||size<=0)throw new RangeError("size must be positive and finite");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="30 55 300 300" role="img" aria-label="人体线稿 · ${view}" stroke-linejoin="round" stroke-linecap="round"><g>${pathsMarkup(drawCharacter(view))}</g></svg>`;
}

export function renderGripDetail(options: {side:"left"|"right";size?:number}):string {
  if(!["left","right"].includes(options.side))throw new RangeError("Unknown hand");
  const size=options.size??128;
  if(!Number.isFinite(size)||size<=0)throw new RangeError("size must be positive and finite");
  const pose=benchStudy.pose(0),w=pose.joints[`${options.side}Wrist`];
  const yaw=112*Math.PI/180,pitch=18*Math.PI/180;
  const x=180+(w.x*Math.cos(yaw)-w.z*Math.sin(yaw))*132;
  const y=315-(-w.x*Math.sin(yaw)*Math.sin(pitch)+w.y*Math.cos(pitch)-w.z*Math.cos(yaw)*Math.sin(pitch))*132;
  const parts=drawStudy(pose).filter(p=>p.id.startsWith("bar-")||(p.id.startsWith(options.side+"-")&&/forearm|hand|thumb|grip|finger|wrist/.test(p.id))).map(p=>({...p,width:p.width*.60}));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${x-17} ${y-17} 34 34" role="img" aria-label="卧推${options.side==="left"?"左手":"右手"}正握细节" stroke-linejoin="round" stroke-linecap="round"><g>${pathsMarkup(parts)}</g></svg>`;
}

export function createStudyPlayer(host: HTMLElement, id: string, options: PlayerOptions & { title?: string; decorative?: boolean } = {}): WorkoutPlayer {
  const study = find(id), doc=host.ownerDocument, win=doc.defaultView;
  if (!win) throw new Error("A browser document is required");
  let phase=phaseValue(options.phase??0), speed=speedValue(options.speed??1);
  host.innerHTML=renderStudy(id,{phase,title:options.title,decorative:options.decorative});
  const svg=host.querySelector<SVGSVGElement>("svg")!;
  svg.style.cssText="display:block;width:100%;height:100%";
  const group=svg.querySelector<SVGGElement>("[data-figure]")!;
  const paths=new Map([...group.querySelectorAll<SVGPathElement>("[data-part]")].map(p=>[p.dataset.part!,p]));
  const media=win.matchMedia("(prefers-reduced-motion: reduce)");
  let wantsPlayback=options.autoplay??true, inView=!("IntersectionObserver" in win);
  let running=false, destroyed=false, frame=0, lastTime:number|null=null;
  const paint=()=>{
    const parts=drawStudy(study.pose(phase));
    let cursor=group.firstElementChild;
    for(const part of parts){
      const path=paths.get(part.id)!;
      path.setAttribute("d",part.d);
      if(path.getAttribute("stroke")!==part.stroke)path.setAttribute("stroke",part.stroke);
      if(path.getAttribute("fill")!==part.fill)path.setAttribute("fill",part.fill);
      if(path!==cursor) group.insertBefore(path,cursor);
      cursor=path.nextElementSibling;
    }
  };
  const tick=(time:number)=>{
    if(!running||destroyed)return;
    if(lastTime!==null)phase=(phase+(time-lastTime)*speed/study.durationMs)%1;
    lastTime=time;
    paint();
    frame=win.requestAnimationFrame(tick);
  };
  const sync=()=>{
    const next=!destroyed&&wantsPlayback&&inView&&!doc.hidden&&!(media.matches&&options.respectReducedMotion!==false);
    if(next===running)return;
    running=next;lastTime=null;
    if(running)frame=win.requestAnimationFrame(tick);
    else win.cancelAnimationFrame(frame);
    options.onStateChange?.(running);
  };
  const observer="IntersectionObserver" in win?new win.IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();}):null;
  observer?.observe(host);
  doc.addEventListener("visibilitychange",sync);
  media.addEventListener("change",sync);
  sync();
  return {
    play(){if(!destroyed){wantsPlayback=true;sync();}},
    pause(){wantsPlayback=false;sync();},
    seek(value){const next=phaseValue(value);if(destroyed)return;phase=next;lastTime=null;paint();},
    setSpeed(value){speed=speedValue(value);lastTime=null;},
    destroy(){if(destroyed)return;destroyed=true;sync();observer?.disconnect();doc.removeEventListener("visibilitychange",sync);media.removeEventListener("change",sync);svg.remove();},
    get playing(){return running;},
    get progress(){return phase;},
  };
}
