"use client"

import Masonry from "react-masonry-css"
import { CardSkeleton } from "./card-skeleton"

interface GridSkeletonProps {
  count?: number
}

export function GridSkeleton({ count = 8 }: GridSkeletonProps) {
  const breakpointColumnsObj = {
    default: 4,
    1536: 3,
    1024: 2,
    640: 1
  }

  const aspectRatios: ("square" | "portrait" | "landscape" | "wide")[] = [
    "landscape",
    "portrait",
    "square",
    "wide"
  ]

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="masonry-grid -ml-6"
      columnClassName="masonry-column pl-6"
    >
      {[...Array(count)].map((_, i) => (
        <div key={i} className="mb-6">
          <CardSkeleton aspectRatio={aspectRatios[i % aspectRatios.length]} />
        </div>
      ))}
    </Masonry>
  )
}
