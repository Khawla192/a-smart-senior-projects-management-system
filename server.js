require('dotenv').config();
require('./config/database.js');

const express = require('express');
const path = require('path');
const app = express();
const fs = require('fs');

const mongoose = require('mongoose');
const methodOverride = require('method-override');
const morgan = require('morgan');
const session = require('express-session');

// require the middleware!
const isSignedIn = require('./middleware/is-signed-in.js');
const passUserToView = require('./middleware/pass-user-to-view.js');

// require the Controllers
const authController = require('./controllers/auth.js');
const studentsController = require('./controllers/students.js');
const adminController = require('./controllers/admin.js');
const supervisorController = require('./controllers/supervisors.js');
const externalExaminersController = require('./controllers/external-examiners.js');
const usersController = require('./controllers/users');

const port = process.env.PORT ? process.env.PORT : '3000';

const uploadsDir = path.join(__dirname, 'uploads');

// MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
// app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/uploads', express.static(uploadsDir));
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
};

app.use(morgan('dev'));
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
app.use(passUserToView);

//ROUTES
// PUBLIC ROUTES
// app.get('/', async (req, res) => {
//   try {
//     if (req.session.user) {
//       // Redirect based on user role
//       switch(req.session.user.role) {
//         case 'student':
//           return res.redirect('/students/dashboard');
//         case 'supervisor':
//           return res.redirect('/supervisors/dashboard');
//         case 'admin':
//           return res.redirect('/admin/dashboard');
//         case 'external-examiner':
//           return res.redirect('/external-examiners/dashboard');
//         default:
//           return res.redirect('/auth/sign-in');
//       }
//     } else {
//       res.render('index.ejs', {
//         user: req.session.user,
//       });
//     }
//   } catch (error) {
//     console.error('Root route error:', error);
//     res.redirect('/auth/sign-in');
//   }
// });
app.get('/', async (req, res) => {
  try {
    if (req.session.user) {
      // Safely get role type (handles both old and new formats)
      const roleType = typeof req.session.user.role === 'string' 
        ? req.session.user.role 
        : req.session.user.role?.type;

      // Redirect based on user role
      switch(roleType) {
        case 'student':
          return res.redirect('/students/dashboard');
        case 'supervisor':
          return res.redirect('/supervisors/dashboard');
        case 'admin':
          return res.redirect('/admin/dashboard');
        case 'external_examiner':
          return res.redirect('/external-examiners/dashboard');
        default:
          return res.redirect('/auth/sign-in');
      }
    } else {
      res.render('index.ejs', {
        user: req.session.user,
      });
    }
  } catch (error) {
    console.error('Root route error:', error);
    res.redirect('/auth/sign-in');
  }
});

// PROTECTED ROUTES
app.use('/auth', authController);
app.use(isSignedIn);
app.use('/', usersController);
app.use('/students', studentsController);
app.use('/admin', adminController);
app.use('/supervisors', supervisorController);
app.use('/external-examiners', externalExaminersController);

// LISTENER
app.listen(port, () => {
  console.log(`The express app is ready on port ${port}!`);
});
