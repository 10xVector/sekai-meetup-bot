// index.js

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { config } = require('dotenv');
const OpenAI = require('openai');

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

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Error fetching from OpenAI:', err);
      message.reply('Sorry, something went wrong while generating the small talk prompt.');
    }
  }
});

client.login(DISCORD_TOKEN);