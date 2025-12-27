// src/modules/smalltalk.js

const { EmbedBuilder } = require('discord.js');

const SMALLTALK_PROMPT = `You are a language tutor generating a Japanese-English small talk activity with grammar practice.

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

Format the response into exactly 2 clearly separated blocks (using \\n\\n):

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

Keep everything concise, natural, and conversational.`;

async function generateSmallTalk(openai) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SMALLTALK_PROMPT },
            { role: 'user', content: 'Generate a Japanese-English small talk prompt with an interesting, varied topic. Avoid repetitive themes like basic sports or ice cream.' }
        ]
    });

    return completion.choices[0].message.content;
}

async function sendSmallTalk(channel, reply) {
    const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setDescription(reply)
        .setFooter({ text: 'Use !smalltalk again for a new one!' });

    await channel.send({ embeds: [embed] });
}

module.exports = { generateSmallTalk, sendSmallTalk };
