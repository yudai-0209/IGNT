import { useState } from 'react';
import './App.css';
import CalibrationScreen from './components/CalibrationScreen';
import GameScreen from './components/GameScreen';
import type { CalibrationData } from './types';

function App() {
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);

  const handleCalibrationComplete = (data: CalibrationData) => {
    setCalibrationData(data);
    setIsCalibrated(true);
  };

  return (
    <>
      {!isCalibrated ? (
        <CalibrationScreen onComplete={handleCalibrationComplete} />
      ) : (
        <GameScreen calibrationData={calibrationData} />
      )}
    </>
  );
}

export default App;
