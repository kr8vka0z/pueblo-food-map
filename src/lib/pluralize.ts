// English-only "1 photo" / "2 photos" count labels for the admin screens
// (PublishPanel, BoxesToReviewBox, the Dashboard). Plain module, no "use
// client", so server-rendered pages can call it.
export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
