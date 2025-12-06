export interface ZegoCallInfo {
  roomId: string;
  token: string;
  userName: string;
  userId: string;
  callUrl: string;
}

/**
 * @deprecated Use server-side token generation instead
 * Génère un token ZegoCloud sécurisé pour un utilisateur
 */
export const generateZegoToken = (userId: string, userName: string): string => {
  throw new Error('This function is deprecated. Use server-side token generation.');
};

/**
 * @deprecated Use server-side token generation instead
 * Génère une room ID unique basée sur la réunion
 */
export const generateRoomId = (reunionId: string): string => {
  return `room_${reunionId.substring(0, 20)}`;
};

/**
 * @deprecated Use server-side token generation instead
 * Crée les informations complètes pour rejoindre un appel ZegoCloud
 */
export const generateCallInfo = (
  userId: string,
  userName: string,
  reunionId: string,
  callerName: string,
  calleeEmail: string
): ZegoCallInfo => {
  throw new Error('This function is deprecated. Use server-side token generation.');
};

/**
 * @deprecated Use server-side token generation instead
 * Génère les informations pour l'appelant (User1)
 */
export const generateCallerCallInfo = (
  callerId: string,
  callerName: string,
  callerEmail: string,
  reunionId: string
): ZegoCallInfo => {
  throw new Error('This function is deprecated. Use server-side token generation.');
};

/**
 * @deprecated Use server-side token generation instead
 * Génère les informations pour le destinataire (User2)
 */
export const generateCalleeCallInfo = (
  calleeId: string,
  calleeName: string,
  calleeEmail: string,
  reunionId: string,
  callerName: string
): ZegoCallInfo => {
  throw new Error('This function is deprecated. Use server-side token generation.');
};

/**
 * @deprecated Use server-side token generation instead
 * Valide qu'un token est toujours valide
 */
export const validateZegoToken = (token: string): boolean => {
  return false;
};
