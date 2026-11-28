import { Suspense } from "react";
import { StoriesView } from "@/components/stories/StoriesView";

/** Extra Google photos per visit (paid, loaded only when viewed). 0 turns them off. */
const limit = Number(process.env.NEXT_PUBLIC_STORIES_EXTRA_PHOTO_LIMIT ?? 40);

export default function StoriesPage() {
  return (
    <Suspense>
      <StoriesView extraPhotoLimit={Number.isFinite(limit) && limit >= 0 ? limit : 40} />
    </Suspense>
  );
}
