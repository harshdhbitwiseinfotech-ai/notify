import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import prisma from "../db.server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env files in priority order — backend .env has SMTP credentials
dotenv.config({ path: path.resolve(__dirname, "../../../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

// Cache the test account so we don't recreate it on every email
let testAccountPromise = null;
let cachedTransporter = null;

const getTransporter = async () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const secure = smtpPort === 465;

  if (smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await cachedTransporter.verify();
      console.log("[Email Service] SMTP transporter verified successfully.");
    } catch (verifyError) {
      console.error("[Email Service] SMTP transporter verification failed:", verifyError);
      cachedTransporter = null;
      throw verifyError;
    }

    return cachedTransporter;
  }

  console.warn(
    "[Email Service] SMTP_USER or SMTP_PASS is not configured. Using Ethereal test transport, so emails will not be delivered to real customers."
  );

  if (!testAccountPromise) {
    testAccountPromise = nodemailer.createTestAccount();
  }
  const testAccount = await testAccountPromise;
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return cachedTransporter;
};

export async function sendRestockEmail({
  to,
  customerName,
  productTitle,
  variantTitle,
  shop,
  productId,
  productImage
}) {
  const productHandle = productId.split("/").pop(); 
  const productUrl = `https://${shop}/products/${productHandle}`;

  const variantText = variantTitle && variantTitle !== "Default Title" ? ` — ${variantTitle}` : "";
  const fullTitle = `${productTitle}${variantText}`;

  let subject = `🎉 Good news! ${productTitle} is back in stock!`;
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Back in Stock Notification</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; }
        .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 24px 0; }
        .email-container { width: 100%; max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
        .hero { background-color: #6d28d9; padding: 42px 32px 30px; text-align: center; color: #ffffff; }
        .hero h1 { margin: 0; font-size: 32px; letter-spacing: -0.03em; line-height: 1.1; }
        .hero p { margin: 10px auto 0; font-size: 15px; opacity: 0.9; max-width: 380px; }
        .content { padding: 32px; }
        .content p { margin: 0; line-height: 1.75; }
        .greeting { font-size: 17px; font-weight: 700; margin-bottom: 12px; }
        .message { font-size: 15px; color: #4b5563; margin-bottom: 28px; }
        .card { border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; background-color: #ffffff; text-align: center; margin-bottom: 28px; }
        .product-image { width: auto; max-width: 420px; display: block; margin: 0 auto; object-fit: cover; border-bottom: 1px solid #e5e7eb; }
        .product-details { padding: 24px 22px 26px; text-align: center; }
        .product-title { margin: 0; font-size: 16px; font-weight: 700; color: #111827; }
        .button-wrap { text-align: center; margin-bottom: 28px; }
        .button { display: inline-block; background-color: #6d28d9; color: #ffffff !important; text-decoration: none; padding: 15px 34px; border-radius: 999px; font-size: 15px; font-weight: 700; }
        .footer { padding: 20px 32px 30px; text-align: center; font-size: 13px; color: #9ca3af; }
        .footer a { color: #6d28d9; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="hero">
            <h1>${headerTitle}</h1>
            <p>${headerSubtitle}</p>
          </div>
          <div class="content">
            <p class="greeting">Hi ${displayName},</p>
            <p class="message">Great news! An item you've been waiting for is officially available again. Grab yours before it runs out of stock completely!</p>
            <div class="card">
              ${productImage ? `<img src="${productImage}" alt="${fullTitle}" class="product-image" />` : ''}
              <div class="product-details">
                <p class="product-title">${fullTitle}</p>
              </div>
            </div>
            <div class="button-wrap">
              <a href="${productUrl}" class="button">${buttonText}</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${shop.replace(/^https?:\/\//, '')}. All rights reserved.</p>
            <p><a href="${productUrl}">Unsubscribe</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { shop_templateType: { shop, templateType: "restock" } }
    });

    if (template) {
      const sampleData = {
        "{{customer_first_name}}": displayName.split(" ")[0] || displayName,
        "{{customer_name}}":       displayName,
        "{{product_name}}":        fullTitle,
        "{{store_name}}":          shop,
        "{{product_url}}":         productUrl,
      };

      let resolvedBody    = template.bodyHtml || "";
      let resolvedSubject = template.subjectLine || subject;
      for (const [tag, val] of Object.entries(sampleData)) {
        resolvedBody    = resolvedBody.split(tag).join(val);
        resolvedSubject = resolvedSubject.split(tag).join(val);
      }
      
      const logoHtml = template.brandLogoUrl
        ? `<div style="text-align:center;padding:20px 0 10px;"><img src="${template.brandLogoUrl}" alt="Brand" style="max-height:70px;max-width:220px;" /></div>`
        : `<div style="text-align:center;padding:20px 0 10px;font-size:22px;font-weight:700;color:#2c6ecb;letter-spacing:-0.5px;">${shop}</div>`;

      const ctaHtml = `<div style="text-align:center;margin:24px 0;">
        <a href="${productUrl}" style="display:inline-block;background:#2c6ecb;color:#fff;text-decoration:none;padding:13px 36px;border-radius:6px;font-weight:600;font-size:15px;">${template.ctaButtonText || "Shop Now"}</a>
      </div>`;

      html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Back In Stock</title></head>
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
      
      subject = resolvedSubject;
    }
  } catch (error) {
    console.error("[Email Service] Error fetching template:", error);
  }


  const text = `
    Great news! The item you were waiting for is now back in stock:
    
    ${fullTitle}
    
    Shop now before it sells out again:
    ${productUrl}
    
    ---
    You received this email because you signed up for a back-in-stock alert on ${shop}.
  `.replace(/^ +/gm, '').trim();

  const transporter = await getTransporter();

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "alerts@backinstock.local";
    const info = await transporter.sendMail({
      from: `"${shop} Restock Alerts" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`[Email Sent] Message sent to ${to}: ${info.messageId}`);
    console.log(`[Email Sent] SMTP from=${fromAddress} host=${process.env.SMTP_HOST || "smtp.gmail.com"} port=${process.env.SMTP_PORT || 587}`);

    if (!process.env.SMTP_USER) {
      console.log("======================================================");
      console.log(`✉️  EMAIL SUCCESSFULLY GENERATED (Test Mode)`);
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      console.log("======================================================");
    }

    return { success: true, messageId: info.messageId, previewUrl: process.env.SMTP_USER ? undefined : nodemailer.getTestMessageUrl(info) };
  } catch (error) {
    console.error("[Email Error] Failed to send restock email:", {
      to,
      shop,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER ? "configured" : "missing",
      smtpFrom: process.env.SMTP_FROM,
      error: error?.message || error,
    });
    throw error;
  }
}

