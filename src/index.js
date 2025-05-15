// index.js

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { config } = require('dotenv');
const OpenAI = require('openai');
const schedule = require('node-schedule');
const Parser = require('rss-parser');

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

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

      // Extract the theme or question for the image prompt
      const themeMatch = reply.match(/❓ Question:\nJP: (.*?)\n/);
      const imagePrompt = themeMatch ? `An illustration representing: ${themeMatch[1]}` : 'Japanese-English language small talk illustration';

      // Generate image with OpenAI
      const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024'
      });
      const imageUrl = imageResponse.data[0].url;

      // Send the image
      await message.channel.send({ files: [imageUrl] });
    } catch (err) {
      console.error('Error fetching from OpenAI:', err);
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
});

client.login(DISCORD_TOKEN);