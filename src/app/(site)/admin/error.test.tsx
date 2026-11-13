/**
 * Admin error page: Try again asks the server for the page again (a full
 * reload: see error.tsx for why not reset), and the error's own text never
 * reaches the screen.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminError from "@/app/(site)/admin/error";

const realLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("admin error page", () => {
  test("Try again reloads the page; the error text is never shown", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, reload } });
    const user = userEvent.setup();
    // The framework passes the thrown error; the page must ignore it.
    const Page = AdminError as unknown as (props: { error: unknown; reset: () => void }) => React.ReactElement;
    render(<Page error={new Error("D1_ERROR: no such table venues_secret")} reset={vi.fn()} />);

    expect(document.body.textContent).not.toMatch(/D1_ERROR|venues_secret/);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
