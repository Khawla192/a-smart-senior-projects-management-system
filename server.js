require('dotenv').config();
require('./config/database.js');

const express = require('express');
const app = express();

const mongoose = require('mongoose');
const methodOverride = require('method-override');
const morgan = require('morgan');
const session = require('express-session');

// require the Controllers
const authController = require('./controllers/auth.js');

const port = process.env.PORT ? process.env.PORT : '3000';

// MIDDLEWARE
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
// app.use(morgan('dev'));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);


//ROUTES
// PUBLIC ROUTES
app.get('/', (req, res) => {
  res.render('index.ejs', {
    user: req.session.user,
  });
});

// PROTECTED ROUTES
app.use('/auth', authController);

// LISTENER
app.listen(port, () => {
  console.log(`The express app is ready on port ${port}!`);
});
