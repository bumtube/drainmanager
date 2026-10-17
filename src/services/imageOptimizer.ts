/**
 * 이미지 최적화 및 압축 유틸리티
 * Firebase Firestore의 1MB 단일 문서 제한을 준수하도록 사진을 선명하면서도 가볍게 압축합니다.
 */

export async function compressBase64Image(
  base64Str: string,
  maxDimension: number = 960,
  quality: number = 0.65
): Promise<string> {
  if (!base64Str || typeof base64Str !== 'string') return '';
  // SVG나 일반 URL은 압축 불필요
  if (base64Str.startsWith('data:image/svg+xml') || base64Str.startsWith('http')) {
    return base64Str;
  }
  if (!base64Str.startsWith('data:image')) {
    return base64Str;
  }

  // 브라우저 환경이 아닌 경우 그대로 반환
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return base64Str;
  }

  // 이미 120KB 이하로 충분히 작은 이미지면 변환 건너뜀
  if (base64Str.length < 120 * 1024) {
    return base64Str;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // 가로/세로 중 긴 쪽을 maxDimension 이하로 리사이징
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Str);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          console.warn('Canvas compression failed, using original:', err);
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
      img.src = base64Str;
    } catch {
      resolve(base64Str);
    }
  });
}

/**
 * 업로드된 File 객체를 읽어 가로/세로 960px 이하 및 JPEG 0.65 품질로 압축 변환
 */
export function fileToBase64Compressed(
  file: File,
  maxDimension: number = 960,
  quality: number = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBase64 = e.target?.result as string;
      if (!rawBase64) {
        resolve('');
        return;
      }
      try {
        const compressed = await compressBase64Image(rawBase64, maxDimension, quality);
        resolve(compressed);
      } catch {
        resolve(rawBase64);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

