/**
 * scriptTag.server.js
 *
 * Registers the back-in-stock widget ScriptTag on a store using the
 * Shopify REST Admin API.  ScriptTags are injected automatically on
 * every storefront page — no theme-editor action required by the merchant.
 *
 * Usage:
 *   import { ensureScriptTag, removeScriptTags } from "../utils/scriptTag.server";
 *   await ensureScriptTag(session);   // call on app install / first load
 *   await removeScriptTags(session);  // call on app uninstall
 */

const SCRIPT_SRC_PATH = "/back-in-stock.js";

/**
 * Returns the public CDN URL for the back-in-stock.js asset.
 * During development this is the ngrok tunnel; in production it is the
 * Shopify CDN URL served by the extension.
 *
 * We derive it from SHOPIFY_APP_URL which is always set by the CLI.
 */
function getScriptSrc() {
  const appUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  return `${appUrl}${SCRIPT_SRC_PATH}`;
}

/**
 * Lists all ScriptTags for the store.
 */
async function listScriptTags(session) {
  const url = `https://${session.shop}/admin/api/2024-04/script_tags.json`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": session.accessToken,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.error("[ScriptTag] listScriptTags failed:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return data.script_tags || [];
}

/**
 * Creates a ScriptTag.
 */
async function createScriptTag(session, src) {
  const url = `https://${session.shop}/admin/api/2024-04/script_tags.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": session.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      script_tag: {
        event: "onload",
        src,
        display_scope: "online_store",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[ScriptTag] createScriptTag failed:", res.status, text);
    return null;
  }
  const data = await res.json();
  console.log("[ScriptTag] Created ScriptTag:", data.script_tag?.id, src);
  return data.script_tag;
}

/**
 * Deletes a ScriptTag by ID.
 */
async function deleteScriptTag(session, id) {
  const url = `https://${session.shop}/admin/api/2024-04/script_tags/${id}.json`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "X-Shopify-Access-Token": session.accessToken,
    },
  });
  if (!res.ok) {
    console.error("[ScriptTag] deleteScriptTag failed:", res.status);
  } else {
    console.log("[ScriptTag] Deleted ScriptTag:", id);
  }
}

/**
 * Ensures exactly ONE ScriptTag pointing to our widget exists.
 * - If none exists → creates it.
 * - If one already exists with the correct src → does nothing.
 * - If stale / wrong-src tags exist → removes them and creates a fresh one.
 */
export async function ensureScriptTag(session) {
  try {
    const src = getScriptSrc();
    const existing = await listScriptTags(session);

    // Find tags that look like ours (contain our path fragment)
    const ourTags = existing.filter((tag) =>
      tag.src && tag.src.includes("back-in-stock")
    );

    // Already correctly registered?
    const alreadyCorrect = ourTags.find((tag) => tag.src === src);
    if (alreadyCorrect) {
      console.log("[ScriptTag] Already registered correctly:", src);
      return;
    }

    // Remove stale tags (wrong URL / old tunnel)
    for (const tag of ourTags) {
      await deleteScriptTag(session, tag.id);
    }

    // Create the fresh tag
    await createScriptTag(session, src);
  } catch (err) {
    // Non-fatal — log and continue; the App Embed is still a fallback
    console.error("[ScriptTag] ensureScriptTag error:", err);
  }
}

/**
 * Removes ALL of our ScriptTags from the store (call on uninstall).
 */
export async function removeScriptTags(session) {
  try {
    const existing = await listScriptTags(session);
    const ourTags = existing.filter((tag) =>
      tag.src && tag.src.includes("back-in-stock")
    );
    for (const tag of ourTags) {
      await deleteScriptTag(session, tag.id);
    }
  } catch (err) {
    console.error("[ScriptTag] removeScriptTags error:", err);
  }
}
