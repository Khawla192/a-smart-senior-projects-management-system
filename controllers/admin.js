const express = require('express');
const router = express.Router();

const User = require('./../models/user');
const Project = require('./../models/project');
const CommitteeAssignment = require('./../models/committee-assignment');

router.get('/dashboard', async (req, res, next) => {
  try {
    console.log("Dashboard route is working!");
    console.log('Session user:', req.session.user);

    // Check if user is logged in
    if (!req.session.user) {
      console.log('No session - redirecting to login');
      return res.redirect('/auth/sign-in');
    }

    // Check if user is admin (updated to check role.type)
    if (!req.session.user.role || req.session.user.role.type !== 'admin') {
      console.log('User is not an admin - redirecting');
      return res.redirect('/');
    }

    // Get current user with populated data if needed
    const currentUser = await User.findById(req.session.user._id);
    if (!currentUser) {
      console.log('User not found in DB');
      return res.redirect('/auth/sign-in');
    }

    // Get statistics for admin dashboard
    const [totalSupervisors, totalProjects, pendingApprovals] = await Promise.all([
      User.countDocuments({ 'role.type': 'supervisor' }),
      Project.countDocuments(),
      Project.countDocuments({ status: 'pending' })
    ]);

    console.log('Rendering dashboard for admin:', currentUser.email);
    res.render('admin/dashboard', {
      user: currentUser,
      totalSupervisors,
      totalProjects,
      pendingApprovals,
      error: req.query.error,
      success: req.query.success
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    next(error);
  }
});

// Assign Committees - GET
router.get('/assign-committees', async (req, res) => {
  try {
    const [projects, supervisors, assignments] = await Promise.all([
      Project.find({ status: { $in: ['assigned', 'approved'] } })
        .populate('selectedStudent', 'firstName lastName email')
        .populate('ideaSubmittedBy', 'firstName lastName email'),
      User.find({ 'role.type': 'supervisor' }, 'firstName lastName email'),
      CommitteeAssignment.find({})
        .populate({
          path: 'project',
          populate: [
            { path: 'selectedStudent', select: 'firstName lastName email' },
            { path: 'ideaSubmittedBy', select: 'firstName lastName email' }
          ]
        })
        .populate('supervisors', 'firstName lastName email')
    ]);

    res.render('admin/assign-committees', {
      editing: false, // Add this line
      projects: projects.map(p => ({
        ...p.toObject(),
        studentName: p.selectedStudent ?
          `${p.selectedStudent.firstName} ${p.selectedStudent.lastName}` :
          (p.ideaSubmittedBy ? `${p.ideaSubmittedBy.email} ${p.ideaSubmittedBy.firstName} ${p.ideaSubmittedBy.lastName}` : 'No student assigned')
      })),
      supervisors,
      assignments: assignments.map(a => ({
        ...a.toObject(),
        project: {
          ...a.project.toObject(),
          studentName: a.project.selectedStudent ?
            `${a.project.selectedStudent.email} ${a.project.selectedStudent.firstName} ${a.project.selectedStudent.lastName}` :
            (a.project.ideaSubmittedBy ? `${a.project.ideaSubmittedBy.email} ${a.project.ideaSubmittedBy.firstName} ${a.project.ideaSubmittedBy.lastName}` : 'No student assigned')
        }
      }))
    });
  } catch (error) {
    console.error('Error loading committee assignment page:', error);
    res.redirect('/admin/dashboard?error=load-failed');
  }
});

// Assign Committees - POST
router.post('/assign-committees', async (req, res) => {
  try {
    const { projectId, supervisors, externalEvaluation } = req.body;

    const assignment = new CommitteeAssignment({
      project: projectId,
      supervisors: Array.isArray(supervisors) ? supervisors : [supervisors],
      externalEvaluation: externalEvaluation === 'on'
    });

    await assignment.save();

    // Update project with evaluators
    await Project.findByIdAndUpdate(projectId, {
      $addToSet: {
        evaluators: { $each: assignment.supervisors },
        supervisors: { $each: assignment.supervisors }
      },
      status: 'in_progress'
    });

    res.redirect('/admin/assign-committees?success=assignment-created');
  } catch (error) {
    console.error('Error assigning committee:', error);
    res.redirect('/admin/assign-committees?error=assignment-failed');
  }
});

// GET edit page
router.get('/assign-committees/edit/:id', async (req, res) => {
  try {
      const assignment = await CommitteeAssignment.findById(req.params.id)
          .populate('project', 'title selectedStudent')
          .populate('supervisors', 'firstName lastName email');

      if (!assignment) {
          return res.redirect('/admin/assign-committees?error=assignment-not-found');
      }

      const [projects, supervisors] = await Promise.all([
          Project.find({ status: { $in: ['assigned', 'approved'] } })
              .populate('selectedStudent', 'firstName lastName email')
              .populate('ideaSubmittedBy', 'firstName lastName email'),
          User.find({ 'role.type': 'supervisor' }, 'firstName lastName email')
      ]);

      res.render('admin/assign-committees', {
          editing: true,
          assignment,
          projects: projects.map(p => ({
              ...p.toObject(),
              studentName: p.selectedStudent ? 
                  `${p.selectedStudent.firstName} ${p.selectedStudent.lastName}` : 
                  (p.ideaSubmittedBy ? `${p.ideaSubmittedBy.firstName} ${p.ideaSubmittedBy.lastName} ${p.ideaSubmittedBy.email} ` : 'No student assigned')
          })),
          supervisors,
          assignments: [] // Empty since we're in edit mode
      });
  } catch (error) {
      console.error('Error loading edit page:', error);
      res.redirect('/admin/assign-committees?error=load-failed');
  }
});

// POST update assignment
router.post('/assign-committees/update/:id', async (req, res) => {
  try {
      const { projectId, supervisors, externalEvaluation } = req.body;
      
      const assignment = await CommitteeAssignment.findByIdAndUpdate(
          req.params.id,
          {
              supervisors: Array.isArray(supervisors) ? supervisors : [supervisors],
              externalEvaluation: externalEvaluation === 'on'
          },
          { new: true }
      );

      if (!assignment) {
          return res.redirect('/admin/assign-committees?error=assignment-not-found');
      }

      // Update project evaluators
      const project = await Project.findById(projectId);
      const currentEvaluators = project.evaluators || [];
      
      // Remove old evaluators not in new list
      const evaluatorsToRemove = currentEvaluators.filter(e => 
          !assignment.supervisors.includes(e)
      );
      
      // Add new evaluators not in old list
      const evaluatorsToAdd = assignment.supervisors.filter(s => 
          !currentEvaluators.includes(s)
      );

      await Project.findByIdAndUpdate(projectId, {
          $pull: { evaluators: { $in: evaluatorsToRemove } },
          $addToSet: { evaluators: { $each: evaluatorsToAdd } }
      });

      res.redirect('/admin/assign-committees?success=assignment-updated');
  } catch (error) {
      console.error('Error updating assignment:', error);
      res.redirect(`/admin/assign-committees/edit/${req.params.id}?error=update-failed`);
  }
});

// Delete Assignment
router.post('/assign-committees/delete/:id', async (req, res) => {
  try {
    const assignment = await CommitteeAssignment.findByIdAndDelete(req.params.id);

    if (assignment) {
      // Remove evaluators from project
      await Project.findByIdAndUpdate(assignment.project, {
        $pull: {
          evaluators: { $in: assignment.supervisors },
          supervisors: { $in: assignment.supervisors }
        }
      });
    }

    res.redirect('/admin/assign-committees?success=assignment-deleted');
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.redirect('/admin/assign-committees?error=delete-failed');
  }
});

module.exports = router;