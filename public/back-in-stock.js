/**
 * Back In Stock — Storefront Widget
 * ===================================
 * Loaded via:
 *   A) Shopify ScriptTag (automatic, all stores, no theme steps needed)
 *   B) App Embed block (manual enable in theme editor, fallback)
 *
 * When loaded via ScriptTag, window.BIS may not be set yet, so we detect
 * the product page via the Shopify global and fetch product JSON ourselves.
 */
(function () {
  "use strict";

  var CONTAINER_ID = "bis-notify-container";
  var BACKEND_URL = "/apps/back-in-stock/api/notify-me";

  // ── Already injected guard ─────────────────────────────────────────────────
  if (document.getElementById(CONTAINER_ID)) return;

  // ── Only run on product pages ──────────────────────────────────────────────
  // Check via Shopify global (available on all themes) or meta tag or URL
  function isProductPage() {
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta &&
        window.ShopifyAnalytics.meta.page &&
        window.ShopifyAnalytics.meta.page.pageType === "product") {
      return true;
    }
    if (window.meta && window.meta.page && window.meta.page.pageType === "product") {
      return true;
    }
    // URL based detection
    var path = window.location.pathname;
    return /\/products\/[^\/]+/.test(path);
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  function bootstrap() {
    if (!isProductPage()) return;

    // Case A: App embed already populated window.BIS
    if (window.BIS && window.BIS.product) {
      startWidget(window.BIS.product, window.BIS.currentVariant, window.BIS.shop);
      return;
    }

    // Case B: ScriptTag loaded — fetch product JSON from Shopify
    fetchProductAndStart();
  }

  // ── Fetch product data via Shopify's built-in product.js endpoint ──────────
  function fetchProductAndStart() {
    // Extract handle from URL: /products/<handle>
    var match = window.location.pathname.match(/\/products\/([^\/\?#]+)/);
    if (!match) return;
    var handle = match[1];

    fetch("/products/" + handle + ".js")
      .then(function (res) { return res.json(); })
      .then(function (product) {
        var shop = (
          (window.BIS && window.BIS.shop) ||
          (window.Shopify && window.Shopify.shop) ||
          window.location.hostname
        ).toLowerCase().trim();

        // Pick the selected variant from URL or first available
        var urlParams = new URLSearchParams(window.location.search);
        var variantId = urlParams.get("variant");
        var currentVariant = null;
        if (variantId && product.variants) {
          currentVariant = product.variants.find(function (v) {
            return String(v.id) === variantId;
          });
        }
        if (!currentVariant && product.variants && product.variants.length > 0) {
          currentVariant = product.variants[0];
        }

        startWidget(product, currentVariant, shop);
      })
      .catch(function (err) {
        console.warn("[BIS] Could not load product.js:", err);
      });
  }

  // ── Main widget logic ──────────────────────────────────────────────────────
  function startWidget(product, currentVariant, shop) {
    if (document.getElementById(CONTAINER_ID)) return; // already injected

    fetch(BACKEND_URL + "?shop=" + encodeURIComponent(shop))
      .then(function(res) { return res.json(); })
      .then(function(settings) {
        injectForm(product, currentVariant, settings);
        updateUI(product, currentVariant);
        listenForVariantChanges(product, shop);
      })
      .catch(function(err) {
        console.warn("[BIS] Error fetching button settings:", err);
        injectForm(product, currentVariant, null);
        updateUI(product, currentVariant);
        listenForVariantChanges(product, shop);
      });
  }

  // ── Build & inject the "Notify Me" form HTML ───────────────────────────────
  function injectForm(product, currentVariant, settings) {
    var btnText = (settings && settings.buttonText) ? settings.buttonText : "Notify Me When Available";
    var btnBg = (settings && settings.primaryColor) ? settings.primaryColor : "#0061FF";
    var btnTextCol = (settings && settings.textColor) ? settings.textColor : "#fff";
    var btnRadius = (settings && settings.borderRadius !== undefined) ? settings.borderRadius + "px" : "6px";
    var btnSize = (settings && settings.fontSize) ? settings.fontSize + "px" : "15px";
    var btnFont = (settings && settings.fontFamily) ? settings.fontFamily : "inherit";
    
    // Determine padding based on settings buttonSize
    var btnPadding = "14px";
    if (settings && settings.buttonSize === "small") btnPadding = "8px 14px";
    if (settings && settings.buttonSize === "large") btnPadding = "16px 24px";

    var formHtml = [
      '<div id="' + CONTAINER_ID + '" style="display:none; margin:16px 0;">',
      '  <div id="bis-form-wrap" style="display:block;">',
      '    <input type="email" id="bis-email"',
      '      autocomplete="email"',
      '      placeholder="Enter your email address"',
      '      style="display:block; width:100%; padding:12px 14px;',
      '             border:2px solid #e0e0e0; border-radius:6px;',
      '             font-size:15px; box-sizing:border-box;',
      '             margin-bottom:10px; font-family:inherit;',
      '             outline:none; background:#fff; color:#1a1a1a;">',
      '    <button id="bis-submit-btn" type="button"',
      '      style="display:block; width:100%; padding:' + btnPadding + ';',
      '             background:' + btnBg + '; color:' + btnTextCol + '; border:none;',
      '             border-radius:' + btnRadius + '; font-size:' + btnSize + '; font-weight:700;',
      '             letter-spacing:0.02em; cursor:pointer; font-family:' + btnFont + ';',
      '             transition:background 0.2s, transform 0.15s;">',
      '      ' + btnText,
      '    </button>',
      '  </div>',
      '  <p id="bis-status-msg" style="display:none; margin-top:10px;',
      '     font-weight:600; font-size:14px; text-align:center;"></p>',
      "</div>",
    ].join("\n");

    // Ordered list of insertion points — covers Dawn, Debut, Tinker, Prestige,
    // Brooklyn, Narrative, Sense, Refresh, Crave, Empire, and more
    var insertAfterSelectors = [
      ".product__info-container .product-form__buttons",
      ".product-form__buttons",
      ".product__purchase-options",
      ".product__purchase",
      ".product__actions",
      ".product__buy-buttons",
      ".product-form__submit-wrap",
      ".product-form__payment-button",
      ".product-single__add-to-cart",
      ".product-single__purchase",
      'form[action*="/cart/add"]',
      ".shopify-payment-button",
      ".product__form-wrapper",
    ];

    var inserted = false;
    for (var i = 0; i < insertAfterSelectors.length; i++) {
      var el = document.querySelector(insertAfterSelectors[i]);
      if (el) {
        el.insertAdjacentHTML("afterend", formHtml);
        inserted = true;
        break;
      }
    }

    // Absolute fallback — find any product-info wrapper or use body
    if (!inserted) {
      var fallback = document.querySelector(
        ".product__info-container, .product-single__meta, " +
        "[data-section-type='product'], .product-template, " +
        ".product-main, .product-details, main"
      ) || document.body;
      fallback.insertAdjacentHTML("beforeend", formHtml);
    }

    // Store data on the container
    var container = document.getElementById(CONTAINER_ID);
    if (container) {
      container.dataset.productId   = product.id;
      container.dataset.productTitle = product.title;
      container.dataset.variantId   = currentVariant ? currentVariant.id : "";
      container.dataset.variantTitle = currentVariant ? currentVariant.title : "";
    }

    // Button event listeners
    var submitBtn = document.getElementById("bis-submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", function () { handleSubmit(product); });
      submitBtn.addEventListener("mouseover", function () {
        if (!this.disabled) this.style.background = "#0047CC";
      });
      submitBtn.addEventListener("mouseout", function () {
        if (!this.disabled) this.style.background = "#0061FF";
      });
    }
  }

  // ── Show/hide the form based on variant stock ──────────────────────────────
  function updateUI(product, variant) {
    if (!variant) return;

    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    // Update stored variant data
    container.dataset.variantId    = variant.id;
    container.dataset.variantTitle = variant.title || "";

    var isSoldOut = !variant.available;

    container.style.display = isSoldOut ? "block" : "none";

    // Reset the form to original state on every variant change
    var formWrap = document.getElementById("bis-form-wrap");
    if (formWrap) formWrap.style.display = "block";
    var emailInput = document.getElementById("bis-email");
    if (emailInput) emailInput.value = "";
    var msg = document.getElementById("bis-status-msg");
    if (msg) { msg.style.display = "none"; msg.textContent = ""; }
    var btn = document.getElementById("bis-submit-btn");
    if (btn) { btn.textContent = "Notify Me When Available"; btn.disabled = false; }

    // Hide / show native Add-to-Cart + Buy Now buttons
    toggleNativeButtons(isSoldOut);
  }

  function toggleNativeButtons(hide) {
    var display = hide ? "none" : "";
    [
      'button[name="add"]',
      'button[type="submit"].product-form__submit',
      ".product-form__submit",
      ".btn--add-to-cart",
      ".product__submit-button",
      ".product-form__cart-submit",
      'input[type="submit"][name="add"]',
    ].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.setProperty("display", display, "important");
      });
    });
    document.querySelectorAll(".shopify-payment-button").forEach(function (el) {
      el.style.setProperty("display", display, "important");
    });
  }

  // ── Listen for variant changes (covers all theme patterns) ─────────────────
  function listenForVariantChanges(product, shop) {
    // 1. Shopify's custom event (used by Dawn, Prestige, many others)
    document.addEventListener("variant:changed", function (e) {
      if (e.detail && e.detail.variant) updateUI(product, e.detail.variant);
    });

    // 2. URL ?variant= change (Dawn SPA-style navigation)
    var lastUrl = location.href;
    new MutationObserver(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        checkUrlVariant(product);
      }
    }).observe(document.body, { childList: true, subtree: true });

    // 3. Cart form change (older themes that don't update URL)
    document.querySelectorAll('form[action*="/cart/add"]').forEach(function (form) {
      form.addEventListener("change", function () {
        setTimeout(function () { checkUrlVariant(product); }, 200);
      });
    });

    // 4. Theme editor re-render (live preview)
    document.addEventListener("shopify:section:load", function () {
      if (!document.getElementById(CONTAINER_ID)) {
        startWidget(product, getCurrentVariant(product), shop);
      }
    });
  }

  function checkUrlVariant(product) {
    var params = new URLSearchParams(window.location.search);
    var vid = params.get("variant");
    if (vid && product.variants) {
      var found = product.variants.find(function (v) {
        return String(v.id) === vid;
      });
      if (found) updateUI(product, found);
    }
  }

  function getCurrentVariant(product) {
    var params = new URLSearchParams(window.location.search);
    var vid = params.get("variant");
    if (vid && product.variants) {
      var found = product.variants.find(function (v) {
        return String(v.id) === vid;
      });
      if (found) return found;
    }
    return (product.variants && product.variants[0]) || null;
  }

  // ── Form submission ────────────────────────────────────────────────────────
  function handleSubmit(product) {
    var container  = document.getElementById(CONTAINER_ID);
    var emailInput = document.getElementById("bis-email");
    var msg        = document.getElementById("bis-status-msg");
    var formWrap   = document.getElementById("bis-form-wrap");
    var submitBtn  = document.getElementById("bis-submit-btn");

    if (!emailInput || !container) return;

    var email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.style.borderColor = "#d82c0d";
      emailInput.focus();
      return;
    }
    emailInput.style.borderColor = "#e0e0e0";

    var variantId    = container.dataset.variantId;
    var productId    = container.dataset.productId;
    var productTitle = container.dataset.productTitle || product.title;
    var variantTitle = container.dataset.variantTitle || "";

    // Build GIDs
    var productGid = String(productId).startsWith("gid://")
      ? String(productId)
      : "gid://shopify/Product/" + productId;
    var variantGid = String(variantId).startsWith("gid://")
      ? String(variantId)
      : "gid://shopify/ProductVariant/" + variantId;

    var shop = (
      (window.BIS && window.BIS.shop) ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname
    ).toLowerCase().trim();

    // Loading state
    if (submitBtn) { submitBtn.textContent = "Submitting…"; submitBtn.disabled = true; }
    if (msg) msg.style.display = "none";

    fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: shop,
        email: email,
        productId: productGid,
        variantId: variantGid,
        productTitle: productTitle,
        variantTitle: variantTitle,
      }),
    })
      .then(function (res) {
        var ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          throw new Error("App Proxy not configured. Contact support.");
        }
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          if (formWrap) formWrap.style.display = "none";
          if (msg) {
            msg.style.color = "#008060";
            msg.style.display = "block";
            msg.textContent = "✓ You'll be notified when it's back in stock!";
          }
        } else {
          if (msg) {
            msg.style.color = "#d82c0d";
            msg.style.display = "block";
            msg.textContent = result.data.error || result.data.message || "Something went wrong.";
          }
          if (submitBtn) { submitBtn.textContent = "Notify Me When Available"; submitBtn.disabled = false; }
        }
      })
      .catch(function (err) {
        console.error("[BIS] Submit error:", err);
        if (msg) {
          msg.style.color = "#d82c0d";
          msg.style.display = "block";
          msg.textContent = "Network error. Please try again.";
        }
        if (submitBtn) { submitBtn.textContent = "Notify Me When Available"; submitBtn.disabled = false; }
      });
  }

  // ── Entry point ────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

})();