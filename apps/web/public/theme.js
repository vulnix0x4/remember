try {
  document.documentElement.dataset.theme = localStorage.getItem("remember-theme") === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}
