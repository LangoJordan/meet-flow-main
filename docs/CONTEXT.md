# CONTEXTE GLOBAL DU PROJET — Version explicative

**But :** Application web de communication regroupant gestion de contacts, messagerie et appels audio/vidéo (via Zego Cloud), construite autour de Firebase pour l’authentification et la persistance des données.

## 1. Authentification des utilisateurs

- **Méthodes prises en charge :** Email + mot de passe et connexion via Google.
- **Gestion :** Firebase Authentication assure la création de comptes, la connexion/déconnexion, la gestion de session et la récupération de l’identifiant unique (UID).
- **Rôle de l’UID :** L’UID Firebase est la clé centrale identifiant chaque utilisateur et est utilisée pour lier toutes les données de l’utilisateur (contacts, appels, invitations, etc.).

## 2. Gestion des contacts

- **Fonctionnalités :** Ajouter, éditer, supprimer et afficher des contacts.
- **Processus d’ajout :** L’utilisateur remplit un formulaire (nom, email, téléphone). Si l’email correspond à un compte existant dans Firebase Authentication, on récupère son UID réel.
- **Structure des données :** Chaque contact en Firestore contient un lien vers l’UID de la personne (si disponible) et est associé au créateur via `creatorId`. Ainsi, chaque utilisateur ne voit que ses propres contacts.

## 3. Présence et messagerie

- **États de présence :** En ligne, hors ligne, occupé — mis à jour dynamiquement pour refléter la disponibilité des contacts.
- **Extensibilité :** Architecture prête à évoluer vers une messagerie textuelle entre utilisateurs (threads, historique, notifications).

## 4. Appels audio/vidéo (Zego Cloud)

- **Rôle de Zego Cloud :** Fournir l’infrastructure temps réel pour les flux audio et vidéo, la création et la gestion des rooms, la gestion réseau et les flux média.
- **Flux d’appel :** Lorsqu’un utilisateur initie un appel, une room Zego est créée ; les participants rejoignent la room avec leur UID Firebase. L’application initialise la session avec les paramètres Zego nécessaires ; Zego gère la transmission et la synchronisation des flux.
- **Limitation côté app :** L’application se limite à l’initialisation et à la configuration de l’appel (identifiants, room, permissions) — la gestion technique des médias est déléguée à Zego.

## 5. Base de données (Firestore)

- **Collections typiques :** `contacts`, `invitations`, `calls`, etc.
- **Principes de sécurité et d’accès :** Chaque document est lié à un UID — les règles de sécurité Firestore doivent garantir qu’un utilisateur n’accède qu’à ses propres données.
- **Conception :** Structuration des données pour permettre les interactions (ajout, invitation, appel) tout en respectant la confidentialité et les permissions.

## 6. Architecture logique

- **Principaux blocs :** Contexte d’authentification (gestion de l’utilisateur connecté), pages (liste de contacts, formulaire, interface d’appel), et composants réutilisables (formulaires, listes, modales).
- **Flux global :** Authentification → accès aux contacts et actions utilisateur → initiation/join d’appels via Zego → enregistrement et coordination des métadonnées d’appel dans Firestore.
- **Responsabilité des services :** Firebase = backend (auth + DB + sessions + notifications potentielles). Zego = temps réel média.

## Prochaines étapes recommandées

- **Intégration du document :** Copier ce contenu dans `README.md` ou laisser en `docs/CONTEXT.md`. Je l’ai placé dans `docs/CONTEXT.md` pour éviter d’alourdir le README.
- **Diagrammes :** Ajouter un diagramme ER pour Firestore et un diagramme de flux d’appel Zego pour clarifier l’architecture.
- **Règles Firestore :** Rédiger des règles de sécurité Firestore basées sur l’UID pour restreindre l’accès aux documents utilisateurs.

Si tu veux, je peux aussi : ajouter ce contenu au `README.md`, créer les diagrammes suggérés ou générer un brouillon de règles Firestore.
