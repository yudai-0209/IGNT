import { useState } from 'react';
import './App.css';
import OrientationGuide from './components/OrientationGuide';
import StartScreen from './components/StartScreen';
import ModeSelectScreen from './components/ModeSelectScreen';
import CalibrationScreen from './components/CalibrationScreen';
import GameScreen from './components/GameScreen';
import AsyncGameScreen from './components/AsyncGameScreen';
import type { CalibrationData } from './types';

type Screen = 'start' | 'modeSelect' | 'calibration' | 'syncGame' | 'asyncGame';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);

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

  return (
    <>
      <OrientationGuide />
      <div className="app-container">
        {currentScreen === 'start' && <StartScreen onStart={handleStart} />}
        {currentScreen === 'modeSelect' && (
          <ModeSelectScreen onSelectSync={handleSelectSync} onSelectAsync={handleSelectAsync} />
        )}
        {currentScreen === 'calibration' && (
          <CalibrationScreen onComplete={handleCalibrationComplete} />
        )}
        {currentScreen === 'syncGame' && <GameScreen calibrationData={calibrationData} />}
        {currentScreen === 'asyncGame' && <AsyncGameScreen />}
      </div>
    </>
  );
}

export default App;
