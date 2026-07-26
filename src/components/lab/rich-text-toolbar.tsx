"use client";

import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Palette,
  Highlighter,
  Table2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  TableProperties,
} from "lucide-react";
import { ColorPickerGrid, TEXT_COLORS, HIGHLIGHT_COLORS } from "@/components/lab/color-picker-grid";
import { TableCreateDialog } from "@/components/lab/table-create-dialog";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

// Toolbar button component — defined outside render to satisfy react-hooks/static-components
function ToolbarBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-muted")}
      title={title}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}

type Props = {
  editor: Editor;
  onTableClick: () => void;
};

export function RichTextToolbar({ editor, onTableClick }: Props) {
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [cellBgOpen, setCellBgOpen] = useState(false);

  const isInTable = editor.isActive("tableCell") || editor.isActive("tableHeader");

  const handleTableInsert = useCallback(
    (rows: number, cols: number) => {
      editor
        .chain()
        .focus()
        .insertTable({ rows, cols, withHeaderRow: true })
        .run();
    },
    [editor]
  );

  const currentTextColor =
    editor.getAttributes("textStyle").color || null;
  const currentHighlight =
    editor.getAttributes("highlight").color || null;

  // Get cell/header background color if inside a table
  const getCellBgColor = useCallback(() => {
    if (editor.isActive("tableCell")) {
      return editor.getAttributes("tableCell").backgroundColor || null;
    }
    if (editor.isActive("tableHeader")) {
      return editor.getAttributes("tableHeader").backgroundColor || null;
    }
    return null;
  }, [editor]);

  const cellBgColor = getCellBgColor();

  const setCellBgColor = useCallback(
    (color: string) => {
      // Determine which node type we're in and set backgroundColor accordingly
      if (editor.isActive("tableHeader")) {
        editor.chain().focus().updateAttributes("tableHeader", { backgroundColor: color }).run();
      } else if (editor.isActive("tableCell")) {
        editor.chain().focus().updateAttributes("tableCell", { backgroundColor: color }).run();
      }
      setCellBgOpen(false);
    },
    [editor]
  );

  const removeCellBgColor = useCallback(() => {
    if (editor.isActive("tableHeader")) {
      editor.chain().focus().updateAttributes("tableHeader", { backgroundColor: null }).run();
    } else if (editor.isActive("tableCell")) {
      editor.chain().focus().updateAttributes("tableCell", { backgroundColor: null }).run();
    }
    setCellBgOpen(false);
  }, [editor]);

  const setTextColor = useCallback(
    (color: string) => {
      editor.chain().focus().setColor(color).run();
      setTextColorOpen(false);
    },
    [editor]
  );

  const removeTextColor = useCallback(() => {
    editor.chain().focus().unsetColor().run();
    setTextColorOpen(false);
  }, [editor]);

  const setHighlightColor = useCallback(
    (color: string) => {
      editor.chain().focus().setHighlight({ color }).run();
      setHighlightOpen(false);
    },
    [editor]
  );

  const removeHighlight = useCallback(() => {
    editor.chain().focus().unsetHighlight().run();
    setHighlightOpen(false);
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt("Enter URL");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const removeLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
      {/* Undo / Redo */}
      <ToolbarBtn
        icon={<Undo2 className="h-4 w-4" />}
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarBtn
        icon={<Redo2 className="h-4 w-4" />}
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
      />

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Text formatting */}
      <ToolbarBtn
        icon={<Bold className="h-4 w-4" />}
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarBtn
        icon={<Italic className="h-4 w-4" />}
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarBtn
        icon={<Underline className="h-4 w-4" />}
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Headings */}
      <ToolbarBtn
        icon={<Heading2 className="h-4 w-4" />}
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarBtn
        icon={<Heading3 className="h-4 w-4" />}
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Lists */}
      <ToolbarBtn
        icon={<List className="h-4 w-4" />}
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarBtn
        icon={<ListOrdered className="h-4 w-4" />}
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      {/* Quote */}
      <ToolbarBtn
        icon={<Quote className="h-4 w-4" />}
        title="Block quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      {/* Inline code */}
      <ToolbarBtn
        icon={<Code2 className="h-4 w-4" />}
        title="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Text color picker */}
      <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Text color"
          >
            <Palette className="h-4 w-4" />
            {currentTextColor && (
              <span
                className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-3 rounded-full"
                style={{ backgroundColor: currentTextColor }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <ColorPickerGrid
            colors={TEXT_COLORS}
            selected={currentTextColor}
            onSelect={setTextColor}
            onReset={removeTextColor}
          />
        </PopoverContent>
      </Popover>

      {/* Highlight color picker */}
      <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Highlight color"
          >
            <Highlighter className="h-4 w-4" />
            {currentHighlight && (
              <span
                className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-3 rounded-full"
                style={{ backgroundColor: currentHighlight }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <ColorPickerGrid
            colors={HIGHLIGHT_COLORS}
            selected={currentHighlight}
            onSelect={setHighlightColor}
            onReset={removeHighlight}
          />
        </PopoverContent>
      </Popover>

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Link */}
      {editor.isActive("link") ? (
        <ToolbarBtn
          icon={<Link2 className="h-4 w-4 text-primary" />}
          title="Remove link"
          onClick={removeLink}
        />
      ) : (
        <ToolbarBtn
          icon={<Link2 className="h-4 w-4" />}
          title="Add link"
          onClick={addLink}
        />
      )}

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Table */}
      <ToolbarBtn
        icon={<Table2 className="h-4 w-4" />}
        title="Insert table"
        onClick={() => setTableDialogOpen(true)}
      />

      {/* Table cell operations (only shown when inside a table) */}
      {isInTable && (
        <>
          <div className="h-6 w-px bg-border mx-0.5" />

          {/* Cell background color */}
          <Popover open={cellBgOpen} onOpenChange={setCellBgOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Cell background color"
              >
                <TableProperties className="h-4 w-4" />
                {cellBgColor && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-3 rounded-full"
                    style={{ backgroundColor: cellBgColor }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <ColorPickerGrid
                colors={HIGHLIGHT_COLORS}
                selected={cellBgColor}
                onSelect={setCellBgColor}
                onReset={removeCellBgColor}
              />
            </PopoverContent>
          </Popover>

          {/* Toggle header row */}
          <ToolbarBtn
            icon={<Heading3 className="h-4 w-4" />}
            title="Toggle header row"
            active={editor.isActive("tableHeader")}
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          />

          {/* Add row before */}
          <ToolbarBtn
            icon={<ArrowUp className="h-4 w-4" />}
            title="Add row above"
            onClick={() => editor.chain().focus().addRowBefore().run()}
          />
          {/* Add row after */}
          <ToolbarBtn
            icon={<ArrowDown className="h-4 w-4" />}
            title="Add row below"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          />
          {/* Add column before */}
          <ToolbarBtn
            icon={<ArrowLeft className="h-4 w-4" />}
            title="Add column before"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          />
          {/* Add column after */}
          <ToolbarBtn
            icon={<ArrowRight className="h-4 w-4" />}
            title="Add column after"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          />

          {/* Delete row */}
          <ToolbarBtn
            icon={<Trash2 className="h-3.5 w-3.5" />}
            title="Delete row"
            onClick={() => editor.chain().focus().deleteRow().run()}
          />
          {/* Delete column */}
          <ToolbarBtn
            icon={<Trash2 className="h-3.5 w-3.5 text-destructive" />}
            title="Delete column"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          />
          {/* Delete table */}
          <ToolbarBtn
            icon={<Trash2 className="h-3.5 w-3.5 text-destructive" />}
            title="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        </>
      )}

      {/* Table creation dialog */}
      <TableCreateDialog
        open={tableDialogOpen}
        onOpenChange={setTableDialogOpen}
        onInsert={handleTableInsert}
      />
    </div>
  );
}
