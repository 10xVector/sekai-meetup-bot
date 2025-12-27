// index.js

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { config } = require('dotenv');
const OpenAI = require('openai');
const schedule = require('node-schedule');
const Parser = require('rss-parser');
// Image-card generation removed (no more PNG cards / background images)
const textToSpeech = require('@google-cloud/text-to-speech');
const https = require('https');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const os = require('os');

config();

// Global error handlers to help diagnose crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Optional: process.exit(1); // Many recommend exiting after uncaughtException
});

// Import modular components
const constants = require('./config/constants');
const { JAPANESE_VOICES, ENGLISH_VOICES, GEMINI_SPEAKERS } = require('./config/voices');
const ttsUtils = require('./utils/tts');
const quizModule = require('./modules/quiz');
const wordModule = require('./modules/word');
const grammarModule = require('./modules/grammar');
const smallTalkModule = require('./modules/smalltalk');
const { fetchChannelsByIds } = require('./utils/helpers');

// Initialize Google Cloud credentials from environment variable if available
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    // Debug: Log the first few characters of the credentials
    console.log('GOOGLE_CREDENTIALS starts with:', process.env.GOOGLE_CREDENTIALS.substring(0, 50));

    // Clean the credentials string
    const cleanedCredentials = process.env.GOOGLE_CREDENTIALS
      .trim()
      .replace(/,\s*,/g, ',')  // Remove double commas
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/{\s*,/g, '{')  // Remove leading commas
      .replace(/\n/g, '\\n');  // Properly escape newlines

    const credentials = JSON.parse(cleanedCredentials);

    // Create a temporary credentials file
    const tempDir = os.tmpdir();
    const credentialsPath = path.join(tempDir, 'google-credentials.json');
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

    // Set the environment variable to point to the credentials file
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

    console.log('Google Cloud credentials initialized successfully');
  } catch (error) {
    console.error('Error parsing GOOGLE_CREDENTIALS:', error.message);
    console.error('Please ensure GOOGLE_CREDENTIALS is a valid JSON string');
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,  // Add this for member-related features
    GatewayIntentBits.GuildPresences  // Add this for presence updates
  ]
});

// Store quiz data for answer revelation
const quizData = {
  japanese: { pollMessage: null, answer: null, explanation: null, channel: null },
  english: { pollMessage: null, answer: null, explanation: null, channel: null }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// Placeholder for quiz channel
// NOTE: All *_CHANNEL_ID env vars support comma-separated lists (e.g. "id1,id2,id3")
const USE_GEMINI_TTS = constants.USE_GEMINI_TTS;
const GOOGLE_TTS_MODEL_NAME = constants.GOOGLE_TTS_MODEL_NAME;
const GOOGLE_TTS_STYLE_PROMPT = constants.GOOGLE_TTS_STYLE_PROMPT;

// Available Japanese voices for rotation (Moved to config/voices.js)
// Available English voices for rotation (Moved to config/voices.js)
// Gemini-TTS "speaker" names (Moved to config/voices.js)

// Emoji reactions for quiz options (Moved to config/constants.js)
const REACTIONS = constants.REACTIONS;

// Helpers moved to utils/helpers.js
const { parseChannelIdList } = constants;

// TTS utilities are now imported from src/utils/tts.js
const { getTTSBuffer, getTTSBufferDebug, getTTSBufferForLongText, getTTSBufferWithVoice } = ttsUtils;

// Wrapper for English version for backward compatibility
const getEnglishTTSBuffer = (text) => getTTSBuffer(text, 'en-US');
const getEnglishTTSBufferDebug = (text) => getTTSBufferDebug(text, 'en-US');
const getEnglishTTSBufferWithVoice = (text, voice) => getTTSBufferWithVoice(text, voice);


// Helper function to parse reminder command
function parseReminderCommand(content) {
  const args = content.split(' ').filter(arg => arg.length > 0);

  if (args.length < 3) {
    return { error: 'Usage: !reminder <channel_id> <meetup_link> "date time" [title] [timezone]\nExample: !reminder 123456789 https://meetup.com/group/events/123 "2024-01-15 18:00" "Monthly Meetup" "PST"' };
  }

  const channelId = args[1];
  const meetupLink = args[2];

  // Basic validation for channel ID (Discord IDs are numeric strings)
  if (!/^\d+$/.test(channelId)) {
    return { error: 'Invalid channel ID. Please provide a valid numeric channel ID.' };
  }

  // Basic validation for meetup link
  if (!meetupLink.startsWith('http')) {
    return { error: 'Invalid meetup link. Please provide a valid URL.' };
  }

  // Extract optional date/time, title, and timezone from quoted strings
  let dateTime = null;
  let title = null;
  let timezone = 'JST'; // Default timezone

  // Join the rest of the args and look for quoted strings
  const restOfCommand = args.slice(3).join(' ');
  const quotedStrings = restOfCommand.match(/"([^"]+)"/g);

  if (quotedStrings && quotedStrings.length > 0) {
    // First quoted string is date/time
    dateTime = quotedStrings[0].replace(/"/g, '');

    // Second quoted string (if exists) is title
    if (quotedStrings.length > 1) {
      title = quotedStrings[1].replace(/"/g, '');
    }

    // Third quoted string (if exists) is timezone
    if (quotedStrings.length > 2) {
      timezone = quotedStrings[2].replace(/"/g, '');
    }
  }

  return { channelId, meetupLink, dateTime, title, timezone };
}


// Helper function to fetch meetup event details
async function fetchMeetupEventDetails(meetupLink) {
  try {
    // Extract meetup.com event ID from various URL formats
    // Examples: 
    // https://www.meetup.com/group-name/events/123456789/
    // https://meetup.com/group-name/events/123456789
    // https://www.meetup.com/meetup-group-name/events/123456789/?eventId=123456789

    const meetupUrlPattern = /meetup\.com\/([^\/]+)\/events\/(\d+)/i;
    const match = meetupLink.match(meetupUrlPattern);

    if (!match) {
      return { error: 'Invalid Meetup URL format. Please provide a valid Meetup event link.' };
    }

    const groupName = match[1];
    const eventId = match[2];

    // For now, we'll return a structure that allows manual date/time input
    // In production, you would:
    // 1. Use Meetup API with proper authentication
    // 2. Or use a web scraping library like puppeteer
    // 3. Or require users to manually provide date/time

    return {
      title: `Event from ${groupName}`,
      date: null, // Will need to be provided manually
      description: 'Meetup Event',
      location: 'See event page for details',
      eventId: eventId,
      groupName: groupName,
      needsManualDate: true
    };

  } catch (error) {
    console.error('Error parsing meetup URL:', error);
    return { error: 'Failed to parse Meetup URL. Please check the URL and try again.' };
  }
}

client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  // Voice testing helpers
  // - !voicetest -> sends one English + one Japanese MP3 sample
  // - !tts <en|ja> <text> -> synthesizes the provided text
  if (message.content === '!voicetest') {
    try {
      const enText = 'Hello! This is a voice test for Sekai Buddy.';
      const jaText = 'こんにちは！これはセカイバディの音声テストです。';

      const enResult = await getEnglishTTSBufferDebug(enText);
      const jaResult = await getTTSBufferDebug(jaText);

      const enAttachment = new AttachmentBuilder(enResult.audioBuffer, { name: 'voice-test-en.mp3' });
      const jaAttachment = new AttachmentBuilder(jaResult.audioBuffer, { name: 'voice-test-ja.mp3' });

      await message.reply({
        content:
          `🎧 Voice test\n` +
          `EN: ${enResult.meta.mode}${enResult.meta.modelName ? ` (${enResult.meta.modelName})` : ''} voice=${enResult.meta.voiceName || enResult.meta.fallbackVoiceName || 'unknown'}\n` +
          `JA: ${jaResult.meta.mode}${jaResult.meta.modelName ? ` (${jaResult.meta.modelName})` : ''} voice=${jaResult.meta.voiceName || jaResult.meta.fallbackVoiceName || 'unknown'}\n` +
          (enResult.meta.mode === 'chirp_fallback' || jaResult.meta.mode === 'chirp_fallback'
            ? `⚠️ Fallback happened.\nGemini error: ${(enResult.meta.errorMessage || jaResult.meta.errorMessage || '').slice(0, 180)}`
            : `✅ No fallback detected.`),
        files: [enAttachment, jaAttachment]
      });
    } catch (err) {
      console.error('Error running !voicetest:', err);
      await message.reply('Sorry — voice test failed. Check bot logs for the exact TTS error.');
    }
  }

  if (message.content.startsWith('!tts ')) {
    try {
      const parts = message.content.split(' ');
      const lang = (parts[1] || '').toLowerCase();
      const text = parts.slice(2).join(' ').trim();

      if (!text) {
        return message.reply('Usage: `!tts en Hello world` or `!tts ja こんにちは`');
      }

      const result = lang === 'ja' ? await getTTSBufferDebug(text) : await getEnglishTTSBufferDebug(text);
      const attachment = new AttachmentBuilder(result.audioBuffer, { name: `tts-${lang === 'ja' ? 'ja' : 'en'}.mp3` });
      await message.reply({
        content:
          `TTS: ${result.meta.mode}${result.meta.modelName ? ` (${result.meta.modelName})` : ''} ` +
          `voice=${result.meta.voiceName || result.meta.fallbackVoiceName || 'unknown'}` +
          (result.meta.mode === 'chirp_fallback' && result.meta.errorMessage
            ? `\nGemini error: ${String(result.meta.errorMessage).slice(0, 180)}`
            : ``),
        files: [attachment]
      });
    } catch (err) {
      console.error('Error running !tts:', err);
      await message.reply('Sorry — TTS failed. Check bot logs for the exact error.');
    }
  }

  if (message.content === '!smalltalk') {
    try {
      const reply = await smallTalkModule.generateSmallTalk(openai);
      await smallTalkModule.sendSmallTalk(message.channel, reply);
    } catch (err) {
      console.error('Error in !smalltalk command:', err);
      await message.reply('Failed to generate small talk.');
    }
  }

  if (message.content === '!meetups') {
    const events = await fetchMeetupEvents();

    if (events.length === 0) {
      return message.reply('No upcoming meetups scheduled!');
    }

    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle('📅 Upcoming Meetups')
      .setDescription(events.map(meetup =>
        `**${meetup.title}**\n📅 ${new Date(meetup.date).toLocaleString()}\n📍 ${meetup.location}\n🔗 [View on Meetup](${meetup.link})\n`
      ).join('\n'));

    message.reply({ embeds: [embed] });
  }

  if (message.content === '!sync') {
    message.reply('Syncing Meetup events...');
    const events = await syncMeetupEvents(message.channel.id);
    message.reply(`✅ Found ${events.length} upcoming events! Reminders will be sent 1 hour before each event.`);
  }

  if (message.content === '!quiz' || message.content === '!forcescheduledquiz') {
    try {
      const quiz = await quizModule.generateComprehensionQuiz(openai, 'japanese');
      await quizModule.sendQuiz(quiz, message.channel, quizData, false);
    } catch (err) {
      console.error('Error in !quiz command:', err);
      message.reply('Sorry, something went wrong while generating the quiz.');
    }
  }

  if (message.content === '!forcescheduledsmalltalk') {
    try {
      const reply = await smallTalkModule.generateSmallTalk(openai);
      for (const channelId of constants.SMALLTALK_CHANNEL_IDS) {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
          await smallTalkModule.sendSmallTalk(channel, reply);
        }
      }
      message.reply('✅ Weekly smalltalk has been sent to all configured channels!');
    } catch (err) {
      console.error('Error in !forcescheduledsmalltalk command:', err);
    }
  }

  if (message.content === '!word') {
    try {
      await wordModule.sendJapaneseWord(message.channel, openai);
    } catch (err) {
      console.error('Error in !word command:', err);
      await message.reply('Failed to generate word of the day.');
    }
  }

  if (message.content === '!grammar') {
    try {
      await grammarModule.sendJapaneseGrammar(message.channel, openai);
    } catch (err) {
      console.error('Error in !grammar command:', err);
      await message.reply('Failed to generate grammar point of the day.');
    }
  }

  if (message.content === '!forcescheduledjapaneseword') {
    try {
      const channelIds = parseChannelIdList(constants.JAPANESE_WORD_CHANNEL_ID);
      const channels = await fetchChannelsByIds(client, channelIds);
      const targetChannel = channels.length > 0 ? channels[0] : message.channel;
      await wordModule.sendJapaneseWord(targetChannel, openai);
    } catch (err) {
      console.error('Error in !forcescheduledjapaneseword command:', err);
    }
  }

  if (message.content === '!forcescheduledenglishword') {
    try {
      const channelIds = parseChannelIdList(constants.ENGLISH_WORD_CHANNEL_ID);
      const channels = await fetchChannelsByIds(client, channelIds);
      const targetChannel = channels.length > 0 ? channels[0] : message.channel;
      await wordModule.sendEnglishWord(targetChannel, openai);
    } catch (err) {
      console.error('Error in !forcescheduledenglishword command:', err);
    }
  }

  if (message.content === '!forcescheduledjapanesegrammar') {
    try {
      const channelIds = parseChannelIdList(constants.JAPANESE_GRAMMAR_CHANNEL_ID);
      const channels = await fetchChannelsByIds(client, channelIds);
      const targetChannel = channels.length > 0 ? channels[0] : message.channel;
      await grammarModule.sendJapaneseGrammar(targetChannel, openai);
    } catch (err) {
      console.error('Error in !forcescheduledjapanesegrammar command:', err);
    }
  }

  if (message.content === '!englishgrammar') {
    try {
      await grammarModule.sendEnglishGrammar(message.channel, openai);
    } catch (err) {
      console.error('Error in !englishgrammar command:', err);
      await message.reply('Failed to generate English grammar point.');
    }
  }

  if (message.content === '!forcescheduledenglishgrammar') {
    try {
      const channelIds = parseChannelIdList(constants.ENGLISH_GRAMMAR_CHANNEL_ID);
      const channels = await fetchChannelsByIds(client, channelIds);
      const targetChannel = channels.length > 0 ? channels[0] : message.channel;
      await grammarModule.sendEnglishGrammar(targetChannel, openai);
    } catch (err) {
      console.error('Error in !forcescheduledenglishgrammar command:', err);
    }
  }

  if (message.content === '!englishquiz') {
    try {
      const quiz = await quizModule.generateComprehensionQuiz(openai, 'english');
      await quizModule.sendQuiz(quiz, message.channel, quizData, true);
    } catch (err) {
      console.error('Error in !englishquiz command:', err);
      await message.reply('Failed to generate English quiz.');
    }
  }

  if (message.content === '!forcescheduledenglishquiz') {
    try {
      const quiz = await generateComprehensionQuiz('english');
      const channel = client.channels.cache.get(ENGLISH_QUIZ_CHANNEL_ID);
      if (!channel) {
        console.error('English quiz channel not found:', ENGLISH_QUIZ_CHANNEL_ID);
        return;
      }
      await sendQuiz(quiz, channel, true);
    } catch (err) {
      console.error('Error generating forced scheduled English quiz:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled English quiz.');
    }
  }

  if (message.content === '!forcescheduledjapanesequiz') {
    try {
      const quiz = await quizModule.generateComprehensionQuiz(openai, 'japanese');
      const channel = client.channels.cache.get(JAPANESE_QUIZ_CHANNEL_ID);
      if (!channel) return;
      await quizModule.sendQuiz(quiz, channel, quizData, false);
    } catch (err) {
      console.error('Error in !forcescheduledjapanesequiz command:', err);
    }
  }

  if (message.content === '!revealjapanesequiz') {
    try {
      await quizModule.revealPreviousQuizAnswer(quizData, 'japanese');
      message.reply('✅ Previous Japanese quiz answer revealed!');
    } catch (err) {
      console.error('Error revealing Japanese quiz answer:', err);
    }
  }

  if (message.content === '!revealenglishquiz') {
    try {
      await quizModule.revealPreviousQuizAnswer(quizData, 'english');
      message.reply('✅ Previous English quiz answer revealed!');
    } catch (err) {
      console.error('Error revealing English quiz answer:', err);
    }
  }

  if (message.content.startsWith('!send')) {
    try {
      const args = message.content.split(' ');
      if (args.length < 3) {
        return message.reply('Usage: !send <channel_id> <message>');
      }

      const channelId = args[1];
      const messageContent = args.slice(2).join(' ');

      const targetChannel = client.channels.cache.get(channelId);
      if (!targetChannel) {
        return message.reply(`Channel with ID ${channelId} not found.`);
      }

      await targetChannel.send(messageContent);
      message.reply(`✅ Message sent to ${targetChannel.name}`);
    } catch (err) {
      console.error('Error sending message:', err);
      message.reply('Sorry, something went wrong while sending the message.');
    }
  }

  if (message.content.startsWith('!reminder')) {
    try {
      // Parse the command
      const parsed = parseReminderCommand(message.content);

      if (parsed.error) {
        return message.reply(parsed.error);
      }

      const { channelId, meetupLink, dateTime, title: customTitle, timezone } = parsed;

      // Verify the channel exists
      const targetChannel = client.channels.cache.get(channelId);
      if (!targetChannel) {
        return message.reply(`Channel with ID ${channelId} not found.`);
      }

      // Fetch event details from the meetup link
      const eventDetails = await fetchMeetupEventDetails(meetupLink);

      if (eventDetails.error) {
        return message.reply(`❌ ${eventDetails.error}`);
      }

      // Use custom title if provided, otherwise use the one from eventDetails
      const eventTitle = customTitle || eventDetails.title;

      // Parse the date/time if provided
      let eventDate = null;
      if (dateTime) {
        eventDate = new Date(dateTime);
        if (isNaN(eventDate.getTime())) {
          return message.reply('❌ Invalid date/time format. Please use format like "2024-01-15 18:00"');
        }
      } else if (!eventDetails.needsManualDate && eventDetails.date) {
        eventDate = eventDetails.date;
      } else {
        return message.reply('❌ Please provide date and time in quotes. Example: !reminder 123456789 https://meetup.com/... "2024-01-15 18:00"');
      }

      const location = eventDetails.location;

      // Create the reminder embed
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔔 Upcoming Practice Session Reminder / 練習セッションのお知らせ')
        .setDescription(`**${eventTitle}**`)
        .addFields(
          { name: '📅 Date & Time / 日時', value: `${eventDate.toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} ${timezone}`, inline: true },
          { name: '📍 Location / 場所', value: location || 'See event page / イベントページを確認', inline: true },
          { name: '🔗 Event Link / イベントリンク', value: `[Join the event / 参加する](${meetupLink})`, inline: false }
        );

      // Send the reminder immediately to the target channel
      await targetChannel.send({
        content: '@everyone',
        embeds: [embed]
      });

      // Confirm the reminder was sent
      await message.reply(`✅ Reminder sent to ${targetChannel.name}!`);
    } catch (err) {
      console.error('Error sending reminder:', err);
      message.reply('Sorry, something went wrong while sending the reminder.');
    }
  }
});


// Scheduled weekly Japanese quiz (Fridays at 10:00 AM JST)
schedule.scheduleJob('0 1 * * 5', async () => {
  try {
    const quiz = await quizModule.generateComprehensionQuiz(openai, 'japanese');
    const channelIds = parseChannelIdList(constants.JAPANESE_QUIZ_CHANNEL_ID);
    const channels = await fetchChannelsByIds(client, channelIds);
    for (const channel of channels) {
      await quizModule.sendQuiz(quiz, channel, quizData, false);
    }
  } catch (err) {
    console.error('Error in scheduled weekly Japanese quiz:', err);
  }
});

// Scheduled weekly Japanese word (Fridays at 11:00 AM JST)
schedule.scheduleJob('0 2 * * 5', async () => {
  try {
    const channelIds = parseChannelIdList(constants.JAPANESE_WORD_CHANNEL_ID);
    const channels = await fetchChannelsByIds(client, channelIds);
    for (const channel of channels) {
      await wordModule.sendJapaneseWord(channel, openai);
    }
  } catch (err) {
    console.error('Error in scheduled weekly Japanese word:', err);
  }
});

// Scheduled weekly Japanese grammar (Fridays at 12:00 PM JST)
schedule.scheduleJob('0 3 * * 5', async () => {
  try {
    const channelIds = parseChannelIdList(constants.JAPANESE_GRAMMAR_CHANNEL_ID);
    const channels = await fetchChannelsByIds(client, channelIds);
    for (const channel of channels) {
      await grammarModule.sendJapaneseGrammar(channel, openai);
    }
  } catch (err) {
    console.error('Error in scheduled weekly Japanese grammar:', err);
  }
});

// Scheduled weekly English quiz (Fridays at 1:00 PM JST)
schedule.scheduleJob('0 4 * * 5', async () => {
  try {
    const quiz = await quizModule.generateComprehensionQuiz(openai, 'english');
    const channelIds = parseChannelIdList(constants.ENGLISH_QUIZ_CHANNEL_ID);
    const channels = await fetchChannelsByIds(client, channelIds);
    for (const channel of channels) {
      await quizModule.sendQuiz(quiz, channel, quizData, true);
    }
  } catch (err) {
    console.error('Error in scheduled weekly English quiz:', err);
  }
});

// Scheduled weekly English grammar (Fridays at 3:00 PM JST)
schedule.scheduleJob('0 6 * * 5', async () => {
  try {
    const channelIds = parseChannelIdList(constants.ENGLISH_GRAMMAR_CHANNEL_ID);
    const channels = await fetchChannelsByIds(client, channelIds);
    for (const channel of channels) {
      await grammarModule.sendEnglishGrammar(channel, openai);
    }
  } catch (err) {
    console.error('Error in scheduled weekly English grammar:', err);
  }
});

// Weekly small talk (Fridays at 9:00 PM JST)
schedule.scheduleJob('0 12 * * 5', async () => {
  try {
    const reply = await smallTalkModule.generateSmallTalk(openai);
    for (const channelId of constants.SMALLTALK_CHANNEL_IDS) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        await smallTalkModule.sendSmallTalk(channel, reply);
      }
    }
  } catch (err) {
    console.error('Error in scheduled weekly small talk:', err);
  }
});

client.login(DISCORD_TOKEN);