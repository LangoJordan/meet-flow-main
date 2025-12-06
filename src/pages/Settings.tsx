import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase/firebase';
import { toast } from 'sonner';
import { Bell, Shield, Eye, EyeOff, Moon, Sun, User, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

interface ProfileData {
  displayName?: string;
  email?: string;
  isOnline?: boolean;
  photoURL?: string;
  phone?: string;
  emailNotifications?: boolean;
  meetingReminders?: boolean;
  getVisibility?: boolean;
}

const Settings = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const profileRef = doc(db, 'profiles', user.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const data = profileSnap.data() as ProfileData;
          setProfileData({
            displayName: data.displayName || user.displayName || '',
            email: data.email || user.email || '',
            isOnline: data.isOnline ?? true,
            photoURL: data.photoURL || user.photoURL || '',
            phone: data.phone || '',
            emailNotifications: data.emailNotifications ?? true,
            meetingReminders: data.meetingReminders ?? true,
            getVisibility: data.getVisibility ?? true,
          });
        } else {
          setProfileData({
            displayName: user.displayName || '',
            email: user.email || '',
            isOnline: true,
            phone: '',
            emailNotifications: true,
            meetingReminders: true,
            getVisibility: true,
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('Erreur lors du chargement du profil');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isDarkTheme) {
      root.classList.add('dark');
      window.localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('theme', 'light');
    }
  }, [isDarkTheme]);

  const handleSaveProfile = async () => {
    if (!user) {
      toast.error('Utilisateur non authentifié');
      return;
    }

    try {
      setIsSaving(true);
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        displayName: profileData.displayName,
        isOnline: profileData.isOnline,
        phone: profileData.phone || '',
        emailNotifications: profileData.emailNotifications ?? true,
        meetingReminders: profileData.meetingReminders ?? true,
        getVisibility: profileData.getVisibility ?? true,
      });
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Erreur lors de la sauvegarde du profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOnlineVisibilityChange = (value: boolean) => {
    setProfileData(prev => ({ ...prev, isOnline: value, getVisibility: value }));
  };

  const handleChangePassword = async () => {
    if (!user) {
      toast.error('Utilisateur non authentifié');
      return;
    }

    if (!passwordData.currentPassword) {
      toast.error('Veuillez entrer votre mot de passe actuel');
      return;
    }

    if (!passwordData.newPassword) {
      toast.error('Veuillez entrer un nouveau mot de passe');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setIsChangingPassword(true);

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email!, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordData.newPassword);

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      toast.success('Mot de passe mis à jour avec succès');
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Le mot de passe actuel est incorrect');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Le nouveau mot de passe est trop faible');
      } else {
        toast.error('Erreur lors du changement du mot de passe');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!user) {
      toast.error('Utilisateur non authentifié');
      return;
    }

    toast('Confirmer la désactivation du compte ?', {
      description: 'Cette action désactivera votre compte. Vous pourrez le réactiver plus tard en vous reconnectant.',
      action: {
        label: "Désactiver",
        onClick: async () => {
          try {
            setIsDeletingAccount(true);

            // Update user profile to mark account as deactivated
            const profileRef = doc(db, 'profiles', user.uid);
            await updateDoc(profileRef, {
              isDeactivated: true,
              deactivatedAt: new Date().toISOString(),
            });

            // Call backend to disable account in Firebase Auth
            try {
              await fetch('http://localhost:4000/api/deactivate-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid }),
              });
            } catch (fetchErr) {
              console.warn('Failed to call deactivate-account backend', fetchErr);
            }

            toast.success('Compte désactivé avec succès');
            setTimeout(() => {
              window.location.href = '/login';
            }, 2000);
          } catch (error: any) {
            console.error('Error deactivating account:', error);
            toast.error('Erreur lors de la désactivation du compte');
          } finally {
            setIsDeletingAccount(false);
          }
        },
      },
      cancel: { label: "Annuler" },
      duration: 10000,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/20 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          </div>
          
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Paramètres</h1>
            <p className="text-muted-foreground text-lg">Gérez vos préférences et votre compte</p>
          </div>
        </div>

        {/* Profile Section */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500/5 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Profil</CardTitle>
                <CardDescription>Informations de votre compte</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold">Nom complet</Label>
                <Input
                  id="name"
                  value={profileData.displayName || ''}
                  onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                  className="h-11 bg-muted/40 border-border/50 focus:border-primary/50"
                  placeholder="Votre nom complet"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email || ''}
                  disabled
                  className="h-11 opacity-60 cursor-not-allowed bg-muted/40 border-border/50"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-semibold">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={profileData.phone || ''}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                className="h-11 bg-muted/40 border-border/50 focus:border-primary/50"
                placeholder="+33 6 12 34 56 78"
              />
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/20 w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-500/5 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                {isDarkTheme ? <Moon className="w-5 h-5 text-purple-600" /> : <Sun className="w-5 h-5 text-purple-600" />}
              </div>
              <div>
                <CardTitle className="text-xl">Apparence</CardTitle>
                <CardDescription>Choisissez votre thème préféré</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/40 to-transparent border border-border/30 group hover:border-border/50 transition-colors">
              <div>
                <p className="font-semibold">Mode {isDarkTheme ? 'sombre' : 'clair'}</p>
                <p className="text-sm text-muted-foreground">Basculez entre le mode clair et le mode sombre</p>
              </div>
              <Switch
                checked={isDarkTheme}
                onCheckedChange={(value: boolean) => setIsDarkTheme(value)}
                className="ml-4"
              />
            </div>
          </CardContent>
        </Card>

        {/* Online Visibility Section */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-500/5 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Visibilité en ligne</CardTitle>
                <CardDescription>Contrôlez votre statut de présence</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/40 to-transparent border border-border/30 hover:border-border/50 transition-colors group">
              <div>
                <p className="font-semibold">Afficher mon statut en ligne</p>
                <p className="text-sm text-muted-foreground">Vos contacts verront si vous êtes en ligne</p>
              </div>
              <Switch
                checked={profileData.isOnline ?? true}
                onCheckedChange={handleOnlineVisibilityChange}
                className="ml-4"
              />
            </div>

            {profileData.isOnline ? (
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-400">Statut visible</p>
                  <p className="text-sm text-green-800 dark:text-green-300">Vous êtes affiché en ligne pour vos contacts</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-muted/50 dark:bg-muted/20 border border-border/50 p-4 flex items-start gap-3">
                <EyeOff className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Statut caché</p>
                  <p className="text-sm text-muted-foreground">Vous êtes affiché hors ligne pour vos contacts</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg shadow-green-500/20 w-full sm:w-auto"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500/5 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Notifications</CardTitle>
                <CardDescription>Configurez vos préférences de notification</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/40 to-transparent border border-border/30 hover:border-border/50 transition-colors">
              <div>
                <p className="font-semibold">Notifications par email</p>
                <p className="text-sm text-muted-foreground">Recevoir des emails pour les nouvelles invitations</p>
              </div>
              <Switch
                checked={profileData.emailNotifications ?? true}
                onCheckedChange={(value: boolean) =>
                  setProfileData(prev => ({ ...prev, emailNotifications: value }))
                }
                className="ml-4"
              />
            </div>
            
            <Separator className="my-2 opacity-50" />
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/40 to-transparent border border-border/30 hover:border-border/50 transition-colors">
              <div>
                <p className="font-semibold">Rappels de réunion</p>
                <p className="text-sm text-muted-foreground">Recevoir des rappels avant chaque réunion</p>
              </div>
              <Switch
                checked={profileData.meetingReminders ?? true}
                onCheckedChange={(value: boolean) =>
                  setProfileData(prev => ({ ...prev, meetingReminders: value }))
                }
                className="ml-4"
              />
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20 w-full sm:w-auto mt-4"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600/5 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <CardTitle className="text-xl">Sécurité</CardTitle>
                <CardDescription>Paramètres de sécurité de votre compte</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="font-semibold">Mot de passe actuel</Label>
                <Input
                  id="current-password"
                  type="password"
                  className="h-11 bg-muted/40 border-border/50 focus:border-primary/50"
                  placeholder="••••••••"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="font-semibold">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  className="h-11 bg-muted/40 border-border/50 focus:border-primary/50"
                  placeholder="••••••••"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="font-semibold">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type="password"
                className="h-11 bg-muted/40 border-border/50 focus:border-primary/50"
                placeholder="••••••••"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold w-full sm:w-auto"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Changement...
                </>
              ) : (
                'Changer le mot de passe'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Deletion Section */}
        <Card className="border-destructive/50 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-destructive/10 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-destructive/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-xl text-destructive">Suppression de compte</CardTitle>
                <CardDescription>Gérez l'accès à votre compte</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">Désactiver votre compte le rendra inaccessible. Vous pouvez réactiver votre compte en vous reconnectant avec vos identifiants.</p>
            <Button
              variant="destructive"
              className="font-semibold shadow-lg shadow-destructive/20 w-full sm:w-auto"
              onClick={handleDeactivateAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Désactivation...
                </>
              ) : (
                'Désactiver mon compte'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
