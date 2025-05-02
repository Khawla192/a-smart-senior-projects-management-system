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
    const { email, username, password, confirmPassword } = req.body;
    const hashedPassword = await bcrypt.hash(req.body.password, 12);

    // Check if the username is already taken
    const userInDatabase = await User.findOne({ username });
    if (userInDatabase) {
      return res.send('Username already taken.');
    };

    // Check if the email is already taken
    const emailInDatabase = await User.findOne({ email });
    if (emailInDatabase) {
      return res.render('auth/sign-up.ejs', {
        error: 'Email already registered'
      });
    };

    // Check if the password and confirm password match
    if (password !== confirmPassword) {
      return res.render('auth/sign-up.ejs', {
        error: 'Passwords do not match'
      });
    };

    // Create user with role determined by email domain
    const newUser = {
      username,
      email,
      password: hashedPassword,
      role: { type: 'student' },
    };

    const createdUser = await User.create(newUser);

    req.session.user = {
      email: createdUser.email,
      username: createdUser.username,
      _id: createdUser._id,
      role: createdUser.role.type
    };

    return res.redirect('/');
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
    };

    // Find user by email (include password)
    const userInDatabase = await User.findOne({ email }).select('+password');
    
    if (!userInDatabase) {
      return res.status(401).render('auth/sign-in.ejs', {
        error: 'Invalid email or password',
        formData: { email }
      });
    };

    if (!userInDatabase.password) {
      console.error('No password hash found for user:', email);
      return res.status(500).render('auth/sign-in.ejs', {
        error: 'Authentication error',
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
    };

    // Successful login
    req.session.user = {
      email: userInDatabase.email,
      username: userInDatabase.username,
      _id: userInDatabase._id,
      role: userInDatabase?.role.type || 'unknown' ,
    };
    // For debgging
    console.log('User session set:', req.session);

    return res.redirect('/');
  } catch (error) {
    console.log(error);
    res.redirect('/');
  }
});

module.exports = router;
