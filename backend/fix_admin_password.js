const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');

// Import models
const User = require('./src/models/User');

async function fixAdminPassword() {
  try {
    console.log('🔧 Fixing admin password...');
    
    // Find admin user
    const adminUser = await User.findOne({ email: 'admin@lmsfutureproof.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log(`Found admin: ${adminUser.firstName} ${adminUser.lastName}`);
    
    // Update password directly (model will hash it)
    adminUser.password = 'admin123456';
    await adminUser.save();
    
    console.log('✅ Admin password updated successfully');
    
    // Test the new password
    const testPassword = 'admin123456';
    const isValid = await bcrypt.compare(testPassword, adminUser.password);
    console.log(`🧪 Password verification test: ${isValid}`);
    
    // Also update other test users
    const instructorUser = await User.findOne({ email: 'instructor@lmsfutureproof.com' });
    if (instructorUser) {
      instructorUser.password = 'instructor123';
      await instructorUser.save();
      console.log('✅ Instructor password updated');
    }
    
    const studentUser = await User.findOne({ email: 'student@lmsfutureproof.com' });
    if (studentUser) {
      studentUser.password = 'student123';
      await studentUser.save();
      console.log('✅ Student password updated');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixAdminPassword();