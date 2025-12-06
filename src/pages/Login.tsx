import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Users, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { loginUser, loginWithGoogle } from '../services/authService';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [showPassword, setShowPassword] = useState(false);

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

  const getErrorMessage = (error: { code?: string; message?: string }) => {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Email non trouvé';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée';
      case 'auth/weak-password':
        return 'Le mot de passe est trop faible (minimum 6 caractères)';
      case 'auth/invalid-email':
        return 'Format d\'email invalide';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé';
      case 'auth/too-many-requests':
        return 'Trop de tentatives de connexion. Veuillez réessayer plus tard';
      case 'auth/network-request-failed':
        return 'Erreur réseau. Vérifiez votre connexion internet';
      case 'auth/popup-closed-by-user':
        return 'La fenêtre de connexion a été fermée';
      case 'auth/popup-blocked':
        return 'Le popup a été bloqué. Autorisez les popups pour ce site';
      case 'auth/cancelled-popup-request':
        return 'La demande de connexion a été annulée';
      default:
        return error.message || 'Erreur d\'authentification';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Veuillez entrer votre email et mot de passe');
      return;
    }

    try {
      setIsLoading(true);
      await loginUser(email, password);
      toast.success('Connexion réussie!');
      navigate("/dashboard");
    } catch (err: unknown) {
      console.error('Login error:', err);
      const errorMessage = getErrorMessage(err);
      toast.error('Erreur de connexion', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await loginWithGoogle();
      toast.success('Connexion Google réussie!');
      navigate("/dashboard");
    } catch (err: unknown) {
      console.error('Google login error:', err);
      const errorMessage = getErrorMessage(err);
      toast.error('Erreur de connexion Google', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-border/60 bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-all"
          onClick={() => setIsDarkTheme((prev) => !prev)}
        >
          {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 relative z-10">
        <div className="w-full max-w-md space-y-8">
          {/* Logo Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Video className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">MeetApp</span>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">Welcome</h1>
            <p className="text-base text-muted-foreground">Connectez-vous pour accéder à votre compte</p>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="h-12 bg-card/50 hover:bg-card transition-all border border-border/50 hover:border-border group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </Button>

            <Button
              variant="outline"
              disabled
              className="h-12 bg-card/50 hover:bg-card transition-all border border-border/50"
              title="GitHub login non disponible"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground font-medium">OU CONTINUER</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-card/50 border-border/50 focus:border-primary/50 focus:bg-card transition-all"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-card/50 border-border/50 focus:border-primary/50 focus:bg-card transition-all pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="space-y-4">
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Vous n'avez pas de compte? </span>
              <Link to="/register" className="text-primary hover:underline font-semibold underline-offset-4 transition-colors">
                Créer un compte
              </Link>
            </div>

            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              En continuant, vous acceptez nos <button className="underline hover:text-foreground transition-colors">Conditions d'utilisation</button> et <button className="underline hover:text-foreground transition-colors">Politique de confidentialité</button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/80 to-primary/60 items-center justify-center relative overflow-hidden p-12">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {/* Large animated gradient blobs */}
          <div className="absolute top-10 left-10 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-blob" />
          <div className="absolute top-40 right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.05)_25%,rgba(255,255,255,.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.05)_75%,rgba(255,255,255,.05))] bg-[length:60px_60px] opacity-40" />
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 left-20 w-20 h-20 border border-white/20 rounded-xl rotate-45 animate-float" />
        <div className="absolute bottom-32 right-32 w-12 h-12 border border-white/20 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-20 w-16 h-16 border border-white/20 rounded-lg rotate-12 animate-float" style={{ animationDelay: '2s' }} />

        {/* Feature Cards with enhanced animations */}
        <div className="relative z-10 space-y-6 max-w-md">
          <div className="group bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-6 space-y-4 hover:bg-white/15 transition-all hover:shadow-2xl hover:scale-105 transform duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-all group-hover:scale-110 duration-300">
                <Video className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-white">Réunions cristallines</h3>
                <p className="text-sm text-white/80">Appels vidéo HD avec jusqu'à 100 participants</p>
              </div>
            </div>
            <div className="h-1 w-0 bg-white group-hover:w-full transition-all duration-500" />
          </div>

          <div className="group bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-6 space-y-4 hover:bg-white/15 transition-all hover:shadow-2xl hover:scale-105 transform duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-all group-hover:scale-110 duration-300">
                <Users className="h-6 w-6 text-white animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-white">Collaboration d'équipe</h3>
                <p className="text-sm text-white/80">Partagez l'écran, chattez et travaillez ensemble</p>
              </div>
            </div>
            <div className="h-1 w-0 bg-white group-hover:w-full transition-all duration-500" />
          </div>

          {/* Stats or additional info */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/20">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">100+</p>
              <p className="text-xs text-white/70">Utilisateurs</p>
            </div>
            <div className="text-center border-l border-r border-white/20">
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-xs text-white/70">Support</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">99%</p>
              <p className="text-xs text-white/70">Uptime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;
