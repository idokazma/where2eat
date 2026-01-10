"use client"

import { Button } from "@/components/ui/button"
import { LayoutGrid, LayoutList, Grid3x3 } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

export type LayoutMode = "grid" | "masonry" | "list"

interface LayoutToggleProps {
  currentLayout: LayoutMode
  onLayoutChange: (layout: LayoutMode) => void
}

export function LayoutToggle({ currentLayout, onLayoutChange }: LayoutToggleProps) {
  const { t } = useLanguage()

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
      <Button
        variant={currentLayout === "masonry" ? "default" : "ghost"}
        size="sm"
        onClick={() => onLayoutChange("masonry")}
        className="flex items-center gap-2"
      >
        <Grid3x3 className="size-4" />
        <span className="hidden sm:inline">{t('layout.masonry')}</span>
      </Button>
      <Button
        variant={currentLayout === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onLayoutChange("grid")}
        className="flex items-center gap-2"
      >
        <LayoutGrid className="size-4" />
        <span className="hidden sm:inline">{t('layout.grid')}</span>
      </Button>
      <Button
        variant={currentLayout === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => onLayoutChange("list")}
        className="flex items-center gap-2"
      >
        <LayoutList className="size-4" />
        <span className="hidden sm:inline">{t('layout.list')}</span>
      </Button>
    </div>
  )
}
