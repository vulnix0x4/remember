try {
  const saved = localStorage.getItem("remember-theme");
  document.documentElement.dataset.theme = saved === "light" || saved === "dark"
    ? saved
    : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}
