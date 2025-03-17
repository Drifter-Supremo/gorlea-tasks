# Email Reminder System

## Overview
The Email Reminder System enhances the task management functionality by allowing users to receive email notifications for upcoming tasks. This feature ensures that users don't miss important deadlines by sending reminders 30 minutes before a task is due.

## Implementation Details

### User Flow
1. On first launch or when no email is stored, the user is prompted to enter their email address
2. The email modal appears with a field for the email and save/skip options
3. Email is validated using regex pattern validation before saving
4. Once saved, the email is stored in localStorage for future sessions
5. For tasks with both due date and time, reminders are automatically scheduled

### Components

#### Email Collection Modal
- Added to index.html as a new modal dialog
- Similar styling to the date/time confirmation modal
- Contains email input field, validation message, and action buttons
- Can be triggered at app initialization or when trying to send a reminder

#### Email Management
- `REMINDER_EMAIL` variable stores the user's email address
- `setReminderEmail()` function updates the email in memory and localStorage
- `isReminderEmailSet()` function checks if a valid email is available
- Email validation uses a regex pattern to verify format

### Reminder Flow
1. When a task with due date and time is created or edited, `scheduleTaskReminder()` is called
2. The system calculates when to send the reminder (30 minutes before due time)
3. When it's time to send the reminder, `sendTaskReminderEmail()` is called
4. If no email is set, the email modal is shown to collect one
5. The email is sent via EmailJS with task details included
6. A feedback message is shown to the user

### Technical Implementation
- Enhanced EmailJS integration to include recipient email in template parameters
- Added email collection modal to HTML and corresponding CSS
- Created functions to validate and manage email addresses
- Updated app initialization to check for stored email address
- Modified reminder sending function to verify email availability

### Future Enhancements
- Allow users to customize reminder timing (e.g., 15 minutes, 1 hour, 1 day before)
- Add option to send multiple reminders for important tasks
- Create settings page to manage email preferences
- Support for different notification methods (SMS, browser notifications)
