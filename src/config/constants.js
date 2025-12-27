// src/config/constants.js

const { config } = require('dotenv');
config();

const parseChannelIdList = (value) => {
    if (!value) return [];
    return String(value)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
};

module.exports = {
    JAPANESE_QUIZ_CHANNEL_ID: process.env.JAPANESE_QUIZ_CHANNEL_ID,
    SMALLTALK_CHANNEL_IDS: parseChannelIdList(process.env.SMALLTALK_CHANNEL_IDS),
    JAPANESE_WORD_CHANNEL_ID: process.env.JAPANESE_WORD_CHANNEL_ID,
    JAPANESE_GRAMMAR_CHANNEL_ID: process.env.JAPANESE_GRAMMAR_CHANNEL_ID,

    ENGLISH_QUIZ_CHANNEL_ID: process.env.ENGLISH_QUIZ_CHANNEL_ID,
    ENGLISH_WORD_CHANNEL_ID: process.env.ENGLISH_WORD_CHANNEL_ID,
    ENGLISH_GRAMMAR_CHANNEL_ID: process.env.ENGLISH_GRAMMAR_CHANNEL_ID,

    USE_GEMINI_TTS: true,
    GOOGLE_TTS_MODEL_NAME: 'gemini-2.5-pro-tts',
    GOOGLE_TTS_STYLE_PROMPT: 'You are having a casual conversation with a friend. Say the following in a friendly, clear way.',

    REACTIONS: ['🇦', '🇧', '🇨', '🇩'],
    parseChannelIdList
};
