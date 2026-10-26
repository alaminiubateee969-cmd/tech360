import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER"], req);
  if (!auth.ok) return auth.response;
  try {
    const [departments, agents, skills, prompts, sops] = await Promise.all([
      db.aIDepartment.count(), db.aIAgent.count(), db.aISkill.count(), db.aIPrompt.count(), db.aISOP.count(),
    ]);
    const [rules, kgNodes, kgEdges, mcpServers, mcpTools, dataLake, apiRoutes, eventSubs, dcc] = await Promise.all([
      db.aIConstitutionalRule.count().catch(() => 0),
      db.aIKnowledgeNode.count().catch(() => 0),
      db.aIKnowledgeEdge.count().catch(() => 0),
      db.aIMCPServer.count().catch(() => 0),
      db.aIMCPTool.count().catch(() => 0),
      db.aIDataLakeDataset.count().catch(() => 0),
      db.aIAPIGatewayRoute.count().catch(() => 0),
      db.aIEventSubscription.count().catch(() => 0),
      db.aIDepartmentCapabilityCertification.findMany({ orderBy: { overallScore: "desc" } }).catch(() => []),
    ]);
    const certified = dcc.filter((d: { certified: boolean }) => d.certified).length;
    const platinum = dcc.filter((d: { certificationLevel: string }) => d.certificationLevel === "PLATINUM").length;
    const gold = dcc.filter((d: { certificationLevel: string }) => d.certificationLevel === "GOLD").length;
    const silver = dcc.filter((d: { certificationLevel: string }) => d.certificationLevel === "SILVER").length;
    let metrics: unknown[] = [];
    let alerts: unknown[] = [];
    try { metrics = await db.aIObservabilityMetric.findMany({ orderBy: { timestamp: "desc" }, take: 12 }); alerts = await db.aIObservabilityAlert.findMany(); } catch {}
    return NextResponse.json({
      counts: { departments, agents, skills, prompts, sops, constitutionalRules: rules, knowledgeGraphNodes: kgNodes, knowledgeGraphEdges: kgEdges, mcpServers, mcpTools, dataLakeDatasets: dataLake, apiGatewayRoutes: apiRoutes, eventSubscriptions: eventSubs },
      dcc: { total: dcc.length, certified, platinum, gold, silver, bronze: 0, none: dcc.length - certified, topDepartments: dcc.slice(0, 10).map((d: Record<string, unknown>) => ({ slug: d.departmentId as string, name: "Dept", overallScore: d.overallScore as number, level: d.certificationLevel as string, certified: d.certified as boolean, canSpawnAgents: d.canSpawnAgents as boolean })) },
      metrics, alerts,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
