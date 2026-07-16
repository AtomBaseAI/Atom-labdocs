// Shared types for the lab documentation app

export type FlowNode = {
  id: string;
  label: string;
  type: "start" | "process" | "decision" | "end" | "io";
};

export type CourseGroup = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  courses?: Course[];
  _count?: { courses: number };
};

export type Course = {
  id: string;
  groupId: string | null;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  labs?: Lab[];
  group?: CourseGroup | null;
  _count?: { labs: number };
};

// The kind of external link a lab can expose.
// "none"   -> no link (default)
// "download" -> a downloadable resource (zip/file), shown with a download icon
// "watch"  -> a watchable resource (video/stream), shown with a play icon
export type LabLinkType = "none" | "download" | "watch";

export type Lab = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  hidden: boolean;
  linkType: LabLinkType;
  linkUrl: string | null;
  createdAt: string;
  updatedAt: string;
  modules?: Module[];
  _count?: { modules: number };
};

export type Module = {
  id: string;
  labId: string;
  title: string;
  explanation: string | null;
  overview: string | null;
  flow: string | null; // JSON string of FlowNode[]
  output: string | null;
  conclusion: string | null;
  order: number;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  steps?: Step[];
  _count?: { steps: number };
};

export type Step = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  code: string | null;
  codeLang: string | null;
  image: string | null;
  imageCaption: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_ACCENT = "#0d9488";

// Resolve the accent color for a course from its Course Group.
// Courses no longer carry their own color — they inherit the group's color.
export function courseAccent(course: { group?: CourseGroup | null }): string {
  return course.group?.color ?? DEFAULT_ACCENT;
}
