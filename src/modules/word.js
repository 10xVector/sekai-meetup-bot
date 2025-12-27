// src/modules/word.js

const { sendLearningCard } = require('../utils/cardGenerator');

const JAPANESE_WORD_PROMPT = `You are a Japanese language tutor generating a word of the day card.
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

Format the response into exactly 4 clearly separated blocks (using \\n\\n):

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

Do not include greetings, lesson titles, or number the sections.`;

const ENGLISH_WORD_PROMPT = `You are an English language tutor generating a word of the day card for Japanese learners.
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

Format the response into exactly 4 clearly separated blocks (using \\n\\n):

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

Do not include greetings, lesson titles, or number the sections.`;

async function sendJapaneseWord(channel, openai) {
    return sendLearningCard({
        channel,
        openai,
        type: 'word',
        language: 'japanese',
        promptSystemRole: JAPANESE_WORD_PROMPT,
        promptUserMessage: 'Give me a Japanese word of the day.'
    });
}

async function sendEnglishWord(channel, openai) {
    return sendLearningCard({
        channel,
        openai,
        type: 'word',
        language: 'english',
        promptSystemRole: ENGLISH_WORD_PROMPT,
        promptUserMessage: 'Give me an English word of the day for Japanese learners.'
    });
}

module.exports = { sendJapaneseWord, sendEnglishWord };
