export type PlanId = "free" | "pro" | "business";

export interface PlanLimits {
  maxAgents: number;
  maxMessagesPerDay: number;
  maxSkills: number;
  customBranding: boolean;
  embedWidget: boolean;
  analytics: boolean;
  apiAccess: boolean;
}

export interface Plan {
  name: string;
  priceMonthly: number; // cents
  priceId: string;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    priceId: "",
    limits: {
      maxAgents: 3,
      maxMessagesPerDay: 50,
      maxSkills: 2,
      customBranding: false,
      embedWidget: true,
      analytics: false,
      apiAccess: false,
    },
  },
  pro: {
    name: "Pro",
    priceMonthly: 2900,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    limits: {
      maxAgents: 25,
      maxMessagesPerDay: 2000,
      maxSkills: 4,
      customBranding: true,
      embedWidget: true,
      analytics: true,
      apiAccess: false,
    },
  },
  business: {
    name: "Business",
    priceMonthly: 9900,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID || "",
    limits: {
      maxAgents: 999,
      maxMessagesPerDay: 10000,
      maxSkills: 4,
      customBranding: true,
      embedWidget: true,
      analytics: true,
      apiAccess: true,
    },
  },
} as const;

export function getPlan(planId: string): Plan {
  return PLANS[planId as PlanId] || PLANS.free;
}
