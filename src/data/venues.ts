import type { Venue } from "@/types/venue";
import { publishedVenues } from "@/data/published-venues";

// Public venue list, straight from the last published snapshot (see
// published-venues.ts's header); D1 is the sole SNAP/WIC source (#597).
export const venues: Venue[] = publishedVenues;

// Labels and colors live in src/lib/categories.ts (#721) so a browser
// component that only needs a color never downloads this venue list. The
// re-export keeps server-side callers on one import.
export { categoryLabels, categoryColors } from "@/lib/categories";
