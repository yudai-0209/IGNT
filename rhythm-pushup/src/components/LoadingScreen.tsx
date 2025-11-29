import { useState, useEffect, useCallback } from 'react';
import { useGLTF } from '@react-three/drei';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onLoadComplete: () => void;
}

interface LoadingState {
  model: number;
  audio: number;
}

const MODEL_PATH = '/models/pushUp.glb';
const AUDIO_PATH = '/music/Metronome_120.mp3';

// ファイルサイズ（バイト）- Content-Lengthが取れない場合のフォールバック
const ESTIMATED_MODEL_SIZE = 54472 * 1024; // 54472kB
const ESTIMATED_AUDIO_SIZE = 1.2 * 1024 * 1024; // 1.2MB

const LoadingScreen = ({ onLoadComplete }: LoadingScreenProps) => {
  const [progress, setProgress] = useState<LoadingState>({ model: 0, audio: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalProgress = Math.round((progress.model + progress.audio) / 2);

  // fetch + ReadableStream でリアルタイム進捗を取得し、Cache APIでキャッシュ
  const loadWithProgress = useCallback(async (
    url: string,
    estimatedSize: number,
    onProgress: (percent: number) => void
  ): Promise<void> => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Content-Lengthを取得（なければ推定サイズを使用）
    const contentLength = response.headers.get('Content-Length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : estimatedSize;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported');
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      // 進捗を計算（最大99%まで、完了時に100%）
      const percent = Math.min(Math.round((receivedLength / totalSize) * 100), 99);
      onProgress(percent);
    }

    // 完了
    onProgress(100);

    // チャンクを結合
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Cache APIでキャッシュに保存（useGLTF.preload()がここから読む）
    if ('caches' in window) {
      try {
        const cache = await caches.open('model-cache');
        const cachedResponse = new Response(combined, {
          headers: {
            'Content-Type': url.endsWith('.glb') ? 'model/gltf-binary' : 'audio/mpeg',
            'Content-Length': String(totalLength),
          },
        });
        await cache.put(url, cachedResponse);
        console.log(`Cache APIでキャッシュ保存: ${url}`);
      } catch (e) {
        console.log('Cache API保存失敗、ブラウザキャッシュに依存:', e);
      }
    }
  }, []);

  const loadModel = useCallback(async (): Promise<void> => {
    console.log('3Dモデルのダウンロード開始');

    // ダウンロードしてブラウザキャッシュに乗せる（プログレス表示用）
    await loadWithProgress(
      MODEL_PATH,
      ESTIMATED_MODEL_SIZE,
      (percent) => setProgress(prev => ({ ...prev, model: percent }))
    );

    // drei内部キャッシュにもプリロード（パース処理も事前に実行）
    useGLTF.preload(MODEL_PATH);

    (window as any).__modelPreloaded = true;
    console.log('3Dモデルのプリロード完了');
  }, [loadWithProgress]);

  const loadAudio = useCallback(async (): Promise<void> => {
    console.log('音楽のダウンロード開始');

    const response = await fetch(AUDIO_PATH);
    if (!response.ok) {
      throw new Error(`Audio load failed: ${response.status}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : ESTIMATED_AUDIO_SIZE;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported');
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      const percent = Math.min(Math.round((receivedLength / totalSize) * 100), 99);
      setProgress(prev => ({ ...prev, audio: percent }));
    }

    setProgress(prev => ({ ...prev, audio: 100 }));

    // チャンクを結合してBlobを作成
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    const blob = new Blob([combined], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    (window as any).__cachedAudioUrl = url;
    console.log('音楽のプリロード完了');
  }, []);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        console.log('アセットのプリロード開始');

        // 3Dモデルと音楽を並列でロード
        await Promise.all([loadModel(), loadAudio()]);

        console.log('全アセットのプリロード完了');
        setIsComplete(true);

        // 少し待ってから次の画面へ
        setTimeout(() => {
          onLoadComplete();
        }, 500);
      } catch (err) {
        console.error('プリロードエラー:', err);
        setError(err instanceof Error ? err.message : 'ロードに失敗しました');

        // エラーでも5秒後に進む
        setTimeout(() => {
          onLoadComplete();
        }, 5000);
      }
    };

    loadAssets();
  }, [loadModel, loadAudio, onLoadComplete]);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className={`spinner ${isComplete ? 'complete' : ''}`}></div>
        </div>

        <h1 className="loading-title">
          {isComplete ? '準備完了！' : '読み込み中...'}
        </h1>

        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <div className="progress-text">{totalProgress}%</div>
        </div>

        <div className="loading-details">
          <div className="loading-item">
            <span className="loading-label">3Dモデル</span>
            <div className="loading-item-bar">
              <div className="loading-item-fill" style={{ width: `${progress.model}%` }} />
            </div>
            <span className="loading-value">{progress.model}%</span>
          </div>
          <div className="loading-item">
            <span className="loading-label">音楽</span>
            <div className="loading-item-bar">
              <div className="loading-item-fill" style={{ width: `${progress.audio}%` }} />
            </div>
            <span className="loading-value">{progress.audio}%</span>
          </div>
        </div>

        {error && (
          <div className="loading-error">
            <p>エラー: {error}</p>
            <p>自動的に続行します...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
