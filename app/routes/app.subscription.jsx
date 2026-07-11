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
  const { billing, session } = await authenticate.admin(request);
  const shop = session.shop;

  // ── Check active billing subscription ─────────────────────────────────────
  let billingCheck;
  try {
    billingCheck = await billing.check({
      plans: [
        "Basic Monthly",
        "Basic Yearly",
        "Pro Monthly",
        "Pro Yearly",
        "Enterprise Monthly",
        "Enterprise Yearly",
      ],
      isTest: true,
    });
  } catch (e) {
    console.error("[subscription/loader] billing.check error:", e);
    billingCheck = { hasActivePayment: false, appSubscriptions: [] };
  }

  const activeSubscription = billingCheck.hasActivePayment
    ? billingCheck.appSubscriptions[0]
    : null;

  const planId = resolvePlanId(activeSubscription?.name);
  const limits = getLimitsForPlan(planId);

  // ── Sync plan to Store model so other endpoints can enforce limits ─────────
  try {
    await prisma.store.upsert({
      where: { shop },
      update: { plan: activeSubscription?.name || "free", isActive: true },
      create: {
        shop,
        plan: activeSubscription?.name || "free",
        isActive: true,
      },
    });
  } catch (e) {
    console.error("[subscription/loader] store upsert error:", e);
  }

  // ── Real usage from database ───────────────────────────────────────────────
  const usageThisMonth = await getShopUsage(prisma, shop);

  // ── Billing details ────────────────────────────────────────────────────────
  let nextBillingDate = "-";
  let price = 0;
  let billingCycleLabel = "monthly";

  if (activeSubscription) {
    if (activeSubscription.currentPeriodEnd) {
      nextBillingDate = new Date(activeSubscription.currentPeriodEnd)
        .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
    billingCycleLabel = activeSubscription.name?.includes("Yearly") ? "yearly" : "monthly";

    // Map plan → price
    const priceMap = {
      "Basic Monthly": 9.99,
      "Basic Yearly": 7.99,
      "Pro Monthly": 19.99,
      "Pro Yearly": 15.99,
      "Enterprise Monthly": 39.99,
      "Enterprise Yearly": 31.99,
    };
    price = priceMap[activeSubscription.name] ?? 0;
  }

  // ── Billing history from Shopify subscriptions ─────────────────────────────
  // We use the appSubscriptions list for history. In a real multi-invoice setup
  // you'd query Shopify's invoices; here we derive from known data.
  const invoices = billingCheck.appSubscriptions
    ? billingCheck.appSubscriptions.map((sub, i) => ({
        id: `SUB-${String(i + 1).padStart(3, "0")}`,
        date: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US")
          : "-",
        amount: sub.name
          ? `$${
              {
                "Basic Monthly": "9.99",
                "Basic Yearly": "7.99",
                "Pro Monthly": "19.99",
                "Pro Yearly": "15.99",
                "Enterprise Monthly": "39.99",
                "Enterprise Yearly": "31.99",
              }[sub.name] ?? "0.00"
            }`
          : "$0.00",
        status: "paid",
      }))
    : [];

  const currentPlan = {
    id: planId,
    name: activeSubscription ? activeSubscription.name : "Free",
    status: activeSubscription ? "active" : "free",
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
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan");
  const actionType = formData.get("actionType");

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
    let billingCheck;
    try {
      billingCheck = await billing.check({ plans: ALL_PLANS, isTest: true });
    } catch (e) {
      console.error("[subscription/action] billing.check error:", e);
      return { success: false, error: "Could not verify subscription." };
    }

    if (billingCheck.hasActivePayment) {
      for (const sub of billingCheck.appSubscriptions) {
        try {
          await billing.cancel({
            subscriptionId: sub.id,
            isTest: true,
            prorate: true,
          });
        } catch (e) {
          console.error("[subscription/action] billing.cancel error:", e);
        }
      }
    }
    return redirect("/app/subscription");
  }

  // ── Subscribe to a paid plan ───────────────────────────────────────────────
  if (!plan || !ALL_PLANS.includes(plan)) {
    return { success: false, error: "Invalid plan selected." };
  }

  try {
    // billing.request() returns a redirect response to Shopify's billing page.
    // We must return it directly so the browser follows the redirect.
    return await billing.request({
      plan,
      isTest: true,
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/subscription`,
    });
  } catch (e) {
    console.error("[subscription/action] billing.request error:", e);
    return { success: false, error: "Failed to initiate billing. Please try again." };
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
      { label: "Up to 50 subscribers", included: true },
      { label: "100 notifications/month", included: true },
      { label: "Email notifications", included: true },
      { label: "Analytics dashboard", included: false },
    ],
    limits: { subscribers: 50, notifications: 100 },
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
      { label: "Up to 500 subscribers", included: true },
      { label: "1,000 notifications/month", included: true },
      { label: "Email notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Priority support", included: false },
      { label: "Custom email templates", included: false },
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
      { label: "SMS notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Priority support", included: true },
      { label: "Custom email templates", included: true },
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
      { label: "SMS notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Dedicated support", included: true },
      { label: "Custom email templates", included: true },
    ],
    limits: { subscribers: null, notifications: null },
  },
];

// ── Feature Row Component ─────────────────────────────────────────────────────
function FeatureRow({ label, included }) {
  return (
    <InlineStack gap="200" blockAlign="center">
      <Icon
        source={included ? CheckCircleIcon : XCircleIcon}
        tone={included ? "success" : "subdued"}
      />
      <Text
        as="span"
        variant="bodySm"
        tone={included ? undefined : "subdued"}
      >
        {label}
      </Text>
    </InlineStack>
  );
}

// ── Plan Card Component ───────────────────────────────────────────────────────
function PlanCard({ plan, isCurrentPlan, billingCycle, onSelect }) {
  const price =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isFree = price === 0;

  return (
    <div
      style={{
        border: isCurrentPlan
          ? `2px solid ${plan.color}`
          : "1px solid #e0e0e0",
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        background: isCurrentPlan ? `${plan.color}08` : "#fff",
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Badge */}
      {plan.badge && (
        <div
          style={{
            background: plan.color,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 10px",
            textAlign: "center",
            letterSpacing: 0.5,
          }}
        >
          {plan.badge}
        </div>
      )}

      <Box padding="400">
        <BlockStack gap="400">
          {/* Header */}
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                {plan.name}
              </Text>
              {isCurrentPlan && <Badge tone="success">Current Plan</Badge>}
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              {plan.description}
            </Text>
          </BlockStack>

          {/* Price */}
          <InlineStack gap="100" blockAlign="baseline">
            <Text as="span" variant="headingXl" fontWeight="bold">
              {isFree ? "Free" : `$${price}`}
            </Text>
            {!isFree && (
              <Text as="span" variant="bodySm" tone="subdued">
                / {billingCycle === "yearly" ? "mo, billed yearly" : "month"}
              </Text>
            )}
          </InlineStack>

          {billingCycle === "yearly" && !isFree && (
            <Badge tone="success">
              Save ${((plan.monthlyPrice - plan.yearlyPrice) * 12).toFixed(2)}/yr
            </Badge>
          )}

          <Divider />

          {/* Features */}
          <BlockStack gap="200">
            {plan.features.map((f, i) => (
              <FeatureRow key={i} label={f.label} included={f.included} />
            ))}
          </BlockStack>

          <Divider />

          {/* CTA */}
          {isCurrentPlan ? (
            <Button disabled fullWidth>
              Current Plan
            </Button>
          ) : (
            <Button
              variant={plan.badge === "Most Popular" ? "primary" : "secondary"}
              fullWidth
              onClick={() => onSelect(plan)}
            >
              {plan.id === "free" ? "Downgrade to Free" : `Upgrade to ${plan.name}`}
            </Button>
          )}
        </BlockStack>
      </Box>
    </div>
  );
}

// ── Usage Bar ─────────────────────────────────────────────────────────────────
function UsageBar({ label, used, limit }) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const tone = pct >= 100 ? "critical" : pct >= 90 ? "critical" : pct >= 70 ? "caution" : "highlight";
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
        <Text variant="headingXl" as="h1">
          Plans &amp; Billing
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
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Usage This Month
                  </Text>
                  <UsageBar
                    label="Subscribers"
                    used={usage.subscribers}
                    limit={limits.subscribers}
                  />
                  <UsageBar
                    label="Notifications Sent"
                    used={usage.notifications}
                    limit={limits.notifications}
                  />
                </BlockStack>
              </Box>
            </Card>

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
          <div id="plans-section">
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
                <Card padding="0">
                  <Box padding="050">
                    <InlineStack gap="0">
                      <div
                        onClick={() => setBillingCycle("monthly")}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 6,
                          cursor: "pointer",
                          background: billingCycle === "monthly" ? "#008060" : "transparent",
                          color: billingCycle === "monthly" ? "#fff" : "#637381",
                          fontWeight: 600,
                          fontSize: 13,
                          transition: "all 0.2s",
                          userSelect: "none",
                        }}
                      >
                        Monthly
                      </div>
                      <div
                        onClick={() => setBillingCycle("yearly")}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 6,
                          cursor: "pointer",
                          background: billingCycle === "yearly" ? "#008060" : "transparent",
                          color: billingCycle === "yearly" ? "#fff" : "#637381",
                          fontWeight: 600,
                          fontSize: 13,
                          transition: "all 0.2s",
                          userSelect: "none",
                        }}
                      >
                        Yearly (Save 20%)
                      </div>
                    </InlineStack>
                  </Box>
                </Card>
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
