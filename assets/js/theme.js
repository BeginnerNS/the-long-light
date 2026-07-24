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

  /* Mobile nav menu (burger). The menu panel collapses < 680px; this toggles
     it. Work/About/Prints live inside; the toggle + cart stay in the bar. */
  var burger = document.getElementById("nav-burger");
  var menu = document.getElementById("nav-menu");
  if (burger && menu) {
    var setOpen = function (open) {
      menu.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!menu.classList.contains("is-open"));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (menu.classList.contains("is-open") && !menu.contains(e.target) && e.target !== burger) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setOpen(false); burger.focus(); }
    });
  }
})();
