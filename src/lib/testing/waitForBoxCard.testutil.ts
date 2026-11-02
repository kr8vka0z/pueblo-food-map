// waitForBoxCard.testutil.ts — test helper: wait until the lazily loaded box card has replaced its "Loading…" line.
//
// WHY: since #721 BottomSheet and DesktopVenueWindow load BoxCardBody with next/dynamic, so a freshly rendered box
// card first shows the "box.cardLoading" line and the real card a tick later. Tests that read the card call this
// once after render (or after the tap that reveals the card) instead of querying synchronously.
import { screen, waitFor } from "@testing-library/react";
import { t } from "@/lib/i18n";

export async function waitForBoxCard(): Promise<void> {
  await waitFor(() => {
    for (const locale of ["en", "es"] as const) {
      if (screen.queryByText(t("box.cardLoading", locale))) throw new Error("box card still loading");
    }
  });
}
