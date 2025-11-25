import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, off, onDisconnect, serverTimestamp, set, update, get } from 'firebase/database';
import { auth, database } from './firebase';
import { getAgoraRTMService, cleanupAgoraRTMService, ButtonState, GirlPostureState, BoyPostureState } from './agoraRTMService';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import EnemyCharacterSection from './EnemyCharacterSection';
import PlayerCharacterSection from './PlayerCharacterSection';

interface GamePlayScreenProps {
  onGameClear?: () => void;
}

const GamePlayScreen: React.FC<GamePlayScreenProps> = ({ onGameClear }) => {
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing'>('setup');
  const [userId, setUserId] = useState<string | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [otherUsersPressed, setOtherUsersPressed] = useState<string[]>([]);

  // 押している人の名前を保持するstate
  const [pressingUserName, setPressingUserName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<Record<string, { displayName: string }>>({});
  const [rtmStatus, setRtmStatus] = useState<string>('RTM初期化中...');

  // RTMやFirebaseから受け取ったユーザー情報を保持
  const [rtmUsers, setRtmUsers] = useState<Record<string, ButtonState>>({});

  // Girl姿勢同期用のstate
  const [rtmGirlPostures, setRtmGirlPostures] = useState<Record<string, GirlPostureState>>({});

  // Boy姿勢同期用のstate
  const [rtmBoyPostures, setRtmBoyPostures] = useState<Record<string, BoyPostureState>>({});

  // Boy姿勢ボタンの押下状態
  const [boyStandingButtonPressed, setBoyStandingButtonPressed] = useState(false);
  const [boySittingButtonPressed, setBoySittingButtonPressed] = useState(false);

  // RTM接続状態（ボタンの有効/無効を制御）
  const [isRtmConnected, setIsRtmConnected] = useState(false);

  // 音声ガイド再生済みフラグ
  const [hasPlayedGuide, setHasPlayedGuide] = useState(false);
  const [hasPlayedGuide2, setHasPlayedGuide2] = useState(false);

  // 5点検出状態
  const [hasValidPose, setHasValidPose] = useState(false);
  const [validPointsCount, setValidPointsCount] = useState(0);

  // 7秒タイマー状態
  const [showTimerMessage, setShowTimerMessage] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  // 敵キャラ専用アニメーション状態（60秒カウントダウンのマイルストーンで使用）
  const [isEnemyAnimating, setIsEnemyAnimating] = useState(false);
  // enemy1専用アニメーション状態（残り2秒で開始）
  const [isEnemy1Animating, setIsEnemy1Animating] = useState(false);

  // キャラクター姿勢状態
  const [boyPosture, setBoyPosture] = useState<'standing' | 'sitting'>('standing');
  const [girlPosture, setGirlPosture] = useState<'standing' | 'sitting'>('standing');

  // 人間の姿勢判定結果
  const [humanPosture, setHumanPosture] = useState<'standing' | 'sitting'>('standing');

  // MediaPipe姿勢データを保持
  const [currentPoseLandmarks, setCurrentPoseLandmarks] = useState<any>(null);

  // threshold変数（初期値1、OK表示時に5に変化）
  const thresholdRef = useRef(1);

  // 60秒カウントダウン関連state
  const [countdown2Status, setCountdown2Status] = useState<'waiting' | 'active' | 'finished'>('waiting');
  const [countdown2Remaining, setCountdown2Remaining] = useState(60); // 残り秒数を管理
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const countdown2Interval = useRef<NodeJS.Timeout | null>(null);
  const sessionRef = useRef<any>(null);

  // 敵アニメーション状態のデバッグログ
  useEffect(() => {
    console.log('👹 敵アニメーション状態変更:', isEnemyAnimating ? '敵アニメーション開始' : '敵アニメーション停止');
  }, [isEnemyAnimating]);

  // 敵アニメーション制御関数をメモ化
  const handleEnemyAnimationComplete = useCallback(() => {
    console.log('🎊 GamePlayScreen: 敵アニメーション完了コールバック');
    setIsEnemyAnimating(false);
  }, []);

  // enemy1アニメーション完了時の処理（GameClearに遷移）
  const handleEnemy1AnimationComplete = useCallback(() => {
    console.log('🎊 GamePlayScreen: enemy1アニメーション完了 → GameClearScreenに遷移');
    setIsEnemy1Animating(false);
    if (onGameClear) {
      onGameClear();
    }
  }, [onGameClear]);

  const handleStartEnemyAnimation = useCallback(() => {
    console.log('🔥 GamePlayScreen: 敵アニメーション開始');
    setIsEnemyAnimating(true);
  }, []);

  // OKcheck更新済みフラグ
  const hasUpdatedOKcheck = useRef(false);

  // 両ユーザーのOKcheck状態
  const [bothUsersOK, setBothUsersOK] = useState(false);
  const [myOKStatus, setMyOKStatus] = useState(false);
  const [partnerOKStatus, setPartnerOKStatus] = useState(false);

  // キャラクター割り当て状態
  const [myCharacterType, setMyCharacterType] = useState<'male' | 'female' | null>(null);
  const [myCharacterNumber, setMyCharacterNumber] = useState<1 | 2 | null>(null);
  const [characterAssignment, setCharacterAssignment] = useState<{male: string, female: string, character1: string, character2: string} | null>(null);

  // カウントダウンマイルストーン管理
  const triggeredMilestones = useRef<Set<number>>(new Set());
  const triggered3SecondMilestone = useRef<boolean>(false);

  // キャラクター点滅用マイルストーン管理
  const triggered48SecondMilestone = useRef<boolean>(false);
  const triggered38SecondMilestone = useRef<boolean>(false);
  const triggered28SecondMilestone = useRef<boolean>(false);
  const triggered18SecondMilestone = useRef<boolean>(false);
  const triggered8SecondMilestone = useRef<boolean>(false);

  // 自分のキャラクター点滅状態
  const [isMyCharacterBlinking, setIsMyCharacterBlinking] = useState(false);

  // 相手のキャラクター点滅状態
  const [isPartnerCharacterBlinking, setIsPartnerCharacterBlinking] = useState(false);

  // 自分のキャラの点滅回数カウンター
  const [myCharacterBlinkCount, setMyCharacterBlinkCount] = useState(0);

  // 相手のキャラの点滅回数カウンター
  const [partnerCharacterBlinkCount, setPartnerCharacterBlinkCount] = useState(0);

  // ゲームオーバー状態
  const [isGameOver, setIsGameOver] = useState(false);

  // 自分のキャラの実際の表示状態を管理する専用フラグ（useRefで同期的更新）
  const myActualCharacterPostureRef = useRef<'standing' | 'sitting'>('standing');

  // 音声ガイド再生用フック
  const useAudioGuide = () => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playGuide = useCallback((audioFile: string) => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(audioFile);
        audioRef.current.volume = 0.7;
        audioRef.current.play().catch(err => {
          console.error('音声再生エラー:', err);
        });
      } catch (error) {
        console.error('音声ファイルエラー:', error);
      }
    }, []);

    const stopGuide = useCallback(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }, []);

    useEffect(() => {
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
    }, []);

    return { playGuide, stopGuide };
  };

  const { playGuide, stopGuide } = useAudioGuide();
  // タイマー管理用のRef
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageTimerRef = useRef<NodeJS.Timeout | null>(null);

  // タイマーが動作中かどうかを追跡
  const isTimerRunningRef = useRef(false);

  // すべてのタイマーをクリアする関数
  const clearAllTimers = useCallback(() => {
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
    isTimerRunningRef.current = false;
    console.log('タイマーをクリアしました');
  }, []);

  // 姿勢切り替え関数
  const toggleBoyPosture = useCallback(() => {
    setBoyPosture(prev => prev === 'standing' ? 'sitting' : 'standing');
  }, []);

  const toggleGirlPosture = useCallback(() => {
    setGirlPosture(prev => prev === 'standing' ? 'sitting' : 'standing');
  }, []);

  // 手動で背景切り替えを実行する関数
  const skipToNextPhase = useCallback(() => {
    console.log('手動で背景切り替えを実行');
    clearAllTimers();
    setShowTimerMessage(true);
    setIsTimerActive(false);
    setRemainingTime(0);
    isTimerRunningRef.current = false;
  }, [clearAllTimers]);

  // 手動で60秒カウントダウンを開始する関数
  const start60SecondCountdown = useCallback(async () => {
    if (!userId) return;

    console.log('手動で60秒カウントダウンを開始');

    // セッションIDを生成
    const matchedUserId = localStorage.getItem('matchedUserId');
    if (!matchedUserId) {
      console.error('マッチしたユーザーIDが見つかりません');
      return;
    }

    const userIds = [userId, matchedUserId].sort();
    const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    try {
      // 両ユーザーのOKcheckをtrueに設定
      const sessionRef = ref(database, `sessions/${sessionId}/participants`);
      await update(sessionRef, {
        [`${userId}/OKcheck`]: true,
        [`${matchedUserId}/OKcheck`]: true
      });

      // 60秒カウントダウンを開始
      const countdown2Ref = ref(database, `sessions/${sessionId}/countdown2`);
      await set(countdown2Ref, {
        status: 'active',
        startTime: Date.now() + serverTimeOffset,
        duration: 60000 // 60秒
      });

      console.log('60秒カウントダウンを手動で開始しました');
    } catch (error) {
      console.error('60秒カウントダウンの開始に失敗:', error);
    }
  }, [userId, serverTimeOffset]);

  // タイマーを開始する関数
  const startDetectionTimer = useCallback(() => {
    // 既存のタイマーをクリア（重複防止）
    clearAllTimers();
    
    console.log('5点検出: タイマー開始');
    
    // タイマー実行中フラグを立てる
    isTimerRunningRef.current = true;
    
    // UI状態を設定
    setIsTimerActive(true);
    setRemainingTime(7.5);
    //setShowTimerMessage(false);
    
    // 500ms後に音声ガイド再生
    voiceTimerRef.current = setTimeout(() => {
      playGuide('/guide/voice2.mp3');
      setHasPlayedGuide2(true);
      setRemainingTime(7);
      
      // 7秒後に「7秒経過」を表示
      messageTimerRef.current = setTimeout(() => {
        setShowTimerMessage(true);
        setIsTimerActive(false);
        setRemainingTime(0);
        isTimerRunningRef.current = false;
        console.log('7秒経過メッセージを表示');
      }, 7000);
    }, 500);
  }, [clearAllTimers, playGuide]);
  // 前回のcurrentValidPoseの値を保持
  const prevValidPoseRef = useRef(false);

  // 人間の姿勢変化を自分に割り当てられたキャラクターに同期
  useEffect(() => {
    // 新フラグを姿勢認識結果で即座に更新（同期的）
    const prevPosture = myActualCharacterPostureRef.current;
    myActualCharacterPostureRef.current = humanPosture;
    
    // フラグ更新をコンソールログに出力
    console.log(`🎭 フラグ更新: ${prevPosture} → ${humanPosture} (姿勢認識) (時刻: ${new Date().toLocaleTimeString()})`);

    if (myCharacterNumber === 1) {
      // キャラ1（Boy）の場合：人間の姿勢をBoyに同期
      setBoyPosture(humanPosture);
      console.log(`🤖 姿勢認識→Boy同期: 人間=${humanPosture === 'standing' ? '立ち' : 'しゃがみ'} → Boy=${humanPosture === 'standing' ? '立ち' : 'しゃがみ'}`);

      // RTMでも送信（Boyの姿勢変化として）
      if (humanPosture === 'standing') {
        setBoyStandingButtonPressed(true);
        setBoySittingButtonPressed(false);
        updateBoyPostureRTM('standing', true, false);
      } else {
        setBoyStandingButtonPressed(false);
        setBoySittingButtonPressed(true);
        updateBoyPostureRTM('sitting', false, true);
      }
    } else if (myCharacterNumber === 2) {
      // キャラ2（Girl）の場合：人間の姿勢をGirlに同期
      setGirlPosture(humanPosture);
      console.log(`🤖 姿勢認識→Girl同期: 人間=${humanPosture === 'standing' ? '立ち' : 'しゃがみ'} → Girl=${humanPosture === 'standing' ? '立ち' : 'しゃがみ'}`);

      // RTMでも送信（Girlの姿勢変化として）
      updateGirlPostureRTM(humanPosture);
    }
  }, [humanPosture, myCharacterNumber]);

  // 点滅回数を監視してゲームオーバー判定
  useEffect(() => {
    if (myCharacterBlinkCount >= 3 || partnerCharacterBlinkCount >= 3) {
      console.log('🚨 ゲームオーバー！点滅回数が3回に達しました');
      console.log(`自分: ${myCharacterBlinkCount}回, 相手: ${partnerCharacterBlinkCount}回`);
      setIsGameOver(true);

      // 3秒後にタイトル画面に戻る
      const timer = setTimeout(() => {
        console.log('⏰ 3秒経過：タイトル画面に戻ります');
        // ページをリロードしてスタート画面に戻る
        window.location.href = '/';
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [myCharacterBlinkCount, partnerCharacterBlinkCount]);

  // ウェブカメラ機能
  const useWebCamera = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [videoDimensions, setVideoDimensions] = useState({
      width: 320,
      height: 240,
      aspectRatio: 4/3
    });

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // 解像度検出のためのイベントリスナー
          videoRef.current.addEventListener('loadedmetadata', () => {
            const video = videoRef.current;
            if (video) {
              const width = video.videoWidth || 640;
              const height = video.videoHeight || 480;
              setVideoDimensions({
                width,
                height,
                aspectRatio: width / height
              });
            }
          });

          setIsCameraEnabled(true);
          setCameraError(null);
        }
      } catch (err) {
        setCameraError('カメラにアクセスできません');
        setIsCameraEnabled(false);
      }
    };

    const stopCamera = () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        setIsCameraEnabled(false);
      }
    };

    // 縦横比を維持したレスポンシブサイズ計算
    const calculateResponsiveSize = (originalWidth: number, originalHeight: number) => {
      const maxWidth = Math.min(800, window.innerWidth * 0.8);
      const maxHeight = Math.min(600, window.innerHeight * 0.5);

      const aspectRatio = originalWidth / originalHeight;

      let displayWidth = originalWidth;
      let displayHeight = originalHeight;

      if (displayWidth > maxWidth) {
        displayWidth = maxWidth;
        displayHeight = displayWidth / aspectRatio;
      }

      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight * aspectRatio;
      }

      return {
        width: Math.round(displayWidth),
        height: Math.round(displayHeight)
      };
    };

    return { videoRef, isCameraEnabled, cameraError, startCamera, stopCamera, videoDimensions, calculateResponsiveSize };
  };

  const { videoRef, isCameraEnabled, cameraError, startCamera, stopCamera, videoDimensions, calculateResponsiveSize } = useWebCamera();

  // MediaPipe骨格認識機能
  const usePoseDetection = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const poseRef = useRef<Pose | null>(null);
    const cameraRef = useRef<Camera | null>(null);
    const [isPoseDetecting, setIsPoseDetecting] = useState(false);
    const [poseError, setPoseError] = useState<string | null>(null);
    const [hasDetectedPose, setHasDetectedPose] = useState(false);

    const drawPose = useCallback((results: any) => {
      console.log('🎯 drawPose実行開始 - threshold値:', thresholdRef.current);
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        // 点群が検出されたら状態を更新
        if (!hasDetectedPose) {
          setHasDetectedPose(true);
        }

        // 姿勢データを保存
        setCurrentPoseLandmarks(results.poseLandmarks);

        // 重要なランドマークのチェック（腰、肩、鼻）
        const landmarks = results.poseLandmarks;
        const nose = landmarks[0]; // 鼻
        const leftShoulder = landmarks[11]; // 左肩
        const rightShoulder = landmarks[12]; // 右肩
        const leftHip = landmarks[23]; // 左腰
        const rightHip = landmarks[24]; // 右腰

        // リアルタイム肩座標のコンソール出力
        if (leftShoulder && rightShoulder && canvas) {
          // 肩の中点Y座標を計算（ピクセル座標）
          const shoulderCenterY = ((leftShoulder.y + rightShoulder.y) / 2) * canvas.height;

          // しゃがみ/立ちの判定（肩が閾値より小さければしゃがみ、大きければ立ち）
          const posture = shoulderCenterY < thresholdRef.current ? '立ち' : 'しゃがみ';
          const postureState = shoulderCenterY < thresholdRef.current ? 'standing' : 'sitting';

          // 人間の姿勢状態を更新
          setHumanPosture(postureState);

          // 正規化座標（0-1）とピクセル座標の両方を表示
          console.log(
            `肩座標 [正規化] 左:(${leftShoulder.x.toFixed(2)}, ${leftShoulder.y.toFixed(2)}) 右:(${rightShoulder.x.toFixed(2)}, ${rightShoulder.y.toFixed(2)}) ` +
            `[ピクセル] 左:(${(leftShoulder.x * canvas.width).toFixed(0)}, ${(leftShoulder.y * canvas.height).toFixed(0)}) 右:(${(rightShoulder.x * canvas.width).toFixed(0)}, ${(rightShoulder.y * canvas.height).toFixed(0)}) ` +
            `肩中点Y: ${shoulderCenterY.toFixed(1)} threshold: ${thresholdRef.current} 姿勢: ${posture}`
          );
        }

        // 信頼度のしきい値（0.5以上で有効とする）
        const confidenceThreshold = 0.5;

        // 5つの重要なポイントをチェック
        const keyPoints = [
          { name: 'nose', point: nose },
          { name: 'leftShoulder', point: leftShoulder },
          { name: 'rightShoulder', point: rightShoulder },
          { name: 'leftHip', point: leftHip },
          { name: 'rightHip', point: rightHip }
        ];

        // 5点すべてが画面内にあり、信頼度が高いかチェック
        const validPoints = keyPoints.filter(({ point }) => {
          if (!point || point.visibility <= confidenceThreshold) return false;

          // 座標が画面内にあるかチェック（0-1の範囲）
          return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
        });

        // 有効な点の個数を更新
        setValidPointsCount(validPoints.length);

        // 5点すべてが有効な場合のみtrueとする
        const isValidPose = validPoints.length === 5;

        // 無条件でstateを更新
        setHasValidPose(isValidPose);

        // デバッグ用ログ
        if (isValidPose !== hasValidPose) {
          console.log(`5点検出状態変更: ${hasValidPose} → ${isValidPose}`);
        }

        // 骨格の接続線を描画
        drawConnectors(ctx, results.poseLandmarks, Pose.POSE_CONNECTIONS, {
          color: '#ffffff',
          lineWidth: 2
        });

        // 関節点を描画（デフォルト色）
        drawLandmarks(ctx, results.poseLandmarks, {
          color: '#4285f4',
          lineWidth: 1,
          radius: 5
        });

        // 重要なランドマーク（腰、肩、鼻）を赤色で強調表示
        if (isValidPose) {
          const importantPoints = validPoints.map(({ point }) => point);

          drawLandmarks(ctx, importantPoints, {
            color: '#ff0000',  // 赤色
            lineWidth: 2,
            radius: 8
          });
        }
      }

    }, [hasDetectedPose, hasValidPose]);


    const initializePose = useCallback(() => {
      try {
        const pose = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults(drawPose);
        poseRef.current = pose;

        return pose;
      } catch (error) {
        setPoseError('MediaPipeの初期化に失敗しました');
        return null;
      }
    }, [drawPose]);

    const startPoseDetection = useCallback(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        const pose = initializePose();
        if (!pose) return;

        // Canvas サイズをVideoに合わせる
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // CSS表示サイズは親要素に追従
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const camera = new Camera(video, {
          onFrame: async () => {
            if (poseRef.current) {
              await poseRef.current.send({ image: video });
            }
          },
          width: 640,
          height: 480
        });

        cameraRef.current = camera;
        await camera.start();
        setIsPoseDetecting(true);
        setPoseError(null);
      } catch (error) {
        setPoseError('骨格認識の開始に失敗しました');
        setIsPoseDetecting(false);
      }
    }, [initializePose]);

    const stopPoseDetection = useCallback(() => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (poseRef.current) {
        poseRef.current.close();
        poseRef.current = null;
      }
      setIsPoseDetecting(false);
    }, []);

    return {
      canvasRef,
      isPoseDetecting,
      poseError,
      hasDetectedPose,
      startPoseDetection,
      stopPoseDetection
    };
  };

  const { canvasRef, isPoseDetecting, poseError, hasDetectedPose, startPoseDetection, stopPoseDetection } = usePoseDetection();

  // 画面表示時にスクロール位置を一番上に戻す
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // サーバー時刻オフセットの取得
  useEffect(() => {
    const offsetRef = ref(database, '.info/serverTimeOffset');
    const unsubscribe = onValue(offsetRef, (snapshot) => {
      const offset = snapshot.val() || 0;
      setServerTimeOffset(offset);
    });
    return () => off(offsetRef, 'value', unsubscribe);
  }, []);

  // カメラの自動起動（setupフェーズから開始）
  useEffect(() => {
    const initializeCamera = async () => {
      await startCamera();
    };

    initializeCamera();

    return () => {
      stopPoseDetection();
      stopCamera();
      clearAllTimers(); // タイマーのクリーンアップを追加
    };
  }, []);

  // MediaPipe骨格認識の起動（playingフェーズのみ）
  useEffect(() => {
    if (gamePhase !== 'playing' || !isCameraEnabled) return;

    // カメラが起動してから少し待ってから骨格認識を開始
    const timer = setTimeout(() => {
      startPoseDetection();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopPoseDetection();
    };
  }, [gamePhase, isCameraEnabled]);
  // ゲームフェーズ変更時に前回値をリセット
  useEffect(() => {
    if (gamePhase === 'setup') {
      prevValidPoseRef.current = false;
      clearAllTimers();
    }
  }, [gamePhase, clearAllTimers]);

  // 点群検出後の最初の音声ガイド再生

  useEffect(() => {
    if (hasDetectedPose && gamePhase === 'playing' && !hasPlayedGuide) {
      // 少し遅延させてから音声を再生（ローディング画面が消えてから）
      const timer = setTimeout(() => {
        playGuide('/guide/voice1.mp3');
        setHasPlayedGuide(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [hasDetectedPose, gamePhase, hasPlayedGuide, playGuide]);


  // 5点検出後の2回目の音声ガイド再生と7秒タイマー開始

  // 5点検出の状態変化を監視してタイマーを制御
  // 5点検出の状態変化を監視してタイマーを制御
useEffect(() => {
  // ゲームが開始されていない、または最初の音声ガイドが再生されていない場合は何もしない
  if (gamePhase !== 'playing' || !hasPlayedGuide) {
    return;
  }
  
  // 前回の値と現在の値を比較
  const wasValidPose = prevValidPoseRef.current;
  const isValidPose = hasValidPose;  // ← ここを修正！currentValidPoseではなくhasValidPose
  
  // false → true: 5点検出開始
  if (!wasValidPose && isValidPose) {
    console.log('5点検出状態: false → true');
    startDetectionTimer();
  }
  // true → false: 5点検出終了
  else if (wasValidPose && !isValidPose) {
    console.log('5点検出状態: true → false');
    
    // タイマーをキャンセル
    clearAllTimers();
    // voice3を再生（5点から外れた時）
    playGuide('/guide/voice3.mp3');
    // UI状態をリセット
    setIsTimerActive(false);
    setRemainingTime(0);
    //setShowTimerMessage(false);
    setHasPlayedGuide2(false); // 次回再生可能にする
    
    // 音声も停止
    //stopGuide();
  }
  
  // 現在の値を保存（次回の比較用）
  prevValidPoseRef.current = isValidPose;
  
}, [hasValidPose, gamePhase, hasPlayedGuide, startDetectionTimer, clearAllTimers, stopGuide]);  // ← 依存配列もhasValidPoseに修正// プレゼンス設定

  const setupPresence = (uid: string, displayName: string) => {
    const presenceRef = ref(database, `presence/${uid}`);
    set(presenceRef, { displayName, online: true, lastSeen: serverTimestamp() });
    onDisconnect(presenceRef).set({ displayName, online: false, lastSeen: serverTimestamp() });
  };

  // Agora RTM（ボタン同期）
  const updateButtonStateRTM = async (pressed: boolean) => {
    if (!userId) return;
    setIsPressed(pressed);
    const rtmService = getAgoraRTMService();
    try {
      await rtmService.updateButtonStateFast(pressed);
            setRtmStatus(`RTM同期: ${pressed ? '押下' : '解除'}`);
    } catch (error) {
      setRtmStatus(`RTM同期失敗`);
      setIsPressed(!pressed);
    }
  };

  // Agora RTM（Girl姿勢同期）
  const updateGirlPostureRTM = async (posture: 'standing' | 'sitting') => {
    if (!userId) return;
    const rtmService = getAgoraRTMService();
    try {
      await rtmService.updateGirlPostureFast(posture);
      console.log(`🚀 Girl姿勢送信: ${posture}`);
    } catch (error) {
      console.error('Girl姿勢同期失敗:', error);
    }
  };

  // Agora RTM（Boy姿勢同期）
  const updateBoyPostureRTM = async (posture: 'standing' | 'sitting', standingPressed: boolean, sittingPressed: boolean) => {
    if (!userId) return;
    const rtmService = getAgoraRTMService();
    try {
      await rtmService.updateBoyPostureFast(posture, standingPressed, sittingPressed);
      console.log(`🚀 Boy姿勢送信: ${posture}, 立つボタン:${standingPressed}, しゃがむボタン:${sittingPressed}`);
    } catch (error) {
      console.error('Boy姿勢同期失敗:', error);
    }
  };
  
  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setLoading(false);
        localStorage.setItem('currentUserId', user.uid);
        const savedNickname = localStorage.getItem(`nickname_${user.uid}`) || `ゲスト${Math.floor(Math.random() * 100)}`;
        // ニックネームをallUsers stateにも保存
        setAllUsers(prev => ({ ...prev, [user.uid]: { displayName: savedNickname } }));
        setupPresence(user.uid, savedNickname);
        await initializeRTMService();
      } else {
        signInAnonymously(auth).catch((error) => console.error('匿名ログインエラー:', error));
      }
    });

    return () => {
      unsubscribe();
      cleanupAgoraRTMService();
      stopGuide(); // 音声ガイドも停止
    };
  }, []);
  
  // RTMサービスの初期化とリスナー設定
  const initializeRTMService = async () => {
    try {
      const rtmService = getAgoraRTMService();

      // RTMボタン状態変更のリスナー設定
      rtmService.onButtonStateChange((states) => {
        setRtmUsers(prev => ({ ...prev, ...states }));

        // 押しているユーザーIDと名前を取得してstateを更新
        const pressingUserEntry = Object.entries(states).find(([id, state]) => state.pressed);

        if (pressingUserEntry) {
          const [pressingId, pressingState] = pressingUserEntry;
          
          // 相手が押していない状態から押している状態に変化した場合
          if (otherUsersPressed.length === 0) {
            console.log(`🌟 相手がボタンを押し始めたため、相手のキャラクターを1.5秒点滅開始`);

            // 相手の点滅回数をカウントアップ
            setPartnerCharacterBlinkCount(prevCount => {
              const newCount = prevCount + 1;
              console.log(`🔢 相手の点滅回数: ${newCount}回目`);
              return newCount;
            });

            setIsPartnerCharacterBlinking(true);

            // 1.5秒後に点滅停止
            setTimeout(() => {
              setIsPartnerCharacterBlinking(false);
              console.log(`🌟 相手のキャラクター点滅終了`);
            }, 1500);
          }
          
          setOtherUsersPressed([pressingId]);
          setPressingUserName(pressingState.displayName); // 名前をセット
        } else {
          // 誰も押していない場合
          const releasedUserId = Object.keys(states)[0];
          setOtherUsersPressed(prev => prev.filter(id => id !== releasedUserId));
          // 離したユーザーが現在表示中のユーザーなら名前をリセット
          if (pressingUserName === states[releasedUserId]?.displayName) {
             setPressingUserName(null);
          }
        }
      });

      // RTM Girl姿勢状態変更のリスナー設定
      rtmService.onGirlPostureChange((states) => {
        setRtmGirlPostures(prev => ({ ...prev, ...states }));

        // 相手のGirl姿勢ボタン状態をコンソールログで表示
        Object.entries(states).forEach(([userId, state]) => {
          console.log(`🎭 相手のGirl姿勢ボタン状態受信:`, {
            userId,
            displayName: state.displayName,
            posture: state.posture,
            timestamp: new Date(state.timestamp).toLocaleTimeString()
          });

          // 相手のGirlの変化を自分のGirlに同期
          if (state.posture === 'standing') {
            console.log('🔄 相手のGirlが立ったため、自分のGirlも立つように同期');
            setGirlPosture('standing');
          } else if (state.posture === 'sitting') {
            console.log('🔄 相手のGirlがしゃがんだため、自分のGirlもしゃがむように同期');
            setGirlPosture('sitting');
          }
        });
      });

      // RTM Boy姿勢状態変更のリスナー設定
      rtmService.onBoyPostureChange((states) => {
        setRtmBoyPostures(prev => ({ ...prev, ...states }));

        // 相手のBoy姿勢ボタン状態をコンソールログで表示
        Object.entries(states).forEach(([userId, state]) => {
          console.log(`🤖 相手のBoy姿勢ボタン状態受信:`, {
            userId,
            displayName: state.displayName,
            posture: state.posture,
            standingButtonPressed: state.standingButtonPressed,
            sittingButtonPressed: state.sittingButtonPressed,
            timestamp: new Date(state.timestamp).toLocaleTimeString()
          });

          // 相手のBoyの変化を自分のBoyに同期
          if (state.posture === 'standing') {
            console.log('🔄 相手のBoyが立ったため、自分のBoyも立つように同期');
            setBoyPosture('standing');
            setBoyStandingButtonPressed(state.standingButtonPressed);
            setBoySittingButtonPressed(state.sittingButtonPressed);
          } else if (state.posture === 'sitting') {
            console.log('🔄 相手のBoyがしゃがんだため、自分のBoyもしゃがむように同期');
            setBoyPosture('sitting');
            setBoyStandingButtonPressed(state.standingButtonPressed);
            setBoySittingButtonPressed(state.sittingButtonPressed);
          }
        });
      });

      const success = await rtmService.initialize();
      setRtmStatus(success ? 'RTM接続完了' : 'RTM接続失敗');
      setIsRtmConnected(success); // RTM接続状態でボタンの有効性を制御
    } catch (error) {
      setRtmStatus(`RTM初期化エラー`);
    }
  };
  
  // iPhone Chrome用コンテキストメニュー対策
  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleTouchStart = (e: Event) => {
      // iPhone Chrome用：タッチイベントの詳細制御
      if (/(iPhone|iPad|iPod)/i.test(navigator.userAgent)) {
        e.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // Firebaseのプレゼンス情報から全ユーザーの表示名を取得・保持
  useEffect(() => {
    const presenceRef = ref(database, 'presence');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userDisplayNames = Object.entries(data).reduce((acc, [uid, userData]) => {
          acc[uid] = { displayName: (userData as any).displayName };
          return acc;
        }, {} as Record<string, { displayName: string }>);
        setAllUsers(prev => ({ ...prev, ...userDisplayNames }));
      }
    });
    return () => off(presenceRef, 'value', unsubscribe);
  }, []);

  // セッション情報とキャラクター割り当ての監視
  useEffect(() => {
    if (!userId) return;

    // LocalStorageから相手のIDを取得してセッションIDを構築
    const matchedUserId = localStorage.getItem('matchedUserId');
    
    // マッチングなしの場合：デフォルトで男キャラ（キャラ1）を割り当て
    if (!matchedUserId) {
      console.log('🎭 マッチングなし：デフォルトでキャラ1（男キャラ・Boy）を割り当て');
      setMyCharacterType('male');
      setMyCharacterNumber(1);
      return;
    }

    // 2つのユーザーIDをソートして決定的なセッションIDを生成
    const userIds = [userId, matchedUserId].sort();
    const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    console.log(`セッション監視開始: ${sessionId}`);

    const sessionRef = ref(database, `sessions/${sessionId}`);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const sessionData = snapshot.val();
      if (sessionData) {
        // OKcheck状態の監視
        const participants = sessionData.participants;
        if (participants) {
          const myOK = participants[userId]?.OKcheck || false;
          const partnerOK = participants[matchedUserId]?.OKcheck || false;

          setMyOKStatus(myOK);
          setPartnerOKStatus(partnerOK);
          setBothUsersOK(myOK && partnerOK);

          console.log(`OKcheck状態更新: 自分=${myOK}, 相手=${partnerOK}, 両方=${myOK && partnerOK}`);

          // キャラクター割り当ての監視と初期ラベリング
          const myCharType = participants[userId]?.characterType;
          const myCharNum = participants[userId]?.characterNumber;

          if (myCharType && myCharacterType !== myCharType) {
            setMyCharacterType(myCharType);

            // ラベリング結果をconsoleに出力
            if (myCharType === 'male') {
              console.log('🎭 あなたは男です');
            } else if (myCharType === 'female') {
              console.log('🎭 あなたは女です');
            }
          }

          if (myCharNum && myCharacterNumber !== myCharNum) {
            setMyCharacterNumber(myCharNum);
            console.log(`🎭 あなたはキャラ${myCharNum}です`);
          }
        }

        // キャラクター割り当て情報の保存
        if (sessionData.characterAssignment) {
          setCharacterAssignment(sessionData.characterAssignment);
          console.log('🎭 キャラクター割り当て情報取得:', sessionData.characterAssignment);
        }
      }
    });

    return () => off(sessionRef, 'value', unsubscribe);
  }, [userId, myCharacterType, myCharacterNumber]);

  // 60秒カウントダウンのセッション管理と同期
  useEffect(() => {
    if (!userId) return;

    const matchedUserId = localStorage.getItem('matchedUserId');
    if (!matchedUserId) return;

    // セッションIDを生成
    const userIds = [userId, matchedUserId].sort();
    const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    sessionRef.current = ref(database, `sessions/${sessionId}`);

    // セッション状態の監視
    const sessionListener = (snapshot: any) => {
      const sessionData = snapshot.val();
      if (!sessionData) return;

      const { countdown2 } = sessionData;
      if (!countdown2) return;

      // カウントダウン状態の更新
      if (countdown2.status === 'active' && countdown2.startTime) {
        setCountdown2Status('active');

        // 同期カウントダウンタイマーを開始
        if (countdown2Interval.current) {
          clearInterval(countdown2Interval.current);
        }

        countdown2Interval.current = setInterval(() => {
          const now = Date.now() + serverTimeOffset;
          const elapsed = now - countdown2.startTime;
          const remaining = Math.max(0, Math.ceil((countdown2.duration - elapsed) / 1000));

          // 残り秒数をstateに保存（enemy1表示制御用）
          setCountdown2Remaining(remaining);

          console.log(`⏰ 60秒カウントダウン残り: ${remaining}秒`);

          // 敵アニメーション用マイルストーンチェック（50, 40, 30, 20, 10秒）
          const enemyMilestones = [50, 40, 30, 20, 10];
          enemyMilestones.forEach(milestone => {
            if (remaining === milestone && !triggeredMilestones.current.has(milestone)) {
              triggeredMilestones.current.add(milestone);
              console.log(`🎯 敵アニメーションマイルストーン: ${milestone}秒 - enemy0アニメーション開始`);
              console.log(`👹 setIsEnemyAnimating(true)を実行します`);
              setIsEnemyAnimating(true);
            }
          });

          // enemy1アニメーション用マイルストーン（残り3秒）
          if (remaining === 3 && !triggered3SecondMilestone.current) {
            triggered3SecondMilestone.current = true;
            console.log('🎯 残り3秒マイルストーン: enemy1アニメーション開始');
            setIsEnemy1Animating(true);
          }

          // キャラクター点滅チェック用のマイルストーン（48, 38, 28, 18, 8秒）
          const characterBlinkMilestones = [
            { seconds: 48, triggered: triggered48SecondMilestone },
            { seconds: 38, triggered: triggered38SecondMilestone },
            { seconds: 28, triggered: triggered28SecondMilestone },
            { seconds: 18, triggered: triggered18SecondMilestone },
            { seconds: 8, triggered: triggered8SecondMilestone }
          ];

          // 各マイルストーンでチェック
          characterBlinkMilestones.forEach(({ seconds, triggered }) => {
            if (remaining === seconds && !triggered.current) {
              triggered.current = true;
              console.log(`✨ ${seconds}秒マイルストーン: 自分のキャラクター状態チェック開始`);
              
              console.log(`🔍 DEBUG: myActualCharacterPostureRef.current = "${myActualCharacterPostureRef.current}"`);
              console.log(`🔍 DEBUG: myActualCharacterPostureRef.current === 'sitting' = ${myActualCharacterPostureRef.current === 'sitting'}`);
              
              // myActualCharacterPostureRefで直接条件分岐
              if (myActualCharacterPostureRef.current === 'sitting') {
                console.log(`😴 ${seconds}秒時点: 自分のキャラが座っているため点滅なし`);
              } else {
                console.log(`✨ ${seconds}秒時点: 自分のキャラが立っているため点滅開始`);

                // 点滅回数をカウントアップ
                setMyCharacterBlinkCount(prevCount => {
                  const newCount = prevCount + 1;
                  console.log(`🔢 点滅回数: ${newCount}回目`);
                  return newCount;
                });

                setIsMyCharacterBlinking(true);

                // 点滅開始と同時にボタンを自動押下
                console.log(`🔴 ${seconds}秒時点: 自動ボタン押下開始`);
                updateButtonStateRTM(true);

                // 1.5秒後に点滅停止とボタン解放
                setTimeout(() => {
                  setIsMyCharacterBlinking(false);
                  console.log(`✨ ${seconds}秒時点の点滅終了`);

                  // ボタンも自動解放
                  console.log(`⚪ ${seconds}秒時点: 自動ボタン解放`);
                  updateButtonStateRTM(false);
                }, 1500);
              }
            }
          });

          if (remaining <= 0) {
            setCountdown2Status('finished');
            if (countdown2Interval.current) {
              clearInterval(countdown2Interval.current);
              countdown2Interval.current = null;
            }
            // カウントダウン終了時に全マイルストーンをリセット
            triggeredMilestones.current.clear();
            triggered3SecondMilestone.current = false;
            triggered48SecondMilestone.current = false;
            triggered38SecondMilestone.current = false;
            triggered28SecondMilestone.current = false;
            triggered18SecondMilestone.current = false;
            triggered8SecondMilestone.current = false;
            console.log('⏰ 60秒カウントダウン完了');
          }
        }, 1000);
      }
    };

    onValue(sessionRef.current, sessionListener);

    return () => {
      if (sessionRef.current) {
        off(sessionRef.current, 'value', sessionListener);
      }
      if (countdown2Interval.current) {
        clearInterval(countdown2Interval.current);
        countdown2Interval.current = null;
      }
    };
  }, [userId, serverTimeOffset]);

  // Setup phase UI
  if (gamePhase === 'setup') {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center text-white overflow-hidden relative">
        {/* Hidden camera for preloading */}
        <div className="absolute top-0 left-0 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
          <div
            className="relative"
            style={{
              width: `${calculateResponsiveSize(videoDimensions.width, videoDimensions.height).width}px`,
              height: `${calculateResponsiveSize(videoDimensions.width, videoDimensions.height).height}px`
            }}
          >
            {!cameraError && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ filter: 'blur(5px)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              </>
            )}
          </div>
        </div>

        {/* Ready button - moved to top and made larger */}
        <div className="mt-20 mb-12">
          <button
            onClick={() => setGamePhase('playing')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-12 py-8 rounded-2xl text-2xl md:text-3xl transition-all duration-200 hover:scale-105 shadow-2xl"
          >
            準備完了
          </button>
        </div>

        {/* Main message */}
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-bold text-center px-4">
            スマホを立てかけてください
          </h1>
        </div>
      </div>
    );
  }

  // Playing phase UI (existing GamePlayScreen)
  return (
    <div
      className="relative w-screen h-screen overflow-y-auto font-sans text-white"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        pointerEvents: 'auto'
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
    >
      <img
        src={showTimerMessage ? "/images/background3.png" : "/images/background2.png"}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* GameOver表示 */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-bold text-red-500 mb-8 animate-pulse">
              GAME OVER
            </h1>
            <p className="text-2xl md:text-3xl text-white mb-4">
              点滅回数が3回に達しました
            </p>
            <div className="text-xl text-white/80">
              <p>自分: {myCharacterBlinkCount}回</p>
              <p>相手: {partnerCharacterBlinkCount}回</p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        
        <div className="absolute top-4 flex w-full justify-center items-start gap-4" style={{ zIndex: 50, opacity: 0, pointerEvents: 'none' }}>
          {/* RTMステータス表示 */}
          <div className="bg-black/70 p-3 rounded-lg max-w-xs">
            <p className="text-sm font-bold">🔧 ステータス</p>
            <div className="mt-1">
              <p className="text-xs text-blue-300">{rtmStatus}</p>
            </div>
            <div className="mt-1">
              <p className="text-xs">{isPressed ? '🔴 押下中' : '⚪ 待機中'}</p>
            </div>
            {/* 他のユーザーが押している時の表示 */}
            {otherUsersPressed.length > 0 && !isPressed && (
              <div className="mt-2 p-2 bg-orange-500/80 rounded">
                <p className="text-xs font-bold">
                  🔴 {pressingUserName || '他のユーザー'}が押しています！
                </p>
              </div>
            )}
          </div>


          {/* Round Button */}
          <button
            disabled={!isRtmConnected}
            className={`relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full transform transition-all duration-200 ease-in-out focus:outline-none ${
            !isRtmConnected
              ? 'bg-gradient-to-b from-gray-400 to-gray-500 opacity-50 cursor-not-allowed shadow-lg'
              : otherUsersPressed.length > 0 && isPressed
              ? 'bg-gradient-to-b from-red-400 to-red-600 scale-110 shadow-2xl shadow-red-500/30'
              : isPressed
              ? 'bg-gradient-to-b from-green-400 to-green-600 scale-110 shadow-2xl shadow-green-500/30'
              : otherUsersPressed.length > 0
              ? 'bg-gradient-to-b from-orange-400 to-orange-600 shadow-xl shadow-orange-500/20'
              : 'bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 hover:scale-105 shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40'
            } before:absolute before:inset-2 before:rounded-full before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 border-4 border-white/30`}
            onMouseDown={() => isRtmConnected && updateButtonStateRTM(true)}
            onMouseUp={() => isRtmConnected && updateButtonStateRTM(false)}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isRtmConnected) updateButtonStateRTM(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isRtmConnected) updateButtonStateRTM(false);
            }}
            onMouseLeave={() => { if (isPressed && isRtmConnected) updateButtonStateRTM(false); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            onSelectStart={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            style={{
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              touchAction: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitUserDrag: 'none',
              WebkitUserModify: 'read-only',
              WebkitAppearance: 'none',
              zIndex: 100
            }}
          >
            <span className="text-xs sm:text-sm font-bold">
              {!isRtmConnected
                ? 'RTM接続中...'
                : otherUsersPressed.length > 0 && isPressed
                ? '同時押し中！'
                : isPressed
                ? '押してる！'
                : otherUsersPressed.length > 0
                // ボタンのテキストも名前表示に対応
                ? `${pressingUserName || '他の人'}が押してる`
                : 'テストボタン'}
            </span>
          </button>
        </div>

        {/* 分離されたキャラクターセクション - 背景切り替え後に表示 */}
        {showTimerMessage && (
          <>
            {/* 敵キャラ専用セクション */}
            <EnemyCharacterSection
              countdown2Status={countdown2Status}
              countdown2Remaining={countdown2Remaining}
              bothUsersOK={bothUsersOK}
              myOKStatus={myOKStatus}
              partnerOKStatus={partnerOKStatus}
              isEnemyAnimating={isEnemyAnimating}
              isEnemy1Animating={isEnemy1Animating}
              onEnemyAnimationComplete={handleEnemyAnimationComplete}
              onEnemy1AnimationComplete={handleEnemy1AnimationComplete}
              onStartEnemyAnimation={handleStartEnemyAnimation}
            />

            {/* プレイヤーキャラ専用セクション */}
            <PlayerCharacterSection
              myCharacterNumber={myCharacterNumber}
              boyPosture={boyPosture}
              girlPosture={girlPosture}
              setBoyPosture={setBoyPosture}
              setGirlPosture={setGirlPosture}
              setBoyStandingButtonPressed={setBoyStandingButtonPressed}
              setBoySittingButtonPressed={setBoySittingButtonPressed}
              updateBoyPostureRTM={updateBoyPostureRTM}
              updateGirlPostureRTM={updateGirlPostureRTM}
              isMyCharacterBlinking={isMyCharacterBlinking}
              isPartnerCharacterBlinking={isPartnerCharacterBlinking}
              myActualCharacterPostureRef={myActualCharacterPostureRef}
            />

          </>
        )}

        {/* 7秒経過メッセージ - 背景切り替え時は非表示 */}

        {/* Guidance Text Above Camera - 背景切り替え後は非表示 */}
        {hasDetectedPose && !showTimerMessage && (
          <div className="mt-6 mb-4 flex justify-center">
            <div className="bg-black/90 px-8 py-5 rounded-xl border-2 border-white/40 shadow-lg">
              <p className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center tracking-wide leading-relaxed">
                {hasValidPose
                  ? "検出されました。そのまま動かないでください"
                  : "カメラを正面にみて、腰から頭までがカメラの中に入るようにしてください。"}
              </p>
            </div>
          </div>
        )}

        {/* Camera Display - 背景切り替え後は中央上部に配置 */}
        <div className={
          showTimerMessage
            ? 'absolute top-4 left-1/2 transform -translate-x-1/2'
            : `${hasDetectedPose ? 'mt-2' : 'mt-8'} flex justify-center`
        }>
          <div
            className="relative"
            style={{
              width: `${calculateResponsiveSize(videoDimensions.width, videoDimensions.height).width}px`,
              height: `${calculateResponsiveSize(videoDimensions.width, videoDimensions.height).height}px`
            }}
          >
            {cameraError ? (
              <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
                <p className="text-white text-sm">{cameraError}</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-lg border-2 border-white/30"
                  style={{ filter: 'blur(5px)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                />


                {/* Point Counter Display */}
                {hasDetectedPose && !showTimerMessage && (
                  <div className="absolute top-4 left-4 pointer-events-none">
                    <div className="bg-black/80 rounded-lg px-4 py-3 border-2 border-white/40 shadow-xl">
                      <div className="flex items-center space-x-2">
                        <span className="text-white text-lg font-bold">検出状態:</span>
                        <div className="flex items-center">
                          <span className={`text-2xl font-bold ${validPointsCount === 5 ? 'text-green-400' : validPointsCount >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {validPointsCount}
                          </span>
                          <span className="text-white text-xl font-bold">/5点</span>
                        </div>
                      </div>
                      <div className="mt-2 text-white/80 text-sm">
                        鼻・両肩・両腰
                      </div>

                    </div>
                  </div>
                )}

                {/* OK Display for background3 when 5 points detected */}
                {showTimerMessage && hasValidPose && (() => {
                  // OKが表示された時、初回のみデータベースを更新
                  if (!hasUpdatedOKcheck.current && userId) {
                    hasUpdatedOKcheck.current = true;


                    // MediaPipeで取得した腰・肩の4点の位置をカメラ内座標に変換してコンソール出力
                    if (currentPoseLandmarks && videoRef.current && canvasRef.current) {
                      const video = videoRef.current;
                      const canvas = canvasRef.current;

                      // カメラの実際の表示サイズを取得
                      const videoRect = video.getBoundingClientRect();
                      const canvasRect = canvas.getBoundingClientRect();

                      // MediaPipeの正規化座標（0-1）をカメラ内のピクセル座標に変換
                      const leftShoulder = currentPoseLandmarks[11]; // 左肩
                      const rightShoulder = currentPoseLandmarks[12]; // 右肩
                      const leftHip = currentPoseLandmarks[23]; // 左腰
                      const rightHip = currentPoseLandmarks[24]; // 右腰

                      if (leftShoulder && rightShoulder && leftHip && rightHip) {
                        // カメラ内のピクセル座標に変換
                        const leftShoulderX = leftShoulder.x * canvasRect.width;
                        const leftShoulderY = leftShoulder.y * canvasRect.height;
                        const rightShoulderX = rightShoulder.x * canvasRect.width;
                        const rightShoulderY = rightShoulder.y * canvasRect.height;
                        const leftHipX = leftHip.x * canvasRect.width;
                        const leftHipY = leftHip.y * canvasRect.height;
                        const rightHipX = rightHip.x * canvasRect.width;
                        const rightHipY = rightHip.y * canvasRect.height;

                        console.log('=== MediaPipe 腰・肩の4点のカメラ内座標 ===');
                        console.log(`左肩: x=${leftShoulderX.toFixed(2)}, y=${leftShoulderY.toFixed(2)}`);
                        console.log(`右肩: x=${rightShoulderX.toFixed(2)}, y=${rightShoulderY.toFixed(2)}`);
                        console.log(`左腰: x=${leftHipX.toFixed(2)}, y=${leftHipY.toFixed(2)}`);
                        console.log(`右腰: x=${rightHipX.toFixed(2)}, y=${rightHipY.toFixed(2)}`);

                        // 腰の2点の平均点を計算
                        const hipCenterX = (leftHipX + rightHipX) / 2;
                        const hipCenterY = (leftHipY + rightHipY) / 2;

                        // 肩の2点の平均点を計算
                        const shoulderCenterX = (leftShoulderX + rightShoulderX) / 2;
                        const shoulderCenterY = (leftShoulderY + rightShoulderY) / 2;

                        // 腰と肩の中心点間の距離ベクトル
                        const deltaX = shoulderCenterX - hipCenterX;
                        const deltaY = shoulderCenterY - hipCenterY;

                        // 4分割して肩に近い4分の1の点（腰から3/4の位置）
                        const quarterPointX = hipCenterX + (deltaX * 3 / 4);
                        const quarterPointY = hipCenterY + (deltaY * 3 / 4);

                        console.log('=== 計算結果 ===');
                        console.log(`腰の中心点: x=${hipCenterX.toFixed(2)}, y=${hipCenterY.toFixed(2)}`);
                        console.log(`肩の中心点: x=${shoulderCenterX.toFixed(2)}, y=${shoulderCenterY.toFixed(2)}`);
                        console.log(`肩に近い4分の1点: x=${quarterPointX.toFixed(2)}, y=${quarterPointY.toFixed(2)}`);
                        console.log('=== 閾値設定 ===');
                        console.log('================================================');
                                            // thresholdを5に変更
                    console.log('🔥 OK表示：thresholdを1から5に変更します');
                    thresholdRef.current = quarterPointY;
                    console.log('🔥 変更後のthreshold値:', thresholdRef.current);

                      }
                    }

                    // セッションIDを生成（マッチングしたユーザーとのセッション）
                    const currentUserId = userId;
                    const sessionPattern = `session-${currentUserId.substring(0, 8)}`;
                    console.log(`今から探す`);

                    // セッションを検索して更新
                    const sessionsRef = ref(database, 'sessions');
                    console.log(`セッション更新`);
                    get(sessionsRef).then((snapshot) => {
                      const sessions = snapshot.val();
                      console.log(`getの下`);
                      if (sessions) {
                        console.log(`sessions true`);
                        // 自分が参加しているセッションを見つける
                        Object.keys(sessions).forEach(sessionId => {
                          if (sessionId.includes(currentUserId.substring(0, 8))) {
                            console.log(`session発見: ${sessionId}`);
                            const participantRef = ref(database, `sessions/${sessionId}/participants/${currentUserId}/OKcheck`);
                            set(participantRef, true)
                              .then(() => console.log(`Updated OKcheck to true for user ${currentUserId}`))
                              .catch(console.error);
                          }
                        });
                      } else {
                        console.log(`sessions not found`);
                      }
                    }).catch((error) => {
                      console.error('セッション取得エラー:', error);
                    });
                  }

                  return (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
                      <div className="bg-green-500/0 rounded-full px-8 py-4 border-4 border-white/0 shadow-none">
                        <span className="text-white/0 text-4xl font-bold">OK</span>
                      </div>
                    </div>
                  );
                })()}

                {/* AI Recognition Loading Overlay */}
                {!hasDetectedPose && (
                  <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-white text-lg font-semibold">AI自動認識起動中</span>
                    </div>
                    <div className="text-white/70 text-sm text-center px-4">
                      骨格認識システムを準備しています...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>



        {/* Skip Buttons for Testing */}
        {/* Debug Controls - Commented out for production */}
        {/* <div className="absolute bottom-8 w-full flex justify-center gap-4">
          {!showTimerMessage && (
            <button
              onClick={skipToNextPhase}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-4 py-2 rounded text-sm shadow-md transform transition-all duration-200 hover:scale-105 opacity-70 hover:opacity-100"
            >
              ⏭️ 背景切り替え
            </button>
          )}
          <button
            onClick={start60SecondCountdown}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium px-4 py-2 rounded text-sm shadow-md transform transition-all duration-200 hover:scale-105 opacity-70 hover:opacity-100"
          >
            ⏰ 60秒開始
          </button>
          <button
            onClick={() => onGameClear && onGameClear()}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-medium px-4 py-2 rounded text-sm shadow-md transform transition-all duration-200 hover:scale-105 opacity-70 hover:opacity-100"
          >
            🔧 スキップ（動作検証用）
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default GamePlayScreen;