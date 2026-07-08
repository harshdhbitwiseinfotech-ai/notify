import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import Dashboard from "./pages/dashboard";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const totalRequests = await prisma.backInStockSubscriber.count({ where: { shop } });
  const pending = await prisma.backInStockSubscriber.count({ where: { shop, notified: false } });
  const notified = await prisma.backInStockSubscriber.count({ where: { shop, notified: true } });

  const recentRequests = await prisma.backInStockSubscriber.findMany({
    where: { shop },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  const formatDate = (d) => {
    const dt = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[dt.getUTCMonth()];
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const year = dt.getUTCFullYear();
    const hr = String(dt.getUTCHours()).padStart(2, '0');
    const min = String(dt.getUTCMinutes()).padStart(2, '0');
    return `${mon} ${day}, ${year}, ${hr}:${min} UTC`;
  };

  const dashboardProducts = recentRequests.map(sub => ({
    productName: sub.productTitle || sub.productId,
    email: sub.email,
    status: sub.notified ? 'notified' : 'pending',
    createdAt: formatDate(sub.createdAt),
    image: null
  }));

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
    {
      variables: {
        first: 8,
      },
    },
  );

  const responseJson = await response.json();
  const products = responseJson.data.products.edges.map(({ node }) => {
    const variants = node.variants.edges.map(({ node: variant }) => ({
      id: variant.id,
      title: variant.title,
      price: variant.price,
      inventoryQuantity: variant.inventoryQuantity,
      availableForSale: variant.availableForSale,
    }));

    const totalInventory = variants.reduce(
      (total, variant) => total + (variant.inventoryQuantity ?? 0),
      0,
    );
    const soldOut = totalInventory === 0;

    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      status: soldOut ? "Sold out" : "Available",
      totalInventory,
      variants,
    };
  });

  return { products, stats: { totalRequests, pending, notified }, dashboardProducts };
};

export default function Index() {
  const data = useLoaderData();
  return <Dashboard stats={data.stats} products={data.dashboardProducts} storeProducts={data.products} />;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
