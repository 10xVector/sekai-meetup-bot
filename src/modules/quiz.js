// src/modules/quiz.js

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getTTSBufferForLongText } = require('../utils/tts');

async function generateComprehensionQuiz(openai, language = 'japanese') {
    const isEnglish = language === 'english';
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
        `You are a Japanese language comprehension quiz generator.
Generate a Japanese paragraph (3-4 sentences) about a different everyday situation each time (e.g., shopping, school, travel, weather, hobbies, family, work, etc.). Avoid repeating the same topic as previous quizzes.

The paragraph should:
1. Include subtle nuances, implications, or cultural context that require deeper understanding
2. Use a mix of grammar patterns and vocabulary that learners might encounter in real life
3. Have some ambiguity or room for interpretation in certain aspects

Then provide 4 English options (A, B, C, D) for its meaning. The options should:
1. All be plausible interpretations of the text
2. Differ in subtle ways (e.g., timing, speaker's attitude, implied meaning, cultural context)
3. Include at least one option that's partially correct but misses a key nuance
4. Have only one option that captures all aspects of the text accurately

After the options, state the correct answer and a detailed explanation that highlights the key nuances and why the other options are incorrect.

Format:
JP: <paragraph>
A) <option 1>
B) <option 2>
C) <option 3>
D) <option 4>
Answer: <A/B/C/D>
Explanation: <why, including key nuances and why other options are incorrect>
`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: quizPrompt },
            { role: 'user', content: 'Generate a new quiz.' }
        ]
    });
    return completion.choices[0].message.content;
}

async function sendQuiz(quiz, channel, quizData, isEnglish = false) {
    if (!quiz || !channel) return;

    try {
        const textMatch = quiz.match(isEnglish ? /EN:\s*(.+)/ : /JP:\s*(.+)/);
        const question = textMatch ? textMatch[1].trim() : (isEnglish ? 'English paragraph' : 'Japanese paragraph');

        try {
            const audioBuffer = await getTTSBufferForLongText(question, isEnglish ? 'en-US' : 'ja-JP');
            const audioAttachment = new AttachmentBuilder(audioBuffer, { name: `${isEnglish ? 'english-' : ''}quiz-audio.mp3` });
            await channel.send({
                content: `@everyone **Weekly ${isEnglish ? 'English ' : ''}Quiz**\n${question}`,
                files: [audioAttachment]
            });
        } catch (ttsError) {
            console.error('TTS error, sending without audio:', ttsError);
            await channel.send({
                content: `@everyone **Weekly ${isEnglish ? 'English ' : ''}Quiz**\n${question}`
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
