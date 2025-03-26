const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const workerRoutes = require('./routes/worker');

// Load env vars
dotenv.config();

// Initialize express app before connecting to database
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);    
app.use('/api/worker', workerRoutes);

// Global error handler middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Health check endpoint
app.get('/healthcheck', (req, res) => {
    res.status(200).json({ status: 'Server is running' });
});

// Fix for categories endpoint
app.use('/api/categories', (req, res) => {
    const categories = [
        'plumbing', 'electrical', 'carpentry', 'painting',
        'cleaning', 'gardening', 'moving', 'appliance_repair',
        'hvac', 'roofing', 'other'
    ];
    res.json(categories);
});

const PORT = process.env.PORT || 5000;

// Connect to database and then start server
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    });