/**
 * PUBLIC endpoint — called from the storefront (no Shopify admin auth).
 * POST /api/notify-me
 * Body (JSON or FormData): { shop, email, productId, variantId, productTitle, variantTitle }
 *
 * Enforces plan limits: if the shop has exceeded subscriber or product limits
 * for its current plan, new sign-ups are rejected with a 429 status.
 */

import { PrismaClient } from "@prisma/client";
import { resolvePlanId, getLimitsForPlan, getShopUsage, isOverLimit } from "../utils/planLimits";

const prisma = new PrismaClient();

// ── CORS helper ────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * Resolve the current plan for a shop from the database.
 * We store it in the Store model's `plan` field.
 */
async function getShopPlanId(shop) {
  try {
    const store = await prisma.store.findUnique({ where: { shop } });
    return resolvePlanId(store?.plan);
  } catch {
    return "free";
  }
}

// ── OPTIONS (preflight) ────────────────────────────────────────────────────────
export async function action({ request }) {
  const origin = request.headers.get("Origin") || "*";

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  try {
    // Accept both JSON and FormData
    let body;
    const contentType = request.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }

    console.log("[api/notify-me] Incoming Body:", body);
    console.log("[api/notify-me] URL:", request.url);

    const { shop: bodyShop, email, productId, variantId, productTitle, variantTitle } = body;
    
    // Shopify App Proxy injects the correct .myshopify.com domain in the query string
    const url = new URL(request.url);
    const shopQuery = url.searchParams.get("shop");
    const shop = shopQuery || bodyShop;

    const normalizedShop = String(shop || "").toLowerCase().trim();
    const normalizedEmail = String(email || "").toLowerCase().trim();

    // ── Validation ─────────────────────────────────────────────────────────────
    if (!normalizedShop || !normalizedEmail || !productId || !variantId || !productTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ── Check if subscriber already exists (don't count toward limits) ─────────
    const existingSubscriber = await prisma.backInStockSubscriber.findUnique({
      where: {
        shop_email_variantId: {
          shop: normalizedShop,
          email: normalizedEmail,
          variantId: String(variantId),
        },
      },
    });

    if (!existingSubscriber) {
      // ── Enforce plan limits (only for new subscribers) ───────────────────────
      const planId = await getShopPlanId(String(shop));
      const limits = getLimitsForPlan(planId);
      const usage = await getShopUsage(prisma, String(shop));

      // Block if subscriber limit reached
      if (isOverLimit(usage.subscribers, limits.subscribers)) {
        return new Response(
          JSON.stringify({
            error: "This store has reached its subscriber limit. Please try again later.",
            limitReached: true,
            limitType: "subscribers",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          }
        );
      }

    }

    // ── Upsert subscriber (unique: shop + email + variantId) ───────────────────
    await prisma.backInStockSubscriber.upsert({
      where: {
        shop_email_variantId: {
          shop: normalizedShop,
          email: normalizedEmail,
          variantId: String(variantId),
        },
      },
      update: {
        notified: false,
        notifiedAt: null,
        updatedAt: new Date(),
      },
      create: {
        shop: normalizedShop,
        email: normalizedEmail,
        productId: String(productId),
        variantId: String(variantId),
        productTitle: String(productTitle),
        variantTitle: String(variantTitle || ""),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "You'll be notified when this product is back in stock!",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  } catch (error) {
    console.error("[api/notify-me] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  }
}

// ── GET — not used, return 405 ─────────────────────────────────────────────────
export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "*";
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
