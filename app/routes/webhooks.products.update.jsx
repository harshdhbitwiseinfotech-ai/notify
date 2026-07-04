/**
 * Webhook: products/update
 * File: app/routes/webhooks.products.update.jsx
 *
 * Fires whenever a product is updated in Shopify.
 * If a variant transitions to available (inventory > 0), we:
 *   1. Find all un-notified subscribers for that variant
 *   2. Send them an email (console.log placeholder — swap for Nodemailer / SendGrid)
 *   3. Mark them as notified
 */

import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  // Verify the request is from Shopify
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "PRODUCTS_UPDATE") {
    return new Response("Unhandled topic", { status: 200 });
  }

  try {
    const product = payload;

    // ── Find variants that are now back in stock ──────────────────────────────
    const restockedVariantIds = [];

    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        // A variant is available if inventory_policy allows it or qty > 0
        const isAvailable =
          variant.inventory_policy === "continue" ||
          (variant.inventory_quantity != null &&
            variant.inventory_quantity > 0);

        if (isAvailable) {
          // GID format to match what we store
          restockedVariantIds.push(
            `gid://shopify/ProductVariant/${variant.id}`
          );
        }
      }
    }

    if (restockedVariantIds.length === 0) {
      return new Response("No restocked variants", { status: 200 });
    }

    // ── Fetch waiting subscribers for this shop + these variants ─────────────
    const subscribers = await prisma.backInStockSubscriber.findMany({
      where: {
        shop,
        variantId: { in: restockedVariantIds },
        notified: false,
      },
    });

    if (subscribers.length === 0) {
      return new Response("No subscribers to notify", { status: 200 });
    }

    console.log(
      `[Webhook:products/update] ${subscribers.length} subscribers to notify for shop ${shop}`
    );

    // ── Notify each subscriber ────────────────────────────────────────────────
    const notifyPromises = subscribers.map(async (sub) => {
      try {
        await sendNotificationEmail({
          to: sub.email,
          productTitle: sub.productTitle,
          variantTitle: sub.variantTitle,
          shop,
          productId: sub.productId,
        });

        // Mark as notified
        await prisma.backInStockSubscriber.update({
          where: { id: sub.id },
          data: {
            notified: true,
            notifiedAt: new Date(),
          },
        });

        console.log(
          `[Webhook] Notified ${sub.email} for variant ${sub.variantId}`
        );
      } catch (err) {
        console.error(`[Webhook] Failed to notify ${sub.email}:`, err);
      }
    });

    await Promise.allSettled(notifyPromises);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Webhook:products/update] Error:", error);
    return new Response("Internal error", { status: 500 });
  }
};

// ── Email sender ──────────────────────────────────────────────────────────────
/**
 * Placeholder email function.
 *
 * To use a real email provider, replace the body of this function with:
 *   • Nodemailer + SMTP:  https://nodemailer.com
 *   • SendGrid:           https://sendgrid.com/docs/for-developers/sending-email/
 *   • Resend:             https://resend.com/docs/introduction
 *
 * The function receives:
 *   @param {Object} opts
 *   @param {string} opts.to            Subscriber email
 *   @param {string} opts.productTitle  Product name
 *   @param {string} opts.variantTitle  Variant name (e.g. "Size M / Red")
 *   @param {string} opts.shop          Shop domain (e.g. mystore.myshopify.com)
 *   @param {string} opts.productId     GID of the product
 */
async function sendNotificationEmail({
  to,
  productTitle,
  variantTitle,
  shop,
  productId,
}) {
  const productHandle = productId.split("/").pop(); // last segment of GID
  const productUrl = `https://${shop}/products/${productHandle}`;

  const subject = `🎉 ${productTitle} is back in stock!`;
  const body = `
Hi there,

Great news! The item you were waiting for is now back in stock:

  ${productTitle}${variantTitle && variantTitle !== "Default Title" ? ` — ${variantTitle}` : ""}

Shop now before it sells out again:
  ${productUrl}

---
You received this email because you signed up for a back-in-stock alert
on ${shop}. This is a one-time notification.
  `.trim();

  // ── Swap the lines below with your real email provider ────────────────────
  console.log("=== [BACK IN STOCK EMAIL] ===");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log("=============================");

  // Example — Nodemailer (uncomment and configure):
  // const nodemailer = await import("nodemailer");
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT || 587),
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transporter.sendMail({
  //   from: `"${shop}" <${process.env.SMTP_FROM}>`,
  //   to,
  //   subject,
  //   text: body,
  // });
}
