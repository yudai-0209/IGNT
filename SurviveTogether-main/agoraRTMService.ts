import * as AgoraRTM from 'agora-rtm-sdk';

export interface ButtonState {
  userId: string;
  displayName: string;
  pressed: boolean;
  timestamp: number;
}

export interface GirlPostureState {
  userId: string;
  displayName: string;
  posture: 'standing' | 'sitting';
  timestamp: number;
}

export interface BoyPostureState {
  userId: string;
  displayName: string;
  posture: 'standing' | 'sitting';
  standingButtonPressed: boolean;
  sittingButtonPressed: boolean;
  timestamp: number;
}

export class AgoraRTMService {
  private client: any = null;
  private isLoggedIn: boolean = false;
  private currentUserId: string | null = null;
  private currentChannelName: string | null = null;

  // コールバック
  private buttonStateCallback: ((states: Record<string, ButtonState>) => void) | null = null;
  private girlPostureCallback: ((states: Record<string, GirlPostureState>) => void) | null = null;
  private boyPostureCallback: ((states: Record<string, BoyPostureState>) => void) | null = null;

  // Agora設定
  private readonly APP_ID = 'd10a747d9b314d30a187631deb096b75';

  constructor() {
    console.log('Agora RTM Service initialized');
    // 非同期初期化は initialize() で行う
  }

  // RTMクライアントの初期化
  private async initializeClient(): Promise<void> {
    try {
      // 現在のユーザーIDを取得
      this.currentUserId = this.getCurrentUserId();
      if (!this.currentUserId) {
        throw new Error('ユーザーIDが取得できません');
      }

    const { RTM } = AgoraRTM;
    this.client = new RTM(this.APP_ID, this.currentUserId);
      // イベントリスナーの設定
      this.setupEventListeners();

      console.log('Agora RTM client created with user ID:', this.currentUserId);
    } catch (error) {
      console.error('Failed to create RTM client:', error);
      throw error;
    }
  }

  // ログインしてチャンネルに参加
async initialize(pairedUserId?: string): Promise<boolean> {
  try {
    console.log('RTM初期化開始...');
    
    // RTMクライアントを初期化
    await this.initializeClient();

    if (!this.client || !this.currentUserId) {
      console.error('RTM client or user ID not available');
      return false;
    }

    console.log('RTMログイン試行中...');
    
    // ログイン (tokenが必要な場合は { token: 'YOUR_TOKEN' } を渡す)
    await this.client.login(); // uidは不要

    this.isLoggedIn = true;
    console.log('RTM login successful:', this.currentUserId);

    // チャンネルに参加
    const channelName = this.generateChannelName(pairedUserId);
    console.log('チャンネル参加試行中:', channelName);
    
    // 安定化のためにsubscribeの前に少し待機時間を入れる
    await new Promise(resolve => setTimeout(resolve, 100));

    await this.client.subscribe(channelName);
    this.currentChannelName = channelName;
    console.log(`RTM channel subscribed: ${channelName}`);
    
    console.log('RTM初期化完了！');
    return true;
  } catch (error) {
    console.error('Failed to initialize RTM:', error);
    return false;
  }
}
//memo

  // チャンネルに参加
  private async subscribeToChannel(channelName: string): Promise<void> {
    if (!this.client) throw new Error('RTM client not initialized');

    try {
      await this.client.subscribe(channelName);
      this.currentChannelName = channelName;

      console.log(`RTM channel subscribed: ${channelName}`);
    } catch (error) {
      console.error('Failed to subscribe to RTM channel:', error);
      throw error;
    }
  }

  // イベントリスナーの設定
private setupEventListeners(): void {
  if (!this.client) return;

  // メッセージ受信イベント
  this.client.addEventListener("message", (event: any) => {
    // eventオブジェクトに全ての情報が入っている
    // event.message: メッセージ本文
    // event.publisher: 送信者のID
    console.log(`Message received from ${event.publisher}:`, event.message);
    this.handleIncomingMessage(event.message);
  });

  // 接続状態変更イベント
  this.client.addEventListener("status", (event: any) => {
    console.log(`RTM connection state changed:`, event);
  });

  // プレゼンスイベント（メンバーの入退室）
  this.client.addEventListener("presence", (event: any) => {
    console.log('RTM presence event:', event);
  });
}

  // チャンネル名を生成（ペア専用）
  private generateChannelName(pairedUserId?: string): string {
    if (!pairedUserId) {
      // ペアがない場合は全体用チャンネル
      return 'global';
    }

    if (!this.currentUserId) {
      return 'fallback';
    }

    // ペアのFirebaseのUIDもAgora互換形式に変換
    const convertedPairedUserId = this.convertToAgoraUID(pairedUserId);

    // 2つの変換されたユーザーIDをソートして決定的なチャンネル名を生成
    const userIds = [this.currentUserId, convertedPairedUserId].sort();
    const channelName = `sync-${userIds[0]}-${userIds[1]}`;

    console.log(`Generated RTM channel: ${channelName} for users: ${this.currentUserId} + ${convertedPairedUserId}`);
    return channelName;
  }

  // 現在のユーザーIDを取得してAgora互換形式に変換
  private getCurrentUserId(): string | null {
    try {
      const firebaseUID = window.localStorage.getItem('currentUserId');
      if (!firebaseUID) {
        return null;
      }

      // セッションごとに固定のシンプルIDを生成・保存
      const sessionKey = `agoraUID_${firebaseUID}`;
      let agoraUID = window.localStorage.getItem(sessionKey);

      if (!agoraUID) {
        agoraUID = this.generateSimpleUID();
        window.localStorage.setItem(sessionKey, agoraUID);
        console.log(`Generated new Agora UID: ${agoraUID} for Firebase UID: ${firebaseUID}`);
      } else {
        console.log(`Using existing Agora UID: ${agoraUID} for Firebase UID: ${firebaseUID}`);
      }

      return agoraUID;
    } catch (error) {
      console.error('Failed to get current user ID:', error);
      return null;
    }
  }

  // UID生成（英数字のみ、短い形式）
  private generateSimpleUID(): string {
    // タイムスタンプ + ランダム英数字で短いIDを生成
    const timestamp = Date.now().toString().slice(-6); // 6桁
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 4; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const simpleUID = `u${timestamp}${randomStr}`; // 11文字、uプレフィックス
    console.log(`Generated simple UID: ${simpleUID}`);

    return simpleUID;
  }

  // FirebaseのUIDをAgora RTM互換の数値IDに変換（ペア用）
  private convertToAgoraUID(firebaseUID: string): string {
    // ハッシュ関数でFirebase UIDを数値に変換
    let hash = 0;
    for (let i = 0; i < firebaseUID.length; i++) {
      const char = firebaseUID.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }

    // 負の数を正の数に変換し、9桁以下に制限
    const positiveHash = Math.abs(hash) % 999999999;

    // 最低6桁は保証
    const agoraUID = positiveHash.toString().padStart(6, '1');

    return agoraUID;
  }

  // ボタン状態を送信
  async sendButtonState(pressed: boolean): Promise<void> {
    if (!this.client || !this.currentUserId || !this.currentChannelName) {
      console.error('RTM client, channel, or user ID not available');
      return;
    }

    try {
      // 元のFirebase UIDを取得してニックネームを取得
      const firebaseUID = localStorage.getItem('currentUserId');
      const savedNickname = firebaseUID ? localStorage.getItem(`nickname_${firebaseUID}`) : null;

      const buttonState: ButtonState = {
        userId: this.currentUserId,
        displayName: savedNickname || 'ゲスト',
        pressed,
        timestamp: Date.now()
      };

      const message = JSON.stringify({
        type: 'button',
        data: buttonState
      });

      // メッセージ送信
      await this.client.publish(this.currentChannelName, message);

      console.log('Button state sent via RTM:', buttonState);
    } catch (error) {
      console.error('Failed to send button state:', error);
    }
  }

  // Girl姿勢状態を送信
  async sendGirlPostureState(posture: 'standing' | 'sitting'): Promise<void> {
    if (!this.client || !this.currentUserId || !this.currentChannelName) {
      console.error('RTM client, channel, or user ID not available');
      return;
    }

    try {
      // 元のFirebase UIDを取得してニックネームを取得
      const firebaseUID = localStorage.getItem('currentUserId');
      const savedNickname = firebaseUID ? localStorage.getItem(`nickname_${firebaseUID}`) : null;

      const girlPostureState: GirlPostureState = {
        userId: this.currentUserId,
        displayName: savedNickname || 'ゲスト',
        posture,
        timestamp: Date.now()
      };

      const message = JSON.stringify({
        type: 'girlPosture',
        data: girlPostureState
      });

      // メッセージ送信
      await this.client.publish(this.currentChannelName, message);

      console.log('Girl posture state sent via RTM:', girlPostureState);
    } catch (error) {
      console.error('Failed to send girl posture state:', error);
    }
  }

  // Boy姿勢状態を送信
  async sendBoyPostureState(posture: 'standing' | 'sitting', standingButtonPressed: boolean, sittingButtonPressed: boolean): Promise<void> {
    if (!this.client || !this.currentUserId || !this.currentChannelName) {
      console.error('RTM client, channel, or user ID not available');
      return;
    }

    try {
      // 元のFirebase UIDを取得してニックネームを取得
      const firebaseUID = localStorage.getItem('currentUserId');
      const savedNickname = firebaseUID ? localStorage.getItem(`nickname_${firebaseUID}`) : null;

      const boyPostureState: BoyPostureState = {
        userId: this.currentUserId,
        displayName: savedNickname || 'ゲスト',
        posture,
        standingButtonPressed,
        sittingButtonPressed,
        timestamp: Date.now()
      };

      const message = JSON.stringify({
        type: 'boyPosture',
        data: boyPostureState
      });

      // メッセージ送信
      await this.client.publish(this.currentChannelName, message);

      console.log('Boy posture state sent via RTM:', boyPostureState);
    } catch (error) {
      console.error('Failed to send boy posture state:', error);
    }
  }

  // 受信メッセージを処理
  private handleIncomingMessage(messageText: string): void {
    try {
      const messageData = JSON.parse(messageText);

      // タイプ付きメッセージかチェック
      if (messageData.type && messageData.data) {
        // Girl姿勢メッセージの処理
        if (messageData.type === 'girlPosture' && this.isValidGirlPostureState(messageData.data)) {
          console.log('Received girl posture state via RTM:', messageData.data);

          // 自分以外のメッセージのみ処理
          if (messageData.data.userId !== this.currentUserId) {
            if (this.girlPostureCallback) {
              const states = { [messageData.data.userId]: messageData.data };
              this.girlPostureCallback(states);
            }
          }
        }
        // Boy姿勢メッセージの処理
        else if (messageData.type === 'boyPosture' && this.isValidBoyPostureState(messageData.data)) {
          console.log('Received boy posture state via RTM:', messageData.data);

          // 自分以外のメッセージのみ処理
          if (messageData.data.userId !== this.currentUserId) {
            if (this.boyPostureCallback) {
              const states = { [messageData.data.userId]: messageData.data };
              this.boyPostureCallback(states);
            }
          }
        }
        // ボタンメッセージの処理
        else if (messageData.type === 'button' && this.isValidButtonState(messageData.data)) {
          console.log('Received button state via RTM:', messageData.data);

          // 自分以外のメッセージのみ処理
          if (messageData.data.userId !== this.currentUserId) {
            if (this.buttonStateCallback) {
              const states = { [messageData.data.userId]: messageData.data };
              this.buttonStateCallback(states);
            }
          }
        }
      }
      // 古い形式のメッセージ（後方互換性）
      else if (this.isValidButtonState(messageData)) {
        console.log('Received button state via RTM (legacy):', messageData);

        // 自分以外のメッセージのみ処理
        if (messageData.userId !== this.currentUserId) {
          // コールバックで状態を通知
          if (this.buttonStateCallback) {
            const states = { [messageData.userId]: messageData };
            this.buttonStateCallback(states);
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse RTM message:', error);
    }
  }

  // ボタン状態データの検証
  private isValidButtonState(data: any): data is ButtonState {
    return (
      typeof data === 'object' &&
      typeof data.userId === 'string' &&
      typeof data.displayName === 'string' &&
      typeof data.pressed === 'boolean' &&
      typeof data.timestamp === 'number'
    );
  }

  // Girl姿勢状態データの検証
  private isValidGirlPostureState(data: any): data is GirlPostureState {
    return (
      typeof data === 'object' &&
      typeof data.userId === 'string' &&
      typeof data.displayName === 'string' &&
      (data.posture === 'standing' || data.posture === 'sitting') &&
      typeof data.timestamp === 'number'
    );
  }

  // Boy姿勢状態データの検証
  private isValidBoyPostureState(data: any): data is BoyPostureState {
    return (
      typeof data === 'object' &&
      typeof data.userId === 'string' &&
      typeof data.displayName === 'string' &&
      (data.posture === 'standing' || data.posture === 'sitting') &&
      typeof data.standingButtonPressed === 'boolean' &&
      typeof data.sittingButtonPressed === 'boolean' &&
      typeof data.timestamp === 'number'
    );
  }

  // ボタン状態変更のコールバックを設定
  onButtonStateChange(callback: (states: Record<string, ButtonState>) => void): void {
    this.buttonStateCallback = callback;
  }

  // Girl姿勢変更のコールバックを設定
  onGirlPostureChange(callback: (states: Record<string, GirlPostureState>) => void): void {
    this.girlPostureCallback = callback;
  }

  // Boy姿勢変更のコールバックを設定
  onBoyPostureChange(callback: (states: Record<string, BoyPostureState>) => void): void {
    this.boyPostureCallback = callback;
  }

  // ボタン状態更新
  async updateButtonStateFast(pressed: boolean): Promise<void> {
    const startTime = performance.now();

    try {
      await this.sendButtonState(pressed);

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      console.log(`RTM button sync: ${pressed ? '押下' : '解除'} (${latency}ms)`);
    } catch (error) {
      console.error('RTM button sync error:', error);
    }
  }

  // Girl姿勢状態更新
  async updateGirlPostureFast(posture: 'standing' | 'sitting'): Promise<void> {
    const startTime = performance.now();

    try {
      await this.sendGirlPostureState(posture);

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      console.log(`RTM girl posture sync: ${posture} (${latency}ms)`);
    } catch (error) {
      console.error('RTM girl posture sync error:', error);
    }
  }

  // Boy姿勢状態更新
  async updateBoyPostureFast(posture: 'standing' | 'sitting', standingButtonPressed: boolean, sittingButtonPressed: boolean): Promise<void> {
    const startTime = performance.now();

    try {
      await this.sendBoyPostureState(posture, standingButtonPressed, sittingButtonPressed);

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      console.log(`RTM boy posture sync: ${posture} (${latency}ms)`);
    } catch (error) {
      console.error('RTM boy posture sync error:', error);
    }
  }

  // リソースのクリーンアップ
  async cleanup(): Promise<void> {
    console.log('Cleanup RTM service');

    try {
      // チャンネルから退出
      if (this.client && this.currentChannelName) {
        await this.client.unsubscribe(this.currentChannelName);
        this.currentChannelName = null;
      }

      // ログアウト
      if (this.client && this.isLoggedIn) {
        await this.client.logout();
        this.isLoggedIn = false;
      }

      this.currentUserId = null;
      this.buttonStateCallback = null;
      this.girlPostureCallback = null;
      this.boyPostureCallback = null;
      this.client = null;
    } catch (error) {
      console.error('Failed to cleanup RTM service:', error);
    }
  }
}

// シングルトンインスタンス
let agoraRTMServiceInstance: AgoraRTMService | null = null;

export const getAgoraRTMService = (): AgoraRTMService => {
  if (!agoraRTMServiceInstance) {
    agoraRTMServiceInstance = new AgoraRTMService();
  }
  return agoraRTMServiceInstance;
};

export const cleanupAgoraRTMService = async (): Promise<void> => {
  if (agoraRTMServiceInstance) {
    await agoraRTMServiceInstance.cleanup();
    agoraRTMServiceInstance = null;
  }
};