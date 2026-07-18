/* smooth.js — buttery page scrolling via Lenis (loaded from CDN).
   - Disabled entirely under prefers-reduced-motion.
   - The horizontal film reel keeps its own wheel handling: the #gallery
     carries data-lenis-prevent so Lenis ignores wheel over it.
   - If Lenis fails to load, the page just scrolls natively. */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.Lenis !== "function") return;

  var gallery = document.getElementById("gallery");
  if (gallery) gallery.setAttribute("data-lenis-prevent", "");

  var lenis = new window.Lenis({
    duration: 1.05,
    easing: function (t) { return 1 - Math.pow(1 - t, 4); }, /* ease-out-quart */
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4
  });

  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  /* smooth-scroll in-page anchor links too */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -10 });
  });
})();
