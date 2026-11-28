import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AURA_PRICES_CENTS: Record<"ember" | "flare" | "nova", { month: number; year: number }> = {
  ember: { month: 299, year: 2990 },
  flare: { month: 599, year: 5990 },
  nova: { month: 999, year: 9990 },
};

const SPARKS_PACKS: Record<string, { sparks: number; amountCents: number; title: string }> = {
  pack_250: { sparks: 250, amountCents: 299, title: "250 Orbit Credits" },
  pack_750: { sparks: 750, amountCents: 799, title: "750 Orbit Credits" },
  pack_2000: { sparks: 2000, amountCents: 1799, title: "2,000 Orbit Credits" },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Missing Supabase environment variables" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as {
    kind?: "aura" | "sparks";
    tier?: "ember" | "flare" | "nova";
    cycle?: "month" | "year";
    packId?: string;
    provider?: "stripe" | "lemonsqueezy" | "click" | "payme";
    returnUrl?: string;
  };

  const provider = body.provider ?? "stripe";
  if (!["stripe", "lemonsqueezy", "click", "payme"].includes(provider)) {
    return json({ error: "Unsupported payment provider" }, 400);
  }

  let amountCents = 0;
  let sparksAmount = 0;
  let itemTitle = "";
  let tier: "ember" | "flare" | "nova" | null = null;
  let cycle: "month" | "year" | null = null;

  if (body.kind === "aura") {
    if (!body.tier || !AURA_PRICES_CENTS[body.tier]) return json({ error: "Invalid plan tier" }, 400);
    tier = body.tier;
    cycle = body.cycle === "year" ? "year" : "month";
    amountCents = AURA_PRICES_CENTS[tier][cycle];
    itemTitle = `Orbit+ ${tier.toUpperCase()} (${cycle})`;
  } else if (body.kind === "sparks") {
    const pack = body.packId ? SPARKS_PACKS[body.packId] : undefined;
    if (!pack) return json({ error: "Invalid credit pack" }, 400);
    amountCents = pack.amountCents;
    sparksAmount = pack.sparks;
    itemTitle = pack.title;
  } else {
    return json({ error: "Invalid order kind" }, 400);
  }

  const safeReturnUrl = (body.returnUrl ?? "https://orbitmc.vercel.app").replace(/\/+$/, "");
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: order, error: insertErr } = await admin
    .from("billing_orders")
    .insert({
      user_id: userData.user.id,
      kind: body.kind,
      tier,
      cycle,
      sparks_amount: sparksAmount,
      amount_cents: amountCents,
      currency: "USD",
      provider,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !order) return json({ error: "Could not initialize order" }, 500);
  const orderId = order.id as string;

  if (provider === "stripe") {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ mode: "unconfigured", provider, orderId });
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${safeReturnUrl}/?billing=success&order=${orderId}`);
    params.set("cancel_url", `${safeReturnUrl}/?billing=cancelled&order=${orderId}`);
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", itemTitle);
    params.set("line_items[0][price_data][unit_amount]", String(amountCents));
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[order_id]", orderId);
    params.set("metadata[user_id]", userData.user.id);
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok || !session?.url) return json({ error: "Stripe checkout failed" }, 502);
    await admin.from("billing_orders").update({ provider_session_id: session.id }).eq("id", orderId);
    return json({ mode: "live", provider, orderId, url: session.url });
  }

  if (provider === "lemonsqueezy") {
    const baseCheckout = Deno.env.get("LEMONSQUEEZY_CHECKOUT_URL");
    if (!baseCheckout) return json({ mode: "unconfigured", provider, orderId });
    const url = `${baseCheckout}?checkout[custom][order_id]=${encodeURIComponent(orderId)}&checkout[email]=${encodeURIComponent(userData.user.email ?? "")}`;
    return json({ mode: "live", provider, orderId, url });
  }

  const uzsPerUsd = Number(Deno.env.get("UZS_PER_USD") ?? "12850") || 12850;
  const amountUzs = Math.round((amountCents / 100) * uzsPerUsd);

  if (provider === "click") {
    const merchantId = Deno.env.get("CLICK_MERCHANT_ID");
    const serviceId = Deno.env.get("CLICK_SERVICE_ID");
    if (!merchantId || !serviceId) return json({ mode: "unconfigured", provider, orderId });
    const url = `https://my.click.uz/services/pay?service_id=${encodeURIComponent(serviceId)}&merchant_id=${encodeURIComponent(merchantId)}&amount=${amountUzs}&transaction_param=${encodeURIComponent(orderId)}&return_url=${encodeURIComponent(safeReturnUrl)}`;
    return json({ mode: "live", provider, orderId, url });
  }

  if (provider === "payme") {
    const merchantId = Deno.env.get("PAYME_MERCHANT_ID");
    if (!merchantId) return json({ mode: "unconfigured", provider, orderId });
    const amountTiyin = amountUzs * 100;
    const raw = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin};c=${safeReturnUrl}`;
    const url = `https://checkout.paycom.uz/${btoa(raw)}`;
    return json({ mode: "live", provider, orderId, url });
  }

  return json({ mode: "unconfigured", provider, orderId });
});
