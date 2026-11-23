const STORAGE_KEY = "rejet_dark_mode";

export function isDarkMode(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setDarkMode(enabled: boolean): void {
  if (enabled) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function applySavedDarkMode(): void {
  setDarkMode(isDarkMode());
}
