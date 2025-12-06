import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface PWAContextType {
  installPrompt: any;
  showInstallPrompt: boolean;
  dismissInstallPrompt: () => void;
  installApp: () => void;
}

const PWAContext = createContext<PWAContextType>({
  installPrompt: null,
  showInstallPrompt: false,
  dismissInstallPrompt: () => {},
  installApp: () => {},
});

export const PWAProvider = ({ children }: { children: ReactNode }) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setShowInstallPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
  };

  const installApp = async () => {
    if (!installPrompt) return;
    
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  return (
    <PWAContext.Provider value={{ installPrompt, showInstallPrompt, dismissInstallPrompt, installApp }}>
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => useContext(PWAContext);
