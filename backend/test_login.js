const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Role = require('./src/models/Role');

async function testLogin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // Test accounts
    const testAccounts = [
      { email: 'admin@lmsfutureproof.com', password: 'admin123456' },
      { email: 'instructor@lmsfutureproof.com', password: 'instructor123' },
      { email: 'student@lmsfutureproof.com', password: 'student123' }
    ];

    console.log('🧪 Testing login for all test accounts...\n');

    for (const testAccount of testAccounts) {
      try {
        // Find user by email
        const user = await User.findOne({ email: testAccount.email }).populate('roleId');
        
        if (!user) {
          console.log(`❌ User not found: ${testAccount.email}`);
          continue;
        }

        // Test password
        const isPasswordValid = await user.comparePassword(testAccount.password);
        
        console.log(`📧 Email: ${testAccount.email}`);
        console.log(`🔐 Password: ${testAccount.password}`);
        console.log(`✅ Login: ${isPasswordValid ? 'SUCCESS' : 'FAILED'}`);
        console.log(`👤 Name: ${user.firstName} ${user.lastName}`);
        console.log(`🎭 Role: ${user.roleId?.displayName || 'No role'}`);
        console.log(`📊 Active: ${user.isActive}`);
        console.log(`📧 Email Verified: ${user.isEmailVerified}`);
        console.log(`🔒 Account Locked: ${user.isLocked || false}`);
        console.log('─'.repeat(50));
        
      } catch (error) {
        console.log(`❌ Error testing ${testAccount.email}:`, error.message);
        console.log('─'.repeat(50));
      }
    }

    // Additional verification - check all users and roles
    console.log('\n📊 Database Summary:');
    const allUsers = await User.find().populate('roleId');
    const allRoles = await Role.find();
    
    console.log(`👥 Total Users: ${allUsers.length}`);
    console.log(`🎭 Total Roles: ${allRoles.length}`);
    
    console.log('\n🎭 Available Roles:');
    allRoles.forEach(role => {
      console.log(`- ${role.name} (${role.displayName}) - Level ${role.level}`);
    });

    console.log('\n👥 All Users:');
    allUsers.forEach(user => {
      console.log(`- ${user.email} → ${user.roleId?.displayName || 'No role'} (${user.isActive ? 'Active' : 'Inactive'})`);
    });

  } catch (error) {
    console.error('❌ Error during login test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

// Run the test
testLogin();