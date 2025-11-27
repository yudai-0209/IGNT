import './StartScreen.css';

interface StartScreenProps {
  onStart: () => void;
}

const StartScreen = ({ onStart }: StartScreenProps) => {
  return (
    <div className="start-screen">
      <img
        src="/image/pushup_background.jpg"
        alt="Background"
        className="start-background"
      />
      <div className="start-content">
        <h1 className="start-title">リズム腕立て</h1>
        <p className="start-description">
          リズムに合わせて腕立て伏せをしよう！
        </p>
        <button onClick={onStart} className="btn-start">
          ゲームスタート
        </button>
      </div>
    </div>
  );
};

export default StartScreen;
