import { useState } from 'react';
import AssetLoader from './AssetLoader';
import './AsyncGameScreen.css';

interface SyncLoadingScreenProps {
  onLoadComplete: () => void;
}

const SyncLoadingScreen = ({ onLoadComplete }: SyncLoadingScreenProps) => {
  const [isAssetsLoaded, setIsAssetsLoaded] = useState<boolean>(false);

  // アセットローディング完了時（ファイルダウンロード完了）
  const handleAssetsLoaded = () => {
    // アンロック済みの音声があればそれを優先使用
    const unlockedAudio = (window as any).__unlockedAudio;
    if (unlockedAudio) {
      console.log('アンロック済み音声を使用（SyncLoading）');
      // 確実に停止・無音状態にする
      unlockedAudio.pause();
      unlockedAudio.currentTime = 0;
      unlockedAudio.loop = true;
      unlockedAudio.muted = true; // ミュート維持（ゲーム開始時にfalseにする）
      unlockedAudio.volume = 0; // 音量は0のまま維持（ゲーム開始時に1.0にする）
      (window as any).__syncModeAudio = unlockedAudio;
    } else {
      // プリロードされた音楽URLを使用
      const preloadedUrl = (window as any).__preloadedMusicUrl;
      const audio = new Audio(preloadedUrl || '/music/Metronome_120.mp3');
      audio.loop = true;
      audio.muted = true; // ミュート維持（ゲーム開始時にfalseにする）
      audio.volume = 0; // 音量は0のまま維持（ゲーム開始時に1.0にする）
      (window as any).__syncModeAudio = audio;
    }

    setIsAssetsLoaded(true);
    // アセットダウンロード完了後、すぐに次の画面へ（3Dモデル表示はApp.tsxで行う）
    onLoadComplete();
  };

  // アセットローディング中
  if (!isAssetsLoaded) {
    return (
      <AssetLoader
        onLoadComplete={handleAssetsLoaded}
        modelPath="/models/pushUp.glb"
        musicPath="/music/Metronome_120.mp3"
        imagePaths={['/image/pushup_background.jpg', '/image/circle.png']}
      />
    );
  }

  // アセットロード完了後は何も表示しない（App.tsxで3Dモデルを表示）
  return null;
};

export default SyncLoadingScreen;
