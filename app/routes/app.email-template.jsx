import { useState, useEffect, useRef, useCallback } from "react";
import { useLoaderData, useSubmit, useNavigation, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import nodemailer from "nodemailer";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Divider,
  Select,
  Banner,
  Box,
  Badge,
  InlineGrid,
  Thumbnail,
} from "@shopify/polaris";

// ── SMTP config relies on environment variables ────────────────────────────────

// ── Default body HTML ─────────────────────────────────────────────────────────
const defaultBodies = {
  restock: `<p>Dear {{customer_first_name}},</p>
<p>The <strong>{{product_name}}</strong> is back and ready to plan your store product save yet.</p>
<p>We are so glad for completing of using the <strong>{{product_name}}</strong>.</p>
<br/>
<p>Best regards,<br/>Dear {{customer_first_name}},</p>
<p>The {{product_name}}.</p>`,
  preorder: `<p>Dear {{customer_first_name}},</p>
<p>We are excited to announce that <strong>{{product_name}}</strong> is now available for pre-order!</p>
<p>Be the first to get yours before it's available to everyone.</p>
<br/>
<p>Best regards,<br/>The {{store_name}} Team</p>`,
};

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [restockTpl, preorderTpl] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { shop_templateType: { shop, templateType: "restock" } } }),
    prisma.emailTemplate.findUnique({ where: { shop_templateType: { shop, templateType: "preorder" } } }),
  ]);

  return {
    shop,
    restock: restockTpl || {
      templateType: "restock",
      subjectLine: "🎉 Good news! {{product_name}} is back in stock!",
      bodyHtml: defaultBodies.restock,
      brandLogoUrl: "",
      ctaButtonText: "Shop Now",
    },
    preorder: preorderTpl || {
      templateType: "preorder",
      subjectLine: "🔔 Pre-order now: {{product_name}}",
      bodyHtml: defaultBodies.preorder,
      brandLogoUrl: "",
      ctaButtonText: "Pre-Order Now",
    },
    smtpUser: process.env.SMTP_USER || "",
  };
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ── Save template ──
  if (intent === "save") {
    const templateType  = formData.get("templateType")  || "restock";
    const subjectLine   = formData.get("subjectLine")   || "";
    const bodyHtml      = formData.get("bodyHtml")      || "";
    const brandLogoUrl  = formData.get("brandLogoUrl")  || "";
    const ctaButtonText = formData.get("ctaButtonText") || "Shop Now";

    await prisma.emailTemplate.upsert({
      where: { shop_templateType: { shop, templateType } },
      update: { subjectLine, bodyHtml, brandLogoUrl, ctaButtonText },
      create: { shop, templateType, subjectLine, bodyHtml, brandLogoUrl, ctaButtonText },
    });

    return { success: true, intent: "save" };
  }

  // ── Send test email ──
  if (intent === "send-test") {
    const testEmail     = formData.get("testEmail")     || "";
    const subjectLine   = formData.get("subjectLine")   || "";
    const bodyHtml      = formData.get("bodyHtml")      || "";
    const brandLogoUrl  = formData.get("brandLogoUrl")  || "";
    const ctaButtonText = formData.get("ctaButtonText") || "Shop Now";

    if (!testEmail) return { success: false, error: "Please enter a test email address." };

    // Resolve merge tags
    const sampleData = {
      "{{customer_first_name}}": "John",
      "{{customer_name}}":       "John Doe",
      "{{product_name}}":        "Sample Product",
      "{{store_name}}":          shop,
      "{{product_url}}":         `https://${shop}/products/sample`,
    };

    let resolvedBody    = bodyHtml;
    let resolvedSubject = subjectLine;
    for (const [tag, val] of Object.entries(sampleData)) {
      resolvedBody    = resolvedBody.split(tag).join(val);
      resolvedSubject = resolvedSubject.split(tag).join(val);
    }

    const logoHtml = brandLogoUrl
      ? `<div style="text-align:center;padding:20px 0 10px;"><img src="${brandLogoUrl}" alt="Brand" style="max-height:70px;max-width:220px;" /></div>`
      : `<div style="text-align:center;padding:20px 0 10px;font-size:22px;font-weight:700;color:#2c6ecb;letter-spacing:-0.5px;">${shop}</div>`;

    const ctaHtml = `<div style="text-align:center;margin:24px 0;">
      <a href="https://${shop}" style="display:inline-block;background:#2c6ecb;color:#fff;text-decoration:none;padding:13px 36px;border-radius:6px;font-weight:600;font-size:15px;">${ctaButtonText}</a>
    </div>`;

    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Back In Stock</title></head>
    <body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px 0;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        ${logoHtml}
        <div style="padding:24px 32px;color:#333;line-height:1.75;font-size:15px;">${resolvedBody}</div>
        ${ctaHtml}
        <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;">
          <p style="margin:0;">© ${new Date().getFullYear()} ${shop}. All rights reserved.</p>
        </div>
      </div>
    </body></html>`;

    try {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const from = process.env.SMTP_FROM || smtpUser || `alerts@${shop}`;
      const info = await transporter.sendMail({
        from: `"${shop} Restock Alerts" <${from}>`,
        to: testEmail,
        subject: `[TEST] ${resolvedSubject}`,
        html: fullHtml,
      });

      console.log(`[Test Email] Sent to ${testEmail}: ${info.messageId}`);
      return { success: true, intent: "send-test", messageId: info.messageId };
    } catch (err) {
      console.error("[Test Email] Error:", err);
      return { success: false, intent: "send-test", error: err.message || "Failed to send email" };
    }
  }

  return { success: false, error: "Unknown intent" };
};

// ── Rich-text toolbar button ──────────────────────────────────────────────────
function ToolbarBtn({ title, onClick, children, active }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: "5px 9px",
        border: `1px solid ${active ? "#2c6ecb" : "#c9cccf"}`,
        background: active ? "#eaf2ff" : "#fff",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "#2c6ecb" : "#202223",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );
}

// ── Merge Tag Badge ───────────────────────────────────────────────────────────
function MergeTagBadge({ tag, onInsert }) {
  return (
    <button
      type="button"
      onClick={() => onInsert(tag)}
      style={{
        display: "inline-block",
        padding: "3px 10px",
        background: "#f0f4ff",
        border: "1px solid #2c6ecb33",
        borderRadius: 20,
        fontSize: 12,
        color: "#2c6ecb",
        cursor: "pointer",
        margin: "2px",
        fontFamily: "monospace",
      }}
    >
      {tag}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmailTemplatePage() {
  const { restock, preorder, shop, smtpUser } = useLoaderData();
  const submit       = useSubmit();
  const navigation   = useNavigation();
  const isSaving     = navigation.state === "submitting";

  const [selectedType, setSelectedType] = useState("restock");
  const [subject,      setSubject]      = useState(restock.subjectLine);
  const [bodyHtml,     setBodyHtml]     = useState(restock.bodyHtml);
  const [brandLogo,    setBrandLogo]    = useState(restock.brandLogoUrl);
  const [ctaText,      setCtaText]      = useState(restock.ctaButtonText);
  const [testEmail,    setTestEmail]    = useState(smtpUser || "");
  const [banner,       setBanner]       = useState(null);  // { tone, msg }

  const editorRef = useRef(null);

  // Swap fields when user switches template type
  const templateData = { restock, preorder };
  const handleTypeChange = (v) => {
    setSelectedType(v);
    const tpl = templateData[v];
    setSubject(tpl.subjectLine);
    setBodyHtml(tpl.bodyHtml);
    setBrandLogo(tpl.brandLogoUrl);
    setCtaText(tpl.ctaButtonText);
  };

  // Keep editor in sync when switching templates
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = bodyHtml;
    }
  }, [selectedType]);

  // Read body from contenteditable
  const syncBody = () => {
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  };

  // Toolbar actions
  const exec = (cmd, value) => {
    document.execCommand(cmd, false, value ?? null);
    syncBody();
  };

  // Insert merge tag at cursor
  const insertMergeTag = (tag) => {
    const sel = window.getSelection();
    if (editorRef.current && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const textNode = document.createTextNode(tag);
        range.insertNode(textNode);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorRef.current.innerHTML += tag;
      }
    } else if (editorRef.current) {
      editorRef.current.innerHTML += tag;
    }
    syncBody();
  };

  // Logo upload → base64
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBrandLogo(reader.result);
    reader.readAsDataURL(file);
  };

  // Save
  const handleSave = () => {
    syncBody();
    const fd = new FormData();
    fd.append("intent",        "save");
    fd.append("templateType",  selectedType);
    fd.append("subjectLine",   subject);
    fd.append("bodyHtml",      editorRef.current?.innerHTML || bodyHtml);
    fd.append("brandLogoUrl",  brandLogo);
    fd.append("ctaButtonText", ctaText);
    submit(fd, { method: "post" });
    setBanner({ tone: "success", msg: "Template saved successfully!" });
    setTimeout(() => setBanner(null), 4000);
  };

  // Send test
  const handleSendTest = () => {
    if (!testEmail) {
      setBanner({ tone: "warning", msg: "Please enter a test email address first." });
      return;
    }
    syncBody();
    const fd = new FormData();
    fd.append("intent",        "send-test");
    fd.append("testEmail",     testEmail);
    fd.append("templateType",  selectedType);
    fd.append("subjectLine",   subject);
    fd.append("bodyHtml",      editorRef.current?.innerHTML || bodyHtml);
    fd.append("brandLogoUrl",  brandLogo);
    fd.append("ctaButtonText", ctaText);
    submit(fd, { method: "post" });
    setBanner({ tone: "info", msg: `Test email sending to ${testEmail}…` });
    setTimeout(() => setBanner(null), 6000);
  };

  const mergeTags = [
    "{{customer_first_name}}",
    "{{customer_name}}",
    "{{product_name}}",
    "{{store_name}}",
    "{{product_url}}",
  ];

  const templateOptions = [
    { label: "Restock Notification", value: "restock" },
    { label: "Pre-order Alert",      value: "preorder" },
  ];

  return (
    <Page
      title="Edit Email Template"
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{
        content: isSaving ? "Saving…" : "Save Template",
        onAction: handleSave,
        loading: isSaving,
      }}
      secondaryActions={[
        {
          content: "Send Test Email",
          icon: () => (
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h13A1.5 1.5 0 0118 3.5v.87L10 9.67 2 4.37V3.5zM2 6.13V16.5A1.5 1.5 0 003.5 18h13a1.5 1.5 0 001.5-1.5V6.13l-8 5.2-8-5.2z"/>
            </svg>
          ),
          onAction: handleSendTest,
        },
      ]}
    >
      <Layout>
        {banner && (
          <Layout.Section>
            <Banner tone={banner.tone} onDismiss={() => setBanner(null)}>
              <p>{banner.msg}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
            {/* ─ Left: Email Editor ─ */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Email Editor</Text>
                <Divider />

                {/* Toolbar */}
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  padding: "8px 0",
                  borderBottom: "1px solid #e4e5e7",
                  alignItems: "center",
                }}>
                  <ToolbarBtn title="Bold" onClick={() => exec("bold")}><b>B</b></ToolbarBtn>
                  <ToolbarBtn title="Italic" onClick={() => exec("italic")}><i>I</i></ToolbarBtn>
                  <ToolbarBtn title="Underline" onClick={() => exec("underline")}><u>U</u></ToolbarBtn>
                  <ToolbarBtn title="Strikethrough" onClick={() => exec("strikeThrough")}>
                    <span style={{ textDecoration: "line-through" }}>S</span>
                  </ToolbarBtn>
                  <span style={{ width: 1, height: 22, background: "#e4e5e7", margin: "0 4px" }} />
                  <ToolbarBtn title="Align Left" onClick={() => exec("justifyLeft")}>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 4h12v1H2zM2 7h8v1H2zM2 10h12v1H2zM2 13h8v1H2z"/></svg>
                  </ToolbarBtn>
                  <ToolbarBtn title="Align Center" onClick={() => exec("justifyCenter")}>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 4h12v1H2zM4 7h8v1H4zM2 10h12v1H2zM4 13h8v1H4z"/></svg>
                  </ToolbarBtn>
                  <ToolbarBtn title="Align Right" onClick={() => exec("justifyRight")}>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 4h12v1H2zM6 7h8v1H6zM2 10h12v1H2zM6 13h8v1H6z"/></svg>
                  </ToolbarBtn>
                  <span style={{ width: 1, height: 22, background: "#e4e5e7", margin: "0 4px" }} />
                  <ToolbarBtn title="Ordered List" onClick={() => exec("insertOrderedList")}>1.</ToolbarBtn>
                  <ToolbarBtn title="Unordered List" onClick={() => exec("insertUnorderedList")}>•</ToolbarBtn>
                  <span style={{ width: 1, height: 22, background: "#e4e5e7", margin: "0 4px" }} />

                  {/* Insert merge tag inline */}
                  <Select
                    label=""
                    labelHidden
                    options={[
                      { label: "Insert merge tag…", value: "" },
                      ...mergeTags.map((t) => ({ label: t, value: t })),
                    ]}
                    onChange={(v) => { if (v) insertMergeTag(v); }}
                    value=""
                  />
                </div>

                {/* Contenteditable Editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncBody}
                  onBlur={syncBody}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  style={{
                    minHeight: 320,
                    border: "1px solid #c9cccf",
                    borderRadius: 8,
                    padding: "16px 20px",
                    outline: "none",
                    lineHeight: 1.8,
                    fontSize: 15,
                    color: "#202223",
                    background: "#fff",
                    overflowY: "auto",
                  }}
                />

                {/* Drag & drop placeholder info */}
                <Box
                  background="bg-surface-secondary"
                  borderRadius="200"
                  padding="300"
                  borderColor="border"
                  borderWidth="025"
                >
                  <InlineStack gap="200" blockAlign="center">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="#6d7175">
                      <path d="M17.25 2a.75.75 0 01.75.75v14.5a.75.75 0 01-.75.75H2.75A.75.75 0 012 17.25V2.75A.75.75 0 012.75 2h14.5zm-.75 1.5H3.5v13h13v-13zM7 6.5a.5.5 0 01.5.5v2h2a.5.5 0 010 1h-2v2a.5.5 0 01-1 0v-2h-2a.5.5 0 010-1h2V7a.5.5 0 01.5-.5z"/>
                    </svg>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Drag and drop content blocks here, or type directly in the editor above.
                    </Text>
                  </InlineStack>
                </Box>

                {/* Product image drag placeholder */}
                <Box
                  background="bg-surface-secondary"
                  borderRadius="200"
                  padding="300"
                  borderColor="border-secondary"
                  borderWidth="025"
                  borderStyle="dashed"
                >
                  <InlineStack gap="200" blockAlign="center" align="center">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="#6d7175">
                      <path d="M2.5 1A1.5 1.5 0 001 2.5v15A1.5 1.5 0 002.5 19h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0017.5 1h-15zm0 1.5h15v10.086l-3.293-3.293a1 1 0 00-1.414 0L9.5 12.586 7.207 10.293a1 1 0 00-1.414 0L2.5 13.586V2.5zm5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                    </svg>
                    <Text as="p" variant="bodySm" tone="subdued">+ Drag product image here</Text>
                  </InlineStack>
                </Box>
              </BlockStack>
            </Card>

            {/* ─ Right: Controls ─ */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Email Template Controls</Text>
                <Divider />

                {/* Template selector */}
                <Select
                  label="Select Template"
                  options={templateOptions}
                  value={selectedType}
                  onChange={handleTypeChange}
                />

                <Divider />

                {/* Subject line */}
                <TextField
                  label="Subject Line"
                  value={subject}
                  onChange={setSubject}
                  autoComplete="off"
                  helpText="Supports merge tags like {{product_name}}"
                />

                <Divider />

                {/* Brand Logo */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">Brand Logo</Text>
                  {brandLogo ? (
                    <BlockStack gap="200">
                      <div style={{
                        border: "1px solid #e4e5e7",
                        borderRadius: 8,
                        padding: 12,
                        textAlign: "center",
                        background: "#f9fafb",
                      }}>
                        <img
                          src={brandLogo}
                          alt="Brand logo"
                          style={{ maxHeight: 60, maxWidth: "100%", objectFit: "contain" }}
                        />
                      </div>
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={() => setBrandLogo("")}
                      >
                        Remove logo
                      </Button>
                    </BlockStack>
                  ) : (
                    <label style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px dashed #c9cccf",
                      borderRadius: 8,
                      padding: "20px 12px",
                      cursor: "pointer",
                      background: "#f9fafb",
                      gap: 8,
                    }}>
                      <svg viewBox="0 0 20 20" width="28" height="28" fill="#8c9196">
                        <path d="M10 1a4 4 0 00-4 4 4 4 0 004 4 4 4 0 004-4 4 4 0 00-4-4zm0 10c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                      </svg>
                      <Text as="p" variant="bodySm" tone="subdued">Click to upload image</Text>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleLogoUpload}
                      />
                    </label>
                  )}
                </BlockStack>

                <Divider />

                {/* CTA Button text */}
                <TextField
                  label="Call to Action Button"
                  value={ctaText}
                  onChange={setCtaText}
                  autoComplete="off"
                  helpText="Text on the button inside the email"
                />

                <Divider />

                {/* Merge Tags Library */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">Merge Tags Library</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Dynamic content inserters</Text>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {mergeTags.map((tag) => (
                      <MergeTagBadge key={tag} tag={tag} onInsert={insertMergeTag} />
                    ))}
                  </div>
                </BlockStack>

                <Divider />

                {/* Send test email */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">Send Test Email</Text>
                  <TextField
                    label="Test email address"
                    labelHidden
                    placeholder="you@example.com"
                    value={testEmail}
                    onChange={setTestEmail}
                    type="email"
                    autoComplete="email"
                  />
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={handleSendTest}
                    loading={isSaving}
                  >
                    📧 Send Test Email
                  </Button>
                  {!smtpUser && (
                    <Text as="p" variant="bodySm" tone="caution">
                      ⚠️ No SMTP credentials found. Configure SMTP_USER and SMTP_PASS in your backend .env to send real emails.
                    </Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
