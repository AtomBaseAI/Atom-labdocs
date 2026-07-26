"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (rows: number, cols: number) => void;
};

export function TableCreateDialog({ open, onOpenChange, onInsert }: Props) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const handleInsert = () => {
    const r = Math.max(1, Math.min(10, rows));
    const c = Math.max(1, Math.min(10, cols));
    onInsert(r, c);
    onOpenChange(false);
    // Reset defaults after insert
    setRows(3);
    setCols(3);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>Insert Table</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="table-rows" className="text-xs">Rows</Label>
              <Input
                id="table-rows"
                type="number"
                min={1}
                max={10}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="h-8"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="table-cols" className="text-xs">Columns</Label>
              <Input
                id="table-cols"
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                className="h-8"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Range: 1–10 for both rows and columns.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
