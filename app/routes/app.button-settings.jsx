import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
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
  InlineGrid,
} from "@shopify/polaris";

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.buttonSettings.findUnique({ where: { shop } });

  if (!settings) {
    settings = {
      buttonText: "Notify Me",
      primaryColor: "#2c6ecb",
      textColor: "#FFFFFF",
      borderRadius: 4,
      fontSize: 14,
      fontFamily: "inherit",
      buttonSize: "medium",
      // Low Stock Widget defaults
      lowStockEnabled: false,
      lowStockThreshold: 5,
      lowStockMessage: "Only {{remaining_quantity}} items left in stock!",
      lowStockShowIcon: true,
      lowStockTextColor: "#e32c2b",
      lowStockIconColor: "#e32c2b",
      lowStockCustomCss: "",
    };
  }

  return { settings, shop };
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const payload = {
    buttonText:   formData.get("buttonText")   || "Notify Me",
    primaryColor: formData.get("primaryColor") || "#2c6ecb",
    textColor:    formData.get("textColor")    || "#FFFFFF",
    borderRadius: parseInt(formData.get("borderRadius") || "4", 10),
    fontSize:     parseInt(formData.get("fontSize")     || "14", 10),
    fontFamily:   formData.get("fontFamily")   || "inherit",
    buttonSize:   formData.get("buttonSize")   || "medium",
    // Low Stock Widget
    lowStockEnabled:   formData.get("lowStockEnabled")   === "true",
    lowStockThreshold: parseInt(formData.get("lowStockThreshold") || "5", 10),
    lowStockMessage:   formData.get("lowStockMessage")   || "Only {{remaining_quantity}} items left in stock!",
    lowStockShowIcon:  formData.get("lowStockShowIcon")  === "true",
    lowStockTextColor: formData.get("lowStockTextColor") || "#e32c2b",
    lowStockIconColor: formData.get("lowStockIconColor") || "#e32c2b",
    lowStockCustomCss: formData.get("lowStockCustomCss") || "",
  };

  await prisma.buttonSettings.upsert({
    where: { shop },
    update: payload,
    create: { shop, ...payload },
  });

  return { success: true };
};

// ── Color Picker ──────────────────────────────────────────────────────────────
function ColorPickerField({ label, value, onChange }) {
  const [hex, setHex] = useState(value);

  useEffect(() => { setHex(value); }, [value]);

  const handleHexChange = (v) => {
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
  };

  const handleNativeChange = (e) => {
    setHex(e.target.value);
    onChange(e.target.value);
  };

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd" fontWeight="semibold">{label}</Text>
      <InlineStack gap="200" blockAlign="center">
        <div style={{ position: "relative", width: 40, height: 40 }}>
          <input
            type="color"
            value={hex}
            onChange={handleNativeChange}
            style={{ width: 40, height: 40, padding: 0, border: "1px solid #c9cccf", borderRadius: 6, cursor: "pointer", background: "none" }}
          />
        </div>
        <div style={{ width: 130 }}>
          <TextField
            label=""
            labelHidden
            value={hex}
            onChange={handleHexChange}
            prefix="#"
            autoComplete="off"
            monospaced
          />
        </div>
      </InlineStack>
    </BlockStack>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────
function SliderField({ label, value, min, max, unit, onChange }) {
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="p" variant="bodyMd" fontWeight="semibold">{label}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{value} {unit}</Text>
      </InlineStack>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#2c6ecb" }}
      />
    </BlockStack>
  );
}

// ── Size Picker ───────────────────────────────────────────────────────────────
function SizePicker({ value, onChange }) {
  const sizes = ["small", "medium", "large"];
  return (
    <InlineStack gap="200">
      {sizes.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          style={{
            padding: "6px 18px",
            borderRadius: 6,
            border: `2px solid ${value === s ? "#2c6ecb" : "#c9cccf"}`,
            background: value === s ? "#2c6ecb" : "#fff",
            color: value === s ? "#fff" : "#202223",
            fontWeight: 600,
            cursor: "pointer",
            textTransform: "capitalize",
            fontSize: 14,
          }}
        >
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </InlineStack>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, id }) {
  return (
    <div
      id={id}
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: value ? "#008060" : "#c9cccf",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s ease",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        top: 3,
        left: value ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        transition: "left 0.2s ease",
      }} />
    </div>
  );
}

// ── Low Stock Preview ─────────────────────────────────────────────────────────
function LowStockPreview({ message, showIcon, textColor, iconColor, threshold }) {
  const rendered = message.replace("{{remaining_quantity}}", String(threshold));
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      background: "#fff8f8",
      border: `1px solid ${textColor}33`,
      borderRadius: 6,
      marginTop: 8,
    }}>
      {showIcon && (
        <svg viewBox="0 0 20 20" width={16} height={16} fill={iconColor} style={{ flexShrink: 0 }}>
          <path d="M10 0a10 10 0 100 20A10 10 0 0010 0zm0 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm1-5H9V5h2v5z"/>
        </svg>
      )}
      <span style={{ color: textColor, fontSize: 13, fontWeight: 500 }}>{rendered}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ButtonSettingsPage() {
  const { settings } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSaving = navigation.state === "submitting";

  // ── Button Settings state ──
  const [buttonText,   setButtonText]   = useState(settings.buttonText);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [textColor,    setTextColor]    = useState(settings.textColor);
  const [borderRadius, setBorderRadius] = useState(settings.borderRadius);
  const [fontSize,     setFontSize]     = useState(settings.fontSize);
  const [fontFamily,   setFontFamily]   = useState(settings.fontFamily);
  const [buttonSize,   setButtonSize]   = useState(settings.buttonSize);

  // ── Low Stock Widget state ──
  const [lowStockEnabled,   setLowStockEnabled]   = useState(settings.lowStockEnabled ?? false);
  const [lowStockThreshold, setLowStockThreshold] = useState(String(settings.lowStockThreshold ?? 5));
  const [lowStockMessage,   setLowStockMessage]   = useState(settings.lowStockMessage ?? "Only {{remaining_quantity}} items left in stock!");
  const [lowStockShowIcon,  setLowStockShowIcon]  = useState(settings.lowStockShowIcon ?? true);
  const [lowStockTextColor, setLowStockTextColor] = useState(settings.lowStockTextColor ?? "#e32c2b");
  const [lowStockIconColor, setLowStockIconColor] = useState(settings.lowStockIconColor ?? "#e32c2b");
  const [lowStockCustomCss, setLowStockCustomCss] = useState(settings.lowStockCustomCss ?? "");
  const [showStylePanel,    setShowStylePanel]    = useState(false);

  const [saved, setSaved] = useState(false);

  const previewPadding  = buttonSize === "small" ? "6px 14px" : buttonSize === "large" ? "14px 36px" : "10px 24px";
  const previewFontSize = buttonSize === "small" ? 12 : buttonSize === "large" ? 18 : 14;

  const handleSave = () => {
    const formData = new FormData();
    formData.append("buttonText",   buttonText);
    formData.append("primaryColor", primaryColor);
    formData.append("textColor",    textColor);
    formData.append("borderRadius", String(borderRadius));
    formData.append("fontSize",     String(fontSize));
    formData.append("fontFamily",   fontFamily);
    formData.append("buttonSize",   buttonSize);
    // Low Stock
    formData.append("lowStockEnabled",   String(lowStockEnabled));
    formData.append("lowStockThreshold", lowStockThreshold);
    formData.append("lowStockMessage",   lowStockMessage);
    formData.append("lowStockShowIcon",  String(lowStockShowIcon));
    formData.append("lowStockTextColor", lowStockTextColor);
    formData.append("lowStockIconColor", lowStockIconColor);
    formData.append("lowStockCustomCss", lowStockCustomCss);
    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fontFamilyOptions = [
    { label: "Form Font Family (inherit)", value: "inherit" },
    { label: "Sans-serif",    value: "sans-serif" },
    { label: "Serif",         value: "serif" },
    { label: "Monospace",     value: "monospace" },
    { label: "Arial",         value: "Arial, sans-serif" },
    { label: "Georgia",       value: "Georgia, serif" },
    { label: "Verdana",       value: "Verdana, sans-serif" },
    { label: "Trebuchet MS",  value: "'Trebuchet MS', sans-serif" },
  ];

  return (
    <Page
      title={<Text variant="heading2xl" as="h1" fontWeight="bold">🎨 Customize Button Design</Text>}
      subtitle="Design your storefront's 'Notify Me' button."
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      primaryAction={{
        content: isSaving ? "Saving…" : "Save Settings",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        {saved && (
          <Layout.Section>
            <Banner tone="success" title="Settings saved successfully!" onDismiss={() => setSaved(false)} />
          </Layout.Section>
        )}

        {/* ─── Notify Me Button Settings ─── */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
            {/* ─ Left: Controls ─ */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Button Settings</Text>
                <Divider />

                <TextField
                  label="Button Text"
                  value={buttonText}
                  onChange={setButtonText}
                  autoComplete="off"
                  helpText='Text shown on the storefront "Notify Me" button'
                />

                <Divider />

                <InlineGrid columns={2} gap="500">
                  <ColorPickerField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorPickerField label="Text Color"    value={textColor}    onChange={setTextColor} />
                </InlineGrid>

                <Divider />

                <InlineGrid columns={2} gap="500">
                  <SliderField label="Border Radius" value={borderRadius} min={0}  max={50} unit="px" onChange={setBorderRadius} />
                  <SliderField label="Font Size"     value={fontSize}     min={10} max={28} unit="px" onChange={setFontSize} />
                </InlineGrid>

                <Divider />

                <Select
                  label="Font Family"
                  options={fontFamilyOptions}
                  value={fontFamily}
                  onChange={setFontFamily}
                />

                <Divider />

                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">Button Size</Text>
                  <SizePicker value={buttonSize} onChange={setButtonSize} />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* ─ Right: Button Preview ─ */}
            <div style={{ height: "100%" }}>
              <Card>
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">Button Preview</Text>
                    <Divider />

                    <Box background="bg-surface-secondary" padding="600" borderRadius="200" minHeight="240px">
                      <BlockStack gap="400" align="center">
                        <div style={{ width: "100%", maxWidth: 160, height: 140, background: "#e4e5e7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                          <svg viewBox="0 0 60 60" width="60" height="60" fill="#aeb4ba">
                            <path d="M10 48V20l20-12 20 12v28L30 60 10 48zm20-14.5L13 24v22l17 10v-22.5zm2 0V55.5l17-10V24L32 33.5zm-2-2l17-10.2L30 11.1 13 21.3 30 31.5z"/>
                          </svg>
                        </div>

                        <div style={{ width: "100%", textAlign: "center" }}>
                          <div style={{ background: "#e4e5e7", height: 12, borderRadius: 4, width: "70%", margin: "0 auto 6px" }} />
                          <div style={{ background: "#e4e5e7", height: 10, borderRadius: 4, width: "40%", margin: "0 auto" }} />
                        </div>

                        <button
                          type="button"
                          style={{
                            background: primaryColor,
                            color: textColor,
                            border: "none",
                            borderRadius: `${borderRadius}px`,
                            padding: previewPadding,
                            fontSize: `${fontSize}px`,
                            fontFamily: fontFamily,
                            fontWeight: 600,
                            cursor: "default",
                            width: "100%",
                            marginTop: 8,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {buttonText || "Notify Me"}
                        </button>
                      </BlockStack>
                    </Box>

                    <Box paddingBlockStart="200">
                      <Text as="p" variant="bodySm" tone="subdued">
                        This preview updates live as you adjust the settings on the left.
                      </Text>
                    </Box>
                  </BlockStack>
                </div>
              </Card>
            </div>
          </InlineGrid>
        </Layout.Section>
        {/* ─── Low Stock Widget Section ─── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">

              {/* Header row with toggle */}
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">🛑 Low Stock Alert </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Show a low-stock alert on product pages when inventory falls below your threshold.
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {lowStockEnabled ? "On" : "Off"}
                  </Text>
                  <Toggle
                    id="low-stock-toggle"
                    value={lowStockEnabled}
                    onChange={setLowStockEnabled}
                  />
                </InlineStack>
              </InlineStack>

              <Divider />

              {/* ─ Main widget settings ─ */}
              <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">

                {/* Left – controls */}
                <BlockStack gap="400">

                  {/* Alert Description */}
                  <BlockStack gap="200">
                    <TextField
                      label="Alert Description"
                      value={lowStockMessage}
                      onChange={setLowStockMessage}
                      autoComplete="off"
                      helpText={
                        <span>
                          Use <code style={{ background: "#f1f2f3", padding: "1px 4px", borderRadius: 3 }}>{"{{remaining_quantity}}"}</code> as a placeholder for the live stock count.
                        </span>
                      }
                    />
                  </BlockStack>
                  {/* Threshold */}
                  <TextField
                    label="Low Stock Threshold"
                    type="number"
                    value={lowStockThreshold}
                    onChange={setLowStockThreshold}
                    min={1}
                    max={100}
                    helpText="Show the alert when inventory is at or below this quantity."
                    suffix="items"
                    autoComplete="off"
                  />

                  {/* Show icon toggle */}
                  <InlineStack gap="300" blockAlign="center">
                    <label htmlFor="show-icon-toggle" style={{ cursor: "pointer", userSelect: "none" }}>
                      <InlineStack gap="200" blockAlign="center">
                        <input
                          id="show-icon-toggle"
                          type="checkbox"
                          checked={lowStockShowIcon}
                          onChange={(e) => setLowStockShowIcon(e.target.checked)}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#2c6ecb" }}
                        />
                        <Text as="span" variant="bodyMd">Show icon</Text>
                      </InlineStack>
                    </label>
                  </InlineStack>

                  <Divider />

                  {/* Style section */}
                  <BlockStack gap="300">
                    <button
                      type="button"
                      onClick={() => setShowStylePanel(!showStylePanel)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <Text as="span" variant="bodyMd" fontWeight="semibold">Style</Text>
                      <svg
                        viewBox="0 0 20 20"
                        width={18}
                        height={18}
                        fill="#6d7175"
                        style={{ transform: showStylePanel ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                      >
                        <path d="M6 4l6 6-6 6" stroke="#6d7175" strokeWidth="2" fill="none" strokeLinecap="round"/>
                      </svg>
                    </button>

                    {showStylePanel && (
                      <BlockStack gap="400">
                        <InlineGrid columns={2} gap="500">
                          <ColorPickerField
                            label="Text Color"
                            value={lowStockTextColor}
                            onChange={setLowStockTextColor}
                          />
                          <ColorPickerField
                            label="Icon Color"
                            value={lowStockIconColor}
                            onChange={setLowStockIconColor}
                          />
                        </InlineGrid>

                        {/* Manual CSS */}
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">Manual CSS code</Text>
                            <span style={{ fontSize: 12, background: "#e3f1df", color: "#008060", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
                              optional
                            </span>
                          </InlineStack>
                          <textarea
                            value={lowStockCustomCss}
                            onChange={(e) => setLowStockCustomCss(e.target.value)}
                            placeholder={`.low-stock-alert {\n  font-weight: bold;\n}`}
                            rows={5}
                            style={{
                              width: "100%",
                              fontFamily: "monospace",
                              fontSize: 13,
                              border: "1px solid #c9cccf",
                              borderRadius: 6,
                              padding: "8px 12px",
                              resize: "vertical",
                              boxSizing: "border-box",
                              background: "#fafbfb",
                              color: "#202223",
                            }}
                          />
                        </BlockStack>
                      </BlockStack>
                    )}
                  </BlockStack>
                </BlockStack>

                {/* Right – live preview */}
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Live Preview</Text>
                  <Divider />
                  <Box background="bg-surface-secondary" padding="500" borderRadius="200">
                    <BlockStack gap="300">
                      {/* Fake product page */}
                      <div style={{ display: "flex", gap: 16 }}>
                        <div style={{ width: 80, height: 80, background: "#e4e5e7", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg viewBox="0 0 60 60" width="36" height="36" fill="#aeb4ba">
                            <path d="M10 48V20l20-12 20 12v28L30 60 10 48zm20-14.5L13 24v22l17 10v-22.5zm2 0V55.5l17-10V24L32 33.5zm-2-2l17-10.2L30 11.1 13 21.3 30 31.5z"/>
                          </svg>
                        </div>
                        <BlockStack gap="100">
                          <div style={{ background: "#e4e5e7", height: 14, borderRadius: 3, width: 110 }} />
                          <div style={{ background: "#e4e5e7", height: 11, borderRadius: 3, width: 60, marginTop: 4 }} />
                          <div style={{ background: "#e4e5e7", height: 9,  borderRadius: 3, width: 130, marginTop: 6 }} />
                          <div style={{ background: "#e4e5e7", height: 9,  borderRadius: 3, width: 90 }} />
                          <div style={{ background: "#c9cccf", height: 28, borderRadius: 4, width: "100%", marginTop: 8 }} />
                        </BlockStack>
                      </div>

                      {/* Alert widget */}
                      {lowStockEnabled ? (
                        <LowStockPreview
                          message={lowStockMessage}
                          showIcon={lowStockShowIcon}
                          textColor={lowStockTextColor}
                          iconColor={lowStockIconColor}
                          threshold={parseInt(lowStockThreshold, 10) || 5}
                        />
                      ) : (
                        <div style={{ padding: "10px 12px", background: "#f6f6f7", borderRadius: 6, textAlign: "center" }}>
                          <Text as="span" variant="bodySm" tone="subdued">Widget is off — toggle to enable</Text>
                        </div>
                      )}
                    </BlockStack>
                  </Box>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Preview updates live as you change settings.
                  </Text>
                </BlockStack>

              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
