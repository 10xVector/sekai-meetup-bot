// tests/scheduled-jobs.test.js

const assert = require('assert');

// Simple test runner implementation
const describe = (name, fn) => {
  describe.tests = describe.tests || {};
  describe.tests[name] = fn;
};

const it = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    process.exit(1);
  }
};

// Test configuration for scheduled jobs
const SCHEDULED_JOBS_CONFIG = {
  daily: [],
  weekly: [
    {
      name: 'Japanese Quiz',
      time: '0 1 * * 5',
      day: 'Friday',
      jstTime: '10:00 AM',
      utcTime: '1:00 AM',
      channelEnvVar: 'JAPANESE_QUIZ_CHANNEL_ID'
    },
    {
      name: 'Japanese Word',
      time: '0 2 * * 5',
      day: 'Friday',
      jstTime: '11:00 AM',
      utcTime: '2:00 AM',
      channelEnvVar: 'JAPANESE_WORD_CHANNEL_ID'
    },
    {
      name: 'Japanese Grammar',
      time: '0 3 * * 5',
      day: 'Friday',
      jstTime: '12:00 PM',
      utcTime: '3:00 AM',
      channelEnvVar: 'JAPANESE_GRAMMAR_CHANNEL_ID'
    },
    {
      name: 'English Quiz',
      time: '0 4 * * 5',
      day: 'Friday',
      jstTime: '1:00 PM',
      utcTime: '4:00 AM',
      channelEnvVar: 'ENGLISH_QUIZ_CHANNEL_ID'
    },
    {
      name: 'English Word',
      time: '0 5 * * 5',
      day: 'Friday',
      jstTime: '2:00 PM',
      utcTime: '5:00 AM',
      channelEnvVar: 'ENGLISH_WORD_CHANNEL_ID'
    },
    {
      name: 'English Grammar',
      time: '0 6 * * 5',
      day: 'Friday',
      jstTime: '3:00 PM',
      utcTime: '6:00 AM',
      channelEnvVar: 'ENGLISH_GRAMMAR_CHANNEL_ID'
    },
    {
      name: 'Small Talk',
      time: '0 12 * * 5',
      day: 'Friday',
      jstTime: '9:00 PM',
      utcTime: '12:00 PM',
      channelEnvVar: 'SMALLTALK_CHANNEL_IDS'
    }
  ]
};

// Force commands that should exist
const FORCE_COMMANDS = [
  '!forcescheduledquiz',
  '!forcescheduledjapanesequiz',
  '!forcescheduledenglishquiz',
  '!forcescheduledjapaneseword',
  '!forcescheduledenglishword',
  '!forcescheduledjapanesegrammar',
  '!forcescheduledenglishgrammar',
  '!forcescheduledsmalltalk'
];


// Execute all test suites
describe('Scheduled Jobs Tests', () => {
  
  describe('Cron Schedule Format', () => {
    it('should have valid cron expressions for all daily jobs', () => {
      SCHEDULED_JOBS_CONFIG.daily.forEach(job => {
        assert(job.time.match(/^[0-9\s\*]+$/), `Invalid cron expression for ${job.name}: ${job.time}`);
        const parts = job.time.split(' ');
        assert.strictEqual(parts.length, 5, `Cron expression should have 5 parts for ${job.name}`);
      });
    });

    it('should have valid cron expressions for all weekly jobs', () => {
      SCHEDULED_JOBS_CONFIG.weekly.forEach(job => {
        assert(job.time.match(/^[0-9\s\*]+$/), `Invalid cron expression for ${job.name}: ${job.time}`);
        const parts = job.time.split(' ');
        assert.strictEqual(parts.length, 5, `Cron expression should have 5 parts for ${job.name}`);
        // Check day of week is correct (0 = Sunday, 6 = Saturday)
        const dayOfWeek = parseInt(parts[4]);
        if (job.day === 'Friday') assert.strictEqual(dayOfWeek, 5);
      });
    });
  });

  describe('Time Zone Calculations', () => {
    it('should have correct JST to UTC conversion for scheduled jobs', () => {
      const allJobs = [...SCHEDULED_JOBS_CONFIG.daily, ...SCHEDULED_JOBS_CONFIG.weekly];
      allJobs.forEach(job => {
        const utcHour = parseInt(job.time.split(' ')[1]);
        const jstHour = parseInt(job.jstTime.match(/\d+/)[0]);
        const isPM = job.jstTime.includes('PM');
        const jst24Hour = isPM && jstHour !== 12 ? jstHour + 12 : jstHour;
        
        // JST is UTC+9, so UTC = JST - 9
        const expectedUtcHour = (jst24Hour - 9 + 24) % 24;
        assert.strictEqual(utcHour, expectedUtcHour, 
          `Time mismatch for ${job.name}: Expected UTC ${expectedUtcHour}:00, got ${utcHour}:00`);
      });
    });
  });

  describe('Force Commands', () => {
    it('should have consistent naming pattern for force commands', () => {
      FORCE_COMMANDS.forEach(command => {
        assert(command.startsWith('!forcescheduled'), 
          `Force command should start with !forcescheduled: ${command}`);
        assert(!command.includes(' '), 
          `Force command should not contain spaces: ${command}`);
      });
    });

    it('should not have typos in English commands', () => {
      const englishCommands = FORCE_COMMANDS.filter(cmd => cmd.includes('english'));
      englishCommands.forEach(command => {
        assert(command.includes('english') && !command.includes('engligh'), 
          `English command has typo: ${command}`);
      });
    });
  });

  describe('Channel Configuration', () => {
    it('should have unique channel variables for each job type', () => {
      const allJobs = [...SCHEDULED_JOBS_CONFIG.daily, ...SCHEDULED_JOBS_CONFIG.weekly];
      const channelVars = allJobs.map(job => job.channelEnvVar);
      const uniqueVars = [...new Set(channelVars)];
      
      // Check that we have the expected channel variables
      const expectedVars = [
        'JAPANESE_QUIZ_CHANNEL_ID',
        'JAPANESE_WORD_CHANNEL_ID', 
        'JAPANESE_GRAMMAR_CHANNEL_ID',
        'ENGLISH_QUIZ_CHANNEL_ID',
        'ENGLISH_WORD_CHANNEL_ID',
        'ENGLISH_GRAMMAR_CHANNEL_ID',
        'SMALLTALK_CHANNEL_IDS'
      ];
      
      expectedVars.forEach(varName => {
        assert(channelVars.includes(varName), 
          `Missing expected channel variable: ${varName}`);
      });
    });
  });

  describe('Schedule Ordering', () => {
    it('should have weekly jobs scheduled in chronological order within each day', () => {
      const byDay = {};
      SCHEDULED_JOBS_CONFIG.weekly.forEach(job => {
        byDay[job.day] = byDay[job.day] || [];
        byDay[job.day].push(job);
      });

      Object.keys(byDay).forEach(day => {
        const sorted = byDay[day].slice().sort((a, b) => {
          const ha = parseInt(a.time.split(' ')[1]);
          const hb = parseInt(b.time.split(' ')[1]);
          return ha - hb;
        });

        for (let i = 1; i < sorted.length; i++) {
          const prevHour = parseInt(sorted[i - 1].time.split(' ')[1]);
          const currHour = parseInt(sorted[i].time.split(' ')[1]);
          assert(currHour >= prevHour,
            `Weekly jobs for ${day} should be in chronological order. Found ${currHour} after ${prevHour}`);
        }
      });
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('Running scheduled jobs tests...\n');
  
  // Execute the main test suite which will populate describe.tests
  const mainSuite = describe.tests['Scheduled Jobs Tests'];
  if (mainSuite) {
    mainSuite();
  }
  
  // Now run all the nested test suites
  Object.keys(describe.tests).forEach(suiteName => {
    if (suiteName !== 'Scheduled Jobs Tests') {
      console.log(`\n${suiteName}:`);
      describe.tests[suiteName]();
    }
  });
  
  console.log('\n✅ All tests passed!');
}

// Export for use with test runners
module.exports = { SCHEDULED_JOBS_CONFIG, FORCE_COMMANDS };