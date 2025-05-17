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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// Placeholder for quiz channel
const QUIZ_CHANNEL_ID = process.env.QUIZ_CHANNEL_ID;

const ttsClient = new textToSpeech.TextToSpeechClient();

async function getTTSBuffer(text) {
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: { languageCode: 'ja-JP', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3' },
  });
  return Buffer.from(response.audioContent, 'binary');
}

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!smalltalk') {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a language tutor generating a Japanese-English small talk activity formatted like a classroom practice card.

Stick to one cohesive theme per card (e.g., food, travel, hobbies, weather).

Format the response into exactly 3 clearly separated blocks (using \n\n):

❓ Question:
JP: <natural Japanese question related to the theme>  
Romaji: <Romaji version>  
EN: <English translation>

✍️ Fill-in-the-Blank:
JP: <Japanese sentence with a blank or missing part (use ___)>  
Romaji: <Romaji version with blank>  
EN: <English sentence with blank>

💬 Example Answer:
JP: <Completed Japanese sentence using a realistic word in the blank>  
Romaji: <Romaji version>  
EN: <Natural English translation>

Do not include greetings, lesson titles, or number the sections.`
          },
          {
            role: 'user',
            content: 'Give me a Japanese-English language small talk prompt.'
          }
        ]
      });

      const reply = completion.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('🎌 Today\'s Small Talk')
        .setDescription(reply)
        .setFooter({ text: 'Use !smalltalk again for a new one!' });

      await message.reply({ embeds: [embed] });

      // Generate the card image from the smalltalk text
      const imageBuffer = generateCardImage(reply);
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
      const quiz = await generateComprehensionQuiz();
      // Extract the Japanese paragraph and options
      const jpMatch = quiz.match(/JP:\s*(.+)/);
      const options = [];
      for (const letter of ['A', 'B', 'C', 'D']) {
        const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
        if (optMatch) options.push(optMatch[1]);
      }
      const question = jpMatch ? jpMatch[1] : 'Japanese paragraph';
      
      // First send the audio file
      const audioBuffer = await getTTSBuffer(question);
      const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'quiz-audio.mp3' });
      await message.channel.send({
        content: `**Daily Quiz**\n${question}`,
        files: [audioAttachment]
      });

      // Then send the poll separately
      await message.channel.send({
        poll: {
          question: { text: 'What is the most accurate English meaning?' },
          answers: options.map(opt => ({ text: opt.slice(0, 55) }))
        }
      });
    } catch (err) {
      console.error('Error generating quiz:', err);
      message.reply('Sorry, something went wrong while generating the quiz.');
    }
  }
});

// Helper to generate a comprehension quiz using OpenAI
async function generateComprehensionQuiz() {
  const quizPrompt = `You are a Japanese language comprehension quiz generator.
Write a short Japanese paragraph (1-2 sentences).
Then provide 4 English options (A, B, C, D) for its meaning. 
Make the options very similar, but only one is fully accurate. The others should have subtle distinctions (e.g., tense, subject, detail) that make them incorrect.
Each English option must be 55 characters or fewer.
After the options, state the correct answer and a brief explanation.

Format:
JP: <paragraph>
A) <option 1>
B) <option 2>
C) <option 3>
D) <option 4>
Answer: <A/B/C/D>
Explanation: <why>
`;
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: quizPrompt },
      { role: 'user', content: 'Generate a new quiz.' }
    ]
  });
  return completion.choices[0].message.content;
}

// Scheduled daily quiz
schedule.scheduleJob('0 1 * * *', async () => { // 1:00 AM UTC = 10:00 AM JST
  try {
    const quiz = await generateComprehensionQuiz();
    const channel = client.channels.cache.get(QUIZ_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle('📝 Japanese Comprehension Quiz')
      .setDescription(quiz.split('Answer:')[0].trim())
      .setFooter({ text: 'Vote with 🇦 🇧 🇨 🇩! Answer will be revealed soon.' });
    const sent = await channel.send({ embeds: [embed] });
    await sent.react('🇦');
    await sent.react('🇧');
    await sent.react('🇨');
    await sent.react('🇩');
    // Reveal answer after 2 minutes
    setTimeout(async () => {
      const answerMatch = quiz.match(/Answer:\s*([A-D])/);
      const explanationMatch = quiz.match(/Explanation:(.*)$/s);
      let answer = answerMatch ? answerMatch[1] : 'Unknown';
      let explanation = explanationMatch ? explanationMatch[1].trim() : '';
      await channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
    }, 2 * 60 * 1000);
  } catch (err) {
    console.error('Error generating scheduled quiz:', err);
  }
});

client.login(DISCORD_TOKEN);