import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import Dashboard from "./pages/dashboard";

const formatDate = (date) => {
  const d = new Date(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day}, ${year} ${hours}:${minutes} UTC`;
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalRequests, pending, notified] = await Promise.all([
    prisma.backInStockSubscriber.count({ where: { shop } }),
    prisma.backInStockSubscriber.count({ where: { shop, notified: false } }),
    prisma.backInStockSubscriber.count({ where: { shop, notified: true } }),
  ]);

  const productQuery = await admin.graphql(
    `#graphql
      query DashboardProductCount {
        shop {
          name
        }
        products(first: 250) {
          edges {
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `
  );

  const productJson = await productQuery.json();
  const shopName = productJson.data?.shop?.name || shop;
  const totalProducts = productJson.data?.products?.edges?.length ?? 0;
  const hasMoreProducts = productJson.data?.products?.pageInfo?.hasNextPage;
  const totalProductLabel = hasMoreProducts ? `${totalProducts}+` : totalProducts;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const historyDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + index);
    return date;
  });

  const historyLabels = historyDates.map((date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );

  const historyRecords = await prisma.backInStockSubscriber.findMany({
    where: {
      shop,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true, notified: true },
  });

  const historyMap = historyRecords.reduce((acc, record) => {
    const dayKey = record.createdAt.toISOString().split("T")[0];
    if (!acc[dayKey]) acc[dayKey] = { total: 0, pending: 0 };
    acc[dayKey].total += 1;
    if (!record.notified) acc[dayKey].pending += 1;
    return acc;
  }, {});

  const requestHistory = historyDates.map((date) => {
    const dayKey = date.toISOString().split("T")[0];
    return historyMap[dayKey]?.total ?? 0;
  });

  const pendingHistory = historyDates.map((date) => {
    const dayKey = date.toISOString().split("T")[0];
    return historyMap[dayKey]?.pending ?? 0;
  });

  const recentRequests = await prisma.backInStockSubscriber.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const topProductCounts = await prisma.backInStockSubscriber.groupBy({
    by: ["productId"],
    where: { shop },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 5,
  });

  const topProductIds = topProductCounts.map((item) => item.productId);
  let topProducts = [];

  if (topProductIds.length > 0) {
    const topProductQuery = await admin.graphql(
      `#graphql
        query TopRequestedProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              handle
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
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      `,
      { variables: { ids: topProductIds } }
    );

    const topProductsJson = await topProductQuery.json();
    const nodes = topProductsJson.data?.nodes || [];
    const productMap = nodes.reduce((map, product) => {
      if (product?.id) {
        map[product.id] = product;
      }
      return map;
    }, {});

    topProducts = topProductCounts.map((item) => {
      const product = productMap[item.productId];
      const totalInventory = product
        ? product.variants.edges.reduce(
            (sum, variantEdge) => sum + (variantEdge.node.inventoryQuantity ?? 0),
            0
          )
        : 0;

      return {
        id: item.productId,
        title: product?.title || "Unknown product",
        image: product?.images?.edges?.[0]?.node?.url || null,
        inventory: totalInventory,
        requestCount: item._count.productId,
      };
    });
  }

  return {
    stats: {
      totalRequests,
      pending,
      notified,
      totalProducts: totalProductLabel,
      completionPercent: totalRequests ? Math.round((notified / totalRequests) * 100) : 0,
      pendingPercent: totalRequests ? Math.round((pending / totalRequests) * 100) : 0,
      requestHistory,
      pendingHistory,
      historyLabels,
    },
    shopName,
    recentRequests: recentRequests.map((request) => ({
      id: request.id,
      email: request.email,
      productTitle: request.productTitle || "Unknown product",
      createdAt: formatDate(request.createdAt),
    })),
    topProducts,
  };
};

export default function Index() {
  const data = useLoaderData();
  return (
    <Dashboard
      stats={data.stats}
      recentRequests={data.recentRequests}
      shopName={data.shopName}
      topProducts={data.topProducts}
    />
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
