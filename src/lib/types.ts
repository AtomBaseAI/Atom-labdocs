// Shared types for the lab documentation app

export type FlowNode = {
  id: string;
  label: string;
  type: "start" | "process" | "decision" | "end" | "io";
};

export type CourseGroup = {
  id: string;
  name: string;
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
  icon: string | null;
  color: string | null;
  order: number;
  hidden: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  labs?: Lab[];
  group?: CourseGroup | null;
  _count?: { labs: number };
};

// The kind of external link a lab can expose.
// "none"    -> no link (default)
// "download" -> a downloadable resource (zip/file), shown with a download icon
// "watch"   -> a watchable resource (video/stream), shown with a play icon
// "browse"  -> a browsable resource (website/page), shown with a globe icon
export type LabLinkType = "none" | "download" | "watch" | "browse";

export type Lab = {
  id: string;
  courseId: string;
  title: string;
  order: number;
  hidden: boolean;
  locked: boolean;
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
  outputCode: string | null;
  outputCodeLang: string | null;
  outputImage: string | null;
  outputImageFileId: string | null;
  outputImageCaption: string | null;
  order: number;
  hidden: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  steps?: Step[];
  _count?: { steps: number };
};

export type CodeSnippet = {
  id: string;
  title?: string;
  lang: string;
  code: string;
};

// A unified content block within a step. Steps store an ordered list of these
// so that descriptions, code snippets, and illustration images can each appear
// multiple times and in any order. "Add" buttons between blocks let the admin
// insert a new block of any type at any position.
export type StepBlock =
  | { type: "description"; id: string; html: string }
  | { type: "snippet"; id: string; lang: string; code: string; title?: string }
  | { type: "image"; id: string; url: string; fileId: string | null; caption: string | null };

export type Step = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  code: string | null;
  codeLang: string | null;
  snippets: CodeSnippet[] | null;
  blocks: StepBlock[] | null;
  image: string | null;
  imageFileId: string | null;
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
