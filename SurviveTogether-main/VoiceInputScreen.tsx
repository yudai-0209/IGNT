
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CharacterModel from './CharacterModel';
import { getAgoraService, cleanupAgoraService } from './agoraService';
import { ref, set, update, onValue, off, serverTimestamp } from 'firebase/database';
import { database } from './firebase';

interface VoiceInputScreenProps {
  onTimeUp?: () => void;
  matchedUser?: {id: string, name: string} | null;
}

const VoiceInputScreen: React.FC<VoiceInputScreenProps> = ({ onTimeUp, matchedUser }) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const [isRecording, setIsRecording] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [countdownStatus, setCountdownStatus] = useState<'waiting' | 'active' | 'finished'>('waiting');
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  // キャラクター番号の状態
  const [myCharacterNumber, setMyCharacterNumber] = useState<1 | 2 | null>(null);
  const agoraService = useRef(getAgoraService());
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionRef = useRef<any>(null);

  // 画面表示時にスクロール位置を一番上に戻す
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleRelease = useCallback(() => {
    setIsRecording(false);
    agoraService.current.toggleMicrophone(false);

    // 音声レベル監視を停止
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
    setAudioLevel(0);

    console.log('Stop recording...');
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

  // セッション管理とカウントダウン同期
  useEffect(() => {
    if (!matchedUser) return;

    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) return;

    // セッションIDを生成
    const userIds = [currentUserId, matchedUser.id].sort();
    const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    sessionRef.current = ref(database, `sessions/${sessionId}`);

    // 自分の画面状態をvoiceInputに更新
    const updateMyStatus = () => {
      const myParticipantRef = ref(database, `sessions/${sessionId}/participants/${currentUserId}`);
      const userStatusRef = ref(database, `userStatus/${currentUserId}`);
      const savedNickname = localStorage.getItem(`nickname_${currentUserId}`) || `ゲスト${Math.floor(Math.random() * 100)}`;

      update(myParticipantRef, {
        screen: 'voiceInput',
        joinedAt: serverTimestamp(),
        ready: true,
        OKcheck: false
      }).then(() => {
        console.log('🎭 VoiceInput: 画面状態を更新（キャラ情報は保持）');
      }).catch(console.error);

      // userStatus更新
      set(userStatusRef, {
        userId: currentUserId,
        displayName: savedNickname,
        status: 'playing',
        currentScreen: 'voiceInput',
        lastUpdated: serverTimestamp(),
        partnerId: matchedUser?.id
      });
    };

    updateMyStatus();

    // セッション状態の監視
    const sessionListener = (snapshot: any) => {
      const sessionData = snapshot.val();
      if (!sessionData) return;

      const { participants, countdown } = sessionData;

      // キャラクター番号の取得
      if (participants?.[currentUserId]?.characterNumber) {
        const charNum = participants[currentUserId].characterNumber;
        if (myCharacterNumber !== charNum) {
          setMyCharacterNumber(charNum);
          console.log(`🎭 VoiceInput: 自分のキャラ番号=${charNum}`);

          if (charNum === 2) {
            console.log('🎭 VoiceInput: キャラ2のため配置を左右逆転させます');
          } else {
            console.log('🎭 VoiceInput: キャラ1のため通常配置です');
          }
        }
      }

      // 両方のユーザーがvoiceInput画面にいるかチェック
      const allReady = Object.values(participants || {}).every((p: any) =>
        p.screen === 'voiceInput' && p.ready
      );

      if (allReady && countdown.status === 'waiting') {
        // カウントダウン開始
        const countdownRef = ref(database, `sessions/${sessionId}/countdown`);
        set(countdownRef, {
          startTime: serverTimestamp(),
          duration: 30000,
          status: 'active'
        }).catch(console.error);
      }

      // カウントダウン状態の更新
      if (countdown.status === 'active' && countdown.startTime) {
        setCountdownStatus('active');

        // 同期カウントダウンタイマーを開始
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }

        countdownInterval.current = setInterval(() => {
          const now = Date.now() + serverTimeOffset;
          const elapsed = now - countdown.startTime;
          const remaining = Math.max(0, Math.ceil((countdown.duration - elapsed) / 1000));

          setTimeLeft(remaining);

          if (remaining <= 0) {
            setCountdownStatus('finished');
            if (countdownInterval.current) {
              clearInterval(countdownInterval.current);
              countdownInterval.current = null;
            }
            if (isRecording) handleRelease();
            if (onTimeUp) onTimeUp();
          }
        }, 100);
      }
    };

    onValue(sessionRef.current, sessionListener);

    return () => {
      if (sessionRef.current) {
        off(sessionRef.current, 'value', sessionListener);
      }
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    };
  }, [matchedUser, serverTimeOffset, isRecording, handleRelease, onTimeUp]);

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

  // マイクの初期化（カウントダウンがアクティブになったタイミングで実行）
  useEffect(() => {
    if (countdownStatus !== 'active') return;

    const initializeMicrophone = async () => {
      const success = await agoraService.current.initializeMicrophone();
      setMicrophoneReady(success);
      if (success) {
        console.log('Microphone initialized successfully');
      } else {
        console.error('Failed to initialize microphone');
      }
    };

    initializeMicrophone();

    return () => {
      cleanupAgoraService();
    };
  }, [countdownStatus]);

  // P2P通話の初期化
  useEffect(() => {
    if (!matchedUser || !microphoneReady) return;

    const initializeCall = async () => {
      try {
        // リモート音声ストリームの設定
        agoraService.current.onRemoteStream((stream) => {
          console.log('Setting up remote audio stream');
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(console.error);
          }
        });

        // 接続状態の監視
        agoraService.current.onConnectionStateChange((state) => {
          console.log('Connection state changed:', state);
          setConnectionStatus(state);
        });

        // P2P通話を開始
        await agoraService.current.initializeCall(matchedUser.id);

      } catch (error) {
        console.error('Failed to initialize call:', error);
        setConnectionStatus('error');
      }
    };

    initializeCall();
  }, [matchedUser, microphoneReady]);

  const handlePress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (countdownStatus === 'active' && timeLeft > 0 && microphoneReady && connectionStatus === 'connected') {
      setIsRecording(true);
      agoraService.current.toggleMicrophone(true);

      // 音声レベル監視を開始
      audioLevelInterval.current = setInterval(() => {
        const level = agoraService.current.getAudioLevel();
        setAudioLevel(level);
      }, 100); // 100msごとに更新

      console.log('Start recording...');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlePress(e);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleRelease();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handlePress(e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    handleRelease();
  };

  // 現在のユーザー名を取得
  const currentUserId = localStorage.getItem('currentUserId');
  const savedNickname = currentUserId ? localStorage.getItem(`nickname_${currentUserId}`) : null;
  const myName = savedNickname || 'あなた';

  // 常に上=自分、真ん中=相手で統一し、キャラ番号に基づいてモデルを決定
  const getCharacterLayout = () => {
    // キャラクター番号に基づいてモデルパスを動的決定
    const myModelPath = myCharacterNumber === 1 ? '/Models/RPGBoy1.glb' : '/Models/RPGGirl.glb';
    const partnerModelPath = myCharacterNumber === 1 ? '/Models/RPGGirl.glb' : '/Models/RPGBoy1.glb';

    const myCharacterData = {
      name: myName,
      model: myModelPath,
      isMe: true
    };

    const partnerCharacterData = {
      name: matchedUser ? matchedUser.name : '相手',
      model: partnerModelPath,
      isMe: false
    };

    // 常に上=自分、真ん中=相手に統一
    console.log(`🎭 VoiceInput: キャラ${myCharacterNumber} - 統一配置（Top: 自分, Middle: 相手）`);
    return {
      topCharacter: myCharacterData,      // 常に上に自分
      middleCharacter: partnerCharacterData  // 常に真ん中に相手
    };
  };

  const characterLayout = getCharacterLayout();


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
        src="/images/background2.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 flex flex-col items-center landscape:min-h-screen">
        {/* Top section: 意気込みをひと言！領域 */}
        <div className="w-full max-w-7xl bg-black/60 px-4 sm:px-8 md:px-20 py-4">
          {/* Top row */}
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 landscape:w-16 landscape:h-16">
              <React.Suspense fallback={<div>Loading...</div>}>
                <CharacterModel modelPath={characterLayout.topCharacter.model} />
              </React.Suspense>
            </div>
            <div className="flex flex-col items-center">
              <h1 className="text-3xl sm:text-4xl md:text-5xl landscape:text-2xl font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                意気込みをひと言！
              </h1>
              {/* デバッグ情報 */}
              {/* <div className="text-xs opacity-70 mt-1">
                キャラ{myCharacterNumber || 1} {myCharacterNumber === 2 ? '(配置逆転)' : '(通常配置)'} - Top: {characterLayout.topCharacter.name}
              </div> */}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex justify-center items-center gap-8 md:gap-12 landscape:gap-6">
            {matchedUser && (
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-300 mb-1">通話相手</p>
                <p className="text-xl font-bold">{matchedUser.name}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-400' :
                    connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                    connectionStatus === 'error' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`} />
                  <span className={`text-sm ${
                    connectionStatus === 'connected' ? 'text-green-400' :
                    connectionStatus === 'connecting' ? 'text-yellow-400' :
                    connectionStatus === 'error' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {connectionStatus === 'connected' ? '接続済み' :
                     connectionStatus === 'connecting' ? '接続中...' :
                     connectionStatus === 'error' ? '接続エラー' :
                     '未接続'}
                  </span>
                </div>
              </div>
            )}
            <div className="text-center">
              <p className="text-lg sm:text-xl landscape:text-base font-bold mb-1">
                {countdownStatus === 'waiting' ? '待機中' : '残り時間'}
              </p>
              <div className="bg-black w-20 h-20 sm:w-24 sm:h-24 landscape:w-16 landscape:h-16 flex items-center justify-center rounded-lg">
                <span className="text-4xl sm:text-5xl landscape:text-3xl font-bold">
                  {countdownStatus === 'waiting' ? '--' : timeLeft}
                </span>
              </div>
            </div>
          </div>

          {/* Skip Button inside main content area */}
          {/* {countdownStatus !== 'finished' && (
            <div className="flex justify-end mt-4">
              <button
                onClick={() => onTimeUp && onTimeUp()}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold px-4 py-2 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105 text-sm"
              >
                🔧 スキップ（動作検証用）
              </button>
            </div>
          )} */}
        </div>

        {/* Middle section: 3D Characters */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 landscape:w-20 landscape:h-20 z-20 pointer-events-none flex flex-col items-center">
          <React.Suspense fallback={<div>Loading...</div>}>
            <CharacterModel modelPath={characterLayout.middleCharacter.model} />
          </React.Suspense>
          {/* デバッグ情報 */}
          {/* <div className="text-xs opacity-70 mt-1">
            Middle: {characterLayout.middleCharacter.name}
          </div> */}
        </div>

        {/* Bottom section: Record Button and Audio Level */}
        <div className="flex flex-col items-center gap-4">

          {/* Circular Button */}
          <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            onSelectStart={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            disabled={countdownStatus !== 'active' || timeLeft <= 0 || !microphoneReady || connectionStatus !== 'connected'}
            className={`relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 landscape:w-40 landscape:h-40 rounded-full transform transition-all duration-200 ease-in-out focus:outline-none select-none ${
              countdownStatus !== 'active' || timeLeft <= 0 || !microphoneReady || connectionStatus !== 'connected'
                ? 'bg-gradient-to-b from-gray-400 to-gray-500 opacity-50 cursor-not-allowed shadow-lg'
                : isRecording
                ? 'bg-gradient-to-b from-green-600 to-green-800 scale-110 shadow-2xl shadow-green-600/30'
                : 'bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 hover:scale-105 shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40'
            } before:absolute before:inset-2 before:rounded-full before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 border-4 border-white/30`}
            style={{
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
              msUserSelect: 'none',
              MozUserSelect: 'none',
              WebkitUserDrag: 'none',
              WebkitUserModify: 'read-only',
              WebkitAppearance: 'none'
            }}
            aria-label="長押しで話す (Long press to talk)"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="text-2xl sm:text-3xl landscape:text-xl font-bold">
                {countdownStatus !== 'active' || timeLeft <= 0 || !microphoneReady || connectionStatus !== 'connected'
                  ? '準備中...'
                  : isRecording
                  ? '話し中'
                  : '長押しで話す'}
              </span>
              {countdownStatus === 'active' && timeLeft > 0 && microphoneReady && connectionStatus === 'connected' && (
                <img
                  src={isRecording ? '/images/is_published_true.png' : '/images/is_published_false.png'}
                  alt={isRecording ? 'Recording' : 'Ready to record'}
                  className="w-16 h-16 sm:w-20 sm:h-20 landscape:w-12 landscape:h-12 pointer-events-none select-none"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    msUserSelect: 'none',
                    MozUserSelect: 'none'
                  }}
                  draggable={false}
                />
              )}
            </div>
          </button>

          {/* Audio Level Bar */}
          <div className="flex flex-col items-center gap-2">
            <span className={`text-sm font-medium ${isRecording ? 'text-white' : 'text-gray-400'}`}>
              音声レベル
            </span>
            <div className="w-32 h-3 bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  isRecording ? 'bg-green-400' : 'bg-gray-400'
                }`}
                style={{
                  width: `${audioLevel}%`,
                  opacity: isRecording ? 1 : 0.3
                }}
              />
            </div>
            <span className={`text-xs ${isRecording ? 'text-white' : 'text-gray-500'}`}>
              {isRecording ? `${audioLevel}%` : '0%'}
            </span>
          </div>
        </div>


        {/* 音声再生用の隠しaudio要素 */}
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />
      </div>

    </div>
  );
};

export default VoiceInputScreen;