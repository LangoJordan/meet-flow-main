// Mock data for the application

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy';
}

export interface Call {
  id: string;
  title: string;
  duration: number; // in minutes
  participants: string[];
  date: string;
  status: 'completed' | 'ongoing' | 'scheduled';
  hostId: string;
}

export interface CallDetails extends Call {
  description?: string;
  participantsDetails: Array<{
    contactId: string;
    role: 'host' | 'co-host' | 'participant';
  }>;
}

export interface Invitation {
  id: string;
  title: string;
  description: string;
  type: 'public' | 'private' | 'organizational';
  scheduledDate: string;
  scheduledTime: string;
  invitedContacts: string[];
  participants: Array<{
    contactId: string;
    role: 'host' | 'co-host' | 'participant';
    status: 'pending' | 'accepted' | 'declined';
  }>;
  status: 'sent' | 'accepted' | 'declined';
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

// Mock Contacts
export const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Marie Dubois',
    email: 'marie.dubois@example.com',
    phone: '+33 6 12 34 56 78',
    status: 'online',
  },
  {
    id: '2',
    name: 'Jean Martin',
    email: 'jean.martin@example.com',
    phone: '+33 6 23 45 67 89',
    status: 'offline',
  },
  {
    id: '3',
    name: 'Sophie Laurent',
    email: 'sophie.laurent@example.com',
    phone: '+33 6 34 56 78 90',
    status: 'busy',
  },
  {
    id: '4',
    name: 'Pierre Bernard',
    email: 'pierre.bernard@example.com',
    phone: '+33 6 45 67 89 01',
    status: 'online',
  },
  {
    id: '5',
    name: 'Claire Petit',
    email: 'claire.petit@example.com',
    phone: '+33 6 56 78 90 12',
    status: 'offline',
  },
];

// Mock Calls
export const mockCalls: Call[] = [
  {
    id: '1',
    title: 'Réunion de projet Q1',
    duration: 45,
    participants: ['1', '2', '3'],
    date: '2025-01-15T10:00:00',
    status: 'completed',
    hostId: '1',
  },
  {
    id: '2',
    title: 'Stand-up quotidien',
    duration: 15,
    participants: ['1', '2', '4'],
    date: '2025-01-18T09:00:00',
    status: 'completed',
    hostId: '2',
  },
  {
    id: '3',
    title: 'Revue de code',
    duration: 60,
    participants: ['2', '3', '4', '5'],
    date: '2025-01-20T14:00:00',
    status: 'completed',
    hostId: '4',
  },
];
export const mockMeetingRooms = [
  {
    id: '1',
    title: 'Réunion stratégique Q1',
    objectives: 'Définir les objectifs du trimestre et aligner les équipes sur les priorités',
    participants: [
      { contactId: '1', role: 'host', isMicOn: true, isVideoOn: true },
      { contactId: '2', role: 'co-host', isMicOn: true, isVideoOn: true },
      { contactId: '3', role: 'participant', isMicOn: false, isVideoOn: true },
      { contactId: '4', role: 'participant', isMicOn: true, isVideoOn: false },
    ],
  },
  {
    id: '2',
    title: 'Revue hebdomadaire',
    objectives: 'Point hebdomadaire sur l\'avancement des projets en cours',
    participants: [
      { contactId: '1', role: 'host', isMicOn: true, isVideoOn: true },
      { contactId: '4', role: 'participant', isMicOn: true, isVideoOn: true },
    ],
  },
  {
    id: '3',
    title: 'Présentation client',
    objectives: 'Démonstration du nouveau produit au client',
    participants: [
      { contactId: '2', role: 'host', isMicOn: true, isVideoOn: true },
      { contactId: '3', role: 'co-host', isMicOn: true, isVideoOn: true },
      { contactId: '5', role: 'participant', isMicOn: true, isVideoOn: true },
    ],
  },
];
// Mock Call History Data
export const mockCallHistory = [
  {
    id: '1',
    contact: 'Marie Durant',
    type: 'video',
    duration: '45 min',
    date: 'Aujourd\'hui',
    status: 'completed',
  },
  {
    id: '2',
    contact: 'Jean Martin',
    type: 'audio',
    duration: '23 min',
    date: 'Hier',
    status: 'completed',
  },
  {
    id: '3',
    contact: 'Sophie Bernard',
    type: 'video',
    duration: '1h 15min',
    date: 'Il y a 2 jours',
    status: 'completed',
  },
  {
    id: '4',
    contact: 'Pierre Dubois',
    type: 'video',
    duration: '30 min',
    date: 'Il y a 3 jours',
    status: 'missed',
  },
  {
    id: '5',
    contact: 'Isabelle Leroy',
    type: 'audio',
    duration: '12 min',
    date: 'Il y a 5 jours',
    status: 'completed',
  },
];
// Mock Call Details
export const mockCallDetails: Record<string, CallDetails> = {
  '1': {
    ...mockCalls[0],
    description: 'Discussion sur les objectifs et stratégies pour le premier trimestre.',
    participantsDetails: [
      { contactId: '1', role: 'host' },
      { contactId: '2', role: 'co-host' },
      { contactId: '3', role: 'participant' },
    ],
  },
  '2': {
    ...mockCalls[1],
    description: 'Point quotidien sur l\'avancement des tâches.',
    participantsDetails: [
      { contactId: '2', role: 'host' },
      { contactId: '1', role: 'participant' },
      { contactId: '4', role: 'participant' },
    ],
  },
  '3': {
    ...mockCalls[2],
    description: 'Revue collective du code de la semaine.',
    participantsDetails: [
      { contactId: '4', role: 'host' },
      { contactId: '2', role: 'co-host' },
      { contactId: '3', role: 'participant' },
      { contactId: '5', role: 'participant' },
    ],
  },
};

// Mock Invitations
export const mockInvitations: Invitation[] = [
  {
    id: '1',
    title: 'Réunion stratégique mensuelle',
    description: 'Discussion sur la stratégie et les objectifs du mois.',
    type: 'organizational',
    scheduledDate: '2025-01-25',
    scheduledTime: '15:00',
    invitedContacts: ['1', '2', '3', '4'],
    participants: [
      { contactId: '1', role: 'host', status: 'accepted' },
      { contactId: '2', role: 'co-host', status: 'accepted' },
      { contactId: '3', role: 'participant', status: 'pending' },
      { contactId: '4', role: 'participant', status: 'accepted' },
    ],
    status: 'sent',
  },
  {
    id: '2',
    title: 'Brainstorming nouveaux projets',
    description: 'Session créative pour générer des idées de nouveaux projets.',
    type: 'private',
    scheduledDate: '2025-01-28',
    scheduledTime: '10:00',
    invitedContacts: ['2', '3', '5'],
    participants: [
      { contactId: '2', role: 'host', status: 'accepted' },
      { contactId: '3', role: 'participant', status: 'accepted' },
      { contactId: '5', role: 'participant', status: 'declined' },
    ],
    status: 'sent',
  },
];

// Mock Messages
export const mockMessages: Message[] = [
  {
    id: '1',
    senderId: '1',
    senderName: 'Marie Dubois',
    text: 'Bonjour à tous !',
    timestamp: '2025-01-20T14:05:00',
  },
  {
    id: '2',
    senderId: '2',
    senderName: 'Jean Martin',
    text: 'Salut Marie ! Comment vas-tu ?',
    timestamp: '2025-01-20T14:06:00',
  },
  {
    id: '3',
    senderId: '3',
    senderName: 'Sophie Laurent',
    text: 'On commence la réunion ?',
    timestamp: '2025-01-20T14:07:00',
  },
  {
    id: '4',
    senderId: '1',
    senderName: 'Marie Dubois',
    text: 'Oui, allons-y !',
    timestamp: '2025-01-20T14:08:00',
  },
];
