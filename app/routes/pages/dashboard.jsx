import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Grid,
  Card,
  Text,
  IndexTable,
  Badge,
  Spinner,
  Box,
  InlineStack,
  Thumbnail,
} from "@shopify/polaris";

const Dashboard = ({ stats, products = [], storeProducts = [] }) => {

  // Define headings for the Polaris IndexTable
  const resourceName = {
    singular: "product request",
    plural: "product requests",
  };

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
      <IndexTable.Cell>
        {item.createdAt}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));


  const storeProductsRowMarkup = (storeProducts || []).map((item, index) => (
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
    </IndexTable.Row>
  ));

  // UI
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
                    {stats.totalRequests}
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
                    {stats.pending}
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
                    {stats.notified}
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
          </Card>
        </Layout.Section>
        
        {/* STORE PRODUCTS TABLE */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text variant="headingMd" as="h2">
                🛍️ Store Products (Inventory Status)
              </Text>
            </Box>

            <IndexTable
              resourceName={{ singular: "store product", plural: "store products" }}
              itemCount={(storeProducts || []).length}
              selectable={false}
              headings={[
                { title: "Product" },
                { title: "Status" },
                { title: "Inventory" },
              ]}
            >
              {storeProductsRowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default Dashboard;

