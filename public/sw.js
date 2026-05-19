// Service worker for Web Push notifications.
// Deliberately kept minimal — no offline caching.
// Must be served with Cache-Control: no-cache, no-store, must-revalidate
// so updates ship immediately (configured in next.config.mjs).

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Diemen Badminton", body: event.data.text() };
  }

  const { title = "Diemen Badminton", body = "", url = "/", tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  // Restrict navigation to same origin to prevent open-redirect via payload url.
  const safeUrl = (() => {
    try {
      const u = new URL(targetUrl, self.location.origin);
      return u.origin === self.location.origin ? u.href : "/";
    } catch {
      return "/";
    }
  })();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab at this origin if available.
        for (const client of windowClients) {
          if (new URL(client.url).origin === self.location.origin) {
            client.navigate(safeUrl);
            return client.focus();
          }
        }
        return clients.openWindow(safeUrl);
      })
  );
});
