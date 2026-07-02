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

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    pending: 0,
    notified: 0,
  });

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  
  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/dashboard/summary");
      const data = await res.json();

      setStats(data.stats);
      setProducts(data.products);

      setLoading(false);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
        {new Date(item.createdAt).toLocaleString()}
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
                📊 Product Requests
              </Text>
            </Box>

            {loading ? (
              <Box padding="800">
                <InlineStack align="center">
                  <Spinner size="medium" hasFocusableParent={false} />
                </InlineStack>
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
      </Layout>
    </Page>
  );
};

export default Dashboard;

