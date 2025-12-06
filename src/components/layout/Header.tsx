import { Bell, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from "@/context/AuthContext";
import { useUserContacts } from "@/hooks/useUserContacts";
import { useEffect, useState } from 'react';
import { db } from '@/firebase/firebase';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { toast } from 'sonner';

type NotificationDoc = {
  type: 'invitation_accepted' | 'invitation_declined' | string;
  userName?: string;
};

export const Header = () => {
  const { user } = useAuth();
  const { contacts, loading } = useUserContacts();
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      window.localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('callerId', '==', user.uid),
      where('read', '==', false),
    );

    const unsub = onSnapshot(q, async (snap) => {
      const markReadIds: string[] = [];

      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data() as NotificationDoc;
        const userName = data.userName || 'Un utilisateur';

        if (data.type === 'invitation_accepted') {
          toast.success(`${userName} a accepté votre invitation`, {
            duration: 4000,
          });
        } else if (data.type === 'invitation_declined') {
          toast.error(`${userName} a refusé votre invitation`, {
            duration: 4000,
          });
        }

        markReadIds.push(change.doc.id);
      });

      // Marquer les notifications comme lues pour éviter les doublons
      await Promise.all(
        markReadIds.map((id) =>
          updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => undefined),
        ),
      );
    });

    return () => unsub();
  }, [user?.uid]);

  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Rechercher des contacts, réunions..." 
          className="border-none bg-muted/50 focus-visible:ring-primary"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-muted"
          onClick={() => setIsDark(prev => !prev)}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-muted">
          <Bell className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 ml-4">
          <div className="text-right">
            <p className="text-sm font-medium"> {user?.displayName ?? user?.email ?? "Utilisateur"}</p>
            <p className="text-xs text-muted-foreground"> {user?.email ?? ""}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-gradient-main flex items-center justify-center text-white font-semibold">
            {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};
