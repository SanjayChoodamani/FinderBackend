const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Worker = require('./models/Worker');
const Job = require('./models/Job');

// Load environment variables
dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Database connected for sample data generation'))
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

// Sample data creation function
const createSampleData = async () => {
  try {
    console.log('Starting sample data creation...');
    
    // Clear existing data
    await User.deleteMany({});
    await Worker.deleteMany({});
    await Job.deleteMany({});
    
    console.log('Existing data cleared');

    // Create client users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const clients = await User.create([
      {
        name: 'Amit Kumar',
        email: 'amit@example.com',
        password: hashedPassword,
        phone: '+919876543210',
        userType: 'client',
        address: 'B-12, Vasant Vihar, New Delhi'
      },
      {
        name: 'Priya Sharma',
        email: 'priya@example.com',
        password: hashedPassword,
        phone: '+919876543211',
        userType: 'client',
        address: 'C-45, Greater Kailash, New Delhi'
      }
    ]);
    
    console.log(`Created ${clients.length} client users`);

    // Update the worker users creation section
    const workers = await User.create([
      {
        name: 'Raj Singh',
        email: 'raj@example.com',
        password: hashedPassword,
        phone: '+919876543212',
        userType: 'worker',
        rating: 4.5,
        completedJobs: 12,
        address: 'A-45, Rohini, New Delhi'  // Add address field
      },
      {
        name: 'Deepak Kumar',
        email: 'deepak@example.com',
        password: hashedPassword,
        phone: '+919876543213',
        userType: 'worker',
        rating: 4.2,
        completedJobs: 8,
        address: '212, Dwarka Sector 7, New Delhi'  // Add address field
      },
      {
        name: 'Sunita Verma',
        email: 'sunita@example.com',
        password: hashedPassword,
        phone: '+919876543214',
        userType: 'worker',
        rating: 4.8,
        completedJobs: 24,
        address: '56, Lajpat Nagar, New Delhi'  // Add address field
      }
    ]);
    
    console.log(`Created ${workers.length} worker users`);

    // Create worker profiles
    const workerProfiles = await Worker.create([
      {
        user: workers[0]._id,
        skills: ['plumbing', 'electrical'],
        experience: 5,
        serviceRadius: 15,
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139] // Delhi coordinates
        }
      },
      {
        user: workers[1]._id,
        skills: ['carpentry', 'painting'],
        experience: 3,
        serviceRadius: 10,
        location: {
          type: 'Point',
          coordinates: [77.2300, 28.6500] // Near Delhi
        }
      },
      {
        user: workers[2]._id,
        skills: ['cleaning', 'gardening'],
        experience: 7,
        serviceRadius: 20,
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.7041] // Delhi NCR
        }
      }
    ]);
    
    console.log(`Created ${workerProfiles.length} worker profiles`);

    // Create jobs
    const today = new Date();
    
    const jobs = await Job.create([
      {
        title: 'Fix Bathroom Leak',
        description: 'Need to repair a leaking pipe under the sink in the main bathroom',
        category: 'plumbing',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139] // Delhi coordinates
        },
        address: 'A-15, Vasant Kunj, New Delhi, Delhi 110070',
        budget: 1800,
        deadline: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        timeStart: '10:00',
        timeEnd: '12:00',
        user: clients[0]._id,
        status: 'pending'
      },
      {
        title: 'Electrical Wiring Installation',
        description: 'Need to install new light fixtures and check existing wiring',
        category: 'electrical',
        location: {
          type: 'Point',
          coordinates: [77.2300, 28.6500] // Near Delhi
        },
        address: 'C-45, Greater Kailash Part 1, New Delhi, Delhi 110048',
        budget: 2500,
        deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        timeStart: '14:00',
        timeEnd: '17:00',
        user: clients[1]._id,
        status: 'pending'
      },
      {
        title: 'Paint Living Room',
        description: 'Need to paint a 15x18 living room with premium quality paint',
        category: 'painting',
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.7041] // Delhi NCR
        },
        address: 'D-10, Pitampura, New Delhi, Delhi 110034',
        budget: 5000,
        deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        timeStart: '09:00',
        timeEnd: '18:00',
        user: clients[0]._id,
        status: 'pending'
      },
      {
        title: 'Deep Clean Apartment',
        description: 'Need thorough cleaning of 2BHK apartment including kitchen and bathrooms',
        category: 'cleaning',
        location: {
          type: 'Point',
          coordinates: [77.2167, 28.6333] // Another Delhi location
        },
        address: '255, Defence Colony, New Delhi, Delhi 110024',
        budget: 2200,
        deadline: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        timeStart: '10:00',
        timeEnd: '15:00',
        user: clients[1]._id,
        status: 'pending'
      }
    ]);
    
    console.log(`Created ${jobs.length} jobs`);

    // Create one job with a worker assigned
    const assignedJob = await Job.create({
      title: 'Fix Kitchen Cabinet',
      description: 'Repair broken kitchen cabinet door and adjust hinges',
      category: 'carpentry',
      location: {
        type: 'Point',
        coordinates: [77.2167, 28.6333]
      },
      address: '78, Malviya Nagar, New Delhi, Delhi 110017',
      budget: 1500,
      deadline: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
      timeStart: '16:00',
      timeEnd: '18:00',
      user: clients[0]._id,
      worker: workers[1]._id,
      status: 'in progress'
    });
    
    console.log('Created 1 assigned job');
    
    // Create one completed job with rating
    const completedJob = await Job.create({
      title: 'Garden Maintenance',
      description: 'Trim bushes, mow lawn, and general garden cleanup',
      category: 'gardening',
      location: {
        type: 'Point',
        coordinates: [77.1167, 28.7000]
      },
      address: '112, Model Town, New Delhi, Delhi 110009',
      budget: 1200,
      deadline: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      timeStart: '08:00',
      timeEnd: '12:00',
      user: clients[1]._id,
      worker: workers[2]._id,
      status: 'completed',
      completedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      rating: 5,
      review: 'Excellent work! The garden looks beautiful now.'
    });
    
    console.log('Created 1 completed job with rating');
    
    console.log('Sample data creation completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample data:', error);
    process.exit(1);
  }
};

// Run the function
createSampleData();