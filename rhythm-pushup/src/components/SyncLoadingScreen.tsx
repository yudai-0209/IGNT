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
      // アンロック時はvolume=0で無音再生しているので、ここで音量とループを設定
      unlockedAudio.loop = true;
      unlockedAudio.volume = 1.0;
      (window as any).__syncModeAudio = unlockedAudio;
    } else {
      // プリロードされた音楽URLを使用
      const preloadedUrl = (window as any).__preloadedMusicUrl;
      const audio = new Audio(preloadedUrl || '/music/Metronome_120.mp3');
      audio.loop = true;
      audio.volume = 1.0;
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
