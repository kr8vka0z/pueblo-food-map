import MapWrapper from "@/components/MapWrapper";

/**
 * Root page — thin shell that hands off entirely to MapWrapper.
 * Top bar, layout, search, filters, and map all live in MapWrapper.
 */
export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col min-h-0">
      <MapWrapper />
    </main>
  );
}
