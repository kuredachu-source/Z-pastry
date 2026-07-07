import { useQueryClient } from "@tanstack/react-query";
import { useListSentimentLogs, getListSentimentLogsQueryKey, deleteAllSentiments, formatEthiopianDateTime } from "@/lib/data";
import { MessageSquare, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SentimentLog = {
  id: number;
  orderId?: number | null;
  tableId: string;
  emoji: string;
  createdAt: string;
};

const EMOJI_LABELS: Record<string, string> = {
  "😡": "Very Unhappy",
  "😐": "Neutral",
  "🙂": "Happy",
  "😍": "Loved it",
};

export default function SentimentLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useListSentimentLogs();
  const typedLogs = logs as SentimentLog[];

  const counts = typedLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.emoji] = (acc[l.emoji] || 0) + 1;
    return acc;
  }, {});

  async function clearAll() {
    if (!confirm("Delete all sentiment feedback? This cannot be undone.")) return;
    try {
      const deleted = await deleteAllSentiments();
      queryClient.invalidateQueries({ queryKey: getListSentimentLogsQueryKey() });
      toast({ title: `Cleared ${deleted} feedback entries` });
    } catch {
      toast({ title: "Failed to clear feedback", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{typedLogs.length} feedback entries</p>
        {typedLogs.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-xl hover:bg-destructive/10 transition-all"
          >
            <Trash2 size={13} /> Clear All
          </button>
        )}
      </div>

      {typedLogs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["😡", "😐", "🙂", "😍"].map((emoji) => (
            <div key={emoji} className="bg-card border border-card-border rounded-2xl p-4 text-center">
              <p className="text-3xl mb-1">{emoji}</p>
              <p className="font-bold text-xl">{counts[emoji] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{EMOJI_LABELS[emoji]}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl h-14 animate-pulse" />
          ))}
        </div>
      ) : typedLogs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No sentiment feedback yet</p>
          <p className="text-sm">Feedback appears after customers submit orders</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emoji</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Table</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {[...typedLogs].reverse().map((log) => (
                <tr key={log.id} data-testid={`sentiment-row-${log.id}`} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-2xl">{log.emoji}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{EMOJI_LABELS[log.emoji]}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">Table {log.tableId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{log.orderId ? `#${log.orderId}` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatEthiopianDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
