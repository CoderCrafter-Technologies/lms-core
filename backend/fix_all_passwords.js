const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User');

async function fixAllPasswords() {
  try {
    console.log('🔧 Fixing passwords for all users...\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users\n`);

    const passwordMap = {
      'admin@lmsfutureproof.com': 'admin123456',
      'instructor@lmsfutureproof.com': 'instructor123',
      'instructor1@lmsfutureproof.com': 'instructor123',
      'instructor2@lmsfutureproof.com': 'instructor123',
      'student@lmsfutureproof.com': 'student123',
      'student1@lmsfutureproof.com': 'student123',
      'student2@lmsfutureproof.com': 'student123',
      'student3@lmsfutureproof.com': 'student123',
      'student4@lmsfutureproof.com': 'student123',
      'student5@lmsfutureproof.com': 'student123'
    };

    for (const user of users) {
      const email = user.email;
      const password = passwordMap[email];
      
      if (password) {
        console.log(`👤 Processing: ${email}`);
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Update the user
        await User.findByIdAndUpdate(user._id, {
          password: hashedPassword
        });
        
        console.log(`💾 Password updated for ${email}`);
        
        // Test the password
        const testUser = await User.findById(user._id);
        const isValid = await bcrypt.compare(password, testUser.password);
        console.log(`🧪 Password test: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log('──────────────────────────────────────────────────');
      }
    }

    console.log('\n🎉 All passwords fixed!\n');
    console.log('📋 WORKING LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    Object.entries(passwordMap).forEach(([email, password]) => {
      console.log(`📧 ${email}`);
      console.log(`🔐 ${password}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error fixing passwords:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📵 Database connection closed');
    process.exit(0);
  }
}

fixAllPasswords();