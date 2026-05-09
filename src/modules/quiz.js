// src/modules/quiz.js

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getTTSBufferForLongText } = require('../utils/tts');

const JLPT_LEVEL_GUIDANCE = {
    N5: 'JLPT N5 (beginner): use only basic vocabulary (~800 words) and elementary grammar (です/ます, basic particles, present/past tense, ~100 common kanji with furigana not required but kanji should be very common). Sentences should be short and direct.',
    N4: 'JLPT N4 (elementary): use elementary vocabulary (~1500 words) and basic grammar (て-form, conditional たら, potential form, ~300 common kanji). Sentences are short but can include simple connectives.',
    N3: 'JLPT N3 (intermediate): use intermediate vocabulary (~3700 words) and grammar (passive, causative, basic keigo, ~650 kanji). Include some everyday idiomatic expressions.',
    N2: 'JLPT N2 (pre-advanced): use upper-intermediate vocabulary (~6000 words) and nuanced grammar (advanced conjunctions, formal/business expressions, ~1000 kanji). Sentences can be more complex with implied meaning.',
    N1: 'JLPT N1 (advanced): use advanced vocabulary (~10000 words), idiomatic, literary, or formal expressions, and complex grammar including rare patterns (~2000 kanji). Sentences should reflect native-level nuance and abstraction.'
};

const JLPT_PASSAGE_LENGTH = {
    N5: '1-2 short sentences (roughly 30-60 Japanese characters total), matching real JLPT N5 短文',
    N4: '2-3 short sentences (roughly 60-120 characters total), matching real JLPT N4 短文',
    N3: '3-4 sentences (roughly 150-250 characters total), matching real JLPT N3 短文',
    N2: '4-6 sentences (roughly 300-500 characters total), matching real JLPT N2 短文/中文',
    N1: '6-8 sentences (roughly 500-800 characters total), matching real JLPT N1 短文/中文'
};

function pickRandomJlptLevel() {
    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    return levels[Math.floor(Math.random() * levels.length)];
}

async function generateComprehensionQuiz(openai, language = 'japanese') {
    const isEnglish = language === 'english';
    const level = isEnglish ? null : pickRandomJlptLevel();
    const quizPrompt = isEnglish ?
        `You are an English language comprehension quiz generator for Japanese learners.
Generate an English paragraph (2-3 sentences) about a different everyday situation each time (e.g., shopping, school, travel, weather, hobbies, family, work, etc.). Avoid repeating the same topic as previous quizzes.

The paragraph should:
1. Include subtle nuances, implications, or cultural context that require deeper understanding
2. Use a mix of grammar patterns and vocabulary that Japanese learners might encounter in real life
3. Have some ambiguity or room for interpretation in certain aspects

Then provide 4 Japanese options (A, B, C, D) for its meaning. The options should:
1. All be plausible interpretations of the text
2. Differ in subtle ways (e.g., timing, speaker's attitude, implied meaning, cultural context)
3. Include at least one option that's partially correct but misses a key nuance
4. Have only one option that captures all aspects of the text accurately

After the options, state the correct answer and a detailed explanation in Japanese that highlights the key nuances and why the other options are incorrect.

Format:
EN: <paragraph>
A) <option 1 in Japanese>
B) <option 2 in Japanese>
C) <option 3 in Japanese>
D) <option 4 in Japanese>
Answer: <A/B/C/D>
Explanation: <why in Japanese, including key nuances and why other options are incorrect>
` :
        `You are a Japanese language comprehension quiz generator that produces questions in the style of the real JLPT (Japanese-Language Proficiency Test) reading section.

Generate a Japanese passage about a different everyday situation each time (e.g., shopping, school, travel, weather, hobbies, family, work, etc.). Avoid repeating the same topic as previous quizzes.

Target proficiency level: ${level} — ${JLPT_LEVEL_GUIDANCE[level]}
Passage length: ${JLPT_PASSAGE_LENGTH[level]}.
Strictly match the vocabulary, kanji, and grammar to this level. Do NOT use vocabulary or grammar above this level.

The passage should:
1. Be clear and explicit — JLPT passages test whether the reader parsed the grammar and vocabulary, not whether they can guess between plausible interpretations
2. Use grammar patterns and vocabulary appropriate for ${level} learners
3. Have a single correct understanding (no intentional ambiguity)

Then provide 4 English options (A, B, C, D) for the passage's meaning. The options must follow real JLPT conventions:
1. Exactly one option is unambiguously correct and faithfully reflects the passage
2. The 3 wrong options must each contain ONE concrete, identifiable contradiction with the passage — for example: wrong actor, wrong time, wrong location, wrong outcome, wrong reason, wrong quantity, or a negation/affirmation reversal
3. Wrong options must NOT be "almost right" or differ only in subtle nuance, tone, or cultural implication. A reader who understood the passage should be able to eliminate each wrong option by pointing to a specific word or phrase that contradicts it
4. All four options should be similar in length and written in natural English

After the options, state the correct answer and an explanation. For each wrong option, name the specific word/phrase in the passage that contradicts it.

Format:
JP: <passage>
A) <option 1>
B) <option 2>
C) <option 3>
D) <option 4>
Answer: <A/B/C/D>
Explanation: <why the correct answer is right, then for each wrong option the specific contradiction>
`;

    const completion = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        messages: [
            { role: 'system', content: quizPrompt },
            { role: 'user', content: 'Generate a new quiz.' }
        ]
    });
    return { quiz: completion.choices[0].message.content, level };
}

async function sendQuiz(quizResult, channel, quizData, isEnglish = false) {
    if (!quizResult || !channel) return;
    const quiz = typeof quizResult === 'string' ? quizResult : quizResult.quiz;
    const level = typeof quizResult === 'string' ? null : quizResult.level;

    try {
        const textMatch = quiz.match(isEnglish ? /EN:\s*(.+)/ : /JP:\s*(.+)/);
        const question = textMatch ? textMatch[1].trim() : (isEnglish ? 'English paragraph' : 'Japanese paragraph');

        const levelSuffix = level ? ` · ${level}` : '';
        const header = `@everyone **Weekly ${isEnglish ? 'English ' : ''}Quiz${levelSuffix}**\n${question}`;

        try {
            const audioBuffer = await getTTSBufferForLongText(question, isEnglish ? 'en-US' : 'ja-JP');
            const audioAttachment = new AttachmentBuilder(audioBuffer, { name: `${isEnglish ? 'english-' : ''}quiz-audio.mp3` });
            await channel.send({
                content: header,
                files: [audioAttachment]
            });
        } catch (ttsError) {
            console.error('TTS error, sending without audio:', ttsError);
            await channel.send({
                content: header
            });
        }

        const options = [];
        for (const letter of ['A', 'B', 'C', 'D']) {
            const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
            if (optMatch) options.push(optMatch[1].trim());
        }

        const optionLabels = ['a', 'b', 'c', 'd'];
        let optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
        await channel.send(`**Options:**\n${optionsText}`);

        const pollMessage = await channel.send({
            poll: {
                question: { text: isEnglish ? 'この英文の意味として最も適切なのは？' : 'What is the most accurate English meaning?' },
                answers: optionLabels.map(letter => ({ text: letter }))
            }
        });

        const answerMatch = quiz.match(/Answer:\s*([A-D])/i);
        const correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : 'A';

        const quizType = isEnglish ? 'english' : 'japanese';
        const explanationMatch = quiz.match(/Explanation:\s*([\s\S]*?)(?=\n\n|$)/i);
        const explanation = explanationMatch ? explanationMatch[1].trim() : '';

        quizData[quizType] = {
            pollMessage: pollMessage,
            answer: correctAnswer,
            explanation: explanation,
            channel: channel
        };

        setTimeout(async () => {
            await revealPreviousQuizAnswer(quizData, quizType);
        }, 21600000);

    } catch (err) {
        console.error(`Error sending ${isEnglish ? 'English' : 'Japanese'} quiz:`, err);
    }
}

async function revealPreviousQuizAnswer(quizData, quizType) {
    const data = quizData[quizType];
    if (data && data.pollMessage && data.answer) {
        try {
            await data.channel.send(`✅ **Correct answer:** ${data.answer}\n${data.explanation}`);
            await data.pollMessage.edit({
                poll: {
                    question: { text: quizType === 'english' ? 'この英文の意味として最も適切なのは？' : 'What is the most accurate English meaning?' },
                    answers: data.pollMessage.poll.answers,
                    duration: 0
                }
            });
            quizData[quizType] = { pollMessage: null, answer: null, explanation: null, channel: null };
        } catch (answerError) {
            console.error(`Error revealing ${quizType} quiz answer:`, answerError);
        }
    }
}

module.exports = {
    generateComprehensionQuiz,
    sendQuiz,
    revealPreviousQuizAnswer
};
