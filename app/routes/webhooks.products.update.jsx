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
  const { topic, shop, payload, admin } = await authenticate.webhook(request);

  if (topic !== "PRODUCTS_UPDATE" && topic !== "INVENTORY_LEVEL_UPDATE") {
    return new Response("Unhandled topic", { status: 200 });
  }

  try {
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
      return new Response("Notification limit reached", { status: 200 });
    }

    function normalizeGid(id, type) {
      if (!id) return null;
      const value = String(id);
      if (value.startsWith("gid://")) return value;
      return `gid://shopify/${type}/${value}`;
    }

    async function fetchProductVariants(productPayload) {
      const productId = normalizeGid(productPayload.id, "Product");
      if (!productId) return { variants: [], productMeta: {} };

      if (admin) {
        const response = await admin.graphql(
          `#graphql
          query getProductInventory($id: ID!) {
            product(id: $id) {
              id
              title
              images(first: 1) {
                edges {
                  node {
                    src
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    inventoryQuantity
                    inventoryPolicy
                    title
                  }
                }
              }
            }
          }`,
          { variables: { id: productId } }
        );
        const data = await response.json();
        const product = data.data?.product;
        const variants = product?.variants?.edges?.map((edge) => edge.node) || [];
        const productImage = product?.images?.edges?.[0]?.node?.src || null;
        return { variants, productMeta: { productImage, productTitle: product?.title || null } };
      }

      console.warn("[Webhook] Admin API not available, falling back to payload data");
      const variants = (productPayload.variants || []).map((variant) => ({
        id: normalizeGid(variant.id, "ProductVariant"),
        inventoryQuantity: variant.inventory_quantity,
        inventoryPolicy: variant.inventory_policy ? variant.inventory_policy.toUpperCase() : "DENY",
        title: variant.title,
      }));
      const productImage = productPayload.image?.src || (productPayload.images?.[0]?.src ?? null);
      return { variants, productMeta: { productImage, productTitle: productPayload.title || null } };
    }

    async function fetchVariantFromInventoryItem(inventoryItemId) {
      const inventoryItemGid = normalizeGid(inventoryItemId, "InventoryItem");
      if (!inventoryItemGid) return { variant: null, productMeta: {} };

      if (!admin) {
        console.warn("[Webhook] Admin API not available for inventory webhook, skipping");
        return { variant: null, productMeta: {} };
      }

      const response = await admin.graphql(
        `#graphql
        query getInventoryItemVariant($id: ID!) {
          inventoryItem(id: $id) {
            variant {
              id
              inventoryQuantity
              inventoryPolicy
              title
              product {
                id
                title
                images(first: 1) {
                  edges {
                    node {
                      src
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { id: inventoryItemGid } }
      );

      const data = await response.json();
      const variant = data.data?.inventoryItem?.variant || null;
      const productImage = variant?.product?.images?.edges?.[0]?.node?.src || null;
      return { variant, productMeta: { productImage, productTitle: variant?.product?.title || null } };
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const restockedVariantIds = [];
    const variantInventory = {};
    let productImage = null;

    if (topic === "INVENTORY_LEVEL_UPDATE") {
      const inventoryItemId = payload.inventory_item_id || payload.inventory_item?.id;
      const available = payload.available;

      const { variant, productMeta } = await fetchVariantFromInventoryItem(inventoryItemId);
      productImage = productMeta.productImage;

      if (!variant) {
        console.warn("[Webhook:inventory_level_update] No variant found for inventory item", inventoryItemId);
        return new Response("No variant found", { status: 200 });
      }

      const inventoryQuantity = Number(variant.inventoryQuantity ?? available ?? 0);
      const isAvailable = variant.inventoryPolicy === "CONTINUE" || inventoryQuantity > 0;
      if (isAvailable) {
        restockedVariantIds.push(variant.id);
        variantInventory[variant.id] = inventoryQuantity;
      }
    } else {
      const { variants, productMeta } = await fetchProductVariants(payload);
      productImage = productMeta.productImage;

      for (const variant of variants) {
        const inventoryQuantity = Number(variant.inventoryQuantity ?? 0);
        const isAvailable = variant.inventoryPolicy === "CONTINUE" || inventoryQuantity > 0;
        if (isAvailable) {
          restockedVariantIds.push(variant.id);
          variantInventory[variant.id] = inventoryQuantity;
        }
      }
    }

    if (restockedVariantIds.length === 0) {
      return new Response("No restocked variants", { status: 200 });
    }

    const subscribers = await prisma.backInStockSubscriber.findMany({
      where: {
        shop,
        variantId: { in: restockedVariantIds },
        notified: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (subscribers.length === 0) {
      return new Response("No subscribers to notify", { status: 200 });
    }

    const activeReservedSubscribers = await prisma.backInStockSubscriber.findMany({
      where: {
        shop,
        variantId: { in: restockedVariantIds },
        notified: true,
        notifiedAt: { gte: threeDaysAgo },
      },
    });

    const activeReservationCounts = activeReservedSubscribers.reduce((acc, sub) => {
      acc[sub.variantId] = (acc[sub.variantId] || 0) + 1;
      return acc;
    }, {});

    const remainingQuota =
      limits.notifications === null
        ? Infinity
        : Math.max(0, limits.notifications - usage.notifications);

    const pendingByVariant = subscribers.reduce((acc, sub) => {
      acc[sub.variantId] = acc[sub.variantId] || [];
      acc[sub.variantId].push(sub);
      return acc;
    }, {});

    const eligibleSubscribers = [];
    for (const variantId of restockedVariantIds) {
      const inventoryQty = variantInventory[variantId] ?? 0;
      const reservedCount = activeReservationCounts[variantId] ?? 0;
      const availableSlots = Math.max(inventoryQty - reservedCount, 0);
      if (availableSlots <= 0) continue;
      const pending = pendingByVariant[variantId] || [];
      eligibleSubscribers.push(...pending.slice(0, availableSlots));
    }

    if (eligibleSubscribers.length === 0) {
      return new Response("No available notification slots", { status: 200 });
    }

    const finalSubscribers = eligibleSubscribers.slice(0, remainingQuota);
    if (finalSubscribers.length < eligibleSubscribers.length) {
      console.warn(
        `[Webhook:products/update] Only ${finalSubscribers.length} of ${eligibleSubscribers.length} ` +
        `pending subscribers can be emailed due to plan notification limit for shop ${shop}.`
      );
    }

    console.log(
      `[Webhook:products/update] notifying ${finalSubscribers.length} subscribers for shop ${shop}`
    );

    const notifyPromises = finalSubscribers.map(async (sub) => {
      try {
        await sendRestockEmail({
          to: sub.email,
          productTitle: sub.productTitle,
          variantTitle: sub.variantTitle,
          shop,
          productId: sub.productId,
          productImage,
        });

        await prisma.backInStockSubscriber.update({
          where: { id: sub.id },
          data: { notified: true, notifiedAt: new Date() },
        });

        console.log(`[Webhook] Notified ${sub.email} for variant ${sub.variantId}`);
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
