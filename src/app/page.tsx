"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { PublicView } from "@/components/public/public-view";
import { AdminView } from "@/components/admin/admin-view";
import { AdminLoginDialog } from "@/components/admin/admin-login-dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FlaskRound,
  LayoutDashboard,
  Database,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Home() {
  const { mode, setMode } = useAppStore();
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState(false);

  const isAdmin = !!session?.user;

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetch("/api/courses").then((r) => r.json()),
  });

  const seed = useMutation({
    mutationFn: () => fetch("/api/seed", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      toast({ title: "Sample data loaded", description: "A demo course, lab and module were created." });
    },
    onError: () => {
      toast({ title: "Failed to load sample data", description: "Make sure you are logged in as admin.", variant: "destructive" });
    },
    onSettled: () => setSeeding(false),
  });

  const isEmpty = !coursesQuery.isLoading && (coursesQuery.data?.length ?? 0) === 0;

  const handleAdminClick = () => {
    if (isAdmin) {
      setMode("admin");
    } else {
      setPendingAdmin(true);
      setLoginOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    if (pendingAdmin) {
      setMode("admin");
      setPendingAdmin(false);
      toast({ title: "Welcome, Admin!", description: "You now have access to the admin panel." });
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    setMode("public");
    toast({ title: "Signed out", description: "You have been logged out of admin." });
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 w-full items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FlaskRound className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight">LabDoc</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Interactive lab procedure documentation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === "admin" && isAdmin && isEmpty && (
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-1.5 sm:flex"
                disabled={seeding}
                onClick={() => {
                  setSeeding(true);
                  seed.mutate();
                }}
              >
                <Database className="h-4 w-4" />
                {seeding ? "Loading..." : "Load sample data"}
              </Button>
            )}

            {mode === "admin" && isAdmin && (
              <div className="hidden items-center gap-1.5 rounded-lg border bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 sm:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                {session.user?.email ?? "Admin"}
              </div>
            )}

            {mode === "admin" && isAdmin && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}

            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              <ModeButton
                active={mode === "public"}
                onClick={() => setMode("public")}
                icon={LayoutDashboard}
                label="Public"
              />
              <ModeButton
                active={mode === "admin"}
                onClick={handleAdminClick}
                icon={Sparkles}
                label="Admin"
                protected_
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        className={cn(
          "w-full flex-1 px-4 py-6 md:py-8 md:px-6",
          // Public + logged-in admin use the full viewport width; only the
          // admin-locked (sign-in) screen stays centered for readability.
          mode === "admin" && !isAdmin ? "mx-auto max-w-6xl" : ""
        )}
      >
        {mode === "public" ? (
          <PublicView />
        ) : isAdmin ? (
          <AdminView />
        ) : (
          <AdminLocked onLogin={() => { setPendingAdmin(true); setLoginOpen(true); }} loading={status === "loading"} />
        )}
      </main>

      <AdminLoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  protected_,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutDashboard;
  label: string;
  protected_?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {protected_ && <ShieldCheck className="h-3 w-3 opacity-60" />}
    </button>
  );
}

function AdminLocked({ onLogin, loading }: { onLogin: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
      {loading ? (
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Admin access required</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            The admin panel is protected. Please sign in with admin credentials to manage courses, labs, and modules.
          </p>
          <Button className="mt-5 gap-1.5" onClick={onLogin}>
            <ShieldCheck className="h-4 w-4" /> Sign in as admin
          </Button>
        </>
      )}
    </div>
  );
}
