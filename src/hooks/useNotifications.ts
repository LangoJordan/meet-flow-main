import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { useAuth } from '@/context/AuthContext';

export interface NotificationItem { id?: string; type?: string; callerId?: string; reunionId?: string; invitationId?: string; createdAt?: unknown; viewed?: boolean; [key: string]: unknown }

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // Currently listen to all notifications and filter client-side. This can be optimized later.
    const q = query(collection(db, 'notifications'));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...(d.data() as NotificationItem) } as NotificationItem)));
    });
    return () => unsub();
  }, [user]);

  return { notifications };
};
