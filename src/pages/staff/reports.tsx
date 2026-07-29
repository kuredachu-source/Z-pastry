import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOrders, formatEthiopianTime, clearAnalyticsForPeriod, getListOrdersQueryKey, deleteOrder } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Row = {
  orderId: number;
  date: string;
  time: string;
  waiter: string;
  tableOrder: string;
  dineType: string;
  item: string;
  category: string;
  qty: number;
  unitPrice: number;
  total: number;
  status: string;
  payment: string;
};

type Period = "day" | "week" | "month" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

function periodStartDate(period: Period): Date {
  const now = new Date();
  let start: Date;
  if (period === "day") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    const dow = (start.getDay() + 6) % 7; // 0 = Monday
    start.setDate(start.getDate() - dow);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  }
  return start;
}

function toCsv(rows: Row[]): string {
  const headers = [
    "date", "time", "waiter", "table/order", "dine_type", "item",
    "category", "qty", "unit_price_etb", "total_etb", "status", "payment",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.date, r.time, r.waiter, r.tableOrder, r.dineType, r.item,
      r.category, r.qty, r.unitPrice, r.total, r.status, r.payment,
    ].map(escape).join(","));
  }
  return lines.join("\n");
}

export default function Reports() {
  const { data: orders = [], isLoading } = useListOrders({
    query: { staleTime: 0, refetchOnWindowFocus: true },
  });
  const [period, setPeriod] = useState<Period>("day");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDeleteRow = async (id: number) => {
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteOrder(id);
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Order deleted" });
    } catch (e) {
      toast({ title: "Failed to delete order", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const rows = useMemo<Row[]>(() => {
    const since = periodStartDate(period).getTime();
    const out: Row[] = [];
    for (const o of orders as any[]) {
      const created = new Date(o.createdAt).getTime();
      if (created < since) continue;
      const dateStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Addis_Ababa", day: "2-digit", month: "2-digit", year: "numeric",
      }).format(new Date(o.createdAt));
      const timeStr = formatEthiopianTime(o.createdAt).replace(" EAT", "");
      const dineType = o.orderType === "takeaway" ? "Takeaway" : "Dine In";
      for (const it of o.items || []) {
        out.push({
          orderId: o.id,
          date: dateStr,
          time: timeStr,
          waiter: o.waiterName || "—",
          tableOrder: o.orderType === "takeaway" ? `Order ${o.id}` : `T${o.tableId}`,
          dineType,
          item: it.nameEn,
          category: it.category || "—",
          qty: it.quantity,
          unitPrice: it.unitPrice,
          total: it.unitPrice * it.quantity,
          status: o.status,
          payment: o.paymentMethod ? o.paymentMethod[0].toUpperCase() + o.paymentMethod.slice(1) : "—",
        });
      }
    }
    // Most recent first
    out.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
    return out;
  }, [orders, period]);

  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);

  function downloadCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ZPASTRY-cafe-report-${period}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      const res = await clearAnalyticsForPeriod(period);
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: `Cleared ${PERIOD_LABELS[period]}`, description: `Removed ${res.orders} orders.` });
    } catch {
      toast({ title: "Error", description: "Could not clear data.", variant: "destructive" });
    } finally {
      setClearing(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              data-testid={`button-report-period-${p}`}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-border"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-clear-report"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all border border-destructive/20"
          >
            <Trash2 size={13} /> Clear All
          </button>
          <Button onClick={downloadCsv} size="sm" className="gap-1.5" data-testid="button-download-csv" disabled={rows.length === 0}>
            <Download size={14} /> Download CSV
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear report for {PERIOD_LABELS[period]}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all orders recorded during <strong>{PERIOD_LABELS[period]}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} disabled={clearing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearing ? "Clearing..." : "Yes, clear permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Line items</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue (ETB)</p>
          <p className="text-lg font-bold text-accent">{totalRevenue.toFixed(0)}</p>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary text-secondary-foreground">
                {["date", "time", "waiter", "table/order", "dine_type", "item", "category", "qty", "unit_price_etb", "total_etb", "status", "payment", "action"].map((h) => (
                  <th key={h} className="text-left font-bold px-3 py-2 whitespace-nowrap capitalize">{h.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={13} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-muted-foreground">
                    <FileSpreadsheet size={28} className="mx-auto mb-2 opacity-30" />
                    No orders in this period
                  </td>
                </tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t border-border/60 hover:bg-secondary/40">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.time}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.waiter}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.tableOrder}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.dineType}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.item}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.category}</td>
                  <td className="px-3 py-2 text-right">{r.qty}</td>
                  <td className="px-3 py-2 text-right">{r.unitPrice.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.total.toFixed(0)}</td>
                  <td className="px-3 py-2 whitespace-nowrap capitalize">{r.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.payment}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDeleteRow(r.orderId)} disabled={deletingId === r.orderId} className="text-destructive hover:opacity-70 transition-opacity disabled:opacity-30">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}