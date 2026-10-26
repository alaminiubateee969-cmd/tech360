import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token";
const PROTECTED = ["/api/crm","/api/dashboard","/api/conversations","/api/workflows","/api/agents","/api/settings","/api/webhooks","/api/files","/api/social","/api/analytics","/api/clients","/api/invoices","/api/tasks","/api/meetings","/api/evidence","/api/reviews","/api/super-admin","/api/ai-workforce/approvals","/api/ai-workforce/agents/","/api/ai-workforce/incidents","/api/ai-workforce/evaluations","/api/ai-workforce/executions","/api/ai-workforce/feedback","/api/ai-workforce/memory"];
const PUBLIC = ["/api/auth","/api/leads","/api/route","/api/ai-workforce/stats","/api/ai-workforce/departments","/api/ai-workforce/agents","/api/ai-workforce/skills","/api/ai-workforce/sops","/api/ai-workforce/models","/api/ai-workforce/tools","/api/ai-workforce/prompts","/api/ai-workforce/executions","/api/ai-workforce/rag","/api/blog","/api/legal","/api/reviews/public"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) return NextResponse.next();
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (!PROTECTED.some(p => pathname.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value || req.cookies.get("next-auth.session-token")?.value || req.cookies.get("__Secure-next-auth.session-token")?.value;
  if (!token) return NextResponse.json({ error: "Authentication required", code: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
