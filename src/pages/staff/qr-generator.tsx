import { useState, useEffect, useRef } from "react";
import { QrCode, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QRCode from "qrcode";
const PERMANENT_BASE_URL = "https://z-pastry-sapian.vercel.app";
function getPublicBaseUrl() {
  if (typeof window === "undefined") return PERMANENT_BASE_URL;
  if (window.location.hostname === "localhost") return window.location.origin;
  return PERMANENT_BASE_URL;
}

export default function QRGenerator() {
  const [tableInput, setTableInput] = useState("T1");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function generateQR() {
    if (!tableInput.trim()) return;
    const url = `${getPublicBaseUrl()}/menu?table=${encodeURIComponent(tableInput.trim())}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#3b1f0a", light: "#fffbf5" },
    });
    setQrDataUrl(dataUrl);
  }

  useEffect(() => {
    generateQR();
  }, []);

  function download() {
    if (!qrDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const padding = 20;
      const labelHeight = 60;
      const canvas = document.createElement("canvas");
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + labelHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fffbf5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);
      ctx.fillStyle = "#3b1f0a";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Table ${tableInput}`, canvas.width / 2, img.height + padding + 42);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `ZPASTRY-cafe-table-${tableInput}.png`;
      a.click();
    };
    img.src = qrDataUrl;
  }

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="table-id">Table Identifier</Label>
          <div className="flex gap-3">
            <Input
              id="table-id"
              data-testid="input-table-id"
              value={tableInput}
              onChange={(e) => setTableInput(e.target.value)}
              placeholder="e.g. T1, Table 5, VIP-1"
              className="flex-1"
            />
            <Button data-testid="button-generate-qr" onClick={generateQR} className="flex items-center gap-1">
              <QrCode size={16} /> Generate
            </Button>
          </div>
        </div>
      </div>

      {qrDataUrl && (
        <div className="bg-card border border-card-border rounded-2xl p-6 flex flex-col items-center gap-5">
          <div className="relative inline-block">
            <img
              src={qrDataUrl}
              alt={`QR for Table ${tableInput}`}
              data-testid="img-qr-code"
              className="rounded-xl shadow-md"
              style={{ width: 240, height: 240 }}
            />
            {/* Table badge overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", position: "absolute" }}
            >
              <div className="bg-accent text-accent-foreground rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-4 border-white"
                style={{ width: 54, height: 54, fontSize: tableInput.length > 3 ? 10 : 13 }}>
                {tableInput}
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="font-serif font-semibold">Table {tableInput}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
              {getPublicBaseUrl()}/menu?table={encodeURIComponent(tableInput)}
            </p>
          </div>

          <Button data-testid="button-download-qr" onClick={download} variant="outline" className="flex items-center gap-2">
            <Download size={16} /> Download QR Code
          </Button>
        </div>
      )}
    </div>
  );
}