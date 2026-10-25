import { db } from "../src/lib/db";
function fnv1a(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

async function main() {
  console.log("Generating Constitutional Rules...");
  await db.aIConstitutionalRule.deleteMany().catch(() => {});
  const categories = ["governance", "security", "compliance", "privacy", "operational", "financial", "ethical", "data-quality", "audit", "safety"];
  const rules: Record<string, unknown>[] = [];
  for (const cat of categories) { for (let i = 1; i <= 50; i++) {
    rules.push({ slug: `rule-${cat}-${String(i).padStart(3, "0")}`, name: `${cat} Rule ${i}`, description: `${cat} rule #${i}`, category: cat, priority: i <= 10 ? "CRITICAL" : i <= 25 ? "HIGH" : "MEDIUM", ruleText: `${cat} rule ${i}: All ${cat} operations must comply with enterprise standards.`, ruleLogic: JSON.stringify({ field: `${cat}.compliant`, operator: "eq", value: true }), enforcement: i <= 10 ? "BLOCK" : i <= 25 ? "WARN" : "LOG" });
  } }
  for (let i = 0; i < rules.length; i += 100) { await db.aIConstitutionalRule.createMany({ data: rules.slice(i, i + 100) }); }
  console.log(`  ✓ ${rules.length} constitutional rules`);

  console.log("Generating DCC...");
  await db.aIDepartmentCapabilityCertification.deleteMany().catch(() => {});
  const depts = await db.aIDepartment.findMany({ select: { id: true, slug: true, _count: { select: { agents: true, sops: true } } } });
  const dccRows: Record<string, unknown>[] = [];
  for (const d of depts) {
    const sop = Math.min(100, (d._count.sops / 5) * 100);
    const know = Math.min(100, 60 + (d._count.sops * 8));
    const skill = Math.min(100, 70 + (d._count.agents * 1.5));
    const test = 92 + (fnv1a(d.slug) % 8);
    const kpi = 85 + (fnv1a(d.slug + "k") % 15);
    const sec = fnv1a(d.slug + "s") % 10 === 0 ? 95 : 100;
    const audit = 100;
    const rec = 88 + (fnv1a(d.slug + "r") % 12);
    const esc = 5 + (fnv1a(d.slug + "e") % 15);
    const overall = sop * 0.10 + know * 0.10 + skill * 0.10 + test * 0.15 + kpi * 0.15 + sec * 0.15 + audit * 0.10 + rec * 0.10 + (100 - esc) * 0.05;
    const allP = sop >= 95 && know >= 95 && skill >= 95 && test >= 95 && kpi >= 90 && sec === 100 && audit === 100 && rec >= 90 && esc <= 10;
    const highP = sop >= 90 && know >= 90 && skill >= 90 && test >= 90 && kpi >= 85 && sec === 100 && audit === 100 && rec >= 85 && esc <= 15;
    const level = allP ? "PLATINUM" : highP ? "GOLD" : sop >= 80 ? "SILVER" : "NONE";
    dccRows.push({ departmentId: d.id, sopCoverage: sop, knowledgeCoverage: know, skillCoverage: skill, testPassRate: test, kpiAchievement: kpi, securityCompliance: sec, auditCompliance: audit, selfRecoverySuccess: rec, humanEscalationRate: esc, overallScore: overall, certified: level === "PLATINUM" || level === "GOLD", certificationLevel: level, canSpawnAgents: level === "PLATINUM" || level === "GOLD", lastEvaluatedAt: new Date() });
  }
  for (let i = 0; i < dccRows.length; i += 50) { await db.aIDepartmentCapabilityCertification.createMany({ data: dccRows.slice(i, i + 50) }); }
  console.log(`  ✓ ${dccRows.length} DCC (${dccRows.filter(r => r.certified).length} certified)`);

  console.log("Generating MCP...");
  await db.aIMCPTool.deleteMany().catch(() => {});
  await db.aIMCPServer.deleteMany().catch(() => {});
  const servers = [
    { slug: "filesystem-mcp", name: "Filesystem MCP", description: "File ops", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-filesystem", capabilities: '["tools","resources"]', status: "ACTIVE" },
    { slug: "postgres-mcp", name: "PostgreSQL MCP", description: "DB queries", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-postgres", capabilities: '["tools"]', status: "ACTIVE" },
    { slug: "web-search-mcp", name: "Web Search MCP", description: "Web search", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-brave-search", capabilities: '["tools"]', status: "ACTIVE" },
    { slug: "github-mcp", name: "GitHub MCP", description: "GitHub ops", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-github", capabilities: '["tools"]', status: "ACTIVE" },
    { slug: "slack-mcp", name: "Slack MCP", description: "Slack messaging", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-slack", capabilities: '["tools"]', status: "ACTIVE" },
    { slug: "memory-mcp", name: "Memory MCP", description: "Persistent memory", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-memory", capabilities: '["tools"]', status: "ACTIVE" },
    { slug: "puppeteer-mcp", name: "Puppeteer MCP", description: "Browser automation", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-puppeteer", capabilities: '["tools"]', status: "ACTIVE" },
    { slug: "time-mcp", name: "Time MCP", description: "Time ops", transport: "stdio", endpoint: "npx @modelcontextprotocol/server-time", capabilities: '["tools"]', status: "ACTIVE" },
  ];
  await db.aIMCPServer.createMany({ data: servers });
  const serverRows = await db.aIMCPServer.findMany({ select: { id: true, slug: true } });
  const toolMap: Record<string, Array<{ slug: string; name: string; description: string; category: string }>> = {
    "filesystem-mcp": [{ slug: "fs-read", name: "Read File", description: "Read file", category: "file" }, { slug: "fs-write", name: "Write File", description: "Write file", category: "file" }],
    "postgres-mcp": [{ slug: "pg-query", name: "SQL Query", description: "Execute SQL", category: "database" }],
    "web-search-mcp": [{ slug: "search-web", name: "Web Search", description: "Search web", category: "search" }],
    "github-mcp": [{ slug: "gh-issue", name: "Create Issue", description: "GitHub issue", category: "github" }],
    "slack-mcp": [{ slug: "slack-send", name: "Send Message", description: "Slack message", category: "comm" }],
    "memory-mcp": [{ slug: "mem-save", name: "Save Memory", description: "Save memory", category: "memory" }, { slug: "mem-recall", name: "Recall", description: "Recall memory", category: "memory" }],
    "puppeteer-mcp": [{ slug: "pup-nav", name: "Navigate", description: "Navigate browser", category: "browser" }],
    "time-mcp": [{ slug: "time-now", name: "Current Time", description: "Get time", category: "time" }],
  };
  const tools: Record<string, unknown>[] = [];
  for (const s of serverRows) { for (const t of toolMap[s.slug] || []) { tools.push({ serverId: s.id, slug: t.slug, name: t.name, description: t.description, inputSchema: '{"type":"object"}', outputSchema: '{"type":"object"}', category: t.category }); } }
  await db.aIMCPTool.createMany({ data: tools });
  console.log(`  ✓ ${servers.length} MCP servers, ${tools.length} tools`);

  console.log("Generating Data Lake...");
  await db.aIDataLakeDataset.deleteMany().catch(() => {});
  await db.aIDataLakeDataset.createMany({ data: [
    { slug: "leads-ds", name: "Leads", description: "CRM leads", source: "crm", schema: '{}', format: "table", rowCount: 16, sizeBytes: 8192, tags: '["crm"]', status: "ACTIVE" },
    { slug: "agents-ds", name: "Agent Executions", description: "AI execution logs", source: "ai-execution", schema: '{}', format: "table", rowCount: 2, sizeBytes: 2048, tags: '["ai"]', status: "ACTIVE" },
    { slug: "dcc-ds", name: "DCC Scores", description: "Certification scores", source: "analytics", schema: '{}', format: "table", rowCount: 100, sizeBytes: 32768, tags: '["dcc"]', status: "ACTIVE" },
  ] });
  console.log("  ✓ 3 datasets");

  console.log("Generating API Gateway...");
  await db.aIAPIGatewayRoute.deleteMany().catch(() => {});
  await db.aIAPIGatewayRoute.createMany({ data: [
    { slug: "agents-list", method: "GET", path: "/api/v1/agents", description: "List agents", authRequired: true, rateLimitPerMin: 60, allowedRoles: '["SUPER_ADMIN"]', targetService: "ai-workforce", status: "ACTIVE" },
    { slug: "agent-exec", method: "POST", path: "/api/v1/agents/:slug/execute", description: "Execute agent", authRequired: true, rateLimitPerMin: 30, allowedRoles: '["SUPER_ADMIN"]', targetService: "ai-executor", status: "ACTIVE" },
    { slug: "leads-create", method: "POST", path: "/api/v1/leads", description: "Create lead", authRequired: false, rateLimitPerMin: 10, allowedRoles: '[]', targetService: "crm", status: "ACTIVE" },
    { slug: "rag-search", method: "GET", path: "/api/v1/rag/search", description: "Search RAG", authRequired: true, rateLimitPerMin: 30, allowedRoles: '["SUPER_ADMIN"]', targetService: "rag", status: "ACTIVE" },
  ] });
  console.log("  ✓ 4 routes");

  console.log("Generating Event Bus...");
  await db.aIEventSubscription.deleteMany().catch(() => {});
  await db.aIEventSubscription.createMany({ data: [
    { subscriberType: "engine", subscriberId: "planning", eventType: "agent.executed", handler: "planning.onExec", active: true },
    { subscriberType: "engine", subscriberId: "reflection", eventType: "agent.executed", handler: "reflection.onExec", active: true },
    { subscriberType: "engine", subscriberId: "self-healing", eventType: "incident.raised", handler: "healing.onIncident", active: true },
    { subscriberType: "engine", subscriberId: "audit", eventType: "*", handler: "audit.log", active: true },
  ] });
  console.log("  ✓ 4 subscriptions");

  console.log("Generating Observability...");
  await db.aIObservabilityAlert.deleteMany().catch(() => {});
  await db.aIObservabilityMetric.deleteMany().catch(() => {});
  await db.aIObservabilityMetric.createMany({ data: [
    { name: "agent.success_rate", value: 94.5, unit: "%", tags: '{}', timestamp: new Date() },
    { name: "system.token_cost_daily", value: 12.34, unit: "USD", tags: '{}', timestamp: new Date() },
    { name: "system.execution_count", value: 47, unit: "count", tags: '{}', timestamp: new Date() },
    { name: "system.avg_latency_ms", value: 2840, unit: "ms", tags: '{}', timestamp: new Date() },
  ] });
  await db.aIObservabilityAlert.createMany({ data: [
    { name: "High Failure Rate", metric: "agent.failure_rate", condition: "gt", threshold: 10, severity: "WARN", status: "ACTIVE" },
    { name: "Daily Cost Exceeded", metric: "system.token_cost_daily", condition: "gt", threshold: 100, severity: "WARN", status: "ACTIVE" },
  ] });
  console.log("  ✓ 4 metrics, 2 alerts");

  console.log("\n=== PHASE 7 COMPLETE ===");
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
