# Technical Context: Gorlea Tasks

## Technology Stack

Gorlea Tasks uses a modern web technology stack focused on client-side functionality with cloud service integration:

### Frontend Technologies

| Technology | Description | Usage in Project |
|------------|-------------|------------------|
| HTML5 | Markup language | Core structure and semantic elements |
| CSS3 | Styling language | Responsive design, theming (light/dark mode), and UI components |
| JavaScript (ES6+) | Programming language | Core application logic, DOM manipulation, API interactions |
| Font Awesome 6.4.0 | Icon library | UI icons for better visual cues and interactions |
| Service Workers | Web API | Offline functionality, asset caching |
| Web Storage API | Browser API | Local storage for user preferences and API keys |

### Backend and Cloud Services

| Technology | Description | Usage in Project |
|------------|-------------|------------------|
| Firebase Realtime Database | NoSQL cloud database | Task storage and real-time synchronization |
| Firebase Hosting | Static hosting service | Web application deployment and delivery |
| Firebase Cloud Functions | Serverless backend | Proxy for OpenAI API, secure backend operations |
| Express.js | Node.js web framework | API routing in Cloud Functions |
| Axios | HTTP client | API requests to OpenAI |
| CORS | HTTP header mechanism | Cross-origin resource sharing for API access |

### AI Integration

| Technology | Description | Usage in Project |
|------------|-------------|------------------|
| OpenAI API | AI service provider | Core natural language processing capabilities |
| GPT-4o-mini | Language model | Task parsing, suggestions, and chatbot functionality |

### Progressive Web App (PWA)

| Technology | Description | Usage in Project |
|------------|-------------|------------------|
| Web Manifest | JSON configuration | App installation information and behavior |
| Service Worker | Background script | Offline capabilities and asset caching |
| Cache API | Browser API | Resource caching for offline use |

## Development Environment

The application's development environment consists of:

- **Local Development**: Browser-based development with direct file editing
- **Deployment**: Firebase CLI for deployment to Firebase Hosting
- **Testing**: Manual testing across devices and browsers
- **Version Control**: Git for source code management

## Key Technical Dependencies

### Frontend Dependencies

```
- Firebase SDK 8.10.1 (firebase-app.js, firebase-database.js)
- Font Awesome 6.4.0
```

### Deployment Options

The application supports multiple deployment options:

```
- Firebase Hosting: Configured for seamless deployment (firebase.json)
- GitHub Pages: Fully supported with API key security considerations
- Local deployment: Works by simply opening index.html in a browser
- Static hosting: Can be deployed to any static hosting provider (Netlify, Vercel, etc.)
```

### Backend Dependencies (Node.js packages for Cloud Functions)

```json
{
  "dependencies": {
    "axios": "^0.24.0",
    "cors": "^2.8.5",
    "express": "^4.17.1",
    "firebase-admin": "^9.8.0",
    "firebase-functions": "^3.14.1"
  }
}
```

## Technical Constraints

### API Limitations

- **OpenAI API**: 
  - Requires API key for access
  - Subject to rate limits and usage costs
  - May have intermittent availability or performance issues

### Firebase Limitations

- **Realtime Database**:
  - NoSQL structure requires careful data modeling
  - Limited query capabilities compared to traditional SQL
  - Free tier has data transfer and storage limits

- **Cloud Functions**:
  - Cold start latency on infrequently used functions
  - Limited execution time (timeout constraints)
  - Function invocation and compute time limits on free tier

### Browser Compatibility

- Service Worker API requires modern browsers
- IndexedDB or localStorage needed for offline capabilities
- CSS variables used for theming require modern browser support

## Technical Design Decisions

### Credential Security Model

The application implements a differentiated security approach for credentials:

- **OpenAI API Key**:
  - Considered sensitive and never hardcoded in source
  - Stored only in user's browser localStorage
  - Prompts user to enter their key on first visit
  - Only transmitted directly to OpenAI API

- **Firebase Configuration**:
  - Included in source code as Firebase API keys are designed for client-side use
  - Protected by Firebase security rules, not by key secrecy
  - Safe for inclusion in public repositories
  - Clear separation from truly sensitive credentials

### Vanilla JavaScript vs. Framework

The application uses vanilla JavaScript instead of a framework like React or Vue:
- **Pros**: Smaller bundle size, no build step required, simpler deployment
- **Cons**: Manual DOM manipulation, less structured component model

### Firebase vs. Custom Backend

Firebase was chosen over a custom backend:
- **Pros**: Managed infrastructure, built-in real-time capabilities, integrated hosting
- **Cons**: Vendor lock-in, limited customization options

### Client-side vs. Server-side AI

AI processing is split between client and server:
- **Client-side**: Direct OpenAI API calls when possible, fallback algorithms always available
- **Server-side**: More secure API key handling, consistent environment
- **Hybrid approach**: Maximizes responsiveness while providing security

### Progressive Web App vs. Native App

PWA approach was selected instead of native mobile apps:
- **Pros**: Single codebase, no app store approval, immediate updates
- **Cons**: Limited device integration, requires modern browser
