"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Lock, LockOpen, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Kind = "course" | "lab" | "module";

const QUERY_KEYS: Record<Kind, string[]> = {
  course: ["admin-courses", "admin-course-nested", "courses", "course"],
  lab: ["admin-course-nested", "admin-lab-nested", "course", "lab"],
  module: ["admin-lab-nested", "lab", "module"],
};

function useToggleMutation(kind: Kind, id: string, field: "hidden" | "locked", currentValue: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetch(`/api/${kind}s/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !currentValue }),
      }),
    onSuccess: () => {
      QUERY_KEYS[kind].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (field === "hidden") {
        toast({
          title: currentValue
            ? "Shown in public view"
            : "Hidden from public view",
        });
      } else {
        toast({
          title: currentValue
            ? "Unlocked — can be opened in public"
            : "Locked — visible in public but can't be opened",
        });
      }
    },
    onError: () => {
      toast({
        title: `Failed to update ${field === "hidden" ? "visibility" : "lock"}`,
        variant: "destructive",
      });
    },
  });
}

/**
 * Eye toggle — controls the `hidden` field.
 * When hidden=true the item is completely removed from the public view.
 * Eye = visible in public, EyeOff = hidden from public.
 */
export function EyeToggle({
  kind,
  id,
  hidden,
  className,
}: {
  kind: Kind;
  id: string;
  hidden: boolean;
  className?: string;
}) {
  const toggle = useToggleMutation(kind, id, "hidden", hidden);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8",
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
      title={
        hidden
          ? "Hidden from public — click to show"
          : "Visible in public — click to hide"
      }
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}

/**
 * Lock toggle — controls the `locked` field.
 * When locked=true the item appears in the public view but users cannot
 * navigate into it (the card shows "course/lab/slides locked" with a lock
 * icon instead of the normal open action).
 * LockOpen = unlocked (accessible), Lock = locked (can't go through).
 */
export function LockToggle({
  kind,
  id,
  locked,
  className,
}: {
  kind: Kind;
  id: string;
  locked: boolean;
  className?: string;
}) {
  const toggle = useToggleMutation(kind, id, "locked", locked);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8",
        locked
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
      title={
        locked
          ? "Locked — visible but can't be opened in public. Click to unlock."
          : "Unlocked — can be opened in public. Click to lock."
      }
    >
      {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
    </Button>
  );
}
