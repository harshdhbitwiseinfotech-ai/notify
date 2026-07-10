import nodemailer from "nodemailer";

// Cache the test account so we don't recreate it on every email
let testAccountPromise = null;

const getTransporter = async () => {
  if (process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Automatically use Ethereal for testing if SMTP is not configured
    if (!testAccountPromise) {
      testAccountPromise = nodemailer.createTestAccount();
    }
    const testAccount = await testAccountPromise;
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, 
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
};

export async function sendRestockEmail({
  to,
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

  const subject = `🎉 Good news! ${productTitle} is back in stock!`;
  
  // HTML content matching the exact requested UI (Purple header, 5% OFF coupon, etc.)
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Back in Stock Notification</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: #ffffff;
          margin: 0;
          padding: 40px 0;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .header {
          background-color: #8b5cf6; /* Matches the exact purple in the screenshot */
          padding: 30px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: bold;
        }
        .header p {
          margin: 10px 0 0;
          font-size: 14px;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .message {
          font-size: 15px;
          line-height: 1.5;
          color: #4b5563;
          margin-bottom: 30px;
        }
        .coupon-box {
          border: 1px dashed #cbd5e1;
          background-color: #f8fafc;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          margin-bottom: 25px;
        }
        .coupon-label {
          font-size: 12px;
          font-weight: bold;
          color: #64748b;
          letter-spacing: 1px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .coupon-discount {
          font-size: 42px;
          font-weight: 900;
          color: #8b5cf6; /* Purple text */
          margin: 0 0 15px 0;
        }
        .coupon-code {
          display: inline-block;
          background-color: #e2e8f0;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          color: #475569;
          letter-spacing: 1px;
        }
        .product-box {
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          margin-bottom: 30px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .product-image {
          max-width: 150px;
          max-height: 150px;
          border-radius: 4px;
          margin-bottom: 20px;
          object-fit: contain;
        }
        .product-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .button-container {
          text-align: center;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          background-color: #8b5cf6;
          color: #ffffff !important;
          text-decoration: none;
          padding: 16px 48px;
          border-radius: 30px;
          font-weight: bold;
          font-size: 16px;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #f1f5f9;
        }
        .footer a {
          color: #8b5cf6;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Back In Stock</h1>
          <p>Special Store Offer</p>
        </div>
        <div class="content">
          <p class="greeting">Hi there,</p>
          <p class="message">The item you've been waiting for is finally back in stock! Here is an exclusive discount code for your next purchase. Use it at checkout to claim your savings!</p>
          
          <div class="coupon-box">
            <div class="coupon-label">COUPON DISCOUNT</div>
            <h2 class="coupon-discount">5% OFF</h2>
            <div class="coupon-code">OFFER-540A5B</div>
          </div>

          <div class="product-box">
            ${productImage ? `<img src="${productImage}" alt="${productTitle}" class="product-image" />` : ''}
            <p class="product-title">${fullTitle}</p>
          </div>
          
          <div class="button-container">
            <a href="${productUrl}" class="button">Claim Your Offer Now</a>
          </div>
        </div>
        <div class="footer">
          <p>&copy; 2026 ${shop}. All rights reserved.</p>
          <p><a href="#">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

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
    const info = await transporter.sendMail({
      from: `"${shop} Restock Alerts" <${process.env.SMTP_FROM || "alerts@backinstock.local"}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`[Email Sent] Message sent to ${to}: ${info.messageId}`);
    
    // If using Ethereal (no SMTP_USER), generate a URL to view the email
    if (!process.env.SMTP_USER) {
      console.log("======================================================");
      console.log(`✉️  EMAIL SUCCESSFULLY GENERATED (Test Mode)`);
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      console.log("======================================================");
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Error] Failed to send email:", error);
    throw error;
  }
}
