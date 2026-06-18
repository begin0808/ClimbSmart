const CACHE_NAME = "tw100peaks-cache-v1";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/icon.svg",
  "/manifest.json"
];

// 安裝服務工作執行緒，預先快取核心資源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// 啟用服務工作執行緒，清除舊快取
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 攔截網頁請求，套用 Stale-While-Revalidate (快取優先，並在背景更新) 策略
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // 只快取同源的資源、Google 字型與 Leaflet 本地庫，避免快取龐大的地形圖磚吃滿容量
  const shouldCache =
    requestUrl.origin === self.location.origin ||
    requestUrl.hostname.includes("fonts") ||
    requestUrl.pathname.includes("leaflet");

  if (!shouldCache || event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // 如果快取中有，先回傳快取，並在背景抓取最新版來更新快取
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // 忽略背景下載失敗
          });
        return cachedResponse;
      }

      // 如果快取中沒有，去網路抓取並加入快取
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // 當使用者完全離線且無快取時的導航降級回退
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
