import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyHmacHex(secret: string, payload: string, expectedHex: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const actualHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

async function verifyStripe(secret: string, payload: string, header: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  if (!parts.t || !parts.v1) return false;
  return verifyHmacHex(secret, `${parts.t}.${payload}`, parts.v1);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const rawBody = await req.text();
  let orderId = "";

  const stripeSig = req.headers.get("stripe-signature");
  const lemonSig = req.headers.get("x-signature");

  if (stripeSig) {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    if (!secret || !(await verifyStripe(secret, rawBody, stripeSig))) return json({ error: "Invalid Stripe signature" }, 401);
    const event = JSON.parse(rawBody);
    if (event.type !== "checkout.session.completed") return json({ ignored: true });
    orderId = event.data?.object?.metadata?.order_id ?? "";
  } else if (lemonSig) {
    const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";
    if (!secret || !(await verifyHmacHex(secret, rawBody, lemonSig))) return json({ error: "Invalid LemonSqueezy signature" }, 401);
    const event = JSON.parse(rawBody);
    if (event.meta?.event_name !== "order_created") return json({ ignored: true });
    orderId = event.meta?.custom_data?.order_id ?? "";
  } else {
    return json({ error: "Missing webhook signature" }, 401);
  }

  if (!orderId) return json({ error: "Missing order_id" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: order, error: fetchErr } = await admin
    .from("billing_orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (fetchErr) return json({ error: "Failed to lock order" }, 500);
  if (!order) return json({ alreadyProcessed: true });

  if (order.kind === "aura" && order.tier) {
    const days = order.cycle === "year" ? 365 : 30;
    const renewsAt = new Date(Date.now() + days * 86_400_000).toISOString();
    await admin
      .from("profiles")
      .update({ aura_tier: order.tier, aura_cycle: order.cycle ?? "month", aura_renews_at: renewsAt })
      .eq("id", order.user_id);
  } else if (order.kind === "sparks" && order.sparks_amount > 0) {
    const { data: wallet } = await admin
      .from("market_wallets")
      .select("sparks")
      .eq("user_id", order.user_id)
      .maybeSingle();
    const nextSparks = Math.min(99_999, (wallet?.sparks ?? 300) + Number(order.sparks_amount));
    await admin.from("market_wallets").upsert({ user_id: order.user_id, sparks: nextSparks });
  }

  return json({ fulfilled: true, orderId });
});
