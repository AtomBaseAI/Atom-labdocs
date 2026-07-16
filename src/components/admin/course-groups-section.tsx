"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import type { CourseGroup } from "@/lib/types";
import { FolderPlus, Pencil, Trash2, MoreVertical, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const GROUP_EMOJIS = ["📁", "📚", "🗂️", "🗃️", "📦", "🏷️", "🧩", "🎨", "⚙️", "🧱"];
const GROUP_COLORS = ["#0d9488", "#0891b2", "#7c3aed", "#c026d3", "#db2777", "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0f766e"];

export function CourseGroupsSection() {
  const qc = useQueryClient();
  const groupsQuery = useQuery({
    queryKey: ["admin-course-groups"],
    queryFn: () => fetchJson<CourseGroup[]>("/api/course-groups"),
  });

  const [delId, setDelId] = useState<string | null>(null);
  const delMut = useMutation({
    mutationFn: (id: string) => fetch("/api/course-groups/" + id, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-groups"] });
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: "Course group deleted" });
      setDelId(null);
    },
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Course Groups</h2>
          <span className="text-xs text-muted-foreground">
            ({groupsQuery.data?.length ?? 0})
          </span>
        </div>
        <CreateGroupDialog />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Group courses for organizing and sorting. Courses can be assigned to a group when creating them.
      </p>
      {groupsQuery.isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : groupsQuery.data && groupsQuery.data.length > 0 ? (
        <div className="space-y-2">
          {groupsQuery.data.map((group) => (
            <div
              key={group.id}
              className="flex items-center gap-3 rounded-lg border p-2.5 transition hover:bg-muted/30"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ background: (group.color ?? "#0d9488") + "22" }}
              >
                {group.icon ?? "📁"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{group.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {group.description || "No description"} · {group._count?.courses ?? 0} courses
                </p>
              </div>
              <EditGroupDialog group={group} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      setDelId(group.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <FolderPlus className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No course groups yet. Create one to organize your courses.
          </p>
        </div>
      )}

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course group?</AlertDialogTitle>
            <AlertDialogDescription>
              Courses in this group will be unassigned (not deleted). This won&apos;t affect the courses themselves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => delId && delMut.mutate(delId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CreateGroupDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(GROUP_EMOJIS[0]);
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/course-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon, color }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-groups"] });
      toast({ title: "Course group created" });
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: () => {
      toast({ title: "Failed to create group", variant: "destructive" });
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <FolderPlus className="h-4 w-4" /> New Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create course group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Programming Labs" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUP_EMOJIS.map((e) => (
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
          <div>
            <Label>Accent color</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    color === c ? "border-foreground" : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditGroupDialog({ group }: { group: CourseGroup }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [icon, setIcon] = useState(group.icon ?? GROUP_EMOJIS[0]);
  const [color, setColor] = useState(group.color ?? GROUP_COLORS[0]);
  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/course-groups/" + group.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon, color }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-groups"] });
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      toast({ title: "Course group updated" });
      setOpen(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setOpen(true)}
        title="Edit group"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit course group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUP_EMOJIS.map((e) => (
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
          <div>
            <Label>Accent color</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    color === c ? "border-foreground" : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
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
