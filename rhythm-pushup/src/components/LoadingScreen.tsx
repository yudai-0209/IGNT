import { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onLoadComplete: () => void;
}

const LoadingScreen = ({ onLoadComplete }: LoadingScreenProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    console.log('3Dモデルのロード開始');

    // 3Dモデルのロード
    const loadModel = async () => {
      try {
        // 実際にモデルをロード
        const gltf = await useGLTF('/models/pushUp.glb', true);

        console.log('3Dモデルのロード完了', gltf);
        setIsLoaded(true);

        // ロード完了後、少し待ってから次の画面へ
        setTimeout(() => {
          onLoadComplete();
        }, 500);
      } catch (error) {
        console.error('3Dモデルのロードに失敗しました:', error);
        setIsLoaded(true);
        // エラーでも次に進む
        setTimeout(() => {
          onLoadComplete();
        }, 1000);
      }
    };

    loadModel();
  }, [onLoadComplete]);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <h1 className="loading-title">読み込み中...</h1>
      </div>
    </div>
  );
};

export default LoadingScreen;
