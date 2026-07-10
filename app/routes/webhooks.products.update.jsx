/**
 * Webhook: products/update
 * File: app/routes/webhooks.products.update.jsx
 *
 * Fires whenever a product is updated in Shopify.
 * If a variant transitions to available (inventory > 0), we:
 *   1. Check the shop's plan notification limit — skip sending if exceeded
 *   2. Find all un-notified subscribers for that variant
 *   3. Send them an email via Nodemailer / SMTP
 *   4. Mark them as notified in the database
 */

import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";
import { sendRestockEmail } from "../utils/emailService";
import { resolvePlanId, getLimitsForPlan, getShopUsage, isOverLimit } from "../utils/planLimits";

const prisma = new PrismaClient();

/**
 * Resolve the current plan for a shop from the Store model.
 */
async function getShopPlanId(shop) {
  try {
    const store = await prisma.store.findUnique({ where: { shop } });
    return resolvePlanId(store?.plan);
  } catch {
    return "free";
  }
}

export const action = async ({ request }) => {
  // Verify the request is from Shopify
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "PRODUCTS_UPDATE") {
    return new Response("Unhandled topic", { status: 200 });
  }

  try {
    const product = payload;

    // ── Check notification limit for this shop ────────────────────────────────
    const planId = await getShopPlanId(shop);
    const limits = getLimitsForPlan(planId);
    const usage = await getShopUsage(prisma, shop);

    if (isOverLimit(usage.notifications, limits.notifications)) {
      console.warn(
        `[Webhook:products/update] Shop ${shop} has reached its notification limit ` +
        `(${usage.notifications}/${limits.notifications}) on plan "${planId}". ` +
        `Skipping notifications.`
      );
      // Return 200 so Shopify doesn't retry — we intentionally skip
      return new Response("Notification limit reached", { status: 200 });
    }

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

    // ── Notify each subscriber (respecting remaining quota) ───────────────────
    const productImage =
      product.image?.src ||
      (product.images && product.images.length > 0 ? product.images[0].src : null);

    // How many notifications can we still send?
    const remainingQuota =
      limits.notifications === null
        ? Infinity
        : limits.notifications - usage.notifications;

    // Slice the list to the remaining quota
    const eligibleSubscribers = subscribers.slice(0, remainingQuota);

    if (eligibleSubscribers.length < subscribers.length) {
      console.warn(
        `[Webhook:products/update] Only ${eligibleSubscribers.length} of ${subscribers.length} ` +
        `subscribers will be notified due to plan limit for shop ${shop}.`
      );
    }

    const notifyPromises = eligibleSubscribers.map(async (sub) => {
      try {
        await sendRestockEmail({
          to: sub.email,
          productTitle: sub.productTitle,
          variantTitle: sub.variantTitle,
          shop,
          productId: sub.productId,
          productImage,
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
