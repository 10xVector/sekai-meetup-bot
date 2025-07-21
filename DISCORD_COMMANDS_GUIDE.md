# Sekai Buddy - Discord Commands Guide

Welcome to Sekai Buddy! This guide will help you use all the bot commands. No technical knowledge needed - just follow along!

## Table of Contents
1. [Getting Started](#getting-started)
2. [Japanese Learning Commands](#japanese-learning-commands)
3. [English Learning Commands](#english-learning-commands)
4. [Community Commands](#community-commands)
5. [Admin Commands](#admin-commands)
6. [Scheduled Content](#scheduled-content)
7. [Tips & Common Questions](#tips--common-questions)

---

## Getting Started

### How Commands Work
All commands start with an exclamation mark `!`. Just type the command in any channel where Sekai Buddy is active.

### Basic Format
```
!commandname
```
Some commands need extra information:
```
!commandname information
```

---

## Japanese Learning Commands

### `!quiz`
**What it does:** Gives you a Japanese comprehension quiz with multiple choice answers  
**How to use:** Type `!quiz`  
**What happens:**
- Bot posts a quiz question with 4 answer choices
- Answer using Discord's poll buttons (1️⃣ 2️⃣ 3️⃣ 4️⃣)
- The correct answer is revealed after 6 hours
- Want the answer sooner? Use `!revealjapanesequiz`

**Example:**
```
You: !quiz
Bot: [Shows a Japanese question with 4 multiple choice options as a poll]
```

### `!word`
**What it does:** Shows you the Japanese word of the day  
**Features:**
- Visual card with the word in Japanese and English
- Audio pronunciation (click the audio file to hear it!)
- Example sentences

**How to use:** Type `!word`  
**Example:**
```
You: !word
Bot: [Posts a beautiful card with today's word + audio file]
```

### `!grammar`
**What it does:** Teaches you a Japanese grammar point  
**Features:**
- Clear explanation with examples
- Visual card format
- Audio pronunciation of example sentences

**How to use:** Type `!grammar`  
**Example:**
```
You: !grammar
Bot: [Posts grammar lesson card with examples + audio]
```

### `!smalltalk`
**What it does:** Helps you practice everyday Japanese conversations  
**Features:**
- Conversation prompt in both Japanese and English
- Visual card with the dialogue
- Great for practicing common phrases!

**How to use:** Type `!smalltalk`  
**Example:**
```
You: !smalltalk
Bot: [Posts a conversation practice card with Japanese and English]
```

---

## English Learning Commands

These commands are designed for Japanese speakers learning English. Explanations are in Japanese!

### `!englishquiz`
**What it does:** English comprehension quiz (with Japanese support)  
**How to use:** Type `!englishquiz`  
**Features:**
- Questions test English understanding
- Japanese translations provided
- Answer revealed after 6 hours (or use `!revealenglishquiz`)

### `!englishgrammar`
**What it does:** English grammar lessons explained in Japanese  
**How to use:** Type `!englishgrammar`  
**Features:**
- English grammar points
- Japanese explanations
- Example sentences in both languages

---

## Community Commands

### `!meetups`
**What it does:** Shows all upcoming language exchange meetups  
**How to use:** Type `!meetups`  
**Shows:**
- Event names and dates
- Links to join
- Times in your timezone

### `!sync`
**What it does:** Updates the meetup list and sets reminders  
**How to use:** Type `!sync`  
**Note:** Usually only needed by moderators

### `!send`
**What it does:** Send a message to another channel through the bot  
**How to use:** `!send [channel-id] [your message]`  
**Example:**
```
You: !send 123456789012345678 Hello everyone! Study session starting!
Bot: (Posts your message in that channel)
```

### `!reminder`
**What it does:** Set up event reminders  
**How to use:** `!reminder [channel-id] [meetup-link] "date time" [title] [timezone]`  
**Example:**
```
You: !reminder 123456789 https://meetup.com/event "2024-01-15 18:00" "Japanese Chat" JST
Bot: ✅ Reminder set!
```

---

## Admin Commands

These commands are for moderators and admins to manually trigger scheduled content.

### Force Commands
Use these to manually post daily content:
- `!forcescheduledjapanesequiz` - Post the daily Japanese quiz now
- `!forcescheduledenglishquiz` - Post the daily English quiz now
- `!forcescheduledjapaneseword` - Post word of the day now
- `!forcescheduledenglishword` - Post English word now
- `!forcescheduledjapanesegrammar` - Post grammar lesson now
- `!forcescheduledenglishgrammar` - Post English grammar now
- `!forcescheduledsmalltalk` - Post small talk practice to all channels
- `!forcescheduledjapanesetopic` - Post weekly Japanese topic now
- `!forcescheduledenglishtopic` - Post weekly English topic now

### Quiz Answers
- `!revealjapanesequiz` - Show the answer to current Japanese quiz
- `!revealenglishquiz` - Show the answer to current English quiz

---

## Scheduled Content

Sekai Buddy automatically posts content at these times (Japan Standard Time):

### Daily Content
| Content | Time (JST) | Time (UTC) |
|---------|------------|------------|
| Japanese Quiz | 10:00 AM | 1:00 AM |
| Japanese Word | 11:00 AM | 2:00 AM |
| Japanese Grammar | 12:00 PM | 3:00 AM |
| English Quiz | 1:00 PM | 4:00 AM |
| English Word | 2:00 PM | 5:00 AM |
| English Grammar | 3:00 PM | 6:00 AM |

### Weekly Content
| Content | Day | Time (JST) | Time (UTC) |
|---------|-----|------------|------------|
| Small Talk Practice | Sunday | 9:00 AM | 0:00 AM |
| Japanese Topic | Saturday | 10:00 AM | 1:00 AM |
| English Topic | Saturday | 11:00 AM | 2:00 AM |

**Note:** The bot posts to specific channels set up by your server admins.

---

## Tips & Common Questions

### 🎧 Audio Features
Most learning commands include audio! Look for the audio file attachment and click to play. The bot uses natural-sounding voices in both Japanese and English.

### 🖼️ Visual Cards
Commands create beautiful visual cards that are easy to read and share. Perfect for screenshot studying!

### ❓ Quiz Tips
- Take your time answering quizzes
- The poll will stay open for 6 hours
- Can't wait? Admins can use `!revealjapanesequiz` or `!revealenglishquiz`
- Try to guess before revealing the answer!

### 📚 Daily Study Routine
1. Morning: Check `!word` for new vocabulary
2. Noon: Learn with `!grammar`
3. Afternoon: Test yourself with `!quiz`
4. Evening: Practice with `!smalltalk`

### 🤔 Common Issues

**"Command not working"**
- Make sure you typed `!` at the start
- Check spelling (e.g., `!smalltalk` not `!small talk`)
- Ensure the bot is online (green dot)

**"No audio playing"**
- Click the audio file attachment
- Check your Discord audio settings
- Make sure your device volume is up

**"Can't see the images"**
- Images might take a moment to load
- Check your internet connection
- Try refreshing Discord (Ctrl+R or Cmd+R)

**"Wrong timezone for meetups"**
- Meetup times auto-adjust to your Discord timezone
- Check your Discord settings if times seem wrong

### 📱 Mobile Users
All commands work on mobile! Just type them the same way. Tap audio files to play them.

---

## Need Help?

- Ask in the chat - the community is friendly!
- Tag a moderator if you're having technical issues
- Most problems solve themselves if you try the command again

Happy learning! 頑張って下さい！🌸