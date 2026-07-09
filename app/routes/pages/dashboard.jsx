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
} from "@shopify/polaris";

const Dashboard = ({ stats, products = [], storeProducts = [], currentPlan = "none" }) => {

  const resourceName = {
    singular: "product request",
    plural: "product requests",
  };

  // Render recent customer notification requests row markup
  const rowMarkup = products.map((item, index) => (
    <IndexTable.Row id={index.toString()} key={index} position={index}>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail
            source={item.image || "https://burst.shopifycdn.com/photos/placeholder-product-image.jpg"}
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

  // Determine slicing limit for monitored products based on the billing tier
  let maxMonitoredProducts = 0;
  if (currentPlan === "free") maxMonitoredProducts = 5;
  if (currentPlan === "basic") maxMonitoredProducts = 50;

  // Slice list according to the active plan limit (only applies to free/basic)
  const visibleStoreProducts = storeProducts.slice(0, maxMonitoredProducts);

  // Render Store Products row markup including conditional alert signs
  const storeProductsRowMarkup = visibleStoreProducts.map((item, index) => {
    let alertBadge = null;

    // Condition logic for Alerts:
    if (item.totalInventory === 0) {
      alertBadge = <Badge tone="critical">Out of Stock</Badge>;
    } else if (item.totalInventory >= 1 && item.totalInventory <= 50) {
      alertBadge = <Badge tone="warning">Low Stock</Badge>;
    } else if (item.totalInventory > 50 && item.totalInventory <= 500) {
      // 50 to 500 stays perfectly blank as inventory levels are stable
      alertBadge = null;
    }

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {item.title}
          </Text>
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
        {/* CONDITIONAL ALERT CELL */}
        <IndexTable.Cell>{alertBadge}</IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // Boolean helper values to check for different structural views
  const hasNoPlan = currentPlan === "none";
  const isLowerTierPlan = currentPlan === "free" || currentPlan === "basic";

  return (
    <Page
      title="📦 Notification Dashboard"
      subtitle="Monitor product alerts and customer subscriptions"
    >
      <Layout>
        {/* STATS CARDS */}
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

        {/* PRODUCTS TABLE */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text variant="headingMd" as="h2">
                📊 Recent Product Requests
              </Text>
            </Box>

            {products.length === 0 ? (
              <Box padding="1200">
                <EmptyState
                  heading="No product requests found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try changing the filters or search term</p>
                </EmptyState>
              </Box>
            ) : (
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
            )}
          </Card>
        </Layout.Section>

        {/* STORE PRODUCTS SECTION (Only rendered if plan is "none", "free", or "basic") */}
        {(hasNoPlan || isLowerTierPlan) && (
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  🛍️  Monitoring Inventory 
                </Text>
              </Box>

              {hasNoPlan ? (
                /* Condition 1: Merchant downloaded application but chose no plan yet */
                <Box padding="400">
                  <Banner
                    title="Choose a billing plan to start monitoring inventory"
                    tone="warning"
                  >
                    <p>
                      Your store inventory monitoring is currently disabled. Please select a pricing plan to unlock tracked inventory items here.
                    </p>
                  </Banner>
                </Box>
              ) : (
                /* Condition 2: Active plan is either Free (Top 5) or Basic (Top 50) */
                <>
                  <Box padding="400" paddingTop="0">
                    <Banner tone="info">
                      <p>
                        You are active on the <strong>{currentPlan.toUpperCase()}</strong> plan. 
                        Displaying your top {maxMonitoredProducts} monitored store products.
                      </p>
                    </Banner>
                  </Box>

                  <IndexTable
                    resourceName={{ singular: "store product", plural: "store products" }}
                    itemCount={visibleStoreProducts.length}
                    selectable={false}
                    headings={[
                      { title: "Product" },
                      { title: "Status" },
                      { title: "Inventory" },
                      { title: "Alerts" }, // Added Alerts Header
                    ]}
                  >
                    {storeProductsRowMarkup}
                  </IndexTable>
                </>
              )}
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
};

export default Dashboard;