/* =============================================================
   cart.js — The Long Light cart state
   Shared between index.html and cart.html
   Cart item: { path, title, thumb, price }
   ============================================================= */
(function () {
  "use strict";

  var CART_KEY = "tll_cart";
  var PRICE_PER_PHOTO = 49;

  /* ---- Core state ---- */
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart:update", { detail: { items: items } }));
  }

  var Cart = {
    get: readCart,
    count: function () { return readCart().length; },
    total: function () { return readCart().length * PRICE_PER_PHOTO; },
    inCart: function (path) {
      return readCart().some(function (i) { return i.path === path; });
    },
    add: function (item) {
      var items = readCart();
      if (!items.some(function (i) { return i.path === item.path; })) {
        items.push(item);
        writeCart(items);
        return true;
      }
      return false; /* already in cart */
    },
    remove: function (path) {
      var items = readCart().filter(function (i) { return i.path !== path; });
      writeCart(items);
    },
    clear: function () { writeCart([]); }
  };

  window.TLLCart = Cart;
})();
