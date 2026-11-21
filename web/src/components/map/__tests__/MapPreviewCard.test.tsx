import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapPreviewCard } from "../MapPreviewCard";
import type { Restaurant } from "@/types/restaurant";
const restaurant: Restaurant = {
  id: "1",
  image_url: "https://example.com/photo.jpg",
  name_hebrew: "מסעדה אמיתית",
  engaging_quote: "היה טעים",
  episode_info: {
    video_id: "video",
    video_url: "",
    channel_name: "התוכנית",
    title: "פרק ראשון",
  },
  mentions: [{ video_id: "video", speaker: "דנה" }],
};
const props = {
  restaurant,
  saved: false,
  onSave: jest.fn(),
  onDismiss: jest.fn(),
  onPrevious: jest.fn(),
  onNext: jest.fn(),
  count: 2,
  position: 0,
};
it("keeps person and publisher separate without inventing a portrait", () => {
  render(<MapPreviewCard {...props} />);
  expect(screen.getByText("דנה")).toBeInTheDocument();
  expect(screen.getByText("התוכנית")).toBeInTheDocument();
  expect(screen.getByLabelText("סמל ממליץ, לא תמונה")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "לביקורת ↗" })).toHaveAttribute(
    "href",
    "/restaurant/1",
  );
});
it("falls back when a photo fails and provides working save, dismiss and navigation controls", () => {
  render(<MapPreviewCard {...props} />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText("אין תמונה זמינה")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "שמירת המסעדה" }));
  fireEvent.click(screen.getByRole("button", { name: "סגירת פרטי המסעדה" }));
  fireEvent.click(screen.getByRole("button", { name: "המסעדה הבאה" }));
  expect(props.onSave).toHaveBeenCalledTimes(1);
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(props.onNext).toHaveBeenCalledTimes(1);
});
it("does not invent a reviewer or a review link with missing data", () => {
  render(
    <MapPreviewCard
      {...props}
      restaurant={{ name_hebrew: "ללא מקור" }}
      count={1}
    />,
  );
  expect(screen.getByText("מקור לא צוין")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "המסעדה הבאה" })).toBeDisabled();
});

it("links to the restaurant's stored Instagram profile in a separate tab", () => {
  const onSave = jest.fn();
  render(
    <MapPreviewCard
      {...props}
      onSave={onSave}
      restaurant={{
        ...restaurant,
        instagram_url: "https://www.instagram.com/example_restaurant/",
      }}
    />,
  );
  const link = screen.getByRole("link", { name: /אינסטגרם של מסעדה אמיתית/ });
  expect(link).toHaveAttribute(
    "href",
    "https://www.instagram.com/example_restaurant/",
  );
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  fireEvent.click(screen.getByRole("button", { name: "שמירת המסעדה" }));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "לביקורת ↗" })).toBeInTheDocument();
});

it.each([
  undefined,
  null,
  "",
  "javascript:alert(1)",
  "https://www.instagram.com/p/post/",
])(
  "hides the Instagram action when the restaurant profile is missing or invalid: %s",
  (instagram_url) => {
    render(
      <MapPreviewCard
        {...props}
        restaurant={{ ...restaurant, instagram_url }}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /אינסטגרם/ }),
    ).not.toBeInTheDocument();
  },
);

it("updates the Instagram action when navigating between restaurants", () => {
  const { rerender } = render(
    <MapPreviewCard
      {...props}
      restaurant={{
        ...restaurant,
        instagram_url: "https://www.instagram.com/example_restaurant/",
      }}
    />,
  );
  rerender(
    <MapPreviewCard {...props} restaurant={{ ...restaurant, id: "2" }} />,
  );
  expect(
    screen.queryByRole("link", { name: /אינסטגרם/ }),
  ).not.toBeInTheDocument();
});
