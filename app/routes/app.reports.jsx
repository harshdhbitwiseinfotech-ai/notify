import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLoaderData, useSubmit, useActionData, useNavigation, useRevalidator } from "react-router";
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
import { resolvePlanId, getFeaturesForPlan } from "../utils/planLimits";
import PDFReportTemplate from "../components/PDFReportTemplate.jsx";

const FEATURE_LOCK_COLORS = {
  red: "#ff0000",
  deepRed: "#d60000",
  danger: "#b91c1c",
  bright: "#692eac",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function startOfPeriod(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

import { getTransporter } from "../utils/emailService.js";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "emailPDF") {
    const pdfBase64 = formData.get("pdfBase64");
    if (!pdfBase64) return { error: "No PDF data provided" };

    try {
      // Get shop email
      const response = await admin.graphql(`
        query {
          shop {
            email
          }
        }
      `);
      const data = await response.json();
      const shopEmail = data.data.shop.email;

      // Extract base64 part
      const base64Data = pdfBase64.replace(/^data:application\/pdf;filename=generated\.pdf;base64,/, "").replace(/^data:image\/.*;base64,/, "").replace(/^data:application\/.*;base64,/, "");
      
      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch (err) {
        return { error: "Invalid PDF encoding" };
      }

      const transporter = await getTransporter();
      
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Back In Stock" <noreply@your-app.com>',
        to: shopEmail,
        subject: "Store Subscription & Notifications Performance Report",
        text: "Please find your attached performance report PDF.",
        html: "<p>Please find your attached performance report PDF.</p>",
        attachments: [
          {
            filename: "Store_Performance_Report.pdf",
            content: buffer,
            contentType: "application/pdf"
          }
        ]
      };
      
      await transporter.sendMail(mailOptions);
      return { success: true, message: "PDF Report emailed to " + shopEmail };
    } catch (error) {
      console.error("Failed to email PDF:", error);
      return { error: "Failed to send email" };
    }
  }

  return null;
};

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

  const store = await prisma.store.findUnique({ where: { shop } });
  const planId = resolvePlanId(store?.plan || "free");
  const features = getFeaturesForPlan(planId);

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
    features,
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
        minWidth: '260px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '8px', fontSize: '24px', lineHeight: '1' }}>
          🔒
        </div>
        <Text variant="headingMd" as="h3">{title}</Text>
        <div style={{ marginTop: '4px' }}>
          <Text variant="bodySm" tone="subdued">Available on {upgradePlanText} plan</Text>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Reports() {
  const submit = useSubmit();
  const { revalidate, state: revalState } = useRevalidator();
  const actionData = useActionData();
  const navigation = useNavigation();
  
  useEffect(() => {
    if (actionData?.success && actionData?.message) {
      if (typeof shopify !== 'undefined' && shopify.toast) {
        shopify.toast.show("PDF sent successfully", { isError: false });
      }
    } else if (actionData?.error) {
      if (typeof shopify !== 'undefined' && shopify.toast) {
        shopify.toast.show("Failed to send PDF", { isError: true });
      }
    }
  }, [actionData]);

  const isEmailing = navigation.state === "submitting" && navigation.formData?.get("actionType") === "emailPDF";
  
  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const pdf = new jsPDF('p', 'px', [800, 1130]); // approximate A4 ratio in px
    const pdfPages = ['pdf-page-1', 'pdf-page-2', 'pdf-page-3'];
    
    // Temporarily show container
    const container = document.getElementById('pdf-report-container');
    if (!container) return;
    container.style.display = 'block';
    
    try {
      for (let i = 0; i < pdfPages.length; i++) {
        const pageEl = document.getElementById(pdfPages[i]);
        if (!pageEl) continue;
        
        const canvas = await html2canvas(pageEl, { scale: 1 });
        const imgData = canvas.toDataURL('image/jpeg', 0.7);
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      const pdfBase64 = pdf.output('datauristring');
      
      const formData = new FormData();
      formData.append("actionType", "emailPDF");
      formData.append("pdfBase64", pdfBase64);
      
      submit(formData, { method: "post" });
    } catch (e) {
      console.error(e);
    } finally {
      container.style.display = 'none';
    }
  };

  const {
    reportRows,
    WEEKLY_DATA,
    MONTHLY_DATA,
    performanceSummary,
    notificationLog,
    features,
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
        <Text variant="heading2xl" as="h1" fontWeight="bold">
          📋 Reports
        </Text>
      }
      primaryAction={{
        content: isEmailing ? "Sending Email..." : "Export Report",
        icon: ExportIcon,
        onAction: exportPDF,
        loading: isEmailing,
      }}
      secondaryActions={[
        { content: "Refresh", icon: RefreshIcon, onAction: () => revalidate(), loading: revalState === "loading" },
      ]}
    >
      {actionData?.success && (
        <div style={{ marginBottom: "16px" }}>
          <Banner title="Report Sent" tone="success">
            <p>{actionData.message}</p>
          </Banner>
        </div>
      )}
      {actionData?.error && (
        <div style={{ marginBottom: "16px" }}>
          <Banner title="Failed to send report" tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        </div>
      )}
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
                  <FeatureLock isLocked={!features.analytics} title="Advanced Reports" upgradePlanText="Basic" borderColor={FEATURE_LOCK_COLORS.deepRed}>
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
                </FeatureLock>
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
                  <FeatureLock isLocked={!features.notificationLog} title="Recent Notification Activity" upgradePlanText="Pro" borderColor={FEATURE_LOCK_COLORS.deepRed}>
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
                  </FeatureLock>
                </Box>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
      <PDFReportTemplate 
        totalSubscribers={totalSubscribers}
        totalNotified={totalNotified}
        reportRows={reportRows}
        performanceSummary={performanceSummary}
        chartData={chartData}
        notificationLog={notificationLog}
        relativeTime={relativeTime}
      />
    </Page>
  );
}
