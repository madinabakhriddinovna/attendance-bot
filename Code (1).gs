// Attendance Bot — Google Apps Script
// Posts daily attendance reports and automatic shift reminders to Telegram.
//
// Setup: in Project Settings → Script properties, add:
//   BOT_TOKEN          your Telegram bot token
//   MC1_CHAT_ID        Telegram group ID for team MC 1
//   MC2_CHAT_ID        Telegram group ID for team MC 2
//   REMINDER_CHAT_ID   Telegram group ID for shift reminders
// Secrets and IDs are never stored in this code.

const P = PropertiesService.getScriptProperties();

// Opens the small "send report" page
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Page').setTitle('Attendance Bot');
}

// Sends a message from the bot to the MC 1 or MC 2 group
function sendReport(mc, text) {
  const chatId = P.getProperty(mc === 'MC 2' ? 'MC2_CHAT_ID' : 'MC1_CHAT_ID');
  if (!chatId) throw new Error('Group ID for ' + mc + ' is not set in Script properties');
  if (!text || !text.trim()) throw new Error('Message is empty');
  sendToChat(chatId, text);
  return 'Sent to ' + mc + ' group';
}

// Run this once after adding the bot to your groups.
// It prints each group's name and ID in the Execution log.
function findGroups() {
  const res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + P.getProperty('BOT_TOKEN') + '/getUpdates'
  );
  const seen = {};
  JSON.parse(res.getContentText()).result.forEach(function (u) {
    const m = u.message || u.my_chat_member || {};
    const c = m.chat;
    if (c && c.type !== 'private' && !seen[c.id]) {
      seen[c.id] = true;
      Logger.log(c.title + '   →   ' + c.id);
    }
  });
  if (!Object.keys(seen).length) {
    Logger.log('No groups found yet. Remove the bot from the group, add it again, then run findGroups again.');
  }
}

// Example of a daily report (sample names, not real employees)
function sendExampleReport() {
  Logger.log(sendReport('MC 1',
    '📋 Attendance — Jan 1, 2026\n\n' +
    '⏰ Late (2):\n• Employee A — 18:15 (15 min)\n• Employee B — 18:30 (30 min)\n\n' +
    '🟡 Late — with a valid reason (1):\n• Employee C — 18:20 (20 min)\n\n' +
    '❌ No Face ID check-in (1):\nEmployee D\n\n' +
    'Please check in on the Face ID device at the start of every shift.\n\n' +
    '⚠️ Missing Face ID check-ins are marked with the maximum charge amount.'
  ));
}

// ===== Shift reminders =====

const QUOTES = [
  'Success is the sum of small efforts, repeated day in and day out.',
  'The secret of getting ahead is getting started.',
  'Quality is not an act, it is a habit.',
  'Teamwork divides the task and multiplies the success.',
  'Do what you can, with what you have, where you are.',
  'Great things are done by a series of small things brought together.',
  'It always seems impossible until it\'s done.',
  'Discipline is the bridge between goals and accomplishment.',
  'Hard work beats talent when talent doesn\'t work hard.',
  'Alone we can do so little; together we can do so much.',
  'The best way to predict the future is to create it.',
  'Small daily improvements lead to stunning results.',
  'Your attitude determines your direction.',
  'Don\'t watch the clock; do what it does. Keep going.'
];

// Builds a reminder: greeting + quote of the day (rotates daily) + check-in reminder
function buildReminder(greeting, shift) {
  const day = Math.floor(Date.now() / 86400000);
  const q = QUOTES[day % QUOTES.length];
  return greeting + '\n\n💬 Quote of the day:\n"' + q + '"' +
    '\n\n⏰ The ' + shift + ' has started. Please make sure you have checked in on the Face ID device 👤✅' +
    '\n\nThank you for your dedication and hard work. Have a great shift.';
}

function sendToChat(chatId, text) {
  const res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + P.getProperty('BOT_TOKEN') + '/sendMessage',
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: chatId, text: text }) }
  );
  const body = JSON.parse(res.getContentText());
  if (!body.ok) throw new Error('Telegram: ' + body.description);
}

// Three reminders a day (Tashkent time)
const SLOTS = [
  { start: '01:00', end: '01:09', greeting: 'Hello, team.',        shift: 'After Hours shift (01:00)' },
  { start: '09:00', end: '09:09', greeting: 'Good morning, team.', shift: 'Night shift (09:00)' },
  { start: '18:00', end: '18:09', greeting: 'Good evening, team.', shift: 'Main shift (18:00)' }
];

// Runs every 5 minutes; each slot sends only once a day
function dailyReminder() {
  const chatId = P.getProperty('REMINDER_CHAT_ID');
  if (!chatId) throw new Error('REMINDER_CHAT_ID is not set in Script properties');
  const now = new Date();
  const hm = Utilities.formatDate(now, 'Asia/Tashkent', 'HH:mm');
  const today = Utilities.formatDate(now, 'Asia/Tashkent', 'yyyy-MM-dd');
  SLOTS.forEach(function (s) {
    if (hm < s.start || hm > s.end) return;
    const key = 'LAST_REMINDER_' + s.start;
    if (P.getProperty(key) === today) return;
    P.setProperty(key, today);
    sendToChat(chatId, buildReminder(s.greeting, s.shift));
  });
}

// Shows the three reminder texts in the log (sends nothing)
function previewReminder() {
  SLOTS.forEach(function (s) { Logger.log(buildReminder(s.greeting, s.shift)); });
}

// Run once to switch the reminders ON
function startDailyReminder() {
  stopDailyReminder();
  ScriptApp.newTrigger('dailyReminder').timeBased().everyMinutes(5).create();
  Logger.log('Daily reminders are ON (01:00, 09:00, 18:00 Tashkent).');
}

// Run to switch the reminders OFF
function stopDailyReminder() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyReminder') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Daily reminder is OFF.');
}

// ===== Cleanup tools =====

// Lists recent message IDs seen in the reminder group
function listRecentIds() {
  const chatId = P.getProperty('REMINDER_CHAT_ID');
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + P.getProperty('BOT_TOKEN') + '/getUpdates');
  JSON.parse(res.getContentText()).result.forEach(function (u) {
    const msg = u.message || u.edited_message;
    if (msg && String(msg.chat.id) === String(chatId)) {
      Logger.log(msg.message_id + ' | ' + new Date(msg.date * 1000).toISOString() + ' | ' +
        (msg.from && msg.from.is_bot ? 'BOT' : 'user') + ' | ' + String(msg.text || '').slice(0, 40));
    }
  });
}

// Deletes a message only if it was sent by the bot (checked first)
function deleteBotMessage(messageId) {
  const chat = P.getProperty('REMINDER_CHAT_ID');
  const base = 'https://api.telegram.org/bot' + P.getProperty('BOT_TOKEN');
  const opt = function (p) {
    return { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(p) };
  };
  const chk = JSON.parse(UrlFetchApp.fetch(base + '/editMessageReplyMarkup',
    opt({ chat_id: chat, message_id: messageId, reply_markup: { inline_keyboard: [] } })).getContentText());
  const own = chk.ok || /not modified/i.test(chk.description || '');
  if (!own) { Logger.log('NOT a bot message - not deleting.'); return; }
  Logger.log('Delete: ' + UrlFetchApp.fetch(base + '/deleteMessage',
    opt({ chat_id: chat, message_id: messageId })).getContentText());
}
