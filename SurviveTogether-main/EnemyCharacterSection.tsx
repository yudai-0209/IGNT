import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { ref, set, serverTimestamp } from 'firebase/database';
import { database } from './firebase';
import EnemyCharacterModel from './EnemyCharacterModel';

interface EnemyCharacterSectionProps {
  countdown2Status: 'waiting' | 'active' | 'finished';
  bothUsersOK: boolean;
  myOKStatus: boolean;
  partnerOKStatus: boolean;
  isEnemyAnimating: boolean;
  onEnemyAnimationComplete: () => void;
  onStartEnemyAnimation: () => void;
  countdown2Remaining?: number; // 60秒カウントダウンの残り秒数
  isEnemy1Animating?: boolean; // enemy1専用アニメーション状態
  onEnemy1AnimationComplete?: () => void; // enemy1アニメーション完了コールバック
}

const EnemyCharacterSection: React.FC<EnemyCharacterSectionProps> = React.memo(({
  countdown2Status,
  bothUsersOK,
  myOKStatus,
  partnerOKStatus,
  isEnemyAnimating,
  onEnemyAnimationComplete,
  onStartEnemyAnimation,
  countdown2Remaining = 60,
  isEnemy1Animating = false,
  onEnemy1AnimationComplete
}) => {
  // 敵キャラのアニメーション完了コールバック（useCallbackでメモ化）
  const handleEnemyAnimationComplete = useCallback(() => {
    console.log('🎊 EnemyCharacterSection: 敵アニメーション完了コールバック実行');
    console.log('👹 GamePlayScreenのsetIsEnemyAnimating(false)を呼び出します');
    onEnemyAnimationComplete();
  }, [onEnemyAnimationComplete]);

  // enemy1アニメーション完了コールバック
  const handleEnemy1AnimationComplete = useCallback(() => {
    console.log('🎊 EnemyCharacterSection: enemy1アニメーション完了コールバック実行');
    if (onEnemy1AnimationComplete) {
      onEnemy1AnimationComplete();
    }
  }, [onEnemy1AnimationComplete]);

  // 敵キャラのアニメーション開始（手動トリガー用）
  const startEnemyAnimation = useCallback(() => {
    console.log('🔥 EnemyCharacterSection: 手動で敵アニメーション開始');
    onStartEnemyAnimation();
  }, [onStartEnemyAnimation]);

  // GamePlayScreenからのisEnemyAnimatingを監視してログ出力
  useEffect(() => {
    if (isEnemyAnimating) {
      console.log('🎯 EnemyCharacterSection: 敵アニメーション状態がtrueに変更されました（GamePlayScreenから）');
    } else {
      console.log('🎯 EnemyCharacterSection: 敵アニメーション状態がfalseに変更されました');
    }
  }, [isEnemyAnimating]);

  // enemy0の表示/非表示スタイル（カウントダウン開始前は表示、残り3秒で透明）
  const enemy0Style = countdown2Status === 'waiting' ? {
    opacity: 1  // カウントダウン開始前は表示
  } : countdown2Remaining > 3 ? {
    opacity: 1  // 残り3秒より多い場合は表示
  } : {
    opacity: 0  // 残り3秒以下で透明
  };

  // enemy1の表示/非表示スタイル（カウントダウン開始前は非表示、残り3秒まで非表示）
  const enemy1Style = countdown2Status === 'waiting' ? {
    opacity: 0  // カウントダウン開始前は透明
  } : countdown2Remaining > 3 ? {
    opacity: 0  // 残り3秒より多い場合は透明
  } : {
    opacity: 1  // 残り3秒以下で表示
  };

  // カウントダウン開始関数
  const startCountdown = useCallback(() => {
    console.log('⏰ カウントダウン開始ボタンクリック');

    // 60秒カウントダウンを開始
    const userId = localStorage.getItem('currentUserId');
    if (countdown2Status === 'waiting' && userId) {
      const matchedUserId = localStorage.getItem('matchedUserId');
      if (matchedUserId) {
        const userIds = [userId, matchedUserId].sort();
        const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

        // カウントダウン開始
        const countdown2Ref = ref(database, `sessions/${sessionId}/countdown2`);
        set(countdown2Ref, {
          startTime: serverTimestamp(),
          duration: 60000, // 60秒
          status: 'active'
        }).catch(console.error);

        console.log('60秒カウントダウン開始');
      }
    }
  }, [countdown2Status]);

  return (
    <>
      {/* 敵キャラ表示エリア - enemy0とenemy1を重ねて表示 */}
      <div className="absolute w-[720px] h-[720px]" style={{
        top: 'calc(40% + 50px)',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 30
      }}>
        <Suspense fallback={
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-white text-xl">敵キャラ読み込み中...</div>
          </div>
        }>
          {/* enemy0 - 最初の敵キャラ（残り3秒で透明） */}
          <div className="absolute inset-0" style={enemy0Style}>
            <EnemyCharacterModel
              modelPath="/Models/enemy0.glb"
              isAnimating={isEnemyAnimating}
              onAnimationComplete={handleEnemyAnimationComplete}
            />
          </div>

          {/* enemy1 - 同じ位置に重ねて表示（残り3秒まで非表示、残り3秒でアニメーション） */}
          <div className="absolute inset-0" style={enemy1Style}>
            <EnemyCharacterModel
              modelPath="/Models/enemy1.glb"
              isAnimating={isEnemy1Animating}
              onAnimationComplete={handleEnemy1AnimationComplete}
            />
          </div>
        </Suspense>
      </div>

      {/* 敵キャラ制御ボタンエリア */}
      {/* <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-32 flex gap-2 z-40">
        協力攻撃ボタン
        <button
          onClick={startEnemyAnimation}
          disabled={isEnemyAnimating || !bothUsersOK}
          className={`text-white font-medium px-3 py-2 rounded text-sm transition-all duration-200
                     hover:scale-105 shadow-md ${
            isEnemyAnimating || !bothUsersOK
              ? 'bg-gray-500 cursor-not-allowed'
              : bothUsersOK
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 animate-pulse shadow-xl border border-yellow-300'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isEnemyAnimating ? 'アニメ中...' :
           !myOKStatus ? '準備中...' :
           !partnerOKStatus ? '相手待ち...' :
           bothUsersOK ? '🔥 協力攻撃' : '攻撃！'}
        </button>

        単独アニメーションボタン
        <button
          onClick={startEnemyAnimation}
          disabled={isEnemyAnimating}
          className={`text-white font-medium px-3 py-2 rounded text-sm transition-all duration-200
                     hover:scale-105 shadow-md ${
            isEnemyAnimating
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 shadow-lg border border-purple-300'
          }`}
        >
          {isEnemyAnimating ? 'アニメ中...' : '⚡ 単独攻撃'}
        </button>

        カウントダウン専用ボタン
        <button
          onClick={startCountdown}
          disabled={countdown2Status !== 'waiting'}
          className={`text-white font-medium px-3 py-2 rounded text-sm transition-all duration-200
                     hover:scale-105 shadow-md ${
            countdown2Status !== 'waiting'
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 shadow-lg border border-red-300'
          }`}
        >
          {countdown2Status === 'active' ? 'カウント中...' :
           countdown2Status === 'finished' ? '終了' :
           '⏰ カウント開始'}
        </button>
      </div> */}
    </>
  );
});

export default EnemyCharacterSection;