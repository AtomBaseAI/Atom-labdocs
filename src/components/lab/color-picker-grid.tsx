"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Curated text foreground colors (30+ colors)
export const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef",
  "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff",
  "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3",
  "#d9d2e9", "#ead1dc",
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8",
  "#b4a7d6", "#d5a6bd",
];

// Curated highlight / background colors (30+ colors)
export const HIGHLIGHT_COLORS = [
  "#ffffff", "#f3f3f3", "#efefef", "#d9d9d9", "#cccccc", "#b7b7b7", "#999999", "#666666",
  "#434343", "#000000",
  "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff",
  "#ff00ff", "#980000",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3",
  "#d9d2e9", "#ead1dc",
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8",
  "#b4a7d6", "#d5a6bd",
];

type Props = {
  colors: string[];
  selected: string | null | undefined;
  onSelect: (color: string) => void;
  onReset?: () => void;
  className?: string;
};

export function ColorPickerGrid({
  colors,
  selected,
  onSelect,
  onReset,
  className,
}: Props) {
  return (
    <div className={cn("space-y-2 p-2", className)}>
      <div className="grid grid-cols-8 gap-1.5">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onSelect(color)}
            className={cn(
              "h-6 w-6 rounded border transition hover:scale-110",
              selected === color
                ? "ring-2 ring-primary ring-offset-1 border-primary"
                : "border-border"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {onReset && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={onReset}
        >
          <X className="h-3 w-3" /> Remove color
        </Button>
      )}
    </div>
  );
}
