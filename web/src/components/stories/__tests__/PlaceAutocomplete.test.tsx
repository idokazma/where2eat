import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlaceAutocomplete } from "../PlaceAutocomplete";

it("requires an explicit suggestion and supports keyboard selection", async () => {
  const onSelect = jest.fn();
  render(<PlaceAutocomplete disabled={false} onSelect={onSelect} />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "רעננה" } });
  expect(await screen.findByRole("option", { name: /רעננה/ })).toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(input).toHaveAttribute("aria-activedescendant");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledWith({ lat: 32.1836, lng: 34.87386 });
});

it("labels regions as representative starting points and accepts touch/click", async () => {
  const onSelect = jest.fn();
  render(<PlaceAutocomplete disabled={false} onSelect={onSelect} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "רמת הגולן" } });
  const option = await screen.findByRole("option", { name: /רמת הגולן/ });
  expect(option).toHaveTextContent("נקודת התחלה מייצגת");
  fireEvent.click(option);
  expect(onSelect).toHaveBeenCalledWith({ lat: 32.90485, lng: 35.80725 });
});

it("offers an honest no-match state without an external geocoder request", async () => {
  const oldFetch = global.fetch;
  const fetch = jest.fn();
  global.fetch = fetch;
  const onSelect = jest.fn();
  render(<PlaceAutocomplete disabled={false} onSelect={onSelect} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "איןכזהמקוםבדיקה" } });
  expect(await screen.findByText(/לא נמצא מקום תואם/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveAttribute("aria-expanded", "false");
  expect(onSelect).not.toHaveBeenCalled();
  global.fetch = oldFetch;
});
