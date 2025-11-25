import React, { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { ref, set, onValue, off, onDisconnect, serverTimestamp, runTransaction } from 'firebase/database';
import { auth, database } from './firebase';

interface MatchingScreenProps {
  onNavigateToTeamFormation: (matchedUserId?: string, matchedUserName?: string) => void;
}

const MatchingScreen = ({ onNavigateToTeamFormation }: MatchingScreenProps) => {
  const [dots, setDots] = useState('.');
  const [userId, setUserId] = useState<string | null>(null);
  const [matchingUsers, setMatchingUsers] = useState<any>({});
  const [onlineUsers, setOnlineUsers] = useState<any>({});
  const [userStatuses, setUserStatuses] = useState<any>({});
  const [matched, setMatched] = useState(false);

  // 画面表示時にスクロール位置を一番上に戻す
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ドットアニメーション (変更なし)
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length < 3 ? prev + '.' : '.'));
    }, 750);
    return () => clearInterval(interval);
  }, []);

  // Firebase認証 (変更なし)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        localStorage.setItem('currentUserId', user.uid);
        const savedNickname = localStorage.getItem(`nickname_${user.uid}`);
        registerForMatching(user.uid, savedNickname || 'ゲスト');
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  // マッチング状態登録 (変更なし)
  const registerForMatching = (uid: string, displayName: string) => {
    const matchingRef = ref(database, `matching/${uid}`);
    const presenceRef = ref(database, `presence/${uid}`);
    const userStatusRef = ref(database, `userStatus/${uid}`);

    set(matchingRef, {
      displayName,
      status: 'searching',
      timestamp: serverTimestamp(),
      searchingTimestamp: serverTimestamp()
    });

    set(presenceRef, {
      displayName,
      online: true,
      screen: 'matching',
      lastSeen: serverTimestamp()
    });

    // 新しいuserStatusの設定
    set(userStatusRef, {
      userId: uid,
      displayName,
      status: 'matching',
      currentScreen: 'matching',
      lastUpdated: serverTimestamp()
    });

    onDisconnect(matchingRef).remove();
    onDisconnect(presenceRef).set({
      displayName,
      online: false,
      screen: 'offline',
      lastSeen: serverTimestamp()
    });
    onDisconnect(userStatusRef).remove();
  };

  // セッション作成
  const createSession = (userId1: string, userId2: string) => {
    // 決定的なセッションIDを生成（2つのユーザーIDをソート）
    const userIds = [userId1, userId2].sort();
    const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    // キャラクター割り当て: ソート順で上が男、下が女
    const maleUserId = userIds[0];  // ソート順で先（上）
    const femaleUserId = userIds[1]; // ソート順で後（下）

    console.log(`🎭 キャラクター割り当て決定:`);
    console.log(`  キャラ1（男キャラ・Boy）: ${maleUserId.substring(0, 8)}...`);
    console.log(`  キャラ2（女キャラ・Girl）: ${femaleUserId.substring(0, 8)}...`);

    const sessionRef = ref(database, `sessions/${sessionId}`);
    set(sessionRef, {
      participants: {
        [userId1]: {
          screen: 'teamFormation',
          joinedAt: serverTimestamp(),
          ready: false,
          OKcheck: false,
          characterType: userId1 === maleUserId ? 'male' : 'female',
          characterNumber: userId1 === maleUserId ? 1 : 2
        },
        [userId2]: {
          screen: 'teamFormation',
          joinedAt: serverTimestamp(),
          ready: false,
          OKcheck: false,
          characterType: userId2 === maleUserId ? 'male' : 'female',
          characterNumber: userId2 === maleUserId ? 1 : 2
        }
      },
      characterAssignment: {
        male: maleUserId,
        female: femaleUserId,
        character1: maleUserId,  // キャラ1は男
        character2: femaleUserId // キャラ2は女
      },
      countdown: {
        startTime: null,
        duration: 30000,
        status: 'waiting'
      },
      createdAt: serverTimestamp()
    }).catch(console.error);

    console.log(`Created session: ${sessionId}`);
  };

  // マッチングユーザー監視
  useEffect(() => {
    if (!userId || matched) return;

    const matchingRef = ref(database, 'matching');

    // ★★★ 修正点：リスナー関数をあらかじめ定義する ★★★
    const listener = (snapshot: any) => {
      if (matched) return; 
      
      const data = snapshot.val();
      setMatchingUsers(data || {});

      if (data) {
        const myData = data[userId];
        if (!myData) return;

        if (myData.status === 'matched' && myData.partnerId) {
          // リスナーをここで安全に停止させる
          off(matchingRef, 'value', listener);

          setMatched(true);
          const partnerData = data[myData.partnerId];
          const partnerName = partnerData ? partnerData.displayName : '相手';

          // セッション作成
          createSession(userId, myData.partnerId);

          // マッチした相手のIDをLocalStorageに保存
          localStorage.setItem('matchedUserId', myData.partnerId);

          setTimeout(() => {
            onNavigateToTeamFormation(myData.partnerId, partnerName);
          }, 3000);
          return;
        }
        
        if (myData.status === 'searching') {
          const searchingUsers = Object.entries(data)
            .filter(([id, user]: [string, any]) => user.status === 'searching' && user.searchingTimestamp)
            .sort(([idA, userA]: [string, any], [idB, userB]: [string, any]) => {
              const timeA = userA.searchingTimestamp;
              const timeB = userB.searchingTimestamp;
              if (timeA !== timeB) return timeA - timeB;
              return idA.localeCompare(idB);
            });

          const myIndex = searchingUsers.findIndex(([id]) => id === userId);
          if (myIndex === -1) return;

          if (myIndex % 2 === 0 && searchingUsers[myIndex + 1]) {
            const [partnerId, partnerData] = searchingUsers[myIndex + 1];

            runTransaction(matchingRef, (currentData) => {
              if (currentData === null) return;
              
              const latestMyData = currentData[userId];
              const latestPartnerData = currentData[partnerId];

              if (!latestMyData || latestMyData.status !== 'searching' || !latestPartnerData || latestPartnerData.status !== 'searching') {
                return; 
              }
              
              const timestamp = serverTimestamp();
              currentData[userId].status = 'matched';
              currentData[userId].partnerId = partnerId;
              currentData[userId].matchedTimestamp = timestamp;

              currentData[partnerId].status = 'matched';
              currentData[partnerId].partnerId = userId;
              currentData[partnerId].matchedTimestamp = timestamp;

              return currentData;
            })
            .catch((error) => console.error('Transaction failed: ', error));
          }
        }
      }
    };

    // 定義したリスナーをセットする
    onValue(matchingRef, listener);

    // クリーンアップ時も定義したリスナーを停止する
    return () => off(matchingRef, 'value', listener);
  }, [userId, matched, onNavigateToTeamFormation]);

  // オンラインユーザー監視
  useEffect(() => {
    if (!userId) return;
    const presenceRef = ref(database, 'presence');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const online = Object.fromEntries(
          Object.entries(data).filter(([_, user]: [string, any]) => user.online)
        );
        setOnlineUsers(online);
      }
    });
    return () => off(presenceRef, 'value', unsubscribe);
  }, [userId]);

  // userStatus監視
  useEffect(() => {
    if (!userId) return;
    const userStatusRef = ref(database, 'userStatus');
    const unsubscribe = onValue(userStatusRef, (snapshot) => {
      const data = snapshot.val();
      setUserStatuses(data || {});
    });
    return () => off(userStatusRef, 'value', unsubscribe);
  }, [userId]);

  // JSX (変更なし)
  return (
      <main className="relative min-h-screen bg-cover bg-center text-white font-sans bg-[url('/images/background2.png')] overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 p-4 sm:p-8 md:p-12 min-h-screen flex flex-col landscape:min-h-0 landscape:h-auto">
        <div className="absolute top-4 right-4 bg-black/80 p-4 rounded-lg max-w-xs text-xs">
          <p className="font-bold text-green-400">🔧 ステータス</p>
          <div className="mt-2">
            <p className="text-yellow-300">ID: {userId?.substring(0, 8) || '未取得'}...</p>
          </div>
          <div className="mt-2">
            <p className="font-bold">オンラインユーザー:</p>
            <div className="max-h-40 overflow-y-auto text-xs">
              {Object.keys(userStatuses).length === 0 ? (
                <p className="text-gray-300">他のユーザーなし</p>
              ) : (
                <>
                  {/* 準備中のユーザー */}
                  {Object.entries(userStatuses).filter(([_, data]: [string, any]) => data.status === 'preparing').length > 0 && (
                    <div className="mb-2">
                      <p className="text-blue-300 font-bold text-xs mb-1">準備中:</p>
                      {Object.entries(userStatuses)
                        .filter(([_, data]: [string, any]) => data.status === 'preparing')
                        .map(([id, data]: [string, any]) => (
                          <div key={id} className="ml-2 text-blue-200 text-xs">
                            • {data.displayName}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* マッチング中のユーザー */}
                  {Object.entries(userStatuses).filter(([_, data]: [string, any]) => data.status === 'matching').length > 0 && (
                    <div className="mb-2">
                      <p className="text-yellow-300 font-bold text-xs mb-1">マッチング中:</p>
                      {Object.entries(userStatuses)
                        .filter(([_, data]: [string, any]) => data.status === 'matching')
                        .map(([id, data]: [string, any]) => (
                          <div key={id} className="ml-2 text-yellow-200 text-xs">
                            • {data.displayName}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* ゲーム中のユーザー */}
                  {Object.entries(userStatuses).filter(([_, data]: [string, any]) => data.status === 'playing').length > 0 && (
                    <div className="mb-2">
                      <p className="text-purple-300 font-bold text-xs mb-1">ゲーム中:</p>
                      {Object.entries(userStatuses)
                        .filter(([_, data]: [string, any]) => data.status === 'playing')
                        .map(([id, data]: [string, any]) => (
                          <div key={id} className="ml-2 text-purple-200 text-xs">
                            • {data.displayName}
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex-grow flex flex-col pt-24">
          <div className="text-left mb-8 flex flex-col items-start pl-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl landscape:text-3xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-8">
              {matched ? 'マッチ成立!!' : 'マッチ中'}<span className="inline-block w-12 text-left">{matched ? '' : dots}</span>
            </h1>
            {matched && (
              <p className="text-xl mb-8 text-yellow-300 text-left">チーム画面に移動中...</p>
            )}

            {/* Skip Button for Testing */}
            {/* {!matched && (
              <div className="mb-8 text-left">
                <button
                  onClick={() => onNavigateToTeamFormation('test-user-id', 'テストユーザー')}
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-medium px-4 py-2 rounded text-sm shadow-md transform transition-all duration-200 hover:scale-105 opacity-70 hover:opacity-100"
                >
                  🔧 スキップ（動作検証用）
                </button>
              </div>
            )} */}

            {/* Squat Section */}
            <div className="flex items-center justify-center gap-4 md:gap-8 landscape:gap-2">
              <div className="bg-white p-2 landscape:p-1 rounded-2xl shadow-lg flex-shrink-0">
                <video src="/Video/squat.mp4" autoPlay muted loop className="w-48 sm:w-64 md:w-80 landscape:w-32 h-auto rounded-xl" />
              </div>
              <div className="bg-[#c8f5c8] text-black p-4 sm:p-6 landscape:p-2 rounded-2xl shadow-lg flex-grow max-w-3xl">
                <div className="flex flex-col sm:flex-row landscape:flex-row items-start sm:items-center gap-4 sm:gap-6 landscape:gap-2">
                  <h2 className="text-4xl sm:text-5xl landscape:text-2xl font-bold whitespace-nowrap">スクワット</h2>
                  <p className="text-sm sm:text-base md:text-lg landscape:text-xs">
                    下半身の筋力強化と体幹の安定性向上による
                    <br />
                    基礎代謝アップ、ヒップアップ効果
                    <br />
                    太ももとお尻の引き締め、膝関節の強化による
                    <br />
                    日常動作の改善が期待できる
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default MatchingScreen;