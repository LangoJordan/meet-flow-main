# MeetFlow

**Plateforme moderne de visioconférence et de collaboration d’équipe.**

---

## Présentation

MeetFlow est une solution tout-en-un pour organiser, planifier et animer des réunions vidéo en temps réel. Conçue pour les équipes modernes, elle combine simplicité d’utilisation, sécurité et fonctionnalités avancées pour fluidifier la communication à distance.

---

## Fonctionnalités clés

*   **Gestion des Réunions :**
    *   Création et planification simplifiée des réunions.
    *   Invitations personnalisées avec liens directs.
    *   Gestion des réunions récurrentes.
*   **Visioconférence :**
    *   Visioconférence HD grâce à l'intégration de ZegoCloud.
    *   Partage d'écran.
    *   Chat intégré pour faciliter la communication.
*   **Gestion des Rôles et Contrôles :**
    *   Gestion des rôles (organisateur, co-organisateur, participant).
    *   Contrôles avancés pour l'organisateur (activer/désactiver le micro et la caméra des participants, suppression de participants).
*   **Sécurité et Confidentialité :**
    *   Réunions privées avec vérification d'invitation.
    *   Authentification sécurisée (email, Google).
*   **Expérience Utilisateur :**
    *   Contacts et carnet d'adresses intégrés.
    *   Notifications par email pour les invitations et rappels.
    *   Tableau de bord centralisé pour une vue d'ensemble.
    *   Mode sombre/clair pour un confort visuel optimal.
    *   Présence en ligne et statut de visibilité des contacts.

---

## Stack technique

*   **Frontend :**
    *   React 18 : Bibliothèque JavaScript pour la construction d'interfaces utilisateur.
    *   TypeScript : Sur-ensemble de JavaScript ajoutant le typage statique.
    *   Vite : Outil de build rapide pour le développement frontend.
*   **UI :**
    *   Tailwind CSS : Framework CSS utilitaire pour un développement rapide.
    *   shadcn/ui : Bibliothèque de composants React stylisés avec Tailwind CSS.
*   **Visioconférence :** ZegoCloud UIKit Prebuilt : SDK pour intégrer facilement la visioconférence.
*   **Backend :**
    *   Node.js : Environnement d'exécution JavaScript côté serveur.
    *   Express : Framework pour simplifier la création d'API Node.js.
*   **Base de données :** Firestore (Firebase) : Base de données NoSQL cloud.
*   **Authentification :** Firebase Auth : Service d'authentification fourni par Firebase.
*   **Emails :** Nodemailer : Module Node.js pour l'envoi d'emails.
*   **Notifications :** Sonner (toast) : Bibliothèque pour afficher des notifications toast.
*   **Routing :** React Router : Bibliothèque pour la gestion de la navigation dans l'application.
*   **Gestion d’état :** Context API + TanStack Query : Pour la gestion de l'état de l'application et la récupération des données.

---

## Prérequis

Avant de commencer, assurez-vous d'avoir installé et configuré les éléments suivants :

*   Node.js (version 18 ou supérieure) et npm (ou yarn).
*   Un compte Firebase avec Firestore et Firebase Authentication configurés.
*   Un compte ZegoCloud avec un App ID et un Server Secret.
*   Un service SMTP pour l'envoi d'emails (par exemple, Gmail avec un mot de passe d'application).

---

## Installation

Suivez ces étapes pour installer et configurer MeetFlow :

1.  **Cloner le dépôt GitHub :**

    ```bash
    git clone <LangoJordan/meet-flow-main>
    cd meet-flow-main
    ```

2.  **Installer les dépendances :**

    ```bash
    npm install
    ```

3.  **Configurer les variables d'environnement :**

    *   Copiez le fichier `.env.example` vers `.env` :

        ```bash
        cp .env.example .env
        ```

    *   Modifiez le fichier `.env` avec vos clés et informations :

        ```env
        # ZegoCloud
        VITE_ZEGO_APP_ID=VOTRE_APP_ID
        VITE_ZEGO_SERVER_SECRET=VOTRE_SERVER_SECRET

        # Backend (emails)
        MAIL_HOST=smtp.gmail.com
        MAIL_PORT=465
        MAIL_USERNAME=votre_email@gmail.com
        MAIL_PASSWORD=votre_mot_de_passe_application
        MAIL_ENCRYPTION=ssl
        MAIL_FROM_ADDRESS=votre_email@gmail.com
        ```

4.  **Obtenir les clés ZegoCloud :**

    *   Créez un compte sur [ZegoCloud](https://www.zegocloud.com/).
    *   Créez un projet dans le tableau de bord ZegoCloud.
    *   Dans la section "Project Management", récupérez l'**App ID** et le **Server Secret**.
    *   Ajoutez ces informations dans votre fichier `.env`.

5.  **Configurer les emails (Gmail SMTP) :**

    *   Activez la "Validation en deux étapes" sur votre compte Google.
    *   Allez dans "Sécurité" > "Mots de passe des applications".
    *   Générez un mot de passe pour "Mail".
    *   Utilisez ce mot de passe dans la variable `MAIL_PASSWORD` de votre fichier `.env`.

6.  **Lancer le projet :**

    ```bash
    npm run dev
    ```

7.  **Ouvrez l'application dans votre navigateur :**

    Ouvrez [http://localhost:5173](http://localhost:5173) dans votre navigateur.

8.  **Inscrivez-vous ou connectez-vous :**

    Créez un compte ou connectez-vous avec Google.

9.  **Créez une réunion et testez :**

    Explorez les fonctionnalités de MeetFlow en créant une réunion et en invitant des participants.

---

## Contribution

Les contributions sont les bienvenues ! Si vous souhaitez contribuer à MeetFlow, veuillez consulter le guide de contribution.

---

## Licence

Ce projet est sous licence [MIT License](LICENSE)."# meet-flow-main" 
