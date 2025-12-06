import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Users, Shield, Zap, ArrowRight, Star } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card } from '@/components/ui/card';
import Autoplay from "embla-carousel-autoplay";
import { useAuth } from "../context/AuthContext";

const Home = () => {
  const { user, loading } = useAuth();
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

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

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-lg">Chargement...</div>; // Ou un spinner de chargement
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Global Background Overlay / Pattern */}
      <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50 relative">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-blue-500 rounded-lg flex items-center justify-center shadow-md">
              <Video className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">MeetApp</h1>
          </div>
          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">À propos</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Témoignages</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <a href="mailto:nepturnelangojordan@mail.com" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-border/60"
              onClick={() => setIsDarkTheme((prev) => !prev)}
            >
              {isDarkTheme ? '☀️' : '🌙'}
            </Button>
            {user ? (
              <Link to="/dashboard">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                  Tableau de bord
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="hover:bg-muted">Se connecter</Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                    Créer un compte
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 lg:py-32 bg-gradient-to-br from-primary/10 to-background z-10">
        {/* Background image / overlay for Hero Section */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: 'url(https://images.pexels.com/photos/3184307/pexels-photo-3184307.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)' }}
        ></div>
        <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12 relative z-20">
          {user ? (
            <div className="lg:w-1/2 text-center lg:text-left space-y-6 animate-fade-in-left">
              <h1 className="text-5xl md:text-6xl font-extrabold text-foreground leading-tight">
                Bienvenue, <span className="text-primary">{user.displayName || user.email}!</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Vous êtes connecté. Accédez à votre tableau de bord pour gérer vos contacts et réunions en toute simplicité.
              </p>
              <Link to="/dashboard">
                <Button size="lg" className="mt-6 text-lg px-8 h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transform transition-transform hover:scale-105">
                  Accéder au Tableau de bord
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="lg:w-1/2 text-center lg:text-left space-y-6 animate-fade-in-left">
              <h2 className="text-5xl md:text-6xl font-extrabold text-foreground leading-tight">
                Connectez-vous <span className="text-primary">facilement</span> avec vos équipes
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Organisez des réunions vidéo professionnelles en quelques clics.
                Simple, rapide et efficace.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <Link to="/register">
                  <Button size="lg" className="text-lg px-8 h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transform transition-transform hover:scale-105">
                    Commencer gratuitement
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-2 border-primary text-primary hover:bg-primary/10 transform transition-transform hover:scale-105">
                    Découvrir
                  </Button>
                </Link>
              </div>
            </div>
          )}
          <div className="lg:w-1/2 mt-12 lg:mt-0 flex justify-center animate-fade-in-right">
            {/* Placeholder for a modern illustration/image */}
            <img
              src="https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg"
              alt="MeetApp Illustration"
              className="rounded-lg shadow-xl object-cover max-w-full h-auto lg:max-w-md xl:max-w-lg transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-24 bg-background relative z-10 animate-fade-in-up">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="lg:w-1/2 flex justify-center animate-fade-in-left">
            {/* Placeholder for an About Us image */}
            <img
              src="https://images.pexels.com/photos/3184405/pexels-photo-3184405.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
              alt="About Us Illustration"
              className="rounded-lg shadow-xl object-cover max-w-full h-auto lg:max-w-md xl:max-w-lg transition-transform duration-500 hover:scale-105"
            />
          </div>
          <div className="lg:w-1/2 text-center lg:text-left space-y-6 animate-fade-in-right">
            <h3 className="text-5xl font-extrabold text-foreground leading-tight">
              À propos de <span className="text-primary">MeetApp</span>
            </h3>
            <p className="text-xl text-muted-foreground">
              MeetApp est né d'une vision simple : rendre la communication d'équipe fluide, sécurisée et accessible à tous. Nous croyons que les meilleures idées émergent d'une collaboration sans friction, et c'est ce que notre plateforme s'efforce d'offrir.
            </p>
            <p className="text-xl text-muted-foreground">
              De la visioconférence HD à la gestion intuitive des contacts et à la présence en temps réel, MeetApp est conçu pour dynamiser votre productivité et renforcer les liens au sein de vos équipes, où que vous soyez.
            </p>
            <Link to="/register">
              <Button size="lg" className="mt-6 text-lg px-8 h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transform transition-transform hover:scale-105">
                Rejoignez l'aventure
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-br from-indigo-50/50 to-background relative z-10 animate-fade-in-up">
        <div className="container mx-auto px-6">
          <h3 className="text-4xl font-bold text-center mb-16 text-foreground"> Pourquoi choisir MeetApp ? </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-card p-8 rounded-2xl border border-border hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="h-14 w-14 bg-primary rounded-xl flex items-center justify-center mb-6 shadow-md">
                <Video className="h-7 w-7 text-primary-foreground" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-foreground">Visioconférence HD</h4>
              <p className="text-muted-foreground leading-relaxed"> Qualité vidéo et audio exceptionnelle pour vos réunions professionnelles. </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="h-14 w-14 bg-secondary rounded-xl flex items-center justify-center mb-6 shadow-md">
                <Users className="h-7 w-7 text-secondary-foreground" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-foreground">Collaboration simple</h4>
              <p className="text-muted-foreground leading-relaxed"> Invitez facilement vos contacts et gérez les rôles de chacun. </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="h-14 w-14 bg-success rounded-xl flex items-center justify-center mb-6 shadow-md">
                <Shield className="h-7 w-7 text-success-foreground" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-foreground">Sécurisé</h4>
              <p className="text-muted-foreground leading-relaxed"> Vos données et conversations sont protégées et cryptées. </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="h-14 w-14 bg-info rounded-xl flex items-center justify-center mb-6 shadow-md">
                <Zap className="h-7 w-7 text-info-foreground" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-foreground">Ultra rapide</h4>
              <p className="text-muted-foreground leading-relaxed"> Lancez une réunion en quelques secondes, sans installation. </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Témoignages */}
      <section id="testimonials" className="py-24 bg-gradient-to-tr from-blue-50/50 to-background z-10 relative animate-fade-in-up">
        <div className="container mx-auto px-6 text-center">
          <h3 className="text-5xl font-extrabold mb-12 text-foreground">
            Ce que nos <span className="text-primary">utilisateurs disent</span>
          </h3>
          <div className="max-w-4xl mx-auto">
            <Carousel
              plugins={[
                Autoplay({
                  delay: 4000,
                }),
              ]}
              className="w-full"
            >
              <CarouselContent>
                <CarouselItem>
                  <Card className="p-8 bg-card border-border shadow-lg">
                    <Avatar className="mx-auto h-20 w-20 mb-6 border-4 border-primary shadow-md">
                      <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=3276&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Témoignage de Sarah" />
                      <AvatarFallback>SA</AvatarFallback>
                    </Avatar>
                    <p className="text-lg md:text-xl text-muted-foreground italic mb-6">
                      "MeetApp a révolutionné la façon dont notre équipe collabore. La qualité des appels est exceptionnelle et l'interface est d'une simplicité enfantine. Un outil indispensable !"
                    </p>
                    <p className="font-semibold text-foreground text-xl">Sarah A., Chef de Projet</p>
                    <div className="flex justify-center items-center mt-2">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                  </Card>
                </CarouselItem>
                <CarouselItem>
                  <Card className="p-8 bg-card border-border shadow-lg">
                    <Avatar className="mx-auto h-20 w-20 mb-6 border-4 border-primary shadow-md">
                      <AvatarImage src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=3280&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Témoignage de Marc" />
                      <AvatarFallback>MA</AvatarFallback>
                    </Avatar>
                    <p className="text-lg md:text-xl text-muted-foreground italic mb-6">
                      "La fonctionnalité de présence en temps réel est incroyable ! Savoir qui est disponible en un coup d'œil me fait gagner un temps fou. Je ne peux plus m'en passer."
                    </p>
                    <p className="font-semibold text-foreground text-xl">Marc D., Développeur</p>
                    <div className="flex justify-center items-center mt-2">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                  </Card>
                </CarouselItem>
                <CarouselItem>
                  <Card className="p-8 bg-card border-border shadow-lg">
                    <Avatar className="mx-auto h-20 w-20 mb-6 border-4 border-primary shadow-md">
                      <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29329?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Témoignage d'Alice" />
                      <AvatarFallback>AL</AvatarFallback>
                    </Avatar>
                    <p className="text-lg md:text-xl text-muted-foreground italic mb-6">
                      "Facilité d'utilisation, sécurité et performance. MeetApp coche toutes les cases. Mes équipes sont plus productives et nos communications n'ont jamais été aussi fluides."
                    </p>
                    <p className="font-semibold text-foreground text-xl">Alice L., Directrice Marketing</p>
                    <div className="flex justify-center items-center mt-2">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                  </Card>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2" />
              <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2" />
            </Carousel>
          </div>
        </div>
      </section>

      {/* Section FAQ */}
      <section id="faq" className="py-24 bg-gradient-to-br from-purple-50/50 to-background relative z-10 animate-fade-in-up">
        <div className="container mx-auto px-6">
          <h3 className="text-5xl font-extrabold text-center mb-12 text-foreground">
            Questions <span className="text-primary">Fréquemment Posées</span>
          </h3>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg font-semibold text-foreground hover:text-primary transition-colors duration-200">Qu'est-ce que MeetApp ?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">MeetApp est une plateforme de visioconférence et de collaboration qui permet aux équipes de se connecter facilement, d'organiser des réunions HD sécurisées et de gérer leurs contacts en temps réel.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg font-semibold text-foreground hover:text-primary transition-colors duration-200">Comment puis-je créer un compte ?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">Vous pouvez créer un compte gratuitement en cliquant sur le bouton "Créer un compte" dans l'en-tête ou la section principale. L'inscription se fait par email/mot de passe ou via Google.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-lg font-semibold text-foreground hover:text-primary transition-colors duration-200">MeetApp est-il gratuit ?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">Oui, MeetApp propose une version gratuite avec des fonctionnalités de base. Des plans payants avec des fonctionnalités avancées pour les équipes et les entreprises seront disponibles prochainement.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-lg font-semibold text-foreground hover:text-primary transition-colors duration-200">Comment la sécurité de mes données est-elle assurée ?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">MeetApp utilise le cryptage de bout en bout pour toutes les communications et stocke vos données sur des serveurs sécurisés. Nous nous engageons à protéger votre vie privée et la confidentialité de vos échanges.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger className="text-lg font-semibold text-foreground hover:text-primary transition-colors duration-200">Puis-je inviter des personnes qui ne sont pas inscrites sur MeetApp ?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">Oui, lorsque vous ajoutez un contact, si son email n'existe pas dans notre système, vous avez la possibilité de lui envoyer un lien d'invitation par email pour qu'il puisse rejoindre MeetApp et devenir l'un de vos contacts.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="relative overflow-hidden py-24 bg-gradient-to-tl from-teal-50/50 to-background z-10 animate-fade-in-up">
        <div className="absolute inset-0 bg-gradient-main opacity-5"></div>
        <div className="container mx-auto px-6 text-center relative z-20">
          <h3 className="text-5xl md:text-6xl font-extrabold mb-6 text-foreground">
            Prêt à transformer vos <span className="text-primary">réunions ?</span>
          </h3>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Rejoignez des milliers d'entreprises qui font confiance à MeetApp et découvrez une nouvelle façon de collaborer.
          </p>
          <Link to="/register">
            <Button size="lg" className="text-lg px-10 h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transform transition-transform hover:scale-105">
              Créer un compte gratuitement
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 relative z-10">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-muted-foreground">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-blue-500 rounded-lg flex items-center justify-center shadow-md">
                <Video className="h-6 w-6 text-primary-foreground" />
              </div>
              <h4 className="text-2xl font-bold text-foreground">MeetApp</h4>
            </div>
            <p className="text-sm">Votre partenaire pour des communications fluides et sécurisées.</p>
            <p className="text-sm">&copy; {new Date().getFullYear()} MeetApp. Tous droits réservés.</p>
          </div>

          <div className="space-y-4 text-center md:text-left">
            <h4 className="text-lg font-semibold text-foreground">Navigation rapide</h4>
            <ul className="space-y-2">
              <li><a href="#about" className="hover:text-primary transition-colors">À propos</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Fonctionnalités</a></li>
              <li><a href="#testimonials" className="hover:text-primary transition-colors">Témoignages</a></li>
              <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div className="space-y-4 text-center md:text-left">
            <h4 className="text-lg font-semibold text-foreground">Contactez-nous</h4>
            <ul className="space-y-2">
              <li><a href="mailto:nepturnelangojordan@mail.com" className="hover:text-primary transition-colors">Email: nepturnelangojordan@mail.com</a></li>
              <li>Téléphone: +1 234 567 890 (Exemple)</li>
              <li>Adresse: 123 Rue de l'Innovation, Ville, Pays (Exemple)</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
