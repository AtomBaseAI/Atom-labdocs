// Shared types and helpers for the admin content import/export feature.
//
// Export format (version 1):
//   {
//     version: 1,
//     exportedAt: ISO string,
//     type: "full" | "course",
//     source: "atom-labdocs",
//     courseGroups?: CourseGroupExport[],   // only for "full"
//     courses?: CourseExport[],              // only for "full"
//     course?: CourseExport,                 // only for "course"
//     group?: CourseGroupExport | null       // only for "course" — the parent group, if any
//   }
//
// Design notes:
//  - We deliberately DO NOT export database ids. Imports always create fresh
//    rows with new cuid() ids, so re-importing the same file is idempotent at
//    the row level (it creates duplicates rather than overwriting). This keeps
//    the existing Neon data completely untouched — the user's hard requirement.
//  - Course groups are referenced by NAME on import. When importing a "full"
//    dump, groups are created if missing (matched by name). When importing a
//    single course, the optional `group` block lets the user recreate/attach
//    to a group by name.
//  - Rich-text fields (explanation, overview, output, conclusion, description,
//    code) are stored verbatim — they are already HTML / plain strings in the
//    schema.
//  - `flow` on Module is a JSON string of FlowNode[]; we pass it through
//    untouched (it is opaque to the import pipeline).

export const EXPORT_VERSION = 1 as const;
export const EXPORT_SOURCE = "atom-labdocs" as const;

export type CourseGroupExport = {
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
};

export type StepExport = {
  title: string;
  description: string | null;
  code: string | null;
  codeLang: string | null;
  image: string | null;
  imageCaption: string | null;
  order: number;
};

export type ModuleExport = {
  title: string;
  explanation: string | null;
  overview: string | null;
  flow: string | null;
  output: string | null;
  conclusion: string | null;
  order: number;
  hidden: boolean;
  steps: StepExport[];
};

export type LabExport = {
  title: string;
  description: string | null;
  order: number;
  hidden: boolean;
  linkType: string;
  linkUrl: string | null;
  modules: ModuleExport[];
};

export type CourseExport = {
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  hidden: boolean;
  // Group reference by name (optional). For "full" exports this is the group
  // name at export time; for "course" exports the parent group block is also
  // included separately so its color/icon can be recreated.
  groupName: string | null;
  labs: LabExport[];
};

export type ExportFile =
  | {
      version: typeof EXPORT_VERSION;
      source: typeof EXPORT_SOURCE;
      exportedAt: string;
      type: "full";
      courseGroups: CourseGroupExport[];
      courses: CourseExport[];
    }
  | {
      version: typeof EXPORT_VERSION;
      source: typeof EXPORT_SOURCE;
      exportedAt: string;
      type: "course";
      course: CourseExport;
      group: CourseGroupExport | null;
    };

// ---- Serialization (DB rows -> export shape) ----

// Strip a CourseGroup row down to its portable export shape (no ids, no
// timestamps). `order` is preserved so an imported dump keeps the same
// visual ordering.
export function serializeCourseGroup(
  g: {
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    order: number;
  }
): CourseGroupExport {
  return {
    name: g.name,
    description: g.description,
    icon: g.icon,
    color: g.color,
    order: g.order,
  };
}

// Strip a Step row down to its portable export shape.
export function serializeStep(
  s: {
    title: string;
    description: string | null;
    code: string | null;
    codeLang: string | null;
    image: string | null;
    imageCaption: string | null;
    order: number;
  }
): StepExport {
  return {
    title: s.title,
    description: s.description,
    code: s.code,
    codeLang: s.codeLang,
    image: s.image,
    imageCaption: s.imageCaption,
    order: s.order,
  };
}

export function serializeModule(
  m: {
    title: string;
    explanation: string | null;
    overview: string | null;
    flow: string | null;
    output: string | null;
    conclusion: string | null;
    order: number;
    hidden: boolean;
    steps: ReturnType<typeof serializeStep>[];
  }
): ModuleExport {
  return {
    title: m.title,
    explanation: m.explanation,
    overview: m.overview,
    flow: m.flow,
    output: m.output,
    conclusion: m.conclusion,
    order: m.order,
    hidden: m.hidden,
    steps: m.steps,
  };
}

export function serializeLab(
  l: {
    title: string;
    description: string | null;
    order: number;
    hidden: boolean;
    linkType: string;
    linkUrl: string | null;
    modules: ReturnType<typeof serializeModule>[];
  }
): LabExport {
  return {
    title: l.title,
    description: l.description,
    order: l.order,
    hidden: l.hidden,
    linkType: l.linkType,
    linkUrl: l.linkUrl,
    modules: l.modules,
  };
}

export function serializeCourse(
  c: {
    title: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    order: number;
    hidden: boolean;
    labs: ReturnType<typeof serializeLab>[];
  },
  groupName: string | null
): CourseExport {
  return {
    title: c.title,
    description: c.description,
    icon: c.icon,
    color: c.color,
    order: c.order,
    hidden: c.hidden,
    groupName,
    labs: c.labs,
  };
}

// ---- Validation (import shape -> safe Prisma input) ----

// Type guards so the import API never trusts raw JSON. Each guard narrows the
// unknown input and strips unexpected keys, returning null on any mismatch.

function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isNull(v: unknown): v is null {
  return v === null;
}
function isStrOrNull(v: unknown): v is string | null {
  return isStr(v) || isNull(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isArr(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

export function parseStepExport(v: unknown, idx: number): StepExport | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.title)) return null;
  return {
    title: o.title.trim(),
    description: isStrOrNull(o.description) ? o.description : null,
    code: isStrOrNull(o.code) ? o.code : null,
    codeLang: isStrOrNull(o.codeLang) ? o.codeLang : null,
    image: isStrOrNull(o.image) ? o.image : null,
    imageCaption: isStrOrNull(o.imageCaption) ? o.imageCaption : null,
    order: isNum(o.order) ? o.order : idx,
  };
}

export function parseModuleExport(v: unknown, idx: number): ModuleExport | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.title)) return null;
  const stepsRaw = isArr(o.steps) ? o.steps : [];
  const steps: StepExport[] = [];
  for (let i = 0; i < stepsRaw.length; i++) {
    const s = parseStepExport(stepsRaw[i], i);
    if (s) steps.push(s);
  }
  return {
    title: o.title.trim(),
    explanation: isStrOrNull(o.explanation) ? o.explanation : null,
    overview: isStrOrNull(o.overview) ? o.overview : null,
    flow: isStrOrNull(o.flow) ? o.flow : null,
    output: isStrOrNull(o.output) ? o.output : null,
    conclusion: isStrOrNull(o.conclusion) ? o.conclusion : null,
    order: isNum(o.order) ? o.order : idx,
    hidden: isBool(o.hidden) ? o.hidden : false,
    steps,
  };
}

export function parseLabExport(v: unknown, idx: number): LabExport | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.title)) return null;
  const modulesRaw = isArr(o.modules) ? o.modules : [];
  const modules: ModuleExport[] = [];
  for (let i = 0; i < modulesRaw.length; i++) {
    const m = parseModuleExport(modulesRaw[i], i);
    if (m) modules.push(m);
  }
  return {
    title: o.title.trim(),
    description: isStrOrNull(o.description) ? o.description : null,
    order: isNum(o.order) ? o.order : idx,
    hidden: isBool(o.hidden) ? o.hidden : false,
    linkType: isStr(o.linkType) ? o.linkType : "none",
    linkUrl: isStrOrNull(o.linkUrl) ? o.linkUrl : null,
    modules,
  };
}

export function parseCourseExport(v: unknown, idx: number): CourseExport | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.title)) return null;
  const labsRaw = isArr(o.labs) ? o.labs : [];
  const labs: LabExport[] = [];
  for (let i = 0; i < labsRaw.length; i++) {
    const l = parseLabExport(labsRaw[i], i);
    if (l) labs.push(l);
  }
  return {
    title: o.title.trim(),
    description: isStrOrNull(o.description) ? o.description : null,
    icon: isStrOrNull(o.icon) ? o.icon : null,
    color: isStrOrNull(o.color) ? o.color : null,
    order: isNum(o.order) ? o.order : idx,
    hidden: isBool(o.hidden) ? o.hidden : false,
    groupName: isStrOrNull(o.groupName) ? (o.groupName ? o.groupName.trim() || null : null) : null,
    labs,
  };
}

export function parseCourseGroupExport(
  v: unknown,
  idx: number
): CourseGroupExport | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.name)) return null;
  return {
    name: o.name.trim(),
    description: isStrOrNull(o.description) ? o.description : null,
    icon: isStrOrNull(o.icon) ? o.icon : null,
    color: isStrOrNull(o.color) ? o.color : null,
    order: isNum(o.order) ? o.order : idx,
  };
}

// Top-level export-file parser. Returns a discriminated union or throws a
// descriptive Error so the API route can surface a useful 400 message.
export function parseExportFile(raw: unknown): ExportFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Export file must be a JSON object.");
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== EXPORT_VERSION) {
    throw new Error(
      `Unsupported export version. Expected ${EXPORT_VERSION}, got ${String(o.version)}.`
    );
  }
  if (o.source !== EXPORT_SOURCE) {
    throw new Error(
      `Unrecognized export source "${String(o.source)}". Expected "${EXPORT_SOURCE}".`
    );
  }
  if (!isStr(o.exportedAt)) {
    throw new Error("Export file is missing an exportedAt timestamp.");
  }
  if (o.type === "full") {
    const courseGroupsRaw = isArr(o.courseGroups) ? o.courseGroups : [];
    const courseGroups: CourseGroupExport[] = [];
    for (let i = 0; i < courseGroupsRaw.length; i++) {
      const g = parseCourseGroupExport(courseGroupsRaw[i], i);
      if (g) courseGroups.push(g);
    }
    const coursesRaw = isArr(o.courses) ? o.courses : [];
    const courses: CourseExport[] = [];
    for (let i = 0; i < coursesRaw.length; i++) {
      const c = parseCourseExport(coursesRaw[i], i);
      if (c) courses.push(c);
    }
    return {
      version: EXPORT_VERSION,
      source: EXPORT_SOURCE,
      exportedAt: o.exportedAt,
      type: "full",
      courseGroups,
      courses,
    };
  }
  if (o.type === "course") {
    const course = parseCourseExport(o.course, 0);
    if (!course) {
      throw new Error("Export file is missing a valid course object.");
    }
    const group =
      o.group === null || o.group === undefined
        ? null
        : parseCourseGroupExport(o.group, 0);
    return {
      version: EXPORT_VERSION,
      source: EXPORT_SOURCE,
      exportedAt: o.exportedAt,
      type: "course",
      course,
      group,
    };
  }
  throw new Error(
    `Unknown export type "${String(o.type)}". Expected "full" or "course".`
  );
}
