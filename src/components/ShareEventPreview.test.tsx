/**
 * The "Share an event" live preview (#883, spec Proof): with the form empty,
 * the real event card shows a placeholder for every empty field and a faded,
 * non-link action button and Get directions, and none of the real-event
 * actions; typed values replace the placeholders.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { t } from "@/lib/i18n";
import ShareEventPreview from "@/components/ShareEventPreview";
import type { ShareEventValues } from "@/components/ShareEventForm";

const EMPTY: ShareEventValues = {
  name: "", host: "", date: "", start: "", end: "", description: "", whatToBring: "",
  venueName: "", address: "", linkUrl: "", linkLabel: "website",
};
const PLACEHOLDERS = ["name", "host", "when", "about", "where"].map((k) => t(`events.card.preview.${k}`, "en"));

describe("ShareEventPreview", () => {
  test("an empty form shows a placeholder for each field, a faded non-link button and directions, and no real-event actions", () => {
    render(<ShareEventPreview values={EMPTY} flyer={null} locale="en" />);
    for (const text of PLACEHOLDERS) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByTestId("event-action-placeholder")).toHaveTextContent(t("events.card.preview.link", "en"));
    expect(screen.queryByTestId("event-action")).toBeNull();
    expect(screen.getByTestId("event-directions-preview").className).toContain("opacity-45");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: t("events.card.share", "en") })).toBeNull();
    expect(screen.queryByTestId("event-badge")).toBeNull();
  });

  test("filled fields replace the placeholders, and an address un-fades directions", () => {
    render(
      <ShareEventPreview
        values={{
          ...EMPTY,
          name: "Turkey Giveaway",
          host: "Pueblo Food Project",
          date: "2099-11-22",
          start: "10:00",
          end: "13:00",
          description: "Free turkeys.",
          address: "1 Main St, Pueblo",
          linkUrl: "https://example.org/rsvp",
          linkLabel: "rsvp",
        }}
        flyer={null}
        locale="en"
      />,
    );
    for (const text of PLACEHOLDERS) expect(screen.queryByText(text)).toBeNull();
    expect(screen.getByTestId("event-action")).toHaveAttribute("href", "https://example.org/rsvp");
    expect(screen.getByTestId("event-directions-preview").className).not.toContain("opacity-45");
    expect(screen.getByTestId("event-badge")).toBeInTheDocument();
  });
});
