import crypto from 'crypto';

// Test ZegoCloud token generation
function generateZegoToken(appID, serverSecret, roomId, userId) {
  const version = '04';
  const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  // Create the signature string
  const signatureString = `${appID}${roomId}${userId}${timestamp}`;
  console.log('Signature string:', signatureString);

  const signature = crypto.createHmac('sha256', serverSecret)
    .update(signatureString)
    .digest('hex');

  console.log('Signature:', signature);

  // Create the token in ZegoCloud format: version:app_id:signature:timestamp
  const token = `${version}:${appID}:${signature}:${timestamp}`;

  return token;
}

// Test with your credentials
const appID = 795951145;
const serverSecret = 'abc70e69e640c7dd2953cb9ad2dcbbb4';
const roomId = 'test_room';
const userId = 'test_user';

console.log('Testing token generation...');
const token = generateZegoToken(appID, serverSecret, roomId, userId);
console.log('Generated token:', token);

// Test the API call
import fetch from 'node-fetch';

async function testAPI() {
  try {
    const response = await fetch('http://localhost:4000/api/zego-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId: roomId,
        userId: userId,
        userName: 'Test User',
      }),
    });

    const data = await response.json();
    console.log('API Response:', data);
    console.log('Tokens match:', token === data.token);
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

testAPI();
