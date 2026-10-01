import Link from "next/link";
import { LocateFixed } from "lucide-react";

export default function GisToolFab() {
  return (
    <Link className="gis-tool-fab" href="/gis" aria-label="Open GIS tool" title="GIS tool">
      <LocateFixed size={20} aria-hidden="true" />
      <span>GIS tool</span>
    </Link>
  );
}
