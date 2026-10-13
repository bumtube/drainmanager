// 배수로 지킴이 (Drainage Master) PWA Service Worker
// 지도 타일 영구 오프라인 캐싱 및 앱 리소스 캐시

const CACHE_NAME = 'drainmanager-app-v1';
const MAP_TILES_CACHE = 'drainmanager-map-tiles-v1';

// 설치 시 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 활성화 시 구버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== MAP_TILES_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 네트워크 요청 가로채기 (지도 타일 영구 오프라인 캐싱)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 지도 타일 이미지 요청 (OpenStreetMap 일반지도 및 Esri ArcGIS 위성지도)
  const isMapTile =
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com');

  if (isMapTile) {
    event.respondWith(
      caches.open(MAP_TILES_CACHE).then(async (cache) => {
        // A. 캐시에 저장된 타일이 있으면 네트워크 요청 없이 즉시 반환 (데이터 소모 0)
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // B. 캐시에 없으면 다운로드 후 영구 캐시에 저장
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // 오프라인 상태이고 캐시에도 없는 경우 기본 반환
          return cachedResponse || new Response('Offline tile unavailable', { status: 503 });
        }
      })
    );
    return;
  }

  // 2. Firebase/Firestore 실시간 동기화 등 클라우드 API는 캐싱 제외
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebase')) {
    return;
  }

  // 3. 앱 정적 파일 캐시 (Stale-While-Revalidate 전략)
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});
