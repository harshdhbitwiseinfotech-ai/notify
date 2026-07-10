import React from "react";
import {
  Page,
  Layout,
  Grid,
  Card,
  Text,
  IndexTable,
  Badge,
  Box,
  InlineStack,
  Thumbnail,
  Banner,
  EmptyState,
  BlockStack,
  Divider,
} from "@shopify/polaris";

const Dashboard = ({ stats, products = [], storeProducts = [], currentPlan = "none" }) => {

  // ── Recent Requests table (all plans) ──────────────────────────────────────
  const resourceName = {
    singular: "product request",
    plural: "product requests",
  };

  const rowMarkup = products.map((item, index) => (
    <IndexTable.Row id={index.toString()} key={index} position={index}>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail
            source={
              item.image ||
              "https://burst.shopifycdn.com/photos/placeholder-product-image.jpg"
            }
            alt={item.productName}
            size="small"
          />
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {item.productName}
          </Text>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{item.email}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={item.status === "notified" ? "success" : "attention"}>
          {item.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{item.createdAt}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  // ── Monitored products table (free / basic only) ───────────────────────────
  const storeProductsRowMarkup = storeProducts.map((item, index) => (
    <IndexTable.Row id={item.id} key={item.id} position={index}>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          {item.image && (
            <Thumbnail source={item.image} alt={item.title} size="small" />
          )}
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {item.title}
          </Text>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={item.status === "Available" ? "success" : "critical"}>
          {item.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone={item.totalInventory > 0 ? "success" : "critical"}>
          {item.totalInventory} in stock
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {item.subscriberCount || 0} waiting
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  // ── Plan flags ─────────────────────────────────────────────────────────────
  const hasNoPlan = currentPlan === "none";
  const isFreePlan = currentPlan === "free";
  const isBasicPlan = currentPlan === "basic";
  const isLowerTierPlan = isFreePlan || isBasicPlan;
  const isHigherTierPlan = currentPlan === "pro" || currentPlan === "enterprise";

  const maxMonitoredProducts = isFreePlan ? 5 : isBasicPlan ? 50 : 0;

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <Page
      title="📦 Notification Dashboard"
      subtitle="Monitor product alerts and customer subscriptions"
    >
      <Layout>
        {/* ── STATS CARDS ─────────────────────────────────────────────────── */}
        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4 }}>
              <Card>
                <Box padding="400">
                  <Text variant="heading2xl" as="h2">
                    {stats?.totalRequests || 0}
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Total Requests
                  </Text>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4 }}>
              <Card>
                <Box padding="400">
                  <Text variant="heading2xl" as="h2">
                    {stats?.pending || 0}
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Pending Notifications
                  </Text>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4 }}>
              <Card>
                <Box padding="400">
                  <Text variant="heading2xl" as="h2">
                    {stats?.notified || 0}
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Notified Customers
                  </Text>
                </Box>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {/* ── MONITORED INVENTORY (none / free / basic only) ──────────────── */}
        {(hasNoPlan || isLowerTierPlan) && (
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    🛍️ Monitoring Inventory
                  </Text>
                  {isLowerTierPlan && (
                    <Text variant="bodySm" tone="subdued">
                      Showing top {maxMonitoredProducts} most-requested products
                      on your <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan
                    </Text>
                  )}
                </BlockStack>
              </Box>

              {hasNoPlan ? (
                /* No plan selected yet → prompt to choose */
                <Box padding="400">
                  <Banner
                    title="Choose a billing plan to start monitoring inventory"
                    tone="warning"
                  >
                    <p>
                      Your store inventory monitoring is currently disabled.
                      Please select a pricing plan to unlock tracked inventory
                      items here.
                    </p>
                  </Banner>
                </Box>
              ) : (
                /* Free or Basic → show top products table */
                <>
                  {storeProducts.length === 0 ? (
                    <Box padding="800">
                      <EmptyState
                        heading="No monitored products yet"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>
                          Products with back-in-stock subscribers will appear
                          here.
                        </p>
                      </EmptyState>
                    </Box>
                  ) : (
                    <IndexTable
                      resourceName={{
                        singular: "store product",
                        plural: "store products",
                      }}
                      itemCount={storeProducts.length}
                      selectable={false}
                      headings={[
                        { title: "Product" },
                        { title: "Status" },
                        { title: "Inventory" },
                        { title: "Subscribers Waiting" },
                      ]}
                    >
                      {storeProductsRowMarkup}
                    </IndexTable>
                  )}
                </>
              )}
            </Card>
          </Layout.Section>
        )}

        {/* ── RECENT REQUESTS (all plans — scrollable for pro / enterprise) ── */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">
                  📊 Recent Product Requests
                </Text>
                {isHigherTierPlan && (
                  <Text variant="bodySm" tone="subdued">
                    Showing last 50 requests — scroll to view all
                  </Text>
                )}
              </BlockStack>
            </Box>

            {products.length === 0 ? (
              <Box padding="1200">
                <EmptyState
                  heading="No product requests found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Back-in-stock sign-ups from your storefront will appear
                    here.
                  </p>
                </EmptyState>
              </Box>
            ) : (
              /* Pro / Enterprise: wrap in a scrollable container */
              <div
                style={
                  isHigherTierPlan
                    ? {
                        maxHeight: 480,
                        overflowY: "auto",
                        borderTop: "1px solid #e1e3e5",
                      }
                    : {}
                }
              >
                <IndexTable
                  resourceName={resourceName}
                  itemCount={products.length}
                  selectable={false}
                  headings={[
                    { title: "Product" },
                    { title: "Email" },
                    { title: "Status" },
                    { title: "Requested At" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default Dashboard;