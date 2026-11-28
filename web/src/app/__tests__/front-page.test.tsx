const redirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import FrontPage from "../page";

beforeEach(() => redirect.mockClear());

// Links shared before the home page took over "/" have the form /?story=<id>.
it("sends an old shared link (/?story=<id>) to that place's story", async () => {
  await FrontPage({ searchParams: Promise.resolve({ story: "abc 1" }) });
  expect(redirect).toHaveBeenCalledWith("/stories?story=abc%201");
});

it("shows the home page otherwise", async () => {
  const page = await FrontPage({ searchParams: Promise.resolve({}) });
  expect(redirect).not.toHaveBeenCalled();
  expect(page).toBeTruthy();
});
