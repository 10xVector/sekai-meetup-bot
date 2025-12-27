// src/utils/tts.js

const textToSpeech = require('@google-cloud/text-to-speech');
const https = require('https');
const { GoogleAuth } = require('google-auth-library');
const { JAPANESE_VOICES, ENGLISH_VOICES, GEMINI_SPEAKERS } = require('../config/voices');
const { USE_GEMINI_TTS, GOOGLE_TTS_MODEL_NAME, GOOGLE_TTS_STYLE_PROMPT } = require('../config/constants');

const ttsClient = new textToSpeech.TextToSpeechClient();
const googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

function isGeminiTtsEnabled() {
    return USE_GEMINI_TTS && GOOGLE_TTS_MODEL_NAME.toLowerCase().startsWith('gemini-');
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickChirpFallbackVoice(languageCode) {
    if (String(languageCode).toLowerCase().startsWith('ja')) {
        return pickRandom(JAPANESE_VOICES);
    }
    return pickRandom(ENGLISH_VOICES);
}

async function synthesizeSpeechBuffer({
    text,
    languageCode,
    voiceName,
    ssmlGender,
    speakingRate,
    pitch,
    audioEncoding = 'MP3',
    debug = false
}) {
    const useGemini = isGeminiTtsEnabled();
    const geminiLanguageCode = String(languageCode || '').toLowerCase();

    async function postJson(url, headers, bodyObj) {
        const body = JSON.stringify(bodyObj);
        return await new Promise((resolve, reject) => {
            const req = https.request(
                url,
                {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                },
                res => {
                    const chunks = [];
                    res.on('data', d => chunks.push(d));
                    res.on('end', () => {
                        const raw = Buffer.concat(chunks).toString('utf8');
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                resolve(JSON.parse(raw));
                            } catch (e) {
                                reject(new Error(`Gemini REST JSON parse error: ${e.message}`));
                            }
                            return;
                        }
                        reject(new Error(`Gemini REST HTTP ${res.statusCode}: ${raw}`));
                    });
                }
            );
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    const buildRequest = ({ gemini, name, gender }) => ({
        input: gemini
            ? { prompt: GOOGLE_TTS_STYLE_PROMPT || 'Say the following.', text }
            : { text },
        voice: gemini
            ? { languageCode: geminiLanguageCode, name, modelName: GOOGLE_TTS_MODEL_NAME }
            : { languageCode, name, ssmlGender: gender },
        audioConfig: {
            audioEncoding,
            ...(typeof speakingRate === 'number' ? { speakingRate } : {}),
            ...(typeof pitch === 'number' ? { pitch } : {})
        }
    });

    try {
        let audioBuffer;
        if (useGemini) {
            const token = await googleAuth.getAccessToken();
            const request = buildRequest({ gemini: true, name: voiceName, gender: ssmlGender });
            const resJson = await postJson(
                'https://texttospeech.googleapis.com/v1/text:synthesize',
                { Authorization: `Bearer ${token}` },
                request
            );
            audioBuffer = Buffer.from(resJson.audioContent, 'base64');
        } else {
            const request = buildRequest({ gemini: false, name: voiceName, gender: ssmlGender });
            const [response] = await ttsClient.synthesizeSpeech(request);
            audioBuffer = Buffer.isBuffer(response.audioContent)
                ? response.audioContent
                : Buffer.from(response.audioContent, 'base64');
        }

        if (debug) {
            return {
                audioBuffer,
                meta: {
                    mode: useGemini ? 'gemini' : 'chirp',
                    modelName: useGemini ? GOOGLE_TTS_MODEL_NAME : null,
                    prompt: useGemini ? (GOOGLE_TTS_STYLE_PROMPT || 'Say the following.') : null,
                    languageCode: useGemini ? geminiLanguageCode : languageCode,
                    voiceName: voiceName
                }
            };
        }
        return audioBuffer;
    } catch (e) {
        if (!useGemini) throw e;

        console.warn(`Gemini TTS failed, falling back to Chirp model: ${e.message}`);

        const fallback = pickChirpFallbackVoice(languageCode);
        const fallbackReq = buildRequest({ gemini: false, name: fallback.name, gender: fallback.ssmlGender });
        const [fallbackRes] = await ttsClient.synthesizeSpeech(fallbackReq);
        const audioBuffer = Buffer.isBuffer(fallbackRes.audioContent)
            ? fallbackRes.audioContent
            : Buffer.from(fallbackRes.audioContent, 'base64');

        if (debug) {
            return {
                audioBuffer,
                meta: {
                    mode: 'chirp_fallback',
                    modelName: GOOGLE_TTS_MODEL_NAME,
                    prompt: GOOGLE_TTS_STYLE_PROMPT || 'Say the following.',
                    languageCode: geminiLanguageCode,
                    attemptedVoiceName: voiceName,
                    fallbackVoiceName: fallback.name,
                    errorMessage: e?.message ? String(e.message) : String(e)
                }
            };
        }
        return audioBuffer;
    }
}

async function getTTSBuffer(text, language = 'ja-JP') {
    const isEnglish = language.startsWith('en');
    if (isGeminiTtsEnabled()) {
        const speaker = pickRandom(GEMINI_SPEAKERS);
        return synthesizeSpeechBuffer({
            text,
            languageCode: language,
            voiceName: speaker,
            ssmlGender: 'NEUTRAL',
            speakingRate: 1.0,
            pitch: 0.0,
            audioEncoding: 'MP3'
        });
    }

    const selectedVoice = pickRandom(isEnglish ? ENGLISH_VOICES : JAPANESE_VOICES);
    return synthesizeSpeechBuffer({
        text,
        languageCode: language,
        voiceName: selectedVoice.name,
        ssmlGender: selectedVoice.ssmlGender,
        speakingRate: selectedVoice.speakingRate || 1.0,
        pitch: selectedVoice.pitch || 0,
        audioEncoding: 'MP3'
    });
}

async function getTTSBufferDebug(text, language = 'ja-JP') {
    const isEnglish = language.startsWith('en');
    if (isGeminiTtsEnabled()) {
        const speaker = pickRandom(GEMINI_SPEAKERS);
        return await synthesizeSpeechBuffer({
            text,
            languageCode: language,
            voiceName: speaker,
            ssmlGender: 'NEUTRAL',
            speakingRate: 1.0,
            pitch: 0.0,
            audioEncoding: 'MP3',
            debug: true
        });
    }

    const voice = pickRandom(isEnglish ? ENGLISH_VOICES : JAPANESE_VOICES);
    return await synthesizeSpeechBuffer({
        text,
        languageCode: language,
        voiceName: voice.name,
        ssmlGender: voice.ssmlGender,
        speakingRate: voice.speakingRate || 1.0,
        pitch: voice.pitch || 0,
        audioEncoding: 'MP3',
        debug: true
    });
}

async function getTTSBufferForLongText(text, language = 'ja-JP') {
    const isEnglish = language.startsWith('en');
    const useGemini = isGeminiTtsEnabled();
    const selectedGeminiSpeaker = useGemini ? pickRandom(GEMINI_SPEAKERS) : null;
    const selectedChirpVoice = useGemini ? null : pickRandom(isEnglish ? ENGLISH_VOICES : JAPANESE_VOICES);

    const MAX_SINGLE_REQUEST = 4000;

    if (text.length <= MAX_SINGLE_REQUEST) {
        if (useGemini) {
            return await synthesizeSpeechBuffer({
                text,
                languageCode: language,
                voiceName: selectedGeminiSpeaker,
                ssmlGender: 'NEUTRAL',
                speakingRate: 1.0,
                pitch: 0.0,
                audioEncoding: 'MP3'
            });
        }

        return await synthesizeSpeechBuffer({
            text,
            languageCode: language,
            voiceName: selectedChirpVoice.name,
            ssmlGender: selectedChirpVoice.ssmlGender,
            speakingRate: selectedChirpVoice.speakingRate || 1.0,
            pitch: selectedChirpVoice.pitch || 0,
            audioEncoding: 'MP3'
        });
    }

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const audioBuffers = [];

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence) {
            const buffer = useGemini
                ? await synthesizeSpeechBuffer({
                    text: trimmedSentence,
                    languageCode: language,
                    voiceName: selectedGeminiSpeaker,
                    ssmlGender: 'NEUTRAL',
                    speakingRate: 1.0,
                    pitch: 0.0,
                    audioEncoding: 'MP3'
                })
                : await synthesizeSpeechBuffer({
                    text: trimmedSentence,
                    languageCode: language,
                    voiceName: selectedChirpVoice.name,
                    ssmlGender: selectedChirpVoice.ssmlGender,
                    speakingRate: selectedChirpVoice.speakingRate || 1.0,
                    pitch: selectedChirpVoice.pitch || 0,
                    audioEncoding: 'MP3'
                });
            audioBuffers.push(buffer);
        }
    }

    return Buffer.concat(audioBuffers);
}

module.exports = {
    getTTSBuffer,
    getTTSBufferDebug,
    getTTSBufferForLongText,
    getTTSBufferWithVoice: synthesizeSpeechBuffer
};
