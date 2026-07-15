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

    const remainingQuota =
      limits.notifications === null
        ? Infinity
        : Math.max(0, limits.notifications - usage.notifications);

    const finalSubscribers = subscribers.slice(0, remainingQuota);

    if (finalSubscribers.length === 0) {
      console.warn(
        `[Webhook:products/update] No subscribers can be emailed due to plan notification limit for shop ${shop} (${usage.notifications}/${limits.notifications}).`
      );
      return new Response("No subscribers can be emailed", { status: 200 });
    }

    if (finalSubscribers.length < subscribers.length) {
      console.warn(
        `[Webhook:products/update] Only ${finalSubscribers.length} of ${subscribers.length} ` +
        `pending subscribers can be emailed due to plan notification limit for shop ${shop}.`
      );
    }

    console.log(
      `[Webhook:products/update] restockedVariants=${restockedVariantIds.join(", ")} pendingSubscribers=${subscribers.length} notifying=${finalSubscribers.length} for shop ${shop}`
    );

    // ── AUTOMATED LIVE BROADCASTING LOOP ────────────────────────────────────
    const notifyPromises = finalSubscribers.map(async (sub) => {
      try {
        // Triggers the real email engine inside mailer.js using dynamic schema variables
        await sendRestockEmail({
          to: sub.email,
          customerName: sub.name || "Subscriber", // Dynamically maps user's stored name parameter
          productTitle: sub.productTitle,
          variantTitle: sub.variantTitle,
          shop, // Automates clean base domains (e.g., tested-store-atiknswl.myshopify.com)
          productId: sub.productId,
          productImage: productImage, // Populates your custom layout box with the correct product snapshot
        });

        // Permanently sets notification flags to prevent repeat triggers and respect billing tiers
        await prisma.backInStockSubscriber.update({
          where: { id: sub.id },
          data: { notified: true, notifiedAt: new Date() },
        });

        console.log(`[Webhook] Automatically notified ${sub.email} for variant ${sub.variantId}`);
      } catch (err) {
        console.error(`[Webhook] Live processing failed to deliver to ${sub.email}:`, err);
      }
    });

    await Promise.allSettled(notifyPromises);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Webhook:products/update] Error:", error);
    return new Response("Internal error", { status: 500 });
  }
};
