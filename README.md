# A Smart Senior Projects Management System

## Overview
A comprehensive platform for managing university senior projects, facilitating collaboration between students, supervisors, and external examiners. The system streamlines project proposal, approval, tracking, and evaluation processes.

## Features
- **Role-based access control** (Students, Supervisors, Admin, External Examiners)
- **Project lifecycle management** (Idea selaction → Approval → Proposal → literatureReview → planning → design → Implementation → presentation → reportPaper → poster → Evaluation)
- **Supervisor dashboard** for project oversight
- **Automated role assignment** based on email domain
- **Secure authentication** with password hashing

## System Architecture

### Backend Structure
```
a-smart-senior-projects-management-system/
├── config/
│   └── database.js 
├── controllers/
│   ├── admin.js
│   ├── auth.js
│   ├── external-examiners.js
│   ├── students.js
│   ├── supervisors.js
│   └── users.js
├── middleware/
│   ├── is-signed-in.js
│   └── pass-user-to-view.js
├── models/
│   ├── committee-assignment.js
│   ├── contact.js
│   ├── evaluation.js
│   ├── notification.js
│   ├── project.js
│   └── user.js
├── node_modules/
├── public/
│   ├── stylesheets/
│   │   ├── auth.css
│   │   └── partials.css
│   ├── uplaods/
├── uplaods/
├── views/
│   ├── admin/
│   │   ├── assign-committees.ejs
│   │   └── dashboard.ejs
│   ├── auth/
│   │   ├── sign-in.ejs
│   │   └── sign-up.ejs
│   ├── external-examiners/
│   │   ├── assigned-projects.ejs
│   │   ├── evaluation-form.ejs
│   │   └── dashboard.ejs
│   ├── partials/
│   │   └── _navbar.ejs
│   ├── shared/
│   │   ├── conatct.ejs
│   │   ├── notifications.ejs
│   │   └── profile.ejs
│   ├── students/
│   │   ├── projects/
│   │   │   ├── phases/
│   │   │   │   ├── index.ejs
│   │   │   ├── details.ejs 
│   │   │   ├── edit.ejs
│   │   │   ├── index.ejs
│   │   │   ├── new.ejs
│   │   │   └── proposed-projects.ejs
│   │   └── dashboard.ejs
│   ├── supervisors/
│   │   ├── projects/
│   │   │   ├── phases/
│   │   │   │   ├── index.ejs
│   │   │   ├── applicants.ejs 
│   │   │   ├── assigned-projects.ejs
│   │   │   ├── details.ejs 
│   │   │   ├── edit.ejs
│   │   │   ├── evaluation-form.ejs
│   │   │   ├── index.ejs
│   │   │   ├── new.ejs
│   │   │   ├── show-all.ejs
│   │   │   └── student-project.ejs
│   │   └── dashboard.ejs
│   └── index.ejs
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

## Key Components

### Models

#### User Model (`models/User.js`)
- Handles all user types (students, supervisors, admin, external examiners)
- Automatic role assignment based on email domain
- Secure password hashing
- Project references for different roles
- Student ID validation (9 digits)

#### Project Model (`models/Project.js`)
- Tracks project lifecycle (available → pending → assigned → completed)
- Manages team members, applicants, and supervisors
- Stores approval/rejection information
- Supports both student-proposed and supervisor-proposed projects

### Controllers

#### Auth Controller (`controllers/auth.js`)
- User authentication (sign-in/sign-out)
- Session management
- Password reset functionality

#### Supervisor Controller (`controllers/supervisors.js`)
- Project creation and management
- Applicant review and approval
- Student project oversight
- Phase management for approved projects

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Khawla192/a-smart-senior-projects-management-system.git
   cd a-smart-senior-projects-management-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```
   MONGODB_URI=mongodb://localhost:27017/senior-projects
   SESSION_SECRET=your-secret-key
   PORT=3000
   ```

4. Start the application:
   ```bash
   node server.js
   ```

## Usage

### User Roles

1. **Students**:
   - Submit project proposals
   - Apply for existing projects
   - Track project progress
   - Update profile information

2. **Supervisors**:
   - Create and manage projects
   - Review student applications
   - Approve/reject project proposals
   - Monitor project phases
   - Evaluate completed projects

3. **Admin**:
   - Assign Project to Committees to Evaluate it

4. **External Examiners**:
   - Project evaluation
   - Final assessment
   - Feedback submission

### Project Workflow

1. **Project Creation**:
   - Supervisors create projects via `/supervisors/projects/new`
   - Students can propose projects via `/students/projects/new`

2. **Application Phase**:
   - Students apply for projects
   - Supervisors review applications at `/supervisors/projects/applicants`

3. **Approval Phase**:
   - Supervisors approve/reject applications
   - Approved projects move to "assigned" status

4. **Implementation**:
   - Students work on projects through defined phases
   - Supervisors monitor progress at `/supervisors/projects/student-project/:id`

5. **Evaluation**:
   - External examiners evaluate completed projects
   - Final grades are recorded

## API Endpoints

### Authentication
- `POST /auth/sign-in` - User login
- `POST /auth/sign-up` - User registration
- `GET /auth/sign-out` - User logout

### Profile Management
- `GET /profile` - View user profile
- `POST /profile` - Update profile information

### Project Management
- `GET /projects/new` - Project creation form
- `POST /projects/new` - Create new project
- `GET /projects/:id` - View project details
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

## Configuration

### Database
Configure MongoDB connection in `config/database.js`:
```javascript
mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on("connected", () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});
```

### Session
Session configuration in `server.js`:
```javascript
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: false,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);
```

## Dependencies

- Express.js - Web framework
- Mongoose - MongoDB ODM
- EJS - Templating engine
- bcrypt - Password hashing
- dotenv - Environment variables
- morgan - HTTP request logger
- express-session - Session management

## Development

### Running in Development Mode
```bash
npm run dev
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Features
- **Role-based access control** (Students, Supervisors, Admin, External Examiners)
- **Project lifecycle management** (Idea selection → Approval → Proposal → literatureReview → planning → design → Implementation → presentation → reportPaper → poster → Evaluation)
- **Supervisor dashboard** for project oversight
- **Automated role assignment** based on email domain
- **Secure authentication** with password hashing

## Future Work

The system has several potential enhancements that could further improve its functionality and user experience:

### 1. Enhanced Student Profile Management
- Implement student ID validation (9 digits) with automatic verification
- Add academic advisor assignment functionality
- Include GPA tracking and academic standing checks

### 2. Advanced Testing Framework
- Add integration testing for critical workflows
- Develop an automation testing

### 3. Comprehensive Admin Management
- **User Management**:
  - Manage Other Admin
  - Manage All Users
  
- **Customized Sidebar**:
  - Role based sidebar to enhance easy accessibility

- **Reporting & Analytics**:
  - Project completion rate dashboards
  - Supervisor workload metrics
  - Student performance analytics
  - Custom report generation

### 4. System Enhancements
- **Authentication**:
  - Add an email verfification
  - Add a forget password

- **Notification System**:
  - Apply notifications on most phases
  - Real-time notifications
  - Email/SMS reminders for deadlines
  - Customizable notification preferences

- **Mobile Support**:
  - Responsive design improvements

- **Project phases Enhancement**:
  - Add a Calendar to set a deadline

### 5. Integration
   - Integrate the system with the firebase

### 9. Deployment & Scalability
- Deploy the Project
- Provide a link of the Deployment

---

## Contact

For questions or support, please contact:
- [Khawla Ahmed](mailto:kvenus192@gmail.com)
- [Project Repository](https://github.com/Khawla192/a-smart-senior-projects-management-system)
