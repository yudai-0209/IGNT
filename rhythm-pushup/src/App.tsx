import { useState, useEffect } from 'react';
import './App.css';
import './components/AsyncGameScreen.css';
import OrientationGuide from './components/OrientationGuide';
import StartScreen from './components/StartScreen';
import ModeSelectScreen from './components/ModeSelectScreen';
import SyncLoadingScreen from './components/SyncLoadingScreen';
import CalibrationScreen from './components/CalibrationScreen';
import GameScreen from './components/GameScreen';
import type { CircleStyle, BurstStyle } from './components/GameScreen';
import AsyncGameScreen from './components/AsyncGameScreen';
import PushUpModel from './components/PushUpModel';
import type { CalibrationData } from './types';

type Screen = 'start' | 'modeSelect' | 'syncLoading' | 'calibration' | 'syncGame' | 'asyncGame';

const SCALE_FACTOR_WIDTH = 0.90;
const SCALE_FACTOR_HEIGHT = 0.90;
const TOP_MARGIN_PERCENT = 0.02;

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0, top: 0 });
  const [syncAssetsLoaded, setSyncAssetsLoaded] = useState<boolean>(false);
  const [syncModelReady, setSyncModelReady] = useState<boolean>(false);
  const [syncCurrentFrame, setSyncCurrentFrame] = useState<number>(25);
  const [circleStyle, setCircleStyle] = useState<CircleStyle>({ scale: 1, rotation: 0, opacity: 1, blur: 0 });
  const [burstStyle, setBurstStyle] = useState<BurstStyle>({ scale: 0, opacity: 0 });

  const handleStart = () => {
    setCurrentScreen('modeSelect');
  };

  const handleSelectSync = () => {
    setCurrentScreen('syncLoading');
  };

  const handleSyncLoadComplete = () => {
    setSyncAssetsLoaded(true);
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
    setSyncAssetsLoaded(false);
    setSyncModelReady(false);
    setSyncCurrentFrame(25);
    setCircleStyle({ scale: 1, rotation: 0, opacity: 1, blur: 0 });
    setBurstStyle({ scale: 0, opacity: 0 });
    setCurrentScreen('start');
  };

  const handleSyncModelReady = () => {
    console.log('3Dモデル準備完了（App）');
    setSyncModelReady(true);
  };

  useEffect(() => {
    const calculateContainerSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let width = viewportWidth * SCALE_FACTOR_WIDTH;
      let height = width / 16 * 9;

      if (height > viewportHeight * SCALE_FACTOR_HEIGHT) {
        height = viewportHeight * SCALE_FACTOR_HEIGHT;
        width = height / 9 * 16;
      }

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

  // 同期モードで3Dモデルを表示すべき画面かどうか
  const showSyncModel = syncAssetsLoaded &&
    (currentScreen === 'syncLoading' || currentScreen === 'calibration' || currentScreen === 'syncGame');

  // ゲーム画面でのみcircleアニメーションを適用
  const isGameScreen = currentScreen === 'syncGame';

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
        {/* 同期モード共通の背景・3Dモデル・circle（画面遷移しても消えない） */}
        {showSyncModel && (
          <>
            <img
              src="/image/pushup_background.jpg"
              alt="Background"
              className="async-game-background"
            />
            {/* 放射線エフェクト（ゲーム画面のみ） */}
            {isGameScreen && (
              <div
                className="async-burst-effect"
                style={{
                  transform: `translate(-50%, -50%) scale(${burstStyle.scale})`,
                  opacity: burstStyle.opacity
                }}
              />
            )}
            <img
              src="/image/circle.png"
              alt="Circle"
              className="async-circle-center"
              style={{
                transform: isGameScreen
                  ? `translate(-50%, -50%) scale(${circleStyle.scale}) rotate(${circleStyle.rotation}deg)`
                  : 'translate(-50%, -50%) scale(1)',
                opacity: syncModelReady ? (isGameScreen ? circleStyle.opacity : 1) : 0,
                filter: isGameScreen && circleStyle.blur > 0 ? `blur(${circleStyle.blur}px)` : 'none',
                transition: syncModelReady && !isGameScreen ? 'opacity 0.3s ease' : 'none'
              }}
            />
            <div className="async-model-container">
              <PushUpModel
                modelPath="/models/pushUp.glb"
                currentFrame={syncCurrentFrame}
                onLoad={handleSyncModelReady}
              />
            </div>
          </>
        )}

        {currentScreen === 'start' && <StartScreen onStart={handleStart} />}
        {currentScreen === 'modeSelect' && (
          <ModeSelectScreen onSelectSync={handleSelectSync} onSelectAsync={handleSelectAsync} />
        )}
        {currentScreen === 'syncLoading' && (
          <SyncLoadingScreen onLoadComplete={handleSyncLoadComplete} />
        )}
        {currentScreen === 'calibration' && (
          <CalibrationScreen
            onComplete={handleCalibrationComplete}
            assetsLoaded={syncAssetsLoaded}
            modelReady={syncModelReady}
          />
        )}
        {currentScreen === 'syncGame' && (
          <GameScreen
            calibrationData={calibrationData}
            onBackToStart={handleBackToStart}
            onFrameUpdate={setSyncCurrentFrame}
            onCircleStyleUpdate={setCircleStyle}
            onBurstStyleUpdate={setBurstStyle}
            modelReady={syncModelReady}
          />
        )}
        {currentScreen === 'asyncGame' && <AsyncGameScreen onBackToStart={handleBackToStart} />}
      </div>
    </>
  );
}

export default App;
