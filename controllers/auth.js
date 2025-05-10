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

// router.get('/sign-out', (req, res) => {
//   req.session.destroy();
//   res.redirect('/');
// });
router.get('/sign-out', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.redirect('/');
    }
    
    // Clear session cookie
    res.clearCookie('connect.sid');
    console.log('User successfully signed out');
    res.redirect('/auth/sign-in');
  });
});

router.post('/sign-up', async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body;
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

     // Validate input
     if (!email || !username || !password || !confirmPassword) {
      return res.status(400).render('auth/sign-up.ejs', {
        error: 'All fields are required',
        formData: req.body,
      });
    };

    // Check if the username is already taken
    const userInDatabase = await User.findOne({ username });
    if (userInDatabase) {
      return res.render('auth/sign-up.ejs', {
        error: 'Username already taken',
        formData: { email }
      });
    };

    // Check if the email is already taken
    const emailInDatabase = await User.findOne({ email });
    if (emailInDatabase) {
      return res.render('auth/sign-up.ejs', {
        error: 'Email already registered',
        formData: { username },
      });
    };

    // Check if the password and confirm password match
    if (password !== confirmPassword) {
      return res.render('auth/sign-up.ejs', {
        error: 'Passwords do not match',
        formData: { email, username },
      });
    };

    // Create user with role determined by email domain
    const newUser = {
      username,
      email,
      password: hashedPassword,
      role: { type: 'student' },
      // role: { type: email.endsWith('@stu.uob.edu.bh') ? 'student' : 'supervisor' }
    };

    const createdUser = await User.create(newUser);
    console.log('Created user:', createdUser);

    req.session.user = {
      email: createdUser.email,
      username: createdUser.username,
      _id: createdUser._id,
      // role: createdUser.role.type,
      role: {
        type: userInDatabase.role.type,
      }
    };

    return res.redirect('/');
  } catch (error) {
    console.error('Sign-up error:', error);
    return res.status(500).render('auth/sign-up.ejs', {
      error: 'Registration failed. Please try again.',
      formData: req.body
    });
  }
});

router.post('/sign-in', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Sign-in attempt for:', email);

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
    const isMatch = await bcrypt.compare(password, userInDatabase.password);

    if (!isMatch) {
      // Debug: Show what the hash would be for the provided password
      const testSalt = await bcrypt.genSalt(12);
      const testHash = await bcrypt.hash(password, testSalt);
      console.log('Test hash with input password:', testHash);
      
      return res.status(401).render('auth/sign-in.ejs', {
        error: 'Invalid credentials',
        formData: { email }
      });
    }

    // Successful login
    req.session.user = {
      email: userInDatabase.email,
      username: userInDatabase.username,
      _id: userInDatabase._id,
      // role: userInDatabase?.role.type,
      role: {
        type: userInDatabase.role.type,
      },
    };
    // For debgging
    console.log('User session set:', req.session);

    return res.redirect('/');
  } catch (error) {
    console.error('Sign-in error:', error);
    return res.status(500).render('auth/sign-in.ejs', {
      error: 'An error occurred during sign-in',
      formData: { email: req.body.email },
    });
  }
});

module.exports = router;
