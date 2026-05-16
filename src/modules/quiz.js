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

const TOEIC_LEVEL_GUIDANCE = {
    '400': 'TOEIC 400-band (basic, ~CEFR A2): simple present/past tense, common everyday vocabulary (~1500 words), short straightforward sentences. Topics: shopping, daily schedules, basic office tasks.',
    '600': 'TOEIC 600-band (intermediate, ~CEFR B1): present perfect, modal verbs, ~3000 word vocabulary. Topics: meetings, travel, customer service, basic reports.',
    '800': 'TOEIC 800-band (upper-intermediate, ~CEFR B2): conditionals, passive voice, phrasal verbs, ~5000 word vocabulary including business terminology. Topics: business correspondence, marketing, HR, finance.',
    '900': 'TOEIC 900-band (advanced, ~CEFR C1): complex business and academic content, nuanced grammar, idiomatic expressions, ~8000 word vocabulary. Topics: contracts, M&A, technical reports, executive briefings.'
};

const POLL_QUESTION_EN = 'Choose the best answer.';
const POLL_QUESTION_JP = 'What is the most accurate English meaning?';

function pickRandomJlptLevel() {
    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    return levels[Math.floor(Math.random() * levels.length)];
}

function pickRandomToeicLevel() {
    const levels = ['400', '600', '800', '900'];
    return levels[Math.floor(Math.random() * levels.length)];
}

function pickRandomToeicPart() {
    // Part 5 (incomplete sentences) and Part 7 (reading comprehension).
    // Part 6 (multi-blank text completion) is skipped — doesn't fit a single Discord poll.
    const parts = ['5', '7'];
    return parts[Math.floor(Math.random() * parts.length)];
}

async function generateComprehensionQuiz(openai, language = 'japanese') {
    const isEnglish = language === 'english';
    const level = isEnglish ? pickRandomToeicLevel() : pickRandomJlptLevel();
    const part = isEnglish ? pickRandomToeicPart() : null;

    let quizPrompt;
    if (isEnglish && part === '5') {
        quizPrompt = `You are a TOEIC quiz generator producing Part 5 (Incomplete Sentences) questions for Japanese learners of English.

Target proficiency band: ${level} — ${TOEIC_LEVEL_GUIDANCE[level]}

Generate ONE English sentence with exactly one blank shown as ____ (four underscores). Topics should match real TOEIC contexts: business correspondence, office life, travel, schedules, customer service, meetings, reports.

The blank should test ONE of the following grammar/vocabulary categories (choose one and announce it):
- Verb tense or aspect
- Voice (active/passive)
- Subject-verb agreement
- Word form (noun / verb / adjective / adverb derivation)
- Preposition
- Conjunction or connector
- Vocabulary choice (commonly confused words, business vocabulary)
- Pronoun
- Article

Then provide 4 English options (A, B, C, D). Conventions:
1. Exactly one option is unambiguously correct
2. The 3 wrong options must be plausible at first glance — same word family, similar form, or commonly confused — but each must contain a specific grammatical or semantic error a careful reader can identify
3. All four options should be similar in length and register

Format:
TYPE: <category from the list above>
EN: <sentence with ____ blank>
A) <option 1>
B) <option 2>
C) <option 3>
D) <option 4>
Answer: <A/B/C/D>
Explanation: <Write this section in Japanese (the audience is Japanese learners). Explain why the correct answer is right, then for each wrong option name the specific grammatical or semantic error. You may quote English words or phrases from the sentence/options verbatim.>
`;
    } else if (isEnglish) {
        quizPrompt = `You are a TOEIC quiz generator producing Part 7 (Reading Comprehension) questions for Japanese learners of English.

Target proficiency band: ${level} — ${TOEIC_LEVEL_GUIDANCE[level]}

Generate a short English passage in a real TOEIC format. Pick one format: email, memo, notice, advertisement, article, schedule, or letter.

Passage length: 60-150 words, calibrated to the band above.

Then write ONE question about the passage. Use one of these question types:
- Main idea / purpose ("What is the purpose of...")
- Specific detail ("When/Where/Who/How much...")
- Inference ("What is implied about...")
- Vocabulary in context ("The word X most nearly means...")

Then provide 4 English options (A, B, C, D). Conventions:
1. Exactly one option is unambiguously correct based on what the passage actually says
2. The 3 wrong options must each contain ONE concrete contradiction or error: wrong actor, wrong time, wrong amount, wrong reason, or stating something not present in the passage
3. Wrong options must NOT be vague or "almost right" — a careful reader who understood the passage can eliminate each one by pointing to a specific phrase
4. All four options should be similar in length

Format:
TYPE: <email/memo/notice/advertisement/article/schedule/letter>
EN: <passage>
QUESTION: <question text>
A) <option 1>
B) <option 2>
C) <option 3>
D) <option 4>
Answer: <A/B/C/D>
Explanation: <Write this section in Japanese (the audience is Japanese learners). Explain why the correct answer is right, then for each wrong option name the specific contradiction. You may quote English words or phrases from the passage/options verbatim.>
`;
    } else {
        quizPrompt = `You are a Japanese language comprehension quiz generator that produces questions in the style of the real JLPT (Japanese-Language Proficiency Test) reading section.

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
    }

    const completion = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        messages: [
            { role: 'system', content: quizPrompt },
            { role: 'user', content: 'Generate a new quiz.' }
        ]
    });
    return { quiz: completion.choices[0].message.content, level, part };
}

async function sendQuiz(quizResult, channel, quizData, isEnglish = false) {
    if (!quizResult || !channel) return;
    const quiz = typeof quizResult === 'string' ? quizResult : quizResult.quiz;
    const level = typeof quizResult === 'string' ? null : quizResult.level;
    const part = typeof quizResult === 'string' ? null : quizResult.part;

    try {
        // Multi-line safe extraction — captures everything from passage marker up to QUESTION: or A)
        const passageRegex = isEnglish
            ? /EN:\s*([\s\S]+?)(?=\n(?:QUESTION:|A\)))/
            : /JP:\s*([\s\S]+?)(?=\nA\))/;
        const textMatch = quiz.match(passageRegex);
        const passage = textMatch ? textMatch[1].trim() : (isEnglish ? 'English text' : 'Japanese passage');

        const questionMatch = isEnglish && part === '7' ? quiz.match(/QUESTION:\s*(.+)/) : null;
        const comprehensionQuestion = questionMatch ? questionMatch[1].trim() : null;

        const partSuffix = part ? ` · Part ${part}` : '';
        const levelSuffix = level
            ? (isEnglish ? ` · ${level}-band` : ` · JLPT ${level}`)
            : '';
        const quizLabel = isEnglish ? 'TOEIC' : 'Japanese';

        const displayBody = comprehensionQuestion
            ? `${passage}\n\n**Q:** ${comprehensionQuestion}`
            : passage;
        const header = `@everyone **Weekly ${quizLabel} Quiz${partSuffix}${levelSuffix}**\n${displayBody}`;

        // TOEIC Part 5 is a fill-in-the-blank — TTS reading "____" out loud is awkward, so skip audio there.
        const sendAudio = !(isEnglish && part === '5');
        if (sendAudio) {
            try {
                const audioBuffer = await getTTSBufferForLongText(passage, isEnglish ? 'en-US' : 'ja-JP');
                const audioAttachment = new AttachmentBuilder(audioBuffer, { name: `${isEnglish ? 'english-' : ''}quiz-audio.mp3` });
                await channel.send({ content: header, files: [audioAttachment] });
            } catch (ttsError) {
                console.error('TTS error, sending without audio:', ttsError);
                await channel.send({ content: header });
            }
        } else {
            await channel.send({ content: header });
        }

        const options = [];
        for (const letter of ['A', 'B', 'C', 'D']) {
            const optMatch = quiz.match(new RegExp(`${letter}\\)\\s*(.+)`));
            if (optMatch) options.push(optMatch[1].trim());
        }

        const optionLabels = ['a', 'b', 'c', 'd'];
        const optionsText = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
        await channel.send(`**Options:**\n${optionsText}`);

        const pollMessage = await channel.send({
            poll: {
                question: { text: isEnglish ? POLL_QUESTION_EN : POLL_QUESTION_JP },
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
                    question: { text: quizType === 'english' ? POLL_QUESTION_EN : POLL_QUESTION_JP },
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
