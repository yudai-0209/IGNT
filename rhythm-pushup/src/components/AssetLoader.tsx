import { useState, useEffect } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import './AssetLoader.css';

interface AssetLoaderProps {
  onLoadComplete: () => void;
  modelPath: string;
  musicPath: string;
  imagePaths: string[];
}

const AssetLoader = ({ onLoadComplete, modelPath, musicPath, imagePaths }: AssetLoaderProps) => {
  const [modelProgress, setModelProgress] = useState(0);
  const [musicProgress, setMusicProgress] = useState(0);
  const [imageProgress, setImageProgress] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isMusicLoaded, setIsMusicLoaded] = useState(false);
  const [isImagesLoaded, setIsImagesLoaded] = useState(false);

  // 3Dモデルのロード（GLTFLoaderを直接使用）
  useEffect(() => {
    const loader = new GLTFLoader();

    // Draco圧縮対応
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    // DRACOLoaderをグローバルに保持（disposeするとテクスチャのBlob URLが無効化される）
    (window as any).__dracoLoader = dracoLoader;

    loader.load(
      modelPath,
      // onLoad
      (gltf) => {
        console.log('3Dモデルロード完了', gltf);
        setModelProgress(100);
        setIsModelLoaded(true);
        // GLTFをグローバルにキャッシュ（後でuseGLTFがキャッシュから取得）
        (window as any).__preloadedGLTF = gltf;
      },
      // onProgress
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.min((xhr.loaded / xhr.total) * 100, 100);
          setModelProgress(percent);
          console.log(`3Dモデル: ${percent.toFixed(1)}%`);
        }
      },
      // onError
      (error) => {
        console.error('3Dモデルのロードに失敗しました:', error);
        setModelProgress(100);
        setIsModelLoaded(true);
      }
    );

    // クリーンアップではdisposeしない（テクスチャが無効化されるため）
  }, [modelPath]);

  // 音楽のロード
  useEffect(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', musicPath, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        setMusicProgress(percent);
        console.log(`音楽: ${percent.toFixed(1)}%`);
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
        console.log('音楽ロード完了');
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
        const percent = (loadedCount / totalImages) * 100;
        setImageProgress(percent);
        console.log(`イラスト: ${percent.toFixed(1)}%`);
        if (loadedCount === totalImages) {
          setIsImagesLoaded(true);
          console.log('イラストロード完了');
        }
      };
      img.onerror = () => {
        loadedCount++;
        const percent = (loadedCount / totalImages) * 100;
        setImageProgress(percent);
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
      console.log('全アセットロード完了');
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
        <p className="asset-loader-hint">通信環境の良いところでプレイしてください</p>

        <div className="progress-section">
          <div className="progress-item">
            <div className="progress-label">
              <span>3Dモデル</span>
              <span>{Math.round(modelProgress)}%</span>
            </div>
            <div className="total-progress-bar-container" style={{ height: '12px' }}>
              <div
                className="total-progress-bar"
                style={{ width: `${modelProgress}%` }}
              />
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>音楽</span>
              <span>{Math.round(musicProgress)}%</span>
            </div>
            <div className="total-progress-bar-container" style={{ height: '12px' }}>
              <div
                className="total-progress-bar"
                style={{ width: `${musicProgress}%` }}
              />
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>イラスト</span>
              <span>{Math.round(imageProgress)}%</span>
            </div>
            <div className="total-progress-bar-container" style={{ height: '12px' }}>
              <div
                className="total-progress-bar"
                style={{ width: `${imageProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="total-progress">
          <div className="total-progress-bar-container">
            <div
              className="total-progress-bar total-progress-bar-main"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetLoader;
