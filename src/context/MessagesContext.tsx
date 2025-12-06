import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  orderBy,
  getDocs,
  getDoc,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderEmail?: string;
  content: string;
  createdAt: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  readBy?: string[];
}

export interface Conversation {
  id?: string;
  type: 'direct' | 'group';
  participantIds: string[];
  participantNames?: string[];
  lastMessage?: string;
  lastMessageTime?: Timestamp | Date | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  groupName?: string;
  groupObjective?: string;
  groupDescription?: string;
  creatorId?: string;
  groupId?: string;
  unreadCount?: number;
}

export interface MessagesContextType {
  conversations: Conversation[];
  messages: Message[];
  currentConversation: Conversation | null;
  setCurrentConversation: (conv: Conversation | null) => void;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  createDirectConversation: (otherUserId: string) => Promise<Conversation>;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  conversationsLoading: boolean;
  messagesLoading: boolean;
  deleteConversation: (conversationId: string) => Promise<void>;
  searchConversations: (query: string) => Conversation[];
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const unsubscribeMessagesRef = useRef<(() => void) | null>(null);

  // Load conversations with real-time updates
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setConversationsLoading(false);
      return;
    }

    setConversationsLoading(true);

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const convData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt || Timestamp.now(),
            updatedAt: data.updatedAt || Timestamp.now(),
          } as Conversation;
        });

        console.log('[MessagesContext] Query user ID:', user.uid);
        console.log('[MessagesContext] Loaded conversations count:', convData.length);
        console.log('[MessagesContext] Loaded conversations:', convData);
        convData.forEach((conv, i) => {
          console.log(`[MessagesContext] Conversation ${i}:`, {
            id: conv.id,
            type: conv.type,
            participantIds: conv.participantIds,
            participantNames: conv.participantNames,
            groupName: conv.groupName,
          });
        });
        setConversations(convData);
        setConversationsLoading(false);
      },
      (error) => {
        console.error('[MessagesContext] Error fetching conversations:', error);
        console.error('[MessagesContext] Error code:', error.code);
        console.error('[MessagesContext] Error message:', error.message);
        setConversationsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConversation?.id) {
      setMessages([]);
      if (unsubscribeMessagesRef.current) {
        unsubscribeMessagesRef.current();
        unsubscribeMessagesRef.current = null;
      }
      return;
    }

    setMessagesLoading(true);

    const messagesQuery = query(
      collection(db, `conversations/${currentConversation.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];

        setMessages(msgData);
        setMessagesLoading(false);

        // Mark conversation as read when messages are loaded
        if (user && currentConversation.id) {
          markConversationAsRead(currentConversation.id).catch(err =>
            console.warn('Failed to mark conversation as read:', err)
          );
        }
      },
      (error) => {
        console.error('Error fetching messages:', error);
        setMessagesLoading(false);
      }
    );

    unsubscribeMessagesRef.current = unsubscribe;
    return () => unsubscribe();
  }, [currentConversation?.id, user]);

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      if (!user || !content.trim()) return;

      try {
        const messageRef = collection(db, `conversations/${conversationId}/messages`);
        const docRef = await addDoc(messageRef, {
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          senderEmail: user.email,
          content: content.trim(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          readBy: [user.uid],
        });

        await updateDoc(doc(db, 'conversations', conversationId), {
          lastMessage: content.trim(),
          lastMessageTime: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        console.log('Message sent successfully:', docRef.id);
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    },
    [user]
  );

  const createDirectConversation = useCallback(
    async (otherUserId: string): Promise<Conversation> => {
      if (!user) throw new Error('User not authenticated');

      try {
        const participantIds = [user.uid, otherUserId].sort();

        // Query for existing conversation with both participants
        const existingQuery = query(
          collection(db, 'conversations'),
          where('type', '==', 'direct'),
          where('participantIds', '==', participantIds)
        );

        const existingDocs = await getDocs(existingQuery);

        if (!existingDocs.empty) {
          const existingConv = existingDocs.docs[0];
          return {
            id: existingConv.id,
            ...existingConv.data(),
          } as Conversation;
        }

        // Fetch both users' profiles to get their names
        let currentUserName = 'Vous';
        let otherUserName = 'Utilisateur';

        try {
          const currentUserDoc = await getDoc(doc(db, 'profiles', user.uid));
          if (currentUserDoc.exists()) {
            currentUserName = currentUserDoc.data().displayName || currentUserDoc.data().email || 'Vous';
          }
        } catch (e) {
          console.warn('Failed to fetch current user profile:', e);
        }

        try {
          const otherUserDoc = await getDoc(doc(db, 'profiles', otherUserId));
          if (otherUserDoc.exists()) {
            otherUserName = otherUserDoc.data().displayName || otherUserDoc.data().email || 'Utilisateur';
          }
        } catch (e) {
          console.warn('Failed to fetch other user profile:', e);
        }

        const conversationRef = await addDoc(collection(db, 'conversations'), {
          type: 'direct',
          participantIds,
          participantNames: [currentUserName, otherUserName],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        const newConversation: Conversation = {
          id: conversationRef.id,
          type: 'direct',
          participantIds,
          participantNames: [otherUserName],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        return newConversation;
      } catch (error) {
        console.error('Error creating direct conversation:', error);
        throw error;
      }
    },
    [user]
  );

  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      try {
        const messagesQuery = query(
          collection(db, `conversations/${conversationId}/messages`),
          orderBy('createdAt', 'asc')
        );

        const snapshot = await getDocs(messagesQuery);
        const msgData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];

        setMessages(msgData);
      } catch (error) {
        console.error('Error loading conversation messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    },
    []
  );

  const markMessageAsRead = useCallback(
    async (conversationId: string, messageId: string) => {
      if (!user) return;

      try {
        const messageRef = doc(db, `conversations/${conversationId}/messages/${messageId}`);
        await updateDoc(messageRef, {
          readBy: arrayUnion(user.uid),
        });
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    },
    [user]
  );

  const markConversationAsRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;

      try {
        // Update all unread messages in conversation
        const messagesQuery = query(
          collection(db, `conversations/${conversationId}/messages`),
          where('readBy', 'array-contains', user.uid)
        );

        const snapshot = await getDocs(messagesQuery);

        const batch = writeBatch(db);

        snapshot.docs.forEach((messageDoc) => {
          const data = messageDoc.data();
          if (!data.readBy?.includes(user.uid)) {
            batch.update(messageDoc.ref, {
              readBy: arrayUnion(user.uid),
            });
          }
        });

        if (snapshot.docs.length > 0) {
          await batch.commit();
        }
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    },
    [user]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        // Delete all messages in the conversation
        const messagesQuery = query(
          collection(db, `conversations/${conversationId}/messages`)
        );

        const snapshot = await getDocs(messagesQuery);
        const batch = writeBatch(db);

        snapshot.docs.forEach((messageDoc) => {
          batch.delete(messageDoc.ref);
        });

        await batch.commit();

        // Delete the conversation
        await updateDoc(doc(db, 'conversations', conversationId), {
          deletedFor: arrayUnion(user?.uid),
        });
      } catch (error) {
        console.error('Error deleting conversation:', error);
        throw error;
      }
    },
    [user]
  );

  const searchConversations = useCallback(
    (searchQuery: string): Conversation[] => {
      if (!searchQuery.trim()) return conversations;

      const lowerQuery = searchQuery.toLowerCase();
      return conversations.filter((conv) => {
        if (conv.type === 'group') {
          return conv.groupName?.toLowerCase().includes(lowerQuery) ||
                 conv.groupObjective?.toLowerCase().includes(lowerQuery);
        }
        return conv.participantNames?.some(name =>
          name.toLowerCase().includes(lowerQuery)
        );
      });
    },
    [conversations]
  );

  return (
    <MessagesContext.Provider
      value={{
        conversations,
        messages,
        currentConversation,
        setCurrentConversation,
        sendMessage,
        createDirectConversation,
        loadConversationMessages,
        markMessageAsRead,
        markConversationAsRead,
        conversationsLoading,
        messagesLoading,
        deleteConversation,
        searchConversations,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider');
  }
  return context;
};
