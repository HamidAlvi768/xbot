const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Database reference
const dbRef = admin.firestore().doc('tokens/demo');

// Twitter API init
const TwitterApi = require('twitter-api-v2').default;
const twitterClient = new TwitterApi({
  clientId: 'Z0JOS29ZcS1vU1FSVHUwQVNRSTY6MTpjaQ',
  clientSecret: 'Q3rzAtg1UkYNHgNKnf_weZqdG5jNsLeKk7yUVkbyYLHSaoLn9l',
});

const callbackURL = 'http://127.0.0.1:5000/xbot-2025/us-central1/callback';

// Add Gemini API init
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);

// STEP 1 - Auth URL
exports.auth = functions.https.onRequest(async (request, response) => {
  const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
    callbackURL,
    { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
  );

  // store verifier
  await dbRef.set({ codeVerifier, state });

  response.redirect(url);
});

// STEP 2 - Verify callback code, store access_token 
exports.callback = functions.https.onRequest(async (request, response) => {
  const { state, code } = request.query;

  const dbSnapshot = await dbRef.get();
  const { codeVerifier, state: storedState } = dbSnapshot.data();

  if (state !== storedState) {
    return response.status(400).send('Stored tokens do not match!');
  }

  const {
    client: loggedClient,
    accessToken,
    refreshToken,
  } = await twitterClient.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: callbackURL,
  });

  await dbRef.set({ accessToken, refreshToken });

  const { data } = await loggedClient.v2.me(); // start using the client if you want

  response.send(data);
});

// STEP 3 - Refresh tokens and post tweets
exports.tweet = functions.https.onRequest(async (request, response) => {
  const { refreshToken } = (await dbRef.get()).data();

  const {
    client: refreshedClient,
    accessToken,
    refreshToken: newRefreshToken,
  } = await twitterClient.refreshOAuth2Token(refreshToken);

  await dbRef.set({ accessToken, refreshToken: newRefreshToken });

  // Gemini tweet generation
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const prompt = 'tweet something cool for #techtwitter';
  let tweetText = '';
  try {
    const result = await model.generateContent(prompt);
    tweetText = result.response.text();
  } catch (err) {
    return response.status(500).send('Gemini error: ' + err.message);
  }

  const { data } = await refreshedClient.v2.tweet(tweetText);

  response.send(data);
});
