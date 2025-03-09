# Gorlea Tasks - Multi-Device Setup Guide

This guide will help you deploy your Gorlea Tasks app to Firebase Hosting, making it accessible from any device with a web browser.

## Prerequisites

1. Make sure you have Node.js installed on your computer
2. Install the Firebase CLI by running: `npm install -g firebase-tools`

## Deployment Steps

1. Login to Firebase:
   ```
   firebase login
   ```

2. Deploy your app:
   ```
   firebase deploy
   ```

3. After deployment completes, you'll see a Hosting URL like:
   https://gorlea-tasks.web.app

4. You can now access your app from any device by visiting this URL!

## Using on Multiple Devices

1. Visit the Hosting URL on your phone, tablet, or any other device
2. When prompted, enter your OpenAI API key (this is stored locally on each device)
3. Your tasks will automatically sync across all devices thanks to Firebase Realtime Database

## Progressive Web App Features

This app supports Progressive Web App (PWA) features:

1. On mobile devices, you can add it to your home screen:
   - iOS: Tap the share button, then "Add to Home Screen"
   - Android: Tap the menu button, then "Add to Home Screen"

2. The app will work offline, allowing you to view your existing tasks even without an internet connection

## Troubleshooting

- If you encounter any deployment errors, make sure you're in the correct directory
- If the app doesn't load on other devices, check your internet connection
- If tasks don't sync, ensure you're using the same Firebase project across all deployments

For more help, visit: https://firebase.google.com/docs/hosting
