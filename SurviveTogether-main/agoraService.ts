import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  ConnectionState
} from 'agora-rtc-sdk-ng';

export class AgoraService {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private isMonitoringAudio: boolean = false;
  private audioLevel: number = 0;

  // コールバック
  private connectionStateCallback: ((state: string) => void) | null = null;
  private remoteStreamCallback: ((stream: MediaStream) => void) | null = null;

  // Agora設定
  private readonly APP_ID = 'd10a747d9b314d30a187631deb096b75';

  constructor() {
    console.log('Agora Service initialized');

    // Agoraクライアントを作成
    this.client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });

    this.setupClientEvents();
  }

  // クライアントイベントの設定
  private setupClientEvents(): void {
    if (!this.client) return;

    // 接続状態の監視
    this.client.on('connection-state-change', (curState: ConnectionState) => {
      console.log('Agora connection state:', curState);
      if (this.connectionStateCallback) {
        this.connectionStateCallback(curState);
      }
    });

    // リモートユーザー参加
    this.client.on('user-published', async (user, mediaType) => {
      if (mediaType === 'audio') {
        console.log('Remote user published audio:', user.uid);
        await this.client!.subscribe(user, mediaType);

        const remoteAudioTrack = user.audioTrack;
        if (remoteAudioTrack) {
          remoteAudioTrack.play();
          console.log('Remote audio track playing');

          // MediaStreamを作成してコールバックに渡す（互換性のため）
          if (this.remoteStreamCallback) {
            // 注意: Agoraは直接MediaStreamを提供しないため、
            // 実際のストリームではなく、リモート音声が再生されていることを通知
            this.remoteStreamCallback(new MediaStream());
          }
        }
      }
    });

    // リモートユーザー退出
    this.client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') {
        console.log('Remote user unpublished audio:', user.uid);
      }
    });
  }

  // マイクアクセスの初期化
  async initializeMicrophone(): Promise<boolean> {
    try {
      console.log('Requesting microphone access...');

      // マイクトラックを作成
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      console.log('Microphone access granted');

      // 初期状態ではマイクをミュート
      this.toggleMicrophone(false);

      // 音声レベル監視の設定
      this.setupAudioLevelMonitoring();

      return true;
    } catch (error) {
      console.error('Failed to get microphone access:', error);
      return false;
    }
  }

  // マイクのON/OFF制御
  toggleMicrophone(enabled: boolean): void {
    if (!this.localAudioTrack) {
      console.log('No local audio track available');
      return;
    }

    if (enabled) {
      this.localAudioTrack.setMuted(false);
    } else {
      this.localAudioTrack.setMuted(true);
    }

    console.log(`Microphone ${enabled ? 'enabled' : 'disabled'}`);
    this.isMonitoringAudio = enabled;
  }

  // 音声レベル監視の設定
  private setupAudioLevelMonitoring(): void {
    if (!this.localAudioTrack) return;

    // 音声レベルの監視を設定
    setInterval(() => {
      if (this.isMonitoringAudio && this.localAudioTrack) {
        this.audioLevel = this.localAudioTrack.getVolumeLevel() * 100;
      } else {
        this.audioLevel = 0;
      }
    }, 100);
  }

  // 現在の音声レベルを取得（0-100）
  getAudioLevel(): number {
    return Math.round(this.audioLevel);
  }

  // P2P通話を開始する
  async initializeCall(matchedUserId: string): Promise<void> {
    if (!this.client || !this.localAudioTrack) {
      throw new Error('Client or microphone not initialized');
    }

    try {
      // ペア専用チャンネル名を生成（決定的に）
      const channelName = this.generateChannelName(matchedUserId);

      console.log(`Joining Agora channel: ${channelName}`);
      console.log(`Matched with user: ${matchedUserId}`);

      if (this.connectionStateCallback) {
        this.connectionStateCallback('connecting');
      }

      // チャンネルに参加
      await this.client.join(this.APP_ID, channelName, null, null);

      console.log('Successfully joined channel');

      // ローカル音声トラックを公開
      await this.client.publish([this.localAudioTrack]);

      console.log('Local audio track published');

      if (this.connectionStateCallback) {
        this.connectionStateCallback('connected');
      }

    } catch (error) {
      console.error('Failed to join channel:', error);
      if (this.connectionStateCallback) {
        this.connectionStateCallback('error');
      }
      throw error;
    }
  }

  // チャンネル名を生成（2つのユーザーIDから決定的に）
  private generateChannelName(matchedUserId: string): string {
    // 現在のユーザーIDを取得（Firebaseから）
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId) {
      console.warn('Current user ID not available, using fallback channel');
      return 'survive-together-voice';
    }

    // 2つのユーザーIDをアルファベット順でソートして決定的なチャンネル名を生成
    const userIds = [currentUserId, matchedUserId].sort();
    const channelName = `voice-${userIds[0].substring(0, 8)}-${userIds[1].substring(0, 8)}`;

    console.log(`Generated channel name: ${channelName} for users: ${currentUserId} + ${matchedUserId}`);
    return channelName;
  }

  // 現在のユーザーIDを取得
  private getCurrentUserId(): string | null {
    // Firebaseの認証状態から現在のユーザーIDを取得
    try {
      // firebase.jsからauthをimportして使用する必要があるが、
      // 循環参照を避けるためにグローバル変数やコールバックで渡す方が良い
      return window.localStorage.getItem('currentUserId') || null;
    } catch (error) {
      console.error('Failed to get current user ID:', error);
      return null;
    }
  }

  // 接続状態変更のコールバックを設定
  onConnectionStateChange(callback: (state: string) => void): void {
    this.connectionStateCallback = callback;
  }

  // リモートストリームのコールバックを設定
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.remoteStreamCallback = callback;
  }

  // リソースのクリーンアップ
  cleanup(): void {
    console.log('Cleanup Agora service');

    this.isMonitoringAudio = false;

    // ローカル音声トラックをクリーンアップ
    if (this.localAudioTrack) {
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }

    // チャンネルから退出
    if (this.client) {
      this.client.leave().catch(console.error);
      this.client = null;
    }

    this.connectionStateCallback = null;
    this.remoteStreamCallback = null;
    this.audioLevel = 0;
  }
}

// シングルトンインスタンス
let agoraServiceInstance: AgoraService | null = null;

export const getAgoraService = (): AgoraService => {
  if (!agoraServiceInstance) {
    agoraServiceInstance = new AgoraService();
  }
  return agoraServiceInstance;
};

export const cleanupAgoraService = (): void => {
  if (agoraServiceInstance) {
    agoraServiceInstance.cleanup();
    agoraServiceInstance = null;
  }
};