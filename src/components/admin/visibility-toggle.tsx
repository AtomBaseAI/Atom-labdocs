"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Kind = "course" | "lab" | "module";

const QUERY_KEYS: Record<Kind, string[]> = {
  course: ["admin-courses", "admin-course-nested", "courses", "course"],
  lab: ["admin-course-nested", "admin-lab-nested", "course", "lab"],
  module: ["admin-lab-nested", "lab", "module"],
};

export function VisibilityToggle({
  kind,
  id,
  hidden,
  size = "icon",
  className,
}: {
  kind: Kind;
  id: string;
  hidden: boolean;
  size?: "icon" | "sm";
  className?: string;
}) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () =>
      fetch(`/api/${kind}s/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !hidden }),
      }),
    onSuccess: () => {
      QUERY_KEYS[kind].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast({
        title: hidden ? "Unlocked — shown in public view" : "Locked — hidden from public view",
      });
    },
    onError: () => {
      toast({ title: "Failed to update visibility", variant: "destructive" });
    },
  });

  return (
    <Button
      variant="ghost"
      size={size === "icon" ? "icon" : "sm"}
      className={cn(
        size === "icon" ? "h-8 w-8" : "gap-1.5",
        hidden
          ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate();
      }}
      disabled={toggle.isPending}
      title={hidden ? "Locked (hidden from public) — click to unlock" : "Unlocked (visible in public) — click to lock"}
    >
      {hidden ? <Lock className={size === "icon" ? "h-4 w-4" : "h-3.5 w-3.5"} /> : <LockOpen className={size === "icon" ? "h-4 w-4" : "h-3.5 w-3.5"} />}
      {size === "sm" && (hidden ? "Locked" : "Unlocked")}
    </Button>
  );
}
