// 배수로 지킴이 - 현장 지도 타일 오프라인 프리캐싱 서비스
// 성남시 분당구 불정로 50 부지 반경 300m (줌 레벨 16, 17, 18 전체)

export const MAP_TILES_CACHE_NAME = 'drainmanager-map-tiles-v1';

// 성남시 분당구 불정로 50 부지 및 주변 정자 앞/시설 경계 좌표
const BOUNDS = {
  minLat: 37.3557,
  maxLat: 37.3611,
  minLng: 127.1081,
  maxLng: 127.1149,
};

const ZOOM_LEVELS = [16, 17, 18];

// 경도 -> 타일 X 좌표 계산 공식 (Slippy Map Tile math)
function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

// 위도 -> 타일 Y 좌표 계산 공식 (Mercator projection)
function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

// 현장 부지 전체의 타일 목록(좌표) 계산
export function getFacilityTileCoords(): { z: number; x: number; y: number }[] {
  const tiles: { z: number; x: number; y: number }[] = [];

  for (const z of ZOOM_LEVELS) {
    const minX = lon2tile(BOUNDS.minLng, z);
    const maxX = lon2tile(BOUNDS.maxLng, z);
    const minY = lat2tile(BOUNDS.maxLat, z); // 위도는 클수록 Y가 작음
    const maxY = lat2tile(BOUNDS.minLat, z);

    for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
      for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  return tiles;
}

// 현장 타일의 OpenStreetMap URL 리스트 생성
export function getFacilityTileUrls(): string[] {
  const coords = getFacilityTileCoords();
  return coords.map((c) => `https://a.tile.openstreetmap.org/${c.z}/${c.x}/${c.y}.png`);
}

// 현재 캐시되어 있는 지도 타일 개수 확인
export async function getMapTileCacheCount(): Promise<number> {
  if (!('caches' in window)) return 0;
  try {
    const cache = await caches.open(MAP_TILES_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch (err) {
    console.warn('Failed to get map tile cache count:', err);
    return 0;
  }
}

// 현장 부지 지도 타일 영구 백그라운드 프리캐싱 실행
export async function precacheFacilityMapTiles(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ success: boolean; total: number; downloaded: number }> {
  if (!('caches' in window)) {
    return { success: false, total: 0, downloaded: 0 };
  }

  const coords = getFacilityTileCoords();
  const total = coords.length;
  let downloaded = 0;

  try {
    const cache = await caches.open(MAP_TILES_CACHE_NAME);

    // 병렬 6개씩 청크 다운로드 (네트워크 혼잡 방지)
    const chunkSize = 6;
    for (let i = 0; i < coords.length; i += chunkSize) {
      const chunk = coords.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async ({ z, x, y }) => {
          const tilePath = `/${z}/${x}/${y}.png`;
          // Leaflet이 요청할 수 있는 a, b, c 서브도메인 및 기본 URL 모두 캐싱
          const targetUrls = [
            `https://a.tile.openstreetmap.org${tilePath}`,
            `https://b.tile.openstreetmap.org${tilePath}`,
            `https://c.tile.openstreetmap.org${tilePath}`,
            `https://tile.openstreetmap.org${tilePath}`,
          ];

          // 이미 캐시에 있는지 확인
          const existing = await cache.match(targetUrls[0]);
          if (!existing) {
            try {
              const res = await fetch(targetUrls[0], { mode: 'cors' });
              if (res && res.status === 200) {
                const blob = await res.blob();
                // 모든 서브도메인 요청에 즉시 응답하도록 동일 blob을 복사 캐싱
                for (const url of targetUrls) {
                  await cache.put(
                    url,
                    new Response(blob.slice(), {
                      headers: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'public, max-age=31536000',
                      },
                    })
                  );
                }
              }
            } catch (fetchErr) {
              console.warn(`Tile fetch failed: ${z}/${x}/${y}`, fetchErr);
            }
          }

          downloaded++;
          if (onProgress) {
            onProgress(downloaded, total);
          }
        })
      );
    }

    return { success: true, total, downloaded };
  } catch (err) {
    console.error('Tile precaching failed:', err);
    return { success: false, total, downloaded };
  }
}
