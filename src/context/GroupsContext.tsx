import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '@/firebase/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  getDocs,
  getDoc,
  arrayRemove,
  arrayUnion,
  orderBy,
} from 'firebase/firestore';

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  joinedAt?: Timestamp | Date | null;
}

export interface Group {
  id?: string;
  name: string;
  objective: string;
  description?: string;
  members: GroupMember[];
  creatorId: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  conversationId?: string;
}

export interface GroupsContextType {
  groups: Group[];
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  createGroup: (
    name: string,
    objective: string,
    memberIds: string[],
    memberRoles?: { [userId: string]: 'admin' | 'member' },
    description?: string
  ) => Promise<Group>;
  addGroupMember: (groupId: string, userId: string, role: 'admin' | 'member') => Promise<void>;
  removeGroupMember: (groupId: string, userId: string) => Promise<void>;
  updateGroupRole: (groupId: string, userId: string, role: 'admin' | 'member') => Promise<void>;
  updateGroup: (groupId: string, updates: Partial<Group>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  getGroupMembers: (groupId: string) => Promise<GroupMember[]>;
  groupsLoading: boolean;
  getGroupByConversationId: (conversationId: string) => Group | null;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export const GroupsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    setGroupsLoading(true);

    const groupsQuery = query(
      collection(db, 'groups'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      groupsQuery,
      (snapshot) => {
        const groupsData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((group) => {
            const groupData = group as Group;
            return groupData.members?.some((m) => m.userId === user.uid);
          }) as Group[];

        setGroups(groupsData);
        setGroupsLoading(false);
      },
      (error) => {
        console.error('Error fetching groups:', error);
        setGroupsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createGroup = useCallback(
    async (
      name: string,
      objective: string,
      memberIds: string[],
      memberRoles?: { [userId: string]: 'admin' | 'member' },
      description?: string
    ): Promise<Group> => {
      if (!user) throw new Error('User not authenticated');

      try {
        const members: GroupMember[] = memberIds.map((memberId) => {
          let memberData = { name: '', email: '' };

          // Try to fetch member profile synchronously (this happens quickly)
          return {
            userId: memberId,
            name: memberData.name || memberId,
            email: memberData.email || '',
            role: memberRoles?.[memberId] || (memberId === user.uid ? 'admin' : 'member'),
            joinedAt: Timestamp.now(),
          };
        });

        const groupRef = await addDoc(collection(db, 'groups'), {
          name,
          objective,
          description: description || '',
          members,
          creatorId: user.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Build participant names from the members array (already fetched names)
        const participantNames = members.map(m => m.name);

        const conversationRef = await addDoc(collection(db, 'conversations'), {
          type: 'group',
          participantIds: memberIds,
          participantNames: participantNames,
          groupName: name,
          groupObjective: objective,
          groupDescription: description || '',
          creatorId: user.uid,
          groupId: groupRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        console.log('[GroupsContext] Created group with ID:', groupRef.id);
        console.log('[GroupsContext] Created conversation with ID:', conversationRef.id);
        console.log('[GroupsContext] Group member IDs:', memberIds);
        console.log('[GroupsContext] Group participant names:', participantNames);

        await updateDoc(doc(db, 'groups', groupRef.id), {
          conversationId: conversationRef.id,
        });

        // Fetch member profiles asynchronously
        const updatedMembers: GroupMember[] = [];
        for (const memberId of memberIds) {
          try {
            const profileDoc = await getDoc(doc(db, 'profiles', memberId));
            if (profileDoc.exists()) {
              const profileData = profileDoc.data();
              updatedMembers.push({
                userId: memberId,
                name: profileData.displayName || profileData.email || memberId,
                email: profileData.email || '',
                role: memberRoles?.[memberId] || (memberId === user.uid ? 'admin' : 'member'),
                joinedAt: Timestamp.now(),
              });
            } else {
              updatedMembers.push({
                userId: memberId,
                name: memberId,
                email: '',
                role: memberRoles?.[memberId] || (memberId === user.uid ? 'admin' : 'member'),
                joinedAt: Timestamp.now(),
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch profile for ${memberId}:`, error);
          }
        }

        if (updatedMembers.length > 0) {
          await updateDoc(doc(db, 'groups', groupRef.id), {
            members: updatedMembers,
          });
        }

        const newGroup: Group = {
          id: groupRef.id,
          name,
          objective,
          description: description || '',
          members: updatedMembers.length > 0 ? updatedMembers : members,
          creatorId: user.uid,
          conversationId: conversationRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        return newGroup;
      } catch (error) {
        console.error('Error creating group:', error);
        throw error;
      }
    },
    [user]
  );

  const addGroupMember = useCallback(
    async (groupId: string, userId: string, role: 'admin' | 'member' = 'member') => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');

        const groupData = groupDoc.data() as Group;
        const memberExists = groupData.members.some((m) => m.userId === userId);

        if (memberExists) return;

        // Fetch user profile
        let memberName = userId;
        let memberEmail = '';
        try {
          const profileDoc = await getDoc(doc(db, 'profiles', userId));
          if (profileDoc.exists()) {
            const profileData = profileDoc.data();
            memberName = profileData.displayName || profileData.email || userId;
            memberEmail = profileData.email || '';
          }
        } catch (error) {
          console.warn(`Failed to fetch profile for ${userId}:`, error);
        }

        const newMember: GroupMember = {
          userId,
          name: memberName,
          email: memberEmail,
          role,
          joinedAt: Timestamp.now(),
        };

        const updatedMembers = [...groupData.members, newMember];

        await updateDoc(doc(db, 'groups', groupId), {
          members: updatedMembers,
          updatedAt: Timestamp.now(),
        });

        if (groupData.conversationId) {
          const conversationDoc = await getDoc(doc(db, 'conversations', groupData.conversationId));
          if (conversationDoc.exists()) {
            const participantIds = conversationDoc.data().participantIds || [];
            if (!participantIds.includes(userId)) {
              await updateDoc(doc(db, 'conversations', groupData.conversationId), {
                participantIds: [...participantIds, userId],
                updatedAt: Timestamp.now(),
              });
            }
          }
        }
      } catch (error) {
        console.error('Error adding group member:', error);
        throw error;
      }
    },
    []
  );

  const removeGroupMember = useCallback(
    async (groupId: string, userId: string) => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');

        const groupData = groupDoc.data() as Group;
        const updatedMembers = groupData.members.filter((m) => m.userId !== userId);

        await updateDoc(doc(db, 'groups', groupId), {
          members: updatedMembers,
          updatedAt: Timestamp.now(),
        });

        if (groupData.conversationId) {
          const conversationDoc = await getDoc(doc(db, 'conversations', groupData.conversationId));
          if (conversationDoc.exists()) {
            const participantIds = conversationDoc.data().participantIds || [];
            const updatedParticipants = participantIds.filter((id: string) => id !== userId);
            await updateDoc(doc(db, 'conversations', groupData.conversationId), {
              participantIds: updatedParticipants,
              updatedAt: Timestamp.now(),
            });
          }
        }
      } catch (error) {
        console.error('Error removing group member:', error);
        throw error;
      }
    },
    []
  );

  const updateGroupRole = useCallback(
    async (groupId: string, userId: string, role: 'admin' | 'member') => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');

        const groupData = groupDoc.data() as Group;
        const updatedMembers = groupData.members.map((m) =>
          m.userId === userId ? { ...m, role } : m
        );

        await updateDoc(doc(db, 'groups', groupId), {
          members: updatedMembers,
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Error updating group member role:', error);
        throw error;
      }
    },
    []
  );

  const updateGroup = useCallback(
    async (groupId: string, updates: Partial<Group>) => {
      try {
        await updateDoc(doc(db, 'groups', groupId), {
          ...updates,
          updatedAt: Timestamp.now(),
        });

        // Update conversation if it's group name or objective
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data() as Group;
          if (groupData.conversationId) {
            const conversationUpdates: any = {};
            if (updates.name) conversationUpdates.groupName = updates.name;
            if (updates.objective) conversationUpdates.groupObjective = updates.objective;
            if (updates.description) conversationUpdates.groupDescription = updates.description;

            if (Object.keys(conversationUpdates).length > 0) {
              await updateDoc(doc(db, 'conversations', groupData.conversationId), {
                ...conversationUpdates,
                updatedAt: Timestamp.now(),
              });
            }
          }
        }
      } catch (error) {
        console.error('Error updating group:', error);
        throw error;
      }
    },
    []
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');

        const groupData = groupDoc.data() as Group;

        if (groupData.conversationId) {
          await updateDoc(doc(db, 'conversations', groupData.conversationId), {
            deletedFor: arrayUnion(user?.uid),
          });
        }

        await updateDoc(doc(db, 'groups', groupId), {
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Error deleting group:', error);
        throw error;
      }
    },
    [user]
  );

  const getGroupMembers = useCallback(
    async (groupId: string): Promise<GroupMember[]> => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');

        const groupData = groupDoc.data() as Group;
        return groupData.members || [];
      } catch (error) {
        console.error('Error getting group members:', error);
        return [];
      }
    },
    []
  );

  const getGroupByConversationId = useCallback(
    (conversationId: string): Group | null => {
      return groups.find((g) => g.conversationId === conversationId) || null;
    },
    [groups]
  );

  return (
    <GroupsContext.Provider
      value={{
        groups,
        currentGroup,
        setCurrentGroup,
        createGroup,
        addGroupMember,
        removeGroupMember,
        updateGroupRole,
        updateGroup,
        deleteGroup,
        getGroupMembers,
        groupsLoading,
        getGroupByConversationId,
      }}
    >
      {children}
    </GroupsContext.Provider>
  );
};

export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within GroupsProvider');
  }
  return context;
};
