const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Worker = require('../models/Worker');
const Job = require('../models/Job'); // Move import to top
const mongoose = require('mongoose');
const { validateCoordinates, calculateDistance, logLocationInfo } = require('../utils/locationUtils');

// Middleware to check if user is a worker
const isWorker = (req, res, next) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ message: 'Access denied. Worker only route.' });
    }
    next();
};

// Add a middleware to include unread notification count in responses
router.use(async (req, res, next) => {
    if (req.user && req.user.userType === 'worker') {
        try {
            const worker = await Worker.findOne({ user: req.user._id });
            if (worker && worker.notifications) {
                const unreadCount = worker.notifications.filter(n => !n.isRead).length;
                res.set('X-Unread-Notifications', unreadCount.toString());
            }
        } catch (err) {
            console.error('Error counting notifications:', err);
        }
    }
    next();
});

// Get all notifications for the authenticated worker
router.get('/notifications', auth, isWorker, async (req, res) => {
    try {
        const worker = await Worker.findOne({ user: req.user._id })
            .populate({
                path: 'notifications.job',
                select: 'title description status deadline address images'
            });

        if (!worker) {
            return res.status(404).json({ message: 'Worker not found' });
        }

        // Ensure notifications array exists and sort by date (newest first)
        const notifications = worker.notifications || [];
        notifications.sort((a, b) => b.createdAt - a.createdAt);

        res.json({
            success: true,
            notifications: notifications.map(notification => ({
                _id: notification._id,
                type: notification.type,
                message: notification.message,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
                job: notification.job ? {
                    _id: notification.job._id,
                    title: notification.job.title,
                    description: notification.job.description,
                    status: notification.job.status,
                    deadline: notification.job.deadline,
                    address: notification.job.address,
                    images: notification.job.images
                } : null
            })),
            unreadCount: notifications.filter(n => !n.isRead).length
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
});

// Add push subscription endpoint
router.post('/push-subscription', auth, isWorker, async (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({ message: 'Subscription data is required' });
        }

        const worker = await Worker.findOneAndUpdate(
            { user: req.user._id },
            { pushSubscription: subscription },
            { new: true }
        );

        if (!worker) {
            return res.status(404).json({ message: 'Worker profile not found' });
        }

        res.json({ message: 'Push subscription saved successfully' });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ message: 'Failed to save subscription' });
    }
});

// Mark notification as read
router.patch('/notifications/:notificationId', auth, isWorker, async (req, res) => {
    try {
        const { notificationId } = req.params;

        // Validate notification ID
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ message: 'Invalid notification ID' });
        }

        const worker = await Worker.findOneAndUpdate(
            {
                user: req.user._id,
                'notifications._id': notificationId
            },
            {
                $set: { 'notifications.$.isRead': true }
            },
            { new: true }
        );

        if (!worker) {
            return res.status(404).json({ message: 'Worker or notification not found' });
        }

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to update notification' });
    }
});

// Check job location availability
router.get('/job-location/:jobId', auth, isWorker, async (req, res) => {
    try {
        const { jobId } = req.params;

        // Validate job ID
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ message: 'Invalid job ID' });
        }

        const job = await Job.findOne({
            _id: jobId,
            worker: req.user._id,
            status: { $in: ['in progress', 'pending'] } // Only check for active jobs
        });

        if (!job) {
            return res.status(404).json({ message: 'Job not found or not assigned to you' });
        }

        const jobDate = new Date(job.deadline);
        const [hour, minute] = job.timeStart.split(':').map(Number);
        jobDate.setHours(hour, minute, 0, 0);

        const revealTime = new Date(jobDate);
        revealTime.setHours(revealTime.getHours() - 3);

        const now = new Date();

        if (now >= revealTime) {
            res.json({
                available: true,
                exactLocation: {
                    latitude: job.location.coordinates[1],
                    longitude: job.location.coordinates[0]
                },
                exactAddress: job.address
            });
        } else {
            res.json({
                available: false,
                message: 'Exact location will be available 3 hours before the job starts',
                revealTime: revealTime
            });
        }
    } catch (error) {
        console.error('Error checking job location:', error);
        res.status(500).json({ message: 'Failed to check job location' });
    }
});

// Ensure worker profile exists
router.post('/ensure-profile', auth, isWorker, async (req, res) => {
    try {
        let worker = await Worker.findOne({ user: req.user._id });
        
        if (!worker) {
            // Get location from request if available
            const { latitude, longitude, skills } = req.body;
            const coordinates = (latitude && longitude) ? 
                [parseFloat(longitude), parseFloat(latitude)] : 
                [77.2090, 28.6139]; // Default Delhi coordinates
                
            // Normalize skills to lowercase before saving
            const normalizedSkills = skills ? skills.map(skill => skill.toLowerCase().trim()) : ['general'];

            worker = await Worker.create({
                user: req.user._id,
                skills: normalizedSkills,
                categories: normalizedSkills, // Will be processed by pre-save hook in Worker model
                experience: 0,
                serviceRadius: 50, // Increased radius to see more jobs
                location: {
                    type: 'Point',
                    coordinates: coordinates
                }
            });
            console.log(`Created worker profile for user ${req.user._id} with coordinates ${coordinates}`);
        }
        
        res.json({
            success: true,
            data: worker
        });
    } catch (error) {
        console.error('Error ensuring worker profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to ensure worker profile',
            error: error.message
        });
    }
});

// Update worker profile
router.put('/profile', auth, isWorker, async (req, res) => {
    try {
        const { skills, serviceRadius, city } = req.body;

        // Normalize skills to lowercase before saving
        const normalizedSkills = skills ? skills.map(skill => skill.toLowerCase().trim()) : ['general'];

        // Update worker object
        const updateObj = {
            skills: normalizedSkills,
            categories: normalizedSkills, // Will be processed by pre-save hook in Worker model
            serviceRadius: serviceRadius || undefined,
            city: city || undefined
        };

        const worker = await Worker.findOneAndUpdate(
            { user: req.user._id },
            {
                $set: updateObj
            },
            { new: true }
        );

        if (!worker) {
            return res.status(404).json({ message: 'Worker profile not found' });
        }

        res.json(worker);
    } catch (error) {
        console.error('Error updating worker profile:', error);
        res.status(500).json({ message: 'Failed to update worker profile' });
    }
});

// Update worker profile with location
router.put('/update-location', auth, isWorker, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        // Validate coordinates using our utility function
        const locationObj = validateCoordinates(latitude, longitude);
        
        if (!locationObj) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.' 
            });
        }
        
        // Log before update for debugging
        console.log(`Updating worker ${req.user._id} location to:`, 
                   `lat=${latitude}, lng=${longitude}`);
        
        const worker = await Worker.findOneAndUpdate(
            { user: req.user._id },
            { $set: { location: locationObj } },
            { new: true }
        );

        if (!worker) {
            return res.status(404).json({ 
                success: false,
                message: 'Worker profile not found' 
            });
        }
        
        // Log after update for verification
        logLocationInfo('Worker location updated successfully', worker.location);

        res.json({
            success: true,
            message: 'Worker location updated successfully',
            data: {
                location: worker.location,
                coordinates: {
                    latitude: worker.location.coordinates[1],  // Convert back for client
                    longitude: worker.location.coordinates[0]
                }
            }
        });
    } catch (error) {
        console.error('Error updating worker location:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update worker location',
            error: error.message 
        });
    }
});

// Debug endpoint - Get all available jobs regardless of location
router.get('/debug/all-jobs', auth, isWorker, async (req, res) => {
    try {
        // Get jobs that are pending and don't have a worker assigned
        const allJobs = await Job.find({
            status: 'pending',
            worker: { $exists: false }
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: allJobs.length,
            data: allJobs
        });
    } catch (error) {
        console.error('Error fetching all jobs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch jobs',
            error: error.message
        });
    }
});

// Get jobs near worker's registered location
router.get('/nearby-jobs', auth, isWorker, async (req, res) => {
    try {
        // Get worker profile with their registered location and skills
        const worker = await Worker.findOne({ user: req.user._id });

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        // Log worker location for debugging
        logLocationInfo(`Found worker ${worker._id}, registered location`, worker.location);

        // Ensure worker has a valid registered location
        if (!worker.location || 
            !worker.location.coordinates || 
            worker.location.coordinates.length !== 2 ||
            (worker.location.coordinates[0] === 0 && worker.location.coordinates[1] === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Valid worker location not found. Please update your registered location.'
            });
        }

        console.log('Searching for jobs near registered coordinates:', worker.location.coordinates);

        // Create query to find nearby jobs
        const query = {
            status: 'pending',
            worker: { $exists: false },
            location: {
                $nearSphere: {
                    $geometry: worker.location,
                    $maxDistance: (worker.serviceRadius || 100) * 1000 // Convert km to meters
                }
            }
        };

        // If worker has valid categories (not just 'general'), filter by them
        if (worker.categories && worker.categories.length > 0 &&
            !(worker.categories.length === 1 && worker.categories.includes('general'))) {
            query.category = { $in: worker.categories };
        }

        console.log('Job query:', JSON.stringify(query));

        // Find nearby jobs
        const nearbyJobs = await Job.find(query)
            .sort({ createdAt: -1 })
            .limit(20); // Limit the number of results for performance

        console.log(`Found ${nearbyJobs.length} nearby jobs`);

        // Transform jobs to include approximate location and distance
        const jobsWithApproximateLocation = nearbyJobs.map(job => {
            const jobObj = job.toObject();
            
            // Create approximate location (just city/area)
            const addressParts = job.address ? job.address.split(',') : ['Unknown'];
            jobObj.approximateLocation = addressParts.length > 1 
                ? addressParts.slice(1).join(',').trim()
                : job.address;
                
            // Calculate distance from worker using our utility
            if (job.location && job.location.coordinates) {
                jobObj.distance = calculateDistance(
                    worker.location.coordinates,
                    job.location.coordinates
                );
            }
            
            // Don't send exact coordinates to frontend until job is accepted
            delete jobObj.location;
            
            return jobObj;
        });

        res.json({
            success: true,
            count: jobsWithApproximateLocation.length,
            data: jobsWithApproximateLocation
        });

    } catch (error) {
        console.error('Error fetching nearby jobs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch nearby jobs',
            error: error.message
        });
    }
});

// Get worker profile with current location
router.get('/profile', auth, isWorker, async (req, res) => {
    try {
        const worker = await Worker.findOne({ user: req.user._id });
        
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }
        
        res.json({
            success: true,
            data: worker
        });
    } catch (error) {
        console.error('Error getting worker profile:', error);
        res.status(500).json({
            success: false, 
            message: 'Failed to get worker profile',
            error: error.message
        });
    }
});

// Get all categories
router.get('/categories', auth, isWorker, async (req, res) => {
    try {
        const workers = await Worker.find({});
        const categories = new Set();
        
        workers.forEach(worker => {
            if (worker.skills && Array.isArray(worker.skills)) {
                worker.skills.forEach(skill => categories.add(skill.toLowerCase().trim()));
            }
            if (worker.categories && Array.isArray(worker.categories)) {
                worker.categories.forEach(category => categories.add(category.toLowerCase().trim()));
            }
        });
        
        const defaultCategories = [
            'plumbing', 'electrical', 'carpentry', 'painting',
            'cleaning', 'gardening', 'moving', 'appliance_repair',
            'hvac', 'roofing', 'other'
        ];
        
        defaultCategories.forEach(cat => categories.add(cat));
        
        res.status(200).json(Array.from(categories));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;