import { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useProgress } from '@react-three/drei';
import './AssetLoader.css';

interface AssetLoaderProps {
  onLoadComplete: () => void;
  modelPath: string;
  musicPath: string;
  imagePaths: string[];
}

// 3Dモデルをプリロードするための内部コンポーネント
const ModelPreloader = ({ url, onProgress, onLoaded }: { url: string; onProgress: (progress: number) => void; onLoaded: () => void }) => {
  const { progress, loaded, total } = useProgress();

  useEffect(() => {
    onProgress(progress);
    if (progress >= 100 && loaded === total && total > 0) {
      onLoaded();
    }
  }, [progress, loaded, total, onProgress, onLoaded]);

  // 実際にモデルをロード
  useGLTF(url, true);

  return null;
};

const AssetLoader = ({ onLoadComplete, modelPath, musicPath, imagePaths }: AssetLoaderProps) => {
  const [modelProgress, setModelProgress] = useState(0);
  const [musicProgress, setMusicProgress] = useState(0);
  const [imageProgress, setImageProgress] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isMusicLoaded, setIsMusicLoaded] = useState(false);
  const [isImagesLoaded, setIsImagesLoaded] = useState(false);

  // 3Dモデルのプログレス更新
  const handleModelProgress = useCallback((progress: number) => {
    setModelProgress(progress);
  }, []);

  const handleModelLoaded = useCallback(() => {
    setIsModelLoaded(true);
  }, []);

  // 音楽のロード
  useEffect(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', musicPath, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        setMusicProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        setMusicProgress(100);
        setIsMusicLoaded(true);
        // BlobをURLに変換してグローバルにキャッシュ
        const blob = xhr.response;
        const url = URL.createObjectURL(blob);
        (window as any).__preloadedMusicUrl = url;
      }
    };

    xhr.onerror = () => {
      console.error('音楽のロードに失敗しました');
      setMusicProgress(100);
      setIsMusicLoaded(true);
    };

    xhr.send();

    return () => {
      xhr.abort();
    };
  }, [musicPath]);

  // 画像のロード
  useEffect(() => {
    if (imagePaths.length === 0) {
      setImageProgress(100);
      setIsImagesLoaded(true);
      return;
    }

    let loadedCount = 0;
    const totalImages = imagePaths.length;

    imagePaths.forEach((path) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        setImageProgress((loadedCount / totalImages) * 100);
        if (loadedCount === totalImages) {
          setIsImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        setImageProgress((loadedCount / totalImages) * 100);
        if (loadedCount === totalImages) {
          setIsImagesLoaded(true);
        }
      };
      img.src = path;
    });
  }, [imagePaths]);

  // 全てロード完了したらコールバック
  useEffect(() => {
    if (isModelLoaded && isMusicLoaded && isImagesLoaded) {
      setTimeout(() => {
        onLoadComplete();
      }, 300);
    }
  }, [isModelLoaded, isMusicLoaded, isImagesLoaded, onLoadComplete]);

  const totalProgress = (modelProgress + musicProgress + imageProgress) / 3;

  return (
    <div className="asset-loader">
      <div className="asset-loader-content">
        <h1 className="asset-loader-title">Loading...</h1>

        <div className="progress-section">
          <div className="progress-item">
            <div className="progress-label">
              <span>3Dモデル</span>
              <span>{Math.round(modelProgress)}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${modelProgress}%` }}
              />
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>音楽</span>
              <span>{Math.round(musicProgress)}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${musicProgress}%` }}
              />
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>イラスト</span>
              <span>{Math.round(imageProgress)}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${imageProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="total-progress">
          <div className="total-progress-bar-container">
            <div
              className="total-progress-bar"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <p className="total-progress-text">{Math.round(totalProgress)}% 完了</p>
        </div>
      </div>

      {/* 3Dモデルをプリロードするための非表示Canvas */}
      <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}>
        <Canvas>
          <ModelPreloader
            url={modelPath}
            onProgress={handleModelProgress}
            onLoaded={handleModelLoaded}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default AssetLoader;
