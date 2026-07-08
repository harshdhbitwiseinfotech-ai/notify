document.addEventListener("DOMContentLoaded", function () {
  if (!window.BIS || !window.BIS.product) return;

  const product = window.BIS.product;
  let currentVariant = window.BIS.currentVariant;

  // Generate the HTML for the form
  const formHtml = `
    <div id="bis-dynamic-container" style="margin-top: 15px; margin-bottom: 15px; display: none;">
      <form id="back-in-stock-form">
        <input type="hidden" id="bis-product-id" value="gid://shopify/Product/${product.id}">
        <input type="hidden" id="bis-variant-id" value="gid://shopify/ProductVariant/${currentVariant.id}">
        <input type="hidden" id="bis-product-name" value="${product.title.replace(/"/g, '&quot;')}">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <input 
            type="email" 
            id="bis-email" 
            placeholder="Enter your email address" 
            required
            style="padding: 12px; width: 100%; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; box-sizing: border-box;"
          >
          <button type="submit" style="width: 100%; padding: 14px; background-color: #0061FF; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;">
            Notify Me When Available
          </button>
        </div>
      </form>
      <p id="bis-message" style="display:none; margin-top: 10px; font-weight: bold; font-size: 14px; text-align: center;"></p>
    </div>
  `;

  // Find the add to cart button / form
  const addToCartForms = document.querySelectorAll('form[action*="/cart/add"]');
  if (addToCartForms.length === 0) return;

  const mainForm = addToCartForms[0];
  
  // Inject our container right after the Add to Cart form
  mainForm.insertAdjacentHTML('afterend', formHtml);
  
  const bisContainer = document.getElementById("bis-dynamic-container");
  const bisVariantInput = document.getElementById("bis-variant-id");
  const bisForm = document.getElementById("back-in-stock-form");
  const messageElement = document.getElementById("bis-message");

  // Function to update UI based on variant availability
  function updateUI(variant) {
    if (!variant) return;
    currentVariant = variant;
    bisVariantInput.value = `gid://shopify/ProductVariant/${variant.id}`;

    const addToCartButton = mainForm.querySelector('button[name="add"], button[type="submit"]');
    const paymentButton = document.querySelector('.shopify-payment-button');

    if (variant.available) {
      // Product is IN STOCK
      bisContainer.style.display = 'none';
      if (addToCartButton) addToCartButton.style.display = '';
      if (paymentButton) paymentButton.style.display = '';
    } else {
      // Product is OUT OF STOCK
      bisContainer.style.display = 'block';
      if (addToCartButton) addToCartButton.style.display = 'none';
      if (paymentButton) paymentButton.style.display = 'none';
    }
  }

  // Initial check
  updateUI(currentVariant);

  // Listen for variant changes by monitoring URL
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      const urlParams = new URLSearchParams(window.location.search);
      const variantId = urlParams.get('variant');
      if (variantId) {
        const variant = product.variants.find(v => v.id.toString() === variantId);
        if (variant) updateUI(variant);
      }
    }
  }).observe(document, {subtree: true, childList: true});

  // Handle form submission
  if (bisForm) {
    bisForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = document.getElementById("bis-email").value;
      const productId = document.getElementById("bis-product-id").value;
      const variantId = document.getElementById("bis-variant-id").value;
      const productName = document.getElementById("bis-product-name").value;

      const BACKEND_URL = "/apps/back-in-stock/api/notify-me";

      messageElement.style.display = "block";
      messageElement.style.color = "inherit";
      messageElement.innerText = "Submitting...";

      fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          productId: productId,
          variantId: variantId,
          productTitle: productName, 
          shop: window.Shopify?.shop || window.location.hostname
        }),
      })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          messageElement.style.color = "green";
          messageElement.innerText = "Success! You'll be notified when it's back.";
          bisForm.reset();
        } else {
          messageElement.style.color = "red";
          messageElement.innerText = data.message || "Something went wrong.";
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        messageElement.style.color = "red";
        messageElement.innerText = "Failed to connect to server.";
      });
    });
  }
});