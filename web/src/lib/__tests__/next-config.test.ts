import nextConfig from "../../../next.config";

// Vercel's image optimizer has a monthly quota (5,000 on the Hobby plan). Once it is used
// up, /_next/image answers 402 and images break (seen live on 27.11.2026), so images
// are served as they are.
it("serves images without the quota-limited Vercel optimizer", () => {
  expect(nextConfig.images?.unoptimized).toBe(true);
});
