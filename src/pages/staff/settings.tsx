import { useState, useEffect } from "react";
import { Save, Pencil, Check, Plus, Trash2, X, MapPin, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings, saveAppSettings, useStaffAuth, saveStaffAuth } from "@/lib/data";

interface PaymentMethod {
  id: string;
  name: string;
  account: string;
  color: string;
}

interface GeofenceSettings {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
}

interface Settings {
  paymentMethods: PaymentMethod[];
  waiters?: string[];
  geofence?: GeofenceSettings;
}

const COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" },
  { value: "red", label: "Red" },
  { value: "gray", label: "Gray" },
];

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: remoteSettings } = useAppSettings();
  const { data: staffAuth } = useStaffAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMethod, setNewMethod] = useState({ name: "", account: "", color: "blue" });
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [workerPasswordInput, setWorkerPasswordInput] = useState("");
  const [savingWorkerPassword, setSavingWorkerPassword] = useState(false);
  const [newWaiter, setNewWaiter] = useState("");
  const [savingWaiter, setSavingWaiter] = useState(false);
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [geoRadius, setGeoRadius] = useState("150");
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savingGeofence, setSavingGeofence] = useState(false);

  useEffect(() => {
    if (remoteSettings) {
      setSettings(remoteSettings as Settings);
      const gf = (remoteSettings as Settings).geofence;
      setGeoEnabled(gf?.enabled ?? false);
      setGeoLat(gf?.latitude != null ? String(gf.latitude) : "");
      setGeoLng(gf?.longitude != null ? String(gf.longitude) : "");
      setGeoRadius(gf?.radiusMeters != null ? String(gf.radiusMeters) : "150");
    }
  }, [remoteSettings]);

  useEffect(() => {
    if (staffAuth) {
      setAdminPasswordInput(staffAuth.adminPassword || "");
      setWorkerPasswordInput(staffAuth.workerPassword || "");
    }
  }, [staffAuth]);

  async function saveAdminPassword() {
    if (!adminPasswordInput.trim()) {
      toast({ title: "Password cannot be empty", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await saveStaffAuth({ ...staffAuth, adminPassword: adminPasswordInput.trim() });
      toast({ title: "Admin password updated" });
    } catch {
      toast({ title: "Failed to save password", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveWorkerPassword() {
    if (!workerPasswordInput.trim()) {
      toast({ title: "Password cannot be empty", variant: "destructive" });
      return;
    }
    setSavingWorkerPassword(true);
    try {
      await saveStaffAuth({ ...staffAuth, workerPassword: workerPasswordInput.trim() });
      toast({ title: "Worker password updated" });
    } catch {
      toast({ title: "Failed to save password", variant: "destructive" });
    } finally {
      setSavingWorkerPassword(false);
    }
  }

  async function save(updatedSettings?: Settings) {
    const target = updatedSettings ?? settings;
    if (!target) return;
    setSaving(true);
    try {
      await saveAppSettings(target);
      setSettings(target);
      setEditingIdx(null);
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function updateMethod(idx: number, field: keyof PaymentMethod, value: string) {
    if (!settings) return;
    const updated = settings.paymentMethods.map((m, i) =>
      i === idx ? { ...m, [field]: value } : m
    );
    setSettings({ ...settings, paymentMethods: updated });
  }

  async function deleteMethod(idx: number) {
    if (!settings) return;
    if (!confirm(`Delete "${settings.paymentMethods[idx].name}"?`)) return;
    const updated = settings.paymentMethods.filter((_, i) => i !== idx);
    const next = { ...settings, paymentMethods: updated };
    setSettings(next);
    await save(next);
  }

  async function addMethod() {
    if (!newMethod.name.trim() || !newMethod.account.trim()) {
      toast({ title: "Name and account are required", variant: "destructive" });
      return;
    }
    if (!settings) return;
    const id = newMethod.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const added = [...settings.paymentMethods, { id, ...newMethod }];
    const next = { ...settings, paymentMethods: added };
    setSettings(next);
    setNewMethod({ name: "", account: "", color: "blue" });
    setShowAddForm(false);
    await save(next);
  }

  async function addWaiter() {
    const name = newWaiter.trim();
    if (!name) {
      toast({ title: "Enter a name or ID number first", variant: "destructive" });
      return;
    }
    if (!settings) return;
    const existing = settings.waiters || [];
    if (existing.some((w) => w.toLowerCase() === name.toLowerCase())) {
      toast({ title: "That waiter is already saved", variant: "destructive" });
      return;
    }
    const next = { ...settings, waiters: [...existing, name] };
    setSavingWaiter(true);
    try {
      await save(next);
      setNewWaiter("");
    } finally {
      setSavingWaiter(false);
    }
  }

  async function removeWaiter(name: string) {
    if (!settings) return;
    const next = { ...settings, waiters: (settings.waiters || []).filter((w) => w !== name) };
    await save(next);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported", description: "This browser can't detect location.", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude.toFixed(6));
        setGeoLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast({ title: "Location captured", description: "Make sure you're standing inside the cafe when you do this." });
      },
      () => {
        setLocating(false);
        toast({ title: "Couldn't get location", description: "Check your device's location permission and try again.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function saveGeofence() {
    if (!settings) return;
    const lat = geoLat.trim() ? Number(geoLat) : null;
    const lng = geoLng.trim() ? Number(geoLng) : null;
    const radius = Number(geoRadius) || 150;
    if (geoEnabled && (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng))) {
      toast({ title: "Cafe location required", description: "Set the cafe's coordinates before enabling this, e.g. with \"Use My Current Location\".", variant: "destructive" });
      return;
    }
    const next: Settings = {
      ...settings,
      geofence: { enabled: geoEnabled, latitude: lat, longitude: lng, radiusMeters: radius },
    };
    setSavingGeofence(true);
    try {
      await save(next);
    } finally {
      setSavingGeofence(false);
    }
  }

  if (!settings) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-serif font-semibold text-lg">Admin Access</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Staff members choose "Worker" or "Admin" when opening the Staff Terminal. Workers only
            see the Order Queue. Admins see everything (Analytics, Menu Edit, Reports, Settings,
            etc.). Both now require a password first.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Admin Password</Label>
            <Input
              data-testid="input-admin-password"
              type="text"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              placeholder="Set the admin password"
            />
          </div>
          <Button
            data-testid="button-save-admin-password"
            onClick={saveAdminPassword}
            disabled={savingPassword}
            size="sm"
          >
            <Save size={14} className="mr-1" /> {savingPassword ? "Saving..." : "Save"}
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Worker Password</Label>
            <Input
              data-testid="input-worker-password"
              type="text"
              value={workerPasswordInput}
              onChange={(e) => setWorkerPasswordInput(e.target.value)}
              placeholder="Set the worker password"
            />
          </div>
          <Button
            data-testid="button-save-worker-password"
            onClick={saveWorkerPassword}
            disabled={savingWorkerPassword}
            size="sm"
          >
            <Save size={14} className="mr-1" /> {savingWorkerPassword ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-serif font-semibold text-lg">Waiters / Servers</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save the staff names or ID numbers here. When marking an order as served, you'll pick from this list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            data-testid="input-new-waiter"
            value={newWaiter}
            onChange={(e) => setNewWaiter(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addWaiter(); }}
            placeholder="e.g. Abel or W-102"
            className="flex-1"
          />
          <Button
            data-testid="button-add-waiter"
            onClick={addWaiter}
            disabled={savingWaiter}
            size="sm"
          >
            <Plus size={14} className="mr-1" /> Add
          </Button>
        </div>
        {(settings.waiters || []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(settings.waiters || []).map((w) => (
              <span
                key={w}
                data-testid={`waiter-${w}`}
                className="flex items-center gap-1.5 bg-secondary rounded-full pl-3 pr-1.5 py-1 text-sm"
              >
                {w}
                <button
                  onClick={() => removeWaiter(w)}
                  className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-2">No waiters saved yet. Add one above.</p>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif font-semibold text-lg">Payment Methods</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Manage payment options shown to customers at checkout</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Plus size={14} /> Add
            </Button>
            <Button
              data-testid="button-save-settings"
              onClick={() => save()}
              disabled={saving}
              size="sm"
              className="flex items-center gap-1"
            >
              <Save size={14} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Add new method form */}
        {showAddForm && (
          <div className="bg-secondary/60 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New Payment Method</p>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name *</Label>
                <Input
                  value={newMethod.name}
                  onChange={(e) => setNewMethod((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Amhara Bank"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account Number / Phone *</Label>
                <Input
                  value={newMethod.account}
                  onChange={(e) => setNewMethod((p) => ({ ...p, account: e.target.value }))}
                  placeholder="e.g. 1000 456 789"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <select
                  value={newMethod.color}
                  onChange={(e) => setNewMethod((p) => ({ ...p, color: e.target.value }))}
                  className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                >
                  {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={addMethod} size="sm" className="w-full flex items-center gap-1">
              <Plus size={14} /> Add Payment Method
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {settings.paymentMethods.map((pm, idx) => (
            <div key={pm.id} data-testid={`payment-method-${pm.id}`} className="bg-secondary rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${COLOR_CLASSES[pm.color] || "bg-gray-400"}`} />
                  <span className="font-medium text-sm">{pm.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                    className="p-1.5 rounded-lg hover:bg-border transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    {editingIdx === idx ? <Check size={14} /> : <Pencil size={14} />}
                  </button>
                  <button
                    onClick={() => deleteMethod(idx)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {editingIdx === idx ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display Name</Label>
                    <Input
                      data-testid={`input-pm-name-${pm.id}`}
                      value={pm.name}
                      onChange={(e) => updateMethod(idx, "name", e.target.value)}
                      placeholder="e.g. Commercial Bank of Ethiopia"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account Number / Phone</Label>
                    <Input
                      data-testid={`input-pm-account-${pm.id}`}
                      value={pm.account}
                      onChange={(e) => updateMethod(idx, "account", e.target.value)}
                      placeholder="e.g. 1000 123 456 789"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Color</Label>
                    <select
                      value={pm.color}
                      onChange={(e) => updateMethod(idx, "color", e.target.value)}
                      className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    >
                      {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-sm text-muted-foreground">{pm.account}</p>
              )}
            </div>
          ))}

          {settings.paymentMethods.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No payment methods. Add one above.</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-semibold text-lg flex items-center gap-2">
              <MapPin size={18} /> Location Lock (Cafe-Only Ordering)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              When on, customers can only view the menu and place orders while their phone is
              physically inside the cafe. If a customer steps outside the radius below, the menu
              automatically disappears from their screen — no refresh needed.
            </p>
          </div>
          <Switch
            data-testid="switch-geofence-enabled"
            checked={geoEnabled}
            onCheckedChange={setGeoEnabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cafe Latitude</Label>
            <Input
              data-testid="input-geofence-lat"
              type="number"
              step="any"
              value={geoLat}
              onChange={(e) => setGeoLat(e.target.value)}
              placeholder="e.g. 9.5931"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cafe Longitude</Label>
            <Input
              data-testid="input-geofence-lng"
              type="number"
              step="any"
              value={geoLng}
              onChange={(e) => setGeoLng(e.target.value)}
              placeholder="e.g. 41.8661"
            />
          </div>
        </div>

        <Button
          data-testid="button-use-current-location"
          variant="outline"
          size="sm"
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex items-center gap-1.5"
        >
          <LocateFixed size={14} /> {locating ? "Locating..." : "Use My Current Location"}
        </Button>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Stand inside the cafe when you tap this — it sets the cafe's exact coordinates.
        </p>

        <div className="space-y-1.5 max-w-[200px]">
          <Label className="text-xs">Allowed Radius (meters)</Label>
          <Input
            data-testid="input-geofence-radius"
            type="number"
            min="10"
            value={geoRadius}
            onChange={(e) => setGeoRadius(e.target.value)}
            placeholder="150"
          />
        </div>

        <Button
          data-testid="button-save-geofence"
          onClick={saveGeofence}
          disabled={savingGeofence}
          size="sm"
          className="flex items-center gap-1"
        >
          <Save size={14} /> {savingGeofence ? "Saving..." : "Save Location Lock"}
        </Button>
      </div>
    </div>
  );
}
