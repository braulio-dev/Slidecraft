import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';
import User from '../models/User.mjs';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/slidecraft';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Get username
    const username = await question('Enter admin username: ');
    if (!username || username.length < 3) {
      console.error('❌ Username must be at least 3 characters');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.error('❌ User with this username already exists');
      process.exit(1);
    }

    // Get password
    const password = await question('Enter admin password: ');
    if (!password || password.length < 6) {
      console.error('❌ Password must be at least 6 characters');
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await question('Confirm admin password: ');
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    // Create admin user
    const admin = new User({
      username,
      password,
      role: 'admin'
    });

    await admin.save();
    console.log('\n✅ Admin user created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Role: admin`);
    console.log('\nYou can now login with these credentials.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createAdmin();
