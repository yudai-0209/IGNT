import { useState, useEffect } from 'react';
import './App.css';
import OrientationGuide from './components/OrientationGuide';
import StartScreen from './components/StartScreen';
import ModeSelectScreen from './components/ModeSelectScreen';
import CalibrationScreen from './components/CalibrationScreen';
import GameScreen from './components/GameScreen';
import AsyncGameScreen from './components/AsyncGameScreen';
import LoadingScreen from './components/LoadingScreen';
import type { CalibrationData } from './types';

type Screen = 'start' | 'modeSelect' | 'calibration' | 'syncLoading' | 'syncGame' | 'asyncLoading' | 'asyncGame';

const SCALE_FACTOR = 0.95; // ブラウザUIを考慮して95%に縮小

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleStart = () => {
    setCurrentScreen('modeSelect');
  };

  const handleSelectSync = () => {
    setCurrentScreen('calibration');
  };

  const handleSelectAsync = () => {
    setCurrentScreen('asyncLoading');
  };

  const handleCalibrationComplete = (data: CalibrationData) => {
    setCalibrationData(data);
    setCurrentScreen('syncLoading');
  };

  const handleAsyncLoadComplete = () => {
    setCurrentScreen('asyncGame');
  };

  const handleSyncLoadComplete = () => {
    setCurrentScreen('syncGame');
  };

  useEffect(() => {
    const calculateContainerSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 16:9のアスペクト比を維持しつつ、画面サイズの95%に収める
      let width = viewportWidth * SCALE_FACTOR;
      let height = width / 16 * 9;

      if (height > viewportHeight * SCALE_FACTOR) {
        height = viewportHeight * SCALE_FACTOR;
        width = height / 9 * 16;
      }

      setContainerSize({ width, height });
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
          height: `${containerSize.height}px`
        }}
      >
        {currentScreen === 'start' && <StartScreen onStart={handleStart} />}
        {currentScreen === 'modeSelect' && (
          <ModeSelectScreen onSelectSync={handleSelectSync} onSelectAsync={handleSelectAsync} />
        )}
        {currentScreen === 'calibration' && (
          <CalibrationScreen onComplete={handleCalibrationComplete} />
        )}
        {currentScreen === 'syncLoading' && <LoadingScreen onLoadComplete={handleSyncLoadComplete} />}
        {currentScreen === 'syncGame' && <GameScreen calibrationData={calibrationData} />}
        {currentScreen === 'asyncLoading' && <LoadingScreen onLoadComplete={handleAsyncLoadComplete} />}
        {currentScreen === 'asyncGame' && <AsyncGameScreen />}
      </div>
    </>
  );
}

export default App;
