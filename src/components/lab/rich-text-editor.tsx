"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Code2,
  Heading2,
  Heading3,
  Link2,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tool =
  | { kind: "cmd"; icon: LucideIcon; title: string; command: string; arg?: string }
  | { kind: "link"; icon: LucideIcon; title: string };

const TOOLS: Tool[] = [
  { kind: "cmd", icon: Bold, title: "Bold", command: "bold" },
  { kind: "cmd", icon: Italic, title: "Italic", command: "italic" },
  { kind: "cmd", icon: Underline, title: "Underline", command: "underline" },
  { kind: "cmd", icon: Heading2, title: "Heading", command: "formatBlock", arg: "<h2>" },
  { kind: "cmd", icon: Heading3, title: "Subheading", command: "formatBlock", arg: "<h3>" },
  { kind: "cmd", icon: List, title: "Bullet list", command: "insertUnorderedList" },
  { kind: "cmd", icon: ListOrdered, title: "Numbered list", command: "insertOrderedList" },
  { kind: "cmd", icon: Quote, title: "Quote", command: "formatBlock", arg: "<blockquote>" },
  { kind: "cmd", icon: Code2, title: "Inline code", command: "insertHTML", arg: "<code>&nbsp;</code>" },
  { kind: "link", icon: Link2, title: "Link" },
  { kind: "cmd", icon: Undo2, title: "Undo", command: "undo" },
  { kind: "cmd", icon: Redo2, title: "Redo", command: "redo" },
];

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  minHeight = 160,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  // Sync external value into the editor when it changes externally
  useEffect(() => {
    if (ref.current && value !== lastValue.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value || "";
      lastValue.current = value;
    }
  }, [value]);

  // Initialize on mount
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
      lastValue.current = value;
    }
  }, []);

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    if (ref.current) {
      lastValue.current = ref.current.innerHTML;
      onChange(ref.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      lastValue.current = ref.current.innerHTML;
      onChange(ref.current.innerHTML);
    }
  }, [onChange]);

  const addLink = useCallback(() => {
    const url = window.prompt("Enter URL");
    if (url) exec("createLink", url);
  }, [exec]);

  const runTool = (tool: (typeof TOOLS)[number]) => {
    if (tool.kind === "link") {
      addLink();
    } else {
      exec(tool.command, tool.arg);
    }
  };

  return (
    <div className={cn("rounded-lg border border-input bg-background overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
        {TOOLS.map((t, i) => (
          <Button
            key={i}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t.title}
            onMouseDown={(e) => {
              e.preventDefault();
              runTool(t);
            }}
          >
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className="rich-editor px-4 py-3 outline-none text-sm leading-relaxed"
        style={{ minHeight }}
      />
    </div>
  );
}
