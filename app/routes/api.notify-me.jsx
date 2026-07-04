/**
 * PUBLIC endpoint — called from the storefront (no Shopify admin auth).
 * POST /api/notify-me
 * Body (JSON or FormData): { shop, email, productId, variantId, productTitle, variantTitle }
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── CORS helper ────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
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

    const { shop, email, productId, variantId, productTitle, variantTitle } =
      body;

    // ── Validation ─────────────────────────────────────────────────────────────
    if (!shop || !email || !productId || !variantId || !productTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ── Upsert subscriber (unique: shop + email + variantId) ───────────────────
    await prisma.backInStockSubscriber.upsert({
      where: {
        shop_email_variantId: {
          shop: String(shop),
          email: String(email).toLowerCase().trim(),
          variantId: String(variantId),
        },
      },
      update: {
        notified: false,       // reset if they re-subscribe after being notified
        notifiedAt: null,
        updatedAt: new Date(),
      },
      create: {
        shop: String(shop),
        email: String(email).toLowerCase().trim(),
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
