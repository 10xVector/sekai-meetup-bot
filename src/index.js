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

          // Then end the poll
          await pollMsg.end();
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

          // Then end the poll
          await pollMsg.end();
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

  if (message.content === '!forcescheduledgrammar') {
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

      // Send to the grammar channel or current channel if no channel ID is set
      const channel = JAPANESE_GRAMMAR_CHANNEL_ID ? 
        client.channels.cache.get(JAPANESE_GRAMMAR_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'grammar-card.png' }] });
      }
    } catch (err) {
      console.error('Error generating forced scheduled grammar:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled grammar of the day.');
    }
  }

  if (message.content === '!forcescheduledword') {
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

      // Send to the word channel or current channel if no channel ID is set
      const channel = JAPANESE_WORD_CHANNEL_ID ? 
        client.channels.cache.get(JAPANESE_WORD_CHANNEL_ID) : 
        message.channel;

      if (channel) {
        await channel.send({ files: [{ attachment: imageBuffer, name: 'word-card.png' }] });
      }
    } catch (err) {
      console.error('Error generating forced scheduled word:', err);
      message.reply('Sorry, something went wrong while generating the forced scheduled word of the day.');
    }
  }

  // Add new say command
  if (message.content.startsWith('!say ')) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    try {
      // Parse the command: !say <channelId> <message>
      const args = message.content.slice(5).trim().split(' ');
      const channelId = args[0];
      const messageContent = args.slice(1).join(' ');

      if (!channelId || !messageContent) {
        return message.reply('❌ Usage: !say <channelId> <message>');
      }

      const targetChannel = client.channels.cache.get(channelId);
      if (!targetChannel) {
        return message.reply('❌ Channel not found.');
      }

      // Send the message to the specified channel
      await targetChannel.send(messageContent);
      
      // Confirm to the command user
      await message.reply(`✅ Message sent to channel ${channelId}`);
    } catch (err) {
      console.error('Error sending message:', err);
      message.reply('❌ There was an error sending the message.');
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

// Scheduled daily quiz
schedule.scheduleJob('0 1 * * *', async () => { // 1:00 AM UTC = 10:00 AM JST
  try {
    const quiz = await generateComprehensionQuiz();
    const channel = client.channels.cache.get(JAPANESE_QUIZ_CHANNEL_ID);
    if (!channel) return;
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

        // Then end the poll
        await pollMsg.end();
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

// Scheduled weekly smalltalk
schedule.scheduleJob('0 1 * * 1', async () => { // Every Monday at 10:00 AM JST (01:00 UTC)
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
  } catch (err) {
    console.error('Error generating scheduled smalltalk:', err);
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

    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setDescription(reply)
      .setFooter({ text: 'Use !smalltalk again for a new one!' });

    await message.reply({ embeds: [embed] });

    // Generate the card image from the word text
    const imageBuffer = generateCardImage(reply);

    // Send to the word channel
    const channel = client.channels.cache.get(JAPANESE_WORD_CHANNEL_ID);
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

    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setDescription(reply)
      .setFooter({ text: 'Use !smalltalk again for a new one!' });

    await message.reply({ embeds: [embed] });

    // Generate the card image from the grammar text
    const imageBuffer = generateCardImage(reply);

    // Send to the grammar channel
    const channel = client.channels.cache.get(JAPANESE_GRAMMAR_CHANNEL_ID);
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
    console.error('Error generating scheduled grammar:', err);
  }
});

client.login(DISCORD_TOKEN);