const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// More specific CORS configuration
app.use(cors({
    origin: '*', // Allow requests from any origin
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Retrieve OpenAI API Key from Firebase Config
const OPENAI_API_KEY = functions.config().openai?.key;

// Middleware to check if API key is configured
const checkApiKey = (req, res, next) => {
    if (!OPENAI_API_KEY) {
        console.error("OpenAI API key is not configured");
        return res.status(500).send({ 
            error: "OpenAI API key is not configured. Please set it using Firebase Functions config." 
        });
    }
    next();
};

// Add a simple test endpoint
app.get("/", (req, res) => {
    res.status(200).send({ 
        status: "API is running", 
        hasApiKey: !!OPENAI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Helper function to call OpenAI API
const callOpenAI = async (messages, model = "gpt-4o-mini", temperature = 0.7) => {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: model,
                messages: messages,
                temperature: temperature
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error calling OpenAI:", error.response?.data || error.message);
        throw error;
    }
};

// Endpoint for parsing tasks with AI
app.post("/parse-task", checkApiKey, async (req, res) => {
    try {
        const { taskText } = req.body;
        
        if (!taskText) {
            return res.status(400).send({ error: "taskText is required" });
        }

        const messages = [
            {
                role: "system",
                content: `You are an AI assistant helping to parse natural language task inputs. 
                Extract the following information from the task:
                1. Task title (a concise version of the task)
                2. Description (any additional details)
                3. Due date (in ISO format YYYY-MM-DD, if mentioned)
                4. Priority (high, medium, low)
                5. Category (work, personal, shopping, etc.)
                
                Respond in JSON format with these fields.`
            },
            {
                role: "user",
                content: taskText
            }
        ];

        const response = await callOpenAI(messages);
        const content = response.choices[0].message.content.trim();
        
        // Try to parse the response as JSON
        try {
            const parsedTask = JSON.parse(content);
            res.status(200).send(parsedTask);
        } catch (error) {
            console.error("Error parsing AI response as JSON:", error);
            res.status(500).send({ 
                error: "Failed to parse AI response", 
                rawResponse: content 
            });
        }
    } catch (error) {
        console.error("Error parsing task:", error);
        res.status(500).send({ error: "Task parsing failed" });
    }
});

// Endpoint for generating follow-up suggestions
app.post("/generate-followup", checkApiKey, async (req, res) => {
    try {
        const { task } = req.body;
        
        if (!task || !task.title) {
            return res.status(400).send({ error: "task object with title is required" });
        }

        const messages = [
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
        ];

        const response = await callOpenAI(messages);
        const suggestion = response.choices[0].message.content.trim();
        
        res.status(200).send({ suggestion });
    } catch (error) {
        console.error("Error generating follow-up:", error);
        res.status(500).send({ error: "Follow-up generation failed" });
    }
});

// Endpoint for chat assistant
app.post("/chat", checkApiKey, async (req, res) => {
    try {
        const { userMessage, tasks } = req.body;
        
        if (!userMessage) {
            return res.status(400).send({ error: "userMessage is required" });
        }

        // Create a context with the user's tasks
        const taskContext = tasks && tasks.length > 0 
            ? `Here are the user's current tasks:\n${tasks.map(t => 
                `- ${t.title} (${t.completed ? 'Completed' : 'Active'}, Priority: ${t.priority}${t.dueDate ? `, Due: ${t.dueDate}` : ''})`
            ).join('\n')}`
            : 'The user has no tasks yet.';
        
        const messages = [
            {
                role: "system",
                content: `You are Gorlea, an AI assistant in a to-do list app. While task management is your primary focus, you can help with any request the user has.
                
                ${taskContext}
                
                Keep your responses friendly, helpful, and concise (under 3 sentences when possible). If the user is asking about their tasks, provide specific information based on the task context provided.
                
                You can help with:
                - Task management (adding, editing, completing tasks)
                - Creating shopping lists, workout plans, or any other content
                - Drafting emails or text messages
                - Providing recommendations (movies, books, etc.)
                - Answering general knowledge questions
                - Brainstorming ideas related to the user's tasks
                - Any other helpful assistance the user requests`
            },
            {
                role: "user",
                content: userMessage
            }
        ];

        const response = await callOpenAI(messages);
        const aiResponse = response.choices[0].message.content.trim();
        
        res.status(200).send({ response: aiResponse });
    } catch (error) {
        console.error("Error getting chat response:", error);
        res.status(500).send({ error: "Chat response failed" });
    }
});

// Legacy endpoint for backward compatibility
app.post("/openai", checkApiKey, async (req, res) => {
    try {
        const { prompt, messages, model = "gpt-4o-mini" } = req.body;
        
        // If messages are provided, use them directly
        const messagesToSend = messages || [{ role: "user", content: prompt }];
        
        const response = await callOpenAI(messagesToSend, model);
        res.status(200).send(response);
    } catch (error) {
        console.error("Error calling OpenAI:", error);
        res.status(500).send({ error: "OpenAI request failed" });
    }
});

// Export the original API
exports.api = functions.region('us-west1').https.onRequest(app);

// Export a minimal function for testing
exports.hello = functions.https.onRequest((req, res) => {
  res.status(200).send({
    message: "Hello from Firebase Functions!",
    timestamp: new Date().toISOString(),
    hasApiKey: !!OPENAI_API_KEY
  });
});
