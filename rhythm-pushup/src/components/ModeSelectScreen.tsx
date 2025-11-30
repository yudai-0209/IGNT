import './ModeSelectScreen.css';

interface ModeSelectScreenProps {
  onSelectSync: () => void;
  onSelectAsync: () => void;
}

// 音声をアンロックする関数（ユーザーインタラクション時に呼び出す）
const unlockAudio = () => {
  // 音声を作成して一瞬再生→即停止でアンロック
  const audio = new Audio('/music/Metronome_120.mp3');
  audio.volume = 0.01; // ほぼ無音
  audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
    // アンロック済みの音声をグローバルに保存
    (window as any).__unlockedAudio = audio;
    console.log('音声アンロック成功');
  }).catch((e) => {
    console.error('音声アンロック失敗:', e);
  });
};

const ModeSelectScreen = ({ onSelectSync, onSelectAsync }: ModeSelectScreenProps) => {
  const handleSyncClick = () => {
    unlockAudio();
    onSelectSync();
  };

  const handleAsyncClick = () => {
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
          <button onClick={handleSyncClick} className="btn-mode btn-sync">
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
