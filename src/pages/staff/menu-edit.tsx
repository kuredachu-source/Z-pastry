import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Link, Upload } from "lucide-react";
import {
  useListMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  getListMenuItemsQueryKey,
  uploadMenuImage,
} from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured, getMissingSupabaseEnv } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";


type MenuItem = {
  id: number;
  nameEn: string;
  nameAm: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
};

const EMPTY_FORM = {
  nameEn: "",
  nameAm: "",
  description: "",
  price: "",
  category: "",
  imageUrl: "",
  available: true,
  imageMode: "url" as "url" | "upload",
};

export default function MenuEdit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: menuItems = [], isLoading } = useListMenuItems();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterCat, setFilterCat] = useState("All");

  // Realtime — keep menu in sync across staff devices instantly
  useEffect(() => {
    const channel = supabase
      .channel("menu-items-staff-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);


  const categories = ["All", ...Array.from(new Set((menuItems as MenuItem[]).map((m) => m.category)))];
  const existingCategories = Array.from(new Set((menuItems as MenuItem[]).map((m) => m.category)));
  const displayed = filterCat === "All"
    ? (menuItems as MenuItem[])
    : (menuItems as MenuItem[]).filter((m) => m.category === filterCat);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setForm({
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category,
      imageUrl: item.imageUrl ?? "",
      available: item.available,
      imageMode: "url",
    });
    setEditId(item.id);
    setShowForm(true);
  }

  const [uploadingImage, setUploadingImage] = useState(false);
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadMenuImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }

  function handleSubmit() {
    if (!form.nameEn.trim() || !form.nameAm.trim() || !form.price || !form.category.trim()) {
      toast({ title: "Fill in all required fields (*)", variant: "destructive" });
      return;
    }
    const payload = {
      nameEn: form.nameEn.trim(),
      nameAm: form.nameAm.trim(),
      description: form.description.trim() || undefined,
      price: parseFloat(form.price),
      category: form.category.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      available: form.available,
    };
    // Close the form IMMEDIATELY — the mutation runs optimistically in the
    // background so the staff never wait for the network.
    setShowForm(false);
    if (editId !== null) {
      updateItem.mutate(
        { id: editId, data: payload },
        {
          onSuccess: () => toast({ title: "Item updated" }),
          onError: () => toast({ title: "Error saving item", variant: "destructive" }),
        },
      );
    } else {
      createItem.mutate(
        { data: payload },
        {
          onSuccess: () => toast({ title: "Item created" }),
          onError: (err: any) =>
            toast({
              title: "Error creating item",
              description: err?.message || err?.error_description || String(err),
              variant: "destructive",
            }),
        },
      );
    }
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this menu item?")) return;
    deleteItem.mutate(
      { id },
      {
        onSuccess: () => toast({ title: "Item deleted" }),
        onError: () => toast({ title: "Error deleting item", variant: "destructive" }),
      },
    );
  }


  const F = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {!isSupabaseConfigured() && (
        <div className="bg-destructive/10 border border-destructive/40 text-destructive rounded-2xl p-4 text-sm">
          <div className="font-semibold mb-1">Backend not configured — adding items is disabled</div>
          <div className="text-xs opacity-90">
            Missing environment variable(s): {getMissingSupabaseEnv().join(", ")}.
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in
            your Vercel Project Settings → Environment Variables, then redeploy.
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-semibold text-lg">Menu Items ({(menuItems as MenuItem[]).length})</h3>
        <Button data-testid="button-add-menu-item" onClick={openCreate} size="sm" className="flex items-center gap-1">
          <Plus size={14} /> Add Item
        </Button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-semibold">{editId ? "Edit Item" : "New Item"}</h4>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nameEn">English Name *</Label>
              <Input id="nameEn" value={form.nameEn} onChange={F("nameEn")} placeholder="e.g. Macchiato" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nameAm">Amharic Name *</Label>
              <Input id="nameAm" value={form.nameAm} onChange={F("nameAm")} placeholder="e.g. ማኪያቶ" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (ETB) *</Label>
              <Input id="price" type="number" value={form.price} onChange={F("price")} placeholder="e.g. 55" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                list="category-options"
                value={form.category}
                onChange={F("category")}
                placeholder="e.g. Coffee, Food, Drinks"
              />
              <datalist id="category-options">
                {existingCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={F("description")} placeholder="Short description..." />
            </div>

            {/* Image input — URL or upload */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Image</Label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, imageMode: "url", imageUrl: "" }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    form.imageMode === "url" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                  }`}
                >
                  <Link size={13} /> URL
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, imageMode: "upload", imageUrl: "" }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    form.imageMode === "upload" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                  }`}
                >
                  <Upload size={13} /> Upload
                </button>
              </div>

              {form.imageMode === "url" ? (
                <Input
                  value={form.imageUrl}
                  onChange={F("imageUrl")}
                  placeholder="https://images.unsplash.com/..."
                />
              ) : (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-xl py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-all"
                  >
                    <Upload size={22} />
                    <span className="text-sm">Click to choose a photo from your device</span>
                    <span className="text-xs">JPG, PNG, WEBP supported</span>
                  </button>
                </div>
              )}

              {/* Image preview */}
              {form.imageUrl && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-border mt-2">
                  <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="available"
                checked={form.available}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, available: v }))}
              />
              <Label htmlFor="available">Available on menu</Label>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createItem.isPending || updateItem.isPending}
              className="flex-1 flex items-center gap-1"
            >
              <Check size={14} /> {editId ? "Save Changes" : "Create Item"}
            </Button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              filterCat === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-border"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No items in this category</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((item) => (
            <div
              key={item.id}
              data-testid={`menu-item-row-${item.id}`}
              className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center gap-3"
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.nameEn} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-lg shrink-0">☕</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.nameEn} <span className="text-muted-foreground">/ {item.nameAm}</span></p>
                <p className="text-xs text-muted-foreground">{item.category} · ETB {item.price.toFixed(0)}</p>
              </div>
              <div className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${item.available ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {item.available ? "On" : "Off"}
              </div>
              <button onClick={() => openEdit(item)} className="p-1.5 hover:text-primary transition-colors text-muted-foreground shrink-0"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:text-destructive transition-colors text-muted-foreground shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}