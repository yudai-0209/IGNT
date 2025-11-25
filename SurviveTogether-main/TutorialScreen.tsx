
import React, { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { ref, set, onValue, off, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, database } from './firebase';
import ActionButton from './ActionButton';

interface TutorialScreenProps {
  onNavigateToCooperation: () => void;
}

const TutorialScreen = ({ onNavigateToCooperation }: TutorialScreenProps) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [isNicknameSet, setIsNicknameSet] = useState(false);
  const [dbStatus, setDbStatus] = useState<string>('接続中...');
  const [allUsers, setAllUsers] = useState<any>({});
  const [onlineUsers, setOnlineUsers] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Firebase認証とニックネーム設定
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setLoading(false);

        // localStorage からニックネームを取得
        const savedNickname = localStorage.getItem(`nickname_${user.uid}`);
        if (savedNickname) {
          setNickname(savedNickname);
          setIsNicknameSet(true);
          updateUserData(user.uid, savedNickname, false);
        }
      } else {
        signInAnonymously(auth)
          .then(() => {
            console.log('匿名ログイン成功');
          })
          .catch((error) => {
            console.error('匿名ログインエラー:', error);
            setLoading(false);
          });
      }
    });

    return () => unsubscribe();
  }, []);

  // 全ユーザーの監視
  useEffect(() => {
    if (!userId) return;

    const usersRef = ref(database, 'buttonStates');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setAllUsers(data || {});
    });

    return () => off(usersRef, 'value', unsubscribe);
  }, [userId]);

  // オンラインユーザーの監視
  useEffect(() => {
    if (!userId) return;

    const presenceRef = ref(database, 'presence');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // オンラインユーザーのみフィルタリング
        const online = Object.fromEntries(
          Object.entries(data).filter(([_, user]: [string, any]) => user.online)
        );
        setOnlineUsers(online);
        setDbStatus(`接続中: ${Object.keys(online).length}人オンライン`);
      } else {
        setOnlineUsers({});
        setDbStatus('接続中: 他のユーザーなし');
      }
    }, (error) => {
      setDbStatus(`接続エラー: ${error.message}`);
      console.error('Presence listen error:', error);
    });

    return () => off(presenceRef, 'value', unsubscribe);
  }, [userId]);

  // ユーザーデータ更新（オンライン状態含む）
  const updateUserData = (uid: string, displayName: string, pressed: boolean) => {
    const userRef = ref(database, `buttonStates/${uid}`);
    const presenceRef = ref(database, `presence/${uid}`);
    const userStatusRef = ref(database, `userStatus/${uid}`);

    // ユーザー状態更新
    set(userRef, {
      displayName,
      pressed,
      timestamp: Date.now()
    }).then(() => {
      setDbStatus(`更新成功: ${displayName}`);
    }).catch((error) => {
      setDbStatus(`更新失敗: ${error.message}`);
    });

    // オンライン状態設定
    set(presenceRef, {
      displayName,
      online: true,
      lastSeen: serverTimestamp()
    });

    // 切断時にオフライン状態に設定
    onDisconnect(presenceRef).set({
      displayName,
      online: false,
      lastSeen: serverTimestamp()
    });
  };

  // ニックネーム設定
  const handleNicknameSubmit = () => {
    if (nickname.trim() && userId) {
      localStorage.setItem(`nickname_${userId}`, nickname.trim());
      setIsNicknameSet(true);
      updateUserData(userId, nickname.trim(), false);
    }
  };

  return (
    <main className="relative min-h-screen bg-cover bg-center text-white font-sans bg-[url('/images/background2.png')] overflow-hidden">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 p-4 sm:p-8 md:p-12 min-h-screen flex flex-col landscape:min-h-0 landscape:h-auto">
        <header className="flex-shrink-0 flex justify-center landscape:pt-2">
        </header>

        <section className="flex-grow flex flex-col items-center justify-start text-center px-4 landscape:flex-shrink pt-8 sm:pt-12 md:pt-16 landscape:pt-4">
          {!isNicknameSet && !loading ? (
            // ニックネーム入力画面
            <div className="bg-black/70 p-8 rounded-xl shadow-lg max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6 text-yellow-300">プレイヤー名を入力してください</h2>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="プレイヤー名"
                className="w-full p-3 text-lg text-black rounded-lg mb-4"
                maxLength={10}
                onKeyPress={(e) => e.key === 'Enter' && handleNicknameSubmit()}
              />
              <button
                onClick={handleNicknameSubmit}
                disabled={!nickname.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                決定
              </button>
              <p className="text-sm text-gray-300 mt-2">
                このデバイスに保存され、次回からは自動で使用されます
              </p>
            </div>
          ) : loading ? (
            // ローディング画面
            <div className="bg-black/50 p-8 rounded-xl shadow-lg">
              <p className="text-xl text-yellow-300">接続中...</p>
            </div>
          ) : (
            // チュートリアル説明画面
            <div className="bg-black/50 p-6 sm:p-8 landscape:p-4 rounded-xl shadow-lg max-w-4xl mx-auto text-center">
              <div className="mb-4">
                <p className="text-lg font-bold text-yellow-300">
                  ようこそ、{nickname}さん！
                </p>
              </div>

              {/* Logo and Title Section */}
              <div className="mb-6 flex items-center justify-center gap-2">
                <img src="/images/title.png" alt="Survive Together" className="w-32 sm:w-40 md:w-48 landscape:w-24 h-auto" />
                <h2 className="text-2xl sm:text-3xl md:text-4xl landscape:text-xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                  とは...
                </h2>
              </div>

              <p className="text-xl sm:text-2xl md:text-4xl landscape:text-lg font-bold leading-relaxed sm:leading-relaxed md:leading-relaxed landscape:leading-normal drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-6">
                チームメンバーがそれぞれのタイミングで異なる筋トレをすることで、ゾンビから逃げ切るゲーム
              </p>

              {/* Next Button inside explanation area */}
              <div className="flex justify-end">
                <ActionButton
                  text="次へ"
                  variant="neutral"
                  onClick={onNavigateToCooperation}
                />
              </div>
            </div>
          )}
        </section>

        <footer className="flex-shrink-0 flex justify-end pb-4 landscape:pb-2 pr-0 sm:pr-4 md:pr-8">
        </footer>
      </div>
    </main>
  );
};

export default TutorialScreen;
