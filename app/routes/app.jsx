424444444444
import { Outlet, useLoaderData, Link , useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { ThemeProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import "@shopify/polaris/build/esm/styles.css";

// import { ToastProvider } from "../components/ToastProvider";
// import { AuthProvider } from "../components/AuthProvider";
// import { AppContextProvider } from "../components/AppContextProvider";
// import { MainLayout } from "../components/MainLayout";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
      <ShopifyAppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home" prefetch="none">Dashboard</Link>
        <Link to="/app/products" prefetch="none">Notifications</Link>
        <Link to="/app/analytics" prefetch="none">Analytics</Link>
        <Link to="/app/reports" prefetch="none">Reports</Link>
        <Link to="/app/subscription" prefetch="none">Plans & Billing</Link>
      </NavMenu>

      <PolarisAppProvider i18n={translations}>
        <ThemeProvider>
          <Outlet />
          {/* <ToastProvider>
            <AuthProvider>
              <AppContextProvider>
                <MainLayout>
                </MainLayout>
              </AppContextProvider>
            </AuthProvider>
          </ToastProvider> */}
        </ThemeProvider>
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
