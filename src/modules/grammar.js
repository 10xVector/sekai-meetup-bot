// src/modules/grammar.js

const { sendLearningCard } = require('../utils/cardGenerator');

const JAPANESE_GRAMMAR_PROMPT = `You are a Japanese language tutor generating a grammar point of the day card.
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

Format the response into exactly 4 clearly separated blocks (using \\n\\n):

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

Do not include greetings, lesson titles, or number the sections.`;

const ENGLISH_GRAMMAR_PROMPT = `You are an English language tutor generating a grammar point of the day card for Japanese learners.
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

Format the response into exactly 4 clearly separated blocks (using \\n\\n):

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

Do not include greetings, lesson titles, or number the sections.`;

async function sendJapaneseGrammar(channel, openai) {
    return sendLearningCard({
        channel,
        openai,
        type: 'grammar',
        language: 'japanese',
        promptSystemRole: JAPANESE_GRAMMAR_PROMPT,
        promptUserMessage: 'Give me a Japanese grammar point of the day.'
    });
}

async function sendEnglishGrammar(channel, openai) {
    return sendLearningCard({
        channel,
        openai,
        type: 'grammar',
        language: 'english',
        promptSystemRole: ENGLISH_GRAMMAR_PROMPT,
        promptUserMessage: 'Give me an English grammar point of the day for Japanese learners.'
    });
}

module.exports = { sendJapaneseGrammar, sendEnglishGrammar };
