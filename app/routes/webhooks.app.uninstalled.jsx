import { authenticate } from "../shopify.server";
import db from "../db.server";
import { removeScriptTags } from "../utils/scriptTag.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Remove our storefront ScriptTag from the store
  if (session) {
    try {
      await removeScriptTags(session);
    } catch (err) {
      console.error("[Uninstall] removeScriptTags error:", err);
    }
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
