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

const LoadingScreen = ({ onLoadComplete }: LoadingScreenProps) => {
  const [progress, setProgress] = useState<LoadingState>({ model: 0, audio: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalProgress = Math.round((progress.model + progress.audio) / 2);

  const loadModel = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', MODEL_PATH, true);
      xhr.responseType = 'arraybuffer';

      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(prev => ({ ...prev, model: percent }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setProgress(prev => ({ ...prev, model: 100 }));
          // GLTFLoaderのキャッシュに追加するため、Blobとして保持
          const blob = new Blob([xhr.response], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          // グローバルにキャッシュURLを保存
          (window as any).__cachedModelUrl = url;
          console.log('3Dモデルのプリロード完了');
          resolve();
        } else {
          reject(new Error(`Model load failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Model load failed'));
      xhr.send();
    });
  }, []);

  const loadAudio = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', AUDIO_PATH, true);
      xhr.responseType = 'arraybuffer';

      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(prev => ({ ...prev, audio: percent }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setProgress(prev => ({ ...prev, audio: 100 }));
          // オーディオをBlobとしてキャッシュ
          const blob = new Blob([xhr.response], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          (window as any).__cachedAudioUrl = url;
          console.log('音楽のプリロード完了');
          resolve();
        } else {
          reject(new Error(`Audio load failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Audio load failed'));
      xhr.send();
    });
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
            <span className="loading-value">{progress.model}%</span>
          </div>
          <div className="loading-item">
            <span className="loading-label">音楽</span>
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
