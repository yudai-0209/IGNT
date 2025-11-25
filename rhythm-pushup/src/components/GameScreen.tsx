import './GameScreen.css';
import PushUpModel from './PushUpModel';
import PoseDetection from './PoseDetection';
import type { CalibrationData } from '../types';

interface GameScreenProps {
  calibrationData: CalibrationData | null;
}

function GameScreen({ calibrationData }: GameScreenProps) {
  return (
    <div className="game-screen">
      <img
        src="/image/pushup_background.jpg"
        alt="Background"
        className="game-background"
      />
      <div className="model-container">
        <PushUpModel modelPath="/models/pushUp.glb" />
      </div>
      <PoseDetection calibrationData={calibrationData} />
    </div>
  );
}

export default GameScreen;
