import { useState, useEffect } from 'react';
import './OrientationGuide.css';

const OrientationGuide = () => {
  const [isLandscape, setIsLandscape] = useState(
    window.innerWidth > window.innerHeight
  );

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (isLandscape) {
    return null; // 横向きの場合は何も表示しない
  }

  return (
    <div className="orientation-guide">
      <div className="orientation-content">
        <div className="phone-icon">📱</div>
        <h1 className="orientation-title">画面を横に向けてください</h1>
        <p className="orientation-text">このゲームは横向きでプレイしてください</p>
        <div className="rotation-icon">🔄</div>
      </div>
    </div>
  );
};

export default OrientationGuide;
