// src/config/voices.js

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

const GEMINI_SPEAKERS = [
    'Kore',
    'Aoede',
    'Callirrhoe',
    'Achernar',
    'Achird',
    'Algenib',
    'Autonoe',
    'Charon',
    'Despina',
    'Enceladus',
    'Erinome',
    'Fenrir'
];

module.exports = {
    JAPANESE_VOICES,
    ENGLISH_VOICES,
    GEMINI_SPEAKERS
};
