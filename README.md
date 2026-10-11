# 배수로 지킴이 (Drainage Master)

**야외 현장 맞춤형 배수로 위치 및 상태 점검 모바일 웹앱 (PWA 지원)**

스마트폰 브라우저 표준 기능(HTML5 GPS, 카메라, Canvas API)만으로 동작하는 배수로 현장 점검 웹앱입니다. 야외 직사광선, 작업 장갑 착용, 불안정한 통신 환경을 고려하여 직관적이고 군더더기 없는 UI/UX를 제공합니다.

---

## 🌟 주요 핵심 기능

### 1. 역할 기반 접근 제어 (RBAC)
- **현장 점검자 (주사님 모드)**:
  - 배수로 위치 및 제원은 🔒 읽기 전용으로 안전하게 보호
  - 배수로 선택 시 최소 56px 크기의 대형 `[점검 시작]` 버튼 제공
  - 과거 점검 이력 타임라인 열람
- **시설 관리자 (Admin 모드 - 초기 PIN: 1234)**:
  - 현장에서 GPS 및 위성 지도를 확인하며 `[+ 신규 배수로 핀 등록]`
  - 지도 핀을 손가락으로 드래그하여 실제 배수로 테두리에 미세조정(Drag)
  - 배수로 제원 수정 및 삭제
  - 총괄 통계 대시보드, **엑셀(XLSX) 총괄표 다운로드**, **공공기관 제출용 현장 사진대지 A4 인쇄/PDF** 지원

### 2. 고스트 카메라 오버레이 (Ghost Camera Overlay)
- `navigator.mediaDevices.getUserMedia` 후면 카메라 지원
- **직전 점검 사진 반투명 오버레이**: 직전 점검 사진을 투명도 0~100% 슬라이더로 겹쳐 동일 구도/각도로 전·후 사진 일치 유도
- **현장 워터마크 자동 합성**: 촬영 즉시 Canvas API를 통해 좌측 하단에 `[점검일시 | 배수로명 | 위경도(GPS오차) | 점검자]` 텍스트 각인

### 3. 장갑 착용 친화형 원터치 점검 폼 (Quick Form)
- 타이핑을 최소화한 56px 이상 대형 버튼
- **퇴적 상태**: `[정상 (<30%)]` / `[준설필요 (>30%)]` / `[완전막힘]`
- **구조 상태**: `[정상]` / `[균열/이탈]` / `[파손/붕괴]`
- **조치 구분**: `[정기점검]` / `[긴급조치]`
- **비포/애프터 분할 비교 슬라이더**: 썸네일 클릭 시 전후 사진을 좌우로 밀어보는 인터랙티브 비교 팝업
- **Web Speech API 음성 메모**: 마이크 버튼을 눌러 현장 특이사항을 말로 자동 입력
- 원클릭 저장 및 로컬 우선(IndexedDB) 보관

### 4. 고해상도 위성지도 및 실시간 위치 추적
- Leaflet 기반: **위성 사진(Esri Satellite)** 및 **일반 지도(OpenStreetMap)** 원클릭 토글
- 실시간 HTML5 GPS `watchPosition` 연동 및 상단 "GPS 오차: 3.2m - 양호" 실시간 표시
- 상태별 커스텀 핀: 정상(초록), 주의(주황), 긴급(빨강)

### 5. 리포트 추출 및 인쇄
- **엑셀(XLSX)**: SheetJS(`xlsx`) 기반 배수로 총괄 현황 시트 및 점검 이력 상세 시트 자동 생성
- **현장 사진대지 PDF/인쇄**: 공공기관 표준 서식(상단 3단 결재란, 시설 기본 제원, 직전/금회 사진 1:1 비교, 점검자 종합의견)을 갖춘 A4 최적화 인쇄 지원

---

## 🚀 빠른 시작 (로컬 실행)

```bash
# 1. 의존성 패키지 설치
npm install

# 2. 로컬 개발 서버 실행 (모바일 접속 허용)
npm run dev

# 3. 프로덕션 빌드 검증
npm run build
```

브라우저에서 `http://localhost:5173` 또는 같은 Wi-Fi에 연결된 스마트폰에서 터미널에 표시된 `http://192.168.x.x:5173`으로 접속할 수 있습니다.

---

## 🌐 GitHub & Firebase 배포 가이드

본 프로젝트에는 Firebase Hosting 설정(`firebase.json`)과 GitHub Actions 자동 배포 워크플로우(`.github/workflows/firebase-deploy.yml`)가 이미 완벽하게 구성되어 있습니다.

### 방법 A: Firebase CLI로 1분 배포

```bash
# 1. Firebase CLI 설치 (최초 1회)
npm install -g firebase-tools

# 2. 구글 계정 로그인
firebase login

# 3. 프로젝트 빌드
npm run build

# 4. Firebase Hosting 배포
firebase deploy --only hosting
```
배포 완료 즉시 `https://<프로젝트ID>.web.app` 형태의 모바일 HTTPS 주소가 발급됩니다.

### 방법 B: GitHub 연동 및 자동 배포 (CI/CD)

1. **GitHub 저장소에 코드 푸시**:
   ```bash
   git init
   git add .
   git commit -m "feat: Drainage Master 배수로 점검 웹앱 초기 배포"
   git branch -M main
   git remote add origin https://github.com/사용자아이디/drainage-master.git
   git push -u origin main
   ```

2. **GitHub Actions Secrets 설정**:
   GitHub Repository의 `Settings > Secrets and variables > Actions`에 다음 시크릿을 등록합니다:
   - `FIREBASE_PROJECT_ID`: Firebase 프로젝트 ID
   - `FIREBASE_SERVICE_ACCOUNT`: Firebase 서비스 계정 비공개 키 JSON (Firebase Console > 프로젝트 설정 > 서비스 계정에서 발급)

3. 이제 `main` 브랜치에 코드를 푸시할 때마다 GitHub Actions가 자동으로 빌드하여 Firebase Hosting으로 최신 버전을 배포합니다.

---

## 📁 디렉토리 구조

```
drainmanager/
├── .github/workflows/
│   └── firebase-deploy.yml      # GitHub Actions 자동 배포 CI/CD
├── public/
│   └── manifest.json             # PWA 매니페스트
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx    # 관리자 대시보드, 통계, 엑셀/백업 추출
│   │   ├── BeforeAfterSliderModal.tsx # 비포/애프터 분할 비교 슬라이더
│   │   ├── DitchEditModal.tsx    # 배수로 핀 등록 및 수정 모달
│   │   ├── FirebaseModal.tsx     # Firebase 연동 및 배포 안내
│   │   ├── GhostCamera.tsx       # 고스트 오버레이 카메라 & 워터마크 합성
│   │   ├── InspectionHistoryModal.tsx # 과거 점검 이력 타임라인
│   │   ├── MapView.tsx           # Leaflet 위성/일반 지도 및 GPS
│   │   ├── PrintReportModal.tsx  # 공공기관 제출용 사진대지 A4 인쇄
│   │   ├── QuickInspectionForm.tsx # 장갑 착용 친화형 원터치 점검 폼
│   │   └── RoleSelector.tsx      # 주사님 vs 관리자 간이 로그인
│   ├── services/
│   │   ├── excelExport.ts        # SheetJS 엑셀 총괄표 추출
│   │   ├── firebase.ts           # Firebase SDK 초기화 및 클라우드 연동
│   │   ├── seedData.ts           # 초기 데모용 배수로/점검 샘플 데이터
│   │   └── storage.ts            # IndexedDB 및 LocalStorage 로컬 우선 저장소
│   ├── types/
│   │   └── index.ts              # 데이터 모델 타입 정의
│   ├── App.tsx                   # 메인 뷰 컨트롤러
│   ├── index.css                 # Tailwind CSS v4 & 인쇄/모바일 스타일
│   └── main.tsx
├── firebase.json                 # Firebase Hosting SPA 라우팅 설정
├── .firebaserc                   # Firebase 프로젝트 연결
└── package.json
```
