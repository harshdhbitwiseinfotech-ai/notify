import React from "react";
import { useNavigate } from "react-router";
import {
  Icon,
  Page,
  Layout,
  Grid,
  Card,
  Text,
  Box,
  InlineGrid,
  InlineStack,
  BlockStack,
  Button,
  ProgressBar,
  Badge,
  Thumbnail,
  Divider,
} from "@shopify/polaris";
import { LockIcon } from "@shopify/polaris-icons";

const FeatureLock = ({ isLocked, title, upgradePlanText, children }) => {
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
};

const StatIcon = ({ type, color }) => {
  const icons = {
    activity: <svg viewBox="0 0 20 20" width="16" height="16" fill={color}><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-8h2v5H9v-5zm0-4h2v2H9V6z" /></svg>,
    product: <svg viewBox="0 0 20 20" width="16" height="16" fill={color}><path d="M2 5l8-4 8 4v10l-8 4-8-4V5zm8-2.2L3.8 6 10 9.2 16.2 6 10 2.8zM3 7.1v8.8l7 3.5v-8.8L3 7.1zm8 12.3l7-3.5V7.1l-7 3.6v8.7z" /></svg>,
    check: <svg viewBox="0 0 20 20" width="16" height="16" fill={color}><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm4.7-10.7l-5.5 5.5a1 1 0 01-1.4 0l-2.5-2.5a1 1 0 011.4-1.4l1.8 1.8 4.8-4.8a1 1 0 011.4 1.4z" /></svg>,
    warning: <svg viewBox="0 0 20 20" width="16" height="16" fill={color}><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-8h2v4H9v-4zm0-4h2v2H9V6z" /></svg>,
  };
  const getBackgroundTone = (color) => {
    if (color === '#008060') return 'bg-surface-success';
    if (color === '#2c6ecb') return 'bg-surface-info';
    if (color === '#e32c2b') return 'bg-surface-critical';
    if (color === '#5c6ac4') return 'bg-surface-highlight';
    return 'bg-surface-warning';
  };
  return (
    <Box background={getBackgroundTone(color)} padding="100" borderRadius="100">
      {icons[type]}
    </Box>
  );
};

const StatCard = ({ title, value, subtitle, badgeText, badgeStatus, iconType, iconColor, sparkBars, sparkColor, progressPercent }) => (
  <Card>
    <BlockStack gap="300" blockAlign="center">
      <InlineStack gap="200" blockAlign="center" align="center">
        <StatIcon type={iconType} color={iconColor} />
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
      </InlineStack>

      <InlineStack align="center" blockAlign="center" gap="200">
        <Text as="h2" variant="heading3xl">
          {value}
        </Text>
        {subtitle && (
          <Box paddingBlockEnd="100" style={{ textAlign: 'center' }}>
            <Text as="span" variant="bodyMd" tone="subdued">
              {subtitle}
            </Text>
          </Box>
        )}
        {badgeText && (
          <Box paddingBlockEnd="100" style={{ textAlign: 'center' }}>
            <Badge tone={badgeStatus}>{badgeText}</Badge>
          </Box>
        )}
      </InlineStack>

      {sparkBars && (
        <Box minHeight="40px" paddingBlockStart="200">
          <svg viewBox="0 0 100 30" width="100%" height="40px" preserveAspectRatio="none">
            {sparkBars.map((bar, i) => (
              <rect key={i} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={sparkColor} opacity={0.8} rx="1" />
            ))}
          </svg>
        </Box>
      )}

      {progressPercent !== undefined && (
        <Box paddingBlockStart="200">
          <ProgressBar progress={progressPercent} size="small" tone={progressPercent > 50 ? 'success' : 'critical'} />
          <Box paddingBlockStart="100">
            <Text as="span" variant="bodySm" tone="subdued">{progressPercent}% of total</Text>
          </Box>
        </Box>
      )}
    </BlockStack>
  </Card>
);

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

const Dashboard = ({ stats, topProducts = [], recentRequests = [], shopName = "Your store", limits, usage, planId, features = {} }) => {
  const navigate = useNavigate();
  const totalRequests = stats?.totalRequests ?? 0;
  const pending = stats?.pending ?? 0;
  const notified = stats?.notified ?? 0;

  const calculatedCompletionPercent = totalRequests > 0 ? Math.round((notified / totalRequests) * 100) : 0;
  const calculatedPendingPercent = totalRequests > 0 ? Math.round((pending / totalRequests) * 100) : 0;

  const hasUnlimitedPlan = stats?.hasUnlimitedPlan ?? false;

  const requestHistory = stats?.requestHistory?.length > 0 ? stats.requestHistory : [10, 15, 20, 18, 30, 25, totalRequests];
  const pendingHistory = stats?.pendingHistory?.length > 0 ? stats.pendingHistory : [2, 5, 8, 5, 12, 10, pending];
  const historyLabels = stats?.historyLabels ?? ["Jul 5", "Jul 6", "Jul 7", "Jul 8", "Jul 9", "Jul 10", "Jul 11"];

  const prevRequests = requestHistory.length > 1 ? requestHistory[requestHistory.length - 2] : totalRequests;
  const requestTrend = prevRequests > 0 ? Math.round(((totalRequests - prevRequests) / prevRequests) * 100) : 0;

  const generateLinePoints = (data = [], width = 500, height = 150) => {
    if (!data.length) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    return data
      .map((value, index) => {
        const x = data.length === 1 ? width / 2 : (index * width) / (data.length - 1);
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const requestTrendLine = generateLinePoints(requestHistory);
  const requestTrendArea = requestHistory.length
    ? `0,150 ${requestTrendLine} 500,150`
    : "";
  const requestBadgeText = requestTrend !== 0 ? `${requestTrend > 0 ? '↑' : '↓'} ${Math.abs(requestTrend)}%` : null;
  const requestBadgeStatus = requestTrend >= 0 ? "success" : "critical";

  const generateSparkBars = (data = []) => {
    if (!data || data.length === 0) return [];
    const max = Math.max(...data) * 1.1 || 1;
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const barWidth = 100 / data.length - 2;

    return data.map((val, i) => {
      const x = i * (100 / data.length) + 1;
      const height = ((val - min) / range) * 30;
      const y = 30 - height;
      return { x, y, width: Math.max(1, barWidth), height: Math.max(1, height) };
    });
  };

  return (
    <Page title={<Text variant="heading2xl" as="h1" fontWeight="bold">🎯 Dashboard</Text>} subtitle={`Store analytics for ${shopName}`}>
      <Layout>

        {/* Stat Cards */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: hasUnlimitedPlan ? 3 : 4 }} gap="400">
            <StatCard
              title="Total Requests"
              value={totalRequests}
              iconType="activity"
              iconColor="#008060"
              badgeText={requestBadgeText}
              badgeStatus={requestBadgeStatus}
              sparkBars={generateSparkBars(requestHistory)}
              sparkColor="#008060"
            />
            <StatCard
              title="Pending Notifications"
              value={pending}
              iconType="product"
              iconColor="#2c6ecb"
              badgeText={`${calculatedPendingPercent}% Pending`}
              badgeStatus="info"
              sparkBars={generateSparkBars(pendingHistory)}
              sparkColor="#2c6ecb"
            />
            {!hasUnlimitedPlan && (
              <StatCard
                title="Notified Customers"
                value={notified}
                subtitle={`/ ${totalRequests}`}
                iconType="check"
                iconColor="#008060"
                progressPercent={calculatedCompletionPercent}
              />
            )}
            <StatCard
              title="Total Products"
              value={stats?.totalProducts ?? "0"}
              iconType="warning"
              iconColor="#5c6ac4"
            />
          </InlineGrid>
        </Layout.Section>

        {/* Trend and Distribution */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
            {/* Request Trend */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Request Trend
                  </Text>
                  <InlineStack gap="200">
                    <Badge>Last 7 Days</Badge>
                  </InlineStack>
                </InlineStack>
                <Box minHeight="200px" paddingBlockStart="400">
                  {/* SVG Line Chart */}
                  <svg viewBox="0 0 500 150" width="100%" height="200px" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#0400fa" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#008060" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={requestTrendArea} fill="url(#trendGradient)" />
                    <polyline fill="none" stroke="#008060" strokeWidth="3" points={requestTrendLine} />
                    {requestHistory.map((value, index) => {
                      const [x, y] = requestTrendLine.split(" ")[index]?.split(",").map(Number) || [0, 150];
                      return (
                        <circle
                          key={index}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="white"
                          stroke="#008060"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>
                  <InlineStack align="space-between">
                    {historyLabels.map((label) => (
                      <Text key={label} variant="bodySm" tone="subdued">
                        {label}
                      </Text>
                    ))}
                  </InlineStack>
                </Box>
              </BlockStack>
            </Card>

            {/* Request Status Distribution */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Request Status Distribution
                </Text>
                <InlineStack align="center" blockAlign="center" gap="400">
                  <Box style={{ position: 'relative', width: '150px', height: '150px' }}>
                    <svg viewBox="0 0 36 36" width="150" height="150">
                      {/* Background Circle */}
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e4e5e7"
                        strokeWidth="4"
                      />
                      {/* Notified (Green) */}
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#008060"
                        strokeWidth="4"
                        strokeDasharray={`${calculatedCompletionPercent}, 100`}
                      />
                      {/* Pending (Blue) */}
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#fa8e00"
                        strokeWidth="4"
                        strokeDasharray={`${calculatedPendingPercent}, 100`}
                        strokeDashoffset={`-${calculatedCompletionPercent}`}
                      />
                    </svg>
                    <Box style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <Text as="h3" variant="headingXl">{totalRequests}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">TOTAL</Text>
                    </Box>
                  </Box>
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Box background="bg-surface-success" borderRadius="100" style={{ width: '8px', height: '8px' }} />
                      <Text as="span" variant="bodyMd">Notified</Text>
                      <Text as="span" variant="bodyMd" fontWeight="bold">{notified}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">({calculatedCompletionPercent}%)</Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Box background="bg-surface-info" borderRadius="100" style={{ width: '8px', height: '8px' }} />
                      <Text as="span" variant="bodyMd">Pending</Text>
                      <Text as="span" variant="bodyMd" fontWeight="bold">{pending}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">({calculatedPendingPercent}%)</Text>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <Button variant="plain">View all requests →</Button>
                </Box>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Performance Overview + Recent Activity */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
            {/* Performance Overview */}
            <Card>
              <FeatureLock isLocked={!features.analytics} title="Advanced Reports" upgradePlanText="Basic">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Performance Overview
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Notification health metrics
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Review request completion and backlog for your store notification flow.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Notification completion
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {calculatedCompletionPercent}% of all requests are completed.
                    </Text>
                    <ProgressBar progress={calculatedCompletionPercent} size="small" />
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Pending notification backlog
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {calculatedPendingPercent}% of requests are still waiting for notification.
                    </Text>
                    <ProgressBar progress={calculatedPendingPercent} size="small" tone="highlight" />
                  </BlockStack>

                  <Box paddingBlockStart="400">
                    <Divider />
                  </Box>

                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      Usage This Month
                    </Text>
                    {limits && usage && (
                      <BlockStack gap="300">
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
                    )}
                  </BlockStack>
                </BlockStack>
              </FeatureLock>
            </Card>

            {/* Recent Activity */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent Activity
                </Text>
                <Divider />
                {recentRequests.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No recent request activity yet.
                  </Text>
                ) : (
                  <BlockStack gap="300">
                    {recentRequests.map((request) => (
                      <Box key={request.id} paddingBlockEnd="200" borderBlockEndWidth="025" borderColor="border">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            {request.email}
                          </Text>
                          <Text as="p" tone="subdued" variant="bodySm">
                            requested <strong>{request.productTitle}</strong>
                          </Text>
                          <Text as="p" tone="subdued" variant="bodySm">
                            {request.createdAt}
                          </Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>


        {/* ─── Quick Actions ─── */}
        <Layout.Section>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">Quick Actions</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Use these quick links to personalize your widget and increase your sales</Text>
            </BlockStack>

            <InlineGrid columns={{ xs: 1, sm: 2, md: 2 }} gap="400">

              {/* Customize Button Design */}
              <FeatureLock isLocked={!features.customizeWidget} title="Customize Widget" upgradePlanText="Basic">
                <Card padding="0">
                  <div style={{
                    backgroundColor: 'rgba(245, 205, 74, 0.51)',
                    padding: '30px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                  }}>
                    <div style={{
                      backgroundColor: '#fff',
                      padding: '20px 30px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(2, 2, 2, 0.99)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      width: '80%'
                    }}>
                      <div style={{
                        background: 'rgba(92, 127, 161, 0.54)',
                        padding: '10px',
                        borderRadius: '4px',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}>
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="white">
                          <path d="M10 0a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm4.7-10.7l-5.5 5.5a1 1 0 01-1.4 0l-2.5-2.5a1 1 0 011.4-1.4l1.8 1.8 4.8-4.8a1 1 0 011.4 1.4z" />
                        </svg>
                        <Text as="span" variant="bodyMd" fontWeight="bold" tone="textInverse">Notify me</Text>
                      </div>
                      <div style={{
                        border: '1px solid rgb(225, 227, 229)',
                        padding: '10px',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        <Text as="span" variant="bodyMd" tone="subdued" fontWeight="medium">Notify me</Text>
                      </div>
                    </div>
                  </div>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">Your brand, your style!</Text>
                      <div style={{ minHeight: '60px' }}>
                        <Text as="p" tone="subdued">
                          You can use coding to personalize the widget, form, and email templates to create a visually appealing impression and make them uniquely yours. If you prefer a hand, our team's here to assist.
                        </Text>
                      </div>
                      <InlineStack gap="300">
                        <Button variant="primary" onClick={() => navigate("/app/button-settings")}>Customize widget</Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Card>
              </FeatureLock>

              {/* Edit Email Template */}
              <FeatureLock isLocked={!features.editEmailTemplate} title="Email Templates" upgradePlanText="Pro">
                <Card padding="0">
                  <div style={{
                    backgroundColor: 'rgba(245, 205, 74, 0.51)',
                    padding: '30px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                  }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      padding: '30px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      width: '80%'
                    }}>
                      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#2c6ecb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <Text as="span" variant="bodySm" tone="subdued">Reminder notification</Text>
                    </div>
                  </div>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">Increase your sales by sending reminder notifications</Text>
                      <div style={{ minHeight: '60px' }}>
                        <Text as="p" tone="subdued">
                          Reach out to subscribers who have not yet purchased the product while it is still available.
                        </Text>
                      </div>
                      <InlineStack gap="300">
                        <Button variant="primary" onClick={() => navigate("/app/email-template")}>Edit Email Template</Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Card>
              </FeatureLock>

            </InlineGrid>
          </BlockStack>
        </Layout.Section>

      </Layout>
    </Page>
  );
};

export default Dashboard;
