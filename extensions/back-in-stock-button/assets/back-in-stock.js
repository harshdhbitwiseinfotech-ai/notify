/**
 * Back In Stock — Storefront JavaScript
 * File: extensions/back-in-stock-button/assets/back-in-stock.js
 *
 * Handles:
 *  - Opening/closing the modal
 *  - Reading product + variant data from the page
 *  - Submitting email to /api/notify-me
 *  - Showing success/error states
 */

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────
  const OVERLAY_ID = "bis-overlay";
  const FORM_ID = "bis-form";

  // ── State ──────────────────────────────────────────────────────────────────
  let currentVariantId = null;
  let currentProductId = null;
  let currentProductTitle = null;
  let currentVariantTitle = null;

  // ── DOM Helpers ────────────────────────────────────────────────────────────
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function openModal() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    // Reset to form view
    showFormView(overlay);
    // Focus email input
    setTimeout(() => {
      const emailInput = overlay.querySelector("#bis-email");
      if (emailInput) emailInput.focus();
    }, 300);
  }

  function closeModal() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    resetForm(overlay);
  }

  function showFormView(overlay) {
    const formSection = overlay.querySelector(".bis-form-section");
    const successSection = overlay.querySelector(".bis-success");
    if (formSection) formSection.style.display = "";
    if (successSection) successSection.classList.remove("is-visible");
  }

  function showSuccessView(overlay, email) {
    const formSection = overlay.querySelector(".bis-form-section");
    const successSection = overlay.querySelector(".bis-success");
    const successEmail = overlay.querySelector(".bis-success__email");
    if (formSection) formSection.style.display = "none";
    if (successSection) successSection.classList.add("is-visible");
    if (successEmail) successEmail.textContent = email;
  }

  function resetForm(overlay) {
    const form = overlay.querySelector("#" + FORM_ID);
    if (form) form.reset();
    const emailInput = overlay.querySelector("#bis-email");
    const emailError = overlay.querySelector("#bis-email-error");
    if (emailInput) emailInput.classList.remove("has-error");
    if (emailError) emailError.classList.remove("is-visible");
  }

  // ── Variant tracking ───────────────────────────────────────────────────────
  /**
   * Read currently selected variant from the page.
   * Works with Shopify's standard variant selector (select element or
   * variant radio buttons used in Dawn / most themes).
   */
  function readCurrentVariant() {
    // 1. Try URL param ?variant=xxx
    const urlParams = new URLSearchParams(window.location.search);
    const variantFromUrl = urlParams.get("variant");
    if (variantFromUrl) return variantFromUrl;

    // 2. Try <select name="id"> (classic themes)
    const selectEl = document.querySelector('select[name="id"]');
    if (selectEl && selectEl.value) return selectEl.value;

    // 3. Try checked radio with name="id"
    const checkedRadio = document.querySelector('input[name="id"]:checked');
    if (checkedRadio) return checkedRadio.value;

    // 4. Try data attribute on product form
    const productForm = document.querySelector("[data-product-id]");
    if (productForm) {
      const variantInput = productForm.querySelector('input[name="id"]');
      if (variantInput) return variantInput.value;
    }

    // 5. Fallback to first variant in shopify global
    if (window.ShopifyAnalytics?.meta?.selectedVariantId) {
      return window.ShopifyAnalytics.meta.selectedVariantId;
    }

    return null;
  }

  function readVariantTitle() {
    // Try the currently selected options from Dawn / standard themes
    const optionValues = [];
    document.querySelectorAll(".product-form__input input:checked, .product-form__input option:checked, .swatch-input:checked").forEach((el) => {
      const val = el.value || el.dataset.value;
      if (val) optionValues.push(val);
    });
    if (optionValues.length) return optionValues.join(" / ");

    // Fallback: selected option labels in <select>s
    document.querySelectorAll('select[name^="option"]').forEach((sel) => {
      const opt = sel.options[sel.selectedIndex];
      if (opt) optionValues.push(opt.text);
    });
    if (optionValues.length) return optionValues.join(" / ");

    return "Default";
  }

  // ── Populate modal product info ────────────────────────────────────────────
  function populateModalProduct(overlay) {
    const titleEl = overlay.querySelector(".bis-modal__product-title");
    const variantEl = overlay.querySelector(".bis-modal__product-variant");
    const imgEl = overlay.querySelector(".bis-modal__product-img");
    const variantIdInput = overlay.querySelector("#bis-variant-id");
    const productIdInput = overlay.querySelector("#bis-product-id");
    const productTitleInput = overlay.querySelector("#bis-product-title");
    const variantTitleInput = overlay.querySelector("#bis-variant-title");

    // Update current variant (may have changed since page load)
    const vid = readCurrentVariant() || currentVariantId;
    const vTitle = readVariantTitle() || currentVariantTitle;

    if (titleEl) titleEl.textContent = currentProductTitle || document.title;
    if (variantEl) variantEl.textContent = vTitle || "";
    if (variantIdInput) variantIdInput.value = vid || "";
    if (productIdInput) productIdInput.value = currentProductId || "";
    if (productTitleInput)
      productTitleInput.value = currentProductTitle || document.title;
    if (variantTitleInput) variantTitleInput.value = vTitle || "";

    // Try to get image from the page
    if (imgEl) {
      const featuredImg = document.querySelector(
        ".product__media img, .product-featured-media img, .product-single__media img"
      );
      if (featuredImg) {
        imgEl.src = featuredImg.src;
        imgEl.alt = currentProductTitle || "";
        imgEl.style.display = "";
      } else {
        imgEl.style.display = "none";
      }
    }
  }

  // ── API call ───────────────────────────────────────────────────────────────
  async function submitSubscription(overlay) {
    const emailInput = overlay.querySelector("#bis-email");
    const emailError = overlay.querySelector("#bis-email-error");
    const submitBtn = overlay.querySelector(".bis-form__submit");
    const spinner = overlay.querySelector(".bis-spinner");
    const btnText = overlay.querySelector(".bis-btn-text");

    const email = emailInput ? emailInput.value.trim() : "";

    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      if (emailInput) emailInput.classList.add("has-error");
      if (emailError) emailError.classList.add("is-visible");
      emailInput.focus();
      return;
    }

    // Clear errors
    if (emailInput) emailInput.classList.remove("has-error");
    if (emailError) emailError.classList.remove("is-visible");

    // Loading state
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = "inline-block";
    if (btnText) btnText.textContent = "Subscribing…";

    try {
      const shopDomain =
        window.Shopify?.shop ||
        overlay.dataset.shop ||
        window.location.hostname;

      const payload = {
        shop: shopDomain,
        email,
        productId: overlay.querySelector("#bis-product-id")?.value || "",
        variantId: overlay.querySelector("#bis-variant-id")?.value || "",
        productTitle: overlay.querySelector("#bis-product-title")?.value || "",
        variantTitle: overlay.querySelector("#bis-variant-title")?.value || "",
      };

      // API endpoint — app proxy or direct app URL
      const apiUrl =
        overlay.dataset.apiUrl || "/apps/back-in-stock/api/notify-me";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showSuccessView(overlay, email);
      } else {
        const errorMsg =
          overlay.querySelector(".bis-form-error-msg");
        if (errorMsg) {
          errorMsg.textContent =
            json.error || "Something went wrong. Please try again.";
          errorMsg.style.display = "block";
        }
      }
    } catch (err) {
      console.error("[Back In Stock] Submit error:", err);
      const errorMsg = overlay.querySelector(".bis-form-error-msg");
      if (errorMsg) {
        errorMsg.textContent = "Network error. Please check your connection.";
        errorMsg.style.display = "block";
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = "none";
      if (btnText) btnText.textContent = "Notify Me";
    }
  }

  // ── Wire up events ─────────────────────────────────────────────────────────
  function init() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    // Read product data from overlay dataset (set by liquid block)
    currentProductId = overlay.dataset.productId || "";
    currentProductTitle = overlay.dataset.productTitle || "";
    currentVariantId = overlay.dataset.variantId || readCurrentVariant() || "";
    currentVariantTitle = overlay.dataset.variantTitle || readVariantTitle() || "";

    // Close on overlay background click
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });

    // Close button
    overlay.querySelectorAll(".bis-close, .bis-success__close-btn").forEach((btn) => {
      btn.addEventListener("click", closeModal);
    });

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    // Form submit
    const form = document.getElementById(FORM_ID);
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitSubscription(overlay);
      });
    }

    // Open triggers — any element with class `bis-open-modal`
    document.querySelectorAll(".bis-open-modal").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        // Re-read variant in case customer changed options
        currentVariantId = readCurrentVariant() || currentVariantId;
        currentVariantTitle = readVariantTitle() || currentVariantTitle;
        populateModalProduct(overlay);
        openModal();
      });
    });

    // Listen for variant changes (Dawn / standard themes fire this custom event)
    document.addEventListener("variant:changed", function (e) {
      const variant = e.detail?.variant;
      if (variant) {
        currentVariantId = String(variant.id);
        currentVariantTitle = variant.title || "";
      }
    });

    // Also watch select changes
    document.querySelectorAll('select[name="id"]').forEach((sel) => {
      sel.addEventListener("change", function () {
        currentVariantId = this.value;
      });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
