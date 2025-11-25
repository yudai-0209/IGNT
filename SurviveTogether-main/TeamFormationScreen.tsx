/// <reference types="@react-three/fiber" />
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from './firebase';
import TeamFormationCharacterModel from './TeamFormationCharacterModel';

interface TeamFormationScreenProps {
  onNavigateToVoiceInput: () => void;
  matchedUser?: { id: string; name: string } | null;
}

const TeamFormationScreen = ({ onNavigateToVoiceInput, matchedUser }: TeamFormationScreenProps) => {
  const currentUserId = localStorage.getItem('currentUserId');
  const savedNickname = currentUserId ? localStorage.getItem(`nickname_${currentUserId}`) : null;
  const myName = savedNickname || 'あなた';

  // キャラクター番号の状態
  const [myCharacterNumber, setMyCharacterNumber] = useState<1 | 2 | null>(null);

  // 画面表示時にスクロール位置を一番上に戻す
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // セッション情報からキャラクター番号を取得
  useEffect(() => {
    if (!currentUserId) return;

    const matchedUserId = localStorage.getItem('matchedUserId');
    if (!matchedUserId) return;

    // セッションIDを生成
    const userIds = [currentUserId, matchedUserId].sort();
    const sessionId = `session-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    console.log(`🎭 TeamFormation: セッション監視開始 ${sessionId}`);

    const sessionRef = ref(database, `sessions/${sessionId}`);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const sessionData = snapshot.val();
      if (sessionData?.participants?.[currentUserId]?.characterNumber) {
        const charNum = sessionData.participants[currentUserId].characterNumber;
        setMyCharacterNumber(charNum);
        console.log(`🎭 TeamFormation: 自分のキャラ番号=${charNum}`);

        if (charNum === 2) {
          console.log('🎭 TeamFormation: キャラ2のため配置を左右逆転させます');
        } else {
          console.log('🎭 TeamFormation: キャラ1のため通常配置です');
        }
      }
    });

    return () => off(sessionRef, 'value', unsubscribe);
  }, [currentUserId]);

  // 常に自分を左に表示し、キャラ番号に基づいてモデルを決定
  const getTeamMembers = () => {
    // キャラクター番号に基づいてモデルパスを決定
    const myModelPath = myCharacterNumber === 1 ? '/Models/RPGBoy1.glb' : '/Models/RPGGirl.glb';
    const partnerModelPath = myCharacterNumber === 1 ? '/Models/RPGGirl.glb' : '/Models/RPGBoy1.glb';

    const myMember = {
      name: myName,
      color: 'text-[#ff5c8a]',
      modelPath: myModelPath,
    };

    const partnerMember = {
      name: matchedUser ? matchedUser.name : '同僚Aさん',
      color: 'text-[#ff8c6e]',
      modelPath: partnerModelPath,
    };

    // 常に左が自分、右が相手になるよう配置
    return [myMember, partnerMember];
  };

  const teamMembers = getTeamMembers();

  const [loadedModels, setLoadedModels] = React.useState(new Set<number>());
  const [allModelsLoaded, setAllModelsLoaded] = React.useState(false);

  const handleModelLoad = (index: number) => {
    setLoadedModels(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  };

  useEffect(() => {
    if (loadedModels.size === teamMembers.length && !allModelsLoaded) {
      setAllModelsLoaded(true);
    }
  }, [loadedModels.size, teamMembers.length, allModelsLoaded]);

  // 画面表示から一定時間後に遷移（モデル読み込み状態に関係なく）
  useEffect(() => {
    const timer = setTimeout(() => {
      onNavigateToVoiceInput();
    }, 5000); // 5秒後に遷移

    return () => clearTimeout(timer);
  }, [onNavigateToVoiceInput]);

  // キャラ番号が確定するまでローディング表示
  if (myCharacterNumber === null) {
    return (
      <main className="relative min-h-screen w-full bg-cover bg-center text-white font-sans bg-[url('/images/background2.png')] overflow-y-auto">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center">
          <div className="bg-black/80 p-8 rounded-xl text-center">
            <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold mb-2">チーム結成準備中...</h1>
            <p className="text-lg">キャラクター配置を確認しています</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-cover bg-center text-white font-sans bg-[url('/images/background2.png')] overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 min-h-screen flex flex-col p-4 md:p-8 landscape:min-h-0 landscape:h-auto">
        <header className="text-center py-4 landscape:py-2">
          <div className="bg-black/60 inline-block px-8 py-4 landscape:px-4 landscape:py-2 rounded-xl">
            <h1 className="text-5xl md:text-7xl landscape:text-3xl font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]">
              チーム結成！
            </h1>
            {/* デバッグ情報 */}
            {/* <p className="text-sm mt-2 opacity-70">
              キャラ{myCharacterNumber} {myCharacterNumber === 2 ? '(配置逆転)' : '(通常配置)'}
            </p> */}
          </div>
        </header>

        <section className="flex-grow flex flex-col justify-start mt-8 landscape:justify-center">
          <div className="flex justify-around items-end h-[50vh] md:h-[60vh] landscape:h-[40vh]">
            {teamMembers.map((member, index) => (
              <div key={index} className="w-1/3 h-full">
                <React.Suspense fallback={<div className="text-center">Loading...</div>}>
                  <TeamFormationCharacterModel modelPath={member.modelPath} onLoad={() => handleModelLoad(index)} />
                </React.Suspense>
              </div>
            ))}
          </div>

          <div className="flex justify-around items-start text-center px-4 mt-4 landscape:mb-4">
            {teamMembers.map((member, index) => (
              <div key={index} className="w-1/3 flex flex-col items-center">
                <h2
                  className={`text-xl md:text-2xl landscape:text-lg font-bold ${member.color} drop-shadow-[0_2px_2px_rgba(0,0,0,1)]`}
                >
                  {member.name}
                </h2>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default TeamFormationScreen;