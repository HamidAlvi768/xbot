// tweet.js
// Standalone script to post a tweet using Twitter API v2 and Google Gemini
// For use with GitHub Actions or any scheduler

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { default: TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

// --- CONFIGURATION ---
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_REFRESH_TOKEN = process.env.TWITTER_REFRESH_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET || !TWITTER_REFRESH_TOKEN || !GEMINI_API_KEY) {
  console.error('Please set TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_REFRESH_TOKEN, and GEMINI_API_KEY in your environment or .env file.');
  process.exit(1);
}

const twitterClient = new TwitterApi({
  clientId: TWITTER_CLIENT_ID,
  clientSecret: TWITTER_CLIENT_SECRET,
});
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function main() {
  try {
    // Refresh Twitter token
    const { client, accessToken, refreshToken: newRefreshToken } = await twitterClient.refreshOAuth2Token(TWITTER_REFRESH_TOKEN);
    console.log('Twitter token refreshed.');

    // Generate tweet with Gemini
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });
    const prompt = 'Tweet something cool for #techtwitter';
    let tweetText = '';
    try {
      const result = await model.generateContent(prompt);
      tweetText = result.response.text();
      console.log('Generated tweet:', tweetText);
    } catch (err) {
      console.error('Gemini error:', err.message);
      process.exit(1);
    }

    // Post tweet
    const { data } = await client.v2.tweet(tweetText);
    console.log('Tweet posted:', data);

    // Optionally, print the new refresh token for updating secrets
    if (newRefreshToken && newRefreshToken !== TWITTER_REFRESH_TOKEN) {
      console.log('New refresh token:', newRefreshToken);
    }
  } catch (err) {
    console.error('Tweet error:', err.message);
    process.exit(1);
  }
}

main(); 