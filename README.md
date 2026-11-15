# 🕒 Attendance Bot

Daily attendance reports and automatic shift reminders from Face ID data, posted to Telegram.

## The problem
Our company uses a Face ID device for attendance. At month-end the data was messy: people late without anyone noticing, missing check-ins, and employees who had left still showing as "absent." Checking it all by hand took hours.

## The solution
A Telegram bot that does two things:

**1. Daily attendance report**
Reads the attendance dashboard, applies the company's rules and posts a clear report to the team's Telegram group:
- ⏰ **Late**: more than 10 minutes after shift start
- 🟡 **Late with a valid reason**
- 🚫 **Absent**
- ❌ **No Face ID check-in**

Names are sorted alphabetically. Special cases are handled: power outages, dismissed employees and individual start times.

**2. Automatic shift reminders (24/7)**
Before each shift (After Hours, Night and Main), the bot posts a greeting, a quote of the day and a reminder to check in with Face ID.

## How it works
1. The Face ID device sends check-ins to the attendance system (Verifix).
2. The daily report is generated from the attendance dashboard and reviewed before posting.
3. Google Apps Script stores the bot token securely and runs timed reminders on Google's servers.
4. The Telegram bot posts reports and reminders to the group.

## Tech
Google Apps Script · Telegram Bot API · Verifix · Claude

## Results
- Month-end attendance review went from hours of manual checking to a daily report
- Dismissed employees no longer appear as absent
- Found a new red-flag rule: more than 1 missed day per week (everyone has 1 rotating day off)

## Next steps
- Fully automatic reports through the Verifix API
- Weekly summary of missed days
- Private reminders to each employee
