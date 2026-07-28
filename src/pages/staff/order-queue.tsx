import { useState, useEffect } from "react";
import { Clock, ChevronRight, Receipt, Package, Utensils, Check, MessageSquareText, Send, X } from "lucide-react";
import { useListActiveOrders, useUpdateOrderStatus, getListActiveOrdersQueryKey, formatEthiopianTime, clearBillRequest, useAppSettings, useOrderMessages, useOrderMessagesRealtime, useSendOrderMessage, deleteOrder } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";


const STATUS_ORDER = ["pending", "preparing", "ready"] as const;
type OrderStatus = typeof STATUS_ORDER[number];
const NEXT_STATUS: Record<OrderStatus, "preparing" | "ready" | "served"> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  preparing: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_ICONS: Record<OrderStatus, string> = {
  pending: "🟡",
  preparing: "🔵",
  ready: "🟢",
};

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const isLate = m >= 15;
  return (
    <span className={`font-mono text-xs tabular-nums ${isLate ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
      {m}m {s}s {isLate ? "⚠️" : ""}
    </span>
  );
}

export default function OrderQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  async function handleDeleteOrder(orderId: number) {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    try {
      await deleteOrder(orderId);
      queryClient.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });
    } catch {
      alert("Failed to delete order.");
    }
  }
  const { data: initialOrders = [], isLoading } = useListActiveOrders({
    query: { staleTime: Infinity, refetchOnWindowFocus: false },
  });
  const updateStatus = useUpdateOrderStatus();
  const { data: appSettings } = useAppSettings();
  const savedWaiters = appSettings?.waiters || [];
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [tableSearch, setTableSearch] = useState("");
  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [waiterPrompt, setWaiterPrompt] = useState<{ orderId: number } | null>(null);
  const [waiterInput, setWaiterInput] = useState("");
  const [useCustomWaiter, setUseCustomWaiter] = useState(false);
  const [chatOrder, setChatOrder] = useState<{ id: number; tableId: string } | null>(null);
  const [unreadByOrder, setUnreadByOrder] = useState<Record<number, number>>({});

  useEffect(() => {
    setOrders(initialOrders as any[]);
  }, [initialOrders]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      // Single combined handler for all order changes — this used to be two
      // separate "*" / "INSERT" / "UPDATE" listeners on the same table, which
      // meant every single order event triggered two full-list invalidations
      // and refetches instead of one. Now it's exactly one invalidation per
      // event, against the small "active orders" list instead of the entire
      // order history.
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload: any) => {
        queryClient.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });

        if (payload.eventType === "INSERT") {
          const row = payload.new;
          const kind = row.order_type === "takeaway" ? "Takeaway" : `Table ${row.table_id}`;
          toast({ title: `🆕 New order — ${kind}` });
          return;
        }

        if (payload.eventType === "UPDATE") {
          const next = payload.new;
          const prev = payload.old;
          if (next?.bill_requested_at && !prev?.bill_requested_at) {
            const kind = next.order_type === "takeaway" ? "Takeaway" : `Table ${next.table_id}`;
            toast({ title: `💰 Bill requested — ${kind}`, description: `Order #${next.id}` });
            try {
              // Audible chirp so staff notice immediately
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = 880;
              osc.connect(gain); gain.connect(ctx.destination);
              gain.gain.setValueAtTime(0.2, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.start(); osc.stop(ctx.currentTime + 0.4);
            } catch {}
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        queryClient.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, (payload: any) => {
        const row = payload.new;
        if (row.sender !== "customer") return;
        setUnreadByOrder((prev) => ({ ...prev, [row.order_id]: (prev[row.order_id] ?? 0) + 1 }));
        toast({ title: `💬 Table ${row.table_id} — Order #${row.order_id}`, description: row.message });
        try {
          // Same audible chirp used for bill requests — staff need to notice.
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = 660;
          osc.connect(gain); gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(); osc.stop(ctx.currentTime + 0.4);
        } catch {}
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, []);


  // Only show non-served orders in the queue. Served orders remain in the
  // database for analytics but are hidden from the live queue UI.
  const visibleOrders = orders.filter((o) => o.status !== "served");
  const searchedOrders = tableSearch.trim() === "" ? visibleOrders : visibleOrders.filter((o) => String(o.tableId ?? "").toLowerCase().includes(tableSearch.trim().toLowerCase()));
  const activeOrders = searchedOrders.filter((o) => filter === "all" ? true : o.status === filter);
  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = visibleOrders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  function advance(orderId: number, currentStatus: OrderStatus) {
    const next = NEXT_STATUS[currentStatus];
    if (next === "served") {
      // Ask which staff member served this order before finalizing.
      setWaiterInput("");
      setUseCustomWaiter(savedWaiters.length === 0);
      setWaiterPrompt({ orderId });
      return;
    }
    updateStatus.mutate(
      { id: orderId, data: { status: next } },
      {
        onSuccess: () => toast({ title: `Order #${orderId} → ${next}` }),
        onError: () => toast({ title: "Error updating status", variant: "destructive" }),
      },
    );
  }

  function confirmServed() {
    if (!waiterPrompt) return;
    const orderId = waiterPrompt.orderId;
    updateStatus.mutate(
      { id: orderId, data: { status: "served", waiterName: waiterInput.trim() || undefined } },
      {
        onSuccess: () => toast({ title: `✅ Order #${orderId} served` }),
        onError: () => toast({ title: "Error updating status", variant: "destructive" }),
      },
    );
    setWaiterPrompt(null);
  }

  async function dismissBill(orderId: number) {
    try {
      await clearBillRequest(orderId);
      queryClient.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });
      toast({ title: `Bill cleared — Order #${orderId}` });
    } catch {
      toast({ title: "Error clearing bill", variant: "destructive" });
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-amber-400 animate-ping"}`} />
        <span className="text-xs text-muted-foreground font-medium">
          {connected ? "Live — orders appear instantly" : "Connecting…"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-xl p-3 text-center transition-all border ${filter === s ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"}`}
          >
            <p className="text-lg font-bold">{counts[s]}</p>
            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      <input
        type="text"
        value={tableSearch}
        onChange={(e) => setTableSearch(e.target.value)}
        placeholder="Search by table number..."
        className="w-full text-sm bg-secondary rounded-xl px-3 py-2 outline-none border border-border focus:border-ring placeholder:text-muted-foreground mb-2"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-border"}`}
        >
          All ({visibleOrders.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-border"}`}
          >
            {STATUS_ICONS[s]} {s} {counts[s] > 0 ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {isLoading && orders.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-card-border">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders {filter !== "all" ? `with status "${filter}"` : "yet"}</p>
          <p className="text-xs mt-1">Waiting for new orders…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order: any) => {
            const isTakeaway = order.orderType === "takeaway";
            const billPending = !!order.billRequestedAt;
            return (
            <div
              key={order.id}
              data-testid={`card-order-${order.id}`}
              className={`bg-card border rounded-2xl p-4 flex flex-col gap-3 transition-all ${
                billPending ? "border-amber-500 ring-2 ring-amber-400/60 shadow-lg animate-pulse" : "border-card-border"
              }`}
            >
              {billPending && (
                <div className="flex items-center justify-between gap-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-400 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <Receipt size={16} />
                    <span className="font-bold text-sm">Bill requested by customer</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => dismissBill(order.id)}>
                    <Check size={14} className="mr-1" /> Acknowledge
                  </Button>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif font-bold text-lg">
                      {isTakeaway ? "Takeaway" : `Table ${order.tableId}`}
                    </span>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {isTakeaway ? <><Package size={10}/> Takeaway</> : <><Utensils size={10}/> Dine-in</>}
                    </Badge>
                    <Badge className={`${STATUS_COLORS[order.status as OrderStatus]} border-0 capitalize text-xs`}>
                      {STATUS_ICONS[order.status as OrderStatus]} {order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock size={11} className="text-muted-foreground" />
                    <ElapsedTimer createdAt={order.createdAt} />
                    <span className="text-xs text-muted-foreground">· #{order.id}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    Placed {formatEthiopianTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-accent text-lg">ETB {order.totalAmount.toFixed(0)}</p>
                  <button data-testid={`button-delete-order-${order.id}`} onClick={() => handleDeleteOrder(order.id)} className="text-muted-foreground hover:text-destructive transition-colors mb-1"><X size={16} /></button>
                  <select data-testid={`select-payment-${order.id}`} value={order.paymentMethod ?? "cash"} onChange={(e) => updateStatus.mutate({ id: order.id, data: { paymentMethod: e.target.value } })} className="text-xs bg-transparent text-muted-foreground border border-border rounded-full px-2 py-0.5 mt-1 outline-none capitalize">
                    <option value="cash">Cash</option>
                    {(appSettings?.paymentMethods ?? []).map((pm) => (<option key={pm.id} value={pm.id}>{pm.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(order.items || []).map((item: any) => (
                  <span key={item.id} className="bg-secondary text-secondary-foreground text-xs rounded-full px-2.5 py-1 font-medium">
                    {item.nameEn} ×{item.quantity}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  data-testid={`button-chat-${order.id}`}
                  onClick={() => { setChatOrder({ id: order.id, tableId: order.tableId }); setUnreadByOrder((prev) => ({ ...prev, [order.id]: 0 })); }}
                  className="relative flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-border transition-all"
                >
                  <MessageSquareText size={13} /> Message
                  {!!unreadByOrder[order.id] && (
                    <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {unreadByOrder[order.id]}
                    </span>
                  )}
                </button>
                <Button
                  data-testid={`button-advance-${order.id}`}
                  onClick={() => advance(order.id, order.status as OrderStatus)}
                  disabled={updateStatus.isPending}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  Mark as {NEXT_STATUS[order.status as OrderStatus]}
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          );})}

        </div>
      )}

      <Dialog open={!!waiterPrompt} onOpenChange={(open) => !open && setWaiterPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who served this order?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Pick who served Order #{waiterPrompt?.orderId}. This shows up in the Reports dashboard.
          </p>
          {!useCustomWaiter && savedWaiters.length > 0 ? (
            <div className="space-y-2">
              <Select value={waiterInput} onValueChange={setWaiterInput}>
                <SelectTrigger data-testid="select-waiter-name" autoFocus>
                  <SelectValue placeholder="Choose a waiter/server" />
                </SelectTrigger>
                <SelectContent>
                  {savedWaiters.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => { setUseCustomWaiter(true); setWaiterInput(""); }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Not on the list? Type a name instead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="e.g. Mumu or #4"
                value={waiterInput}
                onChange={(e) => setWaiterInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmServed(); }}
                data-testid="input-waiter-name"
              />
              {savedWaiters.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setUseCustomWaiter(false); setWaiterInput(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Pick from saved list instead
                </button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiterPrompt(null)}>Cancel</Button>
            <Button onClick={confirmServed} data-testid="button-confirm-served">
              Mark as Served
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!chatOrder} onOpenChange={(open) => !open && setChatOrder(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden flex flex-col" style={{ height: "480px" }}>
          {chatOrder && <StaffChatPanel orderId={chatOrder.id} tableId={chatOrder.tableId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// A per-order chat thread — staff read whatever the customer asked (e.g.
// "is my food coming?") and reply directly; it shows up instantly on the
// customer's side via Supabase Realtime.
function StaffChatPanel({ orderId, tableId }: { orderId: number; tableId: string }) {
  const { data: messages = [] } = useOrderMessages(orderId);
  useOrderMessagesRealtime(orderId);
  const sendMessage = useSendOrderMessage();
  const [input, setInput] = useState("");

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage.mutateAsync({ orderId, tableId, sender: "staff", message: text });
  }

  return (
    <>
      <DialogHeader className="bg-primary text-primary-foreground px-4 py-3 space-y-0">
        <DialogTitle className="text-sm font-bold flex items-center gap-2">
          <MessageSquareText size={16} /> Table {tableId} · Order #{orderId}
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground pt-6">No messages yet from this table.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "staff" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              msg.sender === "staff"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-secondary text-secondary-foreground rounded-tl-sm"
            }`}>
              {msg.imageUrl ? (<img src={msg.imageUrl} alt="Bill photo" className="max-w-full rounded-lg cursor-pointer" onClick={() => window.open(msg.imageUrl, "_blank")} />) : (msg.message)}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <input
          data-testid="input-staff-reply"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Reply to the customer..."
          className="flex-1 text-sm bg-secondary rounded-xl px-3 py-2 outline-none border border-border focus:border-ring placeholder:text-muted-foreground"
          disabled={sendMessage.isPending}
        />
        <button
          data-testid="button-send-staff-reply"
          onClick={send}
          disabled={sendMessage.isPending || !input.trim()}
          className="bg-primary text-primary-foreground rounded-xl px-3 py-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Send size={16} />
        </button>
      </div>
    </>
  );
}