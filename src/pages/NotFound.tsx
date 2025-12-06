import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const isMeetingPath = location.pathname.startsWith('/meeting/');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center px-4">
        <h1 className="mb-4 text-4xl font-bold">{isMeetingPath ? 'Réunion expirée' : '404'}</h1>
        {isMeetingPath ? (
          <p className="mb-4 text-xl text-muted-foreground">
            Cette réunion n\'est plus disponible ou le lien a expiré.
          </p>
        ) : (
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        )}
        <a href="/" className="text-primary underline hover:text-primary/90">
          Retour au tableau de bord
        </a>
      </div>
    </div>
  );
};

export default NotFound;
