import { db } from '@/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isOnline?: boolean;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'profiles', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        uid: userId,
        ...docSnap.data(),
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const getUserProfiles = async (userIds: string[]): Promise<Map<string, UserProfile>> => {
  const profiles = new Map<string, UserProfile>();
  
  try {
    const profilePromises = userIds.map(async (userId) => {
      const profile = await getUserProfile(userId);
      if (profile) {
        profiles.set(userId, profile);
      }
    });
    
    await Promise.all(profilePromises);
  } catch (error) {
    console.error('Error fetching user profiles:', error);
  }
  
  return profiles;
};
