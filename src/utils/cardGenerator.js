// src/utils/cardGenerator.js

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getTTSBuffer } = require('./tts');

async function sendLearningCard({
    channel,
    openai,
    type, // 'word' or 'grammar'
    language, // 'japanese' or 'english'
    promptSystemRole,
    promptUserMessage,
    color = 0x00AE86,
    footerText,
    isScheduled = false
}) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gemini-2.5-flash',
            messages: [
                { role: 'system', content: promptSystemRole },
                { role: 'user', content: promptUserMessage }
            ]
        });

        const reply = completion.choices[0].message.content;
        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(reply);

        if (footerText) {
            embed.setFooter({ text: footerText });
        }

        await channel.send({ embeds: [embed] });

        // Extract example and generate audio
        const isEnglish = language === 'english';
        const exampleRegex = isEnglish ? /🎯 Examples?:\nEN: (.*?)(?=\n|$)/i : /🎯 Examples?:\nJP: (.*?)(?=\n|$)/i;
        const exampleMatch = reply.match(exampleRegex);

        if (exampleMatch) {
            const exampleSentence = exampleMatch[1].trim();
            const audioBuffer = await getTTSBuffer(exampleSentence, isEnglish ? 'en-US' : 'ja-JP');
            const audioAttachment = new AttachmentBuilder(audioBuffer, {
                name: `${isEnglish ? 'english' : 'japanese'}-example.mp3`
            });
            await channel.send({ files: [audioAttachment] });
        }

        const followUpMessage = isEnglish ?
            "💡 この単語を使って例文を作ってみましょう！チャットで共有してください。" :
            "💡 Try creating your own example! Feel free to share it in the chat.";

        await channel.send(followUpMessage);

        return reply;
    } catch (error) {
        console.error(`Error in sendLearningCard(${type}/${language}):`, error);
        throw error;
    }
}

module.exports = { sendLearningCard };
