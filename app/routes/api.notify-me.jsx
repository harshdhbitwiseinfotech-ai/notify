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

// Prevent multiple PrismaClient instances during hot reloads in development
const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

// ── CORS helper ────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400", // Cache preflight response for 24 hours
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
  } catch (error) {
    console.error("[getShopPlanId] Error:", error);
    return "free";
  }
}

// Helper to handle OPTIONS preflight cleanups globally
function handlePreflight(request) {
  const origin = request.headers.get("Origin") || "*";
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

// ── GET & OPTIONS (loader) ───────────────────────────────────────────────────
export async function loader({ request }) {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const origin = request.headers.get("Origin") || "*";
  
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  if (shop) {
    try {
      const normalizedShop = String(shop).toLowerCase().trim();
      const settings = await prisma.buttonSettings.findUnique({ where: { shop: normalizedShop } });
      
      const defaultSettings = {
        buttonText:   'Notify Me',
        primaryColor: '#2c6ecb',
        textColor:    '#FFFFFF',
        borderRadius: 4,
        fontSize:     14,
        fontFamily:   'inherit',
        buttonSize:   'medium',
      };

      return new Response(JSON.stringify(settings || defaultSettings), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    } catch (e) {
      console.error("[api/notify-me GET]", e);
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ── POST & OPTIONS (action) ──────────────────────────────────────────────────
export async function action({ request }) {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const origin = request.headers.get("Origin") || "*";

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
      // FIX: Query the plan database using the normalized shop string!
      const planId = await getShopPlanId(normalizedShop);
      const limits = getLimitsForPlan(planId);
      const usage = await getShopUsage(prisma, normalizedShop);

      // Block if subscriber limit reached
      if (isOverLimit(usage.subscribers, limits.subscribers)) {
        return new Response(
          JSON.stringify({
            error: "Limits over! Please upgrade your plan in the app to continue.",
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