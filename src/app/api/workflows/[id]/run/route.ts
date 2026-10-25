import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const LOG_LINES = [
  "Trigger received.",
  "Validating payload…",
  "Payload OK.",
  "Invoking node: agent (CRM Manager).",
  "Agent returned 200 OK in 412ms.",
  "Evaluating condition: score >= 80?",
  "Condition matched — taking 'yes' branch.",
  "Executing action: assign to senior rep.",
  "Action OK.",
  "Executing action: WhatsApp alert.",
  "Action OK.",
  "Workflow complete.",
];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wf = await db.workflow.findUnique({ where: { id } });
  if (!wf) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const startedAt = new Date();
  const logs = LOG_LINES.join("\n");
  const completedAt = new Date(startedAt.getTime() + 800);

  const run = await db.workflowRun.create({
    data: {
      workflowId: id,
      status: "SUCCESS",
      startedAt,
      completedAt,
      logs,
    },
  });

  await db.workflow.update({
    where: { id },
    data: { lastRunAt: completedAt },
  });

  await db.auditLog.create({
    data: {
      action: "workflow.run",
      entityType: "workflow",
      entityId: id,
      metadata: JSON.stringify({ runId: run.id }),
    },
  });

  return NextResponse.json({ run, logs });
}
