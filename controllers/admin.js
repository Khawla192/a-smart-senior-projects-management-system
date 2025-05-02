const express = require('express');
const router = express.Router();

const User = require('./../models/user');

router.get('/dashboard', async (req, res, next) => {
  try {
    // For debbing
    console.log("Dashboard route is working!");
    console.log('Session user:', req.session.user);
    
    if (!req.session.user) {
      console.log('No session - redirecting to login');
      return res.redirect('/auth/sign-in');
    }

    if (req.session.user.role !== 'admin') {
      console.log('User is not a student - redirecting');
      return res.redirect('/');
    }

    const currentUser = await User.findById(req.session.user._id)

    if (!currentUser) {
      console.log('User not found in DB');
      return res.redirect('/auth/sign-in');
    }

    console.log('Rendering dashboard for:', currentUser.email);
    res.render('admin/dashboard', {
      user: currentUser,
      projects: currentUser.studentData?.projects || []
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    next(error);
  }
});

module.exports = router;