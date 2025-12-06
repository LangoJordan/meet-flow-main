import { auth, googleProvider, db } from "../firebase/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User
} from "firebase/auth";
import { setDoc, doc, serverTimestamp, updateDoc, getDoc } from "firebase/firestore";

const createOrUpdateUserProfile = async (
  user: User,
  isOnline: boolean = true,
  additionalData?: { name?: string; phone?: string; avatar?: string }
) => {
  if (!user) return;

  try {
    const profileRef = doc(db, "profiles", user.uid);
    const existingProfile = await getDoc(profileRef);

    const profileData: any = {
      userId: user.uid,
      email: user.email,
      name: additionalData?.name || user.displayName || "",
      phone: additionalData?.phone || "",
      avatar: additionalData?.avatar || user.photoURL || "https://lh3.googleusercontent.com/a/ACg8ocLZ8rJKU52yGWjkTzmsXB_5pIafCE5e147Wmo805EQlW0VRDw=s96-c",
      isOnline,
      lastLogin: serverTimestamp(),
      lastSeen: serverTimestamp(),
    };

    // Only set createdAt for new profiles
    if (!existingProfile.exists()) {
      profileData.createdAt = serverTimestamp();
    }

    await setDoc(profileRef, profileData, { merge: true });
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
};

export const registerUser = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await createOrUpdateUserProfile(userCredential.user);
  return userCredential;
};

export const loginUser = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  await createOrUpdateUserProfile(userCredential.user, true);
  return userCredential;
};

export const loginWithGoogle = async () => {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    await createOrUpdateUserProfile(userCredential.user, true);
    return userCredential;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'auth/popup-blocked') {
      throw {
        code: 'auth/popup-blocked',
        message: 'Popup was blocked. Please disable your popup blocker and try again.',
        userFriendlyMessage: 'Popup blocker detected. Please allow popups for this site.'
      };
    }
    throw error;
  }
};

export const updateUserOnlineStatus = async (userId: string, isOnline: boolean) => {
  if (!userId) return;

  try {
    const profileRef = doc(db, "profiles", userId);
    const profileSnap = await getDoc(profileRef);

    // Respecter la préférence de visibilité si elle existe
    if (profileSnap.exists()) {
      const data = profileSnap.data() as { getVisibility?: boolean };
      if (data.getVisibility === false) {
        // L'utilisateur ne souhaite pas être affiché en ligne
        await updateDoc(profileRef, {
          isOnline: false,
          lastUpdated: serverTimestamp(),
        });
        return;
      }
    }

    await updateDoc(profileRef, {
      isOnline,
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating user online status:", error);
    throw error;
  }
};

export const logoutUser = async (userId?: string) => {
  try {
    if (userId) {
      await updateUserOnlineStatus(userId, false);
    }
  } catch (error) {
    console.warn("Error updating status on logout:", error);
  }

  return await signOut(auth);
};
