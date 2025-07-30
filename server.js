const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// File path for chat storage
const CHAT_FILE = path.join(__dirname, 'chat.json');

// Initialize chat storage
if (!fs.existsSync(CHAT_FILE)) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
}

// Middleware for JSON parsing
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// API endpoint to get all messages
app.get('/messages', (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync(CHAT_FILE));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read chat data' });
  }
});

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Function to save message to file
function saveMessage(message) {
  try {
    const messages = JSON.parse(fs.readFileSync(CHAT_FILE));
    messages.push(message);
    fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving message:', error);
    return false;
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  // Send chat history to new client
  try {
    const messages = JSON.parse(fs.readFileSync(CHAT_FILE));
    ws.send(JSON.stringify({ 
      type: 'chat-history', 
      messages 
    }));
  } catch (error) {
    console.error('Error sending chat history:', error);
  }
  
  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const messageData = JSON.parse(data);
      
      if (messageData.type === 'new-message') {
        const message = messageData.message;
        
        // Save message to file
        if (saveMessage(message)) {
          // Broadcast message to all clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'new-message',
                message
              }));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Send server status updates periodically
  const statusInterval = setInterval(() => {
    const statusMessage = {
      type: 'server-update',
      message: `Server running. ${wss.clients.size} clients connected`
    };
    
    try {
      ws.send(JSON.stringify(statusMessage));
    } catch (error) {
      console.error('Error sending status update:', error);
    }
  }, 30000);
  
  // Clean up on disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(statusInterval);
  });
});
