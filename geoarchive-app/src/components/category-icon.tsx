import { categoryIcons } from "@/lib/photo-style";
import type { Category } from "@/types/photo";

type CategoryIconProps = {
  category: Category;
  size?: number;
  className?: string;
};

export default function CategoryIcon({ category, size = 13, className }: CategoryIconProps) {
  const Icon = categoryIcons[category];
  return <Icon size={size} className={className} aria-hidden="true" />;
}