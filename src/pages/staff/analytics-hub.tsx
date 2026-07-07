import { useState } from "react";
import { TrendingUp, ShoppingBag, BarChart3, Star, Heart, Clock, CalendarDays, Layers, Trash2 } from "lucide-react";
import { useGetAnalyticsSummary, clearAnalyticsForPeriod, getListOrdersQueryKey, getListSentimentLogsQueryKey, getAnalyticsSummaryQueryKey } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Period = "day" | "week" | "month" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

const PIE_COLORS = ["#b45309", "#0d7a5f", "#1e3a5f", "#c9a84c", "#9b4423", "#5a8a5c", "#c45c7c", "#4f46e5"];

function sentimentLabel(score: number): { label: string; emoji: string; color: string } {
  if (score <= 0) return { label: "No data", emoji: "—", color: "text-muted-foreground" };
  if (score < 1.75) return { label: "Poor", emoji: "😡", color: "text-red-600" };
  if (score < 2.5)  return { label: "Mixed", emoji: "😐", color: "text-amber-600" };
  if (score < 3.25) return { label: "Good", emoji: "🙂", color: "text-green-600" };
  return { label: "Excellent", emoji: "😍", color: "text-green-700" };
}

export default function AnalyticsHub() {
  const [period, setPeriod] = useState<Period>("day");
  const { data, isLoading } = useGetAnalyticsSummary({ period });
  const summary = data as any;
  const sent = sentimentLabel(summary?.sentimentScore ?? 0);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await clearAnalyticsForPeriod(period);
      qc.invalidateQueries({ queryKey: getAnalyticsSummaryQueryKey(period) });
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: getListSentimentLogsQueryKey() });
      toast({ title: `Cleared ${PERIOD_LABELS[period]}`, description: `Removed ${res.orders} orders and ${res.sentiments} ratings.` });
    } catch {
      toast({ title: "Error", description: "Could not clear data.", variant: "destructive" });
    } finally {
      setClearing(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              data-testid={`button-period-${p}`}
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
        <button
          data-testid="button-clear-period"
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all border border-destructive/20"
        >
          <Trash2 size={13} /> Clear All — {PERIOD_LABELS[period]}
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear analytics for {PERIOD_LABELS[period]}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all orders and customer ratings recorded during <strong>{PERIOD_LABELS[period]}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} disabled={clearing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearing ? "Clearing..." : "Yes, clear permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div data-testid="metric-revenue" className="bg-gradient-to-br from-accent/10 to-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp size={15} />
                <span className="text-xs font-semibold uppercase tracking-wider">Revenue</span>
              </div>
              <p className="font-serif text-2xl font-bold text-accent">ETB {summary.totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{PERIOD_LABELS[period]}</p>
            </div>
            <div data-testid="metric-orders" className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <ShoppingBag size={15} />
                <span className="text-xs font-semibold uppercase tracking-wider">Orders</span>
              </div>
              <p className="font-serif text-2xl font-bold">{summary.totalOrders}</p>
              <p className="text-xs text-muted-foreground mt-1">Total placed</p>
            </div>
            <div data-testid="metric-avg" className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BarChart3 size={15} />
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Order</span>
              </div>
              <p className="font-serif text-2xl font-bold">ETB {summary.averageOrderValue.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per order</p>
            </div>
            <div data-testid="metric-sentiment" className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Heart size={15} />
                <span className="text-xs font-semibold uppercase tracking-wider">Sentiment</span>
              </div>
              <p className={`font-serif text-2xl font-bold ${sent.color}`}>
                {sent.emoji} {summary.sentimentScore > 0 ? summary.sentimentScore.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{sent.label} · {summary.sentimentCount} ratings</p>
            </div>
          </div>

          {/* Revenue over time */}
          <div className="bg-card border border-card-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-accent" />
              <h3 className="font-serif font-semibold text-sm uppercase tracking-wide text-muted-foreground">Revenue Trend</h3>
            </div>
            <div className="h-64">
              {summary.revenueOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.revenueOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Line type="monotone" dataKey="revenue" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Revenue (ETB)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No revenue yet</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top items bar */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star size={15} className="text-accent" />
                <h3 className="font-serif font-semibold text-sm uppercase tracking-wide text-muted-foreground">Best Selling Items</h3>
              </div>
              <div className="h-64">
                {summary.topItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.topItems} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="nameEn" tick={{ fontSize: 11 }} width={90} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Bar dataKey="totalQuantity" fill="#0d7a5f" radius={[0, 6, 6, 0]} name="Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No items yet</div>
                )}
              </div>
            </div>

            {/* Revenue by category pie */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={15} className="text-accent" />
                <h3 className="font-serif font-semibold text-sm uppercase tracking-wide text-muted-foreground">Revenue by Category</h3>
              </div>
              <div className="h-64">
                {summary.revenueByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.revenueByCategory} dataKey="revenue" nameKey="category" innerRadius={45} outerRadius={85} paddingAngle={2}>
                        {summary.revenueByCategory.map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `ETB ${Number(v).toFixed(0)}`} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
                )}
              </div>
            </div>

            {/* Busiest hours */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={15} className="text-accent" />
                <h3 className="font-serif font-semibold text-sm uppercase tracking-wide text-muted-foreground">Busiest Hours</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.busiestHours} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Bar dataKey="orders" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak days */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={15} className="text-accent" />
                <h3 className="font-serif font-semibold text-sm uppercase tracking-wide text-muted-foreground">Peak Days</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.peakDays} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Bar dataKey="revenue" fill="#c9a84c" radius={[4, 4, 0, 0]} name="Revenue (ETB)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="bg-card border border-card-border rounded-2xl p-5">
            <h3 className="font-serif font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Status Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(summary.ordersByStatus).map(([status, count]) => (
                <div key={status} className="text-center bg-secondary rounded-xl p-3">
                  <p className="text-xl font-bold">{count as number}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{status}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top items detail list */}
          {summary.topItems.length > 0 && (
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star size={15} className="text-accent" />
                <h3 className="font-serif font-semibold text-sm uppercase tracking-wide text-muted-foreground">Top Items — Revenue</h3>
              </div>
              <div className="space-y-3">
                {summary.topItems.map((item: any, i: number) => (
                  <div key={item.menuItemId} data-testid={`top-item-${item.menuItemId}`} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{item.nameAm}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-accent">ETB {item.totalRevenue.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">{item.totalQuantity} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-card-border">
          <p className="font-medium">No data for {PERIOD_LABELS[period]}</p>
          <p className="text-xs mt-1">Orders will appear here once placed</p>
        </div>
      )}
    </div>
  );
}
