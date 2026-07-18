import { useState, useCallback, useEffect, useRef } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
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

  useEffect(() => {
    setHex(value);
  }, [value]);

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
        {/* Native color swatch */}
        <div style={{ position: "relative", width: 40, height: 40 }}>
          <input
            type="color"
            value={hex}
            onChange={handleNativeChange}
            style={{
              width: 40,
              height: 40,
              padding: 0,
              border: "1px solid #c9cccf",
              borderRadius: 6,
              cursor: "pointer",
              background: "none",
            }}
          />
        </div>
        {/* Hex text field */}
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function ButtonSettingsPage() {
  const { settings } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [buttonText,   setButtonText]   = useState(settings.buttonText);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [textColor,    setTextColor]    = useState(settings.textColor);
  const [borderRadius, setBorderRadius] = useState(settings.borderRadius);
  const [fontSize,     setFontSize]     = useState(settings.fontSize);
  const [fontFamily,   setFontFamily]   = useState(settings.fontFamily);
  const [buttonSize,   setButtonSize]   = useState(settings.buttonSize);
  const [saved, setSaved] = useState(false);

  const previewPadding = buttonSize === "small" ? "6px 14px" : buttonSize === "large" ? "14px 36px" : "10px 24px";
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
    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fontFamilyOptions = [
    { label: "Form Font Family (inherit)", value: "inherit" },
    { label: "Sans-serif", value: "sans-serif" },
    { label: "Serif", value: "serif" },
    { label: "Monospace", value: "monospace" },
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Verdana", value: "Verdana, sans-serif" },
    { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  ];

  return (
    <Page
      title={<Text variant="heading2xl" as="h1" fontWeight="bold">🎨 Customize Button Design</Text>}
      subtitle="Design your storefront's 'Notify Me' button."
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{
        content: isSaving ? "Saving…" : "Save Settings",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        {saved && (
          <Layout.Section>
            <Banner tone="success" title="Button settings saved successfully!" onDismiss={() => setSaved(false)} />
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
            {/* ─ Left: Controls ─ */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Button Settings</Text>
                <Divider />

                {/* Button Text */}
                <TextField
                  label="Button Text"
                  value={buttonText}
                  onChange={setButtonText}
                  autoComplete="off"
                  helpText='Text shown on the storefront "Notify Me" button'
                />

                <Divider />

                {/* Colors */}
                <InlineGrid columns={2} gap="500">
                  <ColorPickerField
                    label="Primary Color"
                    value={primaryColor}
                    onChange={setPrimaryColor}
                  />
                  <ColorPickerField
                    label="Text Color"
                    value={textColor}
                    onChange={setTextColor}
                  />
                </InlineGrid>

                <Divider />

                {/* Sliders */}
                <InlineGrid columns={2} gap="500">
                  <SliderField
                    label="Border Radius"
                    value={borderRadius}
                    min={0}
                    max={50}
                    unit="px"
                    onChange={setBorderRadius}
                  />
                  <SliderField
                    label="Font Size"
                    value={fontSize}
                    min={10}
                    max={28}
                    unit="px"
                    onChange={setFontSize}
                  />
                </InlineGrid>

                <Divider />

                {/* Font Family */}
                <Select
                  label="Font Family"
                  options={fontFamilyOptions}
                  value={fontFamily}
                  onChange={setFontFamily}
                />

                <Divider />

                {/* Button Size */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">Button Size</Text>
                  <SizePicker value={buttonSize} onChange={setButtonSize} />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* ─ Right: Preview ─ */}
            <div style={{ height: "100%" }}>
              <Card>
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">Button Preview</Text>
                    <Divider />

                    <Box
                      background="bg-surface-secondary"
                      padding="600"
                      borderRadius="200"
                      minHeight="240px"
                    >
                      <BlockStack gap="400" align="center">
                        {/* Placeholder product image */}
                        <div style={{
                          width: "100%",
                          maxWidth: 160,
                          height: 140,
                          background: "#e4e5e7",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto",
                        }}>
                          <svg viewBox="0 0 60 60" width="60" height="60" fill="#aeb4ba">
                            <path d="M10 48V20l20-12 20 12v28L30 60 10 48zm20-14.5L13 24v22l17 10v-22.5zm2 0V55.5l17-10V24L32 33.5zm-2-2l17-10.2L30 11.1 13 21.3 30 31.5z"/>
                          </svg>
                        </div>

                        {/* Faked product info */}
                        <div style={{ width: "100%", textAlign: "center" }}>
                          <div style={{ background: "#e4e5e7", height: 12, borderRadius: 4, width: "70%", margin: "0 auto 6px" }} />
                          <div style={{ background: "#e4e5e7", height: 10, borderRadius: 4, width: "40%", margin: "0 auto" }} />
                        </div>

                        {/* Live Preview Button */}
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
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
