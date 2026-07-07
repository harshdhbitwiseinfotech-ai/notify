import React, { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Thumbnail,
  Button,
  Modal,
  Text,
  Box,
  InlineStack,
  BlockStack,
  List,
  TextField,
} from "@shopify/polaris";
import { ArrowLeftIcon, SearchIcon } from "@shopify/polaris-icons";
import { Icon } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
    query getProductsWithInventory {
      products(first: 50) {
        edges {
          node {
            id
            title
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
                  price
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }`
  );

  const parsedData = await response.json();
  const productsNodes = parsedData.data?.products?.edges || [];

  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch all subscribers for this shop from real database
  const allSubscribers = await prisma.backInStockSubscriber.findMany({
    where: { shop },
  });

  // Normalize data and match with subscription real data
  const products = productsNodes.map(({ node }) => {
    const variant = node.variants.edges[0]?.node;
    const inventoryCount = variant?.inventoryQuantity || 0;
    const price = variant?.price || "0.00";
    const image = node.images.edges[0]?.node?.url || "https://burst.shopifycdn.com/photos/placeholder-product-image.jpg";

    const productSubscribers = allSubscribers.filter(sub => sub.productId === node.id);

    return {
      id: node.id,
      title: node.title,
      image,
      price,
      inventoryCount,
      inStock: inventoryCount > 0,
      notifyCount: productSubscribers.length,
      subscribers: productSubscribers
    };
  });

  return { products };
};

export default function Products() {
  const { products } = useLoaderData();

  // Modal State for viewing subscribers
  const [activeProduct, setActiveProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  // configurable sizes (pixels)
  const [titleSize, setTitleSize] = useState(28);
  const [subtitleSize, setSubtitleSize] = useState(14);
  const [backIconSize, setBackIconSize] = useState(20);
  const [buttonBgColor, setButtonBgColor] = useState("#fffbfb23");
  const [buttonTextColor, setButtonTextColor] = useState("#b66f05dc");

  const visibleProducts = useMemo(() => {
    if (!searchText.trim()) {
      return products;
    }

    const query = searchText.toLowerCase();
    return products.filter((product) =>
      product.title.toLowerCase().includes(query)
    );
  }, [products, searchText]);

  const handleOpenSubscribers = (product) => {
    setActiveProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseSubscribers = () => {
    setActiveProduct(null);
    setIsModalOpen(false);
  };

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const rowMarkup = (visibleProducts || []).map((product, index) => (
    <IndexTable.Row
      id={product.id?.toString() || index.toString()}
      key={product.id || index}
      position={index}
    >
      {/* Product Image and Title */}
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail
            source={product.image}
            alt={product.title}
            size="small"
          />
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {product.title}
          </Text>
        </InlineStack>
      </IndexTable.Cell>

      {/* Price */}
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          ₹{product.price}
        </Text>
      </IndexTable.Cell>

      {/* Stock Status */}
      <IndexTable.Cell>
        {product.inStock ? (
          <Badge tone="success">In Stock</Badge>
        ) : (
          <Badge tone="critical">Out of Stock</Badge>
        )}
      </IndexTable.Cell>

      {/* Notify Requests Count */}
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {product.notifyCount || 0}
        </Text>
      </IndexTable.Cell>

      {/* Actions */}
      <IndexTable.Cell>
        <button onClick={() => handleOpenSubscribers(product)}
          style={{
            backgroundColor: buttonBgColor,
            color: buttonTextColor,
            border: "1px solid #000000",
            borderRadius: "8px",
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "14px",
          }}
        >
          View Subscribers
        </button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title={ <Text variant="headingXl" as="h1"> Products </Text>}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <InlineStack blockAlign="center" align="space-between" gap="400">
                <BlockStack spacing="tight">
                  <Text as="h3" variant="headingLg" fontWeight="bold">
                    Products management
                  </Text>
                  <Text as="bodyMd" tone="subdued" fontWeight="regular">
                    Search products and monitor stock availability.
                  </Text>
                </BlockStack>
                <Box width="320px">
                  <TextField
                    label="Search products"
                    labelHidden
                    type="search"
                    value={searchText}
                    onChange={setSearchText}
                    clearButton
                    onClearButtonClick={() => setSearchText("")}
                    placeholder="Search product name"
                    autoComplete="off"
                    prefix={<Icon source={SearchIcon} />}
                  />
                </Box>
              </InlineStack>
            </Box>
            {visibleProducts.length === 0 ? (
              <Box padding="800">
                <BlockStack inlineAlign="center" gap="200">
                  <Text variant="headingMd" as="p" tone="subdued">
                    No products found
                  </Text>
                </BlockStack>
              </Box>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={visibleProducts.length}
                selectable={false}
                headings={[
                  { title: "Product" },
                  { title: "Price" },
                  { title: "Stock Status" },
                  { title: "Notify Requests" },
                  { title: "Action" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {/* MODAL OVERLAY FOR SUBSCRIBERS */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseSubscribers}
        title={activeProduct ? "Subscribers for " + activeProduct.title : "Subscribers"}
        primaryAction={{
          content: "Close",
          onAction: handleCloseSubscribers,
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {activeProduct && activeProduct.subscribers && activeProduct.subscribers.length > 0 ? (
              <Box padding="100">
                <Text variant="bodyMd" as="p" tone="subdued">
                  The following customers want to be notified when this product is back in stock:
                </Text>
                <Box paddingTop="400">
                  <List type="bullet">
                    {activeProduct.subscribers.map((subscriber, idx) => (
                      <List.Item key={idx}>
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                          {subscriber.email}
                        </Text>
                      </List.Item>
                    ))}
                  </List>
                </Box>
              </Box>
            ) : (
              <Text variant="bodyMd" tone="subdued" as="p">
                No active notification subscriptions found for this product.
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}