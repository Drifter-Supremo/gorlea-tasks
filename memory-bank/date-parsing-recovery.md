# Date Parsing Recovery: Implementation Guide

## Overview

This guide provides detailed instructions for recovering from the code conflict and completing the date parsing enhancement that was interrupted. The goal is to add support for date formats like "Thursday March 13th" that are currently not being detected correctly.

## Current Issue

The app.js file has a conflict between:
- The version on disk (app.js): An older version lacking recent updates
- The in-memory editor version: Contains new updates but got interrupted
- app.js.new.js: A partial backup that's incomplete, cutting off in the middle of the `createFallbackTaskObject` function

The specific issue is that the date parsing in `createFallbackTaskObject` doesn't correctly handle date formats like "Thursday March 13th" - it needs enhancement to detect day name + month + day patterns.

## Recovery Steps

### 1. Resolve VS Code Conflict

When VS Code shows the merge conflict interface with app.js:

1. Choose "Accept Current Change" to keep the editor's in-memory version
2. If that option isn't available, manually copy the content from the right side (green) of the conflict view
3. Save this as app.js, overwriting the old version on disk
4. Immediately create a backup with `cp app.js app.js.recovered`

### 2. Complete the Date Parsing Enhancement

Locate the `createFallbackTaskObject` function in app.js. You need to add code to detect two additional date patterns:

1. **Month name with day** - like "March 15th"
2. **Day name with month and day** - like "Thursday March 13th"

Add the following code after the simple day name detection section in `createFallbackTaskObject` where it currently cuts off in app.js.new.js:

```javascript
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
```

### 3. Testing the Enhanced Parser

After implementing the changes, test with these specific inputs:

1. "Meeting with John on Thursday March 13th"
2. "Doctor appointment on March 15th"
3. "Submit report by Friday April 5th"
4. "Call mom on Tuesday June 10th at 3pm"

Verify that:
- The dates are correctly extracted
- Tasks show the proper due dates in the UI
- The console logs confirm pattern detection

### 4. Backup Strategy

After confirming the fixes work:

1. Create a proper backup: `cp app.js app.js.fixed-date-parsing`
2. Update the active context and progress files to reflect the completion of this task
3. Test the application thoroughly with various date inputs

## Implementation Guide

### Where to Insert the Code

Look for this section in `createFallbackTaskObject`:

```javascript
// ==== DAY NAME DETECTION ====
// Only process if no direct date was found
if (!dueDate) {
    const dayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
        'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    // Handle "this [day]" expressions (e.g., "this Friday")
    // ...
    
    // Handle "next [day]" expressions (e.g., "next Friday")
    // ...
    
    // Simple day name detection (like "Friday")
    else {
        for (const dayName of Object.keys(dayMap)) {
            // ... existing day name detection code ...
        }
    }
}
```

The new patterns should be added right after this section, before the code checks for "today", "tonight", etc.

### Avoiding Token Limits

To avoid hitting token limits again:

1. Make the changes in smaller chunks
2. Save after each logical change
3. Test incrementally to ensure each part works
4. Document your progress as you go

## Expected Outcome

After implementing these changes, the app should correctly parse date formats like:
- "Thursday March 13th"
- "March 15th"
- "Friday April 5th"

These dates will be properly detected and tasks will be assigned to the correct due dates.
