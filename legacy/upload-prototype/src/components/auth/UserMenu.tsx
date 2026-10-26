"use client";
import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = React.useState(false);
  if (status !== "authenticated" || !session?.user) return null;
  const initials = (session.user.name || session.user.email || "?").charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-muted/50">
        <div className="grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{initials}</div>
        <span className="hidden sm:block">{session.user.name || session.user.email}</span>
        <span className="hidden rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary md:block">{session.user.role}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border/60 bg-card p-2 shadow-lg">
          <div className="border-b pb-2">
            <div className="text-xs font-medium">{session.user.name}</div>
            <div className="text-[10px] text-muted-foreground">{session.user.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-2" onClick={() => signOut()}>
            <LogOut className="h-3 w-3" /> Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
