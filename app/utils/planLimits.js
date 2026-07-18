/**
 * Plan limits and enforcement utilities.
 * Used across routes to enforce subscription limits.
 */

/**
 * Plan configuration with limits for each tier.
 * null = unlimited
 */
export const PLAN_LIMITS = {
  free: {
    subscribers: 35,
    notifications: 25,
    features: {
      analytics: false,
      notificationLog: false,
      customizeWidget: false,
      editEmailTemplate: false,
    },
  },
  basic: {
    subscribers: 500,
    notifications: 1000,
    features: {
      analytics: true,
      notificationLog: false,
      customizeWidget: true,
      editEmailTemplate: false,
    },
  },
  pro: {
    subscribers: 5000,
    notifications: 10000,
    features: {
      analytics: true,
      notificationLog: true,
      customizeWidget: true,
      editEmailTemplate: true,
    },
  },
  enterprise: {
    subscribers: null, // unlimited
    notifications: null,
    features: {
      analytics: true,
      notificationLog: true,
      customizeWidget: true,
      editEmailTemplate: true,
    },
  },
};

/**
 * Resolves the plan ID from the Shopify app subscription name.
 * @param {string|null} subscriptionName
 * @returns {"free"|"basic"|"pro"|"enterprise"}
 */
export function resolvePlanId(subscriptionName) {
  if (!subscriptionName) return "free";
  const name = subscriptionName.toLowerCase();
  if (name.includes("enterprise")) return "enterprise";
  if (name.includes("pro")) return "pro";
  if (name.includes("basic")) return "basic";
  return "free";
}

/**
 * Gets the limits for a plan by ID.
 * @param {"free"|"basic"|"pro"|"enterprise"} planId
 */
export function getLimitsForPlan(planId) {
  return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
}

/**
 * Gets the features included in a plan by ID.
 * @param {"free"|"basic"|"pro"|"enterprise"} planId
 */
export function getFeaturesForPlan(planId) {
  return PLAN_LIMITS[planId]?.features || PLAN_LIMITS.free.features;
}

/**
 * Checks whether a specific usage metric is at or over the limit.
 * @param {number} used
 * @param {number|null} limit - null means unlimited
 * @returns {boolean}
 */
export function isOverLimit(used, limit) {
  if (limit === null) return false; // unlimited
  return used >= limit;
}

/**
 * Given a shop and plan limits, checks all usage against limits.
 * Returns an object with exceeded flags and current counts.
 */
export async function getShopUsage(prisma, shop) {
  const [subscribers, notifications] = await Promise.all([
    prisma.backInStockSubscriber.count({ where: { shop } }),
    prisma.backInStockSubscriber.count({ where: { shop, notified: true } }),
  ]);

  return {
    subscribers,
    notifications,
  };
}
