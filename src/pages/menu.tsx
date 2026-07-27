import { useState, useRef, useEffect, useCallback } from "react";
import { ClipboardList, X, Plus, Minus, MessageCircle, MessageSquareText, Send, Mic, MicOff, Bell, Camera } from "lucide-react";
import { useListMenuItems, useCreateOrder, useCreateSentimentLog, useRequestBill, getListOrdersQueryKey, getListMenuItemsQueryKey, getAppSettingsQueryKey, useAppSettings, useOrderMessages, useOrderMessagesRealtime, useSendOrderMessage, uploadBillPhoto, distanceMeters } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseConfig, isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { subscribeOrderToPush, pushSupported } from "@/lib/push";
import { speakOrderReady } from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  menuItemId: number;
  nameEn: string;
  nameAm: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

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

interface IsraelMessage {
  role: "user" | "assistant";
  content: string;
}

type Lang = "en" | "am" | "om" | "so" | "ar";

const LANGUAGES: { code: Lang; nativeName: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "am", nativeName: "አማርኛ", dir: "ltr" },
  { code: "om", nativeName: "Afaan Oromoo", dir: "ltr" },
  { code: "so", nativeName: "Soomaali", dir: "ltr" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
];

const LANG_STORAGE_KEY = "ZPASTRY_customer_lang";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return (LANGUAGES.some((l) => l.code === stored) ? stored : "en") as Lang;
}

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  en: {
    chooseLanguage: "Choose Language",
    qrScanTitle: "Scan the QR code on your table",
    qrScanBody: "Open your phone's camera and point it at the QR code on your table. It'll take you straight to your table's menu — no typing, no searching.",
    table: "Table",
    orderButton: "Order",
    allCategory: "All",
    addToOrder: "Add to Order",
    yourOrder: "Your Order",
    choosePayment: "Choose Payment",
    confirmOrder: "Confirm Order",
    orderEmpty: "Your order is empty",
    whereHaveIt: "Where will you have it?",
    dineIn: "Dine-in",
    takeaway: "Takeaway",
    toGo: "To go",
    total: "Total",
    proceedToPayment: "Proceed to Payment",
    selectPaymentFor: "Select payment for ETB {amount}",
    optionalToggle: "(optional — tap to toggle)",
    back: "Back",
    continueBtn: "Continue",
    placeOrder: "Place Order",
    placing: "Placing...",
    orderSummary: "Order Summary — Table {id}",
    paymentLabel: "Payment: {method}",
    howWasExperience: "How was your experience?",
    tapToRate: "Tap to rate your visit at Z Pastry Cafe",
    skip: "Skip",
    messageStaff: "Message Staff",
    askStaffPlaceholder: "Ask staff anything about your order — e.g. \"Is my food coming soon?\"",
    typeMessagePlaceholder: "Type a message to staff...",
    statusPending: "Order Received",
    statusPreparing: "Preparing",
    statusReady: "Ready for Pickup!",
    statusServed: "Served ✓",
    autoRefreshing: "Auto-refreshing...",
    requestBill: "💰 Request Bill",
    billOnWay: "✓ Bill on the way",
    sending: "Sending…",
    orderPlacedTitle: "Order placed!",
    orderPlacedDesc: "Order #{id} sent to kitchen.",
    notifOnTitle: "🔔 Notifications on",
    notifOnDesc: "We'll alert you the moment your order is ready.",
    errorTitle: "Error",
    orderFailedDesc: "Failed to place order.",
    billRequestedTitle: "Bill requested ✓",
    billRequestedDesc: "Staff have been notified. They'll be right with you.",
    billFailedDesc: "Could not request the bill. Please call a staff member.",
    messageFailedTitle: "Message failed to send",
    messageFailedDesc: "Please try again or wave down a staff member.",
    thankYouTitle: "Thank you!",
    feedbackRecordedDesc: "Your feedback was recorded.",
    orderReadyTitle: "🟢 Order Ready!",
    orderReadyDesc: "Order #{id} is ready — enjoy!",
    orderHash: "Order #{id}",
    checkingLocation: "Checking your location...",
    outsideCafeTitle: "You're outside Z Pastry Cafe",
    outsideCafeBody: "The menu and ordering are only available while you're at the cafe. Come back inside to continue.",
    locationNeededTitle: "Location access needed",
    locationNeededBody: "To use the menu, please allow location access in your browser so we can confirm you're at the cafe, then reload this page.",
    locationUnsupportedBody: "Your device or browser doesn't support location, so we can't verify you're at the cafe. Please ask a staff member for help.",
  },
  am: {
    chooseLanguage: "ቋንቋ ይምረጡ",
    qrScanTitle: "በጠረጴዛዎ ላይ ያለውን የQR ኮድ ይቃኙ",
    qrScanBody: "የስልክዎን ካሜራ ይክፈቱ እና በጠረጴዛዎ ላይ ወዳለው የQR ኮድ ያመልክቱ። ወደ ጠረጴዛዎ ምናሌ በቀጥታ ይወስድዎታል — ምንም መተየብ ወይም መፈለግ አያስፈልግም።",
    table: "ጠረጴዛ",
    orderButton: "ትዕዛዝ",
    allCategory: "ሁሉም",
    addToOrder: "ወደ ትዕዛዝ ጨምር",
    yourOrder: "የእርስዎ ትዕዛዝ",
    choosePayment: "የክፍያ ዘዴ ይምረጡ",
    confirmOrder: "ትዕዛዝ ያረጋግጡ",
    orderEmpty: "ትዕዛዝዎ ባዶ ነው",
    whereHaveIt: "የት ይመገባሉ?",
    dineIn: "በካፌ ውስጥ",
    takeaway: "ወደ ውጭ",
    toGo: "ለመውሰድ",
    total: "ጠቅላላ",
    proceedToPayment: "ወደ ክፍያ ይቀጥሉ",
    selectPaymentFor: "ለ ETB {amount} የክፍያ ዘዴ ይምረጡ",
    optionalToggle: "(አማራጭ — ለመቀየር ይንኩ)",
    back: "ተመለስ",
    continueBtn: "ቀጥል",
    placeOrder: "ትዕዛዝ አስገባ",
    placing: "በማስገባት ላይ...",
    orderSummary: "የትዕዛዝ ማጠቃለያ — ጠረጴዛ {id}",
    paymentLabel: "ክፍያ: {method}",
    howWasExperience: "አገልግሎቱ እንዴት ነበር?",
    tapToRate: "በዜድ ፓስትሪ ካፌ የነበረዎትን ጉብኝት ለመመዘን ይንኩ",
    skip: "ዝለል",
    messageStaff: "ለሰራተኞች መልእክት ላክ",
    askStaffPlaceholder: "ስለ ትዕዛዝዎ ማንኛውንም ነገር ሰራተኞችን ይጠይቁ — ለምሳሌ 'ምግቤ እየመጣ ነው?'",
    typeMessagePlaceholder: "ለሰራተኞች መልእክት ይጻፉ...",
    statusPending: "ትዕዛዝ ደርሷል",
    statusPreparing: "በዝግጅት ላይ",
    statusReady: "ለመውሰድ ዝግጁ ነው!",
    statusServed: "ቀርቧል ✓",
    autoRefreshing: "በራስ-ሰር በመዘመን ላይ...",
    requestBill: "💰 ደረሰኝ ጠይቅ",
    billOnWay: "✓ ደረሰኝ በመንገድ ላይ ነው",
    sending: "በመላክ ላይ…",
    orderPlacedTitle: "ትዕዛዝ ገብቷል!",
    orderPlacedDesc: "ትዕዛዝ #{id} ወደ ወጥ ቤት ተልኳል።",
    notifOnTitle: "🔔 ማሳወቂያዎች በርተዋል",
    notifOnDesc: "ትዕዛዝዎ ዝግጁ እንደሆነ ወዲያውኑ እናሳውቅዎታለን።",
    errorTitle: "ስህተት",
    orderFailedDesc: "ትዕዛዝ ማስገባት አልተሳካም።",
    billRequestedTitle: "ደረሰኝ ተጠይቋል ✓",
    billRequestedDesc: "ሰራተኞች ተነግሯቸዋል። በቅርቡ ይመጣሉ።",
    billFailedDesc: "ደረሰኝ መጠየቅ አልተቻለም። እባክዎ ሰራተኛ ይጥሩ።",
    messageFailedTitle: "መልእክት አልተላከም",
    messageFailedDesc: "እባክዎ እንደገና ይሞክሩ ወይም ሰራተኛ ይጥሩ።",
    thankYouTitle: "እናመሰግናለን!",
    feedbackRecordedDesc: "አስተያየትዎ ተመዝግቧል።",
    orderReadyTitle: "🟢 ትዕዛዝ ዝግጁ ነው!",
    orderReadyDesc: "ትዕዛዝ #{id} ዝግጁ ነው — ይመገቡ!",
    orderHash: "ትዕዛዝ #{id}",
    checkingLocation: "አካባቢዎን በመፈተሽ ላይ...",
    outsideCafeTitle: "ከዜድ ፓስትሪ ካፌ ውጭ ነዎት",
    outsideCafeBody: "ምናሌው እና ትዕዛዝ ማድረግ የሚቻለው በካፌው ውስጥ ሲኖሩ ብቻ ነው። ለመቀጠል ወደ ውስጥ ይመለሱ።",
    locationNeededTitle: "የአካባቢ መዳረሻ ያስፈልጋል",
    locationNeededBody: "ምናሌውን ለመጠቀም እባክዎ በአሳሽዎ ላይ የአካባቢ መዳረሻን ይፍቀዱ፣ ከዚያም ይህን ገጽ እንደገና ይጫኑት።",
    locationUnsupportedBody: "የእርስዎ መሳሪያ ወይም አሳሽ አካባቢን አይደግፍም፣ ስለዚህ በካፌው ውስጥ መሆንዎን ማረጋገጥ አንችልም። እባክዎ ሰራተኛ ያማክሩ።",
  },
  om: {
    chooseLanguage: "Afaan Filadhu",
    qrScanTitle: "Koodii QR minjaala keessan irra jiru sakattaa",
    qrScanBody: "Kaameeraa bilbila keessanii banaatii koodii QR minjaala keessan irratti argamu argisiisaa. Kallattiin gara menyuu minjaala keessaniitti isin geessa — barreessuu yookaan barbaacha hin barbaachisu.",
    table: "Minjaala",
    orderButton: "Ajaja",
    allCategory: "Hunda",
    addToOrder: "Gara Ajajaa Dabali",
    yourOrder: "Ajaja Keessan",
    choosePayment: "Mala Kaffaltii Filadhu",
    confirmOrder: "Ajaja Mirkaneessi",
    orderEmpty: "Ajajni keessan duwwaadha",
    whereHaveIt: "Eessatti nyaattu?",
    dineIn: "Kafee keessatti",
    takeaway: "Fudhachuun",
    toGo: "Deemsaaf",
    total: "Waliigala",
    proceedToPayment: "Gara Kaffaltiitti Ceʼi",
    selectPaymentFor: "ETB {amount} kaffaltii filadhu",
    optionalToggle: "(filannoo — jijjiiruuf tuqi)",
    back: "Deebi'i",
    continueBtn: "Itti Fufi",
    placeOrder: "Ajaja Ergi",
    placing: "Ergaa jira...",
    orderSummary: "Cuunfaa Ajajaa — Minjaala {id}",
    paymentLabel: "Kaffaltii: {method}",
    howWasExperience: "Tajaajilli akkamitti ture?",
    tapToRate: "Daawwannaa keessan Kafee ZPASTRY sadarkeessuuf tuqaa",
    skip: "Darbi",
    messageStaff: "Hojjettootaaf Ergaa Ergi",
    askStaffPlaceholder: "Waa'ee ajaja keessanii hojjettoota gaafadhaa — fakkeenyaaf 'Nyaanni koo dhufaa jiraa?'",
    typeMessagePlaceholder: "Hojjettootaaf ergaa barreessi...",
    statusPending: "Ajajni Argameera",
    statusPreparing: "Qophaa'aa jira",
    statusReady: "Fudhachuuf Qophaa'eera!",
    statusServed: "Kennameera ✓",
    autoRefreshing: "Ofumaan haaromsaa jira...",
    requestBill: "💰 Herrega Gaafadhu",
    billOnWay: "✓ Herregni karaa irra jira",
    sending: "Ergaa jira…",
    orderPlacedTitle: "Ajajni ergameera!",
    orderPlacedDesc: "Ajaja #{id} gara kitchenitti ergameera.",
    notifOnTitle: "🔔 Beeksisni banaadha",
    notifOnDesc: "Ajajni keessan yeroo qophaa'u battalumatti isin beeksisna.",
    errorTitle: "Dogoggora",
    orderFailedDesc: "Ajaja ergu hin milkoofne.",
    billRequestedTitle: "Herregni gaafatameera ✓",
    billRequestedDesc: "Hojjettoonni beekaniiru. Dafanii isiniif dhufu.",
    billFailedDesc: "Herrega gaafachuun hin dandaʼamne. Maaloo hojjettuu waamaa.",
    messageFailedTitle: "Ergaan hin ergamne",
    messageFailedDesc: "Maaloo irra deebi'aa yaalaa yookaan hojjettuu waamaa.",
    thankYouTitle: "Galatoomaa!",
    feedbackRecordedDesc: "Yaadni keessan galmaa'eera.",
    orderReadyTitle: "🟢 Ajajni Qophaa'eera!",
    orderReadyDesc: "Ajaja #{id} qophaa'eera — nyaadhaa!",
    orderHash: "Ajaja #{id}",
    checkingLocation: "Bakka keessan sakattaa jira...",
    outsideCafeTitle: "Kafee ZPASTRY alaa jirtu",
    outsideCafeBody: "Menyuu fi ajaja gochuun kan danda'amu yeroo kafee keessa jirtan qofa. Ajaja itti fufuuf gara keessaatti deebi'aa.",
    locationNeededTitle: "Hayyama bakkaa barbaachisa",
    locationNeededBody: "Menyuu fayyadamuuf, akka mirkaneessinu bakka kafee keessa jirtan, browser keessan irratti hayyama bakkaa eeyyamaa, ergasii fuula kana haaromsaa.",
    locationUnsupportedBody: "Meeshaan yookaan browser keessan bakka hin deeggaru, kanaafuu kafee keessa jiraachuu keessan mirkaneessuu hin dandeenyu. Maaloo hojjettuu gaafadhaa.",
  },
  so: {
    chooseLanguage: "Dooro Luqadda",
    qrScanTitle: "Sawir-gacmeedka QR ee miiskaaga sii sawir",
    qrScanBody: "Fur kaamerada taleefankaaga oo u jeedi koodhka QR ee miiskaaga. Waxay kugu geynaysaa liiska cuntada miiska — wax qoraal ah ama raadin looma baahna.",
    table: "Miiska",
    orderButton: "Dalabka",
    allCategory: "Dhammaan",
    addToOrder: "Ku Dar Dalabka",
    yourOrder: "Dalabkaaga",
    choosePayment: "Dooro Habka Lacag-bixinta",
    confirmOrder: "Xaqiiji Dalabka",
    orderEmpty: "Dalabkaagu waa madhan yahay",
    whereHaveIt: "Xaggee ku cunaysaa?",
    dineIn: "Kafeega dhexdiisa",
    takeaway: "Sii qaad",
    toGo: "Socodka",
    total: "Wadarta",
    proceedToPayment: "U gudub Lacag-bixinta",
    selectPaymentFor: "Dooro lacag-bixinta ETB {amount}",
    optionalToggle: "(ikhtiyaari — taabo si aad u bedesho)",
    back: "Dib u noqo",
    continueBtn: "Sii wad",
    placeOrder: "Dir Dalabka",
    placing: "Diritaanka...",
    orderSummary: "Soo koobid Dalab — Miiska {id}",
    paymentLabel: "Lacag-bixin: {method}",
    howWasExperience: "Sidee ahayd waaya-aragnimadaada?",
    tapToRate: "Taabo si aad u qiimeyso booqashadaada Kafee ZPASTRY",
    skip: "Ka bood",
    messageStaff: "Farriin u dir Shaqaalaha",
    askStaffPlaceholder: "Wax kasta oo ku saabsan dalabkaaga weydii shaqaalaha — tusaale 'Cuntadaydu ma soo socotaa?'",
    typeMessagePlaceholder: "Farriin u qor shaqaalaha...",
    statusPending: "Dalabka la helay",
    statusPreparing: "Waa la diyaarinayaa",
    statusReady: "Waa u diyaar qaadashada!",
    statusServed: "La bixiyay ✓",
    autoRefreshing: "Si toos ah ayaa loo cusboonaynayaa...",
    requestBill: "💰 Codso Bill-ka",
    billOnWay: "✓ Bill-ku wuu socdaa",
    sending: "Diritaanka…",
    orderPlacedTitle: "Dalabku waa la diray!",
    orderPlacedDesc: "Dalab #{id} ayaa loo diray jikada.",
    notifOnTitle: "🔔 Ogeysiisyada waa furan yihiin",
    notifOnDesc: "Waan kuu ogeysiin doonaa marka dalabkaagu diyaar noqdo.",
    errorTitle: "Khalad",
    orderFailedDesc: "Dalabka lama gudbin karin.",
    billRequestedTitle: "Bill-ka waa la codsaday ✓",
    billRequestedDesc: "Shaqaalaha ayaa la ogeysiiyay. Way kuu iman doonaan.",
    billFailedDesc: "Bill-ka lama codsan karin. Fadlan wac shaqaale.",
    messageFailedTitle: "Farriintu ma dirin",
    messageFailedDesc: "Fadlan isku day mar kale ama wac shaqaale.",
    thankYouTitle: "Mahadsanid!",
    feedbackRecordedDesc: "Ra'yigaaga waa la diiwaan geliyay.",
    orderReadyTitle: "🟢 Dalabku waa diyaar!",
    orderReadyDesc: "Dalab #{id} waa diyaar — raaxayso!",
    orderHash: "Dalab #{id}",
    checkingLocation: "Goobtaada waa la hubinayaa...",
    outsideCafeTitle: "Waxaad ka baxday Kafeega ZPASTRY",
    outsideCafeBody: "Liiska cuntada iyo dalabku waxay u furan yihiin kaliya marka aad kafeega joogto. Dib ugu soo noqo si aad u sii wadato.",
    locationNeededTitle: "Waa loo baahan yahay ogolaanshaha goobta",
    locationNeededBody: "Si aad u isticmaasho liiska cuntada, fadlan ka ogolow ogolaanshaha goobta biraawsarkaaga, kadibna dib u soo rar boggan.",
    locationUnsupportedBody: "Qalabkaaga ama biraawsarkaagu ma taageerayo goobta, sidaas darteed ma hubin karno inaad kafeega joogto. Fadlan la xiriir shaqaale.",
  },
  ar: {
    chooseLanguage: "اختر اللغة",
    qrScanTitle: "امسح رمز QR الموجود على طاولتك",
    qrScanBody: "افتح كاميرا هاتفك ووجّهها نحو رمز QR الموجود على طاولتك. سينقلك مباشرة إلى قائمة طاولتك — دون كتابة أو بحث.",
    table: "طاولة",
    orderButton: "الطلب",
    allCategory: "الكل",
    addToOrder: "أضف إلى الطلب",
    yourOrder: "طلبك",
    choosePayment: "اختر طريقة الدفع",
    confirmOrder: "تأكيد الطلب",
    orderEmpty: "طلبك فارغ",
    whereHaveIt: "أين ستتناول طلبك؟",
    dineIn: "داخل المقهى",
    takeaway: "طلب خارجي",
    toGo: "للطريق",
    total: "الإجمالي",
    proceedToPayment: "المتابعة إلى الدفع",
    selectPaymentFor: "اختر طريقة الدفع لمبلغ {amount} بير إثيوبي",
    optionalToggle: "(اختياري — اضغط للتبديل)",
    back: "رجوع",
    continueBtn: "متابعة",
    placeOrder: "إرسال الطلب",
    placing: "جارٍ الإرسال...",
    orderSummary: "ملخص الطلب — طاولة {id}",
    paymentLabel: "الدفع: {method}",
    howWasExperience: "كيف كانت تجربتك؟",
    tapToRate: "اضغط لتقييم زيارتك لمقهى إلجا",
    skip: "تخطي",
    messageStaff: "راسل الموظفين",
    askStaffPlaceholder: "اسأل الموظفين عن أي شيء يخص طلبك — مثلاً 'هل طعامي قادم؟'",
    typeMessagePlaceholder: "اكتب رسالة للموظفين...",
    statusPending: "تم استلام الطلب",
    statusPreparing: "قيد التحضير",
    statusReady: "جاهز للاستلام!",
    statusServed: "تم التقديم ✓",
    autoRefreshing: "التحديث التلقائي جارٍ...",
    requestBill: "💰 اطلب الفاتورة",
    billOnWay: "✓ الفاتورة في الطريق",
    sending: "جارٍ الإرسال…",
    orderPlacedTitle: "تم إرسال الطلب!",
    orderPlacedDesc: "تم إرسال الطلب رقم {id} إلى المطبخ.",
    notifOnTitle: "🔔 الإشعارات مفعّلة",
    notifOnDesc: "سنُعلمك فور جاهزية طلبك.",
    errorTitle: "خطأ",
    orderFailedDesc: "فشل إرسال الطلب.",
    billRequestedTitle: "تم طلب الفاتورة ✓",
    billRequestedDesc: "تم إبلاغ الموظفين. سيصلون إليك قريبًا.",
    billFailedDesc: "تعذر طلب الفاتورة. يرجى الاتصال بأحد الموظفين.",
    messageFailedTitle: "فشل إرسال الرسالة",
    messageFailedDesc: "يرجى المحاولة مرة أخرى أو استدعاء أحد الموظفين.",
    thankYouTitle: "شكرًا لك!",
    feedbackRecordedDesc: "تم تسجيل ملاحظاتك.",
    orderReadyTitle: "🟢 الطلب جاهز!",
    orderReadyDesc: "الطلب رقم {id} جاهز — بالهناء!",
    orderHash: "طلب #{id}",
    checkingLocation: "جارٍ التحقق من موقعك...",
    outsideCafeTitle: "أنت خارج مقهى إلجا",
    outsideCafeBody: "القائمة والطلب متاحان فقط أثناء تواجدك في المقهى. عد إلى الداخل للمتابعة.",
    locationNeededTitle: "الوصول إلى الموقع مطلوب",
    locationNeededBody: "لاستخدام القائمة، يرجى السماح بالوصول إلى الموقع في متصفحك للتأكد من وجودك في المقهى، ثم أعد تحميل هذه الصفحة.",
    locationUnsupportedBody: "جهازك أو متصفحك لا يدعم تحديد الموقع، لذا لا يمكننا التأكد من وجودك في المقهى. يرجى طلب المساعدة من أحد الموظفين.",
  },
};

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let text = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-600",
  green: "bg-green-600",
  orange: "bg-orange-600",
  purple: "bg-purple-600",
  red: "bg-red-600",
  gray: "bg-gray-500",
};

const DEFAULT_PAYMENT_METHODS = [
  { id: "cbe", name: "Commercial Bank of Ethiopia (CBE)", account: "1000123456789", color: "blue" },
  { id: "telebirr", name: "Telebirr", account: "0911 234 567", color: "green" },
  { id: "ebirr", name: "E-birr", account: "0922 345 678", color: "orange" },
];

const CASH_METHOD = { id: "cash", name: "Cash", account: "Pay at the counter", color: "gray" };

const SENTIMENT_EMOJIS = ["😡", "😐", "🙂", "😍"];

const STATUS_INFO: Record<string, { labelKey: string; icon: string; color: string }> = {
  pending:  { labelKey: "statusPending",   icon: "🟡", color: "text-amber-600"       },
  preparing:{ labelKey: "statusPreparing", icon: "🔵", color: "text-blue-600"        },
  ready:    { labelKey: "statusReady",     icon: "🟢", color: "text-green-600"       },
  served:   { labelKey: "statusServed",    icon: "✅", color: "text-muted-foreground" },
};

const WELCOME_TEXT = "እንኳን ወደ ዜድ ፓስትሪ ካፌ በደህና መጡ! እኔ እስራኤል በላይ ነኝ። ዛሬ ምን ማዘዝ ይፈልጋሉ?";

// Table detection: the ONLY source of truth is the `table` param encoded in
// the QR code on that physical table (see staff/qr-generator.tsx). This is
// exact — no GPS, no distance guessing, no "are you inside the café" checks
// that can misfire indoors. Scan the code on Table 4 and you get Table 4's
// menu, every time. If the param is missing (someone opened the bare /menu
// URL without scanning anything), we don't guess — we ask them to scan.
function readTableIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("table");
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

// Cinematic intro — 4 animated phases
type IntroPhase = "enter" | "title" | "ai" | "exit" | "done";

function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<IntroPhase>("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("title"), 500);
    const t2 = setTimeout(() => setPhase("ai"),   1800);
    const t3 = setTimeout(() => { setPhase("exit"); setTimeout(onDone, 900); }, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const dismiss = () => {
    setPhase("exit");
    setTimeout(onDone, 600);
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.6) }       to { opacity:1; transform:scale(1)   } }
        @keyframes fadeIn   { from { opacity:0 }                              to { opacity:1 }                       }
        @keyframes ripple   { 0%,100% { transform:scale(1)   opacity:.4 }    50% { transform:scale(1.6) opacity:0 } }
        @keyframes pulse2   { 0%,100% { opacity:.6 } 50% { opacity:1 } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
        @keyframes exitFade { from { opacity:1 } to { opacity:0 } }
        .anim-fade-up   { animation: fadeUp  .7s cubic-bezier(.22,1,.36,1) both }
        .anim-scale-in  { animation: scaleIn .8s cubic-bezier(.34,1.56,.64,1) both }
        .anim-fade-in   { animation: fadeIn  .6s ease both }
        .anim-slide-up  { animation: slideUp .7s cubic-bezier(.22,1,.36,1) both }
        .anim-exit      { animation: exitFade .8s ease both }
        .ripple-ring    { animation: ripple 2s ease-in-out infinite }
      `}</style>

      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer overflow-hidden ${phase === "exit" ? "anim-exit" : ""}`}
        style={{ background: "linear-gradient(160deg,#fdfaf4 0%,#f6ecd8 50%,#fdfaf4 100%)" }}
        onClick={dismiss}
      >
        {/* Ambient background rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="ripple-ring absolute w-64 h-64 rounded-full border border-amber-700/15" style={{ animationDelay: "0s" }} />
          <div className="ripple-ring absolute w-96 h-96 rounded-full border border-amber-700/15" style={{ animationDelay: ".7s" }} />
          <div className="ripple-ring absolute w-[32rem] h-[32rem] rounded-full border border-amber-700/15" style={{ animationDelay: "1.4s" }} />
        </div>

        {/* Coffee icon — phase: enter */}
        {(phase === "enter" || phase === "title" || phase === "ai" || phase === "exit") && (
          <div className={`anim-scale-in flex flex-col items-center gap-6 px-8 max-w-sm w-full text-center`} style={{ animationDelay: "0.1s" }}>
            {/* Logo mark */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl"
                style={{ background: "linear-gradient(135deg,#d4a017,#a06010)", boxShadow: "0 10px 30px rgba(160,96,16,0.35)" }}>
                ☕
              </div>
              <div className="absolute inset-0 rounded-full blur-xl opacity-30"
                style={{ background: "#c8891a", transform: "scale(1.3)" }} />
            </div>

            {/* Z Pastry Cafe title */}
            {(phase === "title" || phase === "ai" || phase === "exit") && (
              <div className="anim-fade-up space-y-1" style={{ animationDelay: "0s" }}>
                <h1
                  className="text-5xl font-serif font-bold tracking-wide"
                  style={{
                    background: "linear-gradient(135deg,#b8860b,#8a5a10 45%,#c8891a)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 1px 1px rgba(160,96,16,0.2))",
                  }}
                >
                  Z Pastry Cafe
                </h1>
                <p className="text-xs font-semibold tracking-[0.5em] text-amber-800/60 uppercase">Dire Dawa · Ethiopia</p>
              </div>
            )}

            {/* Israel Belay AI card */}
            {(phase === "ai" || phase === "exit") && (
              <div
                className="anim-slide-up w-full rounded-2xl px-6 py-5 space-y-2 border"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  borderColor: "rgba(160,96,16,0.25)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 8px 24px rgba(120,80,20,0.12)",
                  animationDelay: "0s",
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg,#d4a017,#a06010)" }}>IB</div>
                  <div className="text-left">
                    <p lang="am" className="text-stone-800 font-ethiopic font-bold text-base leading-tight">እስራኤል በላይ</p>
                    <p className="text-amber-700/70 text-[10px] font-semibold tracking-widest uppercase">AI Hostess · Z Pastry Cafe</p>
                  </div>
                </div>
                <p lang="am" className="text-stone-700 text-base leading-relaxed font-light font-ethiopic">
                  {WELCOME_TEXT}
                </p>
              </div>
            )}

            <p lang="am" className="text-amber-800/40 text-xs mt-2 font-ethiopic">ለመቀጠል ይጫኑ</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function MenuPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: menuItems = [], isLoading } = useListMenuItems();
  const createOrder = useCreateOrder();
  const requestBill = useRequestBill();
  const [orderType, setOrderType] = useState<"dinein" | "takeaway">("dinein");
  const [billRequested, setBillRequested] = useState(false);
  const createSentiment = useCreateSentimentLog();

  const tableId = readTableIdFromUrl() ?? "";

  const [introVisible, setIntroVisible] = useState(true);
  const [menuMounted, setMenuMounted] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "payment" | "confirm">("cart");
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [sentimentOpen, setSentimentOpen] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<{ id: number; status: string; tableId: string } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [staffChatOpen, setStaffChatOpen] = useState(false);
  const [staffChatInput, setStaffChatInput] = useState("");
  const { data: staffMessages = [] } = useOrderMessages(trackedOrder?.id);
  useOrderMessagesRealtime(trackedOrder?.id);
  const sendOrderMessage = useSendOrderMessage();
  const staffChatEndRef = useRef<HTMLDivElement>(null);
  const [unreadStaffReplies, setUnreadStaffReplies] = useState(0);
  const [israelOpen, setIsraelOpen] = useState(false);
  const [israelMessages, setIsraelMessages] = useState<IsraelMessage[]>([
    { role: "assistant", content: "እንኳን ወደ ዜድ ፓስትሪ ካፌ በደህና መጡ! እኔ እስራኤል በላይ ነኝ። ምናሌያችን ከምን ላስተዋውቅዎ?" }
  ]);
  const [israelInput, setIsraelInput] = useState("");
  const [israelStreaming, setIsraelStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const { data: appSettings } = useAppSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [lang, setLang] = useState<Lang>(() => readStoredLang());
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  useEffect(() => {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  // Geofence — when enabled in Staff Settings, the menu is only shown while
  // the customer's device reports being within radiusMeters of the cafe.
  // watchPosition keeps checking in the background, so if someone walks out
  // mid-session the menu disappears immediately, with no refresh needed.
  type GeoStatus = "disabled" | "checking" | "inside" | "outside" | "denied" | "unsupported";
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("disabled");
  const geofence = appSettings?.geofence;

  useEffect(() => {
    if (!geofence?.enabled || geofence.latitude == null || geofence.longitude == null) {
      setGeoStatus("disabled");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus((prev) => (prev === "inside" || prev === "outside" ? prev : "checking"));
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = distanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          geofence.latitude as number,
          geofence.longitude as number,
        );
        setGeoStatus(d <= geofence.radiusMeters ? "inside" : "outside");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [geofence?.enabled, geofence?.latitude, geofence?.longitude, geofence?.radiusMeters]);

  function handleIntroDone() {
    setIntroVisible(false);
    setMenuMounted(true);
  }

  useEffect(() => {
    if (appSettings?.paymentMethods?.length) setPaymentMethods(appSettings.paymentMethods);
  }, [appSettings]);

  useEffect(() => {
    if (!appSettings?.paymentMethods?.length) return;
    if (selectedPayment && !appSettings.paymentMethods.some((pm) => pm.id === selectedPayment)) {
      setSelectedPayment(null);
    }
  }, [appSettings, selectedPayment]);

  // FIX 1: Real-time menu sync — refresh menu instantly when staff add/edit/delete items
  useEffect(() => {
    const channel = supabase
      .channel("menu-items-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: "key=eq.app" }, (payload: any) => {
        const next = payload.eventType === "DELETE" ? null : payload.new?.value;
        if (next?.paymentMethods?.length) {
          setPaymentMethods(next.paymentMethods);
          queryClient.setQueryData(getAppSettingsQueryKey(), next);
        }
        queryClient.invalidateQueries({ queryKey: getAppSettingsQueryKey() });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Mobile safety net: iOS Safari & Android Chrome throttle background
  // WebSockets, so realtime events get dropped while the screen is off or
  // the tab is hidden. When the page becomes visible / online again, force
  // a refetch of menu + settings so the customer always sees current data.
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getAppSettingsQueryKey() });
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [israelMessages]);

  // Realtime — customer sees order status changes the second staff updates them.
  useEffect(() => {
    if (!trackedOrder || trackedOrder.status === "served") return;
    const orderId = trackedOrder.id;
    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload: any) => {
          const next = payload.new;
          if (!next) return;
          setTrackedOrder((prev) => prev ? { ...prev, status: next.status } : null);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trackedOrder?.id, trackedOrder?.status]);

  // In-page heads-up for when the tab is open and in the foreground — the
  // push notification (src/lib/push.ts) covers the case where the customer
  // has switched apps, locked their phone, or closed the tab entirely.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!trackedOrder) { prevStatusRef.current = null; return; }
    if (prevStatusRef.current && prevStatusRef.current !== "ready" && trackedOrder.status === "ready") {
      toast({ title: t("orderReadyTitle"), description: t("orderReadyDesc", { id: trackedOrder.id }) });
      speakOrderReady(trackedOrder.id);
    }
    prevStatusRef.current = trackedOrder.status;
  }, [trackedOrder?.status]);

  const categories = ["All", ...Array.from(new Set((menuItems as MenuItem[]).map((m) => m.category)))];
  const filteredItems = activeCategory === "All"
    ? (menuItems as MenuItem[]).filter((m) => m.available)
    : (menuItems as MenuItem[]).filter((m) => m.available && m.category === activeCategory);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const exists = prev.find((c) => c.menuItemId === item.id);
      if (exists) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, nameEn: item.nameEn, nameAm: item.nameAm, price: item.price, quantity: 1, imageUrl: item.imageUrl }];
    });
  }

  function updateQty(menuItemId: number, delta: number) {
    setCart((prev) => prev.map((c) => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0));
  }

  async function placeOrder() {
    try {
      const order = await createOrder.mutateAsync({
        data: {
          tableId,
          paymentMethod: selectedPayment ?? "cash",
          orderType,
          items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        },
      });
      setLastOrderId(order.id);
      setTrackedOrder({ id: order.id, status: order.status, tableId });
      setBillRequested(false);
      setCart([]);
      setCartOpen(false);
      setCheckoutStep("cart");
      setSelectedPayment(null);
      setSentimentOpen(true);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: t("orderPlacedTitle"), description: t("orderPlacedDesc", { id: order.id }) });
      subscribeOrderToPush(order.id, tableId).then((enabled) => {
        setPushEnabled(enabled);
        if (enabled) {
          toast({ title: t("notifOnTitle"), description: t("notifOnDesc") });
        }
      });
    } catch {
      toast({ title: t("errorTitle"), description: t("orderFailedDesc"), variant: "destructive" });
    }
  }

  async function handleRequestBill() {
    if (!trackedOrder) return;
    try {
      await requestBill.mutateAsync({ id: trackedOrder.id });
      setBillRequested(true);
      toast({ title: t("billRequestedTitle"), description: t("billRequestedDesc") });
    } catch {
      toast({ title: t("errorTitle"), description: t("billFailedDesc"), variant: "destructive" });
    }
  }

  async function sendStaffMessage() {
    const text = staffChatInput.trim();
    if (!text || !trackedOrder) return;
    setStaffChatInput("");
    try {
      await sendOrderMessage.mutateAsync({
        orderId: trackedOrder.id,
        tableId: trackedOrder.tableId,
        sender: "customer",
        message: text,
      });
    } catch {
      toast({ title: t("messageFailedTitle"), description: t("messageFailedDesc"), variant: "destructive" });
    }
  }
  const [uploadingBillPhoto, setUploadingBillPhoto] = useState(false);
  async function sendBillPhoto(file: File) {
    if (!trackedOrder) return;
    setUploadingBillPhoto(true);
    try {
      const url = await uploadBillPhoto(file, trackedOrder.id);
      await sendOrderMessage.mutateAsync({
        orderId: trackedOrder.id,
        tableId: trackedOrder.tableId,
        sender: "customer",
        message: "📷 Bill photo",
        imageUrl: url,
      });
    } catch {
      toast({ title: t("messageFailedTitle"), description: t("messageFailedDesc"), variant: "destructive" });
    } finally {
      setUploadingBillPhoto(false);
    }
  }

  // Badge the chat bubble when staff reply while the panel is closed.
  const lastSeenStaffCountRef = useRef(0);
  useEffect(() => {
    const staffReplyCount = staffMessages.filter((m) => m.sender === "staff").length;
    if (staffChatOpen) {
      lastSeenStaffCountRef.current = staffReplyCount;
      setUnreadStaffReplies(0);
    } else if (staffReplyCount > lastSeenStaffCountRef.current) {
      setUnreadStaffReplies(staffReplyCount - lastSeenStaffCountRef.current);
    }
  }, [staffMessages, staffChatOpen]);

  useEffect(() => {
    staffChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staffMessages, staffChatOpen]);


  async function submitSentiment(emoji: string) {
    await createSentiment.mutateAsync({
      data: { tableId, emoji, orderId: lastOrderId ?? undefined },
    });
    setSentimentOpen(false);
    toast({ title: t("thankYouTitle"), description: t("feedbackRecordedDesc") });
  }

  async function sendIsraelMessage(text?: string) {
    const userMsg = (text ?? israelInput).trim();
    if (!userMsg || israelStreaming) return;
    setIsraelInput("");
    const updatedHistory: IsraelMessage[] = [...israelMessages, { role: "user", content: userMsg }];
    setIsraelMessages(updatedHistory);
    setIsraelStreaming(true);

    let assistantContent = "";
    setIsraelMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const { url, publishableKey } = getSupabaseConfig();

      if (!isSupabaseConfigured() || !url || !publishableKey) {
        throw new Error("AI hostess is not configured yet. Add Supabase environment variables in Vercel and redeploy.");
      }

      const res = await fetch(`https://ncoqjumzkmlrdcesusbj.supabase.co/functions/v1/hana-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jb3FqdW16a21scmRjZXN1c2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzY1ODcsImV4cCI6MjA5OTgxMjU4N30.PYx2ERejs2PH5x_yWJ-8F_iLaURMtujs1oQgw0XakaA`,
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jb3FqdW16a21scmRjZXN1c2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzY1ODcsImV4cCI6MjA5OTgxMjU4N30.PYx2ERejs2PH5x_yWJ-8F_iLaURMtujs1oQgw0XakaA",
        },
        body: JSON.stringify({
          message: userMsg,
          tableId,
          history: israelMessages.map((m) => ({ role: m.role, content: m.content })),
          menu: (menuItems as MenuItem[])
            .filter((m) => m.available)
            .map((m) => ({
              nameEn: m.nameEn,
              nameAm: m.nameAm,
              price: m.price,
              category: m.category,
              description: m.description ?? "",
            })),
        }),
      });
      if (!res.ok) throw new Error("chat failed");
      const data = await res.json();
      assistantContent = data.reply ?? "";
      setIsraelMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: assistantContent };
        return updated;
      });
    } catch {
      setIsraelMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "ይቅርታ፣ ችግር ተፈጥሯል።" };
        return updated;
      });
    } finally {
      setIsraelStreaming(false);
    }
  }

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice not supported", description: "Use text input instead.", variant: "destructive" });
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "am-ET";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setIsraelInput(transcript);
      setTimeout(() => sendIsraelMessage(transcript), 200);
    };
    rec.start();
  }, [israelMessages, israelStreaming]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const cartItemCount = (id: number) => cart.find((c) => c.menuItemId === id)?.quantity ?? 0;

  const allPaymentMethods = [...paymentMethods, CASH_METHOD];
  const selectedPmLabel = selectedPayment
    ? allPaymentMethods.find((p) => p.id === selectedPayment)?.name ?? selectedPayment
    : "Cash";

  // Table gate — the QR code on the table is the only real table detector.
  // If it's missing (bare /menu URL, no scan), don't guess a table: ask the
  // customer to scan the code so every order lands on the right table.
  if (!tableId) {
    return (
      <div dir={LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr"} className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: "linear-gradient(160deg,#fdfaf4 0%,#f6ecd8 50%,#fdfaf4 100%)" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl" style={{ background: "linear-gradient(135deg,#d4a017,#a06010)" }}>
          📷
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="font-serif font-bold text-xl text-amber-900">{t("qrScanTitle")}</h2>
          <p className="text-sm text-amber-800/70">
            {t("qrScanBody")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              data-testid={`button-language-${l.code}`}
              onClick={() => setLang(l.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                lang === l.code ? "bg-amber-800 text-white" : "bg-amber-800/10 text-amber-900 hover:bg-amber-800/20"
              }`}
            >
              {l.nativeName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Geofence gate — if Staff Settings has "Location Lock" enabled, the menu
  // itself is replaced by this screen the instant the device is confirmed
  // outside the cafe radius (or location can't be confirmed at all).
  if (geoStatus === "outside" || geoStatus === "denied" || geoStatus === "unsupported" || geoStatus === "checking") {
    const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";
    const icon = geoStatus === "checking" ? "📍" : geoStatus === "outside" ? "🚫" : "📵";
    const title =
      geoStatus === "checking" ? t("checkingLocation") :
      geoStatus === "outside" ? t("outsideCafeTitle") :
      t("locationNeededTitle");
    const body =
      geoStatus === "outside" ? t("outsideCafeBody") :
      geoStatus === "denied" ? t("locationNeededBody") :
      geoStatus === "unsupported" ? t("locationUnsupportedBody") : "";
    return (
      <div dir={dir} className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: "linear-gradient(160deg,#fdfaf4 0%,#f6ecd8 50%,#fdfaf4 100%)" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl" style={{ background: "linear-gradient(135deg,#d4a017,#a06010)" }}>
          {icon}
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="font-serif font-bold text-xl text-amber-900">{title}</h2>
          {body && <p className="text-sm text-amber-800/70">{body}</p>}
        </div>
        {geoStatus !== "checking" && (
          <div className="flex gap-2 flex-wrap justify-center">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                data-testid={`button-language-${l.code}`}
                onClick={() => setLang(l.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  lang === l.code ? "bg-amber-800 text-white" : "bg-amber-800/10 text-amber-900 hover:bg-amber-800/20"
                }`}
              >
                {l.nativeName}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes menuFadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cardIn     { from { opacity:0; transform:scale(.94) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes headerIn   { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes statusIn   { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        .menu-enter  { animation: menuFadeIn .6s cubic-bezier(.22,1,.36,1) both }
        .header-in   { animation: headerIn   .5s cubic-bezier(.22,1,.36,1) both }
        .status-in   { animation: statusIn   .4s cubic-bezier(.22,1,.36,1) both }
      `}</style>

      {introVisible && <CinematicIntro onDone={handleIntroDone} />}

      <div dir={LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr"} className={`min-h-screen bg-background ${menuMounted ? "menu-enter" : "opacity-0"}`}>

        {/* Order Status Tracker */}
        {trackedOrder && trackedOrder.status !== "served" && (
          <div className="status-in fixed top-0 left-0 right-0 z-50 bg-card border-b border-card-border px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{STATUS_INFO[trackedOrder.status]?.icon ?? "🟡"}</span>
              <div>
                <p className={`text-xs font-bold ${STATUS_INFO[trackedOrder.status]?.color}`}>
                  {STATUS_INFO[trackedOrder.status] ? t(STATUS_INFO[trackedOrder.status].labelKey) : trackedOrder.status}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {t("orderHash", { id: trackedOrder.id })} · {t("table")} {trackedOrder.tableId} · {t("autoRefreshing")}
                  {pushEnabled && <Bell size={10} className="opacity-70" />}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                data-testid="button-message-staff"
                onClick={() => setStaffChatOpen(true)}
                className="relative text-[11px] font-bold px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-border active:scale-95 transition-all"
              >
                💬 {t("messageStaff")}
                {unreadStaffReplies > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {unreadStaffReplies}
                  </span>
                )}
              </button>
              <button
                data-testid="button-request-bill"
                onClick={handleRequestBill}
                disabled={billRequested || requestBill.isPending}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-all ${
                  billRequested
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-default"
                    : "bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow"
                }`}
              >
                {billRequested ? t("billOnWay") : requestBill.isPending ? t("sending") : t("requestBill")}
              </button>
              <button onClick={() => setTrackedOrder(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={14} />
              </button>
            </div>
          </div>
        )}


        {/* Header */}
        <header
          className={`sticky top-0 z-40 bg-primary text-primary-foreground shadow-lg header-in ${trackedOrder && trackedOrder.status !== "served" ? "mt-10" : ""}`}
          style={{ animationDelay: "0.1s" }}
        >
          <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-wide">Z Pastry Cafe</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-sans font-semibold tracking-[0.35em] opacity-70">DIRE DAWA</p>
                <span
                  data-testid="badge-table-id"
                  className="text-[10px] font-bold tracking-wide bg-primary-foreground/15 rounded-full px-2 py-0.5"
                >
                  {t("table")} {tableId}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  data-testid="button-language-picker"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  className="bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full px-3 py-2 text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                >
                  🌐 <span className="hidden sm:inline">{LANGUAGES.find((l) => l.code === lang)?.nativeName}</span>
                </button>
                {langMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 z-50 bg-card border border-card-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-3 pt-2.5 pb-1">{t("chooseLanguage")}</p>
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          data-testid={`button-language-${l.code}`}
                          onClick={() => { setLang(l.code); setLangMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            lang === l.code ? "bg-secondary font-semibold text-foreground" : "text-foreground/80 hover:bg-secondary/60"
                          }`}
                        >
                          {l.nativeName}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                data-testid="button-cart"
                onClick={() => { setCartOpen(true); setCheckoutStep("cart"); }}
                className="relative bg-accent text-accent-foreground rounded-full px-4 py-2 font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
              >
                <ClipboardList size={18} />
                <span>{t("orderButton")}</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Category filter */}
          <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                data-testid={`button-category-${cat}`}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                  activeCategory === cat
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20"
                }`}
              >
                {cat === "All" ? t("allCategory") : cat}
              </button>
            ))}
          </div>
        </header>

        {/* Menu grid */}
        <main className="max-w-5xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card rounded-2xl h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item, idx) => {
                const qty = cartItemCount(item.id);
                return (
                  <div
                    key={item.id}
                    data-testid={`card-menu-${item.id}`}
                    className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                    style={{
                      animation: "cardIn .5s cubic-bezier(.22,1,.36,1) both",
                      animationDelay: `${idx * 0.05}s`,
                    }}
                  >
                    <div className="h-40 bg-muted relative overflow-hidden group">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.nameEn}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">☕</div>
                      )}
                      <Badge className="absolute top-2 left-2 text-xs bg-primary/90 text-primary-foreground border-0 shadow">
                        {item.category}
                      </Badge>
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <p className="font-serif font-semibold text-sm leading-tight text-card-foreground">{item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{item.nameAm}</p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-accent font-bold text-sm mt-auto">ETB {item.price.toFixed(0)}</p>
                      {qty === 0 ? (
                        <button
                          data-testid={`button-add-${item.id}`}
                          onClick={() => addToCart(item)}
                          className="mt-2 w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
                        >
                          {t("addToOrder")}
                        </button>
                      ) : (
                        <div className="mt-2 flex items-center justify-between bg-secondary rounded-lg px-2 py-1">
                          <button data-testid={`button-minus-${item.id}`} onClick={() => updateQty(item.id, -1)} className="p-1 hover:text-destructive transition-colors active:scale-90"><Minus size={14} /></button>
                          <span className="font-bold text-sm">{qty}</span>
                          <button data-testid={`button-plus-${item.id}`} onClick={() => updateQty(item.id, 1)} className="p-1 hover:text-primary transition-colors active:scale-90"><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Cart Modal */}
        <Dialog open={cartOpen} onOpenChange={setCartOpen}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif">
                {checkoutStep === "cart" ? t("yourOrder") : checkoutStep === "payment" ? t("choosePayment") : t("confirmOrder")}
              </DialogTitle>
            </DialogHeader>

            {checkoutStep === "cart" && (
              <div className="flex flex-col gap-4 flex-1 overflow-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t("orderEmpty")}</p>
                ) : (
                  <>
                    <div className="space-y-3 overflow-auto">
                      {cart.map((item) => (
                        <div key={item.menuItemId} data-testid={`cart-item-${item.menuItemId}`} className="flex items-center gap-3 bg-secondary rounded-xl p-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.nameEn}</p>
                            <p className="text-xs text-muted-foreground">{item.nameAm}</p>
                            <p className="text-accent font-bold text-sm">ETB {(item.price * item.quantity).toFixed(0)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(item.menuItemId, -1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors active:scale-90"><Minus size={12} /></button>
                            <span className="w-4 text-center font-bold text-sm">{item.quantity}</span>
                            <button onClick={() => updateQty(item.menuItemId, 1)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-90"><Plus size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-3 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {t("whereHaveIt")}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setOrderType("dinein")}
                            className={`rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
                              orderType === "dinein"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary text-foreground"
                            }`}
                          >
                            🍽️ {t("dineIn")}
                            <div className="text-[10px] font-normal opacity-70 mt-0.5">{t("table")} {tableId}</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderType("takeaway")}
                            className={`rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
                              orderType === "takeaway"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary text-foreground"
                            }`}
                          >
                            🥡 {t("takeaway")}
                            <div className="text-[10px] font-normal opacity-70 mt-0.5">{t("toGo")}</div>
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t("total")}</span>
                        <span className="text-accent">ETB {cartTotal.toFixed(0)}</span>
                      </div>
                      <Button data-testid="button-checkout" onClick={() => setCheckoutStep("payment")} className="w-full">
                        {t("proceedToPayment")}
                      </Button>
                    </div>

                  </>
                )}
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {t("selectPaymentFor", { amount: cartTotal.toFixed(0) })} <span className="text-xs opacity-60">{t("optionalToggle")}</span>
                </p>
                <div className="space-y-2">
                  {allPaymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      data-testid={`button-payment-${pm.id}`}
                      onClick={() => setSelectedPayment(pm.id === selectedPayment ? null : pm.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        selectedPayment === pm.id
                          ? "border-primary bg-secondary shadow-sm"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_MAP[pm.color] ?? "bg-gray-500"}`} />
                      <div className="text-left flex-1">
                        <p className="font-semibold text-sm">{pm.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{pm.account}</p>
                      </div>
                      {selectedPayment === pm.id && <div className="w-4 h-4 rounded-full bg-primary shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCheckoutStep("cart")} className="flex-1">{t("back")}</Button>
                  <Button data-testid="button-confirm-payment" onClick={() => setCheckoutStep("confirm")} className="flex-1">{t("continueBtn")}</Button>
                </div>
              </div>
            )}

            {checkoutStep === "confirm" && (
              <div className="flex flex-col gap-4">
                <div className="bg-secondary rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold">{t("orderSummary", { id: tableId })}</p>
                  {cart.map((item) => (
                    <div key={item.menuItemId} className="flex justify-between text-sm">
                      <span>{item.nameEn} x{item.quantity}</span>
                      <span>ETB {(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span>{t("total")}</span>
                    <span className="text-accent">ETB {cartTotal.toFixed(0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">{t("paymentLabel", { method: selectedPmLabel })}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCheckoutStep("payment")} className="flex-1">{t("back")}</Button>
                  <Button
                    data-testid="button-place-order"
                    onClick={placeOrder}
                    disabled={createOrder.isPending}
                    className="flex-1"
                  >
                    {createOrder.isPending ? t("placing") : t("placeOrder")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Sentiment Modal */}
        <Dialog open={sentimentOpen} onOpenChange={setSentimentOpen}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">{t("howWasExperience")}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm mb-2">{t("tapToRate")}</p>
            <div className="flex justify-center gap-4 my-4">
              {SENTIMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  data-testid={`button-sentiment-${emoji}`}
                  onClick={() => submitSentiment(emoji)}
                  className="text-4xl hover:scale-125 active:scale-110 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button onClick={() => setSentimentOpen(false)} className="text-xs text-muted-foreground underline">{t("skip")}</button>
          </DialogContent>
        </Dialog>

        {/* Message Staff — quick chat scoped to this order, e.g. "food is late?" */}
        <Dialog open={staffChatOpen} onOpenChange={setStaffChatOpen}>
          <DialogContent className="max-w-sm p-0 overflow-hidden flex flex-col" style={{ height: "480px" }}>
            <DialogHeader className="bg-primary text-primary-foreground px-4 py-3 space-y-0">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquareText size={16} /> {t("messageStaff")}
              </DialogTitle>
              <p className="text-xs opacity-70">
                {t("orderHash", { id: trackedOrder?.id ?? "" })} · {t("table")} {trackedOrder?.tableId}
              </p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
              {staffMessages.length === 0 && (
                <p className="text-center text-xs text-muted-foreground pt-6">
                  {t("askStaffPlaceholder")}
                </p>
              )}
              {staffMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.sender === "customer"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm"
                  }`}>
                    {msg.sender === "staff" && (
                      <p className="text-[10px] font-bold opacity-60 mb-0.5">{msg.waiterName || "Staff"}</p>
                    )}
                    {msg.imageUrl ? (<img src={msg.imageUrl} alt="Bill photo" className="max-w-full rounded-lg" />) : (msg.message)}
                  </div>
                </div>
              ))}
              <div ref={staffChatEndRef} />
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input
                data-testid="input-staff-message"
                value={staffChatInput}
                onChange={(e) => setStaffChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendStaffMessage()}
                placeholder={t("typeMessagePlaceholder")}
                className="flex-1 text-sm bg-secondary rounded-xl px-3 py-2 outline-none border border-border focus:border-ring placeholder:text-muted-foreground"
                disabled={sendOrderMessage.isPending}
              />
              <button
                data-testid="button-send-staff-message"
                onClick={sendStaffMessage}
                disabled={sendOrderMessage.isPending || !staffChatInput.trim()}
                className="bg-primary text-primary-foreground rounded-xl px-3 py-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                <Send size={16} />
              </button>
              <input
                type="file"
                accept="image/*"
                id="bill-photo-input"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) sendBillPhoto(f); e.target.value = ""; }}
              />
              <button
                data-testid="button-send-bill-photo"
                onClick={() => document.getElementById("bill-photo-input")?.click()}
                disabled={uploadingBillPhoto}
                className="bg-secondary text-secondary-foreground rounded-xl px-3 py-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                title="Send bill payment screenshot"
              >
                <Camera size={16} />
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="max-w-5xl mx-auto px-4 py-6 mt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">© Z Pastry Cafe · Dire Dawa, Ethiopia</p>
        </footer>

        {/* Israel Belay Floating Chat */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {israelOpen && (
            <div
              className="w-80 bg-card border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              style={{ height: "450px", animation: "cardIn .3s cubic-bezier(.22,1,.36,1) both" }}
            >
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">IB</div>
                <div className="flex-1 min-w-0">
                  <p lang="am" className="font-ethiopic font-bold text-sm leading-tight">እስራኤል በላይ</p>
                  <p className="text-xs opacity-60">Israel Belay · አማርኛ</p>
                </div>
                <button onClick={() => setIsraelOpen(false)} className="hover:opacity-70 transition-opacity shrink-0"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {israelMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div lang="am" className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed font-ethiopic ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-secondary-foreground rounded-tl-sm"
                    }`}>
                      {msg.content || <span className="opacity-40 animate-pulse">●●●</span>}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  data-testid="input-israel-message"
                  lang="am"
                  value={israelInput}
                  onChange={(e) => setIsraelInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendIsraelMessage()}
                  placeholder={isListening ? "ማዳመጫ ላይ..." : "ይጻፉ ወይም ይናገሩ..."}
                  className="flex-1 text-sm font-ethiopic bg-secondary rounded-xl px-3 py-2 outline-none border border-border focus:border-ring placeholder:text-muted-foreground"
                  disabled={israelStreaming || isListening}
                />
                <button
                  data-testid="button-israel-mic"
                  onClick={isListening ? stopListening : startListening}
                  disabled={israelStreaming}
                  className={`rounded-xl px-3 py-2 transition-all disabled:opacity-50 ${isListening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  data-testid="button-israel-send"
                  onClick={() => sendIsraelMessage()}
                  disabled={israelStreaming || !israelInput.trim()}
                  className="bg-primary text-primary-foreground rounded-xl px-3 py-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
          <button
            data-testid="button-israel-toggle"
            onClick={() => setIsraelOpen(!israelOpen)}
            className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all relative"
            style={{ background: "linear-gradient(135deg,#c8891a,#a06010)" }}
          >
            {israelOpen ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
            {!israelOpen && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none shadow">AI</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}