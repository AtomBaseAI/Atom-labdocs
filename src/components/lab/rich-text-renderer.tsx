"use client";

import { cn } from "@/lib/utils";

type Props = {
  html: string | null | undefined;
  className?: string;
};

export function RichTextRenderer({ html, className }: Props) {
  if (!html || !html.trim()) {
    return <p className="text-muted-foreground italic">No content yet.</p>;
  }
  return (
    <div
      className={cn("rich-content", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
