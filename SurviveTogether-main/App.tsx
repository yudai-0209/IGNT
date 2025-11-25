
import React, { useState } from 'react';
import StartScreen from './StartScreen';
import TutorialScreen from './TutorialScreen';
import CooperationScreen from './CooperationScreen';
import MatchingScreen from './MatchingScreen';
import TeamFormationScreen from './TeamFormationScreen';
import VoiceInputScreen from './VoiceInputScreen';
import GameStartScreen from './GameStartScreen';
import GamePlayScreen from './GamePlayScreen';
import GameClearScreen from './GameClearScreen';

type Screen = 'start' | 'tutorial' | 'cooperation' | 'matching' | 'teamFormation' | 'voiceInput' | 'gameStart' | 'test' | 'gameClear';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [matchedUser, setMatchedUser] = useState<{id: string, name: string} | null>(null);

  const navigateToTutorial = () => {
    setCurrentScreen('tutorial');
  };

  const navigateToCooperation = () => {
    setCurrentScreen('cooperation');
  };

  const navigateToMatching = () => {
    setCurrentScreen('matching');
  };

  const navigateToTeamFormation = (matchedUserId?: string, matchedUserName?: string) => {
    if (matchedUserId && matchedUserName) {
      setMatchedUser({id: matchedUserId, name: matchedUserName});
    }
    setCurrentScreen('teamFormation');
  };

  const navigateToVoiceInput = () => {
    setCurrentScreen('voiceInput');
  };

  const navigateToGameStart = () => {
    setCurrentScreen('gameStart');
  };

  const navigateToTest = () => {
    setCurrentScreen('test');
  };

  const navigateToGameClear = () => {
    setCurrentScreen('gameClear');
  };

  const navigateToGamePlayDirect = () => {
    setCurrentScreen('gameClear');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'start':
        return <StartScreen onNavigateToTutorial={navigateToTutorial} onNavigateToGamePlay={navigateToGamePlayDirect} />;
      case 'tutorial':
        return <TutorialScreen onNavigateToCooperation={navigateToCooperation} />;
      case 'cooperation':
        return <CooperationScreen onNavigateToMatching={navigateToMatching} />;
      case 'matching':
        return <MatchingScreen onNavigateToTeamFormation={navigateToTeamFormation} />;
      case 'teamFormation':
        return <TeamFormationScreen onNavigateToVoiceInput={navigateToVoiceInput} matchedUser={matchedUser} />;
      case 'voiceInput':
        return <VoiceInputScreen onTimeUp={navigateToGameStart} matchedUser={matchedUser} />;
      case 'gameStart':
        return <GameStartScreen onStartGame={navigateToTest} matchedUser={matchedUser} />;
      case 'test':
        return <GamePlayScreen onGameClear={navigateToGameClear} />;
      case 'gameClear':
        return <GameClearScreen matchedUser={matchedUser} />;
      default:
        return <StartScreen onNavigateToTutorial={navigateToTutorial} />;
    }
  };

  return (
    <>
      {renderScreen()}
    </>
  );
};


export default App;
