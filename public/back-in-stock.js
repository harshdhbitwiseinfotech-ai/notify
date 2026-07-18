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

    injectForm(product, currentVariant);

    // Fetch button + low-stock settings from our app and apply them
    fetch(BACKEND_URL + "?shop=" + encodeURIComponent(shop))
      .then(function(res) { return res.json(); })
      .then(function(settings) {
        if (settings && !settings.error) {
          applyButtonSettings(settings);
          // Low stock widget
          if (settings.lowStockEnabled) {
            applyLowStockWidget(product, currentVariant, settings);
          }
        }
      })
      .catch(function(err) {
        console.warn("[BIS] Could not load button settings:", err);
      });

    updateUI(product, currentVariant);
    listenForVariantChanges(product, shop);
  }

  function applyButtonSettings(settings) {
    var btn = document.getElementById("bis-submit-btn");
    if (!btn) return;

    var p  = settings.buttonSize === "small" ? "6px 14px" : settings.buttonSize === "large" ? "14px 36px" : "10px 24px";
    var fz = settings.fontSize ? settings.fontSize + "px" : (settings.buttonSize === "small" ? "12px" : settings.buttonSize === "large" ? "18px" : "14px");

    btn.style.background   = settings.primaryColor || "#0061FF";
    btn.style.color        = settings.textColor    || "#ffffff";
    btn.style.borderRadius = (settings.borderRadius !== undefined ? settings.borderRadius : 6) + "px";
    btn.style.fontFamily   = settings.fontFamily   || "inherit";
    btn.style.fontSize     = fz;
    btn.style.padding      = p;
    btn.textContent        = settings.buttonText   || "Notify Me When Available";
    btn.dataset.defaultBg  = settings.primaryColor || "#0061FF";
  }

  // ── Low Stock Alert Widget ──────────────────────────────────────────────────
  var LOW_STOCK_ID = "bis-low-stock-alert";

  function applyLowStockWidget(product, currentVariant, settings) {
    // Inject custom CSS once
    if (settings.lowStockCustomCss) {
      var style = document.createElement("style");
      style.id  = "bis-low-stock-css";
      style.textContent = settings.lowStockCustomCss;
      document.head.appendChild(style);
    }

    // Render alert for the initial variant
    renderLowStockAlert(currentVariant, settings);

    // Re-render on variant changes
    document.addEventListener("variant:changed", function (e) {
      if (e.detail && e.detail.variant) {
        renderLowStockAlert(e.detail.variant, settings);
      }
    });

    // Also re-check on URL ?variant= changes via MutationObserver (already running)
    // We piggy-back by exposing a helper the MO can call:
    window._bisUpdateLowStock = function(variant) {
      renderLowStockAlert(variant, settings);
    };
  }

  function renderLowStockAlert(variant, settings) {
    // Remove existing alert
    var existing = document.getElementById(LOW_STOCK_ID);
    if (existing) existing.parentNode.removeChild(existing);

    if (!variant) return;

    var qty = variant.inventory_quantity;
    var threshold = settings.lowStockThreshold || 5;

    // Only show if inventory tracking is on, qty is available and <= threshold
    if (
      variant.inventory_management !== "shopify" ||
      !variant.available ||
      qty === null ||
      qty === undefined ||
      qty > threshold
    ) return;

    var message = (settings.lowStockMessage || "Only {{remaining_quantity}} items left in stock!")
      .replace("{{remaining_quantity}}", String(qty));

    var textColor = settings.lowStockTextColor || "#e32c2b";
    var iconColor = settings.lowStockIconColor || "#e32c2b";
    var showIcon  = settings.lowStockShowIcon !== false;

    var alertEl = document.createElement("div");
    alertEl.id  = LOW_STOCK_ID;
    alertEl.className = "low-stock-alert";
    alertEl.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:6px",
      "margin:8px 0",
      "padding:8px 12px",
      "background:" + textColor + "14",
      "border:1px solid " + textColor + "55",
      "border-radius:6px",
      "font-size:13px",
      "font-weight:500",
      "color:" + textColor,
      "font-family:inherit",
    ].join(";");

    if (showIcon) {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("fill", iconColor);
      svg.style.flexShrink = "0";
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M10 0a10 10 0 100 20A10 10 0 0010 0zm0 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm1-5H9V5h2v5z");
      svg.appendChild(path);
      alertEl.appendChild(svg);
    }

    var span = document.createElement("span");
    span.textContent = message;
    alertEl.appendChild(span);

    // Insert before the BIS form container, or before the Add-to-Cart button
    var bisContainer = document.getElementById(CONTAINER_ID);
    if (bisContainer && bisContainer.parentNode) {
      bisContainer.parentNode.insertBefore(alertEl, bisContainer);
    } else {
      // fallback: find add-to-cart button area
      var atcSelectors = [
        ".product-form__buttons",
        'button[name="add"]',
        ".product-form__submit",
        'form[action*="/cart/add"]',
      ];
      for (var i = 0; i < atcSelectors.length; i++) {
        var el = document.querySelector(atcSelectors[i]);
        if (el) { el.insertAdjacentElement("beforebegin", alertEl); break; }
      }
    }
  }

  // ── Build & inject the "Notify Me" form HTML ───────────────────────────────
  function injectForm(product, currentVariant) {
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
      '      style="display:block; width:100%; padding:14px;',
      '             background:#0061FF; color:#fff; border:none;',
      '             border-radius:6px; font-size:15px; font-weight:700;',
      '             letter-spacing:0.02em; cursor:pointer; font-family:inherit;',
      '             transition:background 0.2s, transform 0.15s;">',
      '      Notify Me When Available',
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
        if (!this.disabled) {
          var bg = this.dataset.defaultBg || "#0061FF";
          this.style.opacity = "0.8";
        }
      });
      submitBtn.addEventListener("mouseout", function () {
        if (!this.disabled) {
          this.style.opacity = "1";
        }
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
    if (btn) { 
       // Don't override textContent if settings were applied, but we don't have settings here easily.
       // It's safer to just enable it. The text is already what we want.
       if(btn.textContent === "Submitting…") {
           // We might need to restore it to the original text. Let's just restore if we know it.
           // Or just leave it as is, and on submit failure it's restored.
       }
       btn.disabled = false; 
    }

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
    if (submitBtn) { 
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = "Submitting…"; 
      submitBtn.disabled = true; 
    }
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
          if (submitBtn) { 
            var oldText = submitBtn.dataset.originalText || "Notify Me When Available";
            submitBtn.textContent = oldText; 
            submitBtn.disabled = false; 
          }
        }
      })
      .catch(function (err) {
        console.error("[BIS] Submit error:", err);
        if (msg) {
          msg.style.color = "#d82c0d";
          msg.style.display = "block";
          msg.textContent = "Network error. Please try again.";
        }
        if (submitBtn) { 
          var oldText = submitBtn.dataset.originalText || "Notify Me When Available";
          submitBtn.textContent = oldText; 
          submitBtn.disabled = false; 
        }
      });
  }

  // ── Entry point ────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

})();