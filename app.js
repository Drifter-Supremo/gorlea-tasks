/*
* Agenda - A Smart To-Do List
* 
* Setup Instructions:
* 1. Open the index.html file in a web browser
* 2. When prompted, enter your OpenAI API key to enable AI features
*    (Your API key is stored securely in your browser's localStorage)
* 3. Start adding tasks using natural language
* 4. Use the chat assistant for help or questions
* 
* Features:
* - Natural language task input with smart parsing
* - Task management (add, edit, delete, complete)
* - Smart prioritization and suggestions
* - Timeline view with grouping by date
* - Search and filtering capabilities
* - Chat assistant for task-related queries
* - Dark mode support
* - Google Cloud storage (tasks persist across refreshes and devices)
* 
* Tasks are saved to Google Cloud storage for persistence
* This app requires an internet connection for full functionality
*/

// Configuration
// OpenAI API key (will be stored in localStorage)
let OPENAI_API_KEY = localStorage.getItem('openai-api-key') || '';
const OPENAI_MODEL = 'gpt-4o-mini';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_kyfgnn8';
const EMAILJS_TEMPLATE_ID = 'template_bi9oclp';
const EMAILJS_PUBLIC_KEY = 'wNTF0D_dL47gGbSc0';

// User's reminder email
let REMINDER_EMAIL = localStorage.getItem('reminder-email') || '';

// Function to set the reminder email
function setReminderEmail(email) {
    REMINDER_EMAIL = email;
    localStorage.setItem('reminder-email', email);
    console.log('Reminder email set successfully:', email);
}

// Check if reminder email is set
function isReminderEmailSet() {
    return REMINDER_EMAIL && REMINDER_EMAIL.trim() !== '';
}

// Function to set the OpenAI API key
function setOpenAIApiKey(key) {
    OPENAI_API_KEY = key;
    localStorage.setItem('openai-api-key', key);
    console.log('OpenAI API key set successfully');
}

// Check if API key is set
function isApiKeySet() {
    return OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '';
}

// Prompt user for API key if not set
function promptForApiKey() {
    const key = prompt('Please enter your OpenAI API key to enable AI features:');
    if (key && key.trim() !== '') {
        setOpenAIApiKey(key);
        return true;
    }
    return false;
}

// Google Cloud Firebase configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDhonKe0iUgUwlFQDUhvRdJm4ghdYCN3uw",
    authDomain: "gorlea-tasks.firebaseapp.com",
    databaseURL: "https://gorlea-tasks-default-rtdb.firebaseio.com/",
    projectId: "gorlea-tasks",
    storageBucket: "gorlea-tasks.firebasestorage.app",
    messagingSenderId: "940617852039",
    appId: "1:940617852039:web:d929689611bb0c2df10422"
  };

  // Firebase will be initialized in initializeFirebase()

// DOM Elements
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const searchInput = document.getElementById('search-input');
const filterDropdown = document.getElementById('filter-dropdown');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessages = document.getElementById('chat-messages');
const inputProcessing = document.getElementById('input-processing');
const taskFeedback = document.getElementById('task-feedback');

// State variables
let tasks = [];
let currentFilter = 'all';
let editingTaskId = null;
let darkMode = false;
let db = null; // Firebase database reference
let isOnline = navigator.onLine;
let deviceId = null; // Unique identifier for this device
let originalTaskText = ''; // Store the original task text for reference
let currentParsedTask = null; // Store the parsed task while showing the date/time modal

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

// Send a reminder email for a task
function sendTaskReminderEmail(task) {
    // Check if email is set
    if (!isReminderEmailSet()) {
        console.warn('Cannot send email reminder - no email address set');
        showEmailModal();
        return;
    }
    
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
        to_email: REMINDER_EMAIL,
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

// Show email collection modal
function showEmailModal() {
    // Clear any validation message
    document.getElementById('email-validation-message').textContent = '';
    
    // Show the modal
    const modal = document.getElementById('email-modal');
    modal.style.display = 'block';
    
    // Focus on the email input
    document.getElementById('reminder-email').focus();
    
    // Set up event listeners
    setupEmailModalListeners();
}

// Setup event listeners for email modal
function setupEmailModalListeners() {
    const saveBtn = document.getElementById('save-email-btn');
    const skipBtn = document.getElementById('skip-email-btn');
    const emailInput = document.getElementById('reminder-email');
    
    // Remove any existing event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    
    // Add new event listeners
    newSaveBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        if (validateEmail(email)) {
            setReminderEmail(email);
            document.getElementById('email-modal').style.display = 'none';
            showFeedback("Email saved successfully! You'll receive reminders for upcoming tasks.", "success");
        } else {
            document.getElementById('email-validation-message').textContent = 'Please enter a valid email address';
        }
    });
    
    newSkipBtn.addEventListener('click', () => {
        document.getElementById('email-modal').style.display = 'none';
    });
    
    // Add enter key support
    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            newSaveBtn.click();
        }
    });
}

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Initialize the app
function init() {
    console.log('Initializing app...');
    initializeFirebase();
    loadThemePreference();
    addEventListeners();
    setupOnlineListener();
    
    // Initialize EmailJS
    const emailJSInitialized = initEmailJS();
    
    // Load reminder tracking from localStorage
    reminderTracking.load();
    
    // Check if user has set their email for reminders
    if (!isReminderEmailSet() && emailJSInitialized) {
        // Set a slight delay to show the email modal after app initialization
        setTimeout(() => {
            showEmailModal();
        }, 1000);
    }
    
    // Show app is ready
    console.log('App initialized successfully');
}

// Listen for online/offline status changes
function setupOnlineListener() {
    window.addEventListener('online', () => {
        console.log('Device is now online');
        isOnline = true;
        showFeedback("You're back online. Your tasks will now sync.", "success");
        // Reload tasks from firebase when we come back online
        loadTasksFromFirebase();
    });
    
    window.addEventListener('offline', () => {
        console.log('Device is now offline');
        isOnline = false;
        showFeedback("You're offline. Please reconnect to save your changes.", "warning");
    });
}

// Get or create a unique device ID
function getDeviceId() {
    try {
        let id = localStorage.getItem('agenda-device-id');
        if (!id) {
            id = 'device-' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('agenda-device-id', id);
        }
        return id;
    } catch (error) {
        return 'device-' + Math.random().toString(36).substring(2, 15);
    }
}

// Initialize Firebase with minimal configuration
function initializeFirebase() {
    try {
        console.log('Initializing Firebase...');
        // Check if Firebase is available
        if (typeof firebase !== 'undefined') {
            // Initialize Firebase
            firebase.initializeApp(FIREBASE_CONFIG);
            db = firebase.database();
            deviceId = getDeviceId();
            console.log('Firebase initialized with device ID:', deviceId);
            
            // Set up connection monitoring with shorter timeout
            setupFirebaseConnectionMonitoring();
            
            // Load tasks from Firebase
            loadTasksFromFirebase();
        } else {
            console.warn('Firebase library not available');
            // Show the warning
            showFeedback("Could not connect to the cloud. Please check your internet connection.", "error", 5000);
            taskList.innerHTML = '<div class="no-tasks">Internet connection required to load your tasks.</div>';
        }
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        // Show the error
        showFeedback("Could not connect to the cloud. Please check your internet connection.", "error", 5000);
        taskList.innerHTML = '<div class="no-tasks">Internet connection required to load your tasks.</div>';
    }
}

// Monitor Firebase connection status with improved handling
function setupFirebaseConnectionMonitoring() {
    if (!db) return;
    
    // Keep track of connection state
    let isConnected = false;
    let connectionMessageShown = false;
    
    // Listen for connection changes
    db.ref('.info/connected').on('value', (snap) => {
        const newConnectionState = snap.val() === true;
        
        // Only show messages when the state changes
        if (newConnectionState !== isConnected) {
            isConnected = newConnectionState;
            
            if (isConnected) {
                console.log('Connected to Firebase');
                // Clear any connection warning if it was shown
                if (connectionMessageShown) {
                    showFeedback("Connected to cloud storage.", "success", 2000);
                    connectionMessageShown = false;
                }
            } else {
                console.warn('Not connected to Firebase');
                showFeedback("Not connected to cloud storage. Please check your internet connection.", "warning", 5000);
                connectionMessageShown = true;
            }
        }
    });
    
    // Set a timeout to clear the warning if we don't get a definitive answer
    setTimeout(() => {
        if (connectionMessageShown) {
            // Clear the message if it's still showing after timeout
            taskFeedback.textContent = "";
            taskFeedback.className = "feedback";
            connectionMessageShown = false;
        }
    }, 7000);
}

    // Load tasks from Firebase Realtime Database
function loadTasksFromFirebase() {
    if (!db) {
        console.warn('Firebase database not initialized');
        taskList.innerHTML = '<div class="no-tasks">Internet connection required to load your tasks.</div>';
        return;
    }
    
    console.log('Loading tasks from Firebase...');
    taskList.innerHTML = '<div class="loading"><div class="spinner"></div> Loading your tasks...</div>';
    
    // Set a timeout in case Firebase doesn't respond - reduced from 15s to 8s
    const timeoutId = setTimeout(() => {
        console.warn('Firebase load timed out');
        taskList.innerHTML = '<div class="no-tasks">Connection timeout. Please check your internet and try again.</div>';
        showFeedback("Connection timeout. Please check your internet connection.", "error", 5000);
    }, 8000); // Reduced timeout from 15s to 8s
    
    db.ref('tasks').once('value')
        .then(snapshot => {
            clearTimeout(timeoutId); // Clear the timeout since we got a response
            
            const data = snapshot.val();
            if (data) {
                const tasksArray = Object.values(data);
                console.log(`Loaded ${tasksArray.length} tasks from Firebase`);
                
                // Sort by creation date (newest first)
                tasksArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Ensure all tasks have the notes field
                tasksArray.forEach(task => {
                    if (!task.hasOwnProperty('notes')) {
                        task.notes = '';
                    }
                });
                
                tasks = tasksArray;
            } else {
                tasks = [];
                console.log('No tasks found in Firebase');
            }
            renderTasks();
            
            // Schedule email reminders for tasks with due dates/times
            scheduleAllReminders();
        })
        .catch(error => {
            clearTimeout(timeoutId); // Clear the timeout since we got a response (an error)
            console.error('Error loading tasks from Firebase:', error);
            taskList.innerHTML = '<div class="no-tasks">Error loading tasks. Please check your internet connection and try again.</div>';
            showFeedback("Error loading your tasks. Please check your internet connection.", "error", 5000);
        });
}

// Load theme preference from local storage
function loadThemePreference() {
    try {
        const savedTheme = localStorage.getItem('agenda-theme');
        if (savedTheme === 'dark') {
            darkMode = true;
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('checkbox').checked = true;
            document.getElementById('theme-icon').classList.replace('fa-moon', 'fa-sun');
        }
    } catch (error) {
        console.warn('Could not access localStorage for theme:', error);
    }
}

// Save theme preference to local storage
function saveThemePreference(isDark) {
    try {
        localStorage.setItem('agenda-theme', isDark ? 'dark' : 'light');
    } catch (error) {
        console.warn('Could not save theme to localStorage:', error);
    }
}

// Add event listeners
function addEventListeners() {
    // Task input
    addTaskBtn.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddTask();
        }
    });

    // Search and filters
    searchInput.addEventListener('input', renderTasks);
    filterDropdown.addEventListener('change', () => {
        currentFilter = filterDropdown.value;
        renderTasks();
    });

    // Chat
    chatSendBtn.addEventListener('click', handleChatSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleChatSend();
        }
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('checkbox');
    const themeIcon = document.getElementById('theme-icon');
    
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            darkMode = true;
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            darkMode = false;
        }
        saveThemePreference(darkMode);
    });
}

// Sync tasks to Firebase
function syncTasksToCloud() {
    if (!db || !isOnline) {
        console.warn('Cannot sync to Firebase: database not initialized or offline');
        showFeedback("Cannot save changes - you are offline.", "error");
        return Promise.resolve(false);
    }
    
    console.log('Syncing tasks to Firebase...');
    showFeedback("Saving to cloud...", "info");
    
    // Convert tasks array to object with task IDs as keys
    const tasksObject = {};
    tasks.forEach(task => {
        // Make sure all fields are properly set
        const cleanTask = {
            id: task.id,
            title: task.title || '',
            description: task.description || '',
            createdAt: task.createdAt || new Date().toISOString(),
            completed: !!task.completed,
            dueDate: task.dueDate || null,
            dueTime: task.dueTime || null,
            priority: task.priority || 'medium',
            category: task.category || 'general',
            deviceId: deviceId,
            notes: task.notes || ''
        };
        tasksObject[task.id] = cleanTask;
    });
    
    return db.ref('tasks').set(tasksObject)
        .then(() => {
            console.log('Tasks synced to Firebase successfully');
            showFeedback("Saved to cloud successfully!", "success");
            
            // Double-check: verify we can read the data back
            return db.ref('tasks').once('value');
        })
        .then(snapshot => {
            const savedData = snapshot.val();
            console.log(`Verified ${Object.keys(savedData || {}).length} tasks in Firebase`);
            
            // Update timestamp
            return db.ref('lastSync').set({
                timestamp: Date.now(),
                device: deviceId
            });
        })
        .then(() => {
            console.log('Sync verification successful');
            return true;
        })
        .catch(error => {
            console.error('Error syncing tasks to Firebase:', error);
            showFeedback("Could not save to cloud. Please check your internet connection.", "error");
            return false;
        });
}

// Generate time options for the dropdown (15-minute increments)
function populateTimeOptions() {
    const timeSelector = document.getElementById('time-selector');
    timeSelector.innerHTML = '<option value="">No Specific Time</option>';
    
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const hour12 = hour % 12 || 12;
            const period = hour < 12 ? 'AM' : 'PM';
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const displayTime = `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
            
            const option = document.createElement('option');
            option.value = timeString;
            option.textContent = displayTime;
            
            // Default to 9:00 AM
            if (hour === 9 && minute === 0) {
                option.selected = true;
            }
            
            timeSelector.appendChild(option);
        }
    }
}

// Function to show the date/time modal
function showDateTimeModal(parsedTask, taskText) {
    // Store the original task text and parsed task for later use
    originalTaskText = taskText;
    currentParsedTask = parsedTask;
    
    // Populate time options
    populateTimeOptions();
    
    // Set initial date value if AI detected one
    const datePicker = document.getElementById('date-picker');
    if (parsedTask.dueDate) {
        // Extract just the date part of the ISO string
        const dateOnly = parsedTask.dueDate.split('T')[0];
        datePicker.value = dateOnly;
    }
    
    // Set initial time value if AI detected one
    const timeSelector = document.getElementById('time-selector');
    if (parsedTask.dueTime) {
        // Find the closest time option
        const options = timeSelector.options;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value === parsedTask.dueTime) {
                options[i].selected = true;
                break;
            }
        }
    }
    
    // Show the modal
    const modal = document.getElementById('date-time-modal');
    modal.style.display = 'block';
    
    // Set up event listeners for the confirm and cancel buttons
    setupModalListeners();
}

// Setup event listeners for modal buttons
function setupModalListeners() {
    
    const confirmBtn = document.getElementById('confirm-task-btn');
    const cancelBtn = document.getElementById('cancel-task-btn');
    
    // Remove any existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Add new event listeners
    newConfirmBtn.addEventListener('click', confirmTaskWithSelectedDate);
    newCancelBtn.addEventListener('click', cancelTaskCreation);
}

// Handle date/time confirmation
function confirmTaskWithSelectedDate() {
    // Get values from modal
    const datePicker = document.getElementById('date-picker');
    const timeSelector = document.getElementById('time-selector');
    
    // Update parsed task with user-selected date/time
    if (datePicker.value) {
        currentParsedTask.dueDate = datePicker.value;
    } else {
        currentParsedTask.dueDate = null;
    }
    
    currentParsedTask.dueTime = timeSelector.value || null;
    
    // Hide the modal
    document.getElementById('date-time-modal').style.display = 'none';
    
    // Create the task with the user-confirmed date/time
    addParsedTask(currentParsedTask, originalTaskText);
    
    // Clear the input
    taskInput.value = '';
}

// Handle cancellation
function cancelTaskCreation() {
    // Hide the modal
    document.getElementById('date-time-modal').style.display = 'none';
    
    // Clear the input processing indicator
    inputProcessing.textContent = '';
    
    // Don't clear the task input in case the user wants to modify it
}

// Handle adding a task
async function handleAddTask() {
    const taskText = taskInput.value.trim();
    if (!taskText) return;

    if (!isOnline || !db) {
        showFeedback("Cannot add task - you are offline.", "error");
        return;
    }

    // Show processing indicator
    inputProcessing.innerHTML = '<div class="spinner"></div> Analyzing your task...';
    console.log('Adding new task:', taskText);
    
    // Special case for tasks starting with "URGENT"
    if (taskText.toUpperCase().startsWith('URGENT')) {
        console.log('Detected URGENT prefix, setting high priority');
        // Parse with our fallback parser first to guarantee day name detection
        const fallbackTask = createFallbackTaskObject(taskText);
        console.log('Fallback parser result:', fallbackTask);
        
        // Set a timeout to ensure the UI doesn't get stuck in processing state
        const analysisTimeoutId = setTimeout(() => {
            console.warn('Task analysis timed out, proceeding with fallback task');
            inputProcessing.textContent = ''; // Clear the processing indicator
            showDateTimeModal(fallbackTask, taskText);
        }, 8000); // 8 seconds timeout
        
        try {
            // Still try the AI parser as well
            const parsedTask = await parseTaskWithAI(taskText);
            clearTimeout(analysisTimeoutId); // Clear the timeout
            console.log('Task parsed successfully:', parsedTask);
            
            // Force high priority for URGENT tasks
            parsedTask.priority = 'high';
            
            // Use the fallback's due date if AI didn't find one
            if (!parsedTask.dueDate && fallbackTask.dueDate) {
                parsedTask.dueDate = fallbackTask.dueDate;
            }
            
            // Clear the processing indicator immediately
            inputProcessing.textContent = '';
            
            // Show the date/time confirmation modal
            showDateTimeModal(parsedTask, taskText);
        } catch (error) {
            clearTimeout(analysisTimeoutId); // Clear the timeout
            console.error('Error with AI parsing:', error);
            
            // Clear the processing indicator
            inputProcessing.textContent = '';
            
            // Show the date/time confirmation modal with fallback results
            showDateTimeModal(fallbackTask, taskText);
        }
    } else {
        // Regular task flow
        // Set a timeout to ensure the UI doesn't get stuck in processing state
        const analysisTimeoutId = setTimeout(() => {
            console.warn('Task analysis timed out, proceeding with basic task');
            inputProcessing.textContent = ''; // Clear the processing indicator
            
            // Use fallback parser instead of completely basic task
            const fallbackTask = createFallbackTaskObject(taskText);
            console.log('Fallback parser result after timeout:', fallbackTask);
            showDateTimeModal(fallbackTask, taskText);
        }, 12000); // 12 seconds timeout for regular tasks
        
        try {
            // Parse the task with AI
            const parsedTask = await parseTaskWithAI(taskText);
            clearTimeout(analysisTimeoutId); // Clear the timeout
            console.log('Task parsed successfully:', parsedTask);
            
            // Also run the fallback parser as a backup
            const fallbackTask = createFallbackTaskObject(taskText);
            console.log('Fallback parser result after AI success:', fallbackTask);
            
            // Use fallback date if AI didn't find one but fallback did
            if (!parsedTask.dueDate && fallbackTask.dueDate) {
                console.log('Using fallback due date because AI parsing did not return one');
                parsedTask.dueDate = fallbackTask.dueDate;
            }
            
            // Clear the processing indicator immediately
            inputProcessing.textContent = '';
            
            // Show the date/time confirmation modal
            showDateTimeModal(parsedTask, taskText);
        } catch (error) {
            clearTimeout(analysisTimeoutId); // Clear the timeout
            console.error('Error adding task:', error);
            
            // Clear the processing indicator
            inputProcessing.textContent = '';
            
            // Use fallback parser and show the date/time confirmation modal
            const fallbackTask = createFallbackTaskObject(taskText);
            console.log('Fallback parser result after error:', fallbackTask);
            showDateTimeModal(fallbackTask, taskText);
        }
    }
}

function addParsedTask(parsedTask, originalText) {
    // Create the task object
    const taskId = Date.now().toString();
    const newTask = {
        id: taskId,
        title: parsedTask.title || originalText,
        description: parsedTask.description || '',
        createdAt: new Date().toISOString(),
        completed: false,
        dueDate: parsedTask.dueDate || null,
        dueTime: parsedTask.dueTime || null,
        priority: parsedTask.priority || 'medium',
        category: parsedTask.category || 'general',
        deviceId: deviceId,
        notes: parsedTask.notes || ''
    };
    
    // If we have both date and time, add time to the description for now
    // (since we're not updating the UI to show time yet)
    if (newTask.dueDate && newTask.dueTime && !newTask.description) {
        // Create a proper date object for consistent formatting
        const dueDate = new Date(newTask.dueDate);
        const month = dueDate.toLocaleString('en-US', { month: 'long' });
        const day = dueDate.getDate();
        const daySuffix = getDaySuffix(day);
        
        newTask.description = `Due at ${formatTime(newTask.dueTime)}. ${month} ${day}${daySuffix} at ${formatTime(newTask.dueTime)}`;
    } else if (newTask.dueDate && newTask.dueTime) {
        // Only add time information if description doesn't already have it
        if (!newTask.description.includes('Due at')) {
            newTask.description = `Due at ${formatTime(newTask.dueTime)}. ${newTask.description}`;
        }
    }

    if (!isOnline || !db) {
        showFeedback("Cannot add task - you are offline.", "error");
        return;
    }

    // Add the task to the local array
    tasks.unshift(newTask);
    
    // Schedule email reminder if the task has a due date and time
    if (newTask.dueDate && newTask.dueTime) {
        scheduleTaskReminder(newTask);
    }
    
    // Render immediately to show the user their task was added
    renderTasks();
    showFeedback("Task added! Saving to cloud...", "info");
    
    // Sync to Firebase
    syncTasksToCloud()
        .then(success => {
            if (success) {
                console.log('Task saved to cloud successfully');
            } else {
                // Remove task from array if sync failed
                tasks = tasks.filter(t => t.id !== taskId);
                cancelTaskReminder(taskId); // Cancel any scheduled reminder
                renderTasks();
                showFeedback("Could not save task. Please check your internet connection.", "error");
            }
        })
        .catch(error => {
            console.error('Error during cloud sync:', error);
            // Remove task from array if sync failed
            tasks = tasks.filter(t => t.id !== taskId);
            cancelTaskReminder(taskId); // Cancel any scheduled reminder
            renderTasks();
            showFeedback("Could not save task. Please check your internet connection.", "error");
        });
}

function updateTask(taskId, updatedFields) {
    console.log('Updating task:', taskId, updatedFields);
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        console.error('Task not found for update:', taskId);
        return;
    }

    if (!isOnline || !db) {
        showFeedback("Cannot update task - you are offline.", "error");
        return;
    }

    // Cancel any existing reminder for this task
    cancelTaskReminder(taskId);
    
    // Update the task in the local array
    tasks[taskIndex] = { ...tasks[taskIndex], ...updatedFields };
    
    // If the updated task has due date and time, schedule a new reminder
    const updatedTask = tasks[taskIndex];
    if (updatedTask.dueDate && updatedTask.dueTime && !updatedTask.completed) {
        scheduleTaskReminder(updatedTask);
    }
    
    // Sync to Firebase
    syncTasksToCloud().then(success => {
        if (success) {
            // Reset editing state and render
            editingTaskId = null;
            renderTasks();
            showFeedback("Task updated successfully!");
        } else {
            // Revert changes if sync failed
            showFeedback("Could not update task. Please check your internet connection.", "error");
            // Reload tasks to restore previous state
            loadTasksFromFirebase();
        }
    }).catch(error => {
        console.error('Error updating task:', error);
        showFeedback("Could not update task. Please check your internet connection.", "error");
        // Reload tasks to restore previous state
        loadTasksFromFirebase();
    });
}

function deleteTask(taskId) {
    const confirmDelete = confirm("Are you sure you want to delete this task?");
    if (!confirmDelete) return;
    
    console.log('Deleting task:', taskId);
    
    if (!isOnline || !db) {
        showFeedback("Cannot delete task - you are offline.", "error");
        return;
    }
    
    // Cancel any scheduled reminder for this task
    cancelTaskReminder(taskId);
    
    // First make a backup of the current tasks
    const tasksCopy = [...tasks];
    
    // Update the local array optimistically
    tasks = tasks.filter(task => task.id !== taskId);
    renderTasks(); // Update UI immediately
    
    // Sync to Firebase
    syncTasksToCloud().then(success => {
        if (success) {
            showFeedback("Task deleted successfully!");
        } else {
            // Revert changes if sync failed
            tasks = tasksCopy;
            renderTasks();
            showFeedback("Could not delete task. Please check your internet connection.", "error");
        }
    }).catch(error => {
        console.error('Error deleting task:', error);
        // Revert changes
        tasks = tasksCopy;
        renderTasks();
        showFeedback("Could not delete task. Please check your internet connection.", "error");
    });
}

function completeTask(taskId) {
    console.log('Toggling task completion:', taskId);
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        console.error('Task not found for completion toggle:', taskId);
        return;
    }

    if (!isOnline || !db) {
        showFeedback("Cannot mark task complete - you are offline.", "error");
        return;
    }

    const task = tasks[taskIndex];
    const newCompletedState = !task.completed;
    
    // Update the task in the local array
    tasks[taskIndex] = { ...task, completed: newCompletedState };
    
    // If task is being completed, cancel any scheduled reminder
    if (newCompletedState) {
        cancelTaskReminder(taskId);
    } else if (task.dueDate && task.dueTime) {
        // If task is being un-completed and has a due date/time, reschedule reminder
        scheduleTaskReminder(tasks[taskIndex]);
    }
    
    renderTasks(); // Update UI immediately
    
    // Sync to Firebase
    syncTasksToCloud().then(success => {
        if (success) {
            // If task is being marked as complete, generate follow-up suggestion
            if (newCompletedState) {
                try {
                    console.log('Generating follow-up suggestion...');
                    generateFollowUpWithAI(task).then(followUpSuggestion => {
                        console.log('Generated follow-up suggestion:', followUpSuggestion);
                        
                        // Find the task element and append the suggestion
                        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
                        if (taskElement) {
                            const suggestionElement = document.createElement('div');
                            suggestionElement.className = 'suggested-follow-up';
                            suggestionElement.innerHTML = `
                                <div class="suggested-follow-up-title">Suggested Follow-up:</div>
                                <div class="suggested-follow-up-action">
                                    <span>${followUpSuggestion}</span>
                                    <button class="add-suggestion-btn">Add as Task</button>
                                </div>
                            `;
                            
                            // Add event listener to the "Add as Task" button
                            const addBtn = suggestionElement.querySelector('.add-suggestion-btn');
                            addBtn.addEventListener('click', () => {
                                taskInput.value = followUpSuggestion;
                                taskInput.focus();
                                window.scrollTo(0, 0);
                            });
                            
                            taskElement.appendChild(suggestionElement);
                        } else {
                            console.warn('Task element not found for adding suggestion:', taskId);
                        }
                    }).catch(error => {
                        console.error('Error generating follow-up suggestion:', error);
                    });
                } catch (error) {
                    console.error('Error initiating follow-up suggestion:', error);
                }
            }
        } else {
            // Revert changes if sync failed
            tasks[taskIndex] = task; // Restore original state
            renderTasks();
            showFeedback("Could not update task. Please check your internet connection.", "error");
        }
    }).catch(error => {
        console.error('Error updating task completion:', error);
        // Revert changes
        tasks[taskIndex] = task;
        renderTasks();
        showFeedback("Could not update task. Please check your internet connection.", "error");
    });
}

// Handle editing tasks
function editTask(taskId) {
    editingTaskId = taskId;
    renderTasks();
}

// Render functions
function renderTasks() {
    if (editingTaskId !== null) {
        renderTaskEditForm();
        return;
    }

    const searchTerm = searchInput.value.toLowerCase();
    let filteredTasks = tasks.filter(task => {
        // First filter out completed tasks unless specifically showing them
        if (task.completed && currentFilter !== 'completed' && currentFilter !== 'all') {
            return false;
        }
        
        const matchesSearch = task.title.toLowerCase().includes(searchTerm) || 
                             (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                             (task.notes && task.notes.toLowerCase().includes(searchTerm));
        
        let matchesFilter = true;
        if (currentFilter === 'active') matchesFilter = !task.completed;
        if (currentFilter === 'completed') matchesFilter = task.completed;
        if (currentFilter === 'high') matchesFilter = task.priority === 'high';
        if (currentFilter === 'medium') matchesFilter = task.priority === 'medium';
        if (currentFilter === 'low') matchesFilter = task.priority === 'low';
        
        return matchesSearch && matchesFilter;
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML = '<div class="no-tasks">No tasks to display</div>';
        return;
    }

    // Group tasks by date
    const groupedTasks = groupTasksByDate(filteredTasks);
    
    // Clear the task list
    taskList.innerHTML = '';
    
    // Render each group
    Object.keys(groupedTasks).forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.className = 'task-group';
        
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.textContent = group;
        groupElement.appendChild(groupHeader);
        
        // Render tasks in this group
        groupedTasks[group].forEach(task => {
            const taskElement = renderTaskItem(task);
            groupElement.appendChild(taskElement);
        });
        
        taskList.appendChild(groupElement);
    });
}

function renderTaskItem(task) {
    const taskElement = document.createElement('div');
    taskElement.className = `task-item ${task.completed ? 'completed' : ''} ${task.priority}-priority`;
    taskElement.dataset.taskId = task.id;
    
    const priorityText = {
        high: '<i class="fas fa-exclamation-circle"></i> High',
        medium: '<i class="fas fa-circle"></i> Medium',
        low: '<i class="fas fa-arrow-down-circle"></i> Low'
    };
    
// Build the task content
let taskContent = `
    <div class="task-content">
        <div class="task-title">
            ${task.title}
            <button class="expand-collapse-btn" title="Expand/Collapse">
                <i class="fas fa-chevron-down"></i>
            </button>
        </div>
        ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
        <div class="task-details">
            ${task.dueDate ? `
                <span class="task-detail">
                    <i class="far fa-calendar-alt"></i> 
                    ${formatDate(task.dueDate)}
                    ${task.dueTime ? ` at ${formatTime(task.dueTime)}` : ''}
                </span>
            ` : ''}
            <span class="task-detail">
                ${priorityText[task.priority] || priorityText.medium}
            </span>
            ${task.category ? `
                <span class="task-detail">
                    <i class="fas fa-tag"></i> 
                    ${task.category}
                </span>
            ` : ''}
        </div>
    `;
    
    // Add notes if they exist
    if (task.notes && task.notes.trim() !== '') {
        taskContent += `
            <div class="task-notes">
                <i class="fas fa-sticky-note"></i> Notes:
                <div class="notes-content">${task.notes}</div>
            </div>
        `;
    }
    
    // Close the task-content div
    taskContent += `</div>`;
    
    // Add actions
    taskContent += `
        <div class="task-actions">
            <button class="task-btn complete-btn" title="${task.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
            </button>
            <button class="task-btn edit-btn" title="Edit task">
                <i class="fas fa-edit"></i>
            </button>
            <button class="task-btn delete-btn" title="Delete task">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    taskElement.innerHTML = taskContent;
    
    // Add event listeners to the buttons
    const completeBtn = taskElement.querySelector('.complete-btn');
    const editBtn = taskElement.querySelector('.edit-btn');
    const deleteBtn = taskElement.querySelector('.delete-btn');
    const expandCollapseBtn = taskElement.querySelector('.expand-collapse-btn');
    
    completeBtn.addEventListener('click', () => completeTask(task.id));
    editBtn.addEventListener('click', () => editTask(task.id));
    deleteBtn.addEventListener('click', () => deleteTask(task.id));
    
    // Add expand/collapse functionality
    if (expandCollapseBtn) {
        expandCollapseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            taskElement.classList.toggle('collapsed');
        });
    }
    
    // Start with tasks collapsed by default
    taskElement.classList.add('collapsed');
    
    return taskElement;
}

function renderTaskEditForm() {
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;
    
    taskList.innerHTML = '';
    
    const formElement = document.createElement('div');
    formElement.className = 'task-edit-form';
    formElement.innerHTML = `
        <h3>Edit Task</h3>
        <input type="text" id="edit-title" value="${task.title}" placeholder="Task title">
        <input type="text" id="edit-description" value="${task.description || ''}" placeholder="Description (optional)">
        <div class="date-time-container">
            <input type="date" id="edit-due-date" value="${task.dueDate ? task.dueDate.split('T')[0] : ''}" placeholder="Due date">
            <input type="time" id="edit-due-time" value="${task.dueTime || ''}" placeholder="Due time">
        </div>
        <select id="edit-priority">
            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High Priority</option>
            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium Priority</option>
            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low Priority</option>
        </select>
        <input type="text" id="edit-category" value="${task.category || ''}" placeholder="Category (optional)">
        <textarea id="edit-notes" placeholder="Notes (optional)" rows="4">${task.notes || ''}</textarea>
        <button id="save-edit">Save Changes</button>
        <button class="cancel" id="cancel-edit">Cancel</button>
    `;
    
    taskList.appendChild(formElement);
    
    // Add event listeners
    const saveBtn = document.getElementById('save-edit');
    const cancelBtn = document.getElementById('cancel-edit');
    
    saveBtn.addEventListener('click', () => {
        const updatedTask = {
            title: document.getElementById('edit-title').value.trim(),
            description: document.getElementById('edit-description').value.trim(),
            dueDate: document.getElementById('edit-due-date').value ? new Date(document.getElementById('edit-due-date').value).toISOString() : null,
            dueTime: document.getElementById('edit-due-time').value || null,
            priority: document.getElementById('edit-priority').value,
            category: document.getElementById('edit-category').value.trim() || 'general',
            notes: document.getElementById('edit-notes').value.trim()
        };
        
        // If we have both date and time, add time to the description
        if (updatedTask.dueDate && updatedTask.dueTime && !updatedTask.description) {
            updatedTask.description = `Due at ${formatTime(updatedTask.dueTime)}`;
        } else if (updatedTask.dueDate && updatedTask.dueTime) {
            // Check if the description already contains time information
            if (!updatedTask.description.includes('Due at')) {
                updatedTask.description = `Due at ${formatTime(updatedTask.dueTime)}. ${updatedTask.description}`;
            }
        }
        
        updateTask(editingTaskId, updatedTask);
    });
    
    cancelBtn.addEventListener('click', () => {
        editingTaskId = null;
        renderTasks();
    });
}

// Chat handling
async function handleChatSend() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;
    
    // Add user message to chat
    addMessageToChat(userMessage, 'user');
    chatInput.value = '';
    
    // Add loading indicator
    const loadingId = 'loading-' + Date.now();
    addLoadingIndicator(loadingId);
    
    try {
        // Get AI response
        const aiResponse = await getAIChatResponse(userMessage);
        
        // Remove loading indicator
        removeLoadingIndicator(loadingId);
        
        // Add AI response to chat
        addMessageToChat(aiResponse, 'ai');
        
        // We'll only offer to add as task for very specific task-like messages
        // to avoid cluttering the chat window with too many "Add as task" buttons
        const lowerUserMessage = userMessage.toLowerCase();
        
        // Only show "Add as task" for messages that are very clearly tasks
        if (lowerUserMessage.includes('remind me to') || 
            lowerUserMessage.includes('add to my list') ||
            lowerUserMessage.includes('add task') ||
            lowerUserMessage.includes('new task')) {
            offerToAddTask(userMessage);
        }
    } catch (error) {
        console.error('Error sending chat message:', error);
        
        // Remove loading indicator
        removeLoadingIndicator(loadingId);
        
        // Add error message
        addMessageToChat('Sorry, I encountered an error connecting to the AI service. I can still help with basic task management!', 'ai');
        
        // Only offer to add as task for very specific task-like messages
        // even in error case, to be consistent with the normal flow
        const strongTaskIndicators = [
            'remind me to', 'add to my list', 'add task', 'new task'
        ];
        
        const lowerMessage = userMessage.toLowerCase();
        const containsStrongTaskIndicator = strongTaskIndicators.some(indicator => 
            lowerMessage.includes(indicator)
        );
        
        if (containsStrongTaskIndicator && !lowerMessage.endsWith('?')) {
            offerToAddTask(userMessage);
        }
    }
}

function addMessageToChat(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    messageElement.textContent = message;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLoadingIndicator(id) {
    const loadingElement = document.createElement('div');
    loadingElement.id = id;
    loadingElement.className = 'loading';
    loadingElement.innerHTML = '<div class="spinner"></div> Thinking...';
    
    chatMessages.appendChild(loadingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingIndicator(id) {
    const loadingElement = document.getElementById(id);
    if (loadingElement) {
        loadingElement.remove();
    }
}

function offerToAddTask(message) {
    // Skip showing the button for certain types of messages
    const lowerMessage = message.toLowerCase();
    
    // Don't show for questions about existing tasks
    if (lowerMessage.includes('what tasks') || 
        lowerMessage.includes('show me my tasks') || 
        lowerMessage.includes('list my tasks') ||
        lowerMessage.includes('my tasks for') ||
        lowerMessage.includes('do i have any tasks')) {
        console.log('Skipping "Add as task" button for task query:', message);
        return;
    }
    
    // Don't show for general questions
    if (lowerMessage.endsWith('?') || 
        lowerMessage.startsWith('what') || 
        lowerMessage.startsWith('how') || 
        lowerMessage.startsWith('who') || 
        lowerMessage.startsWith('when') || 
        lowerMessage.startsWith('where') || 
        lowerMessage.startsWith('why') || 
        lowerMessage.startsWith('can you') || 
        lowerMessage.startsWith('could you')) {
        console.log('Skipping "Add as task" button for question:', message);
        return;
    }
    
    // Only show for messages that are very likely to be tasks
    const strongTaskIndicators = [
        'remind me to', 'need to', 'have to', 'must', 'don\'t forget to',
        'remember to', 'add to my list', 'add task', 'new task'
    ];
    
    const containsStrongTaskIndicator = strongTaskIndicators.some(indicator => 
        lowerMessage.includes(indicator)
    );
    
    // If it doesn't strongly look like a task, don't show the button
    if (!containsStrongTaskIndicator) {
        console.log('Skipping "Add as task" button for non-task message:', message);
        return;
    }
    
    // Create and add the "Add as task" button
    const actionElement = document.createElement('div');
    actionElement.className = 'suggested-follow-up';
    actionElement.innerHTML = `
        <div class="suggested-follow-up-title">Add as task?</div>
        <div class="suggested-follow-up-action">
            <button class="add-suggestion-btn">Add as Task</button>
        </div>
    `;
    
    // Add event listener
    const addBtn = actionElement.querySelector('.add-suggestion-btn');
    addBtn.addEventListener('click', () => {
        taskInput.value = message;
        taskInput.focus();
        window.scrollTo(0, 0);
    });
    
    chatMessages.appendChild(actionElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// AI Integration Functions
// Generate a rich date-time context with detailed date information
function generateDateTimeContext() {
    const now = new Date();
    const currentDay = now.getDay();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Current date in multiple formats
    const context = {
        currentDateTime: {
            iso: now.toISOString(),
            readable: now.toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                timeZoneName: 'short'
            }),
            date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', timeZoneName: 'short' }),
            unixTimestamp: Math.floor(now.getTime() / 1000)
        },
        currentWeek: [],
        nextWeek: [],
        upcomingDates: {}
    };
    
    // Generate current week dates
    for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        const dayIndex = (currentDay + i) % 7; // Start from current day and wrap around to the week
        date.setDate(date.getDate() + i); // Add days starting from today
        
        context.currentWeek.push({
            weekday: weekdays[dayIndex],
            date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            iso: date.toISOString().split('T')[0],
            isToday: i === 0
        });
    }
    
    // Generate next week dates
    for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        const dayIndex = (currentDay + i) % 7; // Same day pattern as current week
        date.setDate(date.getDate() + i + 7); // Add 7 days to get to next week
        
        context.nextWeek.push({
            weekday: weekdays[dayIndex],
            date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            iso: date.toISOString().split('T')[0]
        });
    }
    
    // Add special reference dates
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    context.upcomingDates = {
        tomorrow: {
            iso: tomorrow.toISOString().split('T')[0],
            readable: tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        },
        nextMonthStart: {
            iso: nextMonth.toISOString().split('T')[0],
            readable: nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        },
        endOfMonth: {
            iso: endOfMonth.toISOString().split('T')[0],
            readable: endOfMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        }
    };
    
    return context;
}

async function parseTaskWithAI(taskText) {
    try {
        // Check if API key is set
        if (!isApiKeySet()) {
            if (!promptForApiKey()) {
                console.warn('No OpenAI API key provided, using fallback parsing');
                return createFallbackTaskObject(taskText);
            }
        }
        
        // Set a timeout to ensure we don't wait too long for the AI response
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI parsing timed out')), 10000)
        );
        
        // Create the API request promise
        const apiPromise = new Promise(async (resolve, reject) => {
            try {
                // Get rich date-time context
                const dateContext = generateDateTimeContext();
                
                // Format current week as a readable string
                const currentWeekFormatted = dateContext.currentWeek
                    .map(day => `${day.weekday} is ${day.date}${day.isToday ? ' (Today)' : ''}`)
                    .join('\n      ');
                
                // Format next week as a readable string
                const nextWeekFormatted = dateContext.nextWeek
                    .map(day => `${day.weekday} is ${day.date}`)
                    .join('\n      ');
                
                // Basic date references for compatibility with existing code
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const todayFormatted = today.toISOString().split('T')[0]; // YYYY-MM-DD
                const tomorrowFormatted = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
                
                console.log(`Enhanced date context for AI: Today is ${dateContext.currentDateTime.readable}`);
                
                // Call OpenAI API directly
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_MODEL,
                        messages: [
                            {
                                role: "system",
                                content: `You are an AI assistant helping to parse natural language task inputs.

Today's complete date and time information:
- Current date and time: ${dateContext.currentDateTime.readable}
- Today is ${dateContext.currentDateTime.date}
- Current time is ${dateContext.currentDateTime.time}
- ISO format: ${dateContext.currentDateTime.iso}

This week's dates:
      ${currentWeekFormatted}
      
Next week's dates:
      ${nextWeekFormatted}
      
Other reference dates:
- Tomorrow is ${dateContext.upcomingDates.tomorrow.readable}
- Start of next month is ${dateContext.upcomingDates.nextMonthStart.readable}
- End of this month is ${dateContext.upcomingDates.endOfMonth.readable}

Extract the following information from the task:

1. Task title - Create a concise, professional, action-oriented title (5-7 words max). 
   - Focus ONLY on the core action/task
   - REMOVE ALL time/date information, priority indicators, and unnecessary words
   - Start with a verb when possible
   - Example: "super important one on one with my manager on monday at 9am" → "One on One with Manager"
   - Example: "need to buy milk from the store tomorrow morning" → "Buy Milk from Store"

2. Description - Include ALL additional details that were removed from the title, including:
   - Priority indicators ("important", "urgent", etc.)
   - Context information
   - Any other details not included in the title

3. Due date - Extract in ISO format YYYY-MM-DD, if mentioned.
   - IMPORTANT: Today is ${todayFormatted}
   - IMPORTANT: Tomorrow is ${tomorrowFormatted}
   - If "tomorrow" is mentioned, use ${tomorrowFormatted}
   - Use the current year (${today.getFullYear()}) for any dates without a year
   - Make sure all dates are in the future relative to today

4. Due time - Extract time in 24-hour format (HH:MM), if mentioned. Convert time expressions:
   - "morning" → "09:00"
   - "afternoon" → "14:00"
   - "evening" → "19:00"
   - "night" → "21:00"
   - "noon" → "12:00"
   - "midnight" → "00:00"

5. Priority - Set as "high", "medium", or "low". Look for indicators:
   - High priority: "urgent", "important", "super important", "very important", "critical", "asap", "top priority", "highest priority", "crucial", "vital", "essential"
   - Low priority: "low priority", "whenever", "not urgent", "someday", "when you have time", "no rush", "not important", "can wait"
   - Default to "medium" if no priority indicators are found

6. Category - Identify as work, personal, shopping, health, etc.

Respond in JSON format with these fields. For example:
{
  "title": "One on One with Manager",
  "description": "Important meeting to discuss project updates",
  "dueDate": "2025-03-03",
  "dueTime": "09:00",
  "priority": "high",
  "category": "work"
}`
                            },
                            {
                                role: "user",
                                content: taskText
                            }
                        ],
                        temperature: 0.7
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText || 'Unknown error'}`);
                }
                
                const data = await response.json();
                const content = data.choices[0].message.content.trim();
                
                // Try to parse the response as JSON
                try {
                    const parsedTask = JSON.parse(content);
                    
                    // Validate the due date if present
                    if (parsedTask.dueDate) {
                        // Check if the date is valid
                        const dueDate = new Date(parsedTask.dueDate);
                        if (isNaN(dueDate.getTime())) {
                            console.warn(`Invalid date from AI parser: ${parsedTask.dueDate}, using fallback parser`);
                            // If the date is invalid, use the fallback parser's date
                            const fallbackTask = createFallbackTaskObject(taskText);
                            parsedTask.dueDate = fallbackTask.dueDate;
                        } else {
                            // Check if the date is in the past
                            const today = new Date();
                            today.setHours(0, 0, 0, 0); // Reset time to start of day
                            
                            if (dueDate < today) {
                                console.warn(`Date from AI parser is in the past: ${parsedTask.dueDate}, using fallback parser`);
                                // If the date is in the past, use the fallback parser's date
                                const fallbackTask = createFallbackTaskObject(taskText);
                                parsedTask.dueDate = fallbackTask.dueDate;
                            }
                        }
                    }
                    
                    // Special handling for "tomorrow" - do this regardless of whether AI returned a date
                    if (taskText.toLowerCase().includes('tomorrow')) {
                        const today = new Date();
                        const tomorrow = new Date(today);
                        tomorrow.setDate(today.getDate() + 1);
                        const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
                        
                        // Always force tomorrow's date for tasks mentioning "tomorrow"
                        if (!parsedTask.dueDate || parsedTask.dueDate !== tomorrowFormatted) {
                            console.warn(`Task mentions "tomorrow" but AI returned ${parsedTask.dueDate || 'no date'}, forcing to ${tomorrowFormatted}`);
                            parsedTask.dueDate = tomorrowFormatted;
                        }
                    }
                    
                    console.log('AI parser result with validation:', parsedTask);
                    resolve(parsedTask);
                } catch (error) {
                    console.error("Error parsing AI response as JSON:", error);
                    throw new Error("Failed to parse AI response as JSON");
                }
            } catch (error) {
                console.error('Error calling OpenAI API:', error);
                reject(error);
            }
        });
        
        // Race the API call against the timeout
        return await Promise.race([apiPromise, timeoutPromise]);
    } catch (error) {
        console.warn('Error or timeout in AI parsing, using fallback:', error);
        return createFallbackTaskObject(taskText);
    }
}

// Fallback function to parse tasks without AI
function createFallbackTaskObject(taskText) {
    console.log('Using fallback parsing for:', taskText);
    
    // Show system date/time for debugging
    const today = new Date();
    console.log(`System date: ${today.toDateString()}, Day of week: ${today.getDay()} (0=Sunday, 6=Saturday)`);
    
    // First, check if the task starts with URGENT, HIGH, MEDIUM, or LOW
    let priority = 'medium';
    let title = taskText;
    
    // Force high priority for any task starting with URGENT
    if (taskText.toUpperCase().startsWith('URGENT')) {
        priority = 'high';
        // Consider removing the URGENT prefix from the title
        if (taskText.includes('-') && taskText.indexOf('-') < 10) {
            title = taskText.substring(taskText.indexOf('-') + 1).trim();
        }
    }
    
    // Check for priority indicators within the text
    const highPriorityRegex = /\b(urgent|asap|emergency|high priority|important|critical|super important|very important|top priority|highest priority|crucial|vital|essential|priority|immediate|ASAP|right away|as soon as possible|immediately|now|quick|quickly|fast|promptly|expedite|expedited|rush|hurry|hurried|pressing|imperative|priority|prioritize|significant|serious|severe|major|key|primary|main|principal|foremost|paramount|supreme|utmost|extreme|dire|grave|life-or-death|time-sensitive|deadline|due|overdue|stat)\b/i;
    const lowPriorityRegex = /\b(low priority|whenever|not urgent|someday|when you have time|no rush|not important|can wait|later|eventually|sometime|some time|at your leisure|when convenient|if you have time|if you get a chance|if possible|maybe|perhaps|possibly|optionally|secondary|minor|trivial|non-essential|non-critical|non-urgent|unimportant|insignificant|negligible|marginal|peripheral|incidental|supplementary|extra|bonus|additional|whenever|any time|leisurely|casual|relaxed|easy|simple|basic|standard|regular|normal|ordinary|common|usual|typical|average|moderate|reasonable|fair|decent|acceptable|tolerable|adequate|sufficient|enough|fine|okay|alright|not critical|not essential|not important|not urgent|not pressing|not serious|not significant|not major|not key|not primary|not main|not principal|not foremost|not paramount|not supreme|not utmost|not extreme|not dire|not grave|not life-or-death|not time-sensitive)\b/i;
    
    if (highPriorityRegex.test(taskText.toLowerCase())) {
        priority = 'high';
    } else if (lowPriorityRegex.test(taskText.toLowerCase())) {
        priority = 'low';
    }
    
    // Check for time information
    let dueTime = null;
    
    // Enhanced time patterns
    const timePatterns = [
        // 12-hour format with am/pm
        { regex: /\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm|a\.m\.|p\.m\.)\b/i, 
          handler: (match) => {
              const hour = parseInt(match[1], 10);
              const minute = match[2] ? parseInt(match[2], 10) : 0;
              const isPM = match[3].toLowerCase().startsWith('p');
              
              // Convert to 24-hour format
              const hour24 = isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
              return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          }
        },
        // 24-hour format
        { regex: /\b([01][0-9]|2[0-3]):([0-5][0-9])\b/, 
          handler: (match) => `${match[1]}:${match[2]}`
        },
        // Words like "noon", "midnight"
        { regex: /\b(noon|midday|midnight)\b/i,
          handler: (match) => {
              if (match[1].toLowerCase() === 'noon' || match[1].toLowerCase() === 'midday') {
                  return '12:00';
              } else if (match[1].toLowerCase() === 'midnight') {
                  return '00:00';
              }
          }
        },
        // Time periods with more specific times
        { regex: /\b(early morning|morning|late morning|early afternoon|afternoon|late afternoon|early evening|evening|late evening|night)\b/i,
          handler: (match) => {
              const period = match[1].toLowerCase();
              if (period === 'early morning') {
                  return '07:00';
              } else if (period === 'morning') {
                  return '09:00';
              } else if (period === 'late morning') {
                  return '11:00';
              } else if (period === 'early afternoon') {
                  return '13:00';
              } else if (period === 'afternoon') {
                  return '14:00';
              } else if (period === 'late afternoon') {
                  return '16:00';
              } else if (period === 'early evening') {
                  return '17:00';
              } else if (period === 'evening') {
                  return '19:00';
              } else if (period === 'late evening') {
                  return '21:00';
              } else if (period === 'night') {
                  return '21:00';
              }
          }
        },
        // "At X o'clock"
        { regex: /\bat\s+(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*o'?clock\s*(am|pm|a\.m\.|p\.m\.)?/i,
          handler: (match) => {
              const hour = parseInt(match[1], 10);
              const minute = match[2] ? parseInt(match[2], 10) : 0;
              const isPM = match[3] ? match[3].toLowerCase().startsWith('p') : (hour >= 6 && hour <= 11); // Default to PM for 6-11 if not specified
              
              // Convert to 24-hour format
              const hour24 = isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
              return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          }
        },
        // "At X" (assuming o'clock)
        { regex: /\bat\s+(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm|a\.m\.|p\.m\.)?/i,
          handler: (match) => {
              const hour = parseInt(match[1], 10);
              const minute = match[2] ? parseInt(match[2], 10) : 0;
              const isPM = match[3] ? match[3].toLowerCase().startsWith('p') : (hour >= 6 && hour <= 11); // Default to PM for 6-11 if not specified
              
              // Convert to 24-hour format
              const hour24 = isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
              return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          }
        }
    ];
    
    // Try each time pattern
    for (const pattern of timePatterns) {
        const match = taskText.match(pattern.regex);
        if (match) {
            dueTime = pattern.handler(match);
            console.log(`Detected time: ${match[0]}, converted to: ${dueTime}`);
            break;
        }
    }
    
    let description = '';
    let category = 'general';
    let dueDate = null;
    
    // Check for categories
    const workRegex = /\b(work|job|office|meeting|presentation|client|project)\b/i;
    const personalRegex = /\b(personal|home|family|hobby|myself)\b/i;
    const shoppingRegex = /\b(shop|buy|purchase|get|grocery|store)\b/i;
    const healthRegex = /\b(doctor|health|exercise|gym|workout|medicine|medical|dentist)\b/i;
    
    if (workRegex.test(taskText)) {
        category = 'work';
    } else if (personalRegex.test(taskText)) {
        category = 'personal';
    } else if (shoppingRegex.test(taskText)) {
        category = 'shopping';
    } else if (healthRegex.test(taskText)) {
        category = 'health';
    }
    
    // ==== DIRECT DATE DETECTION (most reliable) ====
    
    // First check for tomorrow explicitly
    if (taskText.toLowerCase().includes('tomorrow')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        dueDate = tomorrow.toISOString().split('T')[0];
        console.log(`Detected "tomorrow", setting due date to ${dueDate}`);
    }
    // Then check for specific date formats
    else if (/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(taskText)) {
        // MM/DD or MM/DD/YYYY format
        const dateMatch = taskText.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10) - 1; // 0-based months
            const day = parseInt(dateMatch[2], 10);
            let year = today.getFullYear();
            
            if (dateMatch[3]) {
                year = parseInt(dateMatch[3], 10);
                if (year < 100) year += 2000; // Convert 2-digit years
            }
            
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                dueDate = date.toISOString().split('T')[0];
                console.log(`Detected date format MM/DD: ${dueDate}`);
            }
        }
    }
    
    // ==== DAY NAME DETECTION ====
    // Only process if no direct date was found
    if (!dueDate) {
        const dayMap = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
            'thursday': 4, 'friday': 5, 'saturday': 6
        };
        
        // Handle "this [day]" expressions (e.g., "this Friday")
        let thisRegexMatch = /this (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.exec(taskText);
        if (thisRegexMatch) {
            const dayName = thisRegexMatch[1].toLowerCase();
            const targetDay = dayMap[dayName];
            const currentDay = today.getDay();
            
            let daysToAdd;
            if (targetDay === currentDay) {
                // "This Monday" on a Monday means today
                daysToAdd = 0;
            } else if (targetDay > currentDay) {
                // This week's occurrence (e.g., "this Friday" on a Monday)
                daysToAdd = targetDay - currentDay;
            } else {
                // Next week's occurrence (e.g., "this Monday" on a Wednesday)
                daysToAdd = 7 + (targetDay - currentDay);
            }
            
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);
            dueDate = targetDate.toISOString().split('T')[0];
            console.log(`Detected "this ${dayName}", adding ${daysToAdd} days, setting due date to ${dueDate}`);
        }
        // Handle "next [day]" expressions (e.g., "next Friday")
        else if (/next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.test(taskText)) {
            const nextRegexMatch = /next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.exec(taskText);
            if (nextRegexMatch) {
                const dayName = nextRegexMatch[1].toLowerCase();
                const targetDay = dayMap[dayName];
                const currentDay = today.getDay();
                
                // Always go to next week (7+ days)
                const daysToAdd = 7 + ((targetDay - currentDay + 7) % 7);
                
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + daysToAdd);
                dueDate = targetDate.toISOString().split('T')[0];
                console.log(`Detected "next ${dayName}", adding ${daysToAdd} days, setting due date to ${dueDate}`);
            }
        }
        // Simple day name detection (like "Friday")
        else {
            for (const dayName of Object.keys(dayMap)) {
                if (taskText.toLowerCase().includes(dayName)) {
                    const targetDay = dayMap[dayName];
                    const currentDay = today.getDay();
                    
                    // Calculate days to add
                    let daysToAdd;
                    if (targetDay > currentDay) {
                        // Later this week
                        daysToAdd = targetDay - currentDay;
                    } else if (targetDay < currentDay) {
                        // Next week
                        daysToAdd = 7 + (targetDay - currentDay);
                    } else {
                        // Same day, use next week
                        daysToAdd = 7;
                    }
                    
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() + daysToAdd);
                    dueDate = targetDate.toISOString().split('T')[0];
                    console.log(`Detected "${dayName}", adding ${daysToAdd} days, setting due date to ${dueDate}`);
                    break;
                }
            }
        }
    }
    
    // Month name with day - like "March 15th"
    const monthNameDayPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?/i;
    const monthNameDayMatch = taskText.match(monthNameDayPattern);

    if (monthNameDayMatch) {
        const monthMap = {
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        };
        
        const monthName = monthNameDayMatch[1].toLowerCase();
        const month = monthMap[monthName];
        const day = parseInt(monthNameDayMatch[2], 10);
        
        // Determine year (current year, unless the date has already passed)
        let year = today.getFullYear();
        const dateWithCurrentYear = new Date(year, month, day);
        
        // If the date has already passed this year, use next year
        if (dateWithCurrentYear < today) {
            year++;
        }
        
        const specificDate = new Date(year, month, day);
        dueDate = specificDate.toISOString().split('T')[0];
        console.log(`Detected month name with day pattern "${monthNameDayMatch[0]}", setting due date to ${dueDate}`);
    }

    // Enhanced day name with month and day - like "Thursday March 13th"
    const dayMonthPattern = /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?/i;
    const dayMonthMatch = taskText.match(dayMonthPattern);

    if (dayMonthMatch) {
        const monthMap = {
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        };
        
        const monthName = dayMonthMatch[2].toLowerCase();
        const month = monthMap[monthName];
        const day = parseInt(dayMonthMatch[3], 10);
        
        // Always use current year for day+month format
        const year = today.getFullYear();
        const specificDate = new Date(year, month, day);
        
        // Verify the date is valid and not in the past
        if (!isNaN(specificDate.getTime())) {
            // If date is in the past, assume next year
            if (specificDate < today) {
                specificDate.setFullYear(year + 1);
            }
            
            dueDate = specificDate.toISOString().split('T')[0];
            console.log(`Detected day with month pattern "${dayMonthMatch[0]}", setting due date to ${dueDate}`);
        }
    }
    
    // If still no due date, check for other date patterns
    if (!dueDate) {
        // Handle "today", "tonight", "this morning/afternoon/evening"
        if (/\b(today|tonight|this morning|this afternoon|this evening)\b/i.test(taskText)) {
            dueDate = today.toISOString().split('T')[0];
            console.log(`Detected "today", setting due date to ${dueDate}`);
        } 
        // Handle "next week"
        else if (/\b(next week)\b/i.test(taskText)) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            dueDate = nextWeek.toISOString().split('T')[0];
            console.log(`Detected "next week", setting due date to ${dueDate}`);
        }
        // Handle month name patterns
        else {
            const monthPattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?/i;
            const monthMatch = taskText.match(monthPattern);
            
            if (monthMatch) {
                const monthMap = {
                    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                };
                
                const month = monthMap[monthMatch[1].toLowerCase().substring(0, 3)];
                const day = parseInt(monthMatch[2], 10);
                
                // Determine year (current year, unless the date has already passed)
                let year = today.getFullYear();
                const dateWithCurrentYear = new Date(year, month, day);
                
                // If the date has already passed this year, use next year
                if (dateWithCurrentYear < today) {
                    year++;
                }
                
                const specificDate = new Date(year, month, day);
                dueDate = specificDate.toISOString().split('T')[0];
                console.log(`Detected month name pattern "${monthMatch[0]}", setting due date to ${dueDate}`);
            }
        }
    }
    
    // Check for due in pattern (e.g., "due in 3 days")
    if (!dueDate) {
        const dueInRegex = /due in (\d+) (day|days|week|weeks|month|months)/i;
        const dueInMatch = taskText.match(dueInRegex);
        
        if (dueInMatch) {
            const amount = parseInt(dueInMatch[1], 10);
            const unit = dueInMatch[2].toLowerCase();
            
            const dueInDate = new Date(today);
            if (unit === 'day' || unit === 'days') {
                dueInDate.setDate(today.getDate() + amount);
            } else if (unit === 'week' || unit === 'weeks') {
                dueInDate.setDate(today.getDate() + (amount * 7));
            } else if (unit === 'month' || unit === 'months') {
                dueInDate.setMonth(today.getMonth() + amount);
            }
            
            dueDate = dueInDate.toISOString().split('T')[0];
            console.log(`Detected "due in ${amount} ${unit}", setting due date to ${dueDate}`);
        }
    }
    
    console.log('Fallback parsing result:', { title, description, dueDate, dueTime, priority, category, notes: '' });
    return {
        title,
        description,
        dueDate,
        dueTime,
        priority,
        category,
        notes: '' // Add notes field
    };
}

async function generateFollowUpWithAI(task) {
    try {
        // Check if API key is set
        if (!isApiKeySet()) {
            if (!promptForApiKey()) {
                console.warn('No OpenAI API key provided, using fallback follow-up suggestion');
                return getFallbackFollowUpSuggestion(task);
            }
        }
        
        // Create a timeout for the suggestion
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Follow-up suggestion timed out')), 8000)
        );
        
        // Create the API request promise
        const apiPromise = new Promise(async (resolve, reject) => {
            try {
                // Call OpenAI API directly
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_MODEL,
                        messages: [
                            {
                                role: "system",
                                content: `You are an AI assistant helping with task management. 
                                A user has just completed the following task:
                                
                                Title: ${task.title}
                                Description: ${task.description || 'None'}
                                Category: ${task.category || 'general'}
                                
                                Suggest a single, specific follow-up action that would be logical to do next. 
                                Keep it brief (under 15 words) and actionable. Don't use phrases like "you could" or "I suggest" - just state the follow-up task directly.`
                            }
                        ],
                        temperature: 0.7
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText || 'Unknown error'}`);
                }
                
                const data = await response.json();
                const suggestion = data.choices[0].message.content.trim();
                resolve(suggestion);
            } catch (error) {
                console.error('Error calling OpenAI API:', error);
                reject(error);
            }
        });
        
        // Race the API call against the timeout
        return await Promise.race([apiPromise, timeoutPromise]);
    } catch (error) {
        console.warn('Error generating follow-up suggestion, returning fallback:', error);
        return getFallbackFollowUpSuggestion(task);
    }
}

// Helper function to get fallback follow-up suggestion
function getFallbackFollowUpSuggestion(task) {
    // Return a generic follow-up based on task category
    if (task.category === 'work') {
        return "Update team on progress";
    } else if (task.category === 'meeting') {
        return "Send meeting notes to participants";
    } else if (task.category === 'email' || task.title.toLowerCase().includes('email')) {
        return "Follow up if no response within 2 days";
    } else if (task.category === 'shopping') {
        return "Check if you need anything else from the store";
    } else if (task.category === 'health') {
        return "Schedule your next appointment";
    } else if (task.title.toLowerCase().includes('call') || task.title.toLowerCase().includes('phone')) {
        return "Send a follow-up message with call summary";
    } else {
        return "Review what you've accomplished today";
    }
}

async function getAIChatResponse(userMessage) {
    try {
        // Check if API key is set
        if (!isApiKeySet()) {
            if (!promptForApiKey()) {
                console.warn('No OpenAI API key provided, using fallback chat response');
                return getFallbackChatResponse(userMessage);
            }
        }
        
        // Create a timeout promise that rejects after 10 seconds
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Chat response timed out')), 10000)
        );
        
        // Create the API request promise
        const apiPromise = new Promise(async (resolve, reject) => {
            try {
                // Create a context with the user's tasks
                const taskContext = tasks && tasks.length > 0 
                    ? `Here are the user's current tasks:\n${tasks.map(t => 
                        `- ${t.title} (${t.completed ? 'Completed' : 'Active'}, Priority: ${t.priority}${t.dueDate ? `, Due: ${t.dueDate}` : ''})`
                    ).join('\n')}`
                    : 'The user has no tasks yet.';
                
                // Call OpenAI API directly
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_MODEL,
                        messages: [
                            {
                                role: "system",
                                content: `You are Gorlea, a versatile AI assistant in a to-do list app. While task management is one of your capabilities, you are a fully-featured assistant that can help with any request the user has.
                                
                                ${taskContext}
                                
                                Keep your responses friendly, helpful, and concise (under 3 sentences when possible). If the user is asking about their tasks, provide specific information based on the task context provided.
                                
                                You can help with ANY request, including but not limited to:
                                - Task management (adding, editing, completing tasks)
                                - Creating shopping lists, recipes, meal plans, workout routines
                                - Drafting emails, messages, or other content
                                - Providing recommendations for products, movies, books, etc.
                                - Answering general knowledge questions on any topic
                                - Brainstorming ideas for projects, gifts, activities
                                - Solving problems, explaining concepts, or teaching skills
                                - Providing information about current events, sports, entertainment
                                - Assisting with planning trips, events, or activities
                                - Any other helpful assistance the user requests
                                
                                IMPORTANT: You are NOT limited to task management. You should respond helpfully to ANY request the user makes, whether it's related to tasks or not. If asked for a recipe, provide it. If asked for recommendations, give them. If asked to create a shopping list, do so.`
                            },
                            {
                                role: "user",
                                content: userMessage
                            }
                        ],
                        temperature: 0.7
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText || 'Unknown error'}`);
                }
                
                const data = await response.json();
                const aiResponse = data.choices[0].message.content.trim();
                resolve(aiResponse);
            } catch (error) {
                console.error('Error calling OpenAI API:', error);
                reject(error);
            }
        });
        
        // Race the API call against the timeout
        return await Promise.race([apiPromise, timeoutPromise]);
    } catch (error) {
        console.warn('Error getting AI chat response, returning fallback:', error);
        return getFallbackChatResponse(userMessage);
    }
}

// Helper function to get fallback chat response
function getFallbackChatResponse(userMessage) {
    // Provide a fallback response based on the message content
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how') || lowerMessage.includes('features')) {
        return "I can help with task management, answer questions, provide recommendations, create content like shopping lists or recipes, and much more. What would you like assistance with today?";
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return "Hello! I'm Gorlea. I can help with tasks, answer questions, or assist with anything else you need. How can I help you today?";
    } else if (lowerMessage.includes('thank')) {
        return "You're welcome! Let me know if you need anything else.";
    } else if (lowerMessage.includes('task') || lowerMessage.includes('todo') || lowerMessage.includes('remind')) {
        return "Would you like to add that as a task? Use the 'Add as Task' button below or enter it in the task input field at the top.";
    } else if (lowerMessage.includes('recipe') || lowerMessage.includes('cook') || lowerMessage.includes('food') || lowerMessage.includes('meal')) {
        return "I'd be happy to suggest recipes or help with meal planning. When I'm back online, I can provide detailed recipes with ingredients and instructions.";
    } else if (lowerMessage.includes('list') || lowerMessage.includes('shopping')) {
        return "I can help create shopping lists and organize items by category. When I'm back online, I can provide more detailed assistance.";
    } else if (lowerMessage.includes('recommend') || lowerMessage.includes('suggestion')) {
        return "I'd be happy to provide recommendations. When I'm back online, I can give you personalized suggestions based on your preferences.";
    } else {
        return "I'm currently operating offline. I can still help with basic functions, and when I'm back online, I'll be able to assist with any request you have.";
    }
}

async function callOpenAI(messages, model = OPENAI_MODEL, temperature = 0.7) {
    try {
        // Check if API key is set
        if (!isApiKeySet()) {
            if (!promptForApiKey()) {
                console.warn('No OpenAI API key provided');
                throw new Error('OpenAI API key is required');
            }
        }
        
        // Create a timeout promise that rejects after 10 seconds
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API call timed out')), 10000)
        );
        
        // Create the fetch promise
        const fetchPromise = fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature
            })
        });
        
        // Race the fetch against the timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Utility Functions

// Helper function to get day suffix (st, nd, rd, th)
function getDaySuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
    }
}

// Format time for display (convert 24-hour format to 12-hour format)
function formatTime(timeString) {
    if (!timeString) return '';
    
    try {
        const [hourStr, minuteStr] = timeString.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        
        if (isNaN(hour) || isNaN(minute)) {
            return timeString;
        }
        
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
        
        return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
        console.error("Error formatting time:", error);
        return timeString; // Return the original string if there's an error
    }
}

// Format the date for display
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        // IMPORTANT: Treat the stored date as the source of truth
        // Create a date object without timezone shifts for comparison only
        const dateOnly = dateString.split('T')[0]; // Extract YYYY-MM-DD part
        const dateParts = dateOnly.split('-').map(part => parseInt(part, 10));
        
        // For comparison purposes only - not for display (avoids timezone shifts)
        const dateForComparison = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        
        // Get today, tomorrow, and day after tomorrow for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(today.getDate() + 2);
        
        // Compare only the date parts for special labels
        const isToday = 
            dateForComparison.getFullYear() === today.getFullYear() &&
            dateForComparison.getMonth() === today.getMonth() &&
            dateForComparison.getDate() === today.getDate();
        
        const isTomorrow = 
            dateForComparison.getFullYear() === tomorrow.getFullYear() &&
            dateForComparison.getMonth() === tomorrow.getMonth() &&
            dateForComparison.getDate() === tomorrow.getDate();
        
        const isDayAfterTomorrow = 
            dateForComparison.getFullYear() === dayAfterTomorrow.getFullYear() &&
            dateForComparison.getMonth() === dayAfterTomorrow.getMonth() &&
            dateForComparison.getDate() === dayAfterTomorrow.getDate();
        
        // Check if it's today, tomorrow, or this week - use fixed labels
        if (isToday) {
            return 'Today';
        } else if (isTomorrow) {
            return 'Tomorrow';
        } else if (isDayAfterTomorrow) {
            // Get day name for day after tomorrow
            return dayAfterTomorrow.toLocaleDateString(undefined, { weekday: 'long' });
        } else {
            // IMPORTANT: Use a new date object created from the parts to ensure
            // toLocaleDateString() formats exactly the date that was stored
            const displayDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            
            // Format as Month Day, Year with weekday
            return displayDate.toLocaleDateString(undefined, { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                weekday: 'long' 
            });
        }
    } catch (error) {
        console.error("Error formatting date:", error);
        return dateString; // Return the original string if there's an error
    }
}

// Compare two dates to see if they are the same day
// This function avoids timezone issues by comparing date components directly
function isSameDay(date1, date2) {
    // Extract date components from both dates
    const year1 = date1.getFullYear();
    const month1 = date1.getMonth();
    const day1 = date1.getDate();
    
    const year2 = date2.getFullYear();
    const month2 = date2.getMonth();
    const day2 = date2.getDate();
    
    // Compare date components only, ignoring time and timezone
    return year1 === year2 && month1 === month2 && day1 === day2;
}

function groupTasksByDate(taskList) {
    const groups = {};
    
    taskList.forEach(task => {
        let groupKey;
        
        if (task.dueDate) {
            // Extract YYYY-MM-DD from ISO string and parse components
            const dateOnly = task.dueDate.split('T')[0];
            const dateParts = dateOnly.split('-').map(part => parseInt(part, 10));
            
            // Create a date object for comparison purposes only
            // This avoids timezone shifts by using specific components
            const dueDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            
            // Reference dates for comparison
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Calculate the day after tomorrow
            const dayAfterTomorrow = new Date(today);
            dayAfterTomorrow.setDate(today.getDate() + 2);
            
            // Determine group key based on date comparison
            if (isSameDay(dueDate, today)) {
                groupKey = 'Today';
            } else if (isSameDay(dueDate, tomorrow)) {
                groupKey = 'Tomorrow';
            } else if (isSameDay(dueDate, dayAfterTomorrow)) {
                // Use the day name
                groupKey = dayAfterTomorrow.toLocaleDateString(undefined, { weekday: 'long' });
            } else if (dueDate < today) {
                groupKey = 'Overdue';
            } else {
                // Group by week or month using actual date component comparison
                // Calculate approximate days difference
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Format the display date using the original date parts
                const displayDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                
                if (diffDays <= 7) {
                    groupKey = displayDate.toLocaleDateString(undefined, { weekday: 'long' });
                } else if (diffDays <= 30) {
                    groupKey = displayDate.toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric',
                        weekday: 'long'
                    });
                } else {
                    groupKey = displayDate.toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        weekday: 'long'
                    });
                }
            }
        } else {
            // No due date
            groupKey = 'No Due Date';
        }
        
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        
        groups[groupKey].push(task);
    });
    
    // Determine display order for the groups
    const groupOrder = [
        'Overdue', 
        'Today', 
        'Tomorrow',
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 
        'This Week', 
        'This Month', 
        'Future', 
        'No Due Date'
    ];
    
    // Sort the groups
    const sortedGroups = {};
    groupOrder.forEach(key => {
        if (groups[key] && groups[key].length > 0) {
            // Sort tasks within each group
            groups[key].sort((a, b) => {
                // First by priority
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                
                if (priorityDiff !== 0) return priorityDiff;
                
                // Then by due date (if both have it)
                if (a.dueDate && b.dueDate) {
                    return new Date(a.dueDate) - new Date(b.dueDate);
                }
                
                // Then by creation date
                return new Date(a.createdAt) - new Date(b.createdAt);
            });
            
            sortedGroups[key] = groups[key];
        }
    });
    
    // Add any groups not in the predefined order
    Object.keys(groups).forEach(key => {
        if (!groupOrder.includes(key) && groups[key].length > 0) {
            sortedGroups[key] = groups[key];
        }
    });
    
    return sortedGroups;
}

// Show feedback message to the user
function showFeedback(message, type = "success", customDuration = null) {
    taskFeedback.textContent = message;
    taskFeedback.className = `feedback ${type}`;
    
    // Clear any existing timeout
    if (window.feedbackTimeoutId) {
        clearTimeout(window.feedbackTimeoutId);
    }
    
    // Set duration based on message type or custom value
    let duration;
    if (customDuration !== null) {
        duration = customDuration;
    } else if (type === "warning" || type === "error") {
        duration = 5000; // Reduced from 8000ms to 5000ms for warnings/errors
    } else {
        duration = 2000; // Reduced from 3000ms to 2000ms for normal messages
    }
    
    // Set timeout to clear the message
    window.feedbackTimeoutId = setTimeout(() => {
        if (taskFeedback.textContent === message) {
            taskFeedback.textContent = "";
            taskFeedback.className = "feedback";
        }
        window.feedbackTimeoutId = null;
    }, duration);
}

// Initialize the app on load
document.addEventListener('DOMContentLoaded', init);
