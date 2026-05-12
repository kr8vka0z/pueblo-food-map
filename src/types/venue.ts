export type VenueCategory =
  | "pantry"
  | "grocery"
  | "convenience"
  | "farm"
  | "garden"
  | "edible_landscape"
  | "meal_site";

export type WeeklyHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string[]>
>;

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  lat: number;
  lng: number;
  address: string;
  hours_weekly?: WeeklyHours;
  accepts_snap?: boolean;
  accepts_wic?: boolean;
  phone?: string;
  email?: string;
  url?: string;
  notes?: string;
  source: string;
  last_verified: string;
}
