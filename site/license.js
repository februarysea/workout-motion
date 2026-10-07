const root = document.documentElement;
const languageToggle = document.querySelector("#language-toggle");
const themeToggle = document.querySelector("#theme-toggle");
const backLink = document.querySelector("#back-link");
const LANGUAGE_KEY = "workout-motion-language";
const THEME_KEY = "workout-motion-theme";

const messages = {
  zh: {
    title: "使用许可 · workout-motion",
    description: "workout-motion 的使用范围、来源声明与商业授权，采用 PolyForm Noncommercial 1.0.0。",
    toolbar: "页面设置",
    back: "← 返回动作库",
    heading: "使用与授权",
    summary: "非商业用途免费，商业用途需书面许可。",
    conditions: "请保留来源和许可说明。具体以完整条款为准。",
    resources: "许可相关链接",
    request: "申请商业授权 ↗",
    canonical: "标准许可原文 ↗",
    noticeHeading: "项目声明",
    noticeLabel: "项目声明英文原文",
    termsHeading: "完整许可条款",
    termsLabel: "PolyForm Noncommercial 1.0.0 标准许可英文原文",
    switchLanguage: "切换为英文",
    light: "☀ 浅色",
    dark: "☾ 深色",
    switchLight: "切换为浅色主题",
    switchDark: "切换为深色主题",
  },
  en: {
    title: "License · workout-motion",
    description: "Usage, attribution and commercial permission for workout-motion under PolyForm Noncommercial 1.0.0.",
    toolbar: "Page controls",
    back: "← Back to the collection",
    heading: "Usage & licensing",
    summary: "Free for noncommercial use. Commercial use requires written permission.",
    conditions: "Keep attribution and license notices. Full terms govern.",
    resources: "License resources",
    request: "Request commercial permission ↗",
    canonical: "Original license ↗",
    noticeHeading: "Notices",
    noticeLabel: "Project notice in original English",
    termsHeading: "Full terms",
    termsLabel: "PolyForm Noncommercial 1.0.0 in original English",
    switchLanguage: "Switch to Chinese",
    light: "☀ Light",
    dark: "☾ Dark",
    switchLight: "Switch to light theme",
    switchDark: "Switch to dark theme",
  },
};

function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Controls also work without storage access. */ }
}

function supportedLanguage(value) {
  return value === "zh" || value === "en" ? value : null;
}

const requestedLanguage = supportedLanguage(new URL(location.href).searchParams.get("lang")?.toLowerCase());
let language = requestedLanguage
  ?? supportedLanguage(readPreference(LANGUAGE_KEY))
  ?? "en";
let theme = readPreference(THEME_KEY) === "light" ? "light" : "dark";

function updateThemeControl() {
  const text = messages[language];
  themeToggle.textContent = theme === "dark" ? text.light : text.dark;
  themeToggle.setAttribute("aria-label", theme === "dark" ? text.switchLight : text.switchDark);
  themeToggle.setAttribute("title", theme === "dark" ? text.switchLight : text.switchDark);
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
}

function applyTheme(next, persist = true) {
  theme = next === "light" ? "light" : "dark";
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#111111" : "#f5f5f5";
  updateThemeControl();
  if (persist) writePreference(THEME_KEY, theme);
}

function applyLanguage(next, { persist = true, updateUrl = false } = {}) {
  language = supportedLanguage(next) ?? "en";
  const text = messages[language];
  root.lang = language === "zh" ? "zh-CN" : "en";
  document.title = text.title;
  document.querySelector('meta[name="description"]').content = text.description;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = text[element.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-label]").forEach((element) => {
    element.setAttribute("aria-label", text[element.dataset.i18nLabel]);
  });
  languageToggle.textContent = language === "zh" ? "EN" : "中文";
  languageToggle.lang = language === "zh" ? "en" : "zh-CN";
  languageToggle.setAttribute("aria-label", text.switchLanguage);
  languageToggle.setAttribute("title", text.switchLanguage);
  backLink.setAttribute("href", `./index.html?lang=${language}`);
  updateThemeControl();
  if (persist) writePreference(LANGUAGE_KEY, language);
  if (updateUrl) {
    try {
      const url = new URL(location.href);
      url.searchParams.set("lang", language);
      history.replaceState(null, "", url);
    } catch { /* The translated page still works in restricted previews. */ }
  }
}

languageToggle.addEventListener("click", () => applyLanguage(language === "zh" ? "en" : "zh", { updateUrl: true }));
themeToggle.addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));

// Preferences are shared with the collection, including changes in another tab.
window.addEventListener("storage", (event) => {
  if (event.key === THEME_KEY) applyTheme(event.newValue, false);
  if (event.key === LANGUAGE_KEY && supportedLanguage(event.newValue)) {
    const urlLanguage = supportedLanguage(new URL(location.href).searchParams.get("lang")?.toLowerCase());
    if (!urlLanguage) applyLanguage(event.newValue, { persist: false });
  }
});

applyTheme(theme, false);
applyLanguage(language);
