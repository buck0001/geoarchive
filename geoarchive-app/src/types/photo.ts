export const categories = [
  "Building",
  "Road",
  "Nature",
  "Water",
  "Infrastructure",
  "Landmark",
  "Agriculture",
  "Other",
] as const;

export type Category = (typeof categories)[number];

export type PhotoRecord = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: Category;
  imageUrl: string;
  imagePath: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  locationPrecision: "exact" | "approximate" | "none";
  visibility: "private" | "public";
  createdAt: string;
};
