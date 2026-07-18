/* theme.js — wires the light/dark toggle button. The initial data-theme is
   set by a tiny inline <head> script (before paint, no flash); this only
   handles the click + persistence. Shared by index.html and cart.html. */
(function () {
  "use strict";
  var KEY = "tll_theme";
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var next = (root.getAttribute("data-theme") === "light") ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();
