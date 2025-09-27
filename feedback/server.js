// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const feedbackDir = path.join(uploadsDir, 'feedback');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(feedbackDir)) {
    fs.mkdirSync(feedbackDir);
}

// Configure multer for audio file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, feedbackDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename with original extension
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, `${uniqueId}${extension}`);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept audio files only
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Only audio files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: fileFilter,
});

// In-memory storage for feedback data (in production, use a database)
const feedbackStore = [];

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Voice Feedback Recorder API is running' });
});

// Submit feedback endpoint
app.post('/api/feedback', upload.single('audioFeedback'), (req, res) => {
    try {
        // Check if email and audio file were provided
        if (!req.body.email || !req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and audio feedback are required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(req.body.email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email format' 
            });
        }

        // Create feedback record
        const feedback = {
            id: uuidv4(),
            email: req.body.email,
            audioFile: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                path: req.file.path,
                size: req.file.size,
                mimetype: req.file.mimetype
            },
            timestamp: new Date().toISOString(),
            processed: false
        };

        // Store feedback (in production, save to database)
        feedbackStore.push(feedback);

        // Log the feedback (in production, you might save to a database)
        console.log('New feedback received:', feedback);

        // Return success response
        res.status(200).json({ 
            success: true, 
            message: 'Feedback submitted successfully',
            feedbackId: feedback.id
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while processing feedback' 
        });
    }
});

// Get all feedback (admin endpoint)
app.get('/api/feedback', (req, res) => {
    try {
        // In production, you would add authentication here
        res.status(200).json({
            success: true,
            count: feedbackStore.length,
            feedback: feedbackStore
        });
    } catch (error) {
        console.error('Error retrieving feedback:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving feedback' 
        });
    }
});

// Get specific feedback by ID (admin endpoint)
app.get('/api/feedback/:id', (req, res) => {
    try {
        const { id } = req.params;
        const feedback = feedbackStore.find(item => item.id === id);
        
        if (!feedback) {
            return res.status(404).json({ 
                success: false, 
                message: 'Feedback not found' 
            });
        }

        res.status(200).json({
            success: true,
            feedback
        });
    } catch (error) {
        console.error('Error retrieving feedback:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving feedback' 
        });
    }
});

// Download audio file (admin endpoint)
app.get('/api/feedback/:id/audio', (req, res) => {
    try {
        const { id } = req.params;
        const feedback = feedbackStore.find(item => item.id === id);
        
        if (!feedback) {
            return res.status(404).json({ 
                success: false, 
                message: 'Feedback not found' 
            });
        }

        const filePath = feedback.audioFile.path;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'Audio file not found' 
            });
        }

        res.download(filePath, feedback.audioFile.originalName);
    } catch (error) {
        console.error('Error downloading audio file:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while downloading audio file' 
        });
    }
});

// Delete feedback (admin endpoint)
app.delete('/api/feedback/:id', (req, res) => {
    try {
        const { id } = req.params;
        const feedbackIndex = feedbackStore.findIndex(item => item.id === id);
        
        if (feedbackIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Feedback not found' 
            });
        }

        const feedback = feedbackStore[feedbackIndex];
        
        // Delete audio file
        if (fs.existsSync(feedback.audioFile.path)) {
            fs.unlinkSync(feedback.audioFile.path);
        }
        
        // Remove from store
        feedbackStore.splice(feedbackIndex, 1);
        
        res.status(200).json({
            success: true,
            message: 'Feedback deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting feedback' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err instanceof multer.MulterError) {
        // Multer errors (file size limit, etc.)
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                message: 'File size exceeds the 10MB limit' 
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: err.message 
        });
    }
    
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong on the server' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Feedback API available at http://localhost:${PORT}/api/feedback`);
});