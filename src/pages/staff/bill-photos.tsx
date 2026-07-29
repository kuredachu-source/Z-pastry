import { useMemo, useState } from "react";
import { useListBillPhotos, deleteBillPhotos, formatEthiopianDateTime } from "@/lib/data";
import { Image as ImageIcon, Trash2, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Period = "all" | "today" | "week" | "month" | "year";

export default function BillPhotos() {
  const { data: photos = [], isLoading } = useListBillPhotos();
  const qc = useQueryClient();
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const now = new Date();
    const addisParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const ap: Record<string, string> = {};
    addisParts.forEach((p) => { ap[p.type] = p.value; });
    const addisTodayStart = new Date(Date.UTC(Number(ap.year), Number(ap.month) - 1, Number(ap.day), -3, 0, 0));
    let start: Date | null = null;
    if (period === "today") {
      start = addisTodayStart;
    } else if (period === "week") {
      const dow = (addisTodayStart.getUTCDay() + 6) % 7;
      start = new Date(addisTodayStart);
      start.setUTCDate(start.getUTCDate() - dow);
    } else if (period === "month") {
      start = new Date(Date.UTC(Number(ap.year), Number(ap.month) - 1, 1, -3, 0, 0));
    } else if (period === "year") {
      start = new Date(Date.UTC(Number(ap.year), 0, 1, -3, 0, 0));
    }
    return photos.filter((p) => {
      if (start && new Date(p.createdAt) < start) return false;
      if (search.trim() && !String(p.tableId ?? "").toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [photos, period, search]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      const day = p.createdAt.slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(p);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  async function handleClearAll() {
    if (filtered.length === 0) return;
    const ok = window.confirm(`Delete ${filtered.length} bill photo(s) shown below? This cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteBillPhotos(filtered.map((p) => p.id));
      qc.invalidateQueries({ queryKey: ["bill-photos"] });
    } finally {
      setDeleting(false);
    }
  }

  const PERIODS: { id: Period; label: string }[] = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "year", label: "This Year" },
  ];

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground">Loading bill photos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${period === p.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-border"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by table number..."
            className="w-full text-sm bg-secondary rounded-xl pl-9 pr-3 py-2 outline-none border border-border focus:border-ring placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={handleClearAll}
          disabled={deleting || filtered.length === 0}
          className="flex items-center gap-1.5 bg-destructive text-destructive-foreground rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Trash2 size={16} />
          Clear All
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-card-border">
          <ImageIcon size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bill photos found</p>
          <p className="text-xs mt-1">Try a different search or time period.</p>
        </div>
      ) : (
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
                      <p className="text-[10px] text-muted-foreground">{formatEthiopianDateTime(p.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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