// 배수로 지킴이 (Drainage Master) PWA Service Worker
// 지도 타일 영구 오프라인 캐싱 및 앱 리소스 캐시

const CACHE_NAME = 'drainmanager-app-v2';
const MAP_TILES_CACHE = 'drainmanager-map-tiles-v1';

// 설치 시 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 활성화 시 구버전 캐시 정리 및 클라이언트 제어 시작
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
        // A. 요청 URL과 직접 매칭
        let cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // B. OSM 서브도메인(a., b., c.) 교차 매칭 지원
        if (url.hostname.includes('tile.openstreetmap.org')) {
          const directMatch =
            (await cache.match(`https://a.tile.openstreetmap.org${url.pathname}`)) ||
            (await cache.match(`https://b.tile.openstreetmap.org${url.pathname}`)) ||
            (await cache.match(`https://c.tile.openstreetmap.org${url.pathname}`)) ||
            (await cache.match(`https://tile.openstreetmap.org${url.pathname}`));

          if (directMatch) {
            return directMatch;
          }
        }

        // C. 캐시에 없으면 네트워크에서 다운로드 후 영구 캐시에 보관
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // 완전 오프라인이고 캐시에도 없는 외곽 타일일 경우, 엑박 방지용 짙은 슬레이트 투명 타일 반환
          const fallbackSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
              <rect width="256" height="256" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
            </svg>
          `;
          return new Response(fallbackSvg, {
            headers: { 'Content-Type': 'image/svg+xml' },
            status: 200,
          });
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
