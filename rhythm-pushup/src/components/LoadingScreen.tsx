import { useState, useEffect, useCallback } from 'react';
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

  // fetch + ReadableStream でリアルタイム進捗を取得
  const loadWithProgress = useCallback(async (
    url: string,
    estimatedSize: number,
    onProgress: (percent: number) => void
  ): Promise<Blob> => {
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

    const chunks: ArrayBuffer[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // ArrayBufferとしてコピーして保存
      chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      receivedLength += value.length;

      // 進捗を計算（最大99%まで、完了時に100%）
      const percent = Math.min(Math.round((receivedLength / totalSize) * 100), 99);
      onProgress(percent);
    }

    // 完了
    onProgress(100);

    // チャンクを結合してBlobを作成
    const blob = new Blob(chunks);
    return blob;
  }, []);

  const loadModel = useCallback(async (): Promise<void> => {
    console.log('3Dモデルのダウンロード開始');

    const blob = await loadWithProgress(
      MODEL_PATH,
      ESTIMATED_MODEL_SIZE,
      (percent) => setProgress(prev => ({ ...prev, model: percent }))
    );

    // Blob URLを作成してキャッシュ
    const url = URL.createObjectURL(blob);
    (window as any).__cachedModelUrl = url;
    console.log('3Dモデルのプリロード完了');
  }, [loadWithProgress]);

  const loadAudio = useCallback(async (): Promise<void> => {
    console.log('音楽のダウンロード開始');

    const blob = await loadWithProgress(
      AUDIO_PATH,
      ESTIMATED_AUDIO_SIZE,
      (percent) => setProgress(prev => ({ ...prev, audio: percent }))
    );

    // Blob URLを作成してキャッシュ
    const url = URL.createObjectURL(blob);
    (window as any).__cachedAudioUrl = url;
    console.log('音楽のプリロード完了');
  }, [loadWithProgress]);

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
