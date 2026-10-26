import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const providers = await db.aIModelProvider.findMany({
    orderBy: { name: "asc" },
    include: {
      models: {
        orderBy: { slug: "asc" },
        include: { capabilities_rel: true, _count: { select: { routingPolicies: true } } },
      },
    },
  });
  const routingPolicies = await db.aIModelRoutingPolicy.findMany({
    include: { primaryModel: true, _count: { select: { agents: true } } },
    orderBy: { slug: "asc" },
  });
  const fallbackPolicies = await db.aIFallbackPolicy.findMany({
    include: { _count: { select: { agents: true } } },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json({ providers, routingPolicies, fallbackPolicies });
}
