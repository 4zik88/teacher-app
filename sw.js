/* Офлайн-кеш: стратегія «спочатку мережа».
   Онлайн — завжди свіжа версія із сервера (жодних ручних оновлень версій),
   офлайн — застосунок відкривається з кешу. */
var CACHE = "teacher-app-live";

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(["./", "./index.html"]);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  /* запити синхронізації та живий канал не чіпаємо */
  if (e.request.url.indexOf("/api/") !== -1) return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return resp;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) {
        return r || caches.match("./index.html");
      });
    })
  );
});
