import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import DataSourcesPage from "../page";

jest.mock("@/components/layout", () => ({ PageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

it("keeps source, license and change notice on the quiet data-sources page", () => {
  render(<DataSourcesPage />);
  expect(screen.getByRole("link", { name: "GeoNames" })).toHaveAttribute("href", "https://www.geonames.org/");
  expect(screen.getByRole("link", { name: "Creative Commons Attribution 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  expect(screen.getByText(/סינון רשומות/)).toBeInTheDocument();
});
