/**
 * BottomSheet `forceExpanded` (#159 guided tour): true holds the card open,
 * false folds it, undefined (every normal render) leaves the grab bar in
 * charge. Same mocked-vaul recipe as the other BottomSheet tests (vaul needs
 * a real portal/animation context jsdom lacks).
 */
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";

vi.mock("vaul", () => {
  const DrawerRoot = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="vaul-root">{children}</div> : null;
  const DrawerPortal = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DrawerContent = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="vaul-content" {...rest}>{children}</div>
  );
  const DrawerTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const DrawerDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
  return { Drawer: { Root: DrawerRoot, Portal: DrawerPortal, Content: DrawerContent, Title: DrawerTitle, Description: DrawerDescription } };
});

const VENUE: Venue & { distanceMiles?: number } = {
  id: "test-venue-force",
  name: "Pueblo Test Pantry",
  category: "pantry",
  lat: 38.2544,
  lng: -104.6091,
  address: "123 Main St, Pueblo, CO 81003",
  source: "test",
  last_verified: "2026-01-01",
};

/** The grab bar is the one control carrying the sheet's expanded state. */
const grabBar = () => document.querySelector<HTMLButtonElement>("button[aria-controls][aria-expanded]")!;

describe("BottomSheet forceExpanded", () => {
  test("true expands the card (and reports it), false folds it back", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <BottomSheet venue={VENUE} onClose={() => {}} onExpandedChange={onExpandedChange} forceExpanded />,
    );
    expect(grabBar().getAttribute("aria-expanded")).toBe("true");
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);
    rerender(<BottomSheet venue={VENUE} onClose={() => {}} onExpandedChange={onExpandedChange} forceExpanded={false} />);
    expect(grabBar().getAttribute("aria-expanded")).toBe("false");
  });

  test("undefined is a no-op: the card stays as the grab bar left it", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(<BottomSheet venue={VENUE} onClose={() => {}} onExpandedChange={onExpandedChange} />);
    expect(grabBar().getAttribute("aria-expanded")).toBe("false");
    expect(onExpandedChange).not.toHaveBeenCalled();

    fireEvent.click(grabBar());
    expect(grabBar().getAttribute("aria-expanded")).toBe("true");
    rerender(<BottomSheet venue={VENUE} onClose={() => {}} onExpandedChange={onExpandedChange} />);
    expect(grabBar().getAttribute("aria-expanded")).toBe("true");
  });

  test("inert reaches the card container", () => {
    render(<BottomSheet venue={VENUE} onClose={() => {}} inert />);
    expect(screen.getByTestId("vaul-content").hasAttribute("inert")).toBe(true);
  });
});
