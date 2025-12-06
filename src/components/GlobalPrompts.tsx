import { useAuth } from '@/context/AuthContext';
import { usePWA } from '@/context/PWAContext';
import { useIncomingCall } from '@/context/IncomingCallContext';
import { Button } from '@/components/ui/button';
import { X, Download, LogIn, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export const GlobalPrompts = () => {
  const { user, loading } = useAuth();
  const { showInstallPrompt, dismissInstallPrompt, installApp } = usePWA();
  const { currentInvitation, currentCaller, acceptIncomingCall, declineIncomingCall, pendingInvitationsCount } = useIncomingCall();
  const [dismissedGooglePrompt, setDismissedGooglePrompt] = useState(false);

  // Don't show anything while loading
  if (loading) return null;

  return (
    <>
      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-card border border-primary/20 rounded-xl shadow-xl p-3 flex items-center gap-3 max-w-xs hover:shadow-2xl transition-shadow">
            <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Installer l'app</h3>
              <p className="text-xs text-muted-foreground">Accès rapide et hors ligne</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={installApp}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                title="Installer"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={dismissInstallPrompt}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sign-In Prompt (only show if not authenticated) */}
      {!user && !dismissedGooglePrompt && !loading && (
        <div className="fixed bottom-4 left-4 sm:left-auto sm:right-20 z-[9998] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-card border border-accent/20 rounded-xl shadow-xl p-3 flex items-center gap-3 max-w-xs hover:shadow-2xl transition-shadow">
            <div className="flex-shrink-0 h-10 w-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <LogIn className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Se connecter</h3>
              <p className="text-xs text-muted-foreground">Accédez à vos réunions</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Link to="/login">
                <button className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors">
                  <LogIn className="h-4 w-4" />
                </button>
              </Link>
              <button
                onClick={() => setDismissedGooglePrompt(true)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Notification (appears on all pages for authenticated users) */}
      {user && currentInvitation && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-card border border-primary/30 rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center">
              <Phone className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-foreground">Appel entrant</p>
              <p className="text-sm text-muted-foreground truncate">
                De {currentCaller?.displayName || currentCaller?.name || currentInvitation.callerId}
              </p>
              {pendingInvitationsCount > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  +{pendingInvitationsCount - 1} autre{pendingInvitationsCount - 1 > 1 ? 's' : ''} appel{pendingInvitationsCount - 1 > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => declineIncomingCall(currentInvitation)}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                Refuser
              </Button>
              <Button
                size="sm"
                onClick={() => acceptIncomingCall(currentInvitation)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Rejoindre
              </Button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
