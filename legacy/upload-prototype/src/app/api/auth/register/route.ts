import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, name, password } = body as { email?: string; name?: string; password?: string };
  if (!email || !password || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password too short" }, { status: 400 });
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await db.user.create({ data: { email, name, password: hashedPassword, role: "STAFF" }, select: { id: true, email: true, name: true, role: true } });
  sendWelcomeEmail(email, name).catch(() => {});
  return NextResponse.json({ user, message: "Account created" }, { status: 201 });
}
