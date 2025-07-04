// index.js

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { config } = require('dotenv');
const OpenAI = require('openai');
const schedule = require('node-schedule');
const Parser = require('rss-parser');
const generateCardImage = require('./cardImage');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const os = require('os');

config();

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
    // Debug: Log the full credentials string
    console.error('Raw GOOGLE_CREDENTIALS:', process.env.GOOGLE_CREDENTIALS);
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
const JAPANESE_QUIZ_CHANNEL_ID = process.env.JAPANESE_QUIZ_CHANNEL_ID;
const SMALLTALK_CHANNEL_IDS = process.env.SMALLTALK_CHANNEL_IDS?.split(',') || [];
const JAPANESE_WORD_CHANNEL_ID = process.env.JAPANESE_WORD_CHANNEL_ID;
const JAPANESE_GRAMMAR_CHANNEL_ID = process.env.JAPANESE_GRAMMAR_CHANNEL_ID;

// English learning channels
const ENGLISH_QUIZ_CHANNEL_ID = process.env.ENGLISH_QUIZ_CHANNEL_ID;
const ENGLISH_WORD_CHANNEL_ID = process.env.ENGLISH_WORD_CHANNEL_ID;
const ENGLISH_GRAMMAR_CHANNEL_ID = process.env.ENGLISH_GRAMMAR_CHANNEL_ID;

const ttsClient = new textToSpeech.TextToSpeechClient();

// Available Japanese voices for rotation
const JAPANESE_VOICES = [
  {
    name: 'ja-JP-Chirp3-HD-Achird',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'FEMALE'
  },
  {
    name: 'ja-JP-Chirp3-HD-Callirrhoe',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'FEMALE'
  },
  {
    name: 'ja-JP-Chirp3-HD-Sadachbia',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'MALE'
  },
  {
    name: 'ja-JP-Chirp3-HD-Gacrux',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'MALE'
  },
  {
    name: 'ja-JP-Chirp3-HD-Despina',
    speakingRate: 0.9,
    pitch: 0,
    ssmlGender: 'FEMALE'
  }
];

// Available English voices for rotation
const ENGLISH_VOICES = [
  {
    name: 'en-US-Chirp3-HD-Achernar',
    ssmlGender: 'FEMALE'
  },
  {
    name: 'en-US-Chirp3-HD-Erinome',
    ssmlGender: 'FEMALE'
  },
  {
    name: 'en-US-Chirp3-HD-Sulafat',
    ssmlGender: 'FEMALE'
  },
  {
    name: 'en-US-Chirp3-HD-Vindemiatrix',
    ssmlGender: 'FEMALE'
  },
  {
    name: 'en-US-Chirp3-HD-Algenib',
    ssmlGender: 'MALE'
  },
  {
    name: 'en-US-Chirp3-HD-Achird',
    ssmlGender: 'MALE'
  },
  {
    name: 'en-US-Chirp3-HD-Alnilam',
    ssmlGender: 'MALE'
  }
];

// Emoji reactions for quiz options
const REACTIONS = ['🇦', '🇧', '🇨', '🇩'];

async function getTTSBuffer(text) {
  // Randomly select a voice once per function call
  const selectedVoice = JAPANESE_VOICES[Math.floor(Math.random() * JAPANESE_VOICES.length)];
  return getTTSBufferWithVoice(text, selectedVoice);
}

// Helper function to generate TTS with a specific voice
async function getTTSBufferWithVoice(text, voice) {
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: { 
      languageCode: 'ja-JP',
      name: voice.name,
      ssmlGender: voice.ssmlGender
    },
    audioConfig: { 
      audioEncoding: 'MP3',
      speakingRate: voice.speakingRate,
      pitch: voice.pitch
    },
  });
  return Buffer.from(response.audioContent, 'binary');
}

async function getEnglishTTSBuffer(text) {
  // Randomly select a voice once per function call
  const selectedVoice = ENGLISH_VOICES[Math.floor(Math.random() * ENGLISH_VOICES.length)];
  return getEnglishTTSBufferWithVoice(text, selectedVoice);
}

// Helper function to generate English TTS with a specific voice
async function getEnglishTTSBufferWithVoice(text, voice) {
  const request = {
    input: { text },
    voice: { 
      languageCode: 'en-US',
      name: voice.name,
      ssmlGender: voice.ssmlGender
    },
    audioConfig: { 
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0
    },
  };

  const [response] = await ttsClient.synthesizeSpeech(request);
  return response.audioContent;
}

// Helper function to split text into chunks for TTS
async function getTTSBufferForLongText(text, isEnglish = false) {
  // Select a voice once for the entire paragraph
  const selectedVoice = isEnglish ? 
    ENGLISH_VOICES[Math.floor(Math.random() * ENGLISH_VOICES.length)] :
    JAPANESE_VOICES[Math.floor(Math.random() * JAPANESE_VOICES.length)];
  
  // Try to process the entire text as one piece first (if it's within reasonable length)
  // Google Cloud TTS has a limit of ~5000 characters per request
  const MAX_SINGLE_REQUEST = 4000; // Conservative limit
  
  if (text.length <= MAX_SINGLE_REQUEST) {
    // Process entire text with one voice
    return isEnglish ? 
      await getEnglishTTSBufferWithVoice(text, selectedVoice) : 
      await getTTSBufferWithVoice(text, selectedVoice);
  }
  
  // If text is too long, split into sentences but use the same voice
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const audioBuffers = [];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence) {
      // Use the same voice for all sentences
      const buffer = isEnglish ? 
        await getEnglishTTSBufferWithVoice(trimmedSentence, selectedVoice) : 
        await getTTSBufferWithVoice(trimmedSentence, selectedVoice);
      audioBuffers.push(buffer);
    }
  }

  // Combine all audio buffers
  return Buffer.concat(audioBuffers);
}

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

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!smalltalk') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a language tutor generating a Japanese-English small talk activity with grammar practice.

Create SHORT, SIMPLE questions that fit on a card display. Keep questions under 10 words when possible.

Use varied everyday topics, rotating between:
- Hobbies (beyond just "sports" - include reading, gaming, cooking, music, art, etc.)
- Daily routines (morning, work, study habits)
- Weekend activities
- Favorite places (cafes, parks, shops)
- Seasons and weather preferences
- Food and drinks (specific dishes, not just "do you like food")
- Technology use
- Travel and vacations
- Movies, books, shows
- Pets and animals
- Shopping habits
- Exercise and health
- Friends and social activities
- Work or school life
- Local area and neighborhoods

AVOID: Repetitive "Do you like X?" questions. Mix up question types.

Format the response into exactly 2 clearly separated blocks (using \n\n):

**Today's small talk**
**EN: <Short English question - max 10 words>  
JP: <Short natural Japanese question>  
Romaji: <Romaji version>**

EN: <Simple English sentence with blank>  
JP: <Simple Japanese sentence with ___ for grammar practice>  
Romaji: <Romaji with blank>

For grammar practice, vary between:
- Single particles (は、が、を、に、で、へ、から、まで、と、も、より、の、etc.)
- Casual grammar patterns (たい、たり、ちゃう/じゃう、てる、たことがある、たほうがいい、なきゃ、etc.)
- Conjunctions (けど、のに、から、ので、し、etc.)
- Sentence endings (よね、かな、じゃん、でしょ、だろう、etc.)
- Common expressions (そうだ、みたい、らしい、はず、かもしれない、etc.)

Keep everything concise, natural, and conversational.`
          },
          {
            role: 'user',
            content: 'Generate a Japanese-English small talk prompt with an interesting, varied topic. Avoid repetitive themes like basic sports or ice cream.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setDescription(reply)
        .setFooter({ text: 'Use !smalltalk again for a new one!' });

      await message.reply({ embeds: [embed] });

      // Generate the card image from the smalltalk text
      const imageBuffer = await generateCardImage(reply);
      await message.channel.send({ files: [{ attachment: imageBuffer, name: 'smalltalk-card.png' }] });
    } catch (err) {
      console.error('Error fetching from OpenAI or generating image:', err);
      message.reply('Sorry, something went wrong while generating the small talk prompt or image.');
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

  if (message.content === '!quiz') {
    try {
      const quiz = await generateComprehensionQuiz('japanese');
      await sendQuiz(quiz, message.channel, false);
    } catch (err) {
      console.error('Error generating quiz:', err);
      message.reply('Sorry, something went wrong while generating the quiz.');
    }
  }

  if (message.content === '!forcescheduledquiz') {
    try {
      const quiz = await generateComprehensionQuiz('japanese');
      await sendQuiz(quiz, message.channel, false);
    } catch (err) {
      console.error('Error generating forced scheduled quiz:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled quiz.');
    }
  }

  if (message.content === '!forcescheduledsmalltalk') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a language tutor generating a Japanese-English small talk activity with grammar practice.

Create SHORT, SIMPLE questions that fit on a card display. Keep questions under 10 words when possible.

Use varied everyday topics, rotating between:
- Hobbies (beyond just "sports" - include reading, gaming, cooking, music, art, etc.)
- Daily routines (morning, work, study habits)
- Weekend activities
- Favorite places (cafes, parks, shops)
- Seasons and weather preferences
- Food and drinks (specific dishes, not just "do you like food")
- Technology use
- Travel and vacations
- Movies, books, shows
- Pets and animals
- Shopping habits
- Exercise and health
- Friends and social activities
- Work or school life
- Local area and neighborhoods

AVOID: Repetitive "Do you like X?" questions. Mix up question types.

Format the response into exactly 2 clearly separated blocks (using \n\n):

**Today's small talk**
**EN: <Short English question - max 10 words>  
JP: <Short natural Japanese question>  
Romaji: <Romaji version>**

EN: <Simple English sentence with blank>  
JP: <Simple Japanese sentence with ___ for grammar practice>  
Romaji: <Romaji with blank>

For grammar practice, vary between:
- Single particles (は、が、を、に、で、へ、から、まで、と、も、より、の、etc.)
- Casual grammar patterns (たい、たり、ちゃう/じゃう、てる、たことがある、たほうがいい、なきゃ、etc.)
- Conjunctions (けど、のに、から、ので、し、etc.)
- Sentence endings (よね、かな、じゃん、でしょ、だろう、etc.)
- Common expressions (そうだ、みたい、らしい、はず、かもしれない、etc.)

Keep everything concise, natural, and conversational.`
          },
          {
            role: 'user',
            content: 'Generate a Japanese-English small talk prompt with an interesting, varied topic. Avoid repetitive themes like basic sports or ice cream.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the smalltalk text
      const imageBuffer = await generateCardImage(reply);

      // Send to all configured smalltalk channels
      for (const channelId of SMALLTALK_CHANNEL_IDS) {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
          await channel.send({ files: [{ attachment: imageBuffer, name: 'smalltalk-card.png' }] });
        }
      }
      message.reply('✅ Weekly smalltalk has been sent to all configured channels!');
    } catch (err) {
      console.error('Error generating forced scheduled smalltalk:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled smalltalk.');
    }
  }

  if (message.content === '!word') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language tutor generating a word of the day card.
Each time, select a useful Japanese word that learners might encounter in daily life.
Avoid repeating words from previous days.

Format the response into exactly 4 clearly separated blocks (using \n\n):

📝 Word:
JP: <the word in Japanese>  
Romaji: <Romaji version>  
EN: <English translation>

💡 Definition:
<Detailed explanation of the word's meaning and usage>

🎯 Example:
JP: <Natural Japanese sentence using the word>  
Romaji: <Romaji version>  
EN: <English translation>

📌 Notes:
<Additional information like common collocations, related words, or usage tips>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me a Japanese word of the day.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the word text
      const imageBuffer = await generateCardImage(reply);
      await message.channel.send({ files: [{ attachment: imageBuffer, name: 'word-card.png' }] });

      // Extract the example sentence and generate audio
      const exampleMatch = reply.match(/🎯 Example:\nJP: (.*?)(?=\n|$)/);
      if (exampleMatch) {
        const exampleSentence = exampleMatch[1].trim();
        const audioBuffer = await getTTSBuffer(exampleSentence);
        const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
        await message.channel.send({ files: [audioAttachment] });
      }
      // Add prompt for users to create their own examples
      await message.channel.send("💡 Try creating your own example sentence using this word! Feel free to share it in the chat.");
    } catch (err) {
      console.error('Error fetching from OpenAI or generating image:', err);
      message.reply('Sorry, something went wrong while generating the word of the day.');
    }
  }

  if (message.content === '!grammar') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language tutor generating a grammar point of the day card.
Each time, select a useful Japanese grammar point that learners might encounter in daily life.
Avoid repeating grammar points from previous days.

Format the response into exactly 4 clearly separated blocks (using \n\n):

📚 Grammar Point:
<Name of the grammar point in English>

💡 Explanation:
<Clear explanation of how to use this grammar point, including its meaning and when to use it>

🎯 Examples:
JP: <Natural Japanese sentence using the grammar point>  
Romaji: <Romaji version>  
EN: <English translation>

📌 Notes:
<Additional information like common mistakes, related grammar points, or usage tips>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me a Japanese grammar point of the day.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the grammar text
      const imageBuffer = await generateCardImage(reply);
      await message.channel.send({ files: [{ attachment: imageBuffer, name: 'grammar-card.png' }] });

      // Extract the example sentence and generate audio
      const exampleMatch = reply.match(/🎯 Examples:\nJP: (.*?)(?=\n|$)/);
      if (exampleMatch) {
        const exampleSentence = exampleMatch[1].trim();
        const audioBuffer = await getTTSBuffer(exampleSentence);
        const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
        await message.channel.send({ files: [audioAttachment] });
      }
      // Add prompt for users to create their own examples
      await message.channel.send("💡 Try creating your own example sentence using this grammar point! Feel free to share it in the chat.");
    } catch (err) {
      console.error('Error fetching from OpenAI or generating image:', err);
      message.reply('Sorry, something went wrong while generating the grammar point of the day.');
    }
  }

  if (message.content === '!forcescheduledjapaneseword') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language tutor generating a word of the day card.
Each time, select a different Japanese word from a wide range of JLPT levels (N5 to N1).
Focus on practical, commonly used vocabulary that learners might encounter in daily life.
Avoid repeating words from previous days.

Consider these categories when selecting words:
- Basic nouns (N5)
- Common verbs (N5-N4)
- Adjectives (N5-N4)
- Adverbs (N5-N3)
- Business vocabulary (N3-N1)
- Academic terms (N3-N1)
- Colloquial expressions (N4-N2)
- Onomatopoeia (N4-N2)
- Compound words (N4-N2)
- Idiomatic expressions (N4-N2)
- Honorific vocabulary (N3-N1)
- Technical terms (N3-N1)
- Slang and casual expressions (N4-N2)
- Formal expressions (N3-N1)
- Cultural terms (N4-N2)
- Seasonal vocabulary (N5-N3)
- Emotion-related words (N5-N3)
- Time-related vocabulary (N5-N3)
- Location and direction words (N5-N3)
- Family and relationship terms (N5-N3)

Format the response into exactly 4 clearly separated blocks (using \n\n):

📝 Word:
JP: <the word in Japanese>  
Romaji: <Romaji version>  
EN: <English translation>
JLPT Level: <N5/N4/N3/N2/N1>
Part of Speech: <noun/verb/adjective/adverb/etc.>

💡 Definition:
<Detailed explanation including:
- Primary meaning and common usages
- Any secondary or extended meanings
- Nuances and connotations
- How it differs from similar words
- When and where it's commonly used>

🎯 Example:
JP: <Natural Japanese sentence using the word>  
Romaji: <Romaji version>  
EN: <English translation>

📌 Notes:
<Additional information like:
- Common collocations and phrases
- Related words and synonyms
- Antonyms if applicable
- Usage tips and common mistakes
- Cultural context if relevant
- Formality level
- Any special reading or writing notes>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me a Japanese word of the day.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the word text
      const imageBuffer = await generateCardImage(reply);

      // Send to the word channel or current channel if no channel ID is set
      const channel = JAPANESE_WORD_CHANNEL_ID ? 
        client.channels.cache.get(JAPANESE_WORD_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'word-card.png' }] });

        // Extract the example sentence and generate audio
        const exampleMatch = reply.match(/🎯 Example:\nJP: (.*?)(?=\n|$)/);
        if (exampleMatch) {
          const exampleSentence = exampleMatch[1].trim();
          const audioBuffer = await getTTSBuffer(exampleSentence);
          const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
          await channel.send({ files: [audioAttachment] });
        }
        // Add prompt for users to create their own examples
        await channel.send("💡 Try creating your own example sentence using this word! Feel free to share it in the chat.");
      }
    } catch (err) {
      console.error('Error generating Japanese word:', err);
      message.reply('Sorry, something went wrong while generating the Japanese word of the day.');
    }
  }

  if (message.content === '!forcescheduledenglishword') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an English language tutor generating a word of the day card for Japanese learners.
Each time, select a different English word from a wide range of difficulty levels.
Focus on practical, commonly used vocabulary that Japanese learners might find challenging.
Avoid repeating words from previous days.

Consider these categories when selecting words:
- Basic nouns (Beginner)
- Common verbs (Beginner-Intermediate)
- Adjectives (Beginner-Intermediate)
- Adverbs (Beginner-Intermediate)
- Business vocabulary (Intermediate-Advanced)
- Academic terms (Intermediate-Advanced)
- Colloquial expressions (Intermediate)
- Phrasal verbs (Intermediate)
- Compound words (Intermediate)
- Idiomatic expressions (Intermediate-Advanced)
- Technical terms (Intermediate-Advanced)
- Slang and casual expressions (Intermediate)
- Formal expressions (Intermediate-Advanced)
- Cultural terms (Intermediate)
- Seasonal vocabulary (Beginner-Intermediate)
- Emotion-related words (Beginner-Intermediate)
- Time-related vocabulary (Beginner-Intermediate)
- Location and direction words (Beginner-Intermediate)
- Family and relationship terms (Beginner-Intermediate)
- Prepositional phrases (Intermediate)

Format the response into exactly 4 clearly separated blocks (using \n\n):

📝 Word:
EN: <the word in English>
JP: <Japanese translation>
Level: <Beginner/Intermediate/Advanced>
Part of Speech: <noun/verb/adjective/adverb/etc.>

💡 Definition:
<Keep it brief and clear in Japanese:
- Primary meaning (1-2 sentences)
- One common usage example
- One key difference from similar Japanese words>

🎯 Example:
EN: <Natural English sentence using the word>
JP: <Japanese translation>

📌 Notes:
<Keep it concise in Japanese:
- One common mistake to avoid
- One related word or synonym
- One usage tip>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me an English word of the day for Japanese learners.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the word text
      const imageBuffer = await generateCardImage(reply);

      // Send to the English word channel or current channel if no channel ID is set
      const channel = ENGLISH_WORD_CHANNEL_ID ? 
        client.channels.cache.get(ENGLISH_WORD_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'english-word-card.png' }] });

        // Extract the example sentence and generate audio using English TTS
        const exampleMatch = reply.match(/🎯 Example:\nEN: (.*?)(?=\n|$)/);
        if (exampleMatch) {
          const exampleSentence = exampleMatch[1].trim();
          const audioBuffer = await getEnglishTTSBuffer(exampleSentence);
          const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'english-example.mp3' });
          await channel.send({ files: [audioAttachment] });
        }
        // Add prompt for users to create their own examples
        await channel.send("💡 この単語を使って例文を作ってみましょう！チャットで共有してください。");
      }
    } catch (err) {
      console.error('Error generating English word:', err);
      message.reply('Sorry, something went wrong while generating the English word of the day.');
    }
  }

  if (message.content === '!forcescheduledjapanesegrammar') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language tutor generating a grammar point of the day card.
Each time, select a different Japanese grammar point from a wide range of JLPT levels (N5 to N1).
Focus on practical, commonly used grammar patterns that learners might encounter in daily life.
Avoid repeating grammar points from previous days.

Consider these categories when selecting grammar points:
- Basic sentence patterns (N5)
- Verb conjugations and forms (N5-N4)
- Particles and their various uses (N5-N3)
- Conditional forms (N4-N2)
- Honorific and humble expressions (N3-N1)
- Complex sentence structures (N3-N1)
- Colloquial expressions (N4-N2)
- Formal and business Japanese (N3-N1)
- Time-related expressions (N5-N3)
- Passive, causative, and causative-passive forms (N4-N2)
- Expressing probability and possibility (N4-N2)
- Expressing intention and volition (N4-N2)
- Expressing obligation and necessity (N4-N2)
- Expressing permission and prohibition (N4-N2)
- Expressing giving and receiving (N4-N2)
- Expressing comparison and contrast (N4-N2)
- Expressing cause and effect (N4-N2)
- Expressing purpose and reason (N4-N2)
- Expressing conditions and suppositions (N4-N2)
- Expressing time and sequence (N4-N2)

Format the response into exactly 4 clearly separated blocks (using \n\n):

📚 Grammar Point:
<Name of the grammar point in English>
JLPT Level: <N5/N4/N3/N2/N1>

💡 Explanation:
<Clear explanation of how to use this grammar point, including:
- Its meaning and when to use it
- Common patterns and structures
- Any important nuances or exceptions
- How it differs from similar grammar points>

🎯 Examples:
JP: <Natural Japanese sentence using the grammar point>  
Romaji: <Romaji version>  
EN: <English translation>

📌 Notes:
<Additional information like:
- Common mistakes to avoid
- Related grammar points
- Usage tips
- Cultural context if relevant
- Formality level>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me a Japanese grammar point of the day.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the grammar text
      const imageBuffer = await generateCardImage(reply);

      // Send to the grammar channel or current channel if no channel ID is set
      const channel = JAPANESE_GRAMMAR_CHANNEL_ID ? 
        client.channels.cache.get(JAPANESE_GRAMMAR_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'grammar-card.png' }] });

        // Extract the example sentence and generate audio
        const exampleMatch = reply.match(/🎯 Examples:\nJP: (.*?)(?=\n|$)/);
        if (exampleMatch) {
          const exampleSentence = exampleMatch[1].trim();
          const audioBuffer = await getTTSBuffer(exampleSentence);
          const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
          await channel.send({ files: [audioAttachment] });
        }
        // Add prompt for users to create their own examples
        await channel.send("💡 Try creating your own example using this grammar point! Feel free to share it in the chat.");
      }
    } catch (err) {
      console.error('Error generating Japanese grammar:', err);
      message.reply('Sorry, something went wrong while generating the Japanese grammar point of the day.');
    }
  }

  if (message.content === '!englishgrammar') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an English language tutor generating a grammar point of the day card for Japanese learners.
Each time, select a different English grammar point from a wide range of difficulty levels.
Focus on practical, commonly used grammar patterns that Japanese learners might find challenging.
Avoid repeating grammar points from previous days.

Consider these categories when selecting grammar points:
- Basic sentence patterns (Beginner)
- Verb tenses and forms (Beginner-Intermediate)
- Prepositions and their uses (Beginner-Intermediate)
- Conditional forms (Intermediate)
- Modal verbs (Intermediate)
- Complex sentence structures (Intermediate-Advanced)
- Colloquial expressions (Intermediate)
- Formal and business English (Intermediate-Advanced)
- Time-related expressions (Beginner-Intermediate)
- Passive voice (Intermediate)
- Expressing probability and possibility (Intermediate)
- Expressing intention and volition (Intermediate)
- Expressing obligation and necessity (Intermediate)
- Expressing permission and prohibition (Intermediate)
- Expressing giving and receiving (Intermediate)
- Expressing comparison and contrast (Intermediate)
- Expressing cause and effect (Intermediate)
- Expressing purpose and reason (Intermediate)
- Expressing conditions and suppositions (Intermediate)
- Expressing time and sequence (Intermediate)

Format the response into exactly 4 clearly separated blocks (using \n\n):

📚 Grammar Point:
<Name of the grammar point in English>
JP: <Japanese explanation of the grammar point>
Level: <Beginner/Intermediate/Advanced>

💡 Explanation:
<Keep it brief and clear:
- Basic usage (1-2 sentences)
- One key difference from Japanese
- One common mistake to avoid>

🎯 Examples:
EN: <Natural English sentence using the grammar point>
JP: <Japanese translation>

📌 Notes:
<Keep it concise:
- One usage tip
- One related grammar point
- One practice suggestion>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me an English grammar point of the day for Japanese learners.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the grammar text
      const imageBuffer = await generateCardImage(reply);

      // Send to the English grammar channel or current channel if no channel ID is set
      const channel = ENGLISH_GRAMMAR_CHANNEL_ID ? 
        client.channels.cache.get(ENGLISH_GRAMMAR_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'english-grammar-card.png' }] });

        // Extract the example sentence and generate audio
        const exampleMatch = reply.match(/🎯 Examples:\nEN: (.*?)(?=\n|$)/);
        if (exampleMatch) {
          const exampleSentence = exampleMatch[1].trim();
          const audioBuffer = await getTTSBuffer(exampleSentence);
          const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
          await channel.send({ files: [audioAttachment] });
        }
        // Add prompt for users to create their own examples
        await channel.send("💡 Try creating your own example using this grammar point! Feel free to share it in the chat.");
      }
    } catch (err) {
      console.error('Error generating English grammar:', err);
      message.reply('Sorry, something went wrong while generating the English grammar point of the day.');
    }
  }

  if (message.content === '!forcescheduledenglishgrammar') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an English language tutor generating a grammar point of the day card for Japanese learners.
Each time, select a different English grammar point from a wide range of difficulty levels.
Focus on practical, commonly used grammar patterns that Japanese learners might find challenging.
Avoid repeating grammar points from previous days.

Consider these categories when selecting grammar points:
- Basic sentence patterns (Beginner)
- Verb tenses and forms (Beginner-Intermediate)
- Prepositions and their uses (Beginner-Intermediate)
- Conditional forms (Intermediate)
- Modal verbs (Intermediate)
- Complex sentence structures (Intermediate-Advanced)
- Colloquial expressions (Intermediate)
- Formal and business English (Intermediate-Advanced)
- Time-related expressions (Beginner-Intermediate)
- Passive voice (Intermediate)
- Expressing probability and possibility (Intermediate)
- Expressing intention and volition (Intermediate)
- Expressing obligation and necessity (Intermediate)
- Expressing permission and prohibition (Intermediate)
- Expressing giving and receiving (Intermediate)
- Expressing comparison and contrast (Intermediate)
- Expressing cause and effect (Intermediate)
- Expressing purpose and reason (Intermediate)
- Expressing conditions and suppositions (Intermediate)
- Expressing time and sequence (Intermediate)

Format the response into exactly 4 clearly separated blocks (using \n\n):

📚 Grammar Point:
EN: <Name of the grammar point in English>
JP: <Japanese explanation of the grammar point>
Level: <Beginner/Intermediate/Advanced>

💡 Explanation:
<Keep it brief and clear in Japanese:
- Basic usage (1-2 sentences)
- One key difference from Japanese
- One common mistake to avoid>

🎯 Examples:
EN: <Natural English sentence using the grammar point>
JP: <Japanese translation>

📌 Notes:
<Keep it concise in Japanese:
- One usage tip
- One related grammar point
- One practice suggestion>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me an English grammar point of the day for Japanese learners.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      // Generate the card image from the grammar text
      const imageBuffer = await generateCardImage(reply);

      // Send to the English grammar channel or current channel if no channel ID is set
      const channel = ENGLISH_GRAMMAR_CHANNEL_ID ? 
        client.channels.cache.get(ENGLISH_GRAMMAR_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'english-grammar-card.png' }] });

        // Extract the example sentence and generate audio
        const exampleMatch = reply.match(/🎯 Examples:\nEN: (.*?)(?=\n|$)/);
        if (exampleMatch) {
          const exampleSentence = exampleMatch[1].trim();
          const audioBuffer = await getEnglishTTSBuffer(exampleSentence);
          const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'english-example.mp3' });
          await channel.send({ files: [audioAttachment] });
        }
        // Add prompt for users to create their own examples
        await channel.send("💡 Try creating your own example using this grammar point! Feel free to share it in the chat.");
      }
    } catch (err) {
      console.error('Error generating English grammar:', err);
      message.reply('Sorry, something went wrong while generating the English grammar point of the day.');
    }
  }

  if (message.content === '!englishquiz') {
    try {
      const quiz = await generateComprehensionQuiz('english');
      await sendQuiz(quiz, message.channel, true);
    } catch (err) {
      console.error('Error generating English quiz:', err);
      message.reply('Sorry, something went wrong while generating the English quiz.');
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
      const quiz = await generateComprehensionQuiz('japanese');
      const channel = client.channels.cache.get(JAPANESE_QUIZ_CHANNEL_ID);
      if (!channel) {
        console.error('Quiz channel not found:', JAPANESE_QUIZ_CHANNEL_ID);
        return;
      }
      await sendQuiz(quiz, channel, false);
    } catch (err) {
      console.error('Error generating forced scheduled Japanese quiz:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled Japanese quiz.');
    }
  }

  if (message.content === '!revealjapanesequiz') {
    try {
      await revealPreviousQuizAnswer('japanese');
      message.reply('✅ Previous Japanese quiz answer revealed!');
    } catch (err) {
      console.error('Error revealing Japanese quiz answer:', err);
      message.reply('Sorry, something went wrong while revealing the Japanese quiz answer.');
    }
  }

  if (message.content === '!revealenglishquiz') {
    try {
      await revealPreviousQuizAnswer('english');
      message.reply('✅ Previous English quiz answer revealed!');
    } catch (err) {
      console.error('Error revealing English quiz answer:', err);
      message.reply('Sorry, something went wrong while revealing the English quiz answer.');
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

// Helper to generate a comprehension quiz using OpenAI
async function generateComprehensionQuiz(language = 'japanese') {
  const isEnglish = language === 'english';
  
  const quizPrompt = isEnglish ? 
    `You are an English language comprehension quiz generator for Japanese learners.
Generate an English paragraph (2-3 sentences) about a different everyday situation each time (e.g., shopping, school, travel, weather, hobbies, family, work, etc.). Avoid repeating the same topic as previous quizzes.

The paragraph should:
1. Include subtle nuances, implications, or cultural context that require deeper understanding
2. Use a mix of grammar patterns and vocabulary that Japanese learners might encounter in real life
3. Have some ambiguity or room for interpretation in certain aspects

Then provide 4 Japanese options (A, B, C, D) for its meaning. The options should:
1. All be plausible interpretations of the text
2. Differ in subtle ways (e.g., timing, speaker's attitude, implied meaning, cultural context)
3. Include at least one option that's partially correct but misses a key nuance
4. Have only one option that captures all aspects of the text accurately

After the options, state the correct answer and a detailed explanation in Japanese that highlights the key nuances and why the other options are incorrect.

Format:
EN: <paragraph>
A) <option 1 in Japanese>
B) <option 2 in Japanese>
C) <option 3 in Japanese>
D) <option 4 in Japanese>
Answer: <A/B/C/D>
Explanation: <why in Japanese, including key nuances and why other options are incorrect>
` :
    `You are a Japanese language comprehension quiz generator.
Generate a Japanese paragraph (3-4 sentences) about a different everyday situation each time (e.g., shopping, school, travel, weather, hobbies, family, work, etc.). Avoid repeating the same topic as previous quizzes.

The paragraph should:
1. Include subtle nuances, implications, or cultural context that require deeper understanding
2. Use a mix of grammar patterns and vocabulary that learners might encounter in real life
3. Have some ambiguity or room for interpretation in certain aspects

Then provide 4 English options (A, B, C, D) for its meaning. The options should:
1. All be plausible interpretations of the text
2. Differ in subtle ways (e.g., timing, speaker's attitude, implied meaning, cultural context)
3. Include at least one option that's partially correct but misses a key nuance
4. Have only one option that captures all aspects of the text accurately

After the options, state the correct answer and a detailed explanation that highlights the key nuances and why the other options are incorrect.

Format:
JP: <paragraph>
A) <option 1>
B) <option 2>
C) <option 3>
D) <option 4>
Answer: <A/B/C/D>
Explanation: <why, including key nuances and why other options are incorrect>
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: quizPrompt },
      { role: 'user', content: 'Generate a new quiz.' }
    ]
  });
  return completion.choices[0].message.content;
}

// Unified function to send quiz with proper option extraction
async function sendQuiz(quiz, channel, isEnglish = false) {
  if (!quiz || !channel) return;

  try {
    // Extract the main text (Japanese or English)
    const textMatch = quiz.match(isEnglish ? /EN:\s*(.+)/ : /JP:\s*(.+)/);
    const question = textMatch ? textMatch[1].trim() : (isEnglish ? 'English paragraph' : 'Japanese paragraph');

    // Send the audio file
    try {
      const audioBuffer = isEnglish ? 
        await getTTSBufferForLongText(question, true) : 
        await getTTSBufferForLongText(question, false);
      const audioAttachment = new AttachmentBuilder(audioBuffer, { name: `${isEnglish ? 'english-' : ''}quiz-audio.mp3` });
      await channel.send({
        content: `@everyone **Daily ${isEnglish ? 'English ' : ''}Quiz**\n${question}`,
        files: [audioAttachment]
      });
    } catch (ttsError) {
      console.error('TTS error, sending without audio:', ttsError);
      await channel.send({
        content: `@everyone **Daily ${isEnglish ? 'English ' : ''}Quiz**\n${question}`
      });
    }

    // Extract options using the same logic for both languages
    const options = [];
    for (const letter of ['A', 'B', 'C', 'D']) {
      const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
      if (optMatch) options.push(optMatch[1].trim());
    }

    // Send the options as a message with descriptive text (full options for reference)
    const optionLabels = ['a', 'b', 'c', 'd'];
    let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
    await channel.send(
      `**Options:**\n${optionsText}`
    );

    // Create a poll with just the letter options
    const pollMessage = await channel.send({
      poll: {
        question: { text: isEnglish ? 'この英文の意味として最も適切なのは？' : 'What is the most accurate English meaning?' },
        answers: optionLabels.map(letter => ({ text: letter }))
      }
    });

    // Extract the correct answer
    const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
    const correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : 'A';

    // Store quiz data for answer revelation when next quiz is scheduled
    const quizType = isEnglish ? 'english' : 'japanese';
    const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
    const explanation = explanationMatch ? explanationMatch[1].trim() : '';
    
    quizData[quizType] = {
      pollMessage: pollMessage,
      answer: correctAnswer,
      explanation: explanation,
      channel: channel
    };

    // Reveal answer after 6 hours (21600000 milliseconds)
    setTimeout(async () => {
      await revealPreviousQuizAnswer(quizType);
    }, 21600000);

    console.log(`Quiz sent and data stored for ${quizType} quiz. Answer will be revealed in 6 hours.`);
  } catch (err) {
    console.error(`Error sending ${isEnglish ? 'English' : 'Japanese'} quiz:`, err);
  }
}

// Function to reveal previous quiz answers
async function revealPreviousQuizAnswer(quizType) {
  const data = quizData[quizType];
  if (data && data.pollMessage && data.answer) {
    try {
      // Send the explanation message with the correct answer
      await data.channel.send(`✅ **Correct answer:** ${data.answer}\n${data.explanation}`);
      
      // End the poll by editing the message
      await data.pollMessage.edit({
        poll: {
          question: { text: quizType === 'english' ? 'この英文の意味として最も適切なのは？' : 'What is the most accurate English meaning?' },
          answers: data.pollMessage.poll.answers,
          duration: 0 // This effectively ends the poll
        }
      });
      
      console.log(`Previous ${quizType} quiz answer revealed successfully`);
      
      // Clear the stored data
      quizData[quizType] = { pollMessage: null, answer: null, explanation: null, channel: null };
    } catch (answerError) {
      console.error(`Error revealing ${quizType} quiz answer:`, answerError);
      // Fallback: just send the answer if explanation fails
      try {
        await data.channel.send(`正解: ${data.answer}`);
      } catch (fallbackError) {
        console.error('Error sending fallback answer:', fallbackError);
      }
    }
  }
}

// Scheduled daily quiz
schedule.scheduleJob('0 1 * * *', async () => { // 1:00 AM UTC = 10:00 AM JST
  try {
    const quiz = await generateComprehensionQuiz('japanese');
    const channel = client.channels.cache.get(JAPANESE_QUIZ_CHANNEL_ID);
    if (!channel) {
      console.error('Quiz channel not found:', JAPANESE_QUIZ_CHANNEL_ID);
      return;
    }
    await sendQuiz(quiz, channel, false);
  } catch (err) {
    console.error('Error generating scheduled quiz:', err);
  }
});

// Scheduled daily word
schedule.scheduleJob('0 2 * * *', async () => { // 2:00 AM UTC = 11:00 AM JST
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Japanese language tutor generating a word of the day card.
Each time, select a useful Japanese word that learners might encounter in daily life.
Avoid repeating words from previous days.

Format the response into exactly 4 clearly separated blocks (using \n\n):

📝 Word:
JP: <the word in Japanese>  
Romaji: <Romaji version>  
EN: <English translation>

💡 Definition:
<Detailed explanation of the word's meaning and usage>

🎯 Example:
JP: <Natural Japanese sentence using the word>  
Romaji: <Romaji version>  
EN: <English translation>

📌 Notes:
<Additional information like common collocations, related words, or usage tips>

Do not include greetings, lesson titles, or number the sections.`
        },
        {
          role: 'user',
          content: 'Give me a Japanese word of the day.'
        }
      ]
    });

    const reply = completion.choices[0].message.content;

    // Generate the card image from the word text
    const imageBuffer = await generateCardImage(reply);

    // Send to the word channel
    const channel = client.channels.cache.get(JAPANESE_WORD_CHANNEL_ID);
    if (!channel) {
      console.error('Word channel not found:', JAPANESE_WORD_CHANNEL_ID);
      return;
    }

    await channel.send({ files: [{ attachment: imageBuffer, name: 'word-card.png' }] });

    // Extract the example sentence and generate audio
    const exampleMatch = reply.match(/🎯 Example:\nJP: (.*?)(?=\n|$)/);
    if (exampleMatch) {
      const exampleSentence = exampleMatch[1].trim();
      const audioBuffer = await getTTSBuffer(exampleSentence);
      const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
      await channel.send({ files: [audioAttachment] });
    }
    // Add prompt for users to create their own examples
    await channel.send("💡 Try creating your own example sentence using this word! Feel free to share it in the chat.");
  } catch (err) {
    console.error('Error generating scheduled word:', err);
  }
});

// Scheduled daily grammar
schedule.scheduleJob('0 3 * * *', async () => { // 3:00 AM UTC = 12:00 PM JST
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Japanese language tutor generating a grammar point of the day card.
Each time, select a useful Japanese grammar point that learners might encounter in daily life.
Avoid repeating grammar points from previous days.

Format the response into exactly 4 clearly separated blocks (using \n\n):

📚 Grammar Point:
<Name of the grammar point in English>

💡 Explanation:
<Clear explanation of how to use this grammar point, including its meaning and when to use it>

🎯 Examples:
JP: <Natural Japanese sentence using the grammar point>  
Romaji: <Romaji version>  
EN: <English translation>

📌 Notes:
<Additional information like common mistakes, related grammar points, or usage tips>

Do not include greetings, lesson titles, or number the sections.`
        },
        {
          role: 'user',
          content: 'Give me a Japanese grammar point of the day.'
        }
      ]
    });

    const reply = completion.choices[0].message.content;

    // Generate the card image from the grammar text
    const imageBuffer = await generateCardImage(reply);

    // Send to the grammar channel
    const channel = client.channels.cache.get(JAPANESE_GRAMMAR_CHANNEL_ID);
    if (!channel) {
      console.error('Grammar channel not found:', JAPANESE_GRAMMAR_CHANNEL_ID);
      return;
    }

    await channel.send({ files: [{ attachment: imageBuffer, name: 'grammar-card.png' }] });

    // Extract the example sentence and generate audio
    const exampleMatch = reply.match(/🎯 Examples:\nJP: (.*?)(?=\n|$)/);
    if (exampleMatch) {
      const exampleSentence = exampleMatch[1].trim();
      const audioBuffer = await getTTSBuffer(exampleSentence);
      const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'first-example.mp3' });
      await channel.send({ files: [audioAttachment] });
    }
    // Add prompt for users to create their own examples
    await channel.send("💡 Try creating your own example sentence using this grammar point! Feel free to share it in the chat.");
  } catch (err) {
    console.error('Error generating scheduled grammar:', err);
  }
});

// Add new scheduled job for English quiz
schedule.scheduleJob('0 4 * * *', async () => { // 4:00 AM UTC = 1:00 PM JST
  try {
    console.log('Starting scheduled English quiz...');
    
    const quiz = await generateComprehensionQuiz('english');
    
    if (!quiz) {
      console.error('Failed to generate English quiz');
      return;
    }
    
    const channel = client.channels.cache.get(ENGLISH_QUIZ_CHANNEL_ID);
    if (!channel) {
      console.error('English quiz channel not found:', ENGLISH_QUIZ_CHANNEL_ID);
      return;
    }
    
    await sendQuiz(quiz, channel, true);
    console.log('Scheduled English quiz completed successfully');
  } catch (err) {
    console.error('Error generating scheduled English quiz:', err);
    console.error('Error stack:', err.stack);
  }
});

// Scheduled daily English word
client.login(DISCORD_TOKEN);