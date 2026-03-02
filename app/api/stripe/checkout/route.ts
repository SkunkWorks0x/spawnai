import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { PLANS, type PlanId } from "@/lib/stripe/config";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = body.plan as PlanId;

    if (!plan || !PLANS[plan] || plan === "free") {
      return NextResponse.json(
        { error: "Invalid plan. Choose 'pro' or 'business'." },
        { status: 400 }
      );
    }

    // Require authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "auth_required", message: "Please sign in to subscribe." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    // Create or retrieve Stripe customer
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spawnai.vercel.app";
    const planConfig = PLANS[plan];

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { userId: user.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
