const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./src/models/User');

async function fixPasswords() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // Test accounts with their passwords
    const accounts = [
      { email: 'admin@lmsfutureproof.com', password: 'admin123456' },
      { email: 'instructor@lmsfutureproof.com', password: 'instructor123' },
      { email: 'student@lmsfutureproof.com', password: 'student123' }
    ];

    console.log('🔧 Fixing passwords for all test accounts...\n');

    for (const account of accounts) {
      try {
        // Find user
        const user = await User.findOne({ email: account.email });
        if (!user) {
          console.log(`❌ User not found: ${account.email}`);
          continue;
        }

        console.log(`👤 Processing: ${account.email}`);
        
        // Hash password manually (not using pre-save middleware)
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(account.password, saltRounds);
        
        console.log(`🔑 New password hash: ${hashedPassword.substring(0, 30)}...`);
        
        // Update password directly in database (bypassing pre-save middleware)
        await User.updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword } }
        );
        
        console.log(`💾 Password updated for ${account.email}`);
        
        // Test the password immediately
        const updatedUser = await User.findById(user._id);
        const isValid = await bcrypt.compare(account.password, updatedUser.password);
        console.log(`🧪 Password test: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        // Also test the user method
        const isValidMethod = await updatedUser.comparePassword(account.password);
        console.log(`🧪 Method test: ${isValidMethod ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        console.log('─'.repeat(50));
        
      } catch (error) {
        console.error(`❌ Error processing ${account.email}:`, error.message);
        console.log('─'.repeat(50));
      }
    }

    console.log('\n🎉 Password fix completed!');
    console.log('\n📋 UPDATED LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const account of accounts) {
      console.log(`📧 ${account.email}`);
      console.log(`🔐 ${account.password}`);
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error fixing passwords:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

fixPasswords();