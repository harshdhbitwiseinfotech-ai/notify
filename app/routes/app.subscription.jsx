import React, { useState, useCallback } from "react";
import { useLoaderData, useFetcher, useSubmit, redirect } from "react-router";
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
  Divider,
  InlineGrid,
  Banner,
  List,
  Icon,
  Modal,
  TextContainer,
  CalloutCard,
  ProgressBar,
  DataTable,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  LockIcon,
  RefreshIcon,
  ExternalIcon,
} from "@shopify/polaris-icons";
import { resolvePlanId, getLimitsForPlan, getShopUsage } from "../utils/planLimits";

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ── BYPASS SHOPIFY BILLING FOR TESTING ────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      plan: "Free",
      isActive: true,
    },
  });

  const activeSubscriptionName = (!store.plan || store.plan === "none") ? "Free" : store.plan;
  const planId = resolvePlanId(activeSubscriptionName);
  const limits = getLimitsForPlan(planId);

  // ── Real usage from database ───────────────────────────────────────────────
  const usageThisMonth = await getShopUsage(prisma, shop);

  // ── Billing details ────────────────────────────────────────────────────────
  let nextBillingDate = "-";
  let price = 0;
  let billingCycleLabel = "monthly";

  if (activeSubscriptionName && activeSubscriptionName !== "Free") {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextBillingDate = nextMonth.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    billingCycleLabel = activeSubscriptionName.includes("Yearly") ? "yearly" : "monthly";

    // Map plan → price
    const priceMap = {
      "Basic Monthly": 9.99,
      "Basic Yearly": 7.99,
      "Pro Monthly": 19.99,
      "Pro Yearly": 15.99,
      "Enterprise Monthly": 39.99,
      "Enterprise Yearly": 31.99,
    };
    price = priceMap[activeSubscriptionName] ?? 0;
  }

  // ── Mock invoices for bypass ───────────────────────────────────────────────
  const invoices = [];

  const currentPlan = {
    id: planId,
    name: activeSubscriptionName,
    status: activeSubscriptionName === "Free" ? "free" : "active",
    billingCycle: billingCycleLabel,
    price,
    nextBillingDate,
    usageThisMonth,
    limits,
  };

  return { currentPlan, invoices };
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan");
  const actionType = formData.get("actionType");
  const shop = session.shop;

  const ALL_PLANS = [
    "Basic Monthly",
    "Basic Yearly",
    "Pro Monthly",
    "Pro Yearly",
    "Enterprise Monthly",
    "Enterprise Yearly",
  ];

  // ── Cancel / downgrade to Free ─────────────────────────────────────────────
  if (actionType === "cancel" || plan === "Free") {
    await prisma.store.update({
      where: { shop },
      data: { plan: "Free" }
    });
    return redirect("/app/subscription");
  }

  // ── Subscribe to a paid plan ───────────────────────────────────────────────
  if (!plan || !ALL_PLANS.includes(plan)) {
    return { success: false, error: "Invalid plan selected." };
  }

  try {
    // BYPASS FOR TESTING
    await prisma.store.update({
      where: { shop },
      data: { plan: plan }
    });
    return redirect("/app/subscription");
  } catch (e) {
    console.error("[subscription/action] billing error:", e);
    return { success: false, error: "Failed to update plan." };
  }
};

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: null,
    description: "Perfect for stores just getting started with back-in-stock alerts.",
    color: "#637381",
    features: [
      { label: "Up to 35 subscribers", included: true },
      { label: "25 notifications/month", included: true },
      { label: "Email notifications", included: true },
      { label: "Analytics dashboard", included: false },
      { label: "Recent Notification Activity", included: false },
      { label: "Cutomize widget", included: false },
      { label: "Edit Emails Templates", included: false },
    ],
    limits: { subscribers: 35, notifications: 25 },
  },
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: 9.99,
    yearlyPrice: 7.99,
    badge: null,
    description: "Great for growing stores with regular restock cycles.",
    color: "#008060",
    features: [
      { label: "Up to 100 subscribers", included: true },
      { label: "1,000 notifications/month", included: true },
      { label: "Email notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Recent Notification Activity", included: false },
      { label: "cutomize widget", included: true },
      { label: "Edit Emails Templates", included: false },
    ],
    limits: { subscribers: 500, notifications: 1000 },
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 19.99,
    yearlyPrice: 15.99,
    badge: "Most Popular",
    description: "For scaling stores that need powerful automation and insights.",
    color: "#0071E3",
    features: [
      { label: "Up to 5,000 subscribers", included: true },
      { label: "10,000 notifications/month", included: true },
      { label: "Email notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Recent Notification Activity", included: true },
      { label: "cutomize widget", included: true },
      { label: "Edit Emails Templates", included: true },
    ],
    limits: { subscribers: 5000, notifications: 10000 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 39.99,
    yearlyPrice: 31.99,
    badge: "Best Value",
    description: "Full power for high-volume stores with dedicated support.",
    color: "#6D28D9",
    features: [
      { label: "Unlimited subscribers", included: true },
      { label: "Unlimited notifications", included: true },
      { label: "Email notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Recent Notification Activity", included: true },
      { label: "cutomize widget", included: true },
      { label: "Edit Emails Templates", included: true },
    ],
    limits: { subscribers: null, notifications: null },
  },
];

// ── Feature Row Component ─────────────────────────────────────────────────────
function FeatureRow({ label, included }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", width: "100%" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: included ? "#94a3b8" : "transparent",
        border: included ? "none" : "1px solid #cbd5e1",
        color: included ? "#fff" : "#cbd5e1",
        flexShrink: 0,
      }}>
        {included ? (
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: "12px", color: included ? "inherit" : "#64748B", textAlign: "right", lineHeight: "1.2" }}>
        {label}
      </span>
    </div>
  );
}

// ── Plan Card Component ───────────────────────────────────────────────────────
function PlanCard({ plan, isCurrentPlan, billingCycle, onSelect }) {
  const price =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isFree = price === 0;

  const isPro = plan.id === "pro";

  return (
    <div
      style={{
        border: isPro
          ? `2px solid #64748B`
          : "none",
        borderRadius: 12,
        position: "relative",
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Badge */}
      {plan.badge && (
        <div
          style={{
            position: "absolute",
            top: -14,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#475569",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 16px",
            borderRadius: 16,
            textAlign: "center",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {plan.badge}
        </div>
      )}
      <div style={{ padding: "32px 24px 24px", display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <BlockStack gap="200">
          <Text as="h3" variant="headingLg" fontWeight="medium">
            {plan.name}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {plan.description}
          </Text>
        </BlockStack>

        <div style={{ marginTop: "24px", marginBottom: "24px" }}>
          <span style={{ fontSize: "36px", fontWeight: "600", color: "#000", letterSpacing: "-0.5px" }}>
            {isFree ? "Free" : `$${price}`}
          </span>
          {!isFree && (
            <span style={{ fontSize: "14px", color: "#64748B", marginLeft: "4px" }}>
              / month
            </span>
          )}
        </div>

        <div style={{ marginBottom: "24px", borderBottom: "1px solid #f1f5f9" }}></div>

        <BlockStack gap="300">
          {plan.features.map((f, i) => (
            <FeatureRow key={i} label={f.label} included={f.included} />
          ))}
        </BlockStack>

        <div style={{ marginTop: "auto", paddingTop: "32px", position: "relative", zIndex: 10 }}>
          <button
            type="button"
            onClick={() => {
              if (!isCurrentPlan) onSelect(plan);
            }}
            disabled={isCurrentPlan}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: isCurrentPlan ? "default" : "pointer",
              background: isCurrentPlan ? "#fff" : "#000000ff",
              color: isCurrentPlan ? "#000000ff" : "#fff",
              border: isCurrentPlan ? "1px solid #000000ff" : "none",
              transition: "all 0.2s",
              opacity: isCurrentPlan ? 0.7 : 1,
              position: "relative",
              zIndex: 10,
              pointerEvents: "auto",
            }}
          >
            {isCurrentPlan ? "Current Plan" : plan.id === "free" ? "Downgrade to Free" : `Upgrade to ${plan.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Usage Bar ─────────────────────────────────────────────────────────────────
function UsageBar({ label, used, limit }) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const tone = pct >= 90 ? "critical" : "highlight";
  const isOver = !isUnlimited && used >= limit;

  return (
    <BlockStack gap="150">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">
          {label}
        </Text>
        <InlineStack gap="100" blockAlign="center">
          <Text as="span" variant="bodySm" tone={isOver ? "critical" : "subdued"}>
            {String(used)} / {isUnlimited ? "∞" : String(limit)}
          </Text>
          {isOver && (
            <Badge tone="critical">Over Limit</Badge>
          )}
        </InlineStack>
      </InlineStack>
      <ProgressBar progress={isUnlimited ? 0 : pct} tone={tone} size="small" />
    </BlockStack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Subscription() {
  const { currentPlan, invoices } = useLoaderData();
  const submit = useSubmit();
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [cancelModal, setCancelModal] = useState(false);

  // Determine if any limit is exceeded
  const limits = currentPlan.limits;
  const usage = currentPlan.usageThisMonth;
  const subscribersOver = limits.subscribers !== null && usage.subscribers >= limits.subscribers;
  const notificationsOver = limits.notifications !== null && usage.notifications >= limits.notifications;
  const anyLimitExceeded = subscribersOver || notificationsOver;

  const handlePlanSelect = useCallback((plan) => {
    if (plan.id === "free") {
      submit({ actionType: "cancel" }, { method: "post" });
    } else {
      const planName = `${plan.name} ${billingCycle === "monthly" ? "Monthly" : "Yearly"}`;
      submit({ plan: planName, actionType: "subscribe" }, { method: "post" });
    }
  }, [billingCycle, submit]);

  const currentPlanDef = PLANS.find((p) => p.id === currentPlan.id) || PLANS[0];

  const invoiceRows = invoices.map((inv) => [
    inv.id,
    inv.date,
    inv.amount,
    <Badge tone={inv.status === "paid" ? "success" : "warning"}>
      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
    </Badge>,
    <Button size="slim" icon={ExternalIcon} variant="plain">
      Download
    </Button>,
  ]);

  // Billing details display
  const billingCycleDisplay =
    currentPlan.billingCycle === "yearly" ? "Yearly" : "Monthly";

  const priceDisplay =
    currentPlan.id === "free"
      ? "$0/mo"
      : currentPlan.billingCycle === "yearly"
        ? `$${currentPlan.price}/mo (billed yearly)`
        : `$${currentPlan.price}/mo`;

  return (
    <Page
      title={
        <Text variant="heading2xl" as="h1" fontWeight="bold">
          🛡️ Plans &amp; Billing
        </Text>
      }
      primaryAction={
        <Button icon={RefreshIcon} onClick={() => window.location.reload()}>
          Refresh Status
        </Button>
      }
    >
      <Layout>
        {/* ── Over Limit Warning Banner ── */}
        {anyLimitExceeded && (
          <Layout.Section>
            <Banner
              title="You've reached your plan limits"
              tone="warning"
              action={{
                content: "Upgrade Now",
                onAction: () =>
                  document
                    .getElementById("plans-section")
                    ?.scrollIntoView({ behavior: "smooth" }),
              }}
            >
              <p>
                Your store has exceeded one or more limits on the{" "}
                <strong>{currentPlan.name}</strong> plan. New subscriber
                sign-ups and notifications are <strong>paused</strong> until
                you upgrade or the next billing cycle resets your usage.
              </p>
              <List>
                {subscribersOver && (
                  <List.Item>
                    Subscribers: {usage.subscribers} / {limits.subscribers} (limit reached)
                  </List.Item>
                )}
                {notificationsOver && (
                  <List.Item>
                    Notifications: {usage.notifications} / {limits.notifications} (limit reached)
                  </List.Item>
                )}
              </List>
            </Banner>
          </Layout.Section>
        )}

        {/* ── Current Plan Banner ── */}
        <Layout.Section>
          <Banner
            title={`You're on the ${currentPlan.name} plan`}
            tone="success"
            action={{
              content: "View all plans",
              onAction: () =>
                document
                  .getElementById("plans-section")
                  ?.scrollIntoView({ behavior: "smooth" }),
            }}
            secondaryAction={
              currentPlan.id !== "free"
                ? {
                  content: "Cancel plan",
                  onAction: () => setCancelModal(true),
                }
                : undefined
            }
          >
            <p>
              Next billing date: <strong>{currentPlan.nextBillingDate}</strong>
              &nbsp;·&nbsp; {priceDisplay}
            </p>
          </Banner>
        </Layout.Section>

        {/* ── Usage This Month ── */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1 }} gap="400">
            <Card>
              <Box padding="400">
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Billing Details
                  </Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Plan</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{currentPlan.name}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Status</Text>
                    <Badge tone={currentPlan.status === "active" ? "success" : "info"}>
                      {currentPlan.status === "active" ? "Active" : "Free"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Billing Cycle</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{billingCycleDisplay}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Amount</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {currentPlan.id === "free" ? "$0/mo" : `$${currentPlan.price}/mo`}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Next Billing Date</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{currentPlan.nextBillingDate}</Text>
                  </InlineStack>
                  <Divider />
                  <Button fullWidth variant="secondary">
                    Update Payment Method
                  </Button>
                </BlockStack>
              </Box>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* ── Plans Section ── */}
        <Layout.Section>
          <div id="plans-section" style={{ marginBottom: "32px" }}>
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    Choose Your Plan
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Upgrade or downgrade at any time. Changes take effect immediately.
                  </Text>
                </BlockStack>
                {/* Billing cycle toggle */}
                <div style={{ display: "flex", gap: "4px", background: "transparent" }}>
                  <div
                    onClick={() => setBillingCycle("monthly")}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 20,
                      cursor: "pointer",
                      background: billingCycle === "monthly" ? "#64748B" : "transparent",
                      color: billingCycle === "monthly" ? "#fff" : "#64748B",
                      fontWeight: 500,
                      fontSize: 14,
                      transition: "all 0.2s",
                      userSelect: "none",
                    }}
                  >
                    Monthly
                  </div>
                  <div
                    onClick={() => setBillingCycle("yearly")}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 20,
                      cursor: "pointer",
                      background: billingCycle === "yearly" ? "#64748B" : "transparent",
                      color: billingCycle === "yearly" ? "#fff" : "#64748B",
                      fontWeight: 500,
                      fontSize: 14,
                      transition: "all 0.2s",
                      userSelect: "none",
                    }}
                  >
                    Yearly
                  </div>
                </div>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                {PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrentPlan={plan.id === currentPlan.id}
                    billingCycle={billingCycle}
                    onSelect={handlePlanSelect}
                  />
                ))}
              </InlineGrid>
            </BlockStack>
          </div>
        </Layout.Section>

        {/* ── Billing History ── */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Billing History
                </Text>
                {invoiceRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Invoice", "Date", "Amount", "Status", "Receipt"]}
                    rows={invoiceRows}
                    hoverable
                  />
                ) : (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No billing history yet. Your invoices will appear here after your first payment.
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* ── FAQ / Help Callout ── */}
        <Layout.Section>
          <CalloutCard
            title="Need help choosing a plan?"
            illustration="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
            primaryAction={{
              content: "Contact Support",
              url: "mailto:support@backinstock.app",
            }}
            secondaryAction={{
              content: "View Documentation",
              url: "/app",
            }}
          >
            <p>
              Our team is happy to help you find the right plan for your store.
              Reach out anytime and we'll get back to you within 24 hours.
            </p>
          </CalloutCard>
        </Layout.Section>
      </Layout>

      {/* ── Cancel Plan Modal ── */}
      <Modal
        open={cancelModal}
        onClose={() => setCancelModal(false)}
        title="Cancel Your Plan"
        primaryAction={{
          content: "Yes, Cancel Plan",
          onAction: () => {
            submit({ actionType: "cancel" }, { method: "post" });
            setCancelModal(false);
          },
          destructive: true,
        }}
        secondaryActions={[
          { content: "Keep My Plan", onAction: () => setCancelModal(false) },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>Are you sure you want to cancel your <strong>{currentPlan.name}</strong> plan?</p>
            <p>
              You'll lose access to all premium features at the end of your
              current billing period on <strong>{currentPlan.nextBillingDate}</strong>.
              Your account will revert to the Free plan.
            </p>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
