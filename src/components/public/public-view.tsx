"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideViewer } from "@/components/lab/slide-viewer";
import type { Course, Lab, Module, Step } from "@/lib/types";
import { courseAccent } from "@/lib/types";
import {
  ChevronRight,
  FlaskConical,
  Layers,
  Presentation,
  ArrowLeft,
  BookOpen,
  FileText,
  ListOrdered,
  Play as PlayIcon,
  FileArchive,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export function PublicView() {
  const { selectedCourseId, selectedLabId, selectedModuleId, selectCourse, selectLab, selectModule } =
    useAppStore();

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchJson<Course[]>("/api/courses"),
  });

  const courseQuery = useQuery({
    queryKey: ["course", selectedCourseId],
    queryFn: () => fetchJson<Course & { labs: Lab[] }>("/api/courses/" + selectedCourseId),
    enabled: !!selectedCourseId,
  });

  const labQuery = useQuery({
    queryKey: ["lab", selectedLabId],
    queryFn: () =>
      fetchJson<Lab & { course: Course; modules: Module[] }>("/api/labs/" + selectedLabId),
    enabled: !!selectedLabId,
  });

  const moduleQuery = useQuery({
    queryKey: ["module", selectedModuleId],
    queryFn: () =>
      fetchJson<Module & { lab: Lab & { course: Course }; steps: Step[] }>(
        "/api/modules/" + selectedModuleId
      ),
    enabled: !!selectedModuleId,
  });

  // Module presentation view
  if (selectedModuleId && moduleQuery.data) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Courses", onClick: () => { selectModule(null); selectLab(null); selectCourse(null); } },
            ...(moduleQuery.data.lab.course
              ? [{ label: moduleQuery.data.lab.course.title, onClick: () => { selectModule(null); selectLab(null); selectCourse(moduleQuery.data.lab.course.id); } }]
              : []),
            { label: moduleQuery.data.lab.title, onClick: () => { selectModule(null); selectLab(moduleQuery.data.lab.id); } },
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

  if (selectedModuleId && moduleQuery.isLoading) {
    return <Skeleton className="h-[600px] w-full rounded-2xl" />;
  }

  // Module list within a lab
  if (selectedLabId && labQuery.data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Courses", onClick: () => { selectLab(null); selectCourse(null); } },
            ...(labQuery.data.course
              ? [{ label: labQuery.data.course.title, onClick: () => { selectLab(null); selectCourse(labQuery.data.course.id); } }]
              : []),
            { label: labQuery.data.title },
          ]}
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: courseAccent(labQuery.data.course) }}>{labQuery.data.title}</h1>
          {labQuery.data.description && (
            <p className="mt-1 text-muted-foreground">{labQuery.data.description}</p>
          )}
        </div>
        {labQuery.data.modules.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No modules yet"
            description="This lab has no modules. Ask an admin to add some."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labQuery.data.modules.map((m, i) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={i}
                accent={courseAccent(labQuery.data.course)}
                onClick={() => selectModule(m.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (selectedLabId && labQuery.isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  // Lab list within a course
  if (selectedCourseId && courseQuery.data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Courses", onClick: () => selectCourse(null) },
            { label: courseQuery.data.title },
          ]}
        />
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ background: courseAccent(courseQuery.data) + "22" }}
          >
            {courseQuery.data.icon ?? "📘"}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{courseQuery.data.title}</h1>
            {courseQuery.data.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{courseQuery.data.description}</p>
            )}
          </div>
        </div>
        {courseQuery.data.labs.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No labs yet"
            description="This course has no labs."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courseQuery.data.labs.map((lab, i) => (
              <LabCard key={lab.id} lab={lab} index={i} accent={courseAccent(courseQuery.data)} onClick={() => selectLab(lab.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (selectedCourseId && courseQuery.isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  // Course list (root)
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
          <BookOpen className="h-3.5 w-3.5" /> Public Library
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Explore Lab Courses</h1>
        <p className="text-muted-foreground">
          Browse courses, labs and slide-based modules. Each module is presented like a deck of slides.
        </p>
      </div>

      {coursesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : coursesQuery.data && coursesQuery.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coursesQuery.data.map((course, i) => (
            <CourseCard key={course.id} course={course} index={i} onClick={() => selectCourse(course.id)} />
          ))}
        </div>
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
              className="rounded px-1 py-0.5 transition hover:bg-muted hover:text-foreground"
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
      className="group relative cursor-pointer overflow-hidden p-0 transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={onClick}
    >
      <div className="h-2 w-full" style={{ background: color }} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ background: color + "22" }}
          >
            {course.icon ?? "📘"}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {(course._count?.labs ?? 0)} labs
          </span>
        </div>
        <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
          Open course
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Card>
  );
}

function LabCard({ lab, index, accent, onClick }: { lab: Lab; index: number; accent: string; onClick: () => void }) {
  const hasLink = lab.linkType !== "none" && !!lab.linkUrl;
  const isDownload = lab.linkType === "download";
  const LinkIcon = isDownload ? FileArchive : PlayIcon;
  const linkLabel = isDownload ? "Download lab assets" : "Watch lab video";
  return (
    <Card
      className="group cursor-pointer p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={onClick}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: accent + "22", color: accent }}
        >
          <FlaskConical className="h-5 w-5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {(lab._count?.modules ?? 0)} modules
        </span>
      </div>
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-tight transition-colors group-hover:text-[var(--accent)]">{lab.title}</h3>
        {hasLink && (
          <a
            href={lab.linkUrl!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-accent hover:text-accent-foreground"
            title={linkLabel}
            aria-label={linkLabel}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {lab.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{lab.description}</p>
      )}
      <div className="mt-4 flex items-center gap-1.5 text-sm font-medium" style={{ color: accent }}>
        {hasLink ? (isDownload ? "Download" : "Watch") : "Open lab"}
        {hasLink ? (
          <LinkIcon className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        )}
      </div>
    </Card>
  );
}

function ModuleCard({
  module,
  index,
  accent,
  onClick,
}: {
  module: Module;
  index: number;
  accent: string;
  onClick: () => void;
}) {
  const stepCount = module._count?.steps ?? 0;
  const slideCount = stepCount + 4; // title, overview, steps, output, conclusion
  return (
    <Card
      className="group cursor-pointer p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={onClick}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: accent + "22", color: accent }}
        >
          <Presentation className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {slideCount} slides
        </span>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Module {index + 1}
      </p>
      <h3 className="mt-0.5 text-base font-semibold leading-tight transition-colors group-hover:text-[var(--accent)]">
        {module.title}
      </h3>
      <div className="mt-4 flex items-center gap-1.5 text-sm font-medium" style={{ color: accent }}>
        <Play /> Present slides
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
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
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
