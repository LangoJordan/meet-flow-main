import { db } from '@/firebase/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * Notifie le créateur d'une réunion qu'une invitation a été acceptée.
 * Pour l'instant, on enregistre simplement un document dans une collection
 * `notifications` et on log dans la console. Tu pourras plus tard
 * brancher ça sur des emails, des push, etc.
 */
export async function notifyInvitationAccepted(
  callerId: string,
  reunionId: string,
  invitationId: string,
  userName: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      type: 'invitation_accepted',
      callerId,
      reunionId,
      invitationId,
      userName,
      createdAt: serverTimestamp(),
      read: false,
    });

    // Log côté client pour debug
    console.log('[notificationService] Invitation acceptée', {
      callerId,
      reunionId,
      invitationId,
      userName,
    });
  } catch (e) {
    console.warn('[notificationService] Échec de la création de la notification', e);
  }
}

export async function notifyInvitationReceived(
  callerId: string,
  reunionId: string,
  invitationId: string,
  calleeId: string,
  callerName: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      type: 'invitation_received',
      callerId,
      reunionId,
      invitationId,
      calleeId,
      callerName,
      createdAt: serverTimestamp(),
      read: false,
    });

    console.log('[notificationService] Notification invitation reçue', { callerId, reunionId, invitationId, calleeId });
  } catch (e) {
    console.warn('[notificationService] Échec de la création de la notification (invitation reçue)', e);
  }
}

export async function notifyInvitationDeclined(
  callerId: string,
  reunionId: string,
  invitationId: string,
  userName: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      type: 'invitation_declined',
      callerId,
      reunionId,
      invitationId,
      userName,
      createdAt: serverTimestamp(),
      read: false,
    });

    console.log('[notificationService] Invitation refusée', { callerId, reunionId, invitationId, userName });
  } catch (e) {
    console.warn('[notificationService] Échec de la création de la notification (invitation refusée)', e);
  }
}
