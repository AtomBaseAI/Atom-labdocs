"use client";

import type { FlowNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { nanoid } from "@/lib/nanoid";

type Props = {
  value: FlowNode[];
  onChange: (nodes: FlowNode[]) => void;
};

const TYPES: { value: FlowNode["type"]; label: string }[] = [
  { value: "start", label: "Start" },
  { value: "process", label: "Process" },
  { value: "decision", label: "Decision" },
  { value: "io", label: "Input/Output" },
  { value: "end", label: "End" },
];

export function FlowEditor({ value, onChange }: Props) {
  const add = () => {
    onChange([
      ...value,
      { id: nanoid(), label: "New step", type: "process" },
    ]);
  };

  const update = (id: string, patch: Partial<FlowNode>) => {
    onChange(value.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const remove = (id: string) => onChange(value.filter((n) => n.id !== id));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.map((node, idx) => (
        <div
          key={node.id}
          className="flex items-center gap-2 rounded-lg border bg-card p-2"
        >
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select
            value={node.type}
            onValueChange={(v) => update(node.id, { type: v as FlowNode["type"] })}
          >
            <SelectTrigger className="h-9 w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={node.label}
            onChange={(e) => update(node.id, { label: e.target.value })}
            className="h-9 flex-1"
            placeholder="Step label"
          />
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={idx === value.length - 1}
              onClick={() => move(idx, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => remove(node.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-4 w-4" /> Add flow node
      </Button>
    </div>
  );
}
