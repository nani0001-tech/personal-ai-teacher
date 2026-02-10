/**
 * AI Teacher Chatbot - Using Google Gemini API
 * This script handles all interactions with the Gemini API and manages the chat interface
 */

// ============== Configuration ==============
// Replace this with your actual Gemini API key from https://aistudio.google.com/app/apikeys
const GEMINI_API_KEY = 'AIzaSyBq_-z2MkS80zuwXgGzth8zv7hqO_4bofY';

// List of models to try (newer ones first). We'll try each until one succeeds.
// gemini-2.5-flash is the fastest and most current model
const MODELS_TO_TRY = [
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-pro'
];

// System prompt that defines the AI's behavior as a personal teacher
const SYSTEM_PROMPT = `You are a personal AI teacher and guide. 
Your role is to help students understand any concept they want to learn.

Guidelines:
1. Explain step by step - break down complex topics into simple, digestible parts
2. Use simple language - avoid jargon, use everyday language whenever possible
3. Provide real-world examples - make abstract concepts concrete with practical examples
4. Keep explanations concise - but thorough enough to be understood
5. End with one follow-up question - this helps students think deeper and guides next steps

Format your responses clearly with:
- Brief introduction to the topic
- Step-by-step explanation (numbered or bulleted)
- Real-world example(s)
- One follow-up question at the end`;

// ============== DOM Elements ==============
// Get references to HTML elements we'll interact with
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');

// ============== Event Listeners ==============
// Send message when user clicks the Send button
sendBtn.addEventListener('click', sendMessage);

// Send message when user presses Enter key
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

// ============== Main Functions ==============

/**
 * Sends the user's message to the Gemini API and displays the response
 */
async function sendMessage() {
    // Get the user input text
    const message = userInput.value.trim();

    // Check if input is empty
    if (!message) {
        showError('Please enter a message');
        return;
    }

    // Check if API key is set
    if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        showError('Please add your Gemini API key to the script');
        return;
    }

    // Clear previous errors
    clearError();

    // Display user message in chat
    displayUserMessage(message);

    // Clear input field
    userInput.value = '';

    // Disable send button and show loading indicator
    sendBtn.disabled = true;
    showLoading();

    try {
        // Get AI response from Gemini API
        const aiResponse = await getGeminiResponse(message);

        // Hide loading indicator
        hideLoading();

        // Display AI response in chat
        displayAIMessage(aiResponse);

        // Auto-scroll to latest message
        scrollToBottom();

    } catch (error) {
        // Handle errors gracefully
        hideLoading();
        showError(`Error: ${error.message}`);
        console.error('Full error:', error);
    } finally {
        // Re-enable send button
        sendBtn.disabled = false;
        userInput.focus();
    }
}

/**
 * Sends a request to the Gemini API and returns the AI's response
 * @param {string} userMessage - The user's input message
 * @returns {Promise<string>} - The AI's response text
 */
async function getGeminiResponse(userMessage) {
    // Prepare the request body for Gemini API
    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `${SYSTEM_PROMPT}\n\nUser question: ${userMessage}`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,             // Controls randomness (0-1, lower = more deterministic)
            topK: 40,                     // Limits to top 40 tokens by probability
            topP: 0.95,                   // Nucleus sampling for diversity
            maxOutputTokens: 1024,        // Maximum tokens in response
        }
    };

    try {
        let lastError = null;

        // Try each model until one succeeds
        for (const model of MODELS_TO_TRY) {
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Invalid or missing API key. Check your Gemini API key.');
                    } else if (response.status === 404) {
                        // Model not found - try next model
                        lastError = `Model ${model} not found (404).`;
                        continue;
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                    } else if (response.status === 500) {
                        throw new Error('Gemini API server error. Please try again later.');
                    } else {
                        lastError = `API Error for model ${model}: ${response.status} ${response.statusText}`;
                        continue;
                    }
                }

                const data = await response.json();

                if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                    lastError = `Unexpected API response format from model ${model}`;
                    continue;
                }

                const aiText = data.candidates[0].content.parts[0].text;
                return aiText;

            } catch (err) {
                lastError = err.message || String(err);
                // If key is invalid or rate limited, stop trying further
                if (lastError.toLowerCase().includes('invalid') || lastError.toLowerCase().includes('rate limit')) {
                    throw new Error(lastError);
                }
                // otherwise continue to next model
                console.warn(`Model ${model} failed:`, lastError);
            }
        }

        // If we reach here, all models failed
        throw new Error(lastError || 'All models failed');

    } catch (error) {
        // Re-throw the error for handling in sendMessage
        throw error;
    }
}

// ============== UI Display Functions ==============

/**
 * Displays a user message in the chat interface
 * @param {string} message - The user's message text
 */
function displayUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `<p>${escapeHtml(message)}</p>`;
    chatContainer.appendChild(messageDiv);
}

/**
 * Displays an AI message in the chat interface
 * @param {string} message - The AI's response text
 */
function displayAIMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    
    // Convert markdown-like formatting to HTML (optional enhancement)
    let formattedMessage = escapeHtml(message);
    
    // Convert line breaks to <br> tags for better readability
    formattedMessage = formattedMessage.replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = `<p>${formattedMessage}</p>`;
    chatContainer.appendChild(messageDiv);
}

/**
 * Shows the loading indicator
 */
function showLoading() {
    loadingIndicator.classList.add('active');
}

/**
 * Hides the loading indicator
 */
function hideLoading() {
    loadingIndicator.classList.remove('active');
}

/**
 * Displays error message to the user
 * @param {string} message - The error message to display
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('active');
}

/**
 * Clears the error message
 */
function clearError() {
    errorMessage.textContent = '';
    errorMessage.classList.remove('active');
}

// ============== Utility Functions ==============

/**
 * Escapes HTML special characters to prevent XSS attacks
 * This ensures user input and API responses are displayed safely
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Auto-scrolls the chat container to show the latest message
 */
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ============== Initialization ==============
// Focus on input field when page loads
window.addEventListener('load', () => {
    userInput.focus();
    console.log('AI Teacher Chatbot loaded. Ready to talk!');
    console.log('Remember to add your Gemini API key in the GEMINI_API_KEY variable');
});
