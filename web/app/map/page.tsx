import type { Metadata } from "next";
import { MapView } from "@/components/MapView";

export const metadata: Metadata = { title: "Xəritə" };

export default function MapPage() {
  return (
    <div className="map-page">
      <header className="page-head map-head">
        <h1>Xəritə</h1>
        <p>Yaxınlığınızdakı satış elanları. Yeriniz yalnız brauzerinizdə qalır.</p>
      </header>
      <MapView />
    </div>
  );
}
