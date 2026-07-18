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
import { ChevronUpIcon, ChevronDownIcon, LockIcon } from "@shopify/polaris-icons";
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
import { resolvePlanId, getFeaturesForPlan } from "../utils/planLimits";

const FEATURE_LOCK_COLORS = {
  red: "#ff0000",
  deepRed: "#d60000",
  danger: "#b91c1c",
  bright: "#692eac",
};

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

  const store = await prisma.store.findUnique({ where: { shop } });
  const planId = resolvePlanId(store?.plan || "free");
  const features = getFeaturesForPlan(planId);

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
  const last7Days = Array.from({length:90}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - i));
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
      productStats[sub.productId] = { name: sub.productTitle || "Unknown", subscriptions: 0, restocks: 0 };
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
    conversionData,
    features,
  };
};

const COLORS = ["#008060", "#ee00008e", "#D97706"];

function FeatureLock({ isLocked, title, upgradePlanText, children, borderColor = FEATURE_LOCK_COLORS.red }) {
  if (!isLocked) return <>{children}</>;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(3px)', opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </div>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        border: `4px solid ${borderColor}`,
        boxShadow: `0 16px 40px ${borderColor}33`,
        textAlign: 'center',
        padding: '24px',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        }}>
          <Icon source={LockIcon} tone="critical" />
        </div>
        <Text variant="headingMd" as="h3" style={{ marginBottom: '12px' }}>
          {title}
        </Text>
        <Text variant="bodySm" tone="subdued" as="p" style={{ marginBottom: '16px' }}>
          Available on {upgradePlanText} plan
        </Text>
        <Button onClick={() => window.location.href = '/app/subscription'}>Upgrade</Button>
      </div>
    </div>
  );
}

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

  const { trendData, productPerformance, conversionData, features } = data;

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
  };

  return (
    <Page
      title={
        <Text variant="heading2xl" as="h1" fontWeight="bold">
          📊 Analytics Dashboard
        </Text>
      }
    >
      <div style={{ position: 'relative' }}>
        <FeatureLock isLocked={!features.analytics} title="Advanced Reports" upgradePlanText="Basic" borderColor={FEATURE_LOCK_COLORS.bright}>
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
        {/* Product Performance */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Top Products by Subscriptions
                </Text>
                <ResponsiveContainer width="100%" height={420}>
                  <BarChart data={productPerformance} barCategoryGap="10%" barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                      height={20}
                    />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar dataKey="subscriptions" fill="#008060" radius={[8, 8, 0, 0]} barSize={24} />
                    <Bar dataKey="restocks" fill="#F59E0B" radius={[8, 8, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </BlockStack>
            </Box>
          </Card>
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
        </FeatureLock>
      </div>
    </Page>
  );
}
