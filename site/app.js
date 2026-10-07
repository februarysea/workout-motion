import { initialLanguage, translate } from "./i18n.js";
import { englishMotionCopy } from "./motion-copy.js";

const $ = (selector) => document.querySelector(selector);
const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const SOURCE_URL = "https://github.com/februarysea/workout-motion";
const LICENSE_URL = "https://polyformproject.org/licenses/noncommercial/1.0.0";
const REQUIRED_NOTICE = `Required Notice: Copyright (c) 2026 februarysea and workout-motion contributors (${SOURCE_URL})`;
let language = initialLanguage();
const t = (key, values) => translate(language, key, values);
const motionName = (motion) => language === "en" ? motion.label : motion.chinese;
const dumbbellIds = new Set(["single-arm-dumbbell-row", "incline-dumbbell-press", "dumbbell-shoulder-press", "hammer-curl", "lateral-raise"]);
const cableIds = new Set(["seated-cable-row", "lat-pulldown", "triceps-pushdown"]);
const bodyweightIds = new Set(["pull-up", "dip", "reverse-lunge", "glute-bridge", "box-jump", "depth-box-jump", "lateral-box-jump"]);
const categoryFor = (id) => dumbbellIds.has(id) ? "dumbbell" : cableIds.has(id) ? "cable" : bodyweightIds.has(id) ? "bodyweight" : "barbell";
const themeColors = {
  light: { paper: "#f5f5f5", ink: "#262626", detail: "#525252", muted: "#737373" },
  dark: { paper: "#111111", ink: "#f5f5f5", detail: "#d4d4d4", muted: "#929292" },
};
const progress = $("#motion-progress");
const playButton = $("#play-toggle");
const search = $("#motion-search");
const list = $("#motion-list");
const preview = $("#motion-art");
const thumbnailCache = new Map();
let api;
let motions = [];
let filtered = [];
let selectedId = "";
let category = "all";
let player = null;
let wantsPlayback = !reducedMotion.matches;
let timelineFrame = null;
let notificationTimer = null;
let activeKeyframe = null;
let copyLabel = 'SVG';
let loadFailed = false;

function applyLanguage(next, persist = true) {
  language = next === 'zh' ? 'zh' : 'en';
  root.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  $('meta[name="description"]').content = t('description');
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder)); });
  const toggle = $('#language-toggle');
  toggle.textContent = language === 'zh' ? 'EN' : '中文';
  toggle.lang = language === 'zh' ? 'en' : 'zh-CN';
  toggle.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换为中文');
  document.querySelectorAll('[data-license-link]').forEach((link) => { link.href = `./license.html?lang=${language}`; });
  try {
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url);
  } catch { /* Restricted embedded previews can still change language. */ }
  if (persist) {
    try { localStorage.setItem('workout-motion-language', language); } catch { /* Storage is optional. */ }
  }
  $('#notification').hidden = true;
  if ($('#copy-dialog').open) $('#copy-dialog-title').textContent = t('copyTitle', { label: copyLabel });
  applyTheme(root.dataset.theme, false);
  if (selectedId) {
    const scroll = list.scrollTop;
    renderSelectedCopy();
    renderList();
    list.scrollTop = scroll;
    syncPlayback(player?.playing ?? false);
    paintProgress();
  }
  if (loadFailed) renderLoadFailure();
}

function renderLoadFailure() {
  $('#motion-name').textContent = t('unavailable');
  $('#motion-subtitle').textContent = t('loadError');
  $('#catalog-loading').textContent = t('catalogUnavailable');
  $('#playback-indicator span').textContent = t('notLoaded');
}

function applyTheme(theme, persist = true) {
  const next = theme === "light" ? "light" : "dark";
  root.dataset.theme = next;
  $("#theme-toggle").setAttribute("aria-pressed", String(next === "dark"));
  $("#theme-toggle").setAttribute("aria-label", t(next === "dark" ? "lightTheme" : "darkTheme"));
  $('meta[name="theme-color"]').content = next === "dark" ? "#111111" : "#f5f5f5";
  if (persist) {
    try { localStorage.setItem("workout-motion-theme", next); } catch { /* Theme still works without storage access. */ }
  }
}

try { applyTheme(localStorage.getItem("workout-motion-theme"), false); } catch { applyTheme("dark", false); }
applyLanguage(language, false);
$("#language-toggle").addEventListener("click", () => applyLanguage(language === "zh" ? "en" : "zh"));
$("#theme-toggle").addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark"));

function notify(message) {
  clearTimeout(notificationTimer);
  const notification = $("#notification");
  notification.textContent = message;
  notification.hidden = false;
  notificationTimer = setTimeout(() => { notification.hidden = true; }, 4200);
}

async function copyText(text, label) {
  copyLabel = label;
  const displayLabel = label;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    notify(t("copied", { label: displayLabel }));
  } catch {
    const dialog = $("#copy-dialog");
    const textarea = $("#copy-fallback");
    $("#copy-dialog-title").textContent = t("copyTitle", { label: displayLabel });
    textarea.value = text;
    dialog.showModal();
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
  }
}

function paintProgress() {
  if (!player || !selectedId) return;
  const phase = Math.max(0, Math.min(1, player.progress));
  const motion = api.getExercise(selectedId);
  progress.value = String(Math.round(phase * 1000));
  progress.style.setProperty("--progress", `${phase * 100}%`);
  progress.setAttribute("aria-valuetext", `${Math.round(phase * 100)}%, ${(phase * motion.durationMs / 1000).toFixed(2)} ${t("seconds")}`);
  $("#progress-time").textContent = `${(phase * motion.durationMs / 1000).toFixed(2)} s`;
}

function updateTimeline() {
  timelineFrame = null;
  paintProgress();
  if (player?.playing) timelineFrame = requestAnimationFrame(updateTimeline);
}

function syncPlayback(playing) {
  playButton.setAttribute("aria-pressed", String(playing));
  playButton.setAttribute("aria-label", t(reducedMotion.matches ? "reducedLabel" : playing ? "pause" : "play"));
  playButton.disabled = reducedMotion.matches;
  const indicator = $("#playback-indicator");
  indicator.dataset.playing = String(playing);
  indicator.querySelector("span").textContent = t(playing ? "playing" : "paused");
  if (timelineFrame !== null) cancelAnimationFrame(timelineFrame);
  timelineFrame = playing ? requestAnimationFrame(updateTimeline) : null;
  if (!playing) paintProgress();
}

function clearKeyframeSelection() {
  activeKeyframe = null;
  $("#keyframes").querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
}

function pauseAt(phase) {
  wantsPlayback = false;
  player.pause();
  player.seek(phase);
  paintProgress();
}

function updateNavigation() {
  const disabled = filtered.length < 2;
  $("#previous-motion").disabled = disabled;
  $("#next-motion").disabled = disabled;
}

function renderSelectedCopy() {
  const motion = api.getExercise(selectedId);
  $("#motion-name").textContent = motionName(motion);
  $("#motion-english").textContent = language === "en" ? motion.id : motion.label;
  $("#motion-subtitle").textContent = language === "en" ? englishMotionCopy[motion.id].subtitle : motion.subtitle;
  $("#motion-category").textContent = t(categoryFor(motion.id));
  $("#motion-number").textContent = `${String(motions.findIndex((item) => item.id === motion.id) + 1).padStart(2, "0")} / ${motions.length}`;
  $("#motion-duration").textContent = `${(motion.durationMs / 1000).toFixed(1)} ${t("loop")}`;
  $("#duration-time").textContent = `${(motion.durationMs / 1000).toFixed(2)} s`;
  preview.setAttribute("aria-label", t("previewLabel", { name: motionName(motion) }));
  $("#keyframes").replaceChildren();
  const keyframes = motion.keyframes?.length ? motion.keyframes : [{ phase: 0, label: t("start") }, { phase: 0.25, label: t("middle") }, { phase: 0.5, label: t("end") }];
  keyframes.forEach((keyframe, index) => {
    const label = language === "en" && motion.keyframes?.length ? englishMotionCopy[motion.id].keyframes[index] : keyframe.label;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", t("frameLabel", { name: label, percent: Math.round(keyframe.phase * 100) }));
    button.setAttribute("aria-pressed", String(activeKeyframe === keyframe.phase));
    button.addEventListener("click", () => {
      pauseAt(keyframe.phase);
      clearKeyframeSelection();
      activeKeyframe = keyframe.phase;
      button.setAttribute("aria-pressed", "true");
    });
    $("#keyframes").append(button);
  });
  const title = preview.querySelector("svg title");
  if (title) title.textContent = motionName(motion);
  preview.querySelector("svg")?.setAttribute("aria-label", motionName(motion));
}

function selectMotion(id, { scrollPreview = false } = {}) {
  const motion = api.getExercise(id);
  if (!motion) return;
  player?.destroy();
  selectedId = id;
  activeKeyframe = null;
  renderSelectedCopy();
  player = api.createPlayer(preview, id, {
    autoplay: wantsPlayback && !reducedMotion.matches,
    respectReducedMotion: true,
    speed: Number($("#motion-speed").value),
    title: motionName(motion),
    onStateChange: syncPlayback,
  });
  syncPlayback(player.playing);
  paintProgress();
  list.querySelectorAll("[data-motion]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.motion === id)));
  updateNavigation();
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("motion", id);
    history.replaceState(null, "", url);
  } catch { /* The player also works in restricted embedded previews. */ }
  if (scrollPreview && window.matchMedia("(max-width: 760px)").matches) {
    $(".preview-panel").scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
  }
}

function renderList() {
  const query = search.value.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  filtered = motions.filter((motion) => {
    const searchable = `${motion.chinese} ${motion.label} ${motion.id}`.toLocaleLowerCase();
    return (category === "all" || categoryFor(motion.id) === category) && terms.every((term) => searchable.includes(term));
  });
  const fragment = document.createDocumentFragment();
  filtered.forEach((motion) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "motion-choice";
    button.dataset.motion = motion.id;
    button.setAttribute("aria-pressed", String(motion.id === selectedId));
    button.setAttribute("aria-label", motionName(motion));
    const thumbnail = document.createElement("span");
    thumbnail.className = "motion-thumbnail";
    thumbnail.setAttribute("aria-hidden", "true");
    if (!thumbnailCache.has(motion.id)) thumbnailCache.set(motion.id, api.renderSvg(motion.id, { phase: 0.3, size: 78 }));
    thumbnail.innerHTML = thumbnailCache.get(motion.id);
    const copy = document.createElement("span");
    copy.className = "choice-copy";
    const name = document.createElement("span");
    name.className = "choice-name";
    name.textContent = motionName(motion);
    const english = document.createElement("span");
    english.className = "choice-english";
    english.textContent = language === "en" ? motion.id : motion.label;
    const number = document.createElement("span");
    number.className = "choice-number";
    number.textContent = String(motions.indexOf(motion) + 1).padStart(2, "0");
    copy.append(name, english);
    button.append(thumbnail, copy, number);
    button.addEventListener("click", () => selectMotion(motion.id, { scrollPreview: true }));
    item.append(button);
    fragment.append(item);
  });
  list.replaceChildren(fragment);
  list.hidden = filtered.length === 0;
  list.scrollTop = 0;
  $("#empty-state").hidden = filtered.length > 0;
  $("#result-count").textContent = String(filtered.length).padStart(2, "0");
  $("#result-count").setAttribute("aria-label", t("found", { count: filtered.length }));
  updateNavigation();
}

function navigateMotion(direction) {
  if (!filtered.length) return;
  const current = filtered.findIndex((motion) => motion.id === selectedId);
  const next = current === -1 ? (direction > 0 ? 0 : filtered.length - 1) : (current + direction + filtered.length) % filtered.length;
  selectMotion(filtered[next].id);
  const selected = list.querySelector('[aria-pressed="true"]');
  if (selected) {
    const item = selected.closest("li");
    const listBounds = list.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    if (itemBounds.top < listBounds.top) list.scrollTop -= listBounds.top - itemBounds.top;
    else if (itemBounds.bottom > listBounds.bottom) list.scrollTop += itemBounds.bottom - listBounds.bottom;
  }
}

function exportSvg() {
  const motion = api.getExercise(selectedId);
  const colors = themeColors[root.dataset.theme];
  const phase = player?.progress ?? 0;
  const raw = api.renderSvg(selectedId, { phase, size: 720, title: `${motionName(motion)} · workout-motion` });
  const resolved = raw.replace(/var\(\s*--figure-(paper|ink|detail|muted)\s*(?:,[^)]*)?\)/g, (_, key) => colors[key]);
  const document = new DOMParser().parseFromString(resolved, "image/svg+xml");
  if (document.querySelector("parsererror")) throw new Error("Unable to create SVG");
  const svg = document.documentElement;
  const namespace = "http://www.w3.org/2000/svg";
  const metadata = document.createElementNS(namespace, "metadata");
  metadata.textContent = `${REQUIRED_NOTICE}\nLicensed under PolyForm Noncommercial 1.0.0: ${LICENSE_URL}\nUses outside the license permissions require separate written permission: ${SOURCE_URL}/issues/new?template=commercial-license.yml\nMotion: ${selectedId}; phase: ${phase.toFixed(6)}; theme: ${root.dataset.theme}.`;
  svg.insertBefore(metadata, svg.firstChild);
  const [x, y, width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  const background = document.createElementNS(namespace, "rect");
  for (const [key, value] of Object.entries({ x, y, width, height, fill: colors.paper })) background.setAttribute(key, String(value));
  background.setAttribute("aria-hidden", "true");
  svg.insertBefore(background, metadata.nextSibling);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}\n`;
}

search.addEventListener("input", renderList);
$("#reset-search").addEventListener("click", () => {
  search.value = "";
  category = "all";
  document.querySelectorAll("[data-category]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.category === "all")));
  renderList();
  search.focus();
});
document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
  category = button.dataset.category;
  document.querySelectorAll("[data-category]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  renderList();
}));
playButton.addEventListener("click", () => {
  if (!player || reducedMotion.matches) return;
  wantsPlayback = !player.playing;
  clearKeyframeSelection();
  if (wantsPlayback) player.play();
  else player.pause();
});
progress.addEventListener("input", () => {
  if (!player) return;
  clearKeyframeSelection();
  pauseAt(Number(progress.value) / 1000);
});
$("#motion-speed").addEventListener("change", (event) => player?.setSpeed(Number(event.target.value)));
$("#previous-motion").addEventListener("click", () => navigateMotion(-1));
$("#next-motion").addEventListener("click", () => navigateMotion(1));
$("#download-svg").addEventListener("click", () => {
  try {
    const url = URL.createObjectURL(new Blob([exportSvg()], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `workout-motion-${selectedId}-${root.dataset.theme}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    notify(t("downloadReady"));
  } catch { notify(t("exportError")); }
});
$("#copy-svg").addEventListener("click", () => {
  try { void copyText(exportSvg(), "SVG"); } catch { notify(t("exportError")); }
});
$("#retry-load").addEventListener("click", () => location.reload());
document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
  if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !$("#copy-dialog").open) {
    event.preventDefault();
    search.focus();
  }
});
reducedMotion.addEventListener("change", () => {
  $("#reduced-motion-note").hidden = !reducedMotion.matches;
  if (reducedMotion.matches) {
    wantsPlayback = false;
    player?.pause();
  }
  if (player) syncPlayback(player.playing);
});
window.addEventListener("pagehide", () => {
  player?.destroy();
  if (timelineFrame !== null) cancelAnimationFrame(timelineFrame);
});
window.addEventListener("pageshow", (event) => { if (event.persisted && api && selectedId) selectMotion(selectedId); });

try {
  api = await import("./dist/h2.js");
  motions = api.exerciseIds.map((id) => api.getExercise(id));
  if (!motions.length || motions.some((motion) => !motion)) throw new Error("Invalid catalog");
  $("#catalog-loading").hidden = true;
  $("#reduced-motion-note").hidden = !reducedMotion.matches;
  const requestedId = new URL(location.href).searchParams.get("motion");
  const initialId = api.exerciseIds.includes(requestedId) ? requestedId : api.exerciseIds.includes("conventional-deadlift") ? "conventional-deadlift" : api.exerciseIds[0];
  selectMotion(initialId);
  renderList();
  for (const selector of ["#motion-search", "#motion-progress", "#motion-speed", "#download-svg", "#copy-svg"]) $(selector).disabled = false;
  document.querySelectorAll("[data-category]").forEach((button) => { button.disabled = false; });
} catch (error) {
  console.error("workout-motion could not initialize", error);
  player?.destroy();
  $("#load-error").hidden = false;
  loadFailed = true;
  renderLoadFailure();
} finally {
  $("#motion-library").setAttribute("aria-busy", "false");
}
