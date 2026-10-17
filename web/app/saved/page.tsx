import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Seçilmişlər" };

export default function SavedPage() {
  return (
    <>
      <header className="page-head">
        <h1>Seçilmişlər</h1>
      </header>
      <SavedList />
    </>
  );
}
