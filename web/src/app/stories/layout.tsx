import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Where2Eat · סטוריז לפי מיקום",
};

export default function StoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
