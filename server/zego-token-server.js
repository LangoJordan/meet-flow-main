import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import fs from 'fs';
import nodemailer from 'nodemailer';
import pkg from '@zegocloud/zego-uikit-prebuilt';
const { ZegoUIKitPrebuilt } = pkg;

dotenv.config();

// Firebase Admin for Firestore
let admin;
let firebaseInitialized = false;
try {
  admin = await import('firebase-admin');
  let cred;
  // Accept service account JSON string in env or as path
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (svcJson) {
    const obj = JSON.parse(svcJson);
    cred = admin.credential.cert(obj);
  } else if (svcPath && fs.existsSync(svcPath)) {
    cred = admin.credential.cert(require(svcPath));
  } else {
    console.warn('No Firebase service account provided. Signaling disabled.');
  }

  if (cred) {
    admin.initializeApp({ credential: cred });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized for signaling');
  }
} catch (e) {
  console.warn('firebase-admin not available, signaling endpoint will be disabled', e);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

// Configure nodemailer transporter using MAIL_* env variables
const mailHost = process.env.MAIL_HOST;
const mailPort = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 465;
const mailUser = process.env.MAIL_USERNAME;
const mailPass = process.env.MAIL_PASSWORD;
const mailFrom = process.env.MAIL_FROM_ADDRESS || mailUser;

/** @type {import('nodemailer').Transporter | null} */
let mailTransporter = null;

if (mailHost && mailUser && mailPass) {
  mailTransporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailPort === 465, // true for 465, false for others
    auth: {
      user: mailUser,
      pass: mailPass,
    },
  });

  mailTransporter.verify().then(() => {
    console.log('SMTP mail transporter ready');
  }).catch((err) => {
    console.warn('SMTP mail transporter verification failed', err);
  });
} else {
  console.warn('MAIL_* environment variables not fully configured. Email sending will be disabled.');
}

// ZegoCloud token endpoint
app.post('/api/zego-token', (req, res) => {
  try {
    const { roomId, userId, userName } = req.body || {};

    if (!roomId || !userId || !userName) {
      return res.status(400).json({ error: 'roomId, userId, userName are required' });
    }

    const appID = Number(process.env.VITE_ZEGO_APP_ID);
    const serverSecret = process.env.VITE_ZEGO_SERVER_SECRET;

    if (!appID || !serverSecret) {
      console.error('Missing ZegoCloud credentials: VITE_ZEGO_APP_ID or VITE_ZEGO_SERVER_SECRET');
      return res.status(500).json({ error: 'Missing ZegoCloud credentials on server' });
    }

    const token = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomId,
      String(userId),
      String(userName),
    );

    return res.json({ token });
  } catch (err) {
    console.error('Error generating Zego token:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Account deactivation endpoint
// Deactivates a user account in Firebase Auth
app.post('/api/deactivate-account', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const adminAuth = admin.auth();

    // Disable the user account in Firebase Auth
    await adminAuth.updateUser(uid, {
      disabled: true,
    });

    console.log('Account deactivated for user:', uid);
    return res.json({ success: true, message: 'Account deactivated successfully' });
  } catch (err) {
    console.error('Error deactivating account:', err);
    if (err.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Email invitations endpoint
// Expects body: { invitations: [{ toEmail, toName, meetingTitle, meetingDescription, begin, roomUrl }] }
app.post('/api/send-invitations-email', async (req, res) => {
  try {
    if (!mailTransporter) {
      return res.status(500).json({ error: 'Email sending is not configured on the server' });
    }

    const { invitations } = req.body || {};
    if (!Array.isArray(invitations) || invitations.length === 0) {
      return res.status(400).json({ error: 'invitations array is required' });
    }

    const sendPromises = invitations.map((inv) => {
      if (!inv.toEmail) return Promise.resolve(null);

      const subject = `Invitation à la réunion : ${inv.meetingTitle || 'Réunion Meet-Flow'}`;
      const beginStr = inv.begin ? new Date(inv.begin).toLocaleString('fr-FR') : 'bientôt';
      const url = inv.roomUrl || inv.joinUrl || '';

      const text = [
        `Bonjour ${inv.toName || ''}`.trim(),
        '',
        `Vous êtes invité(e) à la réunion "${inv.meetingTitle || 'Réunion'}".`,
        inv.meetingDescription ? `Description : ${inv.meetingDescription}` : '',
        `Date/heure : ${beginStr}`,
        url ? `Lien pour rejoindre la réunion : ${url}` : 'Le lien de réunion vous sera communiqué ultérieurement.',
        '',
        'Cet email a été envoyé automatiquement par Meet-Flow.',
      ].join('\n');

      if (!mailTransporter) {
        return Promise.resolve(null);
      }

      return mailTransporter.sendMail({
        from: mailFrom,
        to: inv.toEmail,
        subject,
        text,
      }).catch((err) => {
        console.warn('Failed to send invitation email to', inv.toEmail, err);
        return null;
      });
    });

    await Promise.all(sendPromises);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error sending invitation emails:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// WebRTC Signaling Server using Firebase Firestore

// Create offer
app.post('/api/webrtc/offer', async (req, res) => {
  try {
    const { roomId, offer, callerId, calleeId } = req.body;
    if (!roomId || !offer || !callerId || !calleeId) {
      return res.status(400).json({ error: 'roomId, offer, callerId, calleeId required' });
    }

    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const db = admin.firestore();
    await db.collection('webrtc_signaling').doc(roomId).set({
      offer,
      callerId,
      calleeId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Offer created for room:', roomId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get offer
app.get('/api/webrtc/offer/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const db = admin.firestore();
    const doc = await db.collection('webrtc_signaling').doc(roomId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(doc.data());
  } catch (error) {
    console.error('Error getting offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create answer
app.post('/api/webrtc/answer', async (req, res) => {
  try {
    const { roomId, answer } = req.body;
    if (!roomId || !answer) {
      return res.status(400).json({ error: 'roomId and answer required' });
    }

    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const db = admin.firestore();
    await db.collection('webrtc_signaling').doc(roomId).update({
      answer,
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Answer created for room:', roomId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add ICE candidate
app.post('/api/webrtc/ice', async (req, res) => {
  try {
    const { roomId, candidate, from } = req.body;
    if (!roomId || !candidate || !from) {
      return res.status(400).json({ error: 'roomId, candidate, from required' });
    }

    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const db = admin.firestore();
    const iceRef = db.collection('webrtc_signaling').doc(roomId).collection('ice_candidates').doc();
    await iceRef.set({
      candidate,
      from,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('ICE candidate added for room:', roomId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ICE candidates
app.get('/api/webrtc/ice/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('webrtc_signaling').doc(roomId).collection('ice_candidates').get();

    const candidates = [];
    snapshot.forEach(doc => {
      candidates.push(doc.data());
    });

    res.json({ candidates });
  } catch (error) {
    console.error('Error getting ICE candidates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`WebRTC signaling server listening on http://localhost:${PORT}`);
});
