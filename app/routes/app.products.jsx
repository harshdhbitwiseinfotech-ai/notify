import React, { useEffect, useState } from "react";
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
  Spinner,
  Box,
  InlineStack,
  BlockStack,
  List,
} from "@shopify/polaris";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for viewing subscribers
  const [activeProduct, setActiveProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // -----------------------------
  // Fetch products from backend
  // -----------------------------
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/products");
      const data = await res.json();
      setProducts(data.products || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const rowMarkup = (products || []).map((product, index) => (
    <IndexTable.Row 
      id={product.id?.toString() || index.toString()} 
      key={product.id || index} 
      position={index}
    >
      {/* Product Image and Title */}
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail
            source={product.image || "https://burst.shopifycdn.com/photos/placeholder-product-image.jpg"}
            alt={product.title || "Product image"}
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
        <Button onClick={() => handleOpenSubscribers(product)}>
          View Subscribers
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <Page
      title="📦 Products Management"
      subtitle="Track stock status and notify requests"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {loading ? (
              <Box padding="800">
                <InlineStack align="center">
                  <Spinner size="large" hasFocusableParent={false} />
                </InlineStack>
              </Box>
            ) : products.length === 0 ? (
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
                itemCount={products.length}
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
        title={activeProduct ? `Subscribers for ${activeProduct.title}` : "Subscribers"}
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
};

export default Products;