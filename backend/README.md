# LMS FutureProof - Backend API Documentation

## 🚀 Overview

The backend is built with **Node.js**, **Express.js**, and **MongoDB**, designed with a **repository pattern** for easy database migration to PostgreSQL. It provides a comprehensive REST API for a Learning Management System with real-time features.

## 🏗️ Architecture

### **Design Patterns**
- **Repository Pattern**: Database operations abstracted through repository classes
- **Controller-Service Architecture**: Clean separation of concerns
- **Middleware-based Security**: JWT authentication and role-based access
- **Socket.io Integration**: Real-time communication for live classes

### **Project Structure**
```
backend/
├── src/
│   ├── config/           # Database and environment configuration
│   ├── controllers/      # Request handlers and business logic
│   ├── middleware/       # Authentication, validation, error handling
│   ├── models/           # MongoDB schemas (future-proof for PostgreSQL)
│   ├── repositories/     # Data access layer abstraction
│   ├── routes/           # API endpoint definitions
│   ├── services/         # Business logic and external integrations
│   └── utils/            # Helper functions and utilities
├── migrations/           # Database migration scripts
├── test_scripts/         # API testing and debugging tools
└── server.js             # Application entry point
```

## 🔧 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18+
- **Database**: MongoDB 5.0+ (with PostgreSQL migration readiness)
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io 4.7+
- **Validation**: express-validator
- **Security**: helmet, cors, bcrypt
- **File Upload**: multer
- **Environment**: dotenv

## ⚙️ Setup & Installation

### **1. Environment Setup**
```bash
# Clone and navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### **2. Environment Variables**
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/lms_futureproof
DB_NAME=lms_futureproof

# Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# File Upload
UPLOAD_PATH=uploads/
MAX_FILE_SIZE=10485760

# Socket.io Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000

# Code Runner
PISTON_EXECUTE_URL=https://emkc.org/api/v2/piston/execute
```

### **3. Database Setup**
```bash
# Start MongoDB service
mongod

# Create test data (optional)
node create_test_data.js

# Create user accounts
node create_database_users.js
```

### **4. Start Server**
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start

# Test API endpoints
node test_batch_api.js
```

## 📚 API Documentation

### **Base URL**: `http://localhost:5000/api`

---

## 🔐 Authentication Endpoints

### **POST** `/auth/register`
Register a new user account

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "email": "john.doe@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "role": "STUDENT"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {...},
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### **POST** `/auth/login`
Authenticate user and get access token

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": {
        "name": "STUDENT",
        "permissions": [...]
      }
    },
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### **POST** `/auth/refresh`
Refresh access token using refresh token

**Headers:**
```
Authorization: Bearer <refresh_token>
```

### **POST** `/auth/logout`
Logout user and invalidate tokens

**Headers:**
```
Authorization: Bearer <access_token>
```

---

## 👥 User Management Endpoints

### **GET** `/users`
Get all users (Admin/Manager only)

**Query Parameters:**
- `page` (number): Page number for pagination
- `limit` (number): Items per page
- `role` (string): Filter by user role
- `search` (string): Search by name or email

**Headers:**
```
Authorization: Bearer <access_token>
```

### **GET** `/users/:id`
Get specific user details

### **PUT** `/users/:id`
Update user information

**Request Body:**
```json
{
  "firstName": "Updated Name",
  "lastName": "Updated Last",
  "phone": "+1234567890",
  "bio": "Updated bio"
}
```

### **DELETE** `/users/:id`
Delete user account (Admin only)

---

## 📚 Course Management Endpoints

### **GET** `/courses`
Get all courses with filtering

**Query Parameters:**
- `category` (string): Filter by course category
- `level` (string): Filter by difficulty level
- `status` (string): Filter by course status
- `page` (number): Page number
- `limit` (number): Items per page

### **POST** `/courses`
Create new course (Admin/Manager only)

**Request Body:**
```json
{
  "title": "React Development Masterclass",
  "description": "Comprehensive React course",
  "category": "Programming",
  "level": "Intermediate",
  "duration": 40,
  "price": 299.99,
  "prerequisites": ["Basic JavaScript"],
  "learningOutcomes": ["React fundamentals", "State management"],
  "courseContent": {
    "modules": [
      {
        "title": "Getting Started",
        "lessons": [...]
      }
    ]
  }
}
```

### **GET** `/courses/:id`
Get specific course details

### **PUT** `/courses/:id`
Update course information

### **DELETE** `/courses/:id`
Delete course (Admin only)

---

## 🎓 Batch Management Endpoints

### **GET** `/batches`
Get all batches

**Query Parameters:**
- `courseId` (string): Filter by course
- `status` (string): Filter by batch status
- `instructorId` (string): Filter by instructor

### **POST** `/batches`
Create new batch

**Request Body:**
```json
{
  "name": "Morning React Batch",
  "courseId": "course_id_here",
  "instructorId": "instructor_id_here",
  "startDate": "2024-01-15",
  "endDate": "2024-03-15",
  "schedule": {
    "days": ["Monday", "Wednesday", "Friday"],
    "startTime": "09:00",
    "endTime": "11:00",
    "timezone": "UTC"
  },
  "maxStudents": 25,
  "settings": {
    "allowLateJoin": true,
    "recordClasses": true,
    "allowStudentChat": true
  }
}
```

### **GET** `/batches/:id`
Get specific batch details with enrolled students

### **PUT** `/batches/:id`
Update batch information

### **DELETE** `/batches/:id`
Delete batch

---

## 🎥 Live Classes Endpoints

### **GET** `/live-classes`
Get all live classes with filtering

**Query Parameters:**
- `batchId` (string): Filter by batch
- `status` (string): Filter by class status (SCHEDULED, LIVE, ENDED, CANCELLED)
- `instructorId` (string): Filter by instructor
- `date` (string): Filter by specific date

### **GET** `/live-classes/batch/:batchId`
Get all classes for specific batch

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "class_id",
      "title": "React Hooks Deep Dive",
      "batchId": {...},
      "instructorId": {...},
      "scheduledStartTime": "2024-01-15T10:00:00Z",
      "scheduledEndTime": "2024-01-15T12:00:00Z",
      "status": "SCHEDULED",
      "roomId": "room_12345",
      "description": "Advanced React hooks",
      "stats": {
        "totalParticipants": 15,
        "peakParticipants": 18
      }
    }
  ]
}
```

### **POST** `/live-classes`
Schedule new live class

**Request Body:**
```json
{
  "title": "Advanced React Patterns",
  "description": "Learning advanced React patterns",
  "batchId": "batch_id_here",
  "scheduledStartTime": "2024-01-15T10:00:00Z",
  "scheduledEndTime": "2024-01-15T12:00:00Z",
  "instructorId": "instructor_id_here"
}
```

### **GET** `/live-classes/:id`
Get specific live class details

### **PUT** `/live-classes/:id`
Update live class

### **PATCH** `/live-classes/:id/start`
Start live class (change status to LIVE)

### **PATCH** `/live-classes/:id/end`
End live class

### **PATCH** `/live-classes/:id/cancel`
Cancel live class

---

## 👨‍🎓 Enrollment Endpoints

### **GET** `/enrollments`
Get all enrollments (Admin only)

### **GET** `/enrollments/batch/:batchId`
Get all enrollments for specific batch

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "enrollment_id",
      "studentId": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "batchId": "batch_id",
      "enrollmentDate": "2024-01-01T00:00:00Z",
      "status": "ENROLLED",
      "progress": {
        "completionPercentage": 45,
        "completedClasses": 9,
        "totalClasses": 20
      },
      "attendance": {
        "attendancePercentage": 90,
        "attendedClasses": 18,
        "totalClasses": 20
      }
    }
  ]
}
```

### **POST** `/enrollments`
Enroll student in batch

**Request Body:**
```json
{
  "studentId": "student_id_here",
  "batchId": "batch_id_here",
  "paymentStatus": "PAID"
}
```

### **GET** `/students/my-enrollments`
Get current student's enrollments

---

## 👨‍🏫 Instructor Endpoints

### **GET** `/instructors`
Get all instructors

### **GET** `/instructors/:id`
Get specific instructor profile

### **PUT** `/instructors/:id`
Update instructor profile

### **GET** `/instructors/my-batches`
Get current instructor's assigned batches

---

## 📊 Analytics Endpoints

### **GET** `/live-classes/stats`
Get live classes statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "totalClasses": 150,
    "scheduledClasses": 45,
    "liveClasses": 3,
    "endedClasses": 102,
    "cancelledClasses": 0,
    "totalParticipants": 2450,
    "averageParticipants": 16.3
  }
}
```

---

## 🔒 Security & Authentication

### **JWT Token Structure**
```javascript
{
  "userId": "user_id",
  "email": "user@example.com",
  "role": "STUDENT",
  "permissions": ["read_courses", "join_classes"],
  "iat": 1642234567,
  "exp": 1642238167
}
```

### **Role-Based Access Control**

#### **Roles Available:**
- **ADMIN**: Full system access
- **MANAGER**: Course and batch management
- **INSTRUCTOR**: Teaching and class management  
- **STUDENT**: Learning and class participation

#### **Permission Examples:**
```javascript
// Admin permissions
["*"] // All permissions

// Instructor permissions  
["read_courses", "manage_classes", "view_students", "grade_assignments"]

// Student permissions
["read_courses", "join_classes", "view_progress", "submit_assignments"]
```

### **Protected Routes**
All routes except `/auth/login` and `/auth/register` require authentication:

```javascript
// Header required for all API calls
Authorization: Bearer <jwt_token>
```

---

## 🔄 Real-time Features (Socket.io)

### **Connection**
```javascript
const socket = io('http://localhost:5000');

// Authenticate socket connection
socket.emit('authenticate', { token: 'jwt_token_here' });
```

### **Live Class Events**

#### **Join Class Room**
```javascript
socket.emit('join-class', {
  classId: 'class_id',
  roomId: 'room_id',
  userRole: 'STUDENT'
});
```

#### **Real-time Chat**
```javascript
// Send message
socket.emit('chat-message', {
  roomId: 'room_id',
  message: 'Hello everyone!',
  timestamp: new Date().toISOString()
});

// Receive messages
socket.on('new-message', (data) => {
  console.log('New message:', data);
});
```

#### **Screen Sharing**
```javascript
// Start screen sharing (instructor only)
socket.emit('start-screen-share', {
  roomId: 'room_id',
  streamId: 'stream_id'
});

// Whiteboard updates
socket.emit('whiteboard-update', {
  roomId: 'room_id',
  drawingData: {...}
});
```

---

## 🧪 Testing & Development

### **Test Scripts Available**
```bash
# Test specific batch API
node test_batch_api.js

# Debug user authentication  
node debug_user.js

# Create test data
node create_test_data.js

# Verify database setup
node verify_complete_setup.js

# Assessment integration (requires running API + test accounts)
RUN_ASSESSMENT_INTEGRATION=1 npm run test:assessment
```

### **API Testing with cURL**

#### **Login Example**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@lmsfutureproof.com","password":"student123"}'
```

#### **Get Classes for Batch**
```bash
curl -X GET "http://localhost:5000/api/live-classes/batch/689bbc29ad6921aa3cddc9a4" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚀 Deployment

### **Production Configuration**
```bash
# Set production environment
export NODE_ENV=production

# Use production database
export MONGODB_URI=mongodb://prod-server:27017/lms_prod

# Configure security
export JWT_SECRET=super_secure_production_key
export CORS_ORIGIN=https://yourdomain.com
```

### **PM2 Process Management**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/server.js --name "lms-backend"

# Monitor processes
pm2 monit

# View logs
pm2 logs lms-backend
```

---

## 📝 Database Schema

### **Migration Ready Design**
All models are designed for easy PostgreSQL migration:

```javascript
// MongoDB Schema (Current)
const userSchema = {
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String, // Unique index
  roleId: ObjectId, // References roles collection
  createdAt: Date,
  updatedAt: Date
};

// PostgreSQL Ready (Future)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100), 
  email VARCHAR(255) UNIQUE,
  role_id UUID REFERENCES roles(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🔍 Error Handling

### **Standard Error Response**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ],
  "code": "VALIDATION_ERROR"
}
```

### **HTTP Status Codes Used**
- `200` - Success
- `201` - Created
- `400` - Bad Request (Validation errors)
- `401` - Unauthorized (Authentication required)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `409` - Conflict (Duplicate data)
- `500` - Internal Server Error

---

## 📞 Support & Contribution

### **Development Team Contact**
- **Lead Developer**: System Administrator
- **Architecture**: Repository Pattern with PostgreSQL migration path
- **Real-time Features**: Socket.io integration
- **Security**: JWT-based authentication with role permissions

### **Contribution Guidelines**
1. Follow repository pattern for all database operations
2. Add proper validation for all endpoints
3. Include comprehensive error handling
4. Update this documentation for new endpoints
5. Write tests for critical functionality

---

**Generated with** [Memex](https://memex.tech)  
**Co-Authored-By**: Memex <noreply@memex.tech>
