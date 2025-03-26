const Job = require('../models/Job');
const User = require('../models/User');
const Worker = require('../models/Worker');
const ErrorResponse = require('../utils/errorResponse');
const { sendNotificationsToMatchingWorkers } = require('../utils/notifications');
const mongoose = require('mongoose');
const { validateCoordinates, logLocationInfo } = require('../utils/locationUtils');

// Create a new job
exports.createJob = async (req, res, next) => {
    try {
        if (req.user.userType !== 'client') {
            return next(new ErrorResponse('Only clients can create jobs', 403));
        }

        const {
            title,
            description,
            category,
            address,
            latitude,
            longitude,
            budget,
            deadline,
            timeStart,
            timeEnd
        } = req.body;

        // Create location object with validation
        const locationObj = validateCoordinates(latitude, longitude);

        // Validate coordinates
        if (!locationObj) {
            return next(new ErrorResponse('Invalid coordinates. Please provide valid latitude and longitude.', 400));
        }

        // Log for debugging
        logLocationInfo(`Creating job with location`, locationObj);

        const jobData = {
            title,
            description,
            category,
            address,
            location: locationObj,
            budget: parseFloat(budget),
            deadline: new Date(deadline),
            timeStart,
            timeEnd,
            user: req.user._id,
            images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
        };

        const job = new Job(jobData);
        await job.save();

        // Send notifications to workers with matching skills
        await sendNotificationsToMatchingWorkers(job);

        res.status(201).json({
            success: true,
            data: job
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
};

// Get all categories
exports.getCategories = async (req, res, next) => {
    try {
        // Get unique categories from workers' skills
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
        
        // Add default categories
        const defaultCategories = [
            'plumbing', 'electrical', 'carpentry', 'painting',
            'cleaning', 'gardening', 'moving', 'appliance_repair',
            'hvac', 'roofing', 'other'
        ];
        
        defaultCategories.forEach(cat => categories.add(cat));
        
        res.status(200).json(Array.from(categories));
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
};

// Get available jobs for workers
exports.getAvailableJobs = async (req, res, next) => {
    try {
        if (req.user.userType !== 'worker') {
            return next(new ErrorResponse('Access denied', 403));
        }

        const jobs = await Job.find({
            status: 'pending',
            worker: null
        })
        .populate('user', 'name phone')
        .select('title description category address budget deadline timeStart timeEnd images createdAt status')
        .sort('-createdAt');

        res.status(200).json(jobs);
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
};

// Get nearby jobs for workers
exports.getNearbyJobs = async (req, res, next) => {
    try {
        // Redirect to worker route
        return res.redirect(307, '/api/worker/nearby-jobs');
    } catch (error) {
        return next(new ErrorResponse('Error fetching nearby jobs', 500));
    }
};

// Accept a job
exports.acceptJob = async (req, res, next) => {
    try {
        if (req.user.userType !== 'worker') {
            return next(new ErrorResponse('Only workers can accept jobs', 403));
        }

        const job = await Job.findById(req.params.id);
        
        if (!job) {
            return next(new ErrorResponse('Job not found', 404));
        }

        if (job.status !== 'pending' || job.worker) {
            return next(new ErrorResponse('Job is no longer available', 400));
        }

        job.worker = req.user._id;
        job.status = 'in progress';
        await job.save();

        res.status(200).json({
            success: true,
            data: job
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
};

// Get user's jobs (client)
exports.getMyPosts = async (req, res, next) => {
    try {
        const jobs = await Job.find({ user: req.user._id })
            .populate('worker', 'name phone email')
            .sort({ createdAt: -1 });
        
        res.status(200).json(jobs);
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
};

// Get worker's assigned jobs
exports.getMyAssignments = async (req, res, next) => {
    try {
        if (req.user.userType !== 'worker') {
            return next(new ErrorResponse('Access denied', 403));
        }

        const jobs = await Job.find({ worker: req.user._id })
            .populate('user', 'name phone email')
            .sort({ createdAt: -1 });
        
        res.status(200).json(jobs);
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
};

// Get job details
exports.getJobById = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('worker', 'name email phone rating');

        if (!job) {
            return next(new ErrorResponse('Job not found', 404));
        }

        res.status(200).json({
            success: true,
            data: job
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
};

// Update job status
exports.updateJobStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new ErrorResponse('Job not found', 404));
        }

        // Verify authorization
        if (job.user.toString() !== req.user._id.toString() && 
            (!job.worker || job.worker.toString() !== req.user._id.toString())) {
            return next(new ErrorResponse('Not authorized', 403));
        }

        job.status = status;
        if (status === 'completed') {
            job.completedAt = new Date();
            
            // Update worker stats if there is an assigned worker
            if (job.worker) {
                await User.findByIdAndUpdate(job.worker, {
                    $inc: { completedJobs: 1 }
                });
            }
        }

        await job.save();
        res.status(200).json({
            success: true,
            data: job
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
};

// Add review and rating
exports.addReview = async (req, res, next) => {
    try {
        const { rating, review } = req.body;
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new ErrorResponse('Job not found', 404));
        }

        // Only job poster can add review
        if (job.user.toString() !== req.user._id.toString()) {
            return next(new ErrorResponse('Not authorized', 403));
        }

        if (job.status !== 'completed') {
            return next(new ErrorResponse('Can only review completed jobs', 400));
        }

        job.rating = rating;
        job.review = review;
        await job.save();

        // Update worker's average rating
        const workerJobs = await Job.find({ 
            worker: job.worker,
            rating: { $exists: true }
        });

        const averageRating = workerJobs.reduce((acc, job) => acc + job.rating, 0) / workerJobs.length;

        await User.findByIdAndUpdate(job.worker, {
            rating: averageRating
        });

        res.status(200).json({
            success: true,
            data: job
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
};