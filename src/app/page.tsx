import MapWrapper from "@/components/MapWrapper";
import { venues, categoryLabels, categoryColors } from "@/data/venues";

export default function HomePage() {
  const categoryCounts = venues.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">
          Pueblo Food Access Map
        </h1>
        <p className="text-xs text-gray-500">
          Proof of concept · {venues.length} venues · Pueblo Food Project
        </p>
      </header>

      <div className="flex flex-wrap gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs">
        {Object.entries(categoryCounts).map(([cat, count]) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                backgroundColor:
                  categoryColors[cat as keyof typeof categoryColors],
              }}
            />
            <span className="text-gray-700">
              {categoryLabels[cat as keyof typeof categoryLabels]} · {count}
            </span>
          </span>
        ))}
      </div>

      <div className="flex-1">
        <MapWrapper />
      </div>
    </main>
  );
}
