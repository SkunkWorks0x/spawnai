import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] signature verification failed:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.toString();

      if (userId && plan) {
        await admin
          .from("profiles")
          .update({
            plan,
            stripe_subscription_id: subscriptionId,
            plan_started_at: new Date().toISOString(),
            payment_status: "active",
          })
          .eq("id", userId);
        console.log(`[stripe/webhook] User ${userId} upgraded to ${plan}`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.toString();

      if (customerId) {
        const status = subscription.status;
        const paymentStatus =
          status === "active" ? "active" : status === "past_due" ? "past_due" : "cancelled";

        await admin
          .from("profiles")
          .update({ payment_status: paymentStatus })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.toString();

      if (customerId) {
        await admin
          .from("profiles")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            payment_status: "cancelled",
          })
          .eq("stripe_customer_id", customerId);
        console.log(`[stripe/webhook] Customer ${customerId} downgraded to free`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.toString();

      if (customerId) {
        await admin
          .from("profiles")
          .update({ payment_status: "past_due" })
          .eq("stripe_customer_id", customerId);
        console.log(`[stripe/webhook] Payment failed for customer ${customerId}`);
      }
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
