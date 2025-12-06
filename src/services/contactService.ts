import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const getRecentContacts = async (userId: string) => {
  const contactsRef = collection(db, "contacts");

  const q = query(
    contactsRef,
    where("creatorId", "==", userId),
    orderBy("id", "desc"),
    limit(5) // 5 contacts récents
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
};
