# Scheduled Features Context & Implementation Guide

This document provides context and implementation details for all scheduled features in Sekai Buddy. It serves as a reference to prevent breaking changes and maintain consistency.

## Overview

Sekai Buddy implements automated content delivery through scheduled jobs using `node-schedule`. The bot posts educational content at specific times to help users learn Japanese and English consistently.

## Schedule Summary

### Daily Content (JST/UTC)
- **10:00 AM / 1:00 AM** - Japanese Quiz
- **11:00 AM / 2:00 AM** - Japanese Word of the Day
- **12:00 PM / 3:00 AM** - Japanese Grammar Point
- **1:00 PM / 4:00 AM** - English Quiz
- **2:00 PM / 5:00 AM** - English Word of the Day
- **3:00 PM / 6:00 AM** - English Grammar Point

### Weekly Content (JST/UTC)
- **Sunday 9:00 AM / 0:00 AM** - Small Talk Practice
- **Saturday 10:00 AM / 1:00 AM** - Japanese Discussion Topic
- **Saturday 11:00 AM / 2:00 AM** - English Discussion Topic

## Implementation Details

### 1. Japanese Quiz (Daily at 10:00 AM JST)
```javascript
schedule.scheduleJob('0 1 * * *', async () => { // 1:00 AM UTC = 10:00 AM JST
```
- Generates comprehension quiz with 4 multiple choice options
- Posts to `JAPANESE_QUIZ_CHANNEL_ID`
- Includes audio pronunciation
- Answer revealed after 6 hours or via `!revealjapanesequiz`
- Force command: `!forcescheduledjapanesequiz`

### 2. Japanese Word (Daily at 11:00 AM JST)
```javascript
schedule.scheduleJob('0 2 * * *', async () => { // 2:00 AM UTC = 11:00 AM JST
```
- Features varied vocabulary from N5-N1 levels
- Posts to `JAPANESE_WORD_CHANNEL_ID`
- Includes: word, definition, example, notes
- Audio pronunciation for example sentence
- Force command: `!forcescheduledjapaneseword`

### 3. Japanese Grammar (Daily at 12:00 PM JST)
```javascript
schedule.scheduleJob('0 3 * * *', async () => { // 3:00 AM UTC = 12:00 PM JST
```
- Grammar points from various JLPT levels
- Posts to `JAPANESE_GRAMMAR_CHANNEL_ID`
- Includes explanation, examples, usage notes
- Audio for example sentences
- Force command: `!forcescheduledjapanesegrammar`

### 4. English Quiz (Daily at 1:00 PM JST)
```javascript
schedule.scheduleJob('0 4 * * *', async () => { // 4:00 AM UTC = 1:00 PM JST
```
- English comprehension for Japanese learners
- Posts to `ENGLISH_QUIZ_CHANNEL_ID`
- Japanese answer options
- Answer revealed after 6 hours or via `!revealenglishquiz`
- Force command: `!forcescheduledenglishquiz`

### 5. English Word (Daily at 2:00 PM JST)
```javascript
schedule.scheduleJob('0 5 * * *', async () => { // 5:00 AM UTC = 2:00 PM JST
```
- English vocabulary for Japanese learners
- Posts to `ENGLISH_WORD_CHANNEL_ID`
- Japanese explanations and translations
- English audio pronunciation
- Force command: `!forcescheduledenglishword`

### 6. English Grammar (Daily at 3:00 PM JST)
```javascript
schedule.scheduleJob('0 6 * * *', async () => { // 6:00 AM UTC = 3:00 PM JST
```
- English grammar explained in Japanese
- Posts to `ENGLISH_GRAMMAR_CHANNEL_ID`
- Includes examples and practice tips
- English audio for examples
- Force command: `!forcescheduledenglishgrammar`

### 7. Small Talk Practice (Weekly - Sundays at 9:00 AM JST)
```javascript
schedule.scheduleJob('0 0 * * 0', async () => { // 0:00 AM UTC Sunday = 9:00 AM JST Sunday
```
- Conversation prompts in both languages
- Posts to all channels in `SMALLTALK_CHANNEL_IDS`
- Includes grammar practice element
- Force command: `!forcescheduledsmalltalk`

### 8. Japanese Topic (Weekly - Saturdays at 10:00 AM JST)
```javascript
schedule.scheduleJob('0 1 * * 6', async () => { // 1:00 AM UTC Saturday = 10:00 AM JST Saturday
```
- Weekly discussion topic about Japanese culture
- Posts to `JAPANESE_QUIZ_CHANNEL_ID`
- Includes vocabulary, phrases, discussion questions
- Audio for useful phrases
- Force command: `!forcescheduledjapanesetopic`

### 9. English Topic (Weekly - Saturdays at 11:00 AM JST)
```javascript
schedule.scheduleJob('0 2 * * 6', async () => { // 2:00 AM UTC Saturday = 11:00 AM JST Saturday
```
- Weekly topic about English-speaking cultures
- Posts to `ENGLISH_QUIZ_CHANNEL_ID`
- Japanese explanations with English phrases
- English audio pronunciation
- Force command: `!forcescheduledenglishtopic`

## Critical Implementation Notes

### Time Zone Handling
- All cron expressions use UTC time
- JST is UTC+9, so subtract 9 hours from JST to get UTC
- Comments clearly show both times for maintainability

### Channel Configuration
Required environment variables:
- `JAPANESE_QUIZ_CHANNEL_ID`
- `JAPANESE_WORD_CHANNEL_ID`
- `JAPANESE_GRAMMAR_CHANNEL_ID`
- `ENGLISH_QUIZ_CHANNEL_ID`
- `ENGLISH_WORD_CHANNEL_ID`
- `ENGLISH_GRAMMAR_CHANNEL_ID`
- `SMALLTALK_CHANNEL_IDS` (comma-separated for multiple channels)

### Audio Generation
- Japanese audio: Uses `getTTSBuffer()` with rotating voices
- English audio: Uses `getEnglishTTSBuffer()` with rotating voices
- Long text: Uses `getTTSBufferForLongText()` with consistent voice

### Error Handling Pattern
All scheduled jobs follow this pattern:
```javascript
try {
  console.log('Starting scheduled [feature]...');
  // Implementation
  console.log('Scheduled [feature] completed successfully');
} catch (err) {
  console.error('Error generating scheduled [feature]:', err);
  console.error('Error stack:', err.stack);
}
```

### Force Command Naming Convention
- All force commands start with `!forcescheduled`
- Format: `!forcescheduled[language][feature]`
- Examples: 
  - `!forcescheduledjapanesequiz`
  - `!forcescheduledenglishtopic`
  - `!forcescheduledsmalltalk` (no language prefix for bilingual content)

## Testing

Run tests to ensure schedule integrity:
```bash
npm test
```

The test suite verifies:
- Cron expression validity
- Time zone conversion accuracy
- Force command naming consistency
- Channel configuration completeness
- Chronological ordering of daily jobs

## Common Issues & Solutions

1. **Missing scheduled posts**
   - Check channel IDs in environment variables
   - Verify bot has permissions in target channels
   - Check console logs for error messages

2. **Wrong posting times**
   - Verify server timezone settings
   - Check cron expressions match UTC times
   - Ensure comments show correct JST conversion

3. **Audio not playing**
   - Verify Google Cloud credentials are set
   - Check TTS API quotas
   - Ensure audio buffer generation completes

## Maintenance Guidelines

1. **Adding new scheduled content:**
   - Follow existing time zone comment format
   - Add corresponding force command
   - Update this documentation
   - Add tests for new schedule

2. **Modifying schedules:**
   - Update cron expression
   - Update time comments (both UTC and JST)
   - Update documentation
   - Run tests to verify

3. **Channel changes:**
   - Update environment variables
   - Restart bot to load new configuration
   - Test with force commands first

## Related Files
- `/src/index.js` - Main implementation
- `/tests/scheduled-jobs.test.js` - Test suite
- `/DISCORD_COMMANDS_GUIDE.md` - User documentation
- `/.env` - Environment configuration (not in repo)