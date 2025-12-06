import { db } from '@/firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

export type ParticipantRole = 'host' | 'co-host' | 'participant';

interface InviteMemberPayload {
  contactId: string;
  role: ParticipantRole;
}

/**
 * Reprogramme une réunion existante en changeant le roomId/roomUrl
 * et en remettant toutes les invitations à l'état "pending".
 */
export async function reprogramReunion(
  reunionId: string,
  newRoomId: string,
  newRoomUrl: string,
): Promise<boolean> {
  try {
    const reunionRef = doc(db, 'reunions', reunionId);
    const snap = await getDoc(reunionRef);
    if (!snap.exists()) return false;

    await updateDoc(reunionRef, {
      roomId: newRoomId,
      roomUrl: newRoomUrl,
      status: 'scheduled',
      begin: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const invQ = query(collection(db, 'invitations'), where('reunionId', '==', reunionId));
    const invSnap = await getDocs(invQ);

    const batchUpdates = invSnap.docs.map(async (d) => {
      const invRef = doc(db, 'invitations', d.id);
      await updateDoc(invRef, {
        status: 'pending',
        viewed: false,
        url: newRoomUrl,
        zegoRoomId: newRoomId,
        debut: null,
        dateFin: null,
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(batchUpdates);
    return true;
  } catch (e) {
    console.error('reprogramReunion failed', e);
    return false;
  }
}

/**
 * Clone une réunion privée en une nouvelle réunion dont newCreatorId devient le créateur.
 * Retourne la nouvelle réunion (id) en cas de succès.
 */
export async function cloneReunionAsNew(
  reunionId: string,
  newCreatorId: string,
): Promise<{ id: string } | null> {
  try {
    const reunionRef = doc(db, 'reunions', reunionId);
    const snap = await getDoc(reunionRef);
    if (!snap.exists()) return null;

    const data = snap.data() || {};

    const newRoomId = `room_${Date.now()}_${newCreatorId}`;
    const newRoomUrl = `${window.location.origin}/meeting/${encodeURIComponent(newRoomId)}?userName=${encodeURIComponent('Organisateur')}`;

    const newReunionRef = await addDoc(collection(db, 'reunions'), {
      title: data.title ?? 'Réunion',
      description: data.description ?? '',
      creatorId: newCreatorId,
      status: 'scheduled',
      type: data.type ?? 'private',
      begin: serverTimestamp(),
      roomId: newRoomId,
      roomUrl: newRoomUrl,
      createdAt: serverTimestamp(),
    });

    // Recréer les invitations en copiant la liste des participants de l'ancienne réunion
    const invQ = query(collection(db, 'invitations'), where('reunionId', '==', reunionId));
    const invSnap = await getDocs(invQ);

    const createPromises = invSnap.docs.map(async (d) => {
      const inv = d.data() as { contactId?: string; role?: ParticipantRole };
      if (!inv.contactId) return;

      await addDoc(collection(db, 'invitations'), {
        reunionId: newReunionRef.id,
        callerId: newCreatorId,
        contactId: inv.contactId,
        createdAt: serverTimestamp(),
        debut: null,
        dateFin: null,
        role: inv.role ?? 'participant',
        status: 'pending',
        viewed: false,
        url: newRoomUrl,
        zegoRoomId: newRoomId,
      });
    });

    // Invitation auto-acceptée pour le nouveau créateur
    await addDoc(collection(db, 'invitations'), {
      reunionId: newReunionRef.id,
      callerId: newCreatorId,
      contactId: newCreatorId,
      createdAt: serverTimestamp(),
      debut: serverTimestamp(),
      dateFin: null,
      role: 'host',
      status: 'accepted',
      viewed: true,
      url: newRoomUrl,
      zegoRoomId: newRoomId,
    });

    await Promise.all(createPromises);

    return { id: newReunionRef.id };
  } catch (e) {
    console.error('cloneReunionAsNew failed', e);
    return null;
  }
}

/**
 * Invite une liste de contacts à une réunion existante.
 */
export async function inviteMembersToReunion(
  reunionId: string,
  callerId: string,
  members: InviteMemberPayload[],
  roomUrl: string,
  roomId: string,
): Promise<boolean> {
  try {
    if (!members || members.length === 0) return false;

    const promises = members.map(async (m) => {
      await addDoc(collection(db, 'invitations'), {
        reunionId,
        callerId,
        contactId: m.contactId,
        createdAt: serverTimestamp(),
        debut: null,
        dateFin: null,
        role: m.role ?? 'participant',
        status: 'pending',
        viewed: false,
        url: roomUrl,
        zegoRoomId: roomId,
      });
    });

    await Promise.all(promises);
    return true;
  } catch (e) {
    console.error('inviteMembersToReunion failed', e);
    return false;
  }
}

const callService = {
  reprogramReunion,
  cloneReunionAsNew,
  inviteMembersToReunion,
};

export default callService;
