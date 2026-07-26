"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TableCellWithColor } from "@/components/lab/tiptap-extensions";
import { TableHeaderWithColor } from "@/components/lab/tiptap-extensions";
import { RichTextToolbar } from "@/components/lab/rich-text-toolbar";
import { cn } from "@/lib/utils";

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
  const lastHtml = useRef(value);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up-to-date without accessing during render
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCellWithColor,
      TableHeaderWithColor,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    editorProps: {
      attributes: {
        class: "rich-editor tiptap px-4 py-3 outline-none text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastHtml.current = html;
      onChangeRef.current(html);
    },
    immediatelyRender: false,
  });

  // Sync external value changes into the editor content
  useEffect(() => {
    if (editor && value !== lastHtml.current) {
      const currentHtml = editor.getHTML();
      // Only update if the external value is truly different from current editor content
      if (value !== currentHtml) {
        lastHtml.current = value;
        editor.commands.setContent(value || "", {});
      }
    }
  }, [value, editor]);

  // Initialize editor content on mount
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentContent = editor.getHTML();
      if (value && value !== currentContent) {
        lastHtml.current = value;
        editor.commands.setContent(value || "", {});
      }
    }
  }, [editor]);

  if (!editor) {
    // Show a loading skeleton while editor initializes
    return (
      <div
        className={cn("rounded-lg border border-input bg-background overflow-hidden", className)}
      >
        <div className="border-b bg-muted/40 p-1.5 h-9" />
        <div className="px-4 py-3" style={{ minHeight }}>
          <p className="text-sm text-muted-foreground">{placeholder}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-input bg-background overflow-hidden", className)}>
      <RichTextToolbar
        editor={editor}
        onTableClick={() => {}}
      />
      <EditorContent
        editor={editor}
        style={{ minHeight }}
      />
    </div>
  );
}
