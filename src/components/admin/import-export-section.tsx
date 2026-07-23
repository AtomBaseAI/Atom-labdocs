"use client";

import { useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
  Download,
  Upload,
  FileJson,
  Database,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  BookOpen,
  FlaskConical,
  FileText,
  PackagePlus,
  FileArchive,
  TreePine,
} from "lucide-react";
import type { ExportFile, CourseExport, LabExport } from "@/lib/import-export";
import type { CourseGroup, Course, Lab, Module } from "@/lib/types";
import { cn } from "@/lib/utils";

// ===================== Helpers =====================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function triggerDownload(res: Response) {
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/i);
  const filename = m?.[1] || "export.json";
  res.blob().then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  });
}

// ===================== Main Section =====================

export function ImportExportSection() {
  const qc = useQueryClient();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // --- Export All ---
  const exportAll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/export/all");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (HTTP ${res.status})`);
      }
      return res;
    },
    onSuccess: async (res) => {
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || "atom-labdocs-export.json";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: `Downloaded ${filename}` });
    },
    onError: (e: Error) => {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Import / Export Content</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Export or import your lab documentation content. Use <span className="font-medium text-foreground">Export All</span> /{" "}
        <span className="font-medium text-foreground">Import All</span> for quick bulk operations, or use{" "}
        <span className="font-medium text-foreground">Export</span> /{" "}
        <span className="font-medium text-foreground">Import</span> to select specific course groups, courses, labs, or modules.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => exportAll.mutate()}
          disabled={exportAll.isPending}
        >
          {exportAll.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileArchive className="h-3.5 w-3.5" />
          )}
          Export All
        </Button>
        <Button
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => {
            setImportOpen(true);
          }}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <Button
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => {
            setImportOpen(true);
          }}
        >
          <PackagePlus className="h-3.5 w-3.5" />
          Import All
        </Button>
      </div>

      {/* Export Selected Dialog */}
      <ExportSelectDialog open={exportOpen} onOpenChange={setExportOpen} />

      {/* Import Selected Dialog */}
      <ImportSelectDialog open={importOpen} onOpenChange={setImportOpen} queryClient={qc} />
    </Card>
  );
}

// ===================== Export Select Dialog =====================

type ExportTreeNode = {
  id: string;
  type: "group" | "course" | "lab" | "module";
  label: string;
  icon?: string | null;
  hidden?: boolean;
  children: ExportTreeNode[];
};

interface ExportTreeData {
  groups: CourseGroup[];
  courses: (Course & {
    labs: (Lab & { modules: Pick<Module, "id" | "title" | "hidden" | "order">[] })[];
  })[];
}

function ExportSelectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const treeQuery = useQuery<ExportTreeData>({
    queryKey: ["export-tree"],
    queryFn: () => fetchJson<ExportTreeData>("/api/export/tree"),
    enabled: open,
  });

  const tree = useMemo<ExportTreeNode[]>(() => {
    if (!treeQuery.data) return [];
    const { groups, courses } = treeQuery.data;

    const grouped = new Map<string, ExportTreeNode[]>();
    const ungrouped: ExportTreeNode[] = [];

    for (const c of courses) {
      const courseNode: ExportTreeNode = {
        id: c.id,
        type: "course",
        label: c.title,
        icon: c.icon,
        hidden: c.hidden,
        children: c.labs.map((l) => ({
          id: l.id,
          type: "lab" as const,
          label: l.title,
          hidden: l.hidden,
          children: (l.modules ?? []).map((m) => ({
            id: m.id,
            type: "module" as const,
            label: m.title,
            hidden: m.hidden,
            children: [] as ExportTreeNode[],
          })),
        })),
      };
      if (c.groupId) {
        if (!grouped.has(c.groupId)) grouped.set(c.groupId, []);
        grouped.get(c.groupId)!.push(courseNode);
      } else {
        ungrouped.push(courseNode);
      }
    }

    const roots: ExportTreeNode[] = [];
    for (const g of groups) {
      roots.push({
        id: g.id,
        type: "group",
        label: g.name,
        icon: g.icon,
        children: grouped.get(g.id) || [],
      });
    }
    roots.push(...ungrouped);

    return roots;
  }, [treeQuery.data]);

  // Count leaf nodes
  const allLeafIds = useMemo(() => {
    const ids: string[] = [];
    function walk(nodes: ExportTreeNode[]) {
      for (const n of nodes) {
        if (n.children.length === 0) ids.push(n.id);
        else walk(n.children);
      }
    }
    walk(tree);
    return ids;
  }, [tree]);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    function walk(nodes: ExportTreeNode[]) {
      for (const n of nodes) {
        ids.push(n.id);
        walk(n.children);
      }
    }
    walk(tree);
    return ids;
  }, [tree]);

  const childMap = useMemo(() => {
    const map = new Map<string, string[]>();
    function walk(nodes: ExportTreeNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) {
          map.set(n.id, n.children.map((c) => c.id));
          walk(n.children);
        }
      }
    }
    walk(tree);
    return map;
  }, [tree]);

  const isAllChecked = allIds.length > 0 && allIds.every((id) => checked.has(id));
  const isSomeChecked = allIds.some((id) => checked.has(id));
  const isIndeterminate = isSomeChecked && !isAllChecked;

  function toggleNode(nodeId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      const childIds = childMap.get(nodeId);
      if (childIds) {
        // Parent node: check if currently all children are checked
        const allChildrenChecked = childIds.every((id) => next.has(id));
        if (allChildrenChecked) {
          // Uncheck all children
          next.delete(nodeId);
          for (const id of childIds) {
            uncheckWithDescendants(next, id, childMap);
          }
        } else {
          // Check all children
          next.add(nodeId);
          for (const id of childIds) {
            checkWithDescendants(next, id, childMap);
          }
        }
      } else {
        // Leaf node
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (isAllChecked || isIndeterminate) {
      setChecked(new Set());
    } else {
      setChecked(new Set(allIds));
    }
  }

  function toggleExpand(nodeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(allIds.filter((id) => childMap.has(id))));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  // Collect selected IDs per type
  const selection = useMemo(() => {
    const groupIds: string[] = [];
    const courseIds: string[] = [];
    const labIds: string[] = [];
    const moduleIds: string[] = [];

    function walk(nodes: ExportTreeNode[]) {
      for (const n of nodes) {
        if (!checked.has(n.id)) {
          // Still need to walk children for individually checked items
          if (n.children.length > 0) walk(n.children);
          continue;
        }
        switch (n.type) {
          case "group": groupIds.push(n.id); break;
          case "course": courseIds.push(n.id); break;
          case "lab": labIds.push(n.id); break;
          case "module": moduleIds.push(n.id); break;
        }
      }
    }
    walk(tree);
    return { courseGroupIds: groupIds, courseIds, labIds, moduleIds };
  }, [checked, tree]);

  // Export selected mutation
  const exportSelected = useMutation({
    mutationFn: async () => {
      if (selection.courseGroupIds.length === 0 && selection.courseIds.length === 0 && selection.labIds.length === 0 && selection.moduleIds.length === 0) {
        throw new Error("No items selected.");
      }
      const res = await fetch("/api/export/selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (HTTP ${res.status})`);
      }
      return res;
    },
    onSuccess: async (res) => {
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || "atom-labdocs-selected.json";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: `Downloaded ${filename}` });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    },
  });

  // Reset state on close
  function handleClose() {
    setChecked(new Set());
    setExpanded(new Set());
    onOpenChange(false);
  }

  const selectedCount = checked.size;
  const totalCount = allIds.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TreePine className="h-4 w-4" />
            Export Selected Content
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllChecked ? true : isIndeterminate ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
            />
            <Label className="cursor-pointer text-xs" onClick={toggleSelectAll}>
              Select All
            </Label>
          </div>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
              Expand
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
              Collapse
            </Button>
          </div>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {selectedCount} / {totalCount} selected
            </Badge>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-hidden rounded-md border">
          {treeQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              No content found. Create some courses first.
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[45vh]">
              <div className="p-2">
                {tree.map((node) => (
                  <ExportTreeNodeItem
                    key={node.id}
                    node={node}
                    checked={checked}
                    expanded={expanded}
                    onToggle={toggleNode}
                    onExpand={toggleExpand}
                    depth={0}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={exportSelected.isPending}>
            Cancel
          </Button>
          <Button
            disabled={selectedCount === 0 || exportSelected.isPending}
            onClick={() => exportSelected.mutate()}
          >
            {exportSelected.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Selected ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Export Tree Node =====================

function ExportTreeNodeItem({
  node,
  checked,
  expanded,
  onToggle,
  onExpand,
  depth,
}: {
  node: ExportTreeNode;
  checked: Set<string>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isChecked = checked.has(node.id);

  // Compute indeterminate for parent nodes
  let isIndeterminate = false;
  if (hasChildren) {
    const childCheckedCount = node.children.filter((c) => checked.has(c.id)).length;
    isIndeterminate = childCheckedCount > 0 && childCheckedCount < node.children.length;
  }

  const checkState: boolean | "indeterminate" = isIndeterminate ? "indeterminate" : isChecked;

  const iconMap = {
    group: <FolderOpen className="h-3.5 w-3.5 shrink-0" />,
    course: <BookOpen className="h-3.5 w-3.5 shrink-0" />,
    lab: <FlaskConical className="h-3.5 w-3.5 shrink-0" />,
    module: <FileText className="h-3.5 w-3.5 shrink-0" />,
  };

  if (hasChildren) {
    return (
      <Collapsible open={isExpanded} onOpenChange={() => onExpand(node.id)}>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
            node.hidden && "opacity-50"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            onClick={() => onExpand(node.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <Checkbox
            checked={checkState}
            onCheckedChange={() => onToggle(node.id)}
            className="shrink-0"
          />
          {iconMap[node.type]}
          <span className="min-w-0 truncate font-medium">{node.icon ? `${node.icon} ` : ""}{node.label}</span>
          <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
            {node.children.length}
          </Badge>
        </div>
        <CollapsibleContent>
          {node.children.map((child) => (
            <ExportTreeNodeItem
              key={child.id}
              node={child}
              checked={checked}
              expanded={expanded}
              onToggle={onToggle}
              onExpand={onExpand}
              depth={depth + 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
        node.hidden && "opacity-50"
      )}
      style={{ paddingLeft: `${depth * 16 + 8 + 20}px` }}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={() => onToggle(node.id)}
        className="shrink-0"
      />
      {iconMap[node.type]}
      <span className="min-w-0 truncate text-muted-foreground">{node.label}</span>
    </div>
  );
}

// ===================== Import Select Dialog =====================

interface ImportSelectDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}

interface ImportTreeNode {
  key: string; // unique key for tracking
  type: "group" | "course" | "lab" | "module";
  label: string;
  hidden?: boolean;
  children: ImportTreeNode[];
}

function ImportSelectDialog({ open, onOpenChange, queryClient: qc }: ImportSelectDialogProps) {
  const [importMode, setImportMode] = useState<"selective" | "all">("selective");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedFile, setParsedFile] = useState<ExportFile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allKeys = useMemo(() => {
    if (!parsedFile) return [];
    const keys: string[] = [];
    walkImportKeys(parsedFile, keys);
    return keys;
  }, [parsedFile]);

  const isAllChecked = allKeys.length > 0 && allKeys.every((k) => checked.has(k));
  const isSomeChecked = allKeys.some((k) => checked.has(k));
  const isIndeterminate = isSomeChecked && !isAllChecked;

  function toggleSelectAll() {
    if (isAllChecked || isIndeterminate) setChecked(new Set());
    else setChecked(new Set(allKeys));
  }

  function toggleNode(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      // Find all descendants of this key
      const descendants = allKeys.filter((k) => k === key || k.startsWith(key + "/"));
      const allDescChecked = descendants.every((k) => next.has(k));
      if (allDescChecked) {
        descendants.forEach((k) => next.delete(k));
      } else {
        descendants.forEach((k) => next.add(k));
      }
      return next;
    });
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(allKeys.filter((k) => k.split("/").length <= 2)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  // File picking
  async function onFilePicked(file: File) {
    setFileName(file.name);
    setParseError(null);
    setParsedFile(null);
    setChecked(new Set());
    setExpanded(new Set());
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = parseExportFileClient(json);
      setParsedFile(parsed);
      // Auto-select all
      const keys: string[] = [];
      walkImportKeys(parsed, keys);
      setChecked(new Set(keys));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not parse file";
      setParseError(msg);
    }
  }

  // Filter export file based on selection
  function getFilteredFile(): ExportFile | null {
    if (!parsedFile) return null;
    if (importMode === "all") return parsedFile;

    const sel = checked;

    if (parsedFile.type === "full") {
      // Filter course groups
      const filteredGroups = parsedFile.courseGroups.filter((_, i) => sel.has(`group/${i}`));

      // Filter courses (with nested labs/modules)
      const filteredCourses: CourseExport[] = [];
      for (let i = 0; i < parsedFile.courses.length; i++) {
        const c = parsedFile.courses[i];
        const filteredLabs: LabExport[] = [];
        for (let li = 0; li < c.labs.length; li++) {
          const l = c.labs[li];
          if (!sel.has(`course/${i}`) && !sel.has(`course/${i}/lab/${li}`)) continue;
          filteredLabs.push({
            ...l,
            modules: l.modules.filter((_, mi) => sel.has(`course/${i}/lab/${li}/module/${mi}`)),
          });
        }
        if (filteredLabs.length > 0) {
          filteredCourses.push({ ...c, labs: filteredLabs });
        }
      }

      return {
        ...parsedFile,
        courseGroups: filteredGroups,
        courses: filteredCourses,
      } as ExportFile;
    }

    if (parsedFile.type === "course") {
      const c = parsedFile.course;
      const filteredLabs: LabExport[] = [];
      for (let li = 0; li < c.labs.length; li++) {
        const l = c.labs[li];
        if (!sel.has(`course/0/lab/${li}`)) continue;
        filteredLabs.push({
          ...l,
          modules: l.modules.filter((_, mi) => sel.has(`course/0/lab/${li}/module/${mi}`)),
        });
      }
      return {
        ...parsedFile,
        course: { ...c, labs: filteredLabs },
      } as ExportFile;
    }

    return parsedFile;
  }

  const importMut = useMutation({
    mutationFn: async () => {
      const file = importMode === "all" ? parsedFile : getFilteredFile();
      if (!file) throw new Error("No file parsed");
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file,
          options: { duplicateGroups },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Import failed (HTTP ${res.status})`);
      return data as {
        ok: boolean;
        created: {
          courseGroups: number;
          courses: number;
          labs: number;
          modules: number;
          steps: number;
        };
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["admin-course-groups"] });
      qc.invalidateQueries({ queryKey: ["admin-tree"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course-groups"] });
      const c = data.created;
      toast({
        title: "Import complete",
        description: `Created ${c.courses} course(s), ${c.labs} lab(s), ${c.modules} module(s), ${c.steps} step(s)${
          c.courseGroups ? `, ${c.courseGroups} group(s)` : ""
        }.`,
      });
      handleClose();
    },
    onError: (e: Error) => {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    },
  });

  function handleClose() {
    setParsedFile(null);
    setFileName(null);
    setParseError(null);
    setDuplicateGroups(false);
    setChecked(new Set());
    setExpanded(new Set());
    setImportMode("selective");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  }

  const selectedCount = importMode === "all" ? allKeys.length : checked.size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Content
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Mode selector */}
          <div className="flex gap-2 rounded-lg border p-1">
            <Button
              variant={importMode === "selective" ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setImportMode("selective")}
            >
              <TreePine className="mr-1.5 h-3.5 w-3.5" />
              Import Selected
            </Button>
            <Button
              variant={importMode === "all" ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setImportMode("all")}
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              Import All
            </Button>
          </div>

          {/* File picker */}
          <div>
            <Label>Export file</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFilePicked(f);
              }}
            />
          </div>

          {parseError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Could not read this file</p>
                <p className="mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {parsedFile && !parseError && importMode === "selective" && (
            <>
              {/* Select toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isAllChecked ? true : isIndeterminate ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label className="cursor-pointer text-xs" onClick={toggleSelectAll}>
                    Select All
                  </Label>
                </div>
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
                    Expand
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
                    Collapse
                  </Button>
                </div>
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount} / {allKeys.length}
                  </Badge>
                )}
              </div>

              {/* Tree */}
              <div className="overflow-hidden rounded-md border">
                <ScrollArea className="max-h-[35vh]">
                  <div className="p-2">
                    <ImportTreeView
                      file={parsedFile}
                      checked={checked}
                      expanded={expanded}
                      onToggle={toggleNode}
                      onExpand={toggleExpand}
                      depth={0}
                    />
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {parsedFile && !parseError && importMode === "all" && (
            <ImportPreview file={parsedFile} fileName={fileName} />
          )}

          {parsedFile && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Switch
                id="dup-groups"
                checked={duplicateGroups}
                onCheckedChange={setDuplicateGroups}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <Label htmlFor="dup-groups" className="text-xs font-medium">
                  Create fresh course groups
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Off (default): reuse existing groups that match by name.
                  On: always create new groups, even if a same-named one exists.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Import only <span className="font-medium">adds</span> content.
              It never edits or deletes existing courses, labs, modules, or
              steps — re-importing the same file creates duplicates.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importMut.isPending}>
            Cancel
          </Button>
          <Button
            disabled={(!parsedFile || (importMode === "selective" && selectedCount === 0)) || importMut.isPending}
            onClick={() => importMut.mutate()}
          >
            {importMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import{importMode === "all" ? " All" : ` (${selectedCount})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Import Tree View =====================

function ImportTreeView({
  file,
  checked,
  expanded,
  onToggle,
  onExpand,
  depth,
}: {
  file: ExportFile;
  checked: Set<string>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onExpand: (key: string) => void;
  depth: number;
}) {
  if (file.type === "full") {
    return (
      <>
        {file.courseGroups.map((g, gi) => (
          <ImportGroupNode
            key={`group/${gi}`}
            nodeKey={`group/${gi}`}
            label={g.name}
            icon={g.icon}
            depth={depth}
            isChecked={checked.has(`group/${gi}`)}
            isExpanded={expanded.has(`group/${gi}`)}
            onToggle={onToggle}
            onExpand={onExpand}
          >
            {/* Courses under this group */}
            {file.courses
              .filter((c) => c.groupName === g.name)
              .map((c, ci) => {
                // Find the real index of this course in the courses array
                const realIndex = file.courses.indexOf(c);
                return (
                  <ImportCourseNode
                    key={`course/${realIndex}`}
                    nodeKey={`course/${realIndex}`}
                    course={c}
                    depth={depth + 1}
                    isChecked={checked.has(`course/${realIndex}`)}
                    isExpanded={expanded.has(`course/${realIndex}`)}
                    onToggle={onToggle}
                    onExpand={onExpand}
                  />
                );
              })}
          </ImportGroupNode>
        ))}

        {/* Ungrouped courses */}
        {file.courses
          .filter((c) => !c.groupName)
          .map((c, ci) => {
            const realIndex = file.courses.indexOf(c);
            return (
              <ImportCourseNode
                key={`course/${realIndex}`}
                nodeKey={`course/${realIndex}`}
                course={c}
                depth={depth}
                isChecked={checked.has(`course/${realIndex}`)}
                isExpanded={expanded.has(`course/${realIndex}`)}
                onToggle={onToggle}
                onExpand={onExpand}
              />
            );
          })}
      </>
    );
  }

  // Single course export
  return (
    <ImportCourseNode
      nodeKey="course/0"
      course={file.course}
      depth={depth}
      isChecked={checked.has("course/0")}
      isExpanded={expanded.has("course/0")}
      onToggle={onToggle}
      onExpand={onExpand}
    />
  );
}

function ImportGroupNode({
  nodeKey,
  label,
  icon,
  depth,
  isChecked,
  isExpanded,
  onToggle,
  onExpand,
  children,
}: {
  nodeKey: string;
  label: string;
  icon?: string | null;
  depth: number;
  isChecked: boolean;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  onExpand: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onExpand(nodeKey)}>
      <div
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          onClick={() => onExpand(nodeKey)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Checkbox checked={isChecked} onCheckedChange={() => onToggle(nodeKey)} className="shrink-0" />
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate font-medium">{icon ? `${icon} ` : ""}{label}</span>
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ImportCourseNode({
  nodeKey,
  course,
  depth,
  isChecked,
  isExpanded,
  onToggle,
  onExpand,
}: {
  nodeKey: string;
  course: CourseExport;
  depth: number;
  isChecked: boolean;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  onExpand: (key: string) => void;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onExpand(nodeKey)}>
      <div
        className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50", course.hidden && "opacity-50")}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          onClick={() => onExpand(nodeKey)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Checkbox checked={isChecked} onCheckedChange={() => onToggle(nodeKey)} className="shrink-0" />
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate font-medium">{course.title}</span>
        <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
          {course.labs.length}
        </Badge>
      </div>
      <CollapsibleContent>
        {course.labs.map((lab, li) => (
          <ImportLabNode
            key={`${nodeKey}/lab/${li}`}
            nodeKey={`${nodeKey}/lab/${li}`}
            lab={lab}
            depth={depth + 1}
            isChecked={isChecked} // inherited
            onToggle={onToggle}
            onExpand={onExpand}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ImportLabNode({
  nodeKey,
  lab,
  depth,
  isChecked,
  onToggle,
  onExpand,
}: {
  nodeKey: string;
  lab: LabExport;
  depth: number;
  isChecked: boolean;
  onToggle: (key: string) => void;
  onExpand: (key: string) => void;
}) {
  const isExpanded = false; // leaf level, no expand needed

  return (
    <div
      className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50", lab.hidden && "opacity-50")}
      style={{ paddingLeft: `${depth * 16 + 8 + 20}px` }}
    >
      <Checkbox checked={isChecked} onCheckedChange={() => onToggle(nodeKey)} className="shrink-0" />
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate text-muted-foreground">{lab.title}</span>
      <Badge variant="outline" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
        {lab.modules.length} modules
      </Badge>
    </div>
  );
}

// ===================== Inline per-course Export button =====================

export function ExportCourseButton({
  courseId,
  labeled,
}: {
  courseId: string;
  labeled?: boolean;
}) {
  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/export/courses/${courseId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (HTTP ${res.status})`);
      }
      return res;
    },
    onSuccess: async (res) => {
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `course-${courseId}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Course exported", description: `Downloaded ${filename}` });
    },
    onError: (e: Error) => {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    },
  });

  if (labeled) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        title="Export this course as JSON"
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
      >
        {mut.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        Export
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title="Export this course as JSON"
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
    >
      {mut.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
    </Button>
  );
}

// ===================== Import preview card =====================

function ImportPreview({
  file,
  fileName,
}: {
  file: ExportFile;
  fileName: string | null;
}) {
  const counts =
    file.type === "full"
      ? {
          courses: file.courses.length,
          labs: file.courses.reduce((a, c) => a + c.labs.length, 0),
          modules: file.courses.reduce(
            (a, c) => a + c.labs.reduce((b, l) => b + l.modules.length, 0),
            0
          ),
          steps: file.courses.reduce(
            (a, c) =>
              a +
              c.labs.reduce(
                (b, l) =>
                  b + l.modules.reduce((d, m) => d + m.steps.length, 0),
                0
              ),
            0
          ),
          groups: file.courseGroups.length,
        }
      : {
          courses: 1,
          labs: file.course.labs.length,
          modules: file.course.labs.reduce((a, l) => a + l.modules.length, 0),
          steps: file.course.labs.reduce(
            (a, l) => a + l.modules.reduce((b, m) => b + m.steps.length, 0),
            0
          ),
          groups: file.group ? 1 : 0,
        };

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <FileJson className="h-4 w-4 text-primary" />
        <span className="truncate text-sm font-medium">
          {fileName || "Parsed file"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Valid
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <PreviewStat label="Type" value={file.type === "full" ? "Full dump" : "Single course"} />
        {file.type === "full" && <PreviewStat label="Groups" value={counts.groups} />}
        <PreviewStat label="Courses" value={counts.courses} />
        <PreviewStat label="Labs" value={counts.labs} />
        <PreviewStat label="Modules" value={counts.modules} />
        <PreviewStat label="Steps" value={counts.steps} />
      </div>
      <p className="text-xs text-muted-foreground">
        Exported {new Date(file.exportedAt).toLocaleString()}
      </p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ===================== Client-side export-file parser =====================

function parseExportFileClient(raw: unknown): ExportFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Export file must be a JSON object.");
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) {
    throw new Error(`Unsupported export version. Expected 1, got ${String(o.version)}.`);
  }
  if (o.source !== "atom-labdocs") {
    throw new Error(`Unrecognized export source "${String(o.source)}". Expected "atom-labdocs".`);
  }
  if (typeof o.exportedAt !== "string") {
    throw new Error("Export file is missing an exportedAt timestamp.");
  }
  const isStr = (v: unknown): v is string => typeof v === "string";
  const isStrOrNull = (v: unknown): v is string | null => typeof v === "string" || v === null;
  const isBool = (v: unknown): v is boolean => typeof v === "boolean";
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

  function parseStep(v: unknown, idx: number) {
    if (!v || typeof v !== "object") return null;
    const s = v as Record<string, unknown>;
    if (!isStr(s.title)) return null;
    return {
      title: s.title.trim(),
      description: isStrOrNull(s.description) ? s.description : null,
      code: isStrOrNull(s.code) ? s.code : null,
      codeLang: isStrOrNull(s.codeLang) ? s.codeLang : null,
      image: isStrOrNull(s.image) ? s.image : null,
      imageCaption: isStrOrNull(s.imageCaption) ? s.imageCaption : null,
      order: isNum(s.order) ? s.order : idx,
    };
  }
  function parseModule(v: unknown, idx: number) {
    if (!v || typeof v !== "object") return null;
    const m = v as Record<string, unknown>;
    if (!isStr(m.title)) return null;
    const stepsRaw = isArr(m.steps) ? m.steps : [];
    const steps = stepsRaw
      .map((x, i) => parseStep(x, i))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return {
      title: m.title.trim(),
      explanation: isStrOrNull(m.explanation) ? m.explanation : null,
      overview: isStrOrNull(m.overview) ? m.overview : null,
      flow: isStrOrNull(m.flow) ? m.flow : null,
      output: isStrOrNull(m.output) ? m.output : null,
      conclusion: isStrOrNull(m.conclusion) ? m.conclusion : null,
      order: isNum(m.order) ? m.order : idx,
      hidden: isBool(m.hidden) ? m.hidden : false,
      steps,
    };
  }
  function parseLab(v: unknown, idx: number) {
    if (!v || typeof v !== "object") return null;
    const l = v as Record<string, unknown>;
    if (!isStr(l.title)) return null;
    const modsRaw = isArr(l.modules) ? l.modules : [];
    const modules = modsRaw
      .map((x, i) => parseModule(x, i))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return {
      title: l.title.trim(),
      description: isStrOrNull(l.description) ? l.description : null,
      order: isNum(l.order) ? l.order : idx,
      hidden: isBool(l.hidden) ? l.hidden : false,
      linkType: isStr(l.linkType) ? l.linkType : "none",
      linkUrl: isStrOrNull(l.linkUrl) ? l.linkUrl : null,
      modules,
    };
  }
  function parseCourse(v: unknown, idx: number) {
    if (!v || typeof v !== "object") return null;
    const c = v as Record<string, unknown>;
    if (!isStr(c.title)) return null;
    const labsRaw = isArr(c.labs) ? c.labs : [];
    const labs = labsRaw
      .map((x, i) => parseLab(x, i))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const gn = isStrOrNull(c.groupName)
      ? c.groupName
        ? c.groupName.trim() || null
        : null
      : null;
    return {
      title: c.title.trim(),
      description: isStrOrNull(c.description) ? c.description : null,
      icon: isStrOrNull(c.icon) ? c.icon : null,
      color: isStrOrNull(c.color) ? c.color : null,
      order: isNum(c.order) ? c.order : idx,
      hidden: isBool(c.hidden) ? c.hidden : false,
      groupName: gn,
      labs,
    };
  }
  function parseGroup(v: unknown, idx: number) {
    if (!v || typeof v !== "object") return null;
    const g = v as Record<string, unknown>;
    if (!isStr(g.name)) return null;
    return {
      name: g.name.trim(),
      description: isStrOrNull(g.description) ? g.description : null,
      icon: isStrOrNull(g.icon) ? g.icon : null,
      color: isStrOrNull(g.color) ? g.color : null,
      order: isNum(g.order) ? g.order : idx,
    };
  }

  if (o.type === "full") {
    const groupsRaw = isArr(o.courseGroups) ? o.courseGroups : [];
    const courseGroups = groupsRaw
      .map((x, i) => parseGroup(x, i))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const coursesRaw = isArr(o.courses) ? o.courses : [];
    const courses = coursesRaw
      .map((x, i) => parseCourse(x, i))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return {
      version: 1 as const,
      source: "atom-labdocs" as const,
      exportedAt: o.exportedAt,
      type: "full" as const,
      courseGroups,
      courses,
    };
  }
  if (o.type === "course") {
    const course = parseCourse(o.course, 0);
    if (!course) throw new Error("Export file is missing a valid course object.");
    const group = o.group === null || o.group === undefined ? null : parseGroup(o.group, 0);
    return {
      version: 1 as const,
      source: "atom-labdocs" as const,
      exportedAt: o.exportedAt,
      type: "course" as const,
      course,
      group,
    };
  }
  throw new Error(`Unknown export type "${String(o.type)}". Expected "full" or "course".`);
}

// ===================== Helpers =====================

function walkImportKeys(file: ExportFile, keys: string[]) {
  if (file.type === "full") {
    for (let gi = 0; gi < file.courseGroups.length; gi++) {
      keys.push(`group/${gi}`);
    }
    for (let ci = 0; ci < file.courses.length; ci++) {
      keys.push(`course/${ci}`);
      for (let li = 0; li < file.courses[ci].labs.length; li++) {
        keys.push(`course/${ci}/lab/${li}`);
        for (let mi = 0; mi < file.courses[ci].labs[li].modules.length; mi++) {
          keys.push(`course/${ci}/lab/${li}/module/${mi}`);
        }
      }
    }
  } else {
    keys.push(`course/0`);
    for (let li = 0; li < file.course.labs.length; li++) {
      keys.push(`course/0/lab/${li}`);
      for (let mi = 0; mi < file.course.labs[li].modules.length; mi++) {
        keys.push(`course/0/lab/${li}/module/${mi}`);
      }
    }
  }
}

function checkWithDescendants(set: Set<string>, nodeId: string, childMap: Map<string, string[]>) {
  set.add(nodeId);
  const children = childMap.get(nodeId);
  if (children) {
    for (const c of children) checkWithDescendants(set, c, childMap);
  }
}

function uncheckWithDescendants(set: Set<string>, nodeId: string, childMap: Map<string, string[]>) {
  set.delete(nodeId);
  const children = childMap.get(nodeId);
  if (children) {
    for (const c of children) uncheckWithDescendants(set, c, childMap);
  }
}
