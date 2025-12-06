import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/firebase';

export const useContactPresence = (contactId: string) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!contactId) return;

    const profileRef = doc(db, 'profiles', contactId);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsOnline(data.isOnline || false);
      } else {
        setIsOnline(false);
      }
    }, (error) => {
      console.warn(`Error listening to contact ${contactId} presence:`, error);
      setIsOnline(false);
    });

    return () => unsubscribe();
  }, [contactId]);

  return isOnline;
};
