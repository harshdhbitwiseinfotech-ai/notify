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

// ── Helpers ────────────────────────────────────────────────────────────────────
function startOfPeriod(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function relativeTime(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const { default: prisma } = await import("../db.server.js");

  // ── Shopify products ──────────────────────────────────────────────────────
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

  // ── All subscribers ───────────────────────────────────────────────────────
  const allSubscribers = await prisma.backInStockSubscriber.findMany({
    where: { shop },
    orderBy: { createdAt: "asc" },
  });

  // ── Period boundaries ─────────────────────────────────────────────────────
  const now = new Date();
  const thisPeriodStart = startOfPeriod(30);   // last 30 days
  const lastPeriodStart = startOfPeriod(60);   // 30–60 days ago

  const inThisPeriod = (d) => new Date(d) >= thisPeriodStart;
  const inLastPeriod = (d) => new Date(d) >= lastPeriodStart && new Date(d) < thisPeriodStart;

  // New Subscribers
  const newSubsThis = allSubscribers.filter((s) => inThisPeriod(s.createdAt)).length;
  const newSubsLast = allSubscribers.filter((s) => inLastPeriod(s.createdAt)).length;

  // Notifications Sent
  const notifsThis = allSubscribers.filter((s) => s.notifiedAt && inThisPeriod(s.notifiedAt)).length;
  const notifsLast = allSubscribers.filter((s) => s.notifiedAt && inLastPeriod(s.notifiedAt)).length;

  // Avg. Delivery Time (hours between createdAt → notifiedAt for notified subs)
  const notifiedWithTimes = allSubscribers.filter(
    (s) => s.notified && s.notifiedAt && s.createdAt
  );
  const avgDelivery = (list) => {
    if (!list.length) return null;
    const hours =
      list.reduce(
        (sum, s) =>
          sum + (new Date(s.notifiedAt) - new Date(s.createdAt)) / 3_600_000,
        0
      ) / list.length;
    return Math.round(hours * 10) / 10;
  };

  const avgDelivThis = avgDelivery(
    notifiedWithTimes.filter((s) => inThisPeriod(s.notifiedAt))
  );
  const avgDelivLast = avgDelivery(
    notifiedWithTimes.filter((s) => inLastPeriod(s.notifiedAt))
  );

  // ── Helper: format change with sign ──────────────────────────────────────
  const fmtChange = (a, b) => {
    const diff = a - b;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  };
  const fmtPct = (a, b) => {
    if (!b) return a > 0 ? "+100%" : "0%";
    const pct = ((a - b) / b) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
  };

  // ── Performance Summary rows ──────────────────────────────────────────────
  const deliveryChangeHrs =
    avgDelivThis !== null && avgDelivLast !== null
      ? `${avgDelivThis - avgDelivLast >= 0 ? "+" : ""}${(avgDelivThis - avgDelivLast).toFixed(1)} hrs`
      : "N/A";
  const deliveryTrend =
    avgDelivThis !== null && avgDelivLast !== null
      ? avgDelivThis <= avgDelivLast
        ? { label: "Faster", tone: "success" }
        : { label: "Slower", tone: "critical" }
      : { label: "N/A", tone: "subdued" };

  const performanceSummary = [
    {
      metric: "New Subscribers",
      thisPeriod: newSubsThis,
      lastPeriod: newSubsLast,
      change: fmtChange(newSubsThis, newSubsLast),
      trend: fmtPct(newSubsThis, newSubsLast),
      toneUp: newSubsThis >= newSubsLast,
    },
    {
      metric: "Notifications Sent",
      thisPeriod: notifsThis,
      lastPeriod: notifsLast,
      change: fmtChange(notifsThis, notifsLast),
      trend: fmtPct(notifsThis, notifsLast),
      toneUp: notifsThis >= notifsLast,
    },
    {
      metric: "Avg. Delivery Time",
      thisPeriod: avgDelivThis !== null ? `${avgDelivThis} hrs` : "N/A",
      lastPeriod: avgDelivLast !== null ? `${avgDelivLast} hrs` : "N/A",
      change: deliveryChangeHrs,
      trend: deliveryTrend.label,
      trendTone: deliveryTrend.tone,
      customTrend: true,
    },
  ];

  // ── Product report rows ───────────────────────────────────────────────────
  const productStats = {};
  allSubscribers.forEach((sub) => {
    if (!productStats[sub.productId]) {
      productStats[sub.productId] = { subscribers: 0, notified: 0 };
    }
    productStats[sub.productId].subscribers++;
    if (sub.notified) productStats[sub.productId].notified++;
  });

  const reportRows = products
    .map(({ node }) => {
      const variant = node.variants.edges[0]?.node;
      const stats = productStats[node.id] || { subscribers: 0, notified: 0 };
      return {
        id: node.id,
        product: node.title,
        image: node.images.edges[0]?.node?.url || null,
        price: variant?.price ? `$${parseFloat(variant.price).toFixed(2)}` : "N/A",
        stock: variant?.inventoryQuantity ?? 0,
        subscribers: stats.subscribers,
        notified: stats.notified,
        status: (variant?.inventoryQuantity ?? 0) > 0 ? "in_stock" : "out_of_stock",
        lastRestocked: stats.notified > 0 ? "Recently" : "N/A",
      };
    })
    .filter((row) => row.subscribers > 0);

  // ── Recent Notification Activity (real — last 50 notified records) ────────
  const recentNotified = await prisma.backInStockSubscriber.findMany({
    where: { shop, notified: true },
    orderBy: { notifiedAt: "desc" },
    take: 50,
  });

  // Group by productId + same notifiedAt minute (batch) to show as one log entry
  const notificationLog = [];
  const seen = new Map(); // key = productId + minute bucket

  for (const sub of recentNotified) {
    const bucket = `${sub.productId}__${new Date(sub.notifiedAt).toISOString().substring(0, 16)}`;
    if (seen.has(bucket)) {
      seen.get(bucket).recipients++;
    } else {
      const entry = {
        id: `#N${String(notificationLog.length + 1000)}`,
        product: sub.productTitle || sub.productId,
        recipients: 1,
        sentAt: sub.notifiedAt,
        status: "Delivered", // if we recorded notifiedAt, it was delivered
      };
      seen.set(bucket, entry);
      notificationLog.push(entry);
    }
  }

  // ── Trend chart data ──────────────────────────────────────────────────────
  const generateTrend = (days) => {
    const arr = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().split("T")[0];
    });
    const map = {};
    arr.forEach(
      (day) =>
        (map[day] = {
          day:
            days === 7
              ? new Date(day).toLocaleDateString("en-US", { weekday: "short" })
              : new Date(day).getDate().toString(),
          subscribers: 0,
          notifications: 0,
        })
    );
    allSubscribers.forEach((sub) => {
      const cDay = new Date(sub.createdAt).toISOString().split("T")[0];
      if (map[cDay]) map[cDay].subscribers++;
      if (sub.notified && sub.notifiedAt) {
        const nDay = new Date(sub.notifiedAt).toISOString().split("T")[0];
        if (map[nDay]) map[nDay].notifications++;
      }
    });
    return Object.values(map);
  };

  const WEEKLY_DATA = generateTrend(7);
  const MONTHLY_DATA = generateTrend(30);

  return {
    reportRows,
    WEEKLY_DATA,
    MONTHLY_DATA,
    performanceSummary,
    notificationLog,
    // summary stat cards
    totalSubscribers: allSubscribers.length,
    totalNotified: allSubscribers.filter((s) => s.notified).length,
  };
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Reports() {
  const {
    reportRows,
    WEEKLY_DATA,
    MONTHLY_DATA,
    performanceSummary,
    notificationLog,
    totalSubscribers,
    totalNotified,
  } = useLoaderData();

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

  // ── Performance Summary DataTable rows ─────────────────────────────────────
  const performanceRows = performanceSummary.map((row) => [
    row.metric,
    row.thisPeriod,
    row.lastPeriod,
    row.change,
    row.customTrend ? (
      <Badge tone={row.trendTone}>{row.trend}</Badge>
    ) : (
      <Badge tone={row.toneUp ? "success" : "critical"}>{row.trend}</Badge>
    ),
  ]);

  // ── Notification Log DataTable rows (real data) ────────────────────────────
  const notificationRows = notificationLog.slice(0, 50).map((entry) => [
    entry.id,
    entry.product.length > 35 ? entry.product.substring(0, 35) + "…" : entry.product,
    `${entry.recipients} ${entry.recipients === 1 ? "customer" : "customers"}`,
    relativeTime(entry.sentAt),
    <Badge tone="success">Delivered</Badge>,
  ]);

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
        { content: "Refresh", icon: RefreshIcon, onAction: () => window.location.reload() },
      ]}
    >
      <Layout>
        {/* ── Summary Stats ── */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <StatCard
              label="Total Subscribers"
              value={totalSubscribers}
              trend={0}
              trendLabel="all time"
            />
            <StatCard
              label="Notifications Sent"
              value={totalNotified}
              trend={0}
              trendLabel="all time"
            />
            <StatCard
              label="Products Tracked"
              value={reportRows.length}
              trend={0}
              trendLabel="with subscribers"
            />
            <StatCard
              label="Notification Rate"
              value={
                totalSubscribers > 0
                  ? `${((totalNotified / totalSubscribers) * 100).toFixed(1)}%`
                  : "0%"
              }
              trend={0}
              trendLabel="notified / total"
            />
          </InlineGrid>
        </Layout.Section>

        {/* ── Tabs ── */}
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
                            <stop offset="5%" stopColor="#5700fa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#5700fa" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e0e0e0" }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="subscribers"
                          stroke="#008060"
                          fill="url(#subGrad)"
                          strokeWidth={2}
                          dot={false}
                          name="Subscribers"
                        />
                        <Area
                          type="monotone"
                          dataKey="notifications"
                          stroke="#5700fa"
                          fill="url(#notifGrad)"
                          strokeWidth={2}
                          dot={false}
                          name="Notifications"
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    <Divider />

                    {/* ── Performance Summary (real data) ── */}
                    <Text as="h3" variant="headingMd">Performance Summary</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Comparing last 30 days vs the previous 30 days using real store data.
                    </Text>
                    {performanceRows.length > 0 ? (
                      <DataTable
                        columnContentTypes={["text", "numeric", "numeric", "text", "text"]}
                        headings={["Metric", "This Period", "Last Period", "Change", "Trend"]}
                        rows={performanceRows}
                        hoverable
                      />
                    ) : (
                      <Banner tone="info">
                        <p>No data yet — performance metrics will appear once subscribers are recorded.</p>
                      </Banner>
                    )}
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
                      selectedItemsCount={
                        allResourcesSelected ? "All" : selectedResources.length
                      }
                      onSelectionChange={handleSelectionChange}
                      headings={[
                        { title: "Product" },
                        { title: "Price" },
                        { title: "Stock" },
                        { title: "Status" },
                        { title: "Subscribers" },
                        { title: "Notified" },
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
                                <Box
                                  background="bg-surface-secondary"
                                  borderRadius="200"
                                  padding="200"
                                >
                                  <Icon source={ProductIcon} tone="subdued" />
                                </Box>
                              )}
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {row.product.length > 35
                                  ? row.product.substring(0, 35) + "…"
                                  : row.product}
                              </Text>
                            </InlineStack>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {row.price}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text
                              as="span"
                              variant="bodyMd"
                              tone={row.stock > 0 ? "success" : "critical"}
                              fontWeight="semibold"
                            >
                              {row.stock}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{statusBadge(row.status)}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {row.subscribers}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {row.notified}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {row.lastRestocked}
                            </Text>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  )}
                </Box>
              )}

              {/* NOTIFICATION LOG (real data) */}
              {selectedTab === 2 && (
                <Box padding="400">
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingMd">
                          Recent Notification Activity
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Last {notificationLog.length} notification batches sent to customers
                        </Text>
                      </BlockStack>
                      <Button icon={ExportIcon} size="slim">
                        Export Log
                      </Button>
                    </InlineStack>

                    {notificationRows.length === 0 ? (
                      <Banner tone="info">
                        <p>
                          No notifications have been sent yet. Notifications are
                          sent automatically when a product comes back in stock.
                        </p>
                      </Banner>
                    ) : (
                      <DataTable
                        columnContentTypes={["text", "text", "text", "text", "text"]}
                        headings={[
                          "Notification ID",
                          "Product",
                          "Recipients",
                          "Sent",
                          "Status",
                        ]}
                        rows={notificationRows}
                        hoverable
                      />
                    )}
                  </BlockStack>
                </Box>
              )}
            </Tabs>
          </Card>
        </Layout.Section>

        {/* Footer Actions */}
        <Layout.Section>
          <InlineStack gap="300">
            <Button icon={ExportIcon} variant="primary">
              Export Full Report (CSV)
            </Button>
            <Button icon={EmailIcon}>Email Report</Button>
            <Button url="/app" variant="plain">
              ← Back to Dashboard
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
