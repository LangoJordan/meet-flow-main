declare module '@zegocloud/zego-uikit-prebuilt' {
  export interface ZegoUIKitPrebuiltInstance {
    joinRoom(config: {
      container: HTMLElement | null;
      sharedLinks?: Array<{ name: string; url: string }>;
      scenario: { mode: number };
      showRoomUserList?: boolean;
      showTurnOffRemoteCameraButton?: boolean;
      showTurnOffRemoteMicrophoneButton?: boolean;
      showRemoveUserButton?: boolean;
      turnOnCameraWhenJoining?: boolean;
      turnOnMicrophoneWhenJoining?: boolean;
      onJoinRoom?: () => void;
    }): Promise<void>;
    leaveRoom(): Promise<void>;
  }

  export const ZegoUIKitPrebuilt: {
    VideoConference: number;
    generateKitTokenForTest(
      appID: number,
      serverSecret: string,
      roomID: string,
      userID: string,
      userName: string
    ): string;
    create(kitToken: string): ZegoUIKitPrebuiltInstance;
  };
}
