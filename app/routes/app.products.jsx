import React, { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Modal,
  Text,
  Box,
  InlineStack,
  BlockStack,
  List,
  TextField,
  EmptyState,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { Icon } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const recentRequests = await prisma.backInStockSubscriber.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const formatDate = (date) => {
    const d = new Date(date);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, "0");
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    return `${month} ${day}, ${year}, ${hours}:${minutes} UTC`;
  };

  const requests = recentRequests.map((sub) => ({
    id: sub.id,
    productId: sub.productId,
    productTitle: sub.productTitle || "Unknown product",
    variantTitle: sub.variantTitle || "",
    email: sub.email,
    status: sub.notified ? "notified" : "pending",
    createdAt: formatDate(sub.createdAt),
  }));

  return { requests };
};

export default function Products() {
  const { requests } = useLoaderData();
  const [activeRequest, setActiveRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const visibleRequests = useMemo(() => {
    if (!searchText.trim()) {
      return requests;
    }

    const query = searchText.toLowerCase();
    return requests.filter(
      (request) =>
        request.productTitle.toLowerCase().includes(query) ||
        request.email.toLowerCase().includes(query) ||
        request.status.toLowerCase().includes(query)
    );
  }, [requests, searchText]);

  const openRequestModal = (request) => {
    setActiveRequest(request);
    setIsModalOpen(true);
  };

  const closeRequestModal = () => {
    setActiveRequest(null);
    setIsModalOpen(false);
  };

  const resourceName = {
    singular: "request",
    plural: "requests",
  };

  const rowMarkup = visibleRequests.map((request, index) => (
    <IndexTable.Row id={request.id} key={request.id} position={index}>
      <IndexTable.Cell>{request.productTitle}</IndexTable.Cell>
      <IndexTable.Cell>{request.email}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={request.status === "notified" ? "success" : "attention"}>
          {request.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{request.createdAt}</IndexTable.Cell>
      <IndexTable.Cell>
        <button
          onClick={() => openRequestModal(request)}
          style={{
            backgroundColor: "#fffbfb23",
            color: "#b66f05dc",
            border: "1px solid #000000",
            borderRadius: "8px",
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "14px",
          }}
        >
          View Details
        </button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title={<Text variant="heading2xl" as="h1" fontWeight="bold">🚨 Notification Dashboard</Text>}>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <InlineStack blockAlign="center" align="space-between" gap="400">
                <BlockStack spacing="tight">
                  <Text as="p" variant="bodyMd" tone="subdued" fontWeight="regular">
                    Browse the latest back-in-stock requests from your store.....
                  </Text>
                </BlockStack>
                <Box width="320px">
                  <TextField
                    label="Search requests"
                    labelHidden
                    type="search" 
                    value={searchText}
                    onChange={setSearchText}
                    clearButton
                    onClearButtonClick={() => setSearchText("")}
                    placeholder="Search by product or email"
                    autoComplete="off"
                    prefix={<Icon source={SearchIcon} />}
                  />
                </Box>
              </InlineStack>
            </Box>

            {visibleRequests.length === 0 ? (
              <Box padding="800">
                <EmptyState
                  heading="No recent requests found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Back-in-stock sign-ups from your storefront will appear here once customers request notifications.
                  </p>
                </EmptyState>
              </Box>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={visibleRequests.length}
                selectable={false}
                headings={[
                  { title: "Product" },
                  { title: "Email" },
                  { title: "Status" },
                  { title: "Requested At" },
                  { title: "Action" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={isModalOpen}
        onClose={closeRequestModal}
        title={activeRequest ? `Request details for ${activeRequest.productTitle}` : "Request details"}
        primaryAction={{
          content: "Close",
          onAction: closeRequestModal,
        }}
      >
        <Modal.Section>
          {activeRequest ? (
            <BlockStack gap="400">
              <Box>
                <Text variant="bodyMd" fontWeight="semibold">
                  Product
                </Text>
                <Text as="p" tone="subdued">
                  {activeRequest.productTitle}
                </Text>
              </Box>
              <Box>
                <Text variant="bodyMd" fontWeight="semibold">
                  Email
                </Text>
                <Text as="p" tone="subdued">
                  {activeRequest.email}
                </Text>
              </Box>
              {activeRequest.variantTitle ? (
                <Box>
                  <Text variant="bodyMd" fontWeight="semibold">
                    Variant
                  </Text>
                  <Text as="p" tone="subdued">
                    {activeRequest.variantTitle}
                  </Text>
                </Box>
              ) : null}
              <Box>
                <Text variant="bodyMd" fontWeight="semibold">
                  Status
                </Text>
                <Text as="p" tone="subdued">
                  {activeRequest.status}
                </Text>
              </Box>
              <Box>
                <Text variant="bodyMd" fontWeight="semibold">
                  Requested At
                </Text>
                <Text as="p" tone="subdued">
                  {activeRequest.createdAt}
                </Text>
              </Box>
            </BlockStack>
          ) : (
            <Text variant="bodyMd" tone="subdued">
              No request selected.
            </Text>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
