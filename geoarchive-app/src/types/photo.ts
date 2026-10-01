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
  placeId: string | null;
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
  username?: string | null;
  displayName?: string | null;
};

export type PlaceRecord = {
  id: string;
  createdBy: string | null;
  creatorUsername?: string | null;
  creatorDisplayName?: string | null;
  name: string;
  category: Category;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  description: string;
  visibility: "private" | "public";
  createdAt: string;
};
