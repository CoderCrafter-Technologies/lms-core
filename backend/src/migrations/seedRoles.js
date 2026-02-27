const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const database = require('../config/database');
const { Role, Permission, User } = require('../models');

/**
 * Seed roles, permissions, and initial admin user
 */
async function seedRoles() {
  try {
    // Connect to database
    await database.connect();
    console.log('🔗 Connected to database for seeding...');

    // Create permissions
    const permissions = [
      { name: 'USER_MANAGEMENT', description: 'Manage users' },
      { name: 'COURSE_MANAGEMENT', description: 'Manage courses' },
      { name: 'BATCH_MANAGEMENT', description: 'Manage batches' },
      { name: 'STUDENT_MANAGEMENT', description: 'Manage students' },
      { name: 'INSTRUCTOR_MANAGEMENT', description: 'Manage instructors' },
      { name: 'LIVE_CLASS_MANAGEMENT', description: 'Manage live classes' },
      { name: 'ROLE_MANAGEMENT', description: 'Manage roles and permissions' },
      { name: 'ANALYTICS_VIEW', description: 'View analytics and reports' },
      { name: 'COURSE_VIEW', description: 'View courses' },
      { name: 'COURSE_ENROLL', description: 'Enroll in courses' },
      { name: 'CLASS_ATTEND', description: 'Attend live classes' },
      { name: 'PROFILE_EDIT', description: 'Edit own profile' }
    ];

    // Create or update permissions
    const createdPermissions = {};
    for (const perm of permissions) {
      const permission = await Permission.findOneAndUpdate(
        { name: perm.name },
        perm,
        { upsert: true, new: true }
      );
      createdPermissions[perm.name] = permission._id;
      console.log(`✅ Permission created/updated: ${perm.name}`);
    }

    // Create roles with permissions
    const rolesData = [
      {
        name: 'Admin',
        description: 'System administrator with full access',
        permissions: Object.values(createdPermissions), // All permissions
        isActive: true
      },
      {
        name: 'Instructor',
        description: 'Course instructor with teaching capabilities',
        permissions: [
          createdPermissions.COURSE_VIEW,
          createdPermissions.BATCH_MANAGEMENT,
          createdPermissions.STUDENT_MANAGEMENT,
          createdPermissions.LIVE_CLASS_MANAGEMENT,
          createdPermissions.ANALYTICS_VIEW,
          createdPermissions.PROFILE_EDIT
        ],
        isActive: true
      },
      {
        name: 'Student',
        description: 'Student with learning access',
        permissions: [
          createdPermissions.COURSE_VIEW,
          createdPermissions.COURSE_ENROLL,
          createdPermissions.CLASS_ATTEND,
          createdPermissions.PROFILE_EDIT
        ],
        isActive: true
      }
    ];

    // Create or update roles
    const createdRoles = {};
    for (const roleData of rolesData) {
      const role = await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      createdRoles[roleData.name] = role._id;
      console.log(`✅ Role created/updated: ${roleData.name}`);
    }

    // Create default admin user
    const adminEmail = 'admin@lmsfutureproof.com';
    const adminPassword = 'admin123456';

    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const adminUser = new User({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        roleId: createdRoles.Admin,
        isActive: true,
        isEmailVerified: true
      });

      await adminUser.save();
      console.log('✅ Default admin user created');
      console.log(`📧 Admin Email: ${adminEmail}`);
      console.log(`🔑 Admin Password: ${adminPassword}`);
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create test instructor
    const instructorEmail = 'instructor@lmsfutureproof.com';
    const instructorPassword = 'instructor123';

    const existingInstructor = await User.findOne({ email: instructorEmail });
    
    if (!existingInstructor) {
      const hashedPassword = await bcrypt.hash(instructorPassword, 12);
      
      const instructorUser = new User({
        email: instructorEmail,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Instructor',
        roleId: createdRoles.Instructor,
        isActive: true,
        isEmailVerified: true
      });

      await instructorUser.save();
      console.log('✅ Test instructor user created');
      console.log(`📧 Instructor Email: ${instructorEmail}`);
      console.log(`🔑 Instructor Password: ${instructorPassword}`);
    } else {
      console.log('ℹ️  Test instructor already exists');
    }

    // Create test student
    const studentEmail = 'student@lmsfutureproof.com';
    const studentPassword = 'student123';

    const existingStudent = await User.findOne({ email: studentEmail });
    
    if (!existingStudent) {
      const hashedPassword = await bcrypt.hash(studentPassword, 12);
      
      const studentUser = new User({
        email: studentEmail,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Student',
        roleId: createdRoles.Student,
        isActive: true,
        isEmailVerified: true
      });

      await studentUser.save();
      console.log('✅ Test student user created');
      console.log(`📧 Student Email: ${studentEmail}`);
      console.log(`🔑 Student Password: ${studentPassword}`);
    } else {
      console.log('ℹ️  Test student already exists');
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Quick Start Guide:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Login as admin to create courses and batches');
    console.log('3. Use the student management endpoints to create and enroll students');
    console.log('4. Schedule classes within batches');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await database.disconnect();
    console.log('📵 Database connection closed');
    process.exit(0);
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedRoles();
}

module.exports = seedRoles;