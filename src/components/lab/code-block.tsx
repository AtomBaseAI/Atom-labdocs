"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  code: string;
  language?: string;
  className?: string;
  showHeader?: boolean;
};

const LANG_LABELS: Record<string, string> = {
  cpp: "C++",
  c: "C",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  python: "Python",
  py: "Python",
  java: "Java",
  bash: "Bash",
  shell: "Shell",
  sql: "SQL",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  go: "Go",
  rust: "Rust",
  text: "Text",
};

export function CodeBlock({ code, language = "text", className, showHeader = true }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const lang = (language || "text").toLowerCase();
  const label = LANG_LABELS[lang] ?? language ?? "Code";

  return (
    <div className={cn("group relative rounded-xl overflow-hidden border border-border bg-[#282c34]", className)}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
            <span className="h-3 w-3 rounded-full bg-green-400/80" />
            <span className="ml-2 text-xs font-medium text-zinc-300">{label}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "1rem 1.25rem",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
