// local-bot.js
// Standalone Twitter bot using Express, Twitter API v2, and Google Gemini
// No Firebase/Cloud Functions required

const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { default: TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
// Set these in a .env file or your environment
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET || !GEMINI_API_KEY) {
  console.error('Please set TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, and GEMINI_API_KEY in your environment or .env file.');
  process.exit(1);
}

const twitterClient = new TwitterApi({
  clientId: TWITTER_CLIENT_ID,
  clientSecret: TWITTER_CLIENT_SECRET,
});
const callbackURL = `http://localhost:${PORT}/callback`;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- TOKEN STORAGE ---
const tokenFile = path.join(__dirname, 'tokens.json');
console.log('Token file location:', tokenFile);

function saveTokens(newTokens) {
  let tokens = {};
  if (fs.existsSync(tokenFile)) {
    try {
      tokens = JSON.parse(fs.readFileSync(tokenFile));
    } catch (e) {
      console.error('Error reading tokens.json:', e);
    }
  }
  const merged = { ...tokens, ...newTokens };
  fs.writeFileSync(tokenFile, JSON.stringify(merged, null, 2));
  fs.fsyncSync(fs.openSync(tokenFile, 'r+'));
  console.log('Tokens saved:', merged);
}
function loadTokens() {
  if (!fs.existsSync(tokenFile)) {
    console.log('tokens.json does not exist');
    return {};
  }
  try {
    const raw = fs.readFileSync(tokenFile);
    console.log('Raw token file contents:', raw.toString());
    const tokens = JSON.parse(raw);
    console.log('Tokens loaded:', tokens);
    return tokens;
  } catch (e) {
    console.error('Error reading tokens.json:', e);
    return {};
  }
}

// --- ROUTES ---
// Step 1: Twitter OAuth2 Auth
app.get('/auth', async (req, res) => {
  try {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      callbackURL,
      { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
    );
    saveTokens({ codeVerifier, state });
    res.redirect(url);
  } catch (err) {
    res.status(500).send('Error generating auth link: ' + err.message);
  }
});

// Step 2: Twitter OAuth2 Callback
app.get('/callback', async (req, res) => {
  console.log('Callback hit. Query params:', req.query);
  try {
    const { state, code } = req.query;
    if (!state || !code) {
      console.error('Missing state or code in callback:', req.query);
      return res.status(400).send('Missing state or code in callback. Please restart the authentication flow.');
    }
    const { codeVerifier, state: storedState } = loadTokens();
    if (!codeVerifier || !storedState) {
      console.error('No verifier/state stored. Start with /auth.');
      return res.status(400).send('No verifier/state stored. Start with /auth.');
    }
    if (state !== storedState) {
      console.error('State mismatch:', state, storedState);
      return res.status(400).send(`State mismatch. Got: ${state}, expected: ${storedState}. Delete tokens.json and restart from /auth.`);
    }
    const { client, accessToken, refreshToken } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackURL,
    });
    if (!refreshToken) {
      console.error('No refreshToken received from Twitter.');
      return res.status(500).send('No refreshToken received from Twitter.');
    }
    saveTokens({ accessToken, refreshToken });
    console.log('Verifying saved tokens:', loadTokens());
    res.send('Authenticated! You can now <a href="/tweet">/tweet</a>');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Callback error: ' + err.message);
  }
});

// Step 3: Generate and Post Tweet
app.get('/tweet', async (req, res) => {
  try {
    const tokens = loadTokens();
    console.log('/tweet tokens:', tokens);
    const { refreshToken } = tokens;
    if (!refreshToken) {
      console.error('No refreshToken found in tokens.json.');
      return res.status(400).send('Not authenticated. Go to /auth first.');
    }
    const { client, accessToken, refreshToken: newRefreshToken } = await twitterClient.refreshOAuth2Token(refreshToken);
    saveTokens({ accessToken, refreshToken: newRefreshToken });

    // Generate tweet with Gemini
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });
    const prompt = 'Tweet something cool for #techtwitter';
    let tweetText = '';
    try {
      const result = await model.generateContent(prompt);
      tweetText = result.response.text();
      console.log('Raw Gemini output:', tweetText);
      
      // Clean and validate tweet text
      tweetText = tweetText.split('\n').find(line => line.trim().length > 0);
      tweetText = tweetText.replace(/[*_`>#-]/g, '').trim();
      
      if (!tweetText || tweetText.trim().length === 0) {
        console.error('Error: Gemini returned empty tweet text.');
        return res.status(500).send('Error: Generated tweet was empty. Please try again.');
      }
      
      if (tweetText.length > 280) {
        tweetText = tweetText.slice(0, 280);
      }
      
      console.log('Final tweet to post:', tweetText, 'Length:', tweetText.length);
    } catch (err) {
      console.error('Gemini error:', err);
      return res.status(500).send('Gemini error: ' + err.message);
    }

    // Post tweet
    const { data } = await client.v2.tweet(tweetText);
    console.log('Tweet posted successfully:', data);
    res.send(`<b>Tweet posted:</b><br>${tweetText}<br><pre>${JSON.stringify(data, null, 2)}</pre>`);
  } catch (err) {
    console.error('Tweet error:', err);
    res.status(500).send('Tweet error: ' + err.message);
  }
});

app.get('/', (req, res) => {
  res.send('<h2>Local Twitter Bot</h2><ul><li><a href="/auth">Authenticate with Twitter</a></li><li><a href="/tweet">Post a Tweet</a></li></ul>');
});

app.listen(PORT, () => {
  console.log(`Local Twitter bot running at http://localhost:${PORT}`);
  console.log('1. Go to /auth to authenticate.');
  console.log('2. Then go to /tweet to post a tweet.');
}); 