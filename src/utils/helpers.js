// src/utils/helpers.js

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchChannelsByIds(client, channelIds) {
    const channels = [];
    for (const id of channelIds) {
        try {
            const channel = await client.channels.fetch(id);
            if (channel) channels.push(channel);
        } catch (e) {
            // Intentionally ignore fetch failures
        }
    }
    return channels;
}

module.exports = {
    pickRandom,
    fetchChannelsByIds
};
