/* The Long Light — interactions
   Progressive enhancement: the page is fully usable without this file. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Payment wall ------------------------------------------------------
     Watermark-free full-resolution files are NOT on this site; they are
     delivered only after purchase, via Razorpay Standard Checkout.
     PAYMENT_API_BASE is the origin hosting /api/create-order and
     /api/verify-payment (e.g. "https://the-long-light.vercel.app").
     On any *.vercel.app host the API is same-origin ("" = relative
     URLs, no CORS involved), which also covers deployment-preview
     domains. Prices live server-side in api/create-order.js; no key
     or amount is trusted from the browser. */
  var PAYMENT_API_BASE = /\.vercel\.app$/.test(window.location.hostname)
    ? ""
    : "https://the-long-light-xi.vercel.app";
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
    rebuildClones(); /* keep the endless-loop copies in sync with the filter */
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
  var lbStatus = document.getElementById("lb-status");
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
    lbStatus.textContent = "";
    /* mailto is the standing fallback href; the click handler upgrades
       it to Razorpay checkout when the payment API is available */
    lbBuy.href = "mailto:" + ENQUIRY_EMAIL +
      "?subject=" + encodeURIComponent("Purchase: " + data.title + " (The Long Light)") +
      "&body=" + encodeURIComponent("Hi Nisargi,\n\nI'd like to buy \"" + data.title + "\" - please send me the price for a print / full-resolution download.\n\nThanks!");
    /* display price only; the server (api/create-order.js) remains the
       source of truth for what is actually charged */
    lbBuy.textContent = canCheckout() ? "Buy full-resolution · ₹49" : "Buy print / full-res";
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

  /* --- Razorpay checkout -------------------------------------------------- */
  function canCheckout() {
    return typeof window.Razorpay === "function";
  }

  function setStatus(msg) {
    lbStatus.textContent = msg;
  }

  function startCheckout(data) {
    lbBuy.setAttribute("aria-disabled", "true");
    setStatus("Preparing secure checkout…");
    fetch(PAYMENT_API_BASE + "/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo: data.path, title: data.title })
    })
      .then(function (r) {
        if (!r.ok) throw new Error("create-order failed: " + r.status);
        return r.json();
      })
      .then(function (order) {
        setStatus("");
        var rzp = new window.Razorpay({
          key: order.key_id,
          order_id: order.order_id,
          amount: order.amount,
          currency: order.currency,
          name: "The Long Light",
          description: data.title,
          notes: { photo: data.path },
          theme: { color: "#df9542" },
          modal: {
            ondismiss: function () {
              lbBuy.removeAttribute("aria-disabled");
              setStatus("Checkout closed — you have not been charged.");
            }
          },
          handler: function (resp) {
            setStatus("Verifying payment…");
            fetch(PAYMENT_API_BASE + "/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature
              })
            })
              .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
              .then(function (v) {
                lbBuy.removeAttribute("aria-disabled");
                if (v.ok && v.body.verified) {
                  var dl = PAYMENT_API_BASE + "/api/download?order_id=" + encodeURIComponent(resp.razorpay_order_id) +
                    "&payment_id=" + encodeURIComponent(resp.razorpay_payment_id) +
                    "&signature=" + encodeURIComponent(resp.razorpay_signature) +
                    "&photo=" + encodeURIComponent(data.path);
                  var a = document.createElement("a");
                  a.href = dl; a.download = "";
                  document.body.appendChild(a); a.click(); a.remove();
                  lbStatus.innerHTML = "";
                  lbStatus.appendChild(document.createTextNode("Payment verified — your download is starting. "));
                  var link = document.createElement("a");
                  link.href = dl; link.textContent = "Download again"; link.style.color = "var(--accent)";
                  lbStatus.appendChild(link);
                } else {
                  setStatus("Payment received but could not be verified. Please email " + ENQUIRY_EMAIL + " with your payment id: " + resp.razorpay_payment_id);
                }
              })
              .catch(function () {
                lbBuy.removeAttribute("aria-disabled");
                setStatus("Could not verify the payment. Please email " + ENQUIRY_EMAIL + " with your payment id: " + resp.razorpay_payment_id);
              });
          }
        });
        rzp.on("payment.failed", function (resp) {
          lbBuy.removeAttribute("aria-disabled");
          var reason = resp && resp.error && resp.error.description ? " (" + resp.error.description + ")" : "";
          setStatus("Payment failed" + reason + ". You have not been charged — please try again.");
        });
        rzp.open();
      })
      .catch(function () {
        lbBuy.removeAttribute("aria-disabled");
        setStatus("Could not start checkout. Please email " + ENQUIRY_EMAIL + " instead.");
      });
  }

  lbBuy.addEventListener("click", function (e) {
    if (!canCheckout()) return; /* let the mailto fallback proceed */
    e.preventDefault();
    if (lbBuy.getAttribute("aria-disabled") === "true") return;
    startCheckout(shotData(activeList[activeIndex]));
  });

  shots.forEach(function (shot) {
    var btn = shot.querySelector(".shot__btn");
    btn.addEventListener("click", function () { openAt(shot); });
  });

  /* --- The endless reel ----------------------------------------------------
     The strip drifts forward on its own, forever: the visible frames are
     followed by aria-hidden clones, and when the scroll position passes one
     full set the reel snaps back invisibly. Clicking a clone opens the
     lightbox of its original, so the loop never breaks the buy flow.
     Hovering pauses the reel (focus mode); reduced motion disables drift. */
  var gallery = document.getElementById("gallery");
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var loopStart = 0, loopWidth = 0;

  function rebuildClones() {
    if (!gallery) return;
    Array.prototype.slice.call(gallery.querySelectorAll(".shot--clone")).forEach(function (n) { n.remove(); });
    var visible = shots.filter(function (s) { return !s.classList.contains("is-hidden"); });
    visible.forEach(function (orig) {
      var c = orig.cloneNode(true);
      c.classList.add("shot--clone", "is-in");
      c.style.transitionDelay = "";
      c.setAttribute("aria-hidden", "true");
      var b = c.querySelector(".shot__btn");
      if (b) {
        b.tabIndex = -1;
        b.addEventListener("click", function () { openAt(orig); });
      }
      gallery.appendChild(c);
    });
    var firstClone = gallery.querySelector(".shot--clone");
    loopStart = visible.length ? visible[0].offsetLeft : 0;
    loopWidth = firstClone ? firstClone.offsetLeft - loopStart : 0;
  }

  if (gallery) {
    rebuildClones();

    var reelPaused = false, reelPos = null, lastTick = null;
    function reelTick(t) {
      if (lastTick === null) lastTick = t;
      var dt = Math.min((t - lastTick) / 1000, 0.1);
      lastTick = t;
      if (reelPaused || document.hidden || !lb.hidden) {
        reelPos = gallery.scrollLeft;
      } else {
        if (reelPos === null) reelPos = gallery.scrollLeft;
        reelPos += 26 * dt; /* px per second */
        if (loopWidth > 0 && reelPos >= loopStart + loopWidth) reelPos -= loopWidth;
        gallery.scrollLeft = reelPos;
      }
      requestAnimationFrame(reelTick);
    }
    if (!reduceMotion) requestAnimationFrame(reelTick);

    gallery.addEventListener("pointerenter", function () { reelPaused = true; });
    gallery.addEventListener("pointerleave", function () { reelPaused = false; reelPos = gallery.scrollLeft; });
    var touchTimer = null;
    gallery.addEventListener("touchstart", function () {
      reelPaused = true;
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });
    gallery.addEventListener("touchend", function () {
      if (touchTimer) clearTimeout(touchTimer);
      touchTimer = setTimeout(function () { reelPaused = false; reelPos = gallery.scrollLeft; }, 2500);
    }, { passive: true });

    /* Reel-nav: prev / next buttons scroll the strip by one frame */
    var reelPrev = document.getElementById("reel-prev");
    var reelNext = document.getElementById("reel-next");
    function reelStep(dir) {
      /* find the width of one shot (first visible) to step by */
      var first = gallery.querySelector(".shot:not(.is-hidden):not(.shot--clone)");
      var step = first ? first.offsetWidth + 8 : 400; /* 8 ≈ margin gap */
      reelPaused = true;
      gallery.scrollBy({ left: dir * step, behavior: "smooth" });
      reelPos = null; /* resync drift position after manual scroll */
      clearTimeout(touchTimer);
      touchTimer = setTimeout(function () { reelPaused = false; reelPos = gallery.scrollLeft; }, 2000);
    }
    if (reelPrev) reelPrev.addEventListener("click", function () { reelStep(-1); });
    if (reelNext) reelNext.addEventListener("click", function () { reelStep(1); });
  }

  /* --- Focus mode + camera-lens cursor ------------------------------------
     Hovering the reel dims the rest of the page (fixed overlay under the
     lit table) and turns the cursor into a lens; clicking fires a shutter
     blink. Desktop pointers without reduced-motion only. */
  var dimOverlay = document.getElementById("dim-overlay");
  if (gallery && finePointer && !reduceMotion) {
    var loupe = document.createElement("div");
    loupe.className = "loupe";
    loupe.setAttribute("aria-hidden", "true");
    gallery.appendChild(loupe);
    var loupeRaf = null;
    gallery.addEventListener("pointermove", function (e) {
      if (loupeRaf) return;
      loupeRaf = requestAnimationFrame(function () {
        loupeRaf = null;
        var r = gallery.getBoundingClientRect();
        loupe.style.transform =
          "translate3d(" + (e.clientX - r.left + gallery.scrollLeft - 34) + "px," +
          (e.clientY - r.top - 34) + "px,0)";
        loupe.classList.add("is-on");
      });
    });
    gallery.addEventListener("pointerenter", function () {
      document.body.classList.add("reel-focus");
      gallery.classList.add("is-focus");
    });
    gallery.addEventListener("pointerleave", function () {
      document.body.classList.remove("reel-focus");
      gallery.classList.remove("is-focus");
      loupe.classList.remove("is-on");
    });
    gallery.addEventListener("pointerdown", function () {
      loupe.classList.remove("is-snap");
      void loupe.offsetWidth; /* restart the animation */
      loupe.classList.add("is-snap");
    });
  }

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
