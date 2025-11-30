import { useState, useEffect } from 'react';
import './App.css';
import OrientationGuide from './components/OrientationGuide';
import StartScreen from './components/StartScreen';
import ModeSelectScreen from './components/ModeSelectScreen';
import CalibrationScreen from './components/CalibrationScreen';
import GameScreen from './components/GameScreen';
import AsyncGameScreen from './components/AsyncGameScreen';
import type { CalibrationData } from './types';

type Screen = 'start' | 'modeSelect' | 'calibration' | 'syncGame' | 'asyncGame';

const SCALE_FACTOR_WIDTH = 0.90; // 横方向は90%
const SCALE_FACTOR_HEIGHT = 0.90; // 縦方向は90%（上2% + 下8%）
const TOP_MARGIN_PERCENT = 0.02; // 上から2%

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0, top: 0 });

  const handleStart = () => {
    setCurrentScreen('modeSelect');
  };

  const handleSelectSync = () => {
    setCurrentScreen('calibration');
  };

  const handleSelectAsync = () => {
    setCurrentScreen('asyncGame');
  };

  const handleCalibrationComplete = (data: CalibrationData) => {
    setCalibrationData(data);
    setCurrentScreen('syncGame');
  };

  const handleBackToStart = () => {
    setCurrentScreen('start');
  };

  useEffect(() => {
    const calculateContainerSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 16:9のアスペクト比を維持しつつ、画面サイズに収める
      let width = viewportWidth * SCALE_FACTOR_WIDTH;
      let height = width / 16 * 9;

      if (height > viewportHeight * SCALE_FACTOR_HEIGHT) {
        height = viewportHeight * SCALE_FACTOR_HEIGHT;
        width = height / 9 * 16;
      }

      // 上から2%の位置に配置
      const top = viewportHeight * TOP_MARGIN_PERCENT;

      setContainerSize({ width, height, top });
    };

    calculateContainerSize();

    window.addEventListener('resize', calculateContainerSize);
    window.addEventListener('orientationchange', calculateContainerSize);

    return () => {
      window.removeEventListener('resize', calculateContainerSize);
      window.removeEventListener('orientationchange', calculateContainerSize);
    };
  }, []);

  return (
    <>
      <OrientationGuide />
      <div
        className="app-container"
        style={{
          width: `${containerSize.width}px`,
          height: `${containerSize.height}px`,
          marginTop: `${containerSize.top}px`
        }}
      >
        {currentScreen === 'start' && <StartScreen onStart={handleStart} />}
        {currentScreen === 'modeSelect' && (
          <ModeSelectScreen onSelectSync={handleSelectSync} onSelectAsync={handleSelectAsync} />
        )}
        {currentScreen === 'calibration' && (
          <CalibrationScreen onComplete={handleCalibrationComplete} />
        )}
        {currentScreen === 'syncGame' && <GameScreen calibrationData={calibrationData} onBackToStart={handleBackToStart} />}
        {currentScreen === 'asyncGame' && <AsyncGameScreen onBackToStart={handleBackToStart} />}
      </div>
    </>
  );
}

export default App;
