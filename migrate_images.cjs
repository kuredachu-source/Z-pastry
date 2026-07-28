const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const SUPABASE_URL = "https://inpffjynrqvjoleernuy.supabase.co";
const SERVICE_ROLE_KEY = process.argv[2];
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
async function main() {
  const { data: rows, error } = await supabase.from("menu_items").select("id, name_en, image_url").like("image_url", "data:%");
  if (error) throw error;
  console.log(`Found ${rows.length} items with base64 images.`);
  let success = 0, failed = 0;
  for (const row of rows) {
    try {
      const match = row.image_url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) { console.log(`Skip ${row.id}`); failed++; continue; }
      const buffer = Buffer.from(match[2], "base64");
      const resized = await sharp(buffer).resize(800, 800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      const path = `${row.id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, resized, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("menu-images").getPublicUrl(path);
      const { error: updErr } = await supabase.from("menu_items").update({ image_url: pub.publicUrl }).eq("id", row.id);
      if (updErr) throw updErr;
      console.log(`OK ${row.id} (${row.name_en}): ${(buffer.length/1024).toFixed(0)}KB -> ${(resized.length/1024).toFixed(0)}KB`);
      success++;
    } catch (e) {
      console.log(`FAIL ${row.id}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });