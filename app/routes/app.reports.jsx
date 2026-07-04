import React, { useState, useCallback, useMemo } from "react";
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
  Badge,
  Button,
  Select,
  Divider,
  InlineGrid,
  IndexTable,
  useIndexResourceState,
  Filters,
  ChoiceList,
  EmptyState,
  Tabs,
  DataTable,
  Icon,
  Banner,
} from "@shopify/polaris";
import {
  ExportIcon,
  RefreshIcon,
  EmailIcon,
  ProductIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@shopify/polaris-icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const productsResponse = await admin.graphql(
    `#graphql
    query getReportsData {
      products(first: 50) {
        edges {
          node {
            id
            title
            images(first: 1) {
              edges {
                node { url }
              }
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
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

  const data = await productsResponse.json();
  const products = data.data?.products?.edges || [];

  const reportRows = products.slice(0, 20).map(({ node }) => {
    const variant = node.variants.edges[0]?.node;
    const subscribers = Math.floor(Math.random() * 80) + 5;
    const notified = Math.floor(subscribers * (Math.random() * 0.6 + 0.3));
    const converted = Math.floor(notified * (Math.random() * 0.4 + 0.1));
    return {
      id: node.id,
      product: node.title,
      image: node.images.edges[0]?.node?.url || null,
      price: variant?.price ? `$${parseFloat(variant.price).toFixed(2)}` : "N/A",
      stock: variant?.inventoryQuantity ?? 0,
      subscribers,
      notified,
      converted,
      conversionRate: notified > 0 ? ((converted / notified) * 100).toFixed(1) : "0.0",
      status: (variant?.inventoryQuantity ?? 0) > 0 ? "in_stock" : "out_of_stock",
      lastRestocked: `${Math.floor(Math.random() * 30) + 1}d ago`,
    };
  });

  return { reportRows };
};

const WEEKLY_DATA = [
  { day: "Mon", subscribers: 42, notifications: 68, conversions: 18 },
  { day: "Tue", subscribers: 55, notifications: 80, conversions: 22 },
  { day: "Wed", subscribers: 38, notifications: 55, conversions: 14 },
  { day: "Thu", subscribers: 70, notifications: 95, conversions: 30 },
  { day: "Fri", subscribers: 65, notifications: 88, conversions: 26 },
  { day: "Sat", subscribers: 80, notifications: 110, conversions: 38 },
  { day: "Sun", subscribers: 48, notifications: 72, conversions: 20 },
];

const MONTHLY_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`,
  subscribers: Math.floor(Math.random() * 120) + 30,
  notifications: Math.floor(Math.random() * 180) + 60,
  conversions: Math.floor(Math.random() * 50) + 10,
}));

function StatCard({ label, value, trend, trendLabel }) {
  const isUp = trend >= 0;
  return (
    <Card>
      <Box padding="400">
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" tone="subdued">
            {label}
          </Text>
          <InlineStack gap="300" blockAlign="center">
            <Text as="p" variant="headingXl" fontWeight="bold">
              {value}
            </Text>
            <InlineStack gap="100" blockAlign="center">
              <Icon
                source={isUp ? ChevronUpIcon : ChevronDownIcon}
                tone={isUp ? "success" : "critical"}
              />
              <Text as="span" variant="bodySm" tone={isUp ? "success" : "critical"}>
                {Math.abs(trend)}%
              </Text>
            </InlineStack>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {trendLabel}
          </Text>
        </BlockStack>
      </Box>
    </Card>
  );
}

function statusBadge(status) {
  return status === "in_stock" ? (
    <Badge tone="success">In Stock</Badge>
  ) : (
    <Badge tone="critical">Out of Stock</Badge>
  );
}

export default function Reports() {
  const { reportRows } = useLoaderData();

  const [selectedTab, setSelectedTab] = useState(0);
  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "products", content: "Product Report" },
    { id: "notifications", content: "Notification Log" },
  ];

  const [timeRange, setTimeRange] = useState("week");
  const chartData = timeRange === "week" ? WEEKLY_DATA : MONTHLY_DATA;

  const [queryValue, setQueryValue] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);

  const handleClearAll = useCallback(() => {
    setQueryValue("");
    setStatusFilter([]);
  }, []);

  const filters = [
    {
      key: "status",
      label: "Stock Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "In Stock", value: "in_stock" },
            { label: "Out of Stock", value: "out_of_stock" },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = statusFilter.length
    ? [
        {
          key: "status",
          label: `Status: ${statusFilter.join(", ")}`,
          onRemove: () => setStatusFilter([]),
        },
      ]
    : [];

  const filteredRows = useMemo(() => {
    let rows = reportRows;
    if (queryValue) {
      rows = rows.filter((r) =>
        r.product.toLowerCase().includes(queryValue.toLowerCase())
      );
    }
    if (statusFilter.length) {
      rows = rows.filter((r) => statusFilter.includes(r.status));
    }
    return rows;
  }, [reportRows, queryValue, statusFilter]);

  const resourceName = { singular: "product", plural: "products" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredRows);

  const notificationRows = useMemo(
    () =>
      reportRows.slice(0, 15).map((r, idx) => [
        `#N${1000 + idx}`,
        r.product.substring(0, 30),
        `${Math.floor(Math.random() * 20) + 1} customers`,
        `${Math.floor(Math.random() * 5) + 1}h ago`,
        Math.random() > 0.15 ? (
          <Badge tone="success">Delivered</Badge>
        ) : (
          <Badge tone="warning">Pending</Badge>
        ),
      ]),
    [reportRows]
  );

  return (
    <Page
      title={
        <Text variant="headingXl" as="h1">
          Reports
        </Text>
      }
      primaryAction={
        <Button icon={ExportIcon} variant="primary">
          Export CSV
        </Button>
      }
      secondaryActions={[
        { content: "Refresh", icon: RefreshIcon, onAction: () => {} },
      ]}
    >
      <Layout>
        {/* Summary Stats */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <StatCard
              label="Total Subscribers"
              value={reportRows.reduce((s, r) => s + r.subscribers, 0)}
              trend={14.2}
              trendLabel="vs last period"
            />
            <StatCard
              label="Notifications Sent"
              value={reportRows.reduce((s, r) => s + r.notified, 0)}
              trend={9.8}
              trendLabel="vs last period"
            />
            <StatCard
              label="Conversions"
              value={reportRows.reduce((s, r) => s + r.converted, 0)}
              trend={22.5}
              trendLabel="vs last period"
            />
            <StatCard
              label="Avg. Conversion Rate"
              value={`${(
                reportRows.reduce(
                  (s, r) => s + parseFloat(r.conversionRate),
                  0
                ) / Math.max(reportRows.length, 1)
              ).toFixed(1)}%`}
              trend={5.1}
              trendLabel="vs last period"
            />
          </InlineGrid>
        </Layout.Section>

        {/* Tabs */}
        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {/* OVERVIEW */}
              {selectedTab === 0 && (
                <Box padding="400">
                  <BlockStack gap="500">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingMd">
                        Subscription &amp; Notification Trends
                      </Text>
                      <Select
                        labelInline
                        label="Period"
                        options={[
                          { label: "Last 7 Days", value: "week" },
                          { label: "Last 30 Days", value: "month" },
                        ]}
                        value={timeRange}
                        onChange={setTimeRange}
                      />
                    </InlineStack>

                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#008060" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#008060" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="notifGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0071E3" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e0e0e0" }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="subscribers" stroke="#008060" fill="url(#subGrad)" strokeWidth={2} dot={false} name="Subscribers" />
                        <Area type="monotone" dataKey="notifications" stroke="#0071E3" fill="url(#notifGrad)" strokeWidth={2} dot={false} name="Notifications" />
                        <Area type="monotone" dataKey="conversions" stroke="#D97706" fill="url(#convGrad)" strokeWidth={2} dot={false} name="Conversions" />
                      </AreaChart>
                    </ResponsiveContainer>

                    <Divider />

                    <Text as="h3" variant="headingMd">Performance Summary</Text>
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric", "numeric", "text"]}
                      headings={["Metric", "This Period", "Last Period", "Change", "Trend"]}
                      rows={[
                        ["New Subscribers", "324", "285", "+39", <Badge tone="success">+13.7%</Badge>],
                        ["Notifications Sent", "892", "756", "+136", <Badge tone="success">+18.0%</Badge>],
                        ["Conversions", "254", "208", "+46", <Badge tone="success">+22.1%</Badge>],
                        ["Avg. Delivery Time", "2.4 hrs", "3.1 hrs", "-0.7 hrs", <Badge tone="success">Faster</Badge>],
                        ["Bounce Rate", "3.2%", "4.8%", "-1.6%", <Badge tone="success">Better</Badge>],
                      ]}
                    />
                  </BlockStack>
                </Box>
              )}

              {/* PRODUCT REPORT */}
              {selectedTab === 1 && (
                <Box>
                  <Box padding="400">
                    <Filters
                      queryValue={queryValue}
                      queryPlaceholder="Search products…"
                      filters={filters}
                      appliedFilters={appliedFilters}
                      onQueryChange={setQueryValue}
                      onQueryClear={() => setQueryValue("")}
                      onClearAll={handleClearAll}
                    />
                  </Box>

                  {filteredRows.length === 0 ? (
                    <Box padding="800">
                      <EmptyState
                        heading="No products match your filters"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Try adjusting your search or filter criteria.</p>
                      </EmptyState>
                    </Box>
                  ) : (
                    <IndexTable
                      resourceName={resourceName}
                      itemCount={filteredRows.length}
                      selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                      onSelectionChange={handleSelectionChange}
                      headings={[
                        { title: "Product" },
                        { title: "Price" },
                        { title: "Stock" },
                        { title: "Status" },
                        { title: "Subscribers" },
                        { title: "Notified" },
                        { title: "Converted" },
                        { title: "Conv. Rate" },
                        { title: "Last Restocked" },
                      ]}
                    >
                      {filteredRows.map((row, index) => (
                        <IndexTable.Row
                          id={row.id}
                          key={row.id}
                          selected={selectedResources.includes(row.id)}
                          position={index}
                        >
                          <IndexTable.Cell>
                            <InlineStack gap="300" blockAlign="center">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt={row.product}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 6,
                                    objectFit: "cover",
                                    border: "1px solid #e0e0e0",
                                  }}
                                />
                              ) : (
                                <Box background="bg-surface-secondary" borderRadius="200" padding="200">
                                  <Icon source={ProductIcon} tone="subdued" />
                                </Box>
                              )}
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {row.product.length > 35 ? row.product.substring(0, 35) + "…" : row.product}
                              </Text>
                            </InlineStack>
                          </IndexTable.Cell>
                          <IndexTable.Cell><Text as="span" variant="bodyMd">{row.price}</Text></IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd" tone={row.stock > 0 ? "success" : "critical"} fontWeight="semibold">
                              {row.stock}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{statusBadge(row.status)}</IndexTable.Cell>
                          <IndexTable.Cell><Text as="span" variant="bodyMd">{row.subscribers}</Text></IndexTable.Cell>
                          <IndexTable.Cell><Text as="span" variant="bodyMd">{row.notified}</Text></IndexTable.Cell>
                          <IndexTable.Cell><Text as="span" variant="bodyMd" tone="success">{row.converted}</Text></IndexTable.Cell>
                          <IndexTable.Cell>
                            <Badge tone={parseFloat(row.conversionRate) >= 20 ? "success" : parseFloat(row.conversionRate) >= 10 ? "warning" : "critical"}>
                              {row.conversionRate}%
                            </Badge>
                          </IndexTable.Cell>
                          <IndexTable.Cell><Text as="span" variant="bodySm" tone="subdued">{row.lastRestocked}</Text></IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  )}
                </Box>
              )}

              {/* NOTIFICATION LOG */}
              {selectedTab === 2 && (
                <Box padding="400">
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingMd">Recent Notification Activity</Text>
                      <Button icon={ExportIcon} size="slim">Export Log</Button>
                    </InlineStack>
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={["Notification ID", "Product", "Recipients", "Sent", "Status"]}
                      rows={notificationRows}
                      hoverable
                    />
                  </BlockStack>
                </Box>
              )}
            </Tabs>
          </Card>
        </Layout.Section>

        {/* Footer Actions */}
        <Layout.Section>
          <InlineStack gap="300">
            <Button icon={ExportIcon} variant="primary">Export Full Report (CSV)</Button>
            <Button icon={EmailIcon}>Email Report</Button>
            <Button url="/app" variant="plain">← Back to Dashboard</Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
