import type { Category } from "@/types/photo";

export const categoryColors: Record<Category, string> = {
  Building: "sunburst",
  Road: "ember",
  Nature: "mint",
  Water: "blue",
  Infrastructure: "violet",
  Landmark: "lavender",
  Agriculture: "mint",
  Other: "lavender",
};

export const categoryIcons: Record<Category, string> = {
  Building: "⌂",
  Road: "↗",
  Nature: "✳",
  Water: "≈",
  Infrastructure: "⌘",
  Landmark: "✦",
  Agriculture: "❋",
  Other: "＋",
};
