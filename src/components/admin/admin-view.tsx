"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ModuleEditor } from "@/components/admin/module-editor";
import { VisibilityToggle } from "@/components/admin/visibility-toggle";
import { CourseGroupsSection } from "@/components/admin/course-groups-section";
import type { Course, CourseGroup, Lab, Module } from "@/lib/types";
import { courseAccent } from "@/lib/types";
import type { LabLinkType } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  FlaskConical,
  Presentation,
  BookOpen,
  Layers,
  MoreVertical,
  FolderPlus,
  GripVertical,
  Play,
  FileArchive,
  Ban,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type CourseTree = Course & { labs: (Lab & { modules: Module[] })[] };

export function AdminView() {
  const {
    adminCourseId,
    adminLabId,
    adminModuleId,
    setAdminCourse,
    setAdminLab,
    setAdminModule,
  } = useAppStore();

  // Fetch the full tree for the sidebar
  const treeQuery = useQuery({
    queryKey: ["admin-tree"],
    queryFn: () => fetchJson<CourseTree[]>("/api/courses?withNested=1&admin=1"),
  });
  // Fallback: the courses endpoint doesn't nest; we fetch per-course. We'll
  // use a dedicated tree approach below via individual queries. For now, if
  // the courses endpoint returns flat courses, we fetch nested lazily in the
  // sidebar by expanding. To keep it robust we'll fetch nested via a small
  // helper query when a course is expanded.

  const coursesQuery = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchJson<Course[]>("/api/courses?admin=1"),
  });

  // Single-course nested data (for sidebar expansion + main panel)
  const courseQuery = useQuery({
    queryKey: ["admin-course-nested", adminCourseId],
    queryFn: () =>
      fetchJson<CourseTree>("/api/courses/" + adminCourseId + "?admin=1"),
    enabled: !!adminCourseId,
  });

  const labQuery = useQuery({
    queryKey: ["admin-lab-nested", adminLabId],
    queryFn: () =>
      fetchJson<Lab & { course: Course; modules: Module[] }>(
        "/api/labs/" + adminLabId + "?admin=1"
      ),
    enabled: !!adminLabId,
  });

  // === MODULE EDITOR VIEW ===
  if (adminModuleId) {
    return (
      <div className="space-y-4">
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", onClick: () => { setAdminModule(null); setAdminLab(null); setAdminCourse(null); } },
            ...(labQuery.data?.course
              ? [{ label: labQuery.data.course.title, onClick: () => { setAdminModule(null); setAdminLab(null); setAdminCourse(labQuery.data!.course.id); } }]
              : []),
            ...(labQuery.data
              ? [{ label: labQuery.data.title, onClick: () => { setAdminModule(null); setAdminLab(adminLabId); } }]
              : []),
          ]}
        />
        <ModuleEditor moduleId={adminModuleId} />
      </div>
    );
  }

  // === MAIN DASHBOARD LAYOUT (sidebar + panel) ===
  return (
    <div className="grid gap-4 lg:grid-cols-[25%_1fr]">
      {/* Sidebar tree */}
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
        <Card className="flex h-full max-h-[60vh] flex-col p-0 lg:max-h-none">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Content Tree
            </span>
            <CreateCourseDialog compact />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {coursesQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : coursesQuery.data && coursesQuery.data.length > 0 ? (
                <div className="space-y-1">
                  {coursesQuery.data.map((course) => (
                    <CourseTreeItem
                      key={course.id}
                      course={course}
                      selectedCourseId={adminCourseId}
                      selectedLabId={adminLabId}
                      onSelectCourse={(id) =>
                        setAdminCourse(adminCourseId === id ? null : id)
                      }
                      onSelectLab={(courseId, labId) => {
                        setAdminCourse(courseId);
                        setAdminLab(adminLabId === labId ? null : labId);
                      }}
                      onSelectModule={(courseId, labId, moduleId) => {
                        setAdminCourse(courseId);
                        setAdminLab(labId);
                        setAdminModule(moduleId);
                      }}
                      expandedCourse={adminCourseId}
                      nestedCourse={courseQuery.data}
                      nestedLab={labQuery.data}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No courses yet. Click + to create one.
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </aside>

      {/* Main panel */}
      <div className="min-w-0 space-y-4">
        <MainPanel
          adminCourseId={adminCourseId}
          adminLabId={adminLabId}
          courseQuery={courseQuery}
          labQuery={labQuery}
          coursesQuery={coursesQuery}
          onSelectCourse={setAdminCourse}
          onSelectLab={setAdminLab}
          onSelectModule={setAdminModule}
        />
      </div>
    </div>
  );
}

/* ============ SIDEBAR TREE ============ */

function CourseTreeItem({
  course,
  selectedCourseId,
  selectedLabId,
  onSelectCourse,
  onSelectLab,
  onSelectModule,
  expandedCourse,
  nestedCourse,
  nestedLab,
}: {
  course: Course;
  selectedCourseId: string | null;
  selectedLabId: string | null;
  onSelectCourse: (id: string) => void;
  onSelectLab: (courseId: string, labId: string) => void;
  onSelectModule: (courseId: string, labId: string, moduleId: string) => void;
  expandedCourse: string | null;
  nestedCourse?: CourseTree;
  nestedLab?: Lab & { course: Course; modules: Module[] };
}) {
  const isExpanded = expandedCourse === course.id;
  const labs = nestedCourse?.labs ?? [];
  const qc = useQueryClient();
  const [delOpen, setDelOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => fetch("/api/courses/" + course.id, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["admin-tree"] });
      toast({ title: "Course deleted" });
      useAppStore.getState().setAdminCourse(null);
    },
  });

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onSelectCourse(course.id)}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm transition",
          selectedCourseId === course.id && !selectedLabId
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted"
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="shrink-0 text-base leading-none">{course.icon ?? "📘"}</span>
            <span className="truncate">{course.title}</span>
            {course.hidden && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                Hidden
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
          <VisibilityToggle kind="course" id={course.id} hidden={course.hidden} />
          <EditCourseDialog course={course} compact />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive text-xs"
                onSelect={(e) => { e.preventDefault(); setDelOpen(true); }}
              >
                <Trash2 className="mr-2 h-3 w-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CollapsibleContent>
        <div className="ml-3 border-l pl-2">
          {isExpanded && nestedCourse === undefined && (
            <div className="py-1 pl-3 text-xs text-muted-foreground">Loading...</div>
          )}
          {isExpanded && nestedCourse && labs.length === 0 && (
            <div className="py-1 pl-3 text-xs text-muted-foreground">No labs yet</div>
          )}
          {isExpanded &&
            nestedCourse &&
            labs.map((lab) => {
              const labModules = nestedLab && nestedLab.id === lab.id ? nestedLab.modules : lab.modules ?? [];
              const labExpanded = selectedLabId === lab.id;
              return (
                <Collapsible
                  key={lab.id}
                  open={labExpanded}
                  onOpenChange={() => onSelectLab(course.id, lab.id)}
                >
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm transition",
                      labExpanded ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                        {labExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{lab.title}</span>
                        {lab.hidden && (
                          <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                            Hidden
                          </span>
                        )}
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="ml-3 border-l pl-2">
                      {labExpanded && nestedLab?.id === lab.id && nestedLab.modules.length === 0 && (
                        <div className="py-1 pl-3 text-xs text-muted-foreground">No modules yet</div>
                      )}
                      {labExpanded &&
                        nestedLab?.id === lab.id &&
                        labModules.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => onSelectModule(course.id, lab.id, m.id)}
                            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition hover:bg-muted"
                          >
                            <Presentation className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{m.title}</span>
                            {m.hidden && (
                              <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                                Hidden
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </div>
      </CollapsibleContent>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{course.title}” and all its labs and modules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}

/* ============ MAIN PANEL ============ */

function MainPanel({
  adminCourseId,
  adminLabId,
  courseQuery,
  labQuery,
  coursesQuery,
  onSelectCourse,
  onSelectLab,
  onSelectModule,
}: {
  adminCourseId: string | null;
  adminLabId: string | null;
  courseQuery: ReturnType<typeof useQuery<CourseTree>>;
  labQuery: ReturnType<typeof useQuery<Lab & { course: Course; modules: Module[] }>>;
  coursesQuery: ReturnType<typeof useQuery<Course[]>>;
  onSelectCourse: (id: string | null) => void;
  onSelectLab: (id: string | null) => void;
  onSelectModule: (id: string) => void;
}) {
  // No selection -> overview dashboard
  if (!adminCourseId) {
    return (
      <OverviewPanel
        courses={coursesQuery.data ?? []}
        loading={coursesQuery.isLoading}
        onSelectCourse={onSelectCourse}
      />
    );
  }

  // Course selected, no lab -> course management (with Add Lab panel)
  if (adminCourseId && !adminLabId) {
    if (courseQuery.isLoading) return <Skeleton className="h-96 rounded-xl" />;
    if (!courseQuery.data) return null;
    return (
      <CoursePanel
        course={courseQuery.data}
        onSelectLab={onSelectLab}
        onSelectModule={(modId) => onSelectModule(modId)}
      />
    );
  }

  // Lab selected -> lab management (with Add Module panel)
  if (adminLabId) {
    if (labQuery.isLoading) return <Skeleton className="h-96 rounded-xl" />;
    if (!labQuery.data) return null;
    return (
      <LabPanel
        lab={labQuery.data}
        onSelectModule={onSelectModule}
      />
    );
  }

  return null;
}

/* ============ OVERVIEW PANEL ============ */

function OverviewPanel({
  courses,
  loading,
  onSelectCourse,
}: {
  courses: Course[];
  loading: boolean;
  onSelectCourse: (id: string | null) => void;
}) {
  const totalLabs = courses.reduce((acc, c) => acc + (c._count?.labs ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage your lab documentation. Select a course from the tree, or create a new one.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={BookOpen} label="Courses" value={courses.length} color="text-teal-600" />
        <StatCard icon={FlaskConical} label="Labs" value={totalLabs} color="text-violet-600" />
        <StatCard icon={Presentation} label="Modules" value="—" color="text-amber-600" />
      </div>

      {/* Quick actions */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <FolderPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Quick Actions</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateCourseDialog />
        </div>
      </Card>

      {/* Course groups */}
      <CourseGroupsSection />

      {/* Courses list */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">All Courses</h2>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No courses yet. Create your first course to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <div
                key={c.id}
                className="flex w-full items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/30"
              >
                <button
                  onClick={() => onSelectCourse(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ background: courseAccent(c) + "22" }}
                  >
                    {c.icon ?? "📘"}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{c.title}</span>
                      {c.hidden && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c._count?.labs ?? 0} labs
                    </p>
                  </div>
                </button>
                <VisibilityToggle kind="course" id={c.id} hidden={c.hidden} />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-muted", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

/* ============ COURSE PANEL (with Add Lab panel) ============ */

function CoursePanel({
  course,
  onSelectLab,
  onSelectModule: _onSelectModule,
}: {
  course: CourseTree;
  onSelectLab: (id: string | null) => void;
  onSelectModule: (id: string) => void;
}) {
  const labs = course.labs;

  return (
    <div className="space-y-5">
      {/* Course header */}
      <div className="flex flex-wrap items-start gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ background: courseAccent(course) + "22" }}
        >
          {course.icon ?? "📘"}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          {course.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{course.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <EditCourseDialog course={course} />
          <AddLabDialog courseId={course.id} />
        </div>
      </div>

      {/* Labs list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Labs in this course ({labs.length})
          </h2>
        </div>
        {labs.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <FlaskConical className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No labs yet. Click <span className="font-medium text-foreground">Add Lab</span> above to create your first lab.
            </p>
          </Card>
        ) : (
          <LabsTable labs={labs} course={course} onSelectLab={onSelectLab} />
        )}
      </div>
    </div>
  );
}

/* ============ LAB PANEL (with Add Module panel) ============ */

function LabPanel({
  lab,
  onSelectModule,
}: {
  lab: Lab & { course: Course; modules: Module[] };
  onSelectModule: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Breadcrumb back to course */}
      <AdminBreadcrumbs
        items={[
          { label: "Dashboard", onClick: () => useAppStore.getState().setAdminCourse(null) },
          { label: lab.course.title, onClick: () => useAppStore.getState().setAdminLab(null) },
          { label: lab.title },
        ]}
      />

      {/* Lab header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: courseAccent(lab.course) + "22", color: courseAccent(lab.course) }}
        >
          <FlaskConical className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: courseAccent(lab.course) }}>{lab.title}</h1>
          {lab.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{lab.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <EditLabDialog lab={lab} />
          <AddModuleDialog labId={lab.id} onCreated={(id) => onSelectModule(id)} />
        </div>
      </div>

      {/* Modules list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Presentation className="h-4 w-4 text-muted-foreground" />
            Modules in this lab ({lab.modules.length})
          </h2>
        </div>
        {lab.modules.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <Presentation className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No modules yet. Click <span className="font-medium text-foreground">Add Module</span> above to create your first module.
            </p>
          </Card>
        ) : (
          <ModulesTable modules={lab.modules} lab={lab} accent={courseAccent(lab.course)} onSelectModule={onSelectModule} />
        )}
      </div>
    </div>
  );
}

/* ============ LAB LINK (download / watch) shared bits ============ */

// The three link-type options shown in the admin dropdown.
const LAB_LINK_OPTIONS: { value: LabLinkType; label: string; hint: string }[] = [
  { value: "none", label: "No link", hint: "Default — no link shown" },
  { value: "download", label: "Download", hint: "Show a download button (zip/file)" },
  { value: "watch", label: "Watch", hint: "Show a play button (video/stream)" },
];

// Reusable form fields for choosing a link type + URL.
// Used by both AddLabDialog and EditLabDialog.
function LabLinkFields({
  linkType,
  linkUrl,
  onTypeChange,
  onUrlChange,
}: {
  linkType: LabLinkType;
  linkUrl: string;
  onTypeChange: (v: LabLinkType) => void;
  onUrlChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <Label>Link</Label>
        <Select value={linkType} onValueChange={(v) => onTypeChange(v as LabLinkType)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select link type" />
          </SelectTrigger>
          <SelectContent>
            {LAB_LINK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {linkType !== "none" && (
        <div>
          <Label>{linkType === "download" ? "Download URL" : "Watch URL"}</Label>
          <Input
            value={linkUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={
              linkType === "download"
                ? "https://example.com/lab-assets.zip"
                : "https://www.youtube.com/watch?v=..."
            }
            type="url"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Opens in a new tab when the {linkType === "download" ? "download" : "play"} button is clicked.
          </p>
        </div>
      )}
    </div>
  );
}

// The icon cell rendered in the admin LabsTable "Link" column.
// - "none"      -> muted Ban icon, not clickable (disabled)
// - "download"  -> FileArchive (zip) icon, clickable (opens link in new tab)
// - "watch"     -> Play icon, clickable (opens link in new tab)
function AdminLabLinkCell({ lab }: { lab: Pick<Lab, "linkType" | "linkUrl"> }) {
  if (lab.linkType === "none" || !lab.linkUrl) {
    return (
      <span
        className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
        title="No link"
        aria-disabled="true"
      >
        <Ban className="h-4 w-4" />
      </span>
    );
  }
  const isDownload = lab.linkType === "download";
  const Icon = isDownload ? FileArchive : Play;
  const label = isDownload ? "Download lab assets" : "Watch lab video";
  return (
    <a
      href={lab.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-accent hover:text-accent-foreground"
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

/* ============ INLINE ADD FORMS ============ */

function AddLabDialog({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkType, setLinkType] = useState<LabLinkType>("none");
  const [linkUrl, setLinkUrl] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, courseId, linkType, linkUrl }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-nested", courseId] });
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      toast({ title: "Lab added", description: title.trim() });
      setTitle("");
      setDescription("");
      setLinkType("none");
      setLinkUrl("");
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to add lab", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Lab
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Lab</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            mut.mutate();
          }}
          className="space-y-4 py-2"
        >
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lab title (e.g. Lab 2: Queues)"
              autoFocus
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
            />
          </div>
          <LabLinkFields
            linkType={linkType}
            linkUrl={linkUrl}
            onTypeChange={(v) => {
              setLinkType(v);
              if (v === "none") setLinkUrl("");
            }}
            onUrlChange={setLinkUrl}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || mut.isPending} className="gap-1.5">
              {mut.isPending ? (
                <>
                  <Plus className="h-4 w-4" /> Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add Lab
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddModuleDialog({
  labId,
  onCreated,
}: {
  labId: string;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, labId }),
      }),
    onSuccess: async (res) => {
      const created = await res.json();
      qc.invalidateQueries({ queryKey: ["admin-lab-nested", labId] });
      qc.invalidateQueries({ queryKey: ["lab", labId] });
      toast({ title: "Module added", description: "Opening editor..." });
      setTitle("");
      setOpen(false);
      onCreated(created.id);
    },
    onError: () => {
      toast({ title: "Failed to add module", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Module
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Module</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            mut.mutate();
          }}
          className="space-y-4 py-2"
        >
          <div>
            <Label>Module title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Module title (e.g. Module 2: Implementing a Queue)"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            After adding, the module editor opens where you can fill in explanation, flow, procedure steps, output and conclusion.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || mut.isPending} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {mut.isPending ? "Adding..." : "Add & Edit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ ROW COMPONENTS (sortable tables) ============ */

const LAB_COLS = "grid-cols-[40px_44px_1fr_90px_80px_110px_44px_44px]";
const MODULE_COLS = "grid-cols-[40px_44px_1fr_90px_90px_44px_44px]";

function LabsTable({
  labs,
  course,
  onSelectLab,
}: {
  labs: Lab[];
  course: CourseTree;
  onSelectLab: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = labs.findIndex((l) => l.id === active.id);
    const newIndex = labs.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(labs, oldIndex, newIndex).map((l, i) => ({
      ...l,
      order: i,
    }));
    qc.setQueryData(["admin-course-nested", course.id], (old: CourseTree | undefined) =>
      old ? { ...old, labs: reordered as CourseTree["labs"] } : old
    );
    reordered.forEach((l) =>
      fetch("/api/labs/" + l.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: l.order }),
      })
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className={cn(
              LAB_COLS,
              "grid items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            )}
          >
            <div className="text-center" title="Drag to reorder">Order</div>
            <div></div>
            <div>Lab</div>
            <div className="text-center">Modules</div>
            <div className="text-center">Link</div>
            <div className="text-center">Manage</div>
            <div className="text-center">Edit</div>
            <div className="text-center">Delete</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={labs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {labs.map((lab, i) => (
                <SortableLabRow
                  key={lab.id}
                  lab={lab}
                  index={i}
                  accent={courseAccent(course)}
                  onOpen={() => onSelectLab(lab.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

function SortableLabRow({
  lab,
  index,
  accent,
  onOpen,
}: {
  lab: Lab;
  index: number;
  accent: string;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lab.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ["--accent" as string]: accent,
  } as React.CSSProperties;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        LAB_COLS,
        "grid items-center gap-2 border-b bg-card px-3 py-2.5 transition last:border-0 hover:bg-muted/30",
        isDragging && "z-10 opacity-60 shadow-md"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center justify-center text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder lab"
        title={`Lab ${index + 1} — drag to reorder`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: accent + "22", color: accent }}
      >
        <FlaskConical className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium transition-colors hover:text-[var(--accent)]">{lab.title}</span>
            {lab.hidden && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                Hidden
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {lab.description || "No description"}
          </p>
        </div>
        <VisibilityToggle kind="lab" id={lab.id} hidden={lab.hidden} />
      </div>
      <div className="text-center">
        <span className="inline-flex min-w-[28px] justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {lab._count?.modules ?? 0}
        </span>
      </div>
      <div className="flex justify-center">
        <AdminLabLinkCell lab={lab} />
      </div>
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={onOpen} className="gap-1.5">
          <Layers className="h-3.5 w-3.5" /> Manage
        </Button>
      </div>
      <div className="flex justify-center">
        <EditLabDialog lab={lab} iconOnly />
      </div>
      <div className="flex justify-center">
        <DeleteLabButton lab={lab} />
      </div>
    </div>
  );
}

function DeleteLabButton({ lab }: { lab: Lab }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => fetch("/api/labs/" + lab.id, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-nested"] });
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["course"] });
      toast({ title: "Lab deleted" });
    },
  });
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        title="Delete lab"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lab?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{lab.title}” and all its modules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ModulesTable({
  modules,
  lab,
  accent,
  onSelectModule,
}: {
  modules: Module[];
  lab: Lab;
  accent: string;
  onSelectModule: (id: string) => void;
}) {
  const qc = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(modules, oldIndex, newIndex).map((m, i) => ({
      ...m,
      order: i,
    }));
    qc.setQueryData(["admin-lab-nested", lab.id], (old: (Lab & { course: Course; modules: Module[] }) | undefined) =>
      old ? { ...old, modules: reordered } : old
    );
    reordered.forEach((m) =>
      fetch("/api/modules/" + m.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: m.order }),
      })
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div
            className={cn(
              MODULE_COLS,
              "grid items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            )}
          >
            <div className="text-center" title="Drag to reorder">Order</div>
            <div></div>
            <div>Module</div>
            <div className="text-center">Steps</div>
            <div className="text-center">Slides</div>
            <div className="text-center">Edit</div>
            <div className="text-center">Delete</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              {modules.map((m, i) => (
                <SortableModuleRow
                  key={m.id}
                  module={m}
                  index={i}
                  accent={accent}
                  onOpen={() => onSelectModule(m.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

function SortableModuleRow({
  module,
  index,
  accent,
  onOpen,
}: {
  module: Module;
  index: number;
  accent: string;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ["--accent" as string]: accent,
  } as React.CSSProperties;
  const stepCount = module._count?.steps ?? 0;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        MODULE_COLS,
        "grid items-center gap-2 border-b bg-card px-3 py-2.5 transition last:border-0 hover:bg-muted/30",
        isDragging && "z-10 opacity-60 shadow-md"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center justify-center text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder module"
        title={`Module ${index + 1} — drag to reorder`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: accent + "22", color: accent }}
      >
        <Presentation className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium transition-colors hover:text-[var(--accent)]">{module.title}</span>
            {module.hidden && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                Hidden
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">Module {index + 1}</p>
        </div>
        <VisibilityToggle kind="module" id={module.id} hidden={module.hidden} />
      </div>
      <div className="text-center">
        <span className="inline-flex min-w-[28px] justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {stepCount}
        </span>
      </div>
      <div className="text-center text-sm font-medium">{stepCount + 4}</div>
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onOpen}
          title="Edit module"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-center">
        <DeleteModuleButton module={module} />
      </div>
    </div>
  );
}

function DeleteModuleButton({ module }: { module: Module }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => fetch("/api/modules/" + module.id, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lab-nested"] });
      qc.invalidateQueries({ queryKey: ["lab"] });
      toast({ title: "Module deleted" });
    },
  });
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        title="Delete module"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete module?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{module.title}” and all its steps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ============ BREADCRUMBS ============ */

function AdminBreadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-4 w-4" />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="rounded px-1.5 py-0.5 transition hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ============ COURSE CREATE/EDIT DIALOGS ============ */

const EMOJIS = ["📘", "🧪", "⚗️", "🔬", "🧬", "💻", "⚙️", "🧮", "📐", "📊", "🌐", "🤖", "📡", "🔋", "🧲"];

function useCourseGroups() {
  return useQuery({
    queryKey: ["admin-course-groups"],
    queryFn: () => fetchJson<CourseGroup[]>("/api/course-groups"),
  });
}

function GroupSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const groupsQuery = useCourseGroups();
  const groups = groupsQuery.data ?? [];
  return (
    <div>
      <Label>Course group</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Select a group (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— No group —</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.icon ?? "📁"} {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateCourseDialog({ compact }: { compact?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [groupId, setGroupId] = useState("none");
  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, icon, groupId: groupId === "none" ? null : groupId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: "Course created" });
      setOpen(false);
      setTitle("");
      setDescription("");
      setGroupId("none");
    },
    onError: () => {
      toast({ title: "Failed to create course", description: "Are you logged in?", variant: "destructive" });
    },
  });

  const trigger = compact ? (
    <Button variant="ghost" size="icon" className="h-7 w-7" title="New course">
      <Plus className="h-4 w-4" />
    </Button>
  ) : (
    <DialogTrigger asChild>
      <Button className="gap-1.5">
        <Plus className="h-4 w-4" /> New Course
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create course</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <GroupSelect value={groupId} onChange={setGroupId} />
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Structures" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border text-lg",
                    icon === e ? "border-primary bg-primary/10" : ""
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            The accent color is inherited from the selected course group. Assign a group above to color this course.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!title.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCourseDialog({ course, compact, asItem }: { course: Course; compact?: boolean; asItem?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [icon, setIcon] = useState(course.icon ?? EMOJIS[0]);
  const [groupId, setGroupId] = useState(course.groupId ?? "none");

  useEffectReset(() => {
    setTitle(course.title);
    setDescription(course.description ?? "");
    setIcon(course.icon ?? EMOJIS[0]);
    setGroupId(course.groupId ?? "none");
  }, [course, open]);

  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/courses/" + course.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, icon, groupId: groupId === "none" ? null : groupId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["admin-course-nested", course.id] });
      qc.invalidateQueries({ queryKey: ["course", course.id] });
      toast({ title: "Course updated" });
      setOpen(false);
    },
  });

  const trigger = asItem ? (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
      <Pencil className="mr-2 h-4 w-4" /> Edit
    </DropdownMenuItem>
  ) : compact ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      title="Edit course"
      onClick={() => setOpen(true)}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
      <Pencil className="h-3.5 w-3.5" /> Edit
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit course</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <GroupSelect value={groupId} onChange={setGroupId} />
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border text-lg",
                    icon === e ? "border-primary bg-primary/10" : ""
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            The accent color is inherited from the selected course group. Assign a group above to color this course.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLabDialog({ lab, asItem, iconOnly }: { lab: Lab; asItem?: boolean; iconOnly?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lab.title);
  const [description, setDescription] = useState(lab.description ?? "");
  const [linkType, setLinkType] = useState<LabLinkType>(lab.linkType ?? "none");
  const [linkUrl, setLinkUrl] = useState(lab.linkUrl ?? "");
  useEffectReset(() => {
    setTitle(lab.title);
    setDescription(lab.description ?? "");
    setLinkType(lab.linkType ?? "none");
    setLinkUrl(lab.linkUrl ?? "");
  }, [lab, open]);
  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/labs/" + lab.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, linkType, linkUrl }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-nested"] });
      qc.invalidateQueries({ queryKey: ["course"] });
      qc.invalidateQueries({ queryKey: ["admin-lab-nested", lab.id] });
      qc.invalidateQueries({ queryKey: ["lab", lab.id] });
      toast({ title: "Lab updated" });
      setOpen(false);
    },
  });
  const trigger = asItem ? (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
      <Pencil className="mr-2 h-4 w-4" /> Edit
    </DropdownMenuItem>
  ) : iconOnly ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setOpen(true)}
      title="Edit lab"
    >
      <Pencil className="h-4 w-4" />
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
      <Pencil className="h-3.5 w-3.5" /> Edit
    </Button>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit lab</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <LabLinkFields
            linkType={linkType}
            linkUrl={linkUrl}
            onTypeChange={(v) => {
              setLinkType(v);
              if (v === "none") setLinkUrl("");
            }}
            onUrlChange={setLinkUrl}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// helper: run effect when deps change (resets form fields when dialog opens)
function useEffectReset(fn: () => void, deps: unknown[]) {
  useEffect(fn, deps);
}
