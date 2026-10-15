self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Present so Chrome treats the site as an installable app. Requests stay on the network.
self.addEventListener("fetch", () => {});
