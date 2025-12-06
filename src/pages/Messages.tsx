import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMessages, Conversation } from '@/context/MessagesContext';
import { useGroups } from '@/context/GroupsContext';
import { useAuth } from '@/context/AuthContext';
import { useContactPresence } from '@/hooks/useContactPresence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Send, Phone, Video, Search, Settings, X, CheckCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Timestamp, collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import CreateGroupDialog from '@/components/CreateGroupDialog';
import GroupChatView from '@/components/GroupChatView';

const Messages = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    sendMessage,
    conversationsLoading,
    messages,
    loadConversationMessages,
    markMessageAsRead,
    deleteConversation,
    searchConversations,
    createDirectConversation,
  } = useMessages();
  const { groups, groupsLoading } = useGroups();
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [contactPresenceMap, setContactPresenceMap] = useState<Map<string, boolean>>(new Map());
  const [contacts, setContacts] = useState<Array<{id: string; invitId: string; name: string; email: string}>>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get participant presence for direct messages
  useEffect(() => {
    const presenceMap = new Map(contactPresenceMap);
    
    if (currentConversation?.type === 'direct' && currentConversation?.participantIds) {
      const otherUserId = currentConversation.participantIds.find(id => id !== user?.uid);
      if (otherUserId) {
        const profileRef = doc(db, 'profiles', otherUserId);
        const unsubscribe = onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            const isOnline = doc.data().isOnline || false;
            presenceMap.set(otherUserId, isOnline);
            setContactPresenceMap(new Map(presenceMap));
          }
        });
        return () => unsubscribe();
      }
    }
  }, [currentConversation?.id, user?.uid]);

  // Load all contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (!user) return;

      try {
        setContactsLoading(true);
        const contactsQuery = query(
          collection(db, 'contacts'),
          where('creatorId', '==', user.uid)
        );
        const contactDocs = await getDocs(contactsQuery);

        const loadedContacts = contactDocs.docs.map(doc => ({
          id: doc.id,
          invitId: doc.data().invitId,
          name: doc.data().displayName || doc.data().name || 'Sans nom',
          email: doc.data().email || '',
        }));

        setContacts(loadedContacts);

        // Subscribe to presence for all contacts
        const presenceMap = new Map(contactPresenceMap);
        for (const contact of loadedContacts) {
          const profileRef = doc(db, 'profiles', contact.invitId);
          onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
              const isOnline = docSnap.data().isOnline || false;
              presenceMap.set(contact.invitId, isOnline);
              setContactPresenceMap(new Map(presenceMap));
            }
          });
        }
      } catch (error) {
        console.error('Failed to load contacts:', error);
      } finally {
        setContactsLoading(false);
      }
    };

    if (user) {
      loadContacts();
    }
  }, [user]);

  // Fetch contact names for display
  useEffect(() => {
    const fetchContactNames = async () => {
      const names = new Map(contactNames);

      for (const conv of conversations) {
        if (conv.type === 'direct' && conv.participantIds) {
          const otherUserId = conv.participantIds.find(id => id !== user?.uid);
          if (otherUserId && !names.has(otherUserId)) {
            try {
              const contactsQuery = query(
                collection(db, 'contacts'),
                where('creatorId', '==', user?.uid),
                where('invitId', '==', otherUserId)
              );
              const contactDocs = await getDocs(contactsQuery);

              if (!contactDocs.empty) {
                const contactName = contactDocs.docs[0].data().displayName || contactDocs.docs[0].data().name;
                names.set(otherUserId, contactName);
              } else {
                const profileDoc = await getDoc(doc(db, 'profiles', otherUserId));
                if (profileDoc.exists()) {
                  const profileName = profileDoc.data().displayName || profileDoc.data().email || otherUserId;
                  names.set(otherUserId, profileName);
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch name for ${otherUserId}:`, error);
              names.set(otherUserId, otherUserId);
            }
          }
        }
      }

      setContactNames(names);
    };

    if (user && conversations.length > 0) {
      fetchContactNames();
    }
  }, [conversations, user]);

  // Auto-select conversation when navigating
  useEffect(() => {
    const state = location.state as { conversationId?: string } | null;
    if (state?.conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === state.conversationId);
      if (conversation) {
        setCurrentConversation(conversation);
      }
    }
  }, [location.state, conversations, setCurrentConversation]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversation?.id) {
      loadConversationMessages(currentConversation.id);
    }
  }, [currentConversation?.id, loadConversationMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentConversation?.id || !messageInput.trim() || !user) {
      toast.error('Sélectionnez une conversation valide');
      return;
    }

    setSendingMessage(true);
    try {
      await sendMessage(currentConversation.id, messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStartDirectCall = async () => {
    if (!currentConversation?.id || currentConversation.type !== 'direct') {
      toast.error('Sélectionnez une conversation directe valide');
      return;
    }

    const otherUserId = currentConversation.participantIds.find((id) => id !== user?.uid);
    if (!otherUserId) {
      toast.error('Impossible de trouver le destinataire');
      return;
    }

    navigate(`/invitations/new?targetUserId=${otherUserId}`);
  };

  const handleStartGroupCall = async () => {
    if (!currentConversation?.id || currentConversation.type !== 'group') {
      toast.error('Sélectionnez un groupe valide');
      return;
    }

    const selectedGroup = groups.find((g) => g.conversationId === currentConversation.id);
    if (!selectedGroup?.id) {
      toast.error('Groupe non trouvé');
      return;
    }

    navigate(`/group-call/new?groupId=${selectedGroup.id}`);
  };

  const handleLeaveGroupSuccess = () => {
    setCurrentConversation(null);
    setGroupDetailsOpen(false);
  };

  const handleStartDirectMessage = async (contactId: string) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      const conversation = await createDirectConversation(contactId);
      setCurrentConversation(conversation);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Impossible de démarrer la conversation');
    }
  };

  const formatTimestamp = (ts: Timestamp | Date | string | null | undefined) => {
    if (!ts) return '';
    try {
      const date = ts instanceof Timestamp ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    } catch {
      return '';
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'group') {
      return conv.groupName || 'Groupe sans nom';
    }
    const otherUserId = conv.participantIds.find((id) => id !== user?.uid);
    if (!otherUserId) return 'Conversation';
    return contactNames.get(otherUserId) || conv.participantNames?.[0] || 'Sans nom';
  };

  // Search across conversations, groups, and contacts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show all conversations and no contacts when search is empty
      return { conversations: conversations, contacts: [] };
    }

    const lowerQuery = searchQuery.toLowerCase();

    // Filter conversations and groups by name, objective, or participant names
    const filteredConversations = conversations.filter((conv) => {
      if (conv.type === 'group') {
        // Search in group name, objective, description, or participant names
        return (
          (conv.groupName?.toLowerCase().includes(lowerQuery)) ||
          (conv.groupObjective?.toLowerCase().includes(lowerQuery)) ||
          (conv.groupDescription?.toLowerCase().includes(lowerQuery)) ||
          (conv.participantNames?.some(name => name.toLowerCase().includes(lowerQuery)))
        );
      }
      // For direct messages, search in contact names and emails
      const conversationName = conv.participantNames?.join(' ').toLowerCase() || '';
      return conversationName.includes(lowerQuery);
    });

    // Filter contacts that don't have existing conversations
    const filteredContacts = contacts
      .filter(contact =>
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.email.toLowerCase().includes(lowerQuery)
      )
      .filter(contact => {
        // Don't show contacts that already have a conversation
        return !conversations.some(conv =>
          conv.type === 'direct' &&
          conv.participantIds.includes(contact.invitId)
        );
      });

    return { conversations: filteredConversations, contacts: filteredContacts };
  }, [conversations, searchQuery, contacts]);

  const handleSelectConversation = (conv: Conversation) => {
    setCurrentConversation(conv);
  };

  const handleDeleteConversation = async (conv: Conversation) => {
    if (!conv.id) return;

    toast('Supprimer la conversation ?', {
      description: 'Cette action est irréversible.',
      action: {
        label: "Supprimer",
        onClick: async () => {
          try {
            await deleteConversation(conv.id!);
            if (currentConversation?.id === conv.id) {
              setCurrentConversation(null);
            }
            toast.success('Conversation supprimée');
          } catch (error) {
            console.error('Error deleting conversation:', error);
            toast.error('Erreur lors de la suppression');
          }
        },
      },
      cancel: { label: "Annuler" },
      duration: 10000,
    });
  };

  const isGroupChat = currentConversation?.type === 'group';
  const otherUserId = currentConversation?.type === 'direct' 
    ? currentConversation?.participantIds.find((id) => id !== user?.uid)
    : null;
  const isOtherUserOnline = otherUserId ? contactPresenceMap.get(otherUserId) : false;

  return (
    <DashboardLayout>
      <div className="flex h-full gap-4">
        {/* Conversations List Sidebar */}
        <div className="w-96 flex flex-col border-r border-border/50 bg-card/50">
          {/* Header */}
          <div className="p-6 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Messages</h1>
              <CreateGroupDialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
                <Button size="icon" variant="outline" className="rounded-full">
                  <Plus className="h-5 w-5" />
                </Button>
              </CreateGroupDialog>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Chercher contact, groupe ou conversation..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-3">
              {conversationsLoading ? (
                <div className="space-y-2 p-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/20 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : searchResults.conversations.length === 0 && searchResults.contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucune conversation</p>
                  <p className="text-sm mt-2">Créez un groupe ou recherchez un contact</p>
                </div>
              ) : (
                <>
                  {/* Conversations Section */}
                  {searchResults.conversations.length > 0 && (
                    <>
                      {searchQuery && (
                        <p className="text-xs font-semibold text-muted-foreground px-3 py-2">CONVERSATIONS</p>
                      )}
                      {searchResults.conversations.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          isSelected={currentConversation?.id === conv.id}
                          onSelect={() => handleSelectConversation(conv)}
                          onDelete={() => handleDeleteConversation(conv)}
                          getConversationName={getConversationName}
                          formatTimestamp={formatTimestamp}
                          isOnline={
                            conv.type === 'direct'
                              ? contactPresenceMap.get(conv.participantIds.find(id => id !== user?.uid) || '')
                              : false
                          }
                        />
                      ))}
                    </>
                  )}

                  {/* Contacts Section */}
                  {searchResults.contacts.length > 0 && (
                    <>
                      {searchQuery && (
                        <p className="text-xs font-semibold text-muted-foreground px-3 py-2 mt-2">CONTACTS</p>
                      )}
                      {searchResults.contacts.map((contact) => (
                        <ContactSearchResult
                          key={contact.id}
                          contact={contact}
                          isOnline={contactPresenceMap.get(contact.invitId) || false}
                          onSelect={() => handleStartDirectMessage(contact.invitId)}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-background to-background/50">
          {currentConversation ? (
            <>
              {/* Chat Header */}
              <ChatHeader
                conversation={currentConversation}
                getConversationName={getConversationName}
                isGroupChat={isGroupChat}
                isOnline={isOtherUserOnline}
                onStartDirectCall={handleStartDirectCall}
                onStartGroupCall={handleStartGroupCall}
                onOpenGroupDetails={() => setGroupDetailsOpen(true)}
              />

              {/* Messages Area */}
              <MessagesArea
                messages={messages}
                userId={user?.uid}
                formatTimestamp={formatTimestamp}
                messagesEndRef={messagesEndRef}
              />

              {/* Message Input */}
              <MessageInput
                value={messageInput}
                onChange={(value) => setMessageInput(value)}
                onSend={handleSendMessage}
                isDisabled={sendingMessage}
                isLoading={sendingMessage}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-4">
                <p className="text-lg font-semibold">Sélectionnez une conversation</p>
                <p className="text-sm">ou créez une nouvelle discussion</p>
              </div>
            </div>
          )}
        </div>

        {/* Group Details Dialog */}
        {isGroupChat && currentConversation && (
          <Dialog open={groupDetailsOpen} onOpenChange={setGroupDetailsOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{currentConversation.groupName}</DialogTitle>
              </DialogHeader>
              <GroupChatView onLeaveGroup={handleLeaveGroupSuccess} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

// Contact Search Result Component
interface ContactSearchResultProps {
  contact: { id: string; invitId: string; name: string; email: string };
  isOnline: boolean;
  onSelect: () => void;
}

const ContactSearchResult = ({ contact, isOnline, onSelect }: ContactSearchResultProps) => {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 rounded-lg transition-all hover:bg-foreground/5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
            {isOnline && (
              <Badge variant="outline" className="text-xs flex-shrink-0 bg-green-500/10 border-green-500/30 text-green-700">
                En ligne
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-1">{contact.email}</p>
        </div>
      </div>
    </button>
  );
};

// Conversation Item Component
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  getConversationName: (conv: Conversation) => string;
  formatTimestamp: (ts: Timestamp | Date | string | null | undefined) => string;
  isOnline?: boolean;
}

const ConversationItem = ({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  getConversationName,
  formatTimestamp,
  isOnline,
}: ConversationItemProps) => {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={`w-full text-left p-4 rounded-lg transition-all group ${
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-foreground/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{getConversationName(conversation)}</h3>
            {conversation.type === 'group' ? (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                Groupe
              </Badge>
            ) : isOnline ? (
              <Badge variant="outline" className="text-xs flex-shrink-0 bg-green-500/10 border-green-500/30 text-green-700">
                En ligne
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-1">
            {conversation.lastMessage || 'Pas de message'}
          </p>
          {conversation.lastMessageTime && (
            <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(conversation.lastMessageTime)}</p>
          )}
        </div>
        
        {showDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-shrink-0 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </button>
  );
};

// Chat Header Component
interface ChatHeaderProps {
  conversation: Conversation;
  getConversationName: (conv: Conversation) => string;
  isGroupChat: boolean;
  isOnline?: boolean;
  onStartDirectCall: () => void;
  onStartGroupCall: () => void;
  onOpenGroupDetails: () => void;
}

const ChatHeader = ({
  conversation,
  getConversationName,
  isGroupChat,
  isOnline,
  onStartDirectCall,
  onStartGroupCall,
  onOpenGroupDetails,
}: ChatHeaderProps) => {
  return (
    <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-card to-card/50">
      <div>
        <h2 className="text-xl font-bold">{getConversationName(conversation)}</h2>
        {conversation.type === 'direct' && isOnline !== undefined && (
          <p className={`text-sm ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
          </p>
        )}
        {conversation.type === 'group' && conversation.groupObjective && (
          <p className="text-sm text-muted-foreground mt-1">{conversation.groupObjective}</p>
        )}
      </div>

      <div className="flex gap-2">
        {isGroupChat ? (
          <>
            <Button size="icon" variant="outline" onClick={onStartGroupCall} title="Appel audio groupe">
              <Phone className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="outline" onClick={onStartGroupCall} title="Appel vidéo groupe">
              <Video className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={onOpenGroupDetails} className="text-sm">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="outline" onClick={onStartDirectCall} title="Appel audio">
              <Phone className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="outline" onClick={onStartDirectCall} title="Appel vidéo">
              <Video className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// Messages Area Component
interface MessagesAreaProps {
  messages: any[];
  userId?: string;
  formatTimestamp: (ts: Timestamp | Date | string | null | undefined) => string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const MessagesArea = ({
  messages,
  userId,
  formatTimestamp,
  messagesEndRef,
}: MessagesAreaProps) => {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Pas de messages</p>
            <p className="text-sm mt-2">Commencez la conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageGroup
              key={msg.id}
              message={msg}
              nextMessage={messages[idx + 1]}
              isCurrentUser={msg.senderId === userId}
              formatTimestamp={formatTimestamp}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

// Message Group Component (groups consecutive messages from same sender)
interface MessageGroupProps {
  message: any;
  nextMessage?: any;
  isCurrentUser: boolean;
  formatTimestamp: (ts: Timestamp | Date | string | null | undefined) => string;
}

const MessageGroup = ({
  message,
  nextMessage,
  isCurrentUser,
  formatTimestamp,
}: MessageGroupProps) => {
  const showSenderName = !isCurrentUser;
  const isSameAuthor = nextMessage?.senderId === message.senderId;

  return (
    <div key={message.id} className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
      <div className="flex-1" />
      <div className="max-w-xs">
        {showSenderName && (
          <p className="text-xs font-semibold text-muted-foreground mb-1 px-3">
            {message.senderName}
          </p>
        )}
        <div
          className={`px-4 py-2 rounded-lg ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground rounded-br-none'
              : 'bg-muted text-foreground rounded-bl-none'
          }`}
        >
          <p className="break-words text-sm">{message.content}</p>
          <p className={`text-xs mt-1 opacity-70 flex items-center gap-1 justify-end`}>
            {formatTimestamp(message.createdAt)}
            {isCurrentUser && (
              <>
                {message.readBy?.length > 1 ? (
                  <CheckCheck className="h-3 w-3" title="Lus" />
                ) : (
                  <Clock className="h-3 w-3" title="Envoyé" />
                )}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
};

// Message Input Component
interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (e: React.FormEvent) => void;
  isDisabled: boolean;
  isLoading: boolean;
}

const MessageInput = ({
  value,
  onChange,
  onSend,
  isDisabled,
  isLoading,
}: MessageInputProps) => {
  return (
    <div className="p-6 border-t border-border/30 flex-shrink-0 bg-card/50">
      <form onSubmit={onSend} className="flex gap-2">
        <Input
          placeholder="Tapez un message..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className="rounded-full"
        />
        <Button 
          type="submit" 
          disabled={isDisabled || !value.trim()}
          className="rounded-full"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default Messages;
