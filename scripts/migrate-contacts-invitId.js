import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

(async function migrate() {
  try {
    if (!firebaseConfig.projectId) {
      console.error('Missing Firebase project config in env. Aborting migration.');
      return;
    }
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const contactsSnap = await getDocs(collection(db, 'contacts'));
    for (const c of contactsSnap.docs) {
      const cData = c.data();
      const invitId = cData.invitId;
      if (typeof invitId === 'string' && invitId.includes('@')) {
        console.log('Found contact with email invitId:', c.id, invitId);
        const profilesQ = query(collection(db, 'profiles'), where('email', '==', invitId));
        const profs = await getDocs(profilesQ);
        if (!profs.empty) {
          const prof = profs.docs[0].data();
          const userId = prof.userId || prof.uid || prof.id;
          if (userId) {
            await updateDoc(doc(db, 'contacts', c.id), { invitId: userId });
            console.log(`Updated contact ${c.id} invitId to UID ${userId}`);
          }
        }
      }
    }

    console.log('Migration complete');
  } catch (e) {
    console.error('Migration error', e);
  }
})();
