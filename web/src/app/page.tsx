import { redirect } from "next/navigation";
import Home from "./home/page";

// The main screen: episode story circles on top, the restaurant feed below. The full-screen
// stories open from a circle (/stories?episode=...) or from the stories button (by location).
// Links shared before this page took over "/" have the form /?story=<id>: they still open
// that place's story.
export default async function FrontPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { story } = await searchParams;
  if (typeof story === "string" && story) redirect(`/stories?story=${encodeURIComponent(story)}`);
  return <Home />;
}
