import type { Metadata } from "next";

// Stage A is reachable by link only until it is approved for the menu.
export const metadata: Metadata = {
  title: "Where2Eat · סטוריז לפי מיקום",
  robots: { index: false, follow: false },
};

export default function StoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
