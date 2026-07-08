import nodemailer from "nodemailer";

// Basic transporter setup. 
// For production, you would configure these in your .env file
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
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
  
  // HTML content with basic styling for a beautiful UI
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
          background-color: #f9f9f9;
          margin: 0;
          padding: 0;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .header {
          background-color: #000000;
          padding: 20px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .product-image {
          max-width: 250px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .product-title {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 10px;
        }
        .message {
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 30px;
          color: #555;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff !important;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 16px;
        }
        .footer {
          background-color: #f1f1f1;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Great News!</h1>
        </div>
        <div class="content">
          <p class="message">The item you've been waiting for is finally back in stock.</p>
          
          ${productImage ? `<img src="${productImage}" alt="${productTitle}" class="product-image" />` : ''}
          
          <h2 class="product-title">${fullTitle}</h2>
          
          <p class="message">Hurry up and grab yours before it sells out again!</p>
          
          <a href="${productUrl}" class="button">Shop Now</a>
        </div>
        <div class="footer">
          <p>You received this email because you signed up for a back-in-stock alert on ${shop}.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Fallback plain text version
  const text = `
    Great news! The item you were waiting for is now back in stock:
    
    ${fullTitle}
    
    Shop now before it sells out again:
    ${productUrl}
    
    ---
    You received this email because you signed up for a back-in-stock alert on ${shop}.
  `.replace(/^ +/gm, '').trim();

  // If no SMTP user is provided, we can fallback to console output or Ethereal for testing
  if (!process.env.SMTP_USER) {
    console.log("=========================================");
    console.log(`[TEST EMAIL] Would send email to: ${to}`);
    console.log(`[TEST EMAIL] Subject: ${subject}`);
    console.log(`[TEST EMAIL] Link: ${productUrl}`);
    console.log("=========================================");
    return { success: true, message: "Logged to console (No SMTP configured)" };
  }

  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: `"${shop} Restock Alerts" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`[Email Sent] Message sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Error] Failed to send email:", error);
    throw error;
  }
}
