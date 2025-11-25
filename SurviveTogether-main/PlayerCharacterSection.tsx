import React, { Suspense, useCallback } from 'react';
import PlayerCharacterModel from './PlayerCharacterModel';

interface PlayerCharacterSectionProps {
  myCharacterNumber: 1 | 2 | null;
  boyPosture: 'standing' | 'sitting';
  girlPosture: 'standing' | 'sitting';
  setBoyPosture: (posture: 'standing' | 'sitting') => void;
  setGirlPosture: (posture: 'standing' | 'sitting') => void;
  setBoyStandingButtonPressed: (pressed: boolean) => void;
  setBoySittingButtonPressed: (pressed: boolean) => void;
  updateBoyPostureRTM: (posture: 'standing' | 'sitting', standingPressed: boolean, sittingPressed: boolean) => void;
  updateGirlPostureRTM: (posture: 'standing' | 'sitting') => void;
  isMyCharacterBlinking?: boolean;
  isPartnerCharacterBlinking?: boolean;
  myActualCharacterPostureRef: React.MutableRefObject<'standing' | 'sitting'>;
}

const PlayerCharacterSection: React.FC<PlayerCharacterSectionProps> = ({
  myCharacterNumber,
  boyPosture,
  girlPosture,
  setBoyPosture,
  setGirlPosture,
  setBoyStandingButtonPressed,
  setBoySittingButtonPressed,
  updateBoyPostureRTM,
  updateGirlPostureRTM,
  isMyCharacterBlinking = false,
  isPartnerCharacterBlinking = false,
  myActualCharacterPostureRef
}) => {

  // プレイヤーキャラクターの姿勢変更ハンドラー
  const handleStandingClick = useCallback(() => {
    // 新フラグを即座に更新
    const prevPosture = myActualCharacterPostureRef.current;
    myActualCharacterPostureRef.current = 'standing';
    console.log(`🎭 フラグ更新: ${prevPosture} → standing (手動ボタン) (時刻: ${new Date().toLocaleTimeString()})`);
    
    if (myCharacterNumber === 1) {
      setBoyPosture('standing');
      setBoyStandingButtonPressed(true);
      setBoySittingButtonPressed(false);
      updateBoyPostureRTM('standing', true, false);
    } else {
      setGirlPosture('standing');
      updateGirlPostureRTM('standing');
    }
  }, [myCharacterNumber, setBoyPosture, setGirlPosture, setBoyStandingButtonPressed, setBoySittingButtonPressed, updateBoyPostureRTM, updateGirlPostureRTM, myActualCharacterPostureRef]);

  const handleSittingClick = useCallback(() => {
    // 新フラグを即座に更新
    const prevPosture = myActualCharacterPostureRef.current;
    myActualCharacterPostureRef.current = 'sitting';
    console.log(`🎭 フラグ更新: ${prevPosture} → sitting (手動ボタン) (時刻: ${new Date().toLocaleTimeString()})`);
    
    if (myCharacterNumber === 1) {
      setBoyPosture('sitting');
      setBoyStandingButtonPressed(false);
      setBoySittingButtonPressed(true);
      updateBoyPostureRTM('sitting', false, true);
    } else {
      setGirlPosture('sitting');
      updateGirlPostureRTM('sitting');
    }
  }, [myCharacterNumber, setBoyPosture, setGirlPosture, setBoyStandingButtonPressed, setBoySittingButtonPressed, updateBoyPostureRTM, updateGirlPostureRTM, myActualCharacterPostureRef]);

  // 点滅用のカスタムスタイル（キャラの表示/非表示を高速切り替え）
  const myCharacterBlinkingStyle = isMyCharacterBlinking ? {
    animation: 'characterBlink 0.3s infinite'
  } : {};

  // 相手のキャラクター点滅用スタイル
  const partnerCharacterBlinkingStyle = isPartnerCharacterBlinking ? {
    animation: 'characterBlink 0.3s infinite'
  } : {};

  // CSSアニメーションをstyleタグで定義
  React.useEffect(() => {
    if (isMyCharacterBlinking || isPartnerCharacterBlinking) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes characterBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, [isMyCharacterBlinking, isPartnerCharacterBlinking]);

  return (
    <>
      {/* 自分のキャラ - 左側に配置（点滅エフェクト追加） */}
      <div className="absolute w-[250px] h-[300px]" style={{
        top: 'calc(40% + 300px + 20px)',    // enemy下端 + 余白
        left: 'calc(50% - 225px)',          // enemy左端
        transform: 'translate(0, -50%)',
        zIndex: 60,
        ...myCharacterBlinkingStyle  // 自分のキャラ点滅スタイルを適用
      }}>
        <Suspense fallback={<div className="text-center text-white text-sm">Loading My Character...</div>}>
          <PlayerCharacterModel
            modelPath={myCharacterNumber === 1 ? "/Models/RPGBoy1.glb" : "/Models/RPGGirl.glb"}
            postureState={myCharacterNumber === 1 ? boyPosture : girlPosture}
            viewDirection="back"
          />
        </Suspense>
      </div>

      {/* 相手のキャラ - 右側に配置（マッチング時のみ表示、点滅エフェクト追加） */}
      {myCharacterNumber && (
        <div className="absolute w-[250px] h-[300px]" style={{
          top: 'calc(40% + 300px + 20px)',    // enemy下端 + 余白
          left: 'calc(50% + 225px - 250px)',  // enemy右端 - 幅
          transform: 'translate(0, -50%)',
          zIndex: 60,
          ...partnerCharacterBlinkingStyle  // 相手のキャラ点滅スタイルを適用
        }}>
          <Suspense fallback={<div className="text-center text-white text-sm">Loading Partner...</div>}>
            <PlayerCharacterModel
              modelPath={myCharacterNumber === 1 ? "/Models/RPGGirl.glb" : "/Models/RPGBoy1.glb"}
              postureState={myCharacterNumber === 1 ? girlPosture : boyPosture}
              viewDirection="back"
            />
          </Suspense>
        </div>
      )}

      {/* キャラクター切り替えボタン */}
      <div className="absolute bottom-20 w-full flex justify-center z-50">
        <div className="flex flex-col items-center gap-2">
          <span className="text-white/0 text-sm font-medium">
            {myCharacterNumber === 1 ? '🧑 自分のキャラ (Boy) - 左側' : myCharacterNumber === 2 ? '👩 自分のキャラ (Girl) - 左側' : '🎮 キャラクター準備中...'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleStandingClick}
              disabled={myCharacterNumber === 1 ? boyPosture === 'standing' : girlPosture === 'standing'}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors shadow-none ${
                (myCharacterNumber === 1 ? boyPosture === 'standing' : girlPosture === 'standing')
                  ? 'bg-green-600/0 text-white/0 cursor-default'
                  : (myCharacterNumber === 1 ? 'bg-blue-500/0 hover:bg-blue-600/0' : 'bg-pink-500/0 hover:bg-pink-600/0') + ' text-white/0'
              }`}
            >
              立つ
            </button>
            <button
              onClick={handleSittingClick}
              disabled={myCharacterNumber === 1 ? boyPosture === 'sitting' : girlPosture === 'sitting'}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors shadow-none ${
                (myCharacterNumber === 1 ? boyPosture === 'sitting' : girlPosture === 'sitting')
                  ? 'bg-orange-600/0 text-white/0 cursor-default'
                  : (myCharacterNumber === 1 ? 'bg-blue-500/0 hover:bg-blue-600/0' : 'bg-pink-500/0 hover:bg-pink-600/0') + ' text-white/0'
              }`}
            >
              しゃがむ
            </button>
          </div>
        </div>
      </div>

      {/* 状態表示パネル */}
      {/* <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg z-50">
        <div className="flex gap-4 text-white text-sm">
          <span className="flex items-center gap-1">
            🧑 Boy:
            <span className={boyPosture === 'standing' ? 'text-green-400' : 'text-orange-400'}>
              {boyPosture === 'standing' ? '立っている' : 'しゃがんでいる'}
            </span>
          </span>
          <span className="flex items-center gap-1">
            👩 Girl:
            <span className={girlPosture === 'standing' ? 'text-green-400' : 'text-orange-400'}>
              {girlPosture === 'standing' ? '立っている' : 'しゃがんでいる'}
            </span>
          </span>
        </div>
      </div> */}
    </>
  );
};

export default PlayerCharacterSection;