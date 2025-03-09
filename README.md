# Gorlea Tasks - Smart To-Do List App

A modern, AI-powered task management application with natural language processing, smart date detection, and cloud synchronization.

## Features

- **Natural Language Task Input**: Add tasks using everyday language like "Buy milk tomorrow morning"
- **Smart Task Parsing**: Automatically detects dates, times, priorities, and categories
- **Timeline View**: Tasks grouped by date with smart sorting
- **AI-Powered Chat Assistant**: Ask questions, get recommendations, and more
- **Cloud Sync**: Tasks persist across devices and browser refreshes
- **Privacy-Focused**: All credentials are stored locally in your browser only
- **Mobile-Friendly UI**: Works on phones, tablets, and desktops
- **Dark Mode Support**: Easy on the eyes during night use
- **Smart Task Suggestions**: Get follow-up suggestions when completing tasks

## Setup Instructions

1. Open `index.html` in a web browser
2. When prompted, enter your OpenAI API key to enable AI features
   (The API key is stored securely in your browser's localStorage)
3. Start adding tasks and using the chat assistant!

## OpenAI API Key

AI features require an OpenAI API key:

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Enter the key when prompted by the app

## Cloud Storage

The app uses Firebase Realtime Database for cloud storage of your tasks. The Firebase configuration is already included in the code, so there's no need to set up your own Firebase project.

## GitHub Pages Deployment

This app can be safely hosted on GitHub Pages or any static hosting provider:

1. The app requires only the OpenAI API key from users
2. All credentials are stored only in the user's browser localStorage
3. No API keys are hardcoded in a way that would be exposed to malicious users

## Hosting the App

### Local Use
Simply open the `index.html` file in a browser. No server required!

### Online Hosting Options

#### GitHub Pages
- Create a repository and push the code
- Configure GitHub Pages in the repository settings
- Users will need to enter their own Firebase and OpenAI credentials

#### Netlify or Vercel
1. Sign up for [Netlify](https://www.netlify.com/) or [Vercel](https://vercel.com/)
2. Drag and drop the entire folder or connect to your GitHub repository
3. Your app will be deployed with a custom subdomain

## Privacy & Security

- Your OpenAI API key is stored only in your browser's localStorage
- No credentials are transmitted to any servers except the respective API providers
- No data is sent to any servers except Firebase (for task storage) and OpenAI (for AI features)
- You maintain full control and ownership of your data

## Development Notes

- Built with vanilla JavaScript, HTML, and CSS (no frameworks)
- Uses Firebase Realtime Database for cloud storage
- OpenAI's API (GPT model) for natural language processing
- Responsive design using CSS Grid and Flexbox
- Designed for modern browsers (Chrome, Firefox, Safari, Edge)

## License

MIT License - Feel free to modify and use for personal or commercial purposes.
