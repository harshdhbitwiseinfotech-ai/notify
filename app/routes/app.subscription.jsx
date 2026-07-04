import React, { useState, useCallback } from "react";
import { useLoaderData, useFetcher } from "react-router";
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

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Mock current subscription state
  const currentPlan = {
    id: "basic",
    name: "Basic",
    status: "active",
    billingCycle: "monthly",
    price: 9.99,
    nextBillingDate: "2026-08-04",
    usageThisMonth: {
      subscribers: 287,
      notifications: 892,
      products: 45,
    },
  };

  const invoices = [
    { id: "INV-001", date: "2026-07-01", amount: "$9.99", status: "paid" },
    { id: "INV-002", date: "2026-06-01", amount: "$9.99", status: "paid" },
    { id: "INV-003", date: "2026-05-01", amount: "$9.99", status: "paid" },
    { id: "INV-004", date: "2026-04-01", amount: "$9.99", status: "paid" },
    { id: "INV-005", date: "2026-03-01", amount: "$9.99", status: "paid" },
  ];

  return { currentPlan, invoices };
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
      { label: "5 products monitored", included: true },
      { label: "Email notifications", included: true },
      { label: "SMS notifications", included: false },
      { label: "Analytics dashboard", included: false },
      { label: "Priority support", included: false },
      { label: "Custom email templates", included: false },
    ],
    limits: { subscribers: 50, notifications: 100, products: 5 },
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
      { label: "50 products monitored", included: true },
      { label: "Email notifications", included: true },
      { label: "SMS notifications", included: false },
      { label: "Analytics dashboard", included: true },
      { label: "Priority support", included: false },
      { label: "Custom email templates", included: false },
    ],
    limits: { subscribers: 500, notifications: 1000, products: 50 },
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 29.99,
    yearlyPrice: 23.99,
    badge: "Most Popular",
    description: "For scaling stores that need powerful automation and insights.",
    color: "#0071E3",
    features: [
      { label: "Up to 5,000 subscribers", included: true },
      { label: "10,000 notifications/month", included: true },
      { label: "Unlimited products", included: true },
      { label: "Email notifications", included: true },
      { label: "SMS notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Priority support", included: true },
      { label: "Custom email templates", included: true },
    ],
    limits: { subscribers: 5000, notifications: 10000, products: null },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 99.99,
    yearlyPrice: 79.99,
    badge: "Best Value",
    description: "Full power for high-volume stores with dedicated support.",
    color: "#6D28D9",
    features: [
      { label: "Unlimited subscribers", included: true },
      { label: "Unlimited notifications", included: true },
      { label: "Unlimited products", included: true },
      { label: "Email notifications", included: true },
      { label: "SMS notifications", included: true },
      { label: "Analytics dashboard", included: true },
      { label: "Dedicated support", included: true },
      { label: "Custom email templates", included: true },
    ],
    limits: { subscribers: null, notifications: null, products: null },
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
function UsageBar({ label, used, limit, color }) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const tone = pct >= 90 ? "critical" : pct >= 70 ? "caution" : "highlight";
  return (
    <BlockStack gap="150">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">
          {label}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {used.toLocaleString()} / {limit ? limit.toLocaleString() : "∞"}
        </Text>
      </InlineStack>
      <ProgressBar progress={limit ? pct : 0} tone={tone} size="small" />
    </BlockStack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Subscription() {
  const { currentPlan, invoices } = useLoaderData();
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(false);

  const handlePlanSelect = useCallback((plan) => {
    setUpgradeModal(plan);
  }, []);

  const handleConfirmUpgrade = useCallback(() => {
    // In real app: call Shopify Billing API here
    setUpgradeModal(null);
  }, []);

  const currentPlanDef = PLANS.find((p) => p.id === currentPlan.id) || PLANS[1];

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

  return (
    <Page
      title={
        <Text variant="headingXl" as="h1">
          Plans &amp; Billing
        </Text>
      }
      primaryAction={
        <Button icon={RefreshIcon} onClick={() => {}}>
          Manage Subscription
        </Button>
      }
    >
      <Layout>
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
            secondaryAction={{
              content: "Cancel plan",
              onAction: () => setCancelModal(true),
            }}
          >
            <p>
              Next billing date: <strong>{currentPlan.nextBillingDate}</strong>{" "}
              &nbsp;·&nbsp; ${currentPlan.price}/month
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
                    used={currentPlan.usageThisMonth.subscribers}
                    limit={currentPlanDef.limits.subscribers}
                  />
                  <UsageBar
                    label="Notifications Sent"
                    used={currentPlan.usageThisMonth.notifications}
                    limit={currentPlanDef.limits.notifications}
                  />
                  <UsageBar
                    label="Products Monitored"
                    used={currentPlan.usageThisMonth.products}
                    limit={currentPlanDef.limits.products}
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
                    <Badge tone="success">Active</Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Billing Cycle</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">Monthly</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Amount</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">${currentPlan.price}/mo</Text>
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
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Invoice", "Date", "Amount", "Status", "Receipt"]}
                  rows={invoiceRows}
                  hoverable
                />
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

      {/* ── Upgrade Confirmation Modal ── */}
      {upgradeModal && (
        <Modal
          open={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
          title={`Upgrade to ${upgradeModal.name}`}
          primaryAction={{
            content: "Confirm Upgrade",
            onAction: handleConfirmUpgrade,
            variant: "primary",
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setUpgradeModal(null) },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>
                You're about to upgrade from <strong>{currentPlan.name}</strong>{" "}
                to <strong>{upgradeModal.name}</strong>.
              </p>
              <p>
                Your new billing amount will be{" "}
                <strong>
                  ${billingCycle === "yearly" ? upgradeModal.yearlyPrice : upgradeModal.monthlyPrice}
                  /{billingCycle === "yearly" ? "mo (billed yearly)" : "month"}
                </strong>
                .
              </p>
              <p>The change will take effect immediately and you'll be charged a prorated amount for the remainder of this billing period.</p>
            </TextContainer>
          </Modal.Section>
        </Modal>
      )}

      {/* ── Cancel Plan Modal ── */}
      <Modal
        open={cancelModal}
        onClose={() => setCancelModal(false)}
        title="Cancel Your Plan"
        primaryAction={{
          content: "Yes, Cancel Plan",
          onAction: () => setCancelModal(false),
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
