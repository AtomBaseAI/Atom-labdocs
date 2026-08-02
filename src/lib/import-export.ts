// Shared types and helpers for the admin content import/export feature.
//
// Export format (version 2):
//   {
//     version: 2,
//     exportedAt: ISO string,
//     type: "full" | "course" | "lab" | "module",
//     source: "atom-labdocs",
//     courseGroups?: CourseGroupExport[],   // only for "full"
//     courses?: CourseExport[],              // only for "full"
//     course?: CourseExport,                 // only for "course"
//     group?: CourseGroupExport | null,      // only for "course"
//     lab?: LabExport,                       // only for "lab"
//     module?: ModuleExport                  // only for "module"
//   }
//
// Design notes:
//  - Version 2 adds standalone "lab" and "module" export types with NO parent
//    references (no course group, course, or lab). These are independently
//    portable — import a module into any lab, a lab into any course.
//  - We deliberately DO NOT export database ids. Imports always create fresh
//    rows with new cuid() ids, so re-importing the same file is idempotent at
//    the row level (it creates duplicates rather than overwriting). This keeps
//    the existing Neon data completely untouched — the user's hard requirement.
//  - Course groups are referenced by NAME on import. When importing a "full"
//    dump, groups are created if missing (matched by name). When importing a
//    single course, the optional `group` block lets the user recreate/attach
//    to a group by name.
//  - Rich-text fields (explanation, overview, output, description, code) are
//    stored verbatim — they are already HTML / plain strings in the schema.
//  - `flow` on Module is a JSON string of FlowNode[]; we pass it through
//    untouched (it is opaque to the import pipeline).
//  - Output code/image fields on Module follow the same pattern as Step fields.

export const EXPORT_VERSION = 2 as const;
export const EXPORT_SOURCE = "atom-labdocs" as const;

export type CourseGroupExport = {
  name: string;
  icon: string | null;
  color: string | null;
  order: number;
};

export type StepExport = {
  title: string;
  description: string | null;
  code: string | null;
  codeLang: string | null;
  snippets: string | null; // JSON string of CodeSnippet[]
  blocks: string | null; // JSON string of StepBlock[]
  image: string | null;
  imageFileId: string | null;
  imageCaption: string | null;
  order: number;
};

export type ModuleExport = {
  title: string;
  explanation: string | null;
  overview: string | null;
  flow: string | null;
  output: string | null;
  outputCode: string | null;
  outputCodeLang: string | null;
  outputImage: string | null;
  outputImageFileId: string | null;
  outputImageCaption: string | null;
  order: number;
  hidden: boolean;
  locked: boolean;
  steps: StepExport[];
};

export type LabExport = {
  title: string;
  order: number;
  hidden: boolean;
  locked: boolean;
  linkType: string;
  linkUrl: string | null;
  modules: ModuleExport[];
};

export type CourseExport = {
  title: string;
  icon: string | null;
  color: string | null;
  order: number;
  hidden: boolean;
  locked: boolean;
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
    }
  | {
      version: typeof EXPORT_VERSION;
      source: typeof EXPORT_SOURCE;
      exportedAt: string;
      type: "lab";
      lab: LabExport;
    }
  | {
      version: typeof EXPORT_VERSION;
      source: typeof EXPORT_SOURCE;
      exportedAt: string;
      type: "module";
      module: ModuleExport;
    };

// ---- Serialization (DB rows -> export shape) ----

export function serializeCourseGroup(
  g: {
    name: string;
    icon: string | null;
    color: string | null;
    order: number;
  }
): CourseGroupExport {
  return {
    name: g.name,
    icon: g.icon,
    color: g.color,
    order: g.order,
  };
}

export function serializeStep(
  s: {
    title: string;
    description: string | null;
    code: string | null;
    codeLang: string | null;
    snippets: string | null;
    blocks: string | null;
    image: string | null;
    imageFileId: string | null;
    imageCaption: string | null;
    order: number;
  }
): StepExport {
  return {
    title: s.title,
    description: s.description,
    code: s.code,
    codeLang: s.codeLang,
    snippets: s.snippets,
    blocks: s.blocks,
    image: s.image,
    imageFileId: s.imageFileId,
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
    outputCode: string | null;
    outputCodeLang: string | null;
    outputImage: string | null;
    outputImageFileId: string | null;
    outputImageCaption: string | null;
    order: number;
    hidden: boolean;
    locked: boolean;
    steps: ReturnType<typeof serializeStep>[];
  }
): ModuleExport {
  return {
    title: m.title,
    explanation: m.explanation,
    overview: m.overview,
    flow: m.flow,
    output: m.output,
    outputCode: m.outputCode,
    outputCodeLang: m.outputCodeLang,
    outputImage: m.outputImage,
    outputImageFileId: m.outputImageFileId,
    outputImageCaption: m.outputImageCaption,
    order: m.order,
    hidden: m.hidden,
    locked: m.locked,
    steps: m.steps,
  };
}

export function serializeLab(
  l: {
    title: string;
    order: number;
    hidden: boolean;
    locked: boolean;
    linkType: string;
    linkUrl: string | null;
    modules: ReturnType<typeof serializeModule>[];
  }
): LabExport {
  return {
    title: l.title,
    order: l.order,
    hidden: l.hidden,
    locked: l.locked,
    linkType: l.linkType,
    linkUrl: l.linkUrl,
    modules: l.modules,
  };
}

export function serializeCourse(
  c: {
    title: string;
    icon: string | null;
    color: string | null;
    order: number;
    hidden: boolean;
    locked: boolean;
    labs: ReturnType<typeof serializeLab>[];
  },
  groupName: string | null
): CourseExport {
  return {
    title: c.title,
    icon: c.icon,
    color: c.color,
    order: c.order,
    hidden: c.hidden,
    locked: c.locked,
    groupName,
    labs: c.labs,
  };
}

// ---- Validation (import shape -> safe Prisma input) ----

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
    snippets: isStrOrNull(o.snippets) ? o.snippets : null,
    blocks: isStrOrNull(o.blocks) ? o.blocks : null,
    image: isStrOrNull(o.image) ? o.image : null,
    imageFileId: isStrOrNull(o.imageFileId) ? o.imageFileId : null,
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
    outputCode: isStrOrNull(o.outputCode) ? o.outputCode : null,
    outputCodeLang: isStrOrNull(o.outputCodeLang) ? o.outputCodeLang : null,
    outputImage: isStrOrNull(o.outputImage) ? o.outputImage : null,
    outputImageFileId: isStrOrNull(o.outputImageFileId) ? o.outputImageFileId : null,
    outputImageCaption: isStrOrNull(o.outputImageCaption) ? o.outputImageCaption : null,
    order: isNum(o.order) ? o.order : idx,
    hidden: isBool(o.hidden) ? o.hidden : false,
    locked: isBool(o.locked) ? o.locked : false,
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
    order: isNum(o.order) ? o.order : idx,
    hidden: isBool(o.hidden) ? o.hidden : false,
    locked: isBool(o.locked) ? o.locked : false,
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
    icon: isStrOrNull(o.icon) ? o.icon : null,
    color: isStrOrNull(o.color) ? o.color : null,
    order: isNum(o.order) ? o.order : idx,
    hidden: isBool(o.hidden) ? o.hidden : false,
    locked: isBool(o.locked) ? o.locked : false,
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
    icon: isStrOrNull(o.icon) ? o.icon : null,
    color: isStrOrNull(o.color) ? o.color : null,
    order: isNum(o.order) ? o.order : idx,
  };
}

// Top-level export-file parser. Returns a discriminated union or throws a
// descriptive Error so the API route can surface a useful 400 message.
// Supports version 1 and 2 for backward compatibility.
export function parseExportFile(raw: unknown): ExportFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Export file must be a JSON object.");
  }
  const o = raw as Record<string, unknown>;
  // Accept both v1 and v2
  if (o.version !== 1 && o.version !== EXPORT_VERSION) {
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

  if (o.type === "module") {
    const modExport = parseModuleExport(o.module, 0);
    if (!modExport) {
      throw new Error("Export file is missing a valid module object.");
    }
    return {
      version: EXPORT_VERSION,
      source: EXPORT_SOURCE,
      exportedAt: o.exportedAt,
      type: "module",
      module: modExport,
    };
  }

  if (o.type === "lab") {
    const lab = parseLabExport(o.lab, 0);
    if (!lab) {
      throw new Error("Export file is missing a valid lab object.");
    }
    return {
      version: EXPORT_VERSION,
      source: EXPORT_SOURCE,
      exportedAt: o.exportedAt,
      type: "lab",
      lab,
    };
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
    `Unknown export type "${String(o.type)}". Expected "full", "course", "lab", or "module".`
  );
}
