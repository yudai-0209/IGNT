import './ModeSelectScreen.css';

interface ModeSelectScreenProps {
  onSelectSync: () => void;
  onSelectAsync: () => void;
}

const ModeSelectScreen = ({ onSelectSync, onSelectAsync }: ModeSelectScreenProps) => {
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
          <button onClick={onSelectSync} className="btn-mode btn-sync">
            <div className="mode-icon">🎯</div>
            <div className="mode-name">同期モード</div>
            <div className="mode-desc">あなたの動きに合わせて</div>
          </button>
          <button onClick={onSelectAsync} className="btn-mode btn-async">
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
