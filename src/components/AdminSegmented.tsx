"use client";

/**
 * AdminSegmented — the admin's slider for a two- or three-way choice
 * (#926 decision 10; four or more options stay a select). Real radios, so
 * the browser gives the arrow keys, the group name and the checked state.
 *
 * Props (controlled):
 *   name      the radios' shared name
 *   legend    the group's name, read by screen readers (visually hidden)
 *   options   { value, label }[], 2 or 3 of them
 *   value     the chosen value
 *   onChange  called with the newly chosen value
 *
 * The look is LanguageToggle's (src/components/LanguageToggle.tsx): a bone
 * 200 track, here fully round; a sage 600 thumb behind the chosen word that
 * slides in 250 ms on --ease-out-circ (still under reduced motion); bone 50
 * words on the thumb, ink 700 off it with the sage 100 hover; 14 px
 * semibold. Each segment is 40 tall inside the track's 4 px padding, and its
 * ::before reaches over that padding, so the tap area is 48 tall and the
 * whole slider is 48 tall (LanguageToggle's #233 pattern), not 56.
 * The keyboard ring shows on the segment whose radio has focus-visible.
 */

import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

type AdminSegmentedProps = {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
};

// Full literals so Tailwind's scanner sees them: columns and thumb width by
// option count, thumb position by index (translate % is of the thumb's own
// width, which is one column).
const COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3" };
const THUMB_WIDTH: Record<number, string> = { 2: "w-[calc((100%-8px)/2)]", 3: "w-[calc((100%-8px)/3)]" };
const THUMB_AT = ["translate-x-0", "translate-x-full", "translate-x-[200%]"];

const SEGMENT_CLASS =
  "relative flex h-[40px] cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-4 " +
  "text-sm font-semibold leading-[20px] transition-colors duration-250 ease-out-circ motion-reduce:transition-none " +
  "before:absolute before:inset-x-0 before:-inset-y-1 " +
  PRESS_FEEDBACK +
  " has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-sage-500)] " +
  "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--color-bone-200)] ";

export default function AdminSegmented({ name, legend, options, value, onChange }: AdminSegmentedProps) {
  const n = options.length;
  const at = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className={"relative inline-grid rounded-full bg-[var(--color-bone-200)] p-1 " + (COLS[n] ?? "grid-flow-col")}>
        <span
          aria-hidden
          className={
            "pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-[var(--color-sage-600)] " +
            "shadow-[0_2px_6px_rgba(26,24,23,0.25)] transition-transform duration-250 ease-out-circ motion-reduce:transition-none " +
            (THUMB_WIDTH[n] ?? "hidden") +
            " " +
            (THUMB_AT[at] ?? "translate-x-0")
          }
        />
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={
                SEGMENT_CLASS +
                (on ? "text-[var(--color-bone-50)]" : "text-[var(--color-ink-700)] hover:bg-[var(--color-sage-100)]")
              }
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
