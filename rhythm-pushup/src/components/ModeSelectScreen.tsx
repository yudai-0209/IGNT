import './ModeSelectScreen.css';
import NoSleep from 'nosleep.js';

interface ModeSelectScreenProps {
  onSelectSync: () => void;
  onSelectAsync: () => void;
}

// NoSleep インスタンスをグローバルに保持
const noSleep = new NoSleep();

// 画面スリープ防止を有効化（ユーザーインタラクション時に呼び出す）
const enableNoSleep = () => {
  noSleep.enable();
  // グローバルに保存して他のコンポーネントからアクセス可能に
  (window as any).__noSleep = noSleep;
  console.log('NoSleep 有効化 - 画面スリープを防止');
};

// 音声をアンロックする関数（ユーザーインタラクション時に呼び出す）
const unlockAudio = () => {
  // 音声を作成して一瞬再生→即停止でアンロック
  const audio = new Audio('/music/Metronome_120.mp3');
  audio.volume = 0; // 完全無音のまま維持

  const playPromise = audio.play();

  if (playPromise !== undefined) {
    playPromise.then(() => {
      // Promiseが解決してから停止（確実に再生が開始された後）
      audio.pause();
      audio.currentTime = 0;
      // 音量は0のまま、AsyncGameScreen側で設定する
      (window as any).__unlockedAudio = audio;
      console.log('音声アンロック成功');
    }).catch((e) => {
      console.error('音声アンロック失敗:', e);
    });
  }
};

const ModeSelectScreen = ({ onSelectSync: _onSelectSync, onSelectAsync }: ModeSelectScreenProps) => {
  const handleAsyncClick = () => {
    enableNoSleep();
    unlockAudio();
    onSelectAsync();
  };

  return (
    <div className="mode-select-screen">
      <img
        src="/image/pushup_background.jpg"
        alt="Background"
        className="mode-select-background"
      />
      <div className="mode-select-content">
        <h1 className="mode-select-title">モード選択</h1>
        <p className="mode-select-description">
          プレイモードを選択してください
        </p>
        <div className="mode-buttons">
          <button className="btn-mode btn-sync btn-disabled" disabled>
            <div className="mode-developing">開発中</div>
            <div className="mode-icon">🎯</div>
            <div className="mode-name">同期モード</div>
            <div className="mode-desc">あなたの動きに合わせて</div>
          </button>
          <button onClick={handleAsyncClick} className="btn-mode btn-async">
            <div className="mode-icon">🎵</div>
            <div className="mode-name">非同期モード</div>
            <div className="mode-desc">リズムに合わせて</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectScreen;
