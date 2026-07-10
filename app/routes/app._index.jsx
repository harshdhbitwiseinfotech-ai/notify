import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import Dashboard from "./pages/dashboard";
import { resolvePlanId } from "../utils/planLimits";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [totalRequests, pending, notified] = await Promise.all([
    prisma.backInStockSubscriber.count({ where: { shop } }),
    prisma.backInStockSubscriber.count({ where: { shop, notified: false } }),
    prisma.backInStockSubscriber.count({ where: { shop, notified: true } }),
  ]);

  // ── Recent Requests (all 50, scrollable) ───────────────────────────────────
  const recentRequests = await prisma.backInStockSubscriber.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const formatDate = (d) => {
    const dt = new Date(d);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mon = months[dt.getUTCMonth()];
    const day = String(dt.getUTCDate()).padStart(2, "0");
    const year = dt.getUTCFullYear();
    const hr = String(dt.getUTCHours()).padStart(2, "0");
    const min = String(dt.getUTCMinutes()).padStart(2, "0");
    return `${mon} ${day}, ${year}, ${hr}:${min} UTC`;
  };

  const dashboardProducts = recentRequests.map((sub) => ({
    productName: sub.productTitle || sub.productId,
    email: sub.email,
    status: sub.notified ? "notified" : "pending",
    createdAt: formatDate(sub.createdAt),
    image: null,
  }));

  // ── Current Plan from Store model ──────────────────────────────────────────
  let currentPlanId = "none";
  try {
    const store = await prisma.store.findUnique({ where: { shop } });
    if (store?.plan) {
      currentPlanId = resolvePlanId(store.plan);
    }
  } catch (e) {
    console.error("[dashboard/loader] store lookup error:", e);
  }

  // ── Store products (only fetch if plan is free or basic) ───────────────────
  // For free: top 5, for basic: top 50. Pro/Enterprise: section hidden.
  let products = [];
  if (currentPlanId === "free" || currentPlanId === "basic") {
    const fetchLimit = currentPlanId === "free" ? 5 : 50;

    // Get subscriber counts per product so we can show "top selling" (most requested)
    const subscriberCounts = await prisma.backInStockSubscriber.groupBy({
      by: ["productId"],
      where: { shop },
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      take: fetchLimit,
    });

    const topProductIds = subscriberCounts.map((s) => s.productId);

    // Fetch product details from Shopify for those top products
    // If no subscriber data, fall back to latest products
    const graphqlLimit = Math.max(fetchLimit, 50);
    const response = await admin.graphql(
      `#graphql
        query DashboardProducts($first: Int!) {
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                status
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryQuantity
                      availableForSale
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { variables: { first: graphqlLimit } }
    );

    const responseJson = await response.json();
    const allNodes = responseJson.data?.products?.edges || [];

    // Map Shopify products
    const mapped = allNodes.map(({ node }) => {
      const variants = node.variants.edges.map(({ node: v }) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        inventoryQuantity: v.inventoryQuantity,
        availableForSale: v.availableForSale,
      }));
      const totalInventory = variants.reduce(
        (t, v) => t + (v.inventoryQuantity ?? 0),
        0
      );
      const subscriberEntry = subscriberCounts.find((s) => s.productId === node.id);
      return {
        id: node.id,
        title: node.title,
        handle: node.handle,
        image: node.images.edges[0]?.node?.url || null,
        status: totalInventory === 0 ? "Sold out" : "Available",
        totalInventory,
        variants,
        subscriberCount: subscriberEntry ? subscriberEntry._count.productId : 0,
      };
    });

    // Sort: products with the most subscriber requests first (top selling/most wanted)
    mapped.sort((a, b) => b.subscriberCount - a.subscriberCount);

    // Slice to the plan limit
    products = mapped.slice(0, fetchLimit);
  }

  return {
    products,
    stats: { totalRequests, pending, notified },
    dashboardProducts,
    currentPlan: currentPlanId,
  };
};

export default function Index() {
  const data = useLoaderData();
  return (
    <Dashboard
      stats={data.stats}
      products={data.dashboardProducts}
      storeProducts={data.products}
      currentPlan={data.currentPlan}
    />
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
