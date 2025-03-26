const Worker = require('../models/Worker');
const webpush = require('web-push');

// Configure web-push with your VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:example@yourdomain.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

const sendNotificationsToMatchingWorkers = async (job) => {
    try {
        console.log(`Finding workers for new job: ${job.title} (${job._id})`);
        
        // Ensure job has category
        if (!job.category) {
            console.error('Job is missing category, cannot send notifications');
            return;
        }

        console.log(`Looking for workers with skills matching: ${job.category}`);
        
        // Find all workers who have the required category/skill, regardless of location
        const matchingWorkers = await Worker.find({
            $or: [
                { skills: { $in: [new RegExp(job.category, 'i')] } },
                { categories: { $in: [new RegExp(job.category, 'i')] } }
            ]
        });
        
        console.log(`Found ${matchingWorkers.length} workers with matching skills for job ${job._id}`);

        if (matchingWorkers.length === 0) {
            return;
        }
        
        // Create a notification for each worker
        const notifications = matchingWorkers.map(async (worker) => {
            try {
                // Create notification object with timestamp
                const notification = {
                    type: 'new_job',
                    job: job._id,
                    message: `New job available: ${job.title}`,
                    isRead: false,
                    createdAt: new Date()
                };
                
                // Add notification to worker's notifications array
                worker.notifications = worker.notifications || [];
                worker.notifications.push(notification);
                
                // Save the updated worker document
                await worker.save();
                console.log(`Notification sent to worker ${worker._id} for job ${job._id}`);
                
                // Send push notification if subscription exists
                if (worker.pushSubscription && process.env.VAPID_PUBLIC_KEY) {
                    try {
                        const payload = JSON.stringify({
                            title: 'New Job Available!',
                            body: `${job.title} in ${job.address}`,
                            icon: '/logo.png',
                            data: { jobId: job._id.toString() }
                        });
                        
                        await webpush.sendNotification(worker.pushSubscription, payload);
                        console.log(`Push notification sent to worker ${worker._id}`);
                    } catch (err) {
                        console.error('Push notification error:', err);
                    }
                }
            } catch (err) {
                console.error(`Error notifying worker ${worker._id}:`, err);
            }
        });
        
        await Promise.all(notifications);
        console.log(`Successfully sent notifications to all ${matchingWorkers.length} matching workers`);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
};

module.exports = {
    sendNotificationsToMatchingWorkers,
    // Keep the old function name for backwards compatibility
    sendNotificationToNearbyWorkers: sendNotificationsToMatchingWorkers
};