"use client";
import * as React from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { LoginDialog } from "./LoginDialog";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  if (status === "loading") return <div className="grid min-h-[60vh] place-items-center"><Card className="p-8 text-center text-sm text-muted-foreground">Checking session…</Card></div>;
  if (status !== "authenticated") return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="max-w-md p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold">Authentication required</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to access this area.</p>
        <LoginDialog open={true} onOpenChange={() => {}} />
      </Card>
    </div>
  );
  return <>{children}</>;
}
