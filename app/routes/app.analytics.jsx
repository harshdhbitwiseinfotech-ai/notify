import React, { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  InlineStack,
  BlockStack,
  SkeletonDisplayText,
  Badge,
  Button,
  Select,
  Divider,
  InlineGrid,
  Tooltip,
} from "@shopify/polaris";
import { ChevronUpIcon, ChevronDownIcon, ArrowLeftIcon } from "@shopify/polaris-icons";
import { Icon } from "@shopify/polaris";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Fetch products and their inventory data
  const productsResponse = await admin.graphql(
    `#graphql
    query getAnalyticsData {
      products(first: 100) {
        edges {
          node {
            id
            title
            variants(first: 20) {
              edges {
                node {
                  id
                  price
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
    `
  );

  const productsData = await productsResponse.json();
  const products = productsData.data?.products?.edges || [];

  // Generate mock analytics data
  const analyticsData = {
    totalSubscriptions: 324,
    activeSubscriptions: 287,
    restockedProducts: 45,
    notificationsSent: 892,
    conversionRate: 28.5,
    avgNotificationTime: 2.4,
    products: products.slice(0, 10),
  };

  return analyticsData;
};

const generateTrendData = () => {
  const data = [];
  for (let i = 0; i < 7; i++) {
    data.push({
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
      subscriptions: Math.floor(Math.random() * 150) + 50,
      notifications: Math.floor(Math.random() * 200) + 100,
    });
  }
  return data;
};

const generateProductPerformance = (products) => {
  return products.map((product, idx) => ({
    name: product.node.title.substring(0, 20),
    subscriptions: Math.floor(Math.random() * 50) + 10,
    restocks: Math.floor(Math.random() * 15) + 1,
  }));
};

const generateConversionData = () => {
  return [
    { name: "Converted", value: 28.5 },
    { name: "Pending", value: 45.3 },
    { name: "Ignored", value: 26.2 },
  ];
};

const COLORS = ["#008060", "#ee00008e", "#D97706"];

const MetricCard = ({ label, value, trend, icon }) => {
  const isPositive = trend >= 0;

  return (
    <Card>
      <Box padding="400">
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            {label}
          </Text>
          <InlineStack gap="200" align="center">
            <Text as="p" variant="headingLg" tone="success">
              {value}
            </Text>
            {trend !== null && (
              <InlineStack gap="100">
                <Icon
                  source={isPositive ? ChevronUpIcon : ChevronDownIcon}
                  tone={isPositive ? "success" : "critical"}
                />
                <Text
                  as="span"
                  tone={isPositive ? "success" : "critical"}
                  variant="bodySm"
                >
                  {Math.abs(trend)}%
                </Text>
              </InlineStack>
            )}
          </InlineStack>
        </BlockStack>
      </Box>
    </Card>
  );
};

export default function Analytics() {
  const data = useLoaderData();
  const [timeRange, setTimeRange] = useState("week");

  const trendData = useMemo(() => generateTrendData(), []);
  const productPerformance = useMemo(
    () => generateProductPerformance(data.products),
    [data.products]
  );
  const conversionData = useMemo(() => generateConversionData(), []);

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
  };

  return (
    <Page
      title={
        <Text variant="headingXl" as="h1">
          Analytics Dashboard
        </Text>
      }
      // backAction={{
      //   content: "Dashboard",
      //   url: "/app",
      //   icon: ArrowLeftIcon,
      //   style: { transform: 'scale(1.8)', marginRight: '5px' }
      // }}
      // compact
      // titleAlignment="left"
    >
      <Layout>
        <Layout.Section>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h4" variant="headingMd">
              Performance Overview
            </Text>
            <Select
              labelInline
              options={[
                { label: "Last 7 Days", value: "week" },
                { label: "Last 30 Days", value: "month" },
                { label: "Last 90 Days", value: "quarter" },
              ]}
              value={timeRange}
              onChange={handleTimeRangeChange}
            />
          </InlineStack>
        </Layout.Section>

        {/* Key Metrics Grid */}
        <Layout.Section>
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <MetricCard
                label="Total Subscriptions"
                value={data.totalSubscriptions}
                trend={12.5}
              />
              <MetricCard
                label="Active Subscriptions"
                value={data.activeSubscriptions}
                trend={8.3}
              />
              <MetricCard
                label="Products Restocked"
                value={data.restockedProducts}
                trend={15.2}
              />
              <MetricCard
                label="Notifications Sent"
                value={data.notificationsSent}
                trend={22.1}
              />
            </InlineGrid>
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              {/* Additional Metrics */}
              <MetricCard
                label="Conversion Rate"
                value={`${data.conversionRate}%`}
                trend={5.8}
              />
              <MetricCard
                label="Avg. Notification Time (hrs)"
                value={data.avgNotificationTime}
                trend={-2.1}
              />
            </InlineGrid>
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <Divider />
        </Layout.Section>

        {/* Subscription & Notification Trends */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Subscription & Notification Trends
                </Text>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="subscriptions"
                      stroke="#008060"
                      strokeWidth={2}
                      dot={{ fill: "#008060" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="notifications"
                      stroke="#0071E3"
                      strokeWidth={2}
                      dot={{ fill: "#0071E3" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Product Performance & Conversion Rate */}
        <Layout.Section>
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              {/* Product Performance */}
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">
                      Top Products by Subscriptions
                    </Text>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={productPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="subscriptions" fill="#008060" />
                        <Bar dataKey="restocks" fill="#F59E0B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </BlockStack>
                </Box>
              </Card>

              {/* Conversion Rate Pie Chart */}
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">
                      Notification Conversion
                    </Text>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={conversionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {conversionData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </BlockStack>
                </Box>
              </Card>
            </InlineGrid>
          </BlockStack>
        </Layout.Section>

        {/* Summary Cards */}
        <Layout.Section>
          <Divider />
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm">
              Quick Stats
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Notification Delivery Rate
                      </Text>
                      <Badge tone="success">94%</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd">
                      Successfully delivered notifications
                    </Text>
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Bounce Rate
                      </Text>
                      <Badge tone="info">3.2%</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd">
                      Failed notification attempts
                    </Text>
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Avg. Response Time
                      </Text>
                      <Badge tone="success">2.4hrs</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd">
                      Time from restock to notification
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            </InlineGrid>
          </BlockStack>
        </Layout.Section>

        {/* Action Buttons */}
        <Layout.Section>
          <InlineStack gap="400">
            <Button url="/app/reports" variant="secondary">
              View Detailed Reports
            </Button>
            <Button url="/app" variant="secondary">
              Back to Dashboard
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
