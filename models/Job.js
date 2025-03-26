// models/Job.js
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            'plumbing',
            'electrical',
            'carpentry',
            'painting',
            'cleaning',
            'gardening',
            'moving',
            'appliance_repair',
            'hvac',
            'roofing',
            'other'
        ]
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            validate: {
                validator: function(v) {
                    return v.length === 2 && 
                           v[0] >= -180 && v[0] <= 180 && 
                           v[1] >= -90 && v[1] <= 90;
                },
                message: 'Invalid coordinates'
            }
        }
    },
    address: {
        type: String,
        required: true
    },
    budget: {
        type: Number,
        required: true,
        min: 0
    },
    deadline: {
        type: Date,
        required: true
    },
    timeStart: {
        type: String,
        required: true
    },
    timeEnd: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['pending', 'in progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    radius: {
        type: Number,
        required: true,
        default: 10, // Default 10km radius
        min: 1,
        max: 50
    }
});

// Add this method to find nearby workers
jobSchema.statics.findNearbyWorkers = async function (coordinates, radiusInKm) {
    try {
        const workers = await mongoose.model('Worker').find({
            userType: 'worker',
            location: {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates: coordinates
                    },
                    $maxDistance: radiusInKm * 1000 // Convert km to meters
                }
            }
        });
        return workers;
    } catch (error) {
        console.error('Error finding nearby workers:', error);
        return [];
    }
};

// Add method to find jobs near a location
jobSchema.statics.findNearby = async function(location, radiusInKm, filters = {}) {
    try {
        const query = {
            ...filters,
            location: {
                $nearSphere: {
                    $geometry: location,
                    $maxDistance: radiusInKm * 1000 // Convert km to meters
                }
            }
        };
        
        return await this.find(query).sort({ createdAt: -1 });
    } catch (error) {
        console.error('Error finding nearby jobs:', error);
        return [];
    }
};

// Add index for geospatial queries
jobSchema.index({ location: '2dsphere' });

const Job = mongoose.model('Job', jobSchema);
module.exports = Job;