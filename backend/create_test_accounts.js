const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Role = require('./src/models/Role');

async function createTestAccounts() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // First, create/ensure roles exist
    const rolesData = [
      {
        name: 'ADMIN',
        displayName: 'Administrator',
        description: 'System administrator with full access',
        level: 1,
        isActive: true,
        isSystemRole: true
      },
      {
        name: 'INSTRUCTOR',
        displayName: 'Instructor',
        description: 'Course instructor with teaching capabilities',
        level: 2,
        isActive: true,
        isSystemRole: true
      },
      {
        name: 'STUDENT',
        displayName: 'Student',
        description: 'Student with learning access',
        level: 3,
        isActive: true,
        isSystemRole: true
      }
    ];

    console.log('🎭 Creating/updating roles...');
    const createdRoles = {};
    
    for (const roleData of rolesData) {
      const role = await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      createdRoles[roleData.name] = role._id;
      console.log(`✅ Role created/updated: ${roleData.name} (${roleData.displayName})`);
    }

    // Create test accounts
    const testAccounts = [
      {
        email: 'admin@lmsfutureproof.com',
        password: 'admin123456',
        firstName: 'System',
        lastName: 'Administrator',
        roleName: 'ADMIN',
        phone: '+1234567890'
      },
      {
        email: 'instructor@lmsfutureproof.com',
        password: 'instructor123',
        firstName: 'John',
        lastName: 'Instructor',
        roleName: 'INSTRUCTOR',
        phone: '+1234567891'
      },
      {
        email: 'student@lmsfutureproof.com',
        password: 'student123',
        firstName: 'Jane',
        lastName: 'Student',
        roleName: 'STUDENT',
        phone: '+1234567892'
      }
    ];

    console.log('\n👥 Creating test user accounts...');
    
    for (const accountData of testAccounts) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: accountData.email });
      
      if (existingUser) {
        console.log(`ℹ️  User ${accountData.email} already exists - updating password if needed`);
        
        // findByIdAndUpdate bypasses pre-save middleware, so hash explicitly.
        const hashedPassword = await bcrypt.hash(accountData.password, 12);
        await User.findByIdAndUpdate(existingUser._id, {
          password: hashedPassword,
          firstName: accountData.firstName,
          lastName: accountData.lastName,
          phone: accountData.phone,
          roleId: createdRoles[accountData.roleName],
          isActive: true,
          isEmailVerified: true
        });
        
        console.log(`✅ Updated user: ${accountData.email}`);
      } else {
        // Create new user with plain password so model pre-save middleware hashes it once.
        const newUser = new User({
          email: accountData.email,
          password: accountData.password,
          firstName: accountData.firstName,
          lastName: accountData.lastName,
          phone: accountData.phone,
          roleId: createdRoles[accountData.roleName],
          isActive: true,
          isEmailVerified: true
        });

        await newUser.save();
        console.log(`✅ Created user: ${accountData.email}`);
      }
    }

    // Display login credentials
    console.log('\n🎉 Test accounts ready!');
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const account of testAccounts) {
      const role = rolesData.find(r => r.name === account.roleName);
      console.log(`
🔑 ${role.displayName.toUpperCase()} ACCOUNT:
   📧 Email:    ${account.email}
   🔐 Password: ${account.password}
   👤 Name:     ${account.firstName} ${account.lastName}
   📱 Phone:    ${account.phone}
      `);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Use these credentials to login and test different user roles');
    console.log('3. Each role has different permissions and access levels');
    
    // Verify users were created successfully
    console.log('\n🔍 Verifying created users...');
    const allUsers = await User.find().populate('roleId');
    console.log(`Total users in database: ${allUsers.length}`);
    
    for (const user of allUsers) {
      console.log(`- ${user.email} (${user.roleId?.displayName || 'No role'})`);
    }

  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

// Run the script
createTestAccounts();
