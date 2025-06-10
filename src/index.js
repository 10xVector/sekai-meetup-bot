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
    name: 'en-US-Neural2-A',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'FEMALE'
  },
  {
    name: 'en-US-Neural2-C',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'FEMALE'
  },
  {
    name: 'en-US-Neural2-D',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'MALE'
  },
  {
    name: 'en-US-Neural2-E',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'MALE'
  },
  {
    name: 'en-US-Neural2-F',
    speakingRate: 1.0,
    pitch: 0,
    ssmlGender: 'FEMALE'
  }
];

async function getTTSBuffer(text) {
  // Randomly select a voice from the available options
  const selectedVoice = JAPANESE_VOICES[Math.floor(Math.random() * JAPANESE_VOICES.length)];
  
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: { 
      languageCode: 'ja-JP',
      name: selectedVoice.name,
      ssmlGender: selectedVoice.ssmlGender
    },
    audioConfig: { 
      audioEncoding: 'MP3',
      speakingRate: selectedVoice.speakingRate,
      pitch: selectedVoice.pitch
    },
  });
  return Buffer.from(response.audioContent, 'binary');
}

async function getEnglishTTSBuffer(text) {
  const request = {
    input: { text },
    voice: { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3' },
  };

  const [response] = await ttsClient.synthesizeSpeech(request);
  return response.audioContent;
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
            content: `You are a language tutor generating a Japanese-English small talk activity formatted like a classroom practice card.

Each time, pick a different theme from a wide range of everyday topics (e.g., food, travel, hobbies, weather, school, work, family, shopping, technology, sports, etc.). Avoid repeating the same theme as previous cards.

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

      // Send the options as a message with a., b., c., d.
      const optionLabels = ['a', 'b', 'c', 'd'];
      let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
      await message.channel.send(
        `**Options:**\n${optionsText}`
      );

      // Send the poll with just a, b, c, d as options
      const pollMsg = await message.channel.send({
        poll: {
          question: { text: 'What is the most accurate English meaning?' },
          answers: optionLabels.map(label => ({ text: label }))
        }
      });

      // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
      const now = new Date();
      const revealTime = new Date(now);
      revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
      
      // If it's already past 00:00 UTC, schedule for next day
      if (now.getUTCHours() >= 0) {
        revealTime.setUTCDate(revealTime.getUTCDate() + 1);
      }

      // Calculate time until reveal
      const timeUntilReveal = revealTime.getTime() - now.getTime();

      // Schedule the reveal
      setTimeout(async () => {
        try {
          console.log('Attempting to reveal answer at scheduled time...');
          
          // Extract answer and explanation before ending the poll
          console.log('Raw quiz content:', quiz);
          const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
          console.log('Answer match:', answerMatch);
          const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
          console.log('Explanation match:', explanationMatch);
          
          let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
          let explanation = explanationMatch ? explanationMatch[1].trim() : '';
          console.log('Extracted answer:', answer);
          console.log('Extracted explanation:', explanation);

          // First send the explanation message
          await message.channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
          console.log('Answer revealed successfully');

          // Then end the poll by editing the message
          await pollMsg.edit({
            poll: {
              question: { text: 'What is the most accurate English meaning?' },
              answers: optionLabels.map(label => ({ text: label })),
              duration: 0 // This effectively ends the poll
            }
          });
          console.log('Poll ended successfully');
        } catch (err) {
          console.error('Error ending poll or revealing answer:', err);
          console.error('Error stack:', err.stack);
          // Try to send an error message to the channel
          try {
            await message.channel.send('❌ There was an error revealing the answer. Please check the logs.');
          } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
          }
        }
      }, timeUntilReveal);
    } catch (err) {
      console.error('Error generating quiz:', err);
      message.reply('Sorry, something went wrong while generating the quiz.');
    }
  }

  if (message.content === '!forcescheduledquiz') {
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

      // Send the options as a message with a., b., c., d.
      const optionLabels = ['a', 'b', 'c', 'd'];
      let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
      await message.channel.send(
        `**Options:**\n${optionsText}`
      );

      // Send the poll with just a, b, c, d as options
      const pollMsg = await message.channel.send({
        poll: {
          question: { text: 'What is the most accurate English meaning?' },
          answers: optionLabels.map(label => ({ text: label }))
        }
      });

      // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
      const now = new Date();
      const revealTime = new Date(now);
      revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
      
      // If it's already past 00:00 UTC, schedule for next day
      if (now.getUTCHours() >= 0) {
        revealTime.setUTCDate(revealTime.getUTCDate() + 1);
      }

      // Calculate time until reveal
      const timeUntilReveal = revealTime.getTime() - now.getTime();

      // Schedule the reveal
      setTimeout(async () => {
        try {
          console.log('Attempting to reveal answer at scheduled time...');
          
          // Extract answer and explanation before ending the poll
          console.log('Raw quiz content:', quiz);
          const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
          console.log('Answer match:', answerMatch);
          const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
          console.log('Explanation match:', explanationMatch);
          
          let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
          let explanation = explanationMatch ? explanationMatch[1].trim() : '';
          console.log('Extracted answer:', answer);
          console.log('Extracted explanation:', explanation);

          // First send the explanation message
          await message.channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
          console.log('Answer revealed successfully');

          // Then end the poll by editing the message
          await pollMsg.edit({
            poll: {
              question: { text: 'What is the most accurate English meaning?' },
              answers: optionLabels.map(label => ({ text: label })),
              duration: 0 // This effectively ends the poll
            }
          });
          console.log('Poll ended successfully');
        } catch (err) {
          console.error('Error ending poll or revealing answer:', err);
          console.error('Error stack:', err.stack);
          // Try to send an error message to the channel
          try {
            await message.channel.send('❌ There was an error revealing the answer. Please check the logs.');
          } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
          }
        }
      }, timeUntilReveal);
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
            content: `You are a language tutor generating a Japanese-English small talk activity formatted like a classroom practice card.

Each time, pick a different theme from a wide range of everyday topics (e.g., food, travel, hobbies, weather, school, work, family, shopping, technology, sports, etc.). Avoid repeating the same theme as previous cards.

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

      // Generate the card image from the smalltalk text
      const imageBuffer = generateCardImage(reply);

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
      const imageBuffer = generateCardImage(reply);
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
      const imageBuffer = generateCardImage(reply);
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
      await message.channel.send("💡 Try creating your own example using this grammar point! Feel free to share it in the chat.");
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
      const imageBuffer = generateCardImage(reply);

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
<Keep it brief and clear:
- Primary meaning (1-2 sentences)
- One common usage example
- One key difference from similar Japanese words>

🎯 Example:
EN: <Natural English sentence using the word>
JP: <Japanese translation>

📌 Notes:
<Keep it concise:
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
      const imageBuffer = generateCardImage(reply);

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
        await channel.send("💡 Try creating your own example sentence using this word! Feel free to share it in the chat.");
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
      const imageBuffer = generateCardImage(reply);

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
      const imageBuffer = generateCardImage(reply);

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
      const imageBuffer = generateCardImage(reply);

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
      const quiz = await generateEnglishComprehensionQuiz();
      // Extract the English paragraph and options
      const enMatch = quiz.match(/EN:\s*(.+)/);
      const options = [];
      for (const letter of ['A', 'B', 'C', 'D']) {
        const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
        if (optMatch) options.push(optMatch[1]);
      }
      const question = enMatch ? enMatch[1] : 'English paragraph';
      
      // Generate and send audio for the English text using English TTS
      const audioBuffer = await getTTSBufferForLongText(question, true);
      const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'english-quiz-audio.mp3' });
      await message.channel.send({
        content: `**Daily English Quiz**\n${question}`,
        files: [audioAttachment]
      });

      // Send the options as a message with a., b., c., d.
      const optionLabels = ['a', 'b', 'c', 'd'];
      let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
      await message.channel.send(
        `**Options:**\n${optionsText}`
      );

      // Send the poll with just a, b, c, d as options
      const pollMsg = await message.channel.send({
        poll: {
          question: { text: 'What is the most accurate Japanese meaning?' },
          answers: optionLabels.map(label => ({ text: label }))
        }
      });

      // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
      const now = new Date();
      const revealTime = new Date(now);
      revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
      
      // If it's already past 00:00 UTC, schedule for next day
      if (now.getUTCHours() >= 0) {
        revealTime.setUTCDate(revealTime.getUTCDate() + 1);
      }

      // Calculate time until reveal
      const timeUntilReveal = revealTime.getTime() - now.getTime();

      // Schedule the reveal
      setTimeout(async () => {
        try {
          console.log('Attempting to reveal answer at scheduled time...');
          
          // Extract answer and explanation before ending the poll
          console.log('Raw quiz content:', quiz);
          const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
          console.log('Answer match:', answerMatch);
          const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
          console.log('Explanation match:', explanationMatch);
          
          let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
          let explanation = explanationMatch ? explanationMatch[1].trim() : '';
          console.log('Extracted answer:', answer);
          console.log('Extracted explanation:', explanation);

          // First send the explanation message
          await message.channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
          console.log('Answer revealed successfully');

          // Then end the poll by editing the message
          await pollMsg.edit({
            poll: {
              question: { text: 'What is the most accurate Japanese meaning?' },
              answers: optionLabels.map(label => ({ text: label })),
              duration: 0 // This effectively ends the poll
            }
          });
          console.log('Poll ended successfully');
        } catch (err) {
          console.error('Error ending poll or revealing answer:', err);
          console.error('Error stack:', err.stack);
          // Try to send an error message to the channel
          try {
            await message.channel.send('❌ There was an error revealing the answer. Please check the logs.');
          } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
          }
        }
      }, timeUntilReveal);
    } catch (err) {
      console.error('Error generating English quiz:', err);
      message.reply('Sorry, something went wrong while generating the English quiz.');
    }
  }

  if (message.content === '!forcescheduledenglishquiz') {
    try {
      const quiz = await generateEnglishComprehensionQuiz();
      const channel = client.channels.cache.get(ENGLISH_QUIZ_CHANNEL_ID);
      if (!channel) {
        console.error('English quiz channel not found:', ENGLISH_QUIZ_CHANNEL_ID);
        return;
      }
      // Extract the English paragraph and options
      const enMatch = quiz.match(/EN:\s*(.+)/);
      const options = [];
      for (const letter of ['A', 'B', 'C', 'D']) {
        const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
        if (optMatch) options.push(optMatch[1]);
      }
      const question = enMatch ? enMatch[1] : 'English paragraph';

      // Generate and send audio for the English text using English TTS
      const audioBuffer = await getTTSBufferForLongText(question, true);
      const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'english-quiz-audio.mp3' });
      await channel.send({
        content: `@everyone **Daily English Quiz**\n${question}`,
        files: [audioAttachment]
      });

      // Send the options as a message with a., b., c., d.
      const optionLabels = ['a', 'b', 'c', 'd'];
      let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
      await channel.send(
        `**Options:**\n${optionsText}`
      );

      // Send the poll with just a, b, c, d as options
      const pollMsg = await channel.send({
        poll: {
          question: { text: 'What is the most accurate Japanese meaning?' },
          answers: optionLabels.map(label => ({ text: label }))
        }
      });

      // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
      const now = new Date();
      const revealTime = new Date(now);
      revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
      
      // If it's already past 00:00 UTC, schedule for next day
      if (now.getUTCHours() >= 0) {
        revealTime.setUTCDate(revealTime.getUTCDate() + 1);
      }

      // Calculate time until reveal
      const timeUntilReveal = revealTime.getTime() - now.getTime();

      // Schedule the reveal
      setTimeout(async () => {
        try {
          console.log('Attempting to reveal answer at scheduled time...');
          
          // Extract answer and explanation before ending the poll
          console.log('Raw quiz content:', quiz);
          const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
          console.log('Answer match:', answerMatch);
          const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
          console.log('Explanation match:', explanationMatch);
          
          let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
          let explanation = explanationMatch ? explanationMatch[1].trim() : '';
          console.log('Extracted answer:', answer);
          console.log('Extracted explanation:', explanation);

          // First send the explanation message
          await channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
          console.log('Answer revealed successfully');

          // Then end the poll by editing the message
          await pollMsg.edit({
            poll: {
              question: { text: 'What is the most accurate Japanese meaning?' },
              answers: optionLabels.map(label => ({ text: label })),
              duration: 0 // This effectively ends the poll
            }
          });
          console.log('Poll ended successfully');
        } catch (err) {
          console.error('Error ending poll or revealing answer:', err);
          console.error('Error stack:', err.stack);
          // Try to send an error message to the channel
          try {
            await channel.send('❌ There was an error revealing the answer. Please check the logs.');
          } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
          }
        }
      }, timeUntilReveal);
      message.reply('✅ English quiz has been sent to the configured channel!');
    } catch (err) {
      console.error('Error generating forced scheduled English quiz:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled English quiz.');
    }
  }

  if (message.content === '!forcescheduledjapanesequiz') {
    try {
      const quiz = await generateComprehensionQuiz();
      const channel = client.channels.cache.get(JAPANESE_QUIZ_CHANNEL_ID);
      if (!channel) {
        console.error('Quiz channel not found:', JAPANESE_QUIZ_CHANNEL_ID);
        return;
      }
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
      await channel.send({
        content: `@everyone **Daily Quiz**\n${question}`,
        files: [audioAttachment]
      });

      // Send the options as a message with a., b., c., d.
      const optionLabels = ['a', 'b', 'c', 'd'];
      let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
      await channel.send(
        `**Options:**\n${optionsText}`
      );

      // Send the poll with just a, b, c, d as options
      const pollMsg = await channel.send({
        poll: {
          question: { text: 'What is the most accurate English meaning?' },
          answers: optionLabels.map(label => ({ text: label }))
        }
      });

      // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
      const now = new Date();
      const revealTime = new Date(now);
      revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
      
      // If it's already past 00:00 UTC, schedule for next day
      if (now.getUTCHours() >= 0) {
        revealTime.setUTCDate(revealTime.getUTCDate() + 1);
      }

      // Calculate time until reveal
      const timeUntilReveal = revealTime.getTime() - now.getTime();

      // Schedule the reveal
      setTimeout(async () => {
        try {
          console.log('Attempting to reveal answer at scheduled time...');
          
          // Extract answer and explanation before ending the poll
          console.log('Raw quiz content:', quiz);
          const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
          console.log('Answer match:', answerMatch);
          const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
          console.log('Explanation match:', explanationMatch);
          
          let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
          let explanation = explanationMatch ? explanationMatch[1].trim() : '';
          console.log('Extracted answer:', answer);
          console.log('Extracted explanation:', explanation);

          // First send the explanation message
          await channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
          console.log('Answer revealed successfully');

          // Then end the poll by editing the message
          await pollMsg.edit({
            poll: {
              question: { text: 'What is the most accurate English meaning?' },
              answers: optionLabels.map(label => ({ text: label })),
              duration: 0 // This effectively ends the poll
            }
          });
          console.log('Poll ended successfully');
        } catch (err) {
          console.error('Error ending poll or revealing answer:', err);
          console.error('Error stack:', err.stack);
          // Try to send an error message to the channel
          try {
            await channel.send('❌ There was an error revealing the answer. Please check the logs.');
          } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
          }
        }
      }, timeUntilReveal);
      message.reply('✅ Japanese quiz has been sent to the configured channel!');
    } catch (err) {
      console.error('Error generating forced scheduled Japanese quiz:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled Japanese quiz.');
    }
  }
});

// Helper to generate a comprehension quiz using OpenAI
async function generateComprehensionQuiz() {
  const quizPrompt = `You are a Japanese language comprehension quiz generator.
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

// Helper function to split text into chunks for TTS
async function getTTSBufferForLongText(text, isEnglish = false) {
  // Split text into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const audioBuffers = [];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence) {
      const buffer = isEnglish ? 
        await getEnglishTTSBuffer(trimmedSentence) : 
        await getTTSBuffer(trimmedSentence);
      audioBuffers.push(buffer);
    }
  }

  // Combine all audio buffers
  return Buffer.concat(audioBuffers);
}

async function generateEnglishComprehensionQuiz() {
  const quizPrompt = `You are an English language comprehension quiz generator for Japanese learners.
Generate an English paragraph (2-3 short sentences) about a different everyday situation each time (e.g., shopping, school, travel, weather, hobbies, family, work, etc.). Avoid repeating the same topic as previous quizzes.

IMPORTANT: Keep each sentence short and concise (under 20 words). This is crucial for text-to-speech processing.

The paragraph should:
1. Include subtle nuances, implications, or cultural context that require deeper understanding
2. Use a mix of grammar patterns and vocabulary that Japanese learners might find challenging
3. Have some ambiguity or room for interpretation in certain aspects

Then provide 4 Japanese options (A, B, C, D) for its meaning. The options should:
1. All be plausible interpretations of the text
2. Differ in subtle ways (e.g., timing, speaker's attitude, implied meaning, cultural context)
3. Include at least one option that's partially correct but misses a key nuance
4. Have only one option that captures all aspects of the text accurately

After the options, state the correct answer and provide a detailed explanation in Japanese that highlights:
- The key nuances and why the other options are incorrect
- Any cultural context or implications that might be unfamiliar to Japanese learners
- Common mistakes Japanese learners might make with this type of text
- How the English expressions differ from similar Japanese expressions

Format:
EN: <paragraph>
A) <option 1 in Japanese>
B) <option 2 in Japanese>
C) <option 3 in Japanese>
D) <option 4 in Japanese>
Answer: <A/B/C/D>
Explanation: <detailed explanation in Japanese>
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

// Scheduled daily quiz
schedule.scheduleJob('0 1 * * *', async () => { // 1:00 AM UTC = 10:00 AM JST
  try {
    const quiz = await generateComprehensionQuiz();
    const channel = client.channels.cache.get(JAPANESE_QUIZ_CHANNEL_ID);
    if (!channel) {
      console.error('Quiz channel not found:', JAPANESE_QUIZ_CHANNEL_ID);
      return;
    }
    // Extract the Japanese sentence and options
    const jpMatch = quiz.match(/JP:\s*(.+)/);
    const options = [];
    for (const letter of ['A', 'B', 'C', 'D']) {
      const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
      if (optMatch) options.push(optMatch[1]);
    }
    const question = jpMatch ? jpMatch[1] : 'Japanese sentence';

    // Send the audio file
    const audioBuffer = await getTTSBuffer(question);
    const audioAttachment = new AttachmentBuilder(audioBuffer, { name: 'quiz-audio.mp3' });
    await channel.send({
      content: `@everyone **Daily Quiz**\n${question}`,
      files: [audioAttachment]
    });

    // Send the options as a message with a., b., c., d.
    const optionLabels = ['a', 'b', 'c', 'd'];
    let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
    await channel.send(
      `**Options:**\n${optionsText}`
    );

    // Send the poll with just a, b, c, d as options
    const pollMsg = await channel.send({
      poll: {
        question: { text: 'What is the most accurate English meaning?' },
        answers: optionLabels.map(label => ({ text: label }))
      }
    });

    // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
    const now = new Date();
    const revealTime = new Date(now);
    revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
    
    // If it's already past 00:00 UTC, schedule for next day
    if (now.getUTCHours() >= 0) {
      revealTime.setUTCDate(revealTime.getUTCDate() + 1);
    }

    // Calculate time until reveal
    const timeUntilReveal = revealTime.getTime() - now.getTime();

    // Schedule the reveal
    setTimeout(async () => {
      try {
        console.log('Attempting to reveal answer at scheduled time...');
        
        // Extract answer and explanation before ending the poll
        console.log('Raw quiz content:', quiz);
        const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
        console.log('Answer match:', answerMatch);
        const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
        console.log('Explanation match:', explanationMatch);
        
        let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
        let explanation = explanationMatch ? explanationMatch[1].trim() : '';
        console.log('Extracted answer:', answer);
        console.log('Extracted explanation:', explanation);

        // First send the explanation message
        await channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
        console.log('Answer revealed successfully');

        // Then end the poll by editing the message
        await pollMsg.edit({
          poll: {
            question: { text: 'What is the most accurate English meaning?' },
            answers: optionLabels.map(label => ({ text: label })),
            duration: 0 // This effectively ends the poll
          }
        });
        console.log('Poll ended successfully');
      } catch (err) {
        console.error('Error ending poll or revealing answer:', err);
        console.error('Error stack:', err.stack);
        // Try to send an error message to the channel
        try {
          await channel.send('❌ There was an error revealing the answer. Please check the logs.');
        } catch (sendErr) {
          console.error('Failed to send error message:', sendErr);
        }
      }
    }, timeUntilReveal);
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
    const imageBuffer = generateCardImage(reply);

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
    const imageBuffer = generateCardImage(reply);

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
    await channel.send("💡 Try creating your own example using this grammar point! Feel free to share it in the chat.");
  } catch (err) {
    console.error('Error generating scheduled grammar:', err);
  }
});

// Add new scheduled job for English quiz
schedule.scheduleJob('0 4 * * *', async () => { // 4:00 AM UTC = 1:00 PM JST
  try {
    const quiz = await generateEnglishComprehensionQuiz();
    const channel = client.channels.cache.get(ENGLISH_QUIZ_CHANNEL_ID);
    if (!channel) {
      console.error('English quiz channel not found:', ENGLISH_QUIZ_CHANNEL_ID);
      return;
    }
    // Extract the English paragraph and options
    const enMatch = quiz.match(/EN:\s*(.+)/);
    const options = [];
    for (const letter of ['A', 'B', 'C', 'D']) {
      const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
      if (optMatch) options.push(optMatch[1]);
    }
    const question = enMatch ? enMatch[1] : 'English paragraph';

    await channel.send({
      content: `@everyone **Daily English Quiz**\n${question}`
    });

    // Send the options as a message with a., b., c., d.
    const optionLabels = ['a', 'b', 'c', 'd'];
    let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
    await channel.send(
      `**Options:**\n${optionsText}`
    );

    // Send the poll with just a, b, c, d as options
    const pollMsg = await channel.send({
      poll: {
        question: { text: 'What is the most accurate Japanese meaning?' },
        answers: optionLabels.map(label => ({ text: label }))
      }
    });

    // Schedule answer reveal for 9 AM JST (00:00 UTC) the next day
    const now = new Date();
    const revealTime = new Date(now);
    revealTime.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC (9 AM JST)
    
    // If it's already past 00:00 UTC, schedule for next day
    if (now.getUTCHours() >= 0) {
      revealTime.setUTCDate(revealTime.getUTCDate() + 1);
    }

    // Calculate time until reveal
    const timeUntilReveal = revealTime.getTime() - now.getTime();

    // Schedule the reveal
    setTimeout(async () => {
      try {
        console.log('Attempting to reveal answer at scheduled time...');
        
        // Extract answer and explanation before ending the poll
        console.log('Raw quiz content:', quiz);
        const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
        console.log('Answer match:', answerMatch);
        const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
        console.log('Explanation match:', explanationMatch);
        
        let answer = answerMatch ? answerMatch[1].toUpperCase() : 'Unknown';
        let explanation = explanationMatch ? explanationMatch[1].trim() : '';
        console.log('Extracted answer:', answer);
        console.log('Extracted explanation:', explanation);

        // First send the explanation message
        await channel.send(`✅ **Correct answer:** ${answer}\n${explanation}`);
        console.log('Answer revealed successfully');

        // Then end the poll by editing the message
        await pollMsg.edit({
          poll: {
            question: { text: 'What is the most accurate Japanese meaning?' },
            answers: optionLabels.map(label => ({ text: label })),
            duration: 0 // This effectively ends the poll
          }
        });
        console.log('Poll ended successfully');
      } catch (err) {
        console.error('Error ending poll or revealing answer:', err);
        console.error('Error stack:', err.stack);
        // Try to send an error message to the channel
        try {
          await channel.send('❌ There was an error revealing the answer. Please check the logs.');
        } catch (sendErr) {
          console.error('Failed to send error message:', sendErr);
        }
      }
    }, timeUntilReveal);
  } catch (err) {
    console.error('Error generating scheduled English quiz:', err);
  }
});

// Scheduled daily English word
schedule.scheduleJob('0 5 * * *', async () => { // 5:00 AM UTC = 2:00 PM JST
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
<Keep it brief and clear:
- Primary meaning (1-2 sentences)
- One common usage example
- One key difference from similar Japanese words>

🎯 Example:
EN: <Natural English sentence using the word>
JP: <Japanese translation>

📌 Notes:
<Keep it concise:
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
    const imageBuffer = generateCardImage(reply);

    // Send to the English word channel
    const channel = client.channels.cache.get(ENGLISH_WORD_CHANNEL_ID);
    if (!channel) {
      console.error('English word channel not found:', ENGLISH_WORD_CHANNEL_ID);
      return;
    }

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
    await channel.send("💡 Try creating your own example sentence using this word! Feel free to share it in the chat.");
  } catch (err) {
    console.error('Error generating scheduled English word:', err);
  }
});

// Scheduled daily English grammar
schedule.scheduleJob('0 6 * * *', async () => { // 6:00 AM UTC = 3:00 PM JST
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
    const imageBuffer = generateCardImage(reply);

    // Send to the English grammar channel
    const channel = client.channels.cache.get(ENGLISH_GRAMMAR_CHANNEL_ID);
    if (!channel) {
      console.error('English grammar channel not found:', ENGLISH_GRAMMAR_CHANNEL_ID);
      return;
    }

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
  } catch (err) {
    console.error('Error generating scheduled English grammar:', err);
  }
});

client.login(DISCORD_TOKEN);