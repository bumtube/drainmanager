import React, { useState } from 'react';
import { X, Cloud, GitBranch, Copy } from 'lucide-react';
import { FirebaseConfigState } from '../types';
import { getFirebaseConfig, saveFirebaseConfig } from '../services/storage';
import { initFirebase } from '../services/firebase';

interface FirebaseModalProps {
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({ onClose, onConfigUpdated }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'deployGuide'>('config');
  const currentConfig = getFirebaseConfig();

  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    const newConfig: FirebaseConfigState = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      appId: appId.trim(),
      enabled: !!(apiKey.trim() && projectId.trim()),
    };

    saveFirebaseConfig(newConfig);
    const result = initFirebase(newConfig);

    if (result.initialized) {
      alert('Firebase 설정이 저장되고 성공적으로 연결되었습니다.');
    } else {
      alert('설정이 저장되었습니다. (입력값이 부족한 경우 브라우저 로컬 모드로 작동합니다.)');
    }

    onConfigUpdated();
    onClose();
  };

  const copyDeployScript = () => {
    const script = `# 1. Firebase CLI 설치 및 로그인
npm install -g firebase-tools
firebase login

# 2. 프로젝트 초기화 (Hosting 선택)
firebase init hosting

# 3. Vite 프로덕션 빌드 & 배포
npm run build
firebase deploy --only hosting`;
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-white text-lg">Firebase & GitHub 배포 설정</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-amber-400 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Firebase 클라우드 연동 키
          </button>
          <button
            onClick={() => setActiveTab('deployGuide')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'deployGuide'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <GitBranch className="w-4 h-4" /> GitHub & Hosting 배포 가이드
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {activeTab === 'config' ? (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-200">
                💡 키를 입력하지 않아도 모든 기능(지도, 현장 카메라 점검, 엑셀/PDF, 점검기록)은
                브라우저 내부 IndexedDB를 통해 100% 정상 작동합니다. 클라우드 실시간 동기화가
                필요할 때 아래 값을 입력하세요.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Project ID</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="drainage-master-1234"
                  className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Auth Domain</label>
                  <input
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="project.firebaseapp.com"
                    className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Storage Bucket</label>
                  <input
                    type="text"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="project.appspot.com"
                    className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">App ID</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:123456789:web:abcdef"
                  className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 px-4 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm"
                >
                  설정 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs sm:text-sm text-slate-300">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-emerald-400" /> 1단계: GitHub 원격 저장소 푸시
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  GitHub에 새 Repository(예: `drainage-master`)를 생성한 후 아래 명령어로 코드를
                  업로드합니다:
                </p>
                <pre className="bg-slate-900 p-3 rounded-lg text-emerald-400 font-mono text-xs overflow-x-auto">
{`git init
git add .
git commit -m "feat: 배수로 점검 웹앱 초기 구축"
git branch -M main
git remote add origin https://github.com/사용자계정/drainage-master.git
git push -u origin main`}
                </pre>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-amber-400" /> 2단계: Firebase Hosting 간편 배포
                  </h4>
                  <button
                    onClick={copyDeployScript}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? '복사됨!' : '스크립트 복사'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Firebase Console에서 프로젝트 생성 후 아래 명령어를 터미널에서 순서대로 실행하면
                  즉시 HTTPS 모바일 웹앱 주소가 발급됩니다:
                </p>
                <pre className="bg-slate-900 p-3 rounded-lg text-amber-300 font-mono text-xs overflow-x-auto">
{`# 1. 빌드 수행
npm run build

# 2. Firebase 배포
npx firebase-tools deploy --only hosting`}
                </pre>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300 space-y-1">
                <div className="font-bold">✨ GitHub Actions 자동 배포 준비 완료</div>
                <p>
                  프로젝트 내 `.github/workflows/firebase-deploy.yml` 파일이 포함되어 있어, GitHub에
                  푸시만 하면 자동으로 빌드되어 Firebase Hosting으로 무료 배포됩니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
