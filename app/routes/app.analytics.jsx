import React, { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  InlineStack,
  BlockStack,
  Badge,
  Button,
  Select,
  Divider,
  InlineGrid
} from "@shopify/polaris";
import { ChevronUpIcon, ChevronDownIcon } from "@shopify/polaris-icons";
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
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const totalSubscriptions = await prisma.backInStockSubscriber.count({ where: { shop } });
  const activeSubscriptions = await prisma.backInStockSubscriber.count({ where: { shop, notified: false } });
  const notificationsSent = await prisma.backInStockSubscriber.count({ where: { shop, notified: true } });

  const allSubscribers = await prisma.backInStockSubscriber.findMany({
    where: { shop },
    orderBy: { createdAt: 'asc' }
  });

  // Calculate Restocked Products (unique products that had a notification sent)
  const restockedProductsSet = new Set();
  allSubscribers.forEach(sub => {
    if (sub.notified) {
      restockedProductsSet.add(sub.productId);
    }
  });
  const restockedProducts = restockedProductsSet.size;

  // Calculate Conversion Rate (percentage of notified vs total)
  let conversionRate = 0;
  if (totalSubscriptions > 0) {
    conversionRate = ((notificationsSent / totalSubscriptions) * 100).toFixed(1);
  }

  // Generate Trend Data (Last 7 days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  
  const trendDataMap = {};
  last7Days.forEach(day => {
    const dateObj = new Date(day);
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];
    trendDataMap[day] = { day: dayName, subscriptions: 0, notifications: 0 };
  });

  allSubscribers.forEach(sub => {
    const createdDay = new Date(sub.createdAt).toISOString().split('T')[0];
    if (trendDataMap[createdDay]) {
      trendDataMap[createdDay].subscriptions++;
    }
    
    if (sub.notified && sub.notifiedAt) {
      const notifiedDay = new Date(sub.notifiedAt).toISOString().split('T')[0];
      if (trendDataMap[notifiedDay]) {
        trendDataMap[notifiedDay].notifications++;
      }
    }
  });
  
  const trendData = Object.values(trendDataMap);

  // Generate Product Performance (Top 5)
  const productStats = {};
  allSubscribers.forEach(sub => {
    if (!productStats[sub.productId]) {
      productStats[sub.productId] = { name: (sub.productTitle || "Unknown").substring(0, 20), subscriptions: 0, restocks: 0 };
    }
    productStats[sub.productId].subscriptions++;
    if (sub.notified) {
       productStats[sub.productId].restocks++;
    }
  });

  const productPerformance = Object.values(productStats)
    .sort((a, b) => b.subscriptions - a.subscriptions)
    .slice(0, 5);

  // Generate Conversion Data for Pie Chart
  const conversionData = [
    { name: "Converted (Notified)", value: notificationsSent },
    { name: "Pending", value: activeSubscriptions },
  ];

  return {
    totalSubscriptions,
    activeSubscriptions,
    restockedProducts,
    notificationsSent,
    conversionRate,
    avgNotificationTime: 2.4, // placeholder
    trendData,
    productPerformance,
    conversionData
  };
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

  const { trendData, productPerformance, conversionData } = data;

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
                { label: "Last 7 Days", value: "week" } ,
                { label: "Last 30 Days", value: "month" } ,
                { label: "Last 90 Days", value: "month" }
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
                  Subscription & Notification Trends (Last 7 Days)
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
                        <YAxis allowDecimals={false} />
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
                          label={({ name, value }) => `${name}: ${value}`}
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
