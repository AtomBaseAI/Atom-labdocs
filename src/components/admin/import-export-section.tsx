"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import type { ExportFile } from "@/lib/import-export";

// ============ Import / Export section ============
//
// Lives in the admin OverviewPanel. Provides:
//   - "Export All" — downloads the entire content tree as a single JSON dump
//     (calls GET /api/export/all).
//   - "Import" — opens a dialog where the user picks a JSON file, we parse +
//     preview it client-side (counts + type), then POST it to /api/import.
//
// The per-course "Export" button lives inline next to each course in the
// All Courses list (see admin-view.tsx) and calls /api/export/courses/[id].

export function ImportExportSection() {
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [parsedFile, setParsedFile] = useState<ExportFile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Export all ---
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
      // Pull the JSON as text and trigger a browser download with the
      // filename suggested by the server's Content-Disposition header.
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || "atom-labdocs-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export ready",
        description: `Downloaded ${filename}`,
      });
    },
    onError: (e: Error) => {
      toast({
        title: "Export failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  // --- Read + parse the user-selected import file ---
  async function onFilePicked(file: File) {
    setFileName(file.name);
    setParseError(null);
    setParsedFile(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Validate client-side using the same parser shape we use on the server.
      // We mirror the server's parseExportFile rules so the preview matches
      // what the API will accept.
      const parsed = parseExportFileClient(json);
      setParsedFile(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not parse file";
      setParseError(msg);
    }
  }

  // --- Send the parsed file to the import API ---
  const importMut = useMutation({
    mutationFn: async () => {
      if (!parsedFile) throw new Error("No file parsed");
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: parsedFile,
          options: { duplicateGroups },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Import failed (HTTP ${res.status})`);
      }
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
      // Invalidate every admin query so the tree / lists refetch with the
      // newly imported content.
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
      setImportOpen(false);
      setParsedFile(null);
      setFileName(null);
      setParseError(null);
      setDuplicateGroups(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (e: Error) => {
      toast({
        title: "Import failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Import / Export Content</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Export the entire site (all courses, labs, modules, and steps) to a JSON
        file, or import a previously exported file. Imports always create{" "}
        <span className="font-medium text-foreground">new</span> content —
        existing data is never modified or deleted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => exportAll.mutate()}
          disabled={exportAll.isPending}
        >
          {exportAll.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export All
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            setImportOpen(true);
            setParsedFile(null);
            setParseError(null);
            setFileName(null);
          }}
        >
          <Upload className="h-4 w-4" />
          Import
        </Button>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import content from JSON</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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

            {parsedFile && !parseError && (
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
                    On: always create new groups, even if a same-named one
                    exists.
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
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={importMut.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={!parsedFile || importMut.isPending}
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
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Inline per-course Export button ============
// Shown next to each course in the admin "All Courses" list (icon-only) and
// in the CoursePanel header (labeled). Triggers a direct browser download of
// that course's JSON dump.
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
      toast({
        title: "Course exported",
        description: `Downloaded ${filename}`,
      });
    },
    onError: (e: Error) => {
      toast({
        title: "Export failed",
        description: e.message,
        variant: "destructive",
      });
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

// ============ Import preview card ============
function ImportPreview({
  file,
  fileName,
}: {
  file: ExportFile;
  fileName: string | null;
}) {
  // Compute friendly counts for the preview. For a "full" export we sum across
  // all courses; for a "course" export we just count the one course.
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
        {file.type === "full" && (
          <PreviewStat label="Groups" value={counts.groups} />
        )}
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

// ============ Client-side export-file parser ============
// Mirrors src/lib/import-export.ts#parseExportFile but duplicated here so the
// preview works without a round-trip to the server. The server re-validates on
// POST /api/import, so any divergence just results in a 400 (safe failure).
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
