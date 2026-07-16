"use client";

import type { FlowNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown, CircleDot, Diamond, Square, Play, SquareDot, Flag } from "lucide-react";

type Props = {
  flow: FlowNode[] | null;
  className?: string;
};

const NODE_STYLES: Record<
  FlowNode["type"],
  { wrap: string; icon: typeof Play; label: string }
> = {
  start: { wrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: Play, label: "Start" },
  process: { wrap: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30", icon: SquareDot, label: "Process" },
  decision: { wrap: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: Diamond, label: "Decision" },
  io: { wrap: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30", icon: CircleDot, label: "I/O" },
  end: { wrap: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30", icon: Flag, label: "End" },
};

export function FlowDiagram({ flow, className }: Props) {
  if (!flow || flow.length === 0) {
    return <p className="text-muted-foreground italic">No flow defined.</p>;
  }

  return (
    <div className={cn("flex flex-col items-stretch gap-0", className)}>
      {flow.map((node, idx) => {
        const style = NODE_STYLES[node.type] ?? NODE_STYLES.process;
        const Icon = style.icon;
        return (
          <div key={node.id} className="flex flex-col items-center">
            <div
              className={cn(
                "relative flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-sm",
                style.wrap
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{node.label}</p>
                <p className="text-[10px] uppercase tracking-wide opacity-70">{style.label}</p>
              </div>
              <span className="text-xs font-mono opacity-50">{idx + 1}</span>
            </div>
            {idx < flow.length - 1 && (
              <div className="flex h-7 items-center text-muted-foreground">
                <ChevronDown className="h-5 w-5" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
