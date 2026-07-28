// Z Pastry Cafe service worker — only job is Web Push delivery.
// This runs in the background, independent of any open tab, which is what
// lets "Order ready" reach the customer even after they've left the page.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Z Pastry Cafe", body: "Your order is ready!" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push payload — fall back to the default text above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.orderId ? `order-${payload.orderId}` : undefined,
      data: { orderId: payload.orderId, url: "/menu" },
      requireInteraction: true,
      renotify: true,
      vibrate: [400, 150, 400, 150, 400, 150, 400],
      silent: false,
    }),
  );
});

// Tapping the notification focuses an already-open Z Pastry Cafe tab if there is
// one, otherwise opens a fresh one straight to the menu.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/menu";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/menu") && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});