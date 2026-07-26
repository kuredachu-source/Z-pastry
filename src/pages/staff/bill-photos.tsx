import { useMemo, useState } from "react";
import { useListBillPhotos } from "@/lib/data";
import { Image as ImageIcon } from "lucide-react";

export default function BillPhotos() {
  const { data: photos = [], isLoading } = useListBillPhotos();
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, typeof photos> = {};
    for (const p of photos) {
      const day = p.createdAt.slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(p);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [photos]);

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground">Loading bill photos...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-card-border">
        <ImageIcon size={36} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No bill photos yet</p>
        <p className="text-xs mt-1">Photos customers send will appear here, grouped by day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([day, items]) => (
        <div key={day}>
          <h3 className="text-sm font-bold text-muted-foreground mb-2">{day} ({items.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpenUrl(p.imageUrl!)}
                className="bg-card border border-card-border rounded-xl overflow-hidden text-left hover:opacity-90 transition-opacity"
              >
                <img src={p.imageUrl!} alt="Bill" className="w-full h-32 object-cover" />
                <div className="p-2">
                  <p className="text-xs font-medium">Table {p.tableId}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleTimeString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {openUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setOpenUrl(null)}
        >
          <img src={openUrl} alt="Bill full size" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}