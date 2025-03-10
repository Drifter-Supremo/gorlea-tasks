# Email Reminder System

## Overview

The email reminder system provides proactive notifications for upcoming tasks, ensuring users never miss important deadlines. When a task is created or updated with both a due date and time, the system automatically schedules an email reminder to be sent 30 minutes before the task is due.

## Core Components

### EmailJS Integration

```javascript
// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_kyfgnn8';
const EMAILJS_TEMPLATE_ID = 'template_bi9oclp';
const EMAILJS_PUBLIC_KEY = 'wNTF0D_dL47gGbSc0';

// Initialize EmailJS
function initEmailJS() {
    try {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        console.log('EmailJS initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing EmailJS:', error);
        return false;
    }
}
```

The system uses EmailJS as the email delivery service. On application initialization, we initialize the EmailJS library with the appropriate service ID, template ID, and public key.

### Reminder Tracking System

```javascript
// Store reminder timeouts and tracking info
const reminderTracking = {
    timeouts: {}, // Store setTimeout ids by taskId
    sent: new Set(), // Track which reminders have been sent
    
    // Save tracking data to localStorage
    save() {
        try {
            localStorage.setItem('reminder-sent', JSON.stringify([...this.sent]));
        } catch (error) {
            console.warn('Could not save reminder tracking to localStorage:', error);
        }
    },
    
    // Load tracking data from localStorage
    load() {
        try {
            const sentReminders = JSON.parse(localStorage.getItem('reminder-sent') || '[]');
            this.sent = new Set(sentReminders);
        } catch (error) {
            console.warn('Could not load reminder tracking from localStorage:', error);
            this.sent = new Set();
        }
    }
};
```

The `reminderTracking` object manages two key aspects of the reminder system:

1. **Active Timeout IDs**: Stores JavaScript `setTimeout` IDs by task ID to allow cancellation
2. **Sent Reminder Tracking**: Maintains a record of which reminders have already been sent to avoid duplicates

This tracking persists across browser sessions using localStorage, ensuring that even if the user refreshes the page or returns later, we don't send duplicate reminders.

### Reminder Scheduling

```javascript
// Schedule an email reminder for a task
function scheduleTaskReminder(task) {
    // Cancel any existing reminder for this task
    cancelTaskReminder(task.id);
    
    // Only schedule reminders for tasks with both due date and time
    if (!task.dueDate || !task.dueTime || task.completed) {
        console.log('Not scheduling reminder for task:', task.id, '- missing date/time or task completed');
        return;
    }
    
    // Check if reminder was already sent for this task
    if (reminderTracking.sent.has(task.id)) {
        console.log('Reminder already sent for task:', task.id);
        return;
    }
    
    // Calculate when the task is due
    const [hours, minutes] = task.dueTime.split(':').map(Number);
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(hours, minutes, 0, 0);
    
    // Calculate when to send the reminder (30 minutes before due time)
    const reminderTime = new Date(dueDate);
    reminderTime.setMinutes(reminderTime.getMinutes() - 30);
    
    const now = new Date();
    
    // Only schedule future reminders
    if (reminderTime <= now) {
        console.log('Not scheduling reminder for task:', task.id, '- reminder time is in the past');
        return;
    }
    
    // Calculate milliseconds until reminder
    const timeUntilReminder = reminderTime.getTime() - now.getTime();
    
    console.log(`Scheduling reminder for task "${task.title}" to be sent in ${Math.round(timeUntilReminder/60000)} minutes`);
    
    // Set timeout to send email
    const timeoutId = setTimeout(() => {
        sendTaskReminderEmail(task);
        // Mark as sent
        reminderTracking.sent.add(task.id);
        reminderTracking.save();
        // Clear from tracking
        delete reminderTracking.timeouts[task.id];
    }, timeUntilReminder);
    
    // Store timeout ID for potential cancellation
    reminderTracking.timeouts[task.id] = timeoutId;
}
```

The scheduling function:
1. Validates the task has both date and time, and isn't completed
2. Checks if a reminder was already sent for this task
3. Calculates the due datetime and the reminder time (30 minutes before)
4. Verifies the reminder time is in the future
5. Sets up a JavaScript timeout to send the reminder at the appropriate time
6. Stores the timeout ID for future reference

### Email Sending

```javascript
// Send a reminder email for a task
function sendTaskReminderEmail(task) {
    // Format the date and time for email
    const dueDateObj = new Date(task.dueDate);
    const month = dueDateObj.toLocaleString('en-US', { month: 'long' });
    const day = dueDateObj.getDate();
    const daySuffix = getDaySuffix(day);
    const year = dueDateObj.getFullYear();
    const formattedDate = `${month} ${day}${daySuffix}, ${year}`;
    const formattedTime = task.dueTime ? formatTime(task.dueTime) : '';
    const formattedDateTime = formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate;
    
    // Prepare template parameters
    const templateParams = {
        task_title: task.title,
        task_due_date: formattedDateTime,
        task_priority: task.priority.charAt(0).toUpperCase() + task.priority.slice(1), // Capitalize first letter
        task_notes: task.notes || task.description || 'No additional details'
    };
    
    console.log('Sending reminder email for task:', task.id, task.title);
    
    // Send the email
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
        .then(response => {
            console.log('Email sent successfully:', response);
            showFeedback("Reminder email sent!", "success");
        })
        .catch(error => {
            console.error('Error sending email:', error);
            showFeedback("Could not send reminder email", "error");
        });
}
```

The email sending function:
1. Formats the task's date and time with proper ordinal suffixes
2. Prepares the template parameters with task details
3. Sends the email using EmailJS
4. Provides user feedback on success or failure

### Cancellation and Resource Management

```javascript
// Cancel a scheduled reminder
function cancelTaskReminder(taskId) {
    if (reminderTracking.timeouts[taskId]) {
        clearTimeout(reminderTracking.timeouts[taskId]);
        delete reminderTracking.timeouts[taskId];
        console.log('Cancelled reminder for task:', taskId);
    }
}

// Reschedule all reminders (call on page load)
function scheduleAllReminders() {
    console.log('Scheduling reminders for all tasks with due dates and times...');
    tasks.forEach(task => {
        if (task.dueDate && task.dueTime && !task.completed) {
            scheduleTaskReminder(task);
        }
    });
}
```

The system includes proper resource management:
1. A cancellation function to clear timeouts when tasks are deleted, completed, or updated
2. A bulk scheduling function that runs on application initialization to restore all reminders

## Integration with Task Lifecycle

The email reminder system is fully integrated with the task lifecycle:

### Task Creation
When a new task with a due date and time is created, a reminder is automatically scheduled.

### Task Update
When a task is updated:
1. Any existing reminder is cancelled
2. If the updated task has a due date and time, a new reminder is scheduled

### Task Completion
When a task is marked as complete, its reminder is cancelled.
When a completed task is marked as incomplete and has a due date/time, its reminder is rescheduled.

### Task Deletion
When a task is deleted, its reminder is cancelled.

## Implementation Considerations

### Persistence
- Sent reminder tracking persists across browser sessions using localStorage
- Timeouts are rescheduled on page load to handle browser refreshes

### Error Handling
- EmailJS initialization errors are caught and logged
- Email sending failures are properly handled with user feedback
- localStorage access is wrapped in try/catch for robustness

### User Feedback
- Success messages are shown when emails are sent successfully
- Error messages are displayed when email sending fails

### Resource Management
- Timeout IDs are properly tracked and cleared to prevent memory leaks
- When the application initializes, all active reminders are rescheduled

## Future Enhancements

Potential improvements to the email reminder system:

1. **Customizable Reminder Times**: Allow users to set how far in advance they receive reminders
2. **Multiple Reminders**: Support multiple reminders per task (e.g., 1 day before, 1 hour before)
3. **SMS or Push Notifications**: Add alternative notification channels
4. **User Configuration**: Allow users to enable/disable reminders globally or per task
5. **Rich Email Templates**: Enhance email templates with more styling and interactive elements
