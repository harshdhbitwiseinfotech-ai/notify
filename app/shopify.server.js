import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval,
  BillingReplacementBehavior,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    "Basic Monthly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      lineItems: [{ amount: 9.99, currencyCode: "USD", interval: BillingInterval.Every30Days }],
    },
    "Basic Yearly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      lineItems: [{ amount: 95.88, currencyCode: "USD", interval: BillingInterval.Annual }],
    },
    "Pro Monthly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      lineItems: [{ amount: 19.99, currencyCode: "USD", interval: BillingInterval.Every30Days }],
    },
    "Pro Yearly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      lineItems: [{ amount: 191.88, currencyCode: "USD", interval: BillingInterval.Annual }],
    },
    "Enterprise Monthly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      lineItems: [{ amount: 39.99, currencyCode: "USD", interval: BillingInterval.Every30Days }],
    },
    "Enterprise Yearly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      lineItems: [{ amount: 383.88, currencyCode: "USD", interval: BillingInterval.Annual }],
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
