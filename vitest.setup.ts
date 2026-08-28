import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Provide default mock for next/navigation so client components calling useRouter()
// render cleanly in jsdom tests without needing per-file boilerplate.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});
