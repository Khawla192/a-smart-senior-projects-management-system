const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const User = require('./../models/user');

router.get('/sign-up', (req, res) => {
  res.render('auth/sign-up.ejs');
});

router.get('/sign-in', (req, res) => {
  res.render('auth/sign-in.ejs');
});

router.get('/sign-out', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

router.post('/sign-up', async (req, res) => {
  try {
    const emailExists = await User.findOne({ email: req.body.email });
    if (emailExists) {
      return res.render('auth/sign-up.ejs', {
        error: 'Email already registered'
      });
    }

    // Check password match
    if (req.body.password !== req.body.confirmPassword) {
      return res.render('auth/sign-up.ejs', {
        error: 'Passwords do not match'
      });
    }

    // Check if the username is already taken
    const userInDatabase = await User.findOne({ username: req.body.username });
    if (userInDatabase) {
      return res.send('Username already taken.');
    }

    // Check if the email is already taken
    const emailInDatabase = await User.findOne({ email: req.body.email });
    if (emailInDatabase) {
      return res.send('Email already registered.');
    }

    // Check if the password and confirm password match
    if (req.body.password !== req.body.confirmPassword) {
      return res.send('Password and Confirm Password must match');
    }

    // Create user with role determined by email domain
    const newUser = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: { type: 'student' }
    };

    const createdUser = await User.create(newUser);

    req.session.user = {
      email: createdUser.email,
      username: createdUser.username,
      _id: createdUser._id,
      role: createdUser.role.type
    };

    res.redirect('/');
  } catch (error) {
    console.log(error);
    res.redirect('/');
  }
});

router.post('/sign-in', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).render('auth/sign-in.ejs', {
        error: 'Email and password are required',
        formData: { email }
      });
    }

    // Find user by email (include password)
    const userInDatabase = await User.findOne({ email: req.body.email }).select('+password');

    if (!userInDatabase) {
      return res.status(401).render('auth/sign-in.ejs', {
        error: 'Invalid email or password',
        formData: { email }
      });
    }

    // Compare passwords using the model method
    const validPassword = await userInDatabase.comparePassword(password);
    if (!validPassword) {
      return res.status(401).render('auth/sign-in.ejs', {
        error: 'Invalid email or password',
        formData: { email }
      });
    }

    // Successful login
    req.session.user = {
      email: userInDatabase.email,
      username: userInDatabase.username,
      _id: userInDatabase._id,
      role: userInDatabase.role.type,
    };

    res.redirect('/');
  } catch (error) {
    console.log(error);
    res.redirect('/');
  }
});

module.exports = router;
