import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import Dashboard from "./pages/dashboard";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

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

  return { products };
};

export default function Index() {
  const data = useLoaderData();
  return <Dashboard products={data.products} />;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
