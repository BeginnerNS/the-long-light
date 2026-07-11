/* The Long Light — interactions
   Progressive enhancement: the page is fully usable without this file. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Payment wall ------------------------------------------------------
     Watermark-free full-resolution files are NOT on this site; they are
     delivered only after purchase. Map each image path to its payment link
     (Razorpay / Gumroad / Payhip product URL). Any photo without a link
     falls back to an email enquiry. */
  var PAYMENT_LINKS = {
    /* "assets/img/IMG20260604153249.jpg": "https://your-payment-link", */
  };
  var ENQUIRY_EMAIL = "nisargi3112@gmail.com";

  /* --- Download deterrence ------------------------------------------------
     Blocks right-click-save and drag-to-save on photographs. (Determined
     visitors can still screenshot; the baked-in watermark is the real
     protection - clean files exist only behind the purchase flow.) */
  document.addEventListener("contextmenu", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  /* --- Footer year ------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* --- Nav: condense on scroll ------------------------------------------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* --- Scroll reveal ----------------------------------------------------- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.style.transitionDelay = (Math.min(i, 4) * 60) + "ms";
          el.classList.add("is-in");
          io.unobserve(el);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* --- Gallery filtering -------------------------------------------------- */
  var filters = Array.prototype.slice.call(document.querySelectorAll(".filter"));
  var shots = Array.prototype.slice.call(document.querySelectorAll(".shot"));
  var emptyMsg = document.getElementById("gallery-empty");
  var currentFilter = "all";

  function applyFilter(value) {
    currentFilter = value;
    var visible = 0;
    shots.forEach(function (shot) {
      var match = value === "all" || shot.getAttribute("data-cat") === value;
      shot.classList.toggle("is-hidden", !match);
      if (match) visible++;
    });
    if (emptyMsg) emptyMsg.hidden = visible !== 0;
    filters.forEach(function (btn) {
      var active = btn.getAttribute("data-filter") === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyFilter(btn.getAttribute("data-filter"));
    });
  });

  /* --- Lightbox ---------------------------------------------------------- */
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lb-img");
  var lbTitle = document.getElementById("lb-title");
  var lbCount = document.getElementById("lb-count");
  var lbClose = document.getElementById("lb-close");
  var lbPrev = document.getElementById("lb-prev");
  var lbNext = document.getElementById("lb-next");
  var lbBuy = document.getElementById("lb-buy");
  var lastFocused = null;
  var activeList = [];
  var activeIndex = 0;

  function shotData(shot) {
    var img = shot.querySelector("img");
    var titleEl = shot.querySelector(".shot__title");
    return {
      full: img.getAttribute("data-full") || img.src,
      path: img.getAttribute("src"),
      alt: img.getAttribute("alt") || "",
      title: titleEl ? titleEl.textContent : ""
    };
  }

  function render() {
    var shot = activeList[activeIndex];
    if (!shot) return;
    var data = shotData(shot);
    if (reduceMotion) {
      lbImg.src = data.full; lbImg.alt = data.alt;
    } else {
      lbImg.style.opacity = "0";
      var pre = new Image();
      pre.onload = function () {
        lbImg.src = data.full; lbImg.alt = data.alt; lbImg.style.opacity = "1";
      };
      pre.src = data.full;
      if (pre.complete) pre.onload();
    }
    lbTitle.textContent = data.title;
    lbCount.textContent = (activeIndex + 1) + " / " + activeList.length;
    var payLink = PAYMENT_LINKS[data.path];
    if (payLink) {
      lbBuy.href = payLink;
      lbBuy.textContent = "Buy full-resolution";
    } else {
      lbBuy.href = "mailto:" + ENQUIRY_EMAIL +
        "?subject=" + encodeURIComponent("Purchase: " + data.title + " (The Long Light)") +
        "&body=" + encodeURIComponent("Hi Nisargi,\n\nI'd like to buy \"" + data.title + "\" - please send me the price for a print / full-resolution download.\n\nThanks!");
      lbBuy.textContent = "Buy print / full-res";
    }
    var single = activeList.length < 2;
    lbPrev.style.visibility = single ? "hidden" : "visible";
    lbNext.style.visibility = single ? "hidden" : "visible";
  }

  function openAt(shot) {
    activeList = shots.filter(function (s) { return !s.classList.contains("is-hidden"); });
    activeIndex = activeList.indexOf(shot);
    if (activeIndex < 0) activeIndex = 0;
    lastFocused = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { lb.classList.add("is-open"); });
    render();
    lbClose.focus();
  }

  function closeLightbox() {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
    var finish = function () {
      lb.hidden = true;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    };
    if (reduceMotion) finish();
    else setTimeout(finish, 320);
  }

  function step(dir) {
    if (activeList.length < 2) return;
    activeIndex = (activeIndex + dir + activeList.length) % activeList.length;
    render();
  }

  shots.forEach(function (shot) {
    var btn = shot.querySelector(".shot__btn");
    btn.addEventListener("click", function () { openAt(shot); });
  });

  lbClose.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", function () { step(-1); });
  lbNext.addEventListener("click", function () { step(1); });
  lb.addEventListener("click", function (e) {
    if (e.target === lb || e.target.classList.contains("lightbox__stage")) closeLightbox();
  });

  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {
      var focusables = [lbClose, lbPrev, lbBuy, lbNext].filter(function (el) { return el.style.visibility !== "hidden"; });
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
