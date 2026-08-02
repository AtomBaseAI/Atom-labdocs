"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicNav } from "@/hooks/use-public-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideViewer } from "@/components/lab/slide-viewer";
import type { Course, CourseGroup, Lab, Module, Step } from "@/lib/types";
import { DEFAULT_ACCENT, courseAccent } from "@/lib/types";
import {
  ChevronRight,
  FlaskConical,
  Layers,
  Presentation,
  BookOpen,
  ListOrdered,
  Play as PlayIcon,
  FileArchive,
  Globe as GlobeIcon,
  Lock,
  Search,
  X,
  SlidersHorizontal,
  BookA,
  BookText,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

// Public card structure = an OUTER bordered container with an INNER glass
// face inset by a small gap. The hover "moving border" blob lives in that
// gap (behind the inner face), so its colored glow only traces the card
// edges on hover instead of bleeding through the middle.
// (Design outline adapted from Uiverse.io / dylanharriscameron.)
const CARD_OUTER =
  "group relative cursor-pointer overflow-hidden border border-black/10 shadow-lg shadow-black/5 transition-all hover:shadow-xl hover:-translate-y-0.5 dark:border-white/10";

// Inner frosted-glass face. Slightly more opaque than before so the blob
// behind it stays hidden in the center; the gap around it reveals the glow.
const GLASS_FACE =
  "relative z-10 m-[5px] bg-white/85 backdrop-blur-xl backdrop-saturate-150 dark:bg-zinc-900/80";

export function PublicView() {
  const nav = usePublicNav();

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchJson<Course[]>("/api/courses"),
  });

  const courseQuery = useQuery({
    queryKey: ["course", nav.selectedCourseId],
    queryFn: () =>
      fetchJson<Course & { labs: Lab[] }>(
        "/api/courses/" + nav.selectedCourseId,
      ),
    enabled: !!nav.selectedCourseId,
  });

  const labQuery = useQuery({
    queryKey: ["lab", nav.selectedLabId],
    queryFn: () =>
      fetchJson<Lab & { course: Course; modules: Module[] }>(
        "/api/labs/" + nav.selectedLabId,
      ),
    enabled: !!nav.selectedLabId,
  });

  const moduleQuery = useQuery({
    queryKey: ["module", nav.selectedModuleId],
    queryFn: () =>
      fetchJson<Module & { lab: Lab & { course: Course }; steps: Step[] }>(
        "/api/modules/" + nav.selectedModuleId,
      ),
    enabled: !!nav.selectedModuleId,
  });

  // ---- Root course list: search + course-group badge filters ----
  const groupsQuery = useQuery({
    queryKey: ["course-groups"],
    queryFn: () =>
      fetchJson<(CourseGroup & { _count: { courses: number } })[]>(
        "/api/course-groups",
      ),
  });

  const [search, setSearch] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleGroup = (id: string) =>
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearFilters = () => {
    setSearch("");
    setSelectedGroupIds(new Set());
  };

  // Filter the full course list by the search term and selected group badges.
  const filteredCourses = useMemo(() => {
    if (!coursesQuery.data) return [];
    const q = search.trim().toLowerCase();
    return coursesQuery.data.filter((c) => {
      const matchesSearch = !q || c.title.toLowerCase().includes(q);
      const matchesGroup =
        selectedGroupIds.size === 0 ||
        (!!c.groupId && selectedGroupIds.has(c.groupId));
      return matchesSearch && matchesGroup;
    });
  }, [coursesQuery.data, search, selectedGroupIds]);

  // goRoot is provided by usePublicNav via nav.goRoot

  // Build a "group" crumb that sits between "Courses" and the course name.
  // Clicking it returns to the full course list (no group-filtered view exists).
  const groupCrumb = (
    group?: CourseGroup | null,
  ): { label: string; onClick: () => void }[] =>
    group ? [{ label: group.name, onClick: nav.goRoot }] : [];

  // Module presentation view
  if (nav.selectedModuleId && moduleQuery.data) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Courses", onClick: nav.goRoot },
            ...groupCrumb(moduleQuery.data.lab.course.group),
            ...(moduleQuery.data.lab.course
              ? [
                  {
                    label: moduleQuery.data.lab.course.title,
                    onClick: () =>
                      nav.goToCourseFromModule(moduleQuery.data.lab.course.id),
                  },
                ]
              : []),
            {
              label: moduleQuery.data.lab.title,
              onClick: () => nav.goToLabFromModule(moduleQuery.data.lab.id),
            },
            { label: moduleQuery.data.title },
          ]}
        />
        <SlideViewer
          module={moduleQuery.data}
          courseTitle={moduleQuery.data.lab.course.title}
          labTitle={moduleQuery.data.lab.title}
          accent={courseAccent(moduleQuery.data.lab.course)}
        />
      </div>
    );
  }

  if (nav.selectedModuleId && moduleQuery.isLoading) {
    return <Skeleton className="h-[600px] w-full rounded-2xl" />;
  }

  // Module list within a lab
  if (nav.selectedLabId && labQuery.data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Courses", onClick: nav.goRoot },
            ...groupCrumb(labQuery.data.course.group),
            ...(labQuery.data.course
              ? [
                  {
                    label: labQuery.data.course.title,
                    onClick: () =>
                      nav.goToCourseFromModule(labQuery.data.course.id),
                  },
                ]
              : []),
            { label: labQuery.data.title },
          ]}
        />
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: courseAccent(labQuery.data.course) }}
          >
            {labQuery.data.title}
          </h1>
        </div>
        {labQuery.data.modules.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No modules yet"
            description="This lab has no modules. Ask an admin to add some."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {labQuery.data.modules.map((m, i) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={i}
                accent={courseAccent(labQuery.data.course)}
                group={labQuery.data.course.group}
                onClick={() => nav.goToModule(m.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (nav.selectedLabId && labQuery.isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  // Lab list within a course
  if (nav.selectedCourseId && courseQuery.data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Courses", onClick: nav.goRoot },
            ...groupCrumb(courseQuery.data.group),
            { label: courseQuery.data.title },
          ]}
        />
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ background: courseAccent(courseQuery.data) + "22" }}
          >
            <BookText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {courseQuery.data.title}
            </h1>
          </div>
        </div>
        {courseQuery.data.labs.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No labs yet"
            description="This course has no labs."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courseQuery.data.labs.map((lab, i) => (
              <LabCard
                key={lab.id}
                lab={lab}
                index={i}
                accent={courseAccent(courseQuery.data)}
                group={courseQuery.data.group}
                onClick={() => nav.goToLab(lab.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (nav.selectedCourseId && courseQuery.isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  // Course list (root)
  const hasCourses = !!coursesQuery.data && coursesQuery.data.length > 0;
  const hasActiveFilters = search.trim() !== "" || selectedGroupIds.size > 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
          <BookOpen className="h-3.5 w-3.5" /> Public Library
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Explore Lab Courses
        </h1>
      </div>

      {/* Search + course-group filter toolbar */}
      {!coursesQuery.isLoading && hasCourses && (
        <SearchFilterToolbar
          search={search}
          onSearchChange={setSearch}
          groups={groupsQuery.data ?? []}
          selectedGroupIds={selectedGroupIds}
          onToggleGroup={toggleGroup}
          onClear={clearFilters}
          resultCount={filteredCourses.length}
          totalCount={coursesQuery.data!.length}
        />
      )}

      {coursesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : hasCourses ? (
        filteredCourses.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCourses.map((course, i) => (
              <CourseCard
                key={course.id}
                course={course}
                index={i}
                onClick={() => nav.goToCourse(course.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No matching courses"
            description="Try a different search term or clear the group filters to see everything."
            action={
              hasActiveFilters
                ? { label: "Clear filters", onClick: clearFilters }
                : undefined
            }
          />
        )
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Switch to the Admin panel to create your first course and start documenting labs."
        />
      )}
    </div>
  );
}

function Breadcrumbs({
  items,
}: {
  items: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-4 w-4" />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="max-w-[200px] truncate rounded px-1 py-0.5 transition hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </button>
          ) : (
            <span className="max-w-[220px] truncate font-medium text-foreground">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

// Small pill that surfaces the owning course group on every card.
function GroupBadge({ group }: { group?: CourseGroup | null }) {
  if (!group) return null;
  return (
    <Badge
      variant="secondary"
      className="gap-1 border-white/40 bg-white/50 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
      style={{ color: group.color ?? DEFAULT_ACCENT }}
    >
      {group.icon && (
        <span className="text-[0.95em] leading-none">{group.icon}</span>
      )}
      <span className="max-w-[130px] truncate">{group.name}</span>
    </Badge>
  );
}

// A soft accent-tinted glow rendered behind card content so the frosted-glass
// surface has something colorful to refract.
function AccentGlow({ color }: { color: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        background: `radial-gradient(120% 90% at 100% 0%, ${color}26, transparent 55%)`,
      }}
    />
  );
}

// Hover "moving border" — a colored blob that orbits the card's 4 quadrants
// when the card is hovered, creating a moving border of light behind the
// frosted-glass surface. Adapted from Uiverse.io (dylanharriscameron):
// design outline only, sizes kept independent of the reference.
function HoverBlob({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      className="blob-border pointer-events-none absolute left-1/2 top-1/2 z-0 h-40 w-40 blur-2xl"
      style={{ backgroundColor: color }}
    />
  );
}

function CourseCard({
  course,
  index,
  onClick,
}: {
  course: Course;
  index: number;
  onClick: () => void;
}) {
  const color = courseAccent(course);
  return (
    <Card
      className={cn(CARD_OUTER, "p-0", course.locked && "cursor-not-allowed")}
      onClick={() => !course.locked && onClick()}
    >
      <HoverBlob color={color} />
      <div className={cn(GLASS_FACE)}>
        <AccentGlow color={color} />
        <div className="relative z-10 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ background: color + "22" }}
            >
              <BookText className="h-5 w-5" />
            </div>
            <GroupBadge group={course.group} />
          </div>
          <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
            {course.title}
          </h3>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {course._count?.labs ?? 0} labs
            </span>
            {course.locked ? (
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                Course locked
                <Lock className="h-4 w-4" />
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color }}
              >
                Open course
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function LabCard({
  lab,
  index,
  accent,
  group,
  onClick,
}: {
  lab: Lab;
  index: number;
  accent: string;
  group?: CourseGroup | null;
  onClick: () => void;
}) {
  const hasLink = lab.linkType !== "none" && !!lab.linkUrl;
  const LinkIcon =
    lab.linkType === "download"
      ? FileArchive
      : lab.linkType === "watch"
        ? PlayIcon
        : GlobeIcon;
  const linkLabel =
    lab.linkType === "download"
      ? "Download"
      : lab.linkType === "watch"
        ? "Watch"
        : "Browse";
  return (
    <Card
      className={cn(CARD_OUTER, "p-0", lab.locked && "cursor-not-allowed")}
      onClick={() => !lab.locked && onClick()}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      <HoverBlob color={accent} />
      <div className={cn(GLASS_FACE)}>
        <AccentGlow color={accent} />
        <div className="relative z-10 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: accent + "22", color: accent }}
            >
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2 justify-center">
              {hasLink && (
                <a
                  href={lab.linkUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground transition hover:bg-accent hover:text-white"
                  aria-label={linkLabel}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {linkLabel}
                </a>
              )}

              <GroupBadge group={group} />
            </div>
          </div>
          <h3 className="min-w-0 text-base font-semibold leading-tight transition-colors group-hover:text-[var(--accent)] line-clamp-1 hover:text-nowrap">
            {lab.title}
          </h3>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {lab._count?.modules ?? 0} modules
            </span>
            <div className="flex items-center gap-2">
              {lab.locked ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  Lab locked
                  <Lock className="h-4 w-4" />
                </span>
              ) : (
                <span
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: accent }}
                >
                  Open lab
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ModuleCard({
  module,
  index,
  accent,
  group,
  onClick,
}: {
  module: Module;
  index: number;
  accent: string;
  group?: CourseGroup | null;
  onClick: () => void;
}) {
  const stepCount = module._count?.steps ?? 0;
  const slideCount = stepCount + 3; // title, overview, steps, output
  return (
    <Card
      className={cn(CARD_OUTER, "p-0", module.locked && "cursor-not-allowed")}
      onClick={() => !module.locked && onClick()}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      <HoverBlob color={accent} />
      <div className={cn(GLASS_FACE)}>
        <AccentGlow color={accent} />
        <div className="relative z-10 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: accent + "22", color: accent }}
            >
              <Presentation className="h-5 w-5" />
            </div>
            <GroupBadge group={group} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Module {index + 1}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-tight transition-colors group-hover:text-[var(--accent)]">
            {module.title}
          </h3>
          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full bg-muted/70 px-2 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              {slideCount} slides
            </span>
            {module.locked ? (
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                Slides locked
                <Lock className="h-4 w-4" />
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: accent }}
              >
                <Play /> Present slides
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Play() {
  return <ListOrdered className="h-4 w-4" />;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5"
          onClick={action.onClick}
        >
          <X className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Search + course-group filter toolbar for the public course list.
// Renders a frosted-glass panel matching the card aesthetic.
function SearchFilterToolbar({
  search,
  onSearchChange,
  groups,
  selectedGroupIds,
  onToggleGroup,
  onClear,
  resultCount,
  totalCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  groups: (CourseGroup & { _count: { courses: number } })[];
  selectedGroupIds: Set<string>;
  onToggleGroup: (id: string) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
}) {
  const hasFilters = search.trim() !== "" || selectedGroupIds.size > 0;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/50 bg-white/60 p-4 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search courses by title…"
            className="h-10 pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 sm:shrink-0">
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{resultCount}</span>{" "}
            of {totalCount}
          </span>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Groups
          </span>
          {groups.map((g) => (
            <GroupFilterChip
              key={g.id}
              group={g}
              active={selectedGroupIds.has(g.id)}
              onClick={() => onToggleGroup(g.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// A single course-group filter toggle pill. Active state fills with the
// group's own accent color so the selection is unmistakable.
function GroupFilterChip({
  group,
  active,
  onClick,
}: {
  group: CourseGroup & { _count: { courses: number } };
  active: boolean;
  onClick: () => void;
}) {
  const color = group.color ?? DEFAULT_ACCENT;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? "border-transparent text-white shadow-sm"
          : "border-border bg-background/60 text-foreground hover:bg-accent",
      )}
      style={
        active ? { backgroundColor: color, borderColor: color } : undefined
      }
    >
      {group.icon && (
        <span className="text-[0.95em] leading-none">{group.icon}</span>
      )}
      <span className="max-w-[140px] truncate">{group.name}</span>
      <span
        className={cn(
          "ml-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
          active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {group._count.courses}
      </span>
    </button>
  );
}
