# Sekai Buddy Discord Bot

A Discord bot that helps users learn Japanese and English through scheduled educational content, quizzes, and interactive features.

## Features

### Daily Content
- **Japanese Learning**: Daily quizzes, word of the day, and grammar points
- **English Learning**: Daily quizzes, word of the day, and grammar points (for Japanese speakers)
- **Audio Support**: Text-to-speech for pronunciation practice
- **Visual Cards**: Beautiful image cards for easy learning and sharing

### Weekly Content
- **Small Talk Practice**: Bilingual conversation prompts (Sundays)
- **Discussion Topics**: Cultural topics for language practice (Saturdays)

### Interactive Commands
- On-demand access to all learning features
- Force commands for administrators
- Quiz answer reveals

## Setup

### Prerequisites
- Node.js v20 or higher
- Discord Bot Token
- OpenAI API Key
- Google Cloud Text-to-Speech credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sekai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with required environment variables:
```env
DISCORD_TOKEN=your_discord_bot_token
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CREDENTIALS=your_google_cloud_credentials_json

# Channel IDs
JAPANESE_QUIZ_CHANNEL_ID=123456789
JAPANESE_WORD_CHANNEL_ID=123456789
JAPANESE_GRAMMAR_CHANNEL_ID=123456789
ENGLISH_QUIZ_CHANNEL_ID=123456789
ENGLISH_WORD_CHANNEL_ID=123456789
ENGLISH_GRAMMAR_CHANNEL_ID=123456789
SMALLTALK_CHANNEL_IDS=123456789,987654321
```

4. Run the bot:
```bash
npm start
```

## Testing

Run the test suite to ensure scheduled jobs are configured correctly:

```bash
npm test
```

Tests verify:
- Cron expression validity
- Time zone conversions
- Command naming consistency
- Channel configurations
- Schedule ordering

## Commands

See [DISCORD_COMMANDS_GUIDE.md](DISCORD_COMMANDS_GUIDE.md) for a complete list of user commands.

## Scheduled Content

See [SCHEDULED_FEATURES_CONTEXT.md](SCHEDULED_FEATURES_CONTEXT.md) for detailed information about all scheduled features.

### Schedule Overview (JST)

**Daily:**
- 10:00 AM - Japanese Quiz
- 11:00 AM - Japanese Word
- 12:00 PM - Japanese Grammar
- 1:00 PM - English Quiz
- 2:00 PM - English Word
- 3:00 PM - English Grammar

**Weekly:**
- Sunday 9:00 AM - Small Talk Practice
- Saturday 10:00 AM - Japanese Topic
- Saturday 11:00 AM - English Topic

## Development

### Project Structure
```
sekai/
├── src/
│   ├── index.js        # Main bot file
│   └── cardImage.js    # Image generation
├── tests/
│   └── scheduled-jobs.test.js  # Schedule tests
├── DISCORD_COMMANDS_GUIDE.md   # User documentation
├── SCHEDULED_FEATURES_CONTEXT.md # Technical documentation
└── package.json
```

### Adding New Features

When adding scheduled content:
1. Follow the existing pattern in `src/index.js`
2. Add corresponding force command
3. Update tests in `tests/scheduled-jobs.test.js`
4. Update documentation files
5. Run tests to verify

### Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Update documentation
5. Submit a pull request

## License

[Add your license here]

## Support

For issues or questions:
- Check the documentation
- Review recent commits
- Open an issue on GitHub
