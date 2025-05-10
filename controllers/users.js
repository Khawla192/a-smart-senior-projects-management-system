const express = require('express');
const router = express.Router();
const User = require('./../models/user');
const Project = require('./../models/project');
const Contact = require('./../models/contact');
const Notification = require('./../models/notification');

// Middleware to verify user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/sign-in');
    }
    next();
};

// Unified Profile Routes
router.route('/profile')
    .get(requireAuth, async (req, res) => {
        try {
            const user = await User.findById(req.session.user._id);
            res.render('shared/profile', {
                user,
                error: req.query.error,
                success: req.query.success
            });
        } catch (error) {
            console.error('Profile error:', error);
            res.redirect('/?error=profile-load-failed');
        }
    })
    .put(requireAuth, async (req, res) => {
        try {
            const { firstName, lastName, phone, id } = req.body;

            const updateData = {
                firstName,
                lastName,
                phone
            };

            // Handle role-specific fields
            if (req.session.user.role === 'student') {
                updateData.id = id;
            }

            await User.findByIdAndUpdate(req.session.user._id, updateData);
            res.redirect('/profile?success=profile-updated');
        } catch (error) {
            console.error('Update profile error:', error);
            res.redirect('/profile?error=update-failed');
        }
    });

// Send notification
const sendNotification = async (userId, message, link = '#') => {
    await Notification.create({ user: userId, message, link });
};

// Notification page
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.session.user._id })
            .sort('-createdAt');

        res.render('shared/notifications', { notifications });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
});


// Contact Form
router.get('/contact', async (req, res) => {
    if (!req.session.user) return res.redirect('/auth/sign-in');

    try {
        // Get all potential recipients
        const recipients = await User.find({ _id: { $ne: req.session.user._id } })
            .select('firstName lastName email role');

        // Get all messages involving this user
        const messages = await Contact.find({
            $or: [
                { sender: req.session.user._id },
                { recipient: req.session.user._id }
            ]
        })
            .populate('sender', 'firstName lastName')
            .populate('recipient', 'firstName lastName')
            .sort('-createdAt');

        res.render('shared/contact', {
            user: req.session.user,
            recipients,
            messages,
            error: req.query.error,
            success: req.query.success
        });
    } catch (err) {
        console.error('Contact error:', err);
        res.redirect('/?error=contact-error');
    }
});

// Send New Message
router.post('/contact', async (req, res) => {
    if (!req.session.user) return res.redirect('/auth/sign-in');

    try {
        await Contact.create({ // Changed from Message to Contact
            sender: req.session.user._id,
            recipient: req.body.recipient,
            subject: req.body.subject,
            body: req.body.message
        });

        // Add notification
        await sendNotification(
            req.body.recipient,
            `New message from ${req.session.user.firstName}`,
            '/messages'
        );

        res.redirect('/contact?success=Message sent');
    } catch (err) {
        console.error('Send error:', err);
        res.redirect('/contact?error=Send failed');
    }
});

// Reply to Message
router.post('/contact/reply/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/auth/sign-in');

    try {
        const original = await Contact.findById(req.params.id); // Changed from Message to Contact
        if (!original) return res.redirect('/contact?error=Original message not found');

        await Contact.create({ // Changed from Message to Contact
            sender: req.session.user._id,
            recipient: original.sender._id.equals(req.session.user._id)
                ? original.recipient
                : original.sender,
            subject: `Re: ${original.subject}`,
            body: req.body.reply,
            parentMessage: original._id
        });

        res.redirect('/contact?success=Reply sent');
    } catch (err) {
        console.error('Reply error:', err);
        res.redirect('/contact?error=Reply failed');
    }
});

module.exports = router;