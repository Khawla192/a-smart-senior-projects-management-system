const express = require('express');
const router = express.Router();

const User = require('./../models/user');
const Project = require('./../models/project');
const Evaluation = require('./../models/evaluation');
const committeeAssignment = require('../models/committee-assignment')

// Dashboard Route
router.get('/dashboard', async (req, res, next) => {
  try {
    // Debug logging
    console.log("Supervisor dashboard route is working!");
    console.log('Session user:', req.session.user);

    // Check authentication
    if (!req.session.user) {
      console.log('No session - redirecting to login');
      return res.redirect('/auth/sign-in');
    }

    // Get role type (handles both string and object formats)
    const roleType = typeof req.session.user.role === 'string' 
      ? req.session.user.role 
      : req.session.user.role?.type;

    // Verify either supervisor or admin role
    if (!['supervisor', 'admin'].includes(roleType)) {
      console.log(`Invalid role (${roleType}) - redirecting`);
      return res.redirect('/');
    }

    // Check if admin view is requested
    const isAdminView = req.query.admin === 'true' && roleType === 'admin';

    // Fetch user data with populated projects
    const user = await User.findById(req.session.user._id)
      .populate('projects.asSupervisor')
      .populate('projects.asExaminer');

    // Check if user exists
    if (!user) {
      console.log('User not found in DB');
      return res.redirect('/auth/sign-in');
    }

    // Count projects for cards
    const myProjectsCount = user.projects.asSupervisor.length;
    const assignedProjectsCount = user.projects.asExaminer.length;

    // Get additional admin data if in admin view
    let adminData = {};
    if (isAdminView) {
      adminData = {
        totalSupervisors: await User.countDocuments({ 'role.type': 'supervisor' }),
        totalProjects: await Project.countDocuments(),
        pendingApprovals: await Project.countDocuments({ status: 'pending' })
      };
    }

    // Render dashboard with appropriate view
    res.render(isAdminView ? 'admin/dashboard' : 'supervisors/dashboard', {
      user,
      isAdmin: isAdminView,
      myProjectsCount,
      assignedProjectsCount,
      ...adminData,
      error: req.query.error,
      success: req.query.success
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/auth/sign-in?error=dashboard-error');
  }
});

// // GET display the "Add Project" form
// router.get('/projects/new', async (req, res) => {
//   try {
//     if (!req.session.user || req.session.user.role !== 'supervisor') {
//       return res.redirect('/auth/sign-in');
//     }

//     const supervisor = await User.findById(req.session.user._id);

//     res.render('supervisors/projects/new', {
//       supervisor
//     });
//   } catch (error) {
//     console.error('Add project form error:', error);
//     res.redirect('/supervisors/dashboard?error=load-project-form-failed');
//   }
// });

// // POST add new project
// router.post('/projects/new', async (req, res) => {
//   try {
//     if (!req.session.user || req.session.user.role !== 'supervisor') {
//       if (req.accepts('json')) {
//         return res.status(401).json({ error: 'unauthorized' });
//       }
//       return res.redirect('/auth/sign-in');
//     }

//     const { title, description, department, supervisorId } = req.body;

//     const newProject = await Project.create({
//       title,
//       description,
//       department,
//       supervisors: supervisorId,
//       status: 'available',
//       createdAt: new Date(),
//     });

//     // Update supervisor's projects array
//     await User.findByIdAndUpdate(supervisorId, {
//       $push: { projects: newProject._id }
//     });

//     // Successful submission
//     return res.redirect('/supervisors/projects/show-all?success=project-added');

//   } catch (error) {
//     console.error('Add project error:', error);
    
//     let errorMessage = 'project-submission-failed';
//     if (error.name === 'ValidationError') {
//       errorMessage = 'validation-error';
//     } else if (error.name === 'BSONError') {
//       errorMessage = 'invalid-data-format';
//     }

//     return res.redirect(`/supervisors/projects/new?error=${errorMessage}`);
//   }
// });

router.get('/projects/new', async (req, res) => {
  try {
    // Debug logging to see what's in the session
    console.log('Session in /projects/new:', req.session);
    console.log('User role:', req.session.user?.role);

    if (!req.session.user) {
      console.log('No user session - redirecting to login');
      return res.redirect('/auth/sign-in');
    }

    // Get role type (handles both string and object formats)
    const roleType = typeof req.session.user.role === 'string' 
      ? req.session.user.role 
      : req.session.user.role?.type;

    // Verify either supervisor or admin role
    if (!['supervisor', 'admin'].includes(roleType)) {
      console.log(`Invalid role (${roleType}) - redirecting`);
      return res.redirect('/');
    }

    const supervisor = await User.findById(req.session.user._id);
    if (!supervisor) {
      return res.redirect('/auth/sign-in');
    }

    res.render('supervisors/projects/new', {
      supervisor
    });
  } catch (error) {
    console.error('Add project form error:', error);
    res.redirect('/supervisors/dashboard?error=load-project-form-failed');
  }
});

// POST add new project
router.post('/projects/new', async (req, res) => {
  try {
    // Same role check as GET route
    if (!req.session.user) {
      if (req.accepts('json')) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      return res.redirect('/auth/sign-in');
    }

    const roleType = typeof req.session.user.role === 'string' 
      ? req.session.user.role 
      : req.session.user.role?.type;

    if (!['supervisor', 'admin'].includes(roleType)) {
      if (req.accepts('json')) {
        return res.status(403).json({ error: 'forbidden' });
      }
      return res.redirect('/');
    }

    const { title, description, department, supervisorId } = req.body;

    // Verify the supervisorId matches the session user or user is admin
    if (roleType !== 'admin' && supervisorId !== req.session.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot create projects for other supervisors' });
    }

    const newProject = await Project.create({
      title,
      description,
      department,
      supervisors: supervisorId,
      status: 'available',
      createdAt: new Date(),
    });

    await User.findByIdAndUpdate(supervisorId, {
      $push: { projects: newProject._id }
    });

    return res.redirect('/supervisors/projects/show-all?success=project-added');
  } catch (error) {
    console.error('Add project error:', error);
    let errorMessage = 'project-submission-failed';
    if (error.name === 'ValidationError') {
      errorMessage = 'validation-error';
    } else if (error.name === 'BSONError') {
      errorMessage = 'invalid-data-format';
    }
    return res.redirect(`/supervisors/projects/new?error=${errorMessage}`);
  }
});

// GET view edit form
router.get('/projects/edit/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.redirect('/supervisors/projects/show-all?error=project-not-found');
    }
    res.render('supervisors/projects/edit', { project });
  } catch (error) {
    console.error('Edit project error:', error);
    res.redirect('/supervisors/projects/show-all?error=load-edit-failed');
  }
});

// PUT update project
router.put('/projects/:id', async (req, res) => {
  try {
    const { title, description, department, status } = req.body;

    await Project.findByIdAndUpdate(req.params.id, {
      title,
      description,
      department,
      status,
    });

    res.redirect('/supervisors/projects/show-all?success=project-updated');
  } catch (error) {
    console.error('Update project error:', error);
    res.redirect(`/supervisors/projects/edit/${req.params.id}?error=update-failed`);
  }
});

// Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.redirect('/supervisors/projects/show-all?success=project-deleted');
  } catch (error) {
    console.error('Delete project error:', error);
    res.redirect(`/supervisors/projects/${req.params.id}?error=delete-failed`);
  }
});

// View all My Projects List
router.get('/projects/show-all', async (req, res) => {
  try {
    const projects = await Project.find({
      supervisors: req.session.user._id,
      isStudentIdea: false,
    })
      .populate('selectedStudent', 'firstName lastName email')
      .populate('teamMembers.member', 'firstName lastName email')
      .populate('applicants.student', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.render('supervisors/projects/show-all', {
      projects,
      supervisor: req.session.user,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('My projects error:', error);
    res.redirect('/supervisors/dashboard?error=load-projects-failed');
  }
});

// project details route
router.get('/projects/details/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('supervisors', 'firstName lastName email')
      .populate('selectedStudent', 'firstName lastName email')
      .populate('applicants.student', 'firstName lastName email')
      .populate('teamMembers.member', 'firstName lastName email');

    if (!project) {
      return res.redirect('/supervisors/projects/show-all?error=project-not-found');
    }

    // Verify supervisor has access to this project
    if (!project.supervisors.some(s => s._id.equals(req.session.user._id))) {
      return res.redirect('/supervisors/dashboard?error=unauthorized-access');
    }

    res.render('supervisors/projects/details', {
      project,
      supervisor: req.session.user
    });
  } catch (error) {
    console.error('Project details error:', error);
    res.redirect('/supervisors/projects/show-all?error=load-project-failed');
  }
});

// applicants route
router.get('/projects/applicants', async (req, res) => {
  try {
    const supervisorId = req.session.user._id;

    // Get all relevant projects (pending, assigned, and rejected)
    const projects = await Project.find({
      $or: [
        { supervisors: supervisorId },
        { coSupervisors: supervisorId }
      ],
      $or: [
        { status: 'pending' },
        { status: 'assigned' },
        { status: 'rejected' }
      ]
    })
    .populate('applicants.student', 'firstName lastName email')
    .populate('selectedStudent', 'firstName lastName email')
    .populate('ideaSubmittedBy', 'firstName lastName email')
    .populate('teamMembers.member', 'firstName lastName email')
    .sort({ status: 1, createdAt: -1 }); // Sort by status then date

    return res.render('supervisors/projects/applicants', {
      projects: projects,
      supervisor: req.session.user,
      message: projects.length === 0 ? 
        'No student applications or submitted ideas found' : null
    });
  } catch (error) {
    console.error('Applicants error:', error);
    res.redirect('/supervisors/dashboard?error=load-applicants-failed');
  }
});

// View single student project
router.get('/projects/student-project/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('applicants.student', 'firstName lastName email')
      .populate('selectedStudent', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email')
      .populate('teamMembers.member', 'firstName lastName email')
      .populate('ideaSubmittedBy', 'firstName lastName email');

    if (!project) {
      return res.redirect('/supervisors/projects/applicants?error=project-not-found');
    }

    // Verify this is a valid project for the supervisor
    const isSupervisorProject = project.supervisors.some(s => s._id.equals(req.session.user._id));
    const isCoSupervisorProject = project.coSupervisors?.some(s => s.equals(req.session.user._id));

    if (!isSupervisorProject && !isCoSupervisorProject) {
      return res.redirect('/supervisors/projects/applicants?error=unauthorized-access');
    }

    res.render('supervisors/projects/student-project', {
      project: project,
      supervisor: req.session.user,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Error fetching student project:', error);
    res.redirect('/supervisors/projects/applicants?error=load-project-failed');
  }
});

// Approve student idea
router.post('/projects/approve-idea', async (req, res) => {
  try {
    const { projectId } = req.body;

    // Validate input
    if (!projectId) {
      return res.redirect('/supervisors/projects/applicants?error=missing-project-id');
    }

    const project = await Project.findById(projectId)
      .populate('ideaSubmittedBy')
      .populate('teamMembers.member');

    if (!project) {
      return res.redirect('/supervisors/projects/applicants?error=project-not-found');
    }

    // Verify authorization
    const isAuthorized = project.supervisors.some(s => s.equals(req.session.user._id)) || 
                       project.coSupervisors?.some(s => s.equals(req.session.user._id));
    if (!isAuthorized) {
      return res.redirect('/supervisors/projects/applicants?error=unauthorized-access');
    }

    // Validate project status
    if (project.status !== 'pending') {
      return res.redirect('/supervisors/projects/applicants?error=invalid-project-status');
    }

    // Update project status
    project.status = 'assigned';
    project.isStudentIdea = true;
    project.approvedAt = new Date();

    // Set selected student
    if (project.teamMembers?.length > 0) {
      const leader = project.teamMembers.find(m => m.role === 'leader');
      if (leader) {
        project.selectedStudent = leader.member._id;
      } else {
        return res.redirect('/supervisors/projects/applicants?error=no-team-leader');
      }
    } else {
      project.selectedStudent = project.ideaSubmittedBy._id;
    }

    await project.save();

    res.redirect('/supervisors/projects/applicants?success=idea-approved');

  } catch (error) {
    console.error('Error approving idea:', error);
    res.redirect('/supervisors/projects/applicants?error=approve-failed');
  }
});


// Reject student idea
router.post('/projects/reject-idea', async (req, res) => {
  try {
    const { projectId, reason } = req.body;

    if (!reason) {
      return res.redirect(`/supervisors/projects/student-project/${projectId}?error=reason-required`);
    }

    const project = await Project.findById(projectId)
      .populate('ideaSubmittedBy')
      .populate('teamMembers.member');

    if (!project) {
      return res.redirect('/supervisors/projects/applicants?error=project-not-found');
    }

    // Verify supervisor has permission
    const isSupervisor = project.supervisors.some(s => s.equals(req.session.user._id));
    const isCoSupervisor = project.coSupervisors?.some(s => s.equals(req.session.user._id));
    
    if (!isSupervisor && !isCoSupervisor) {
      return res.redirect('/supervisors/projects/applicants?error=unauthorized-access');
    }

    // Update the existing project instead of creating a new one
    project.status = 'rejected';
    project.rejectionReason = reason;
    project.rejectedAt = new Date();
    await project.save();

    res.redirect('/supervisors/projects/applicants?success=idea-rejected');
  } catch (error) {
    console.error('Error rejecting idea:', error);
    res.redirect('/supervisors/projects/applicants?error=reject-failed');
  }
});

// Approve Applicant route
router.post('/projects/approve-applicant', async (req, res) => {
  try {
    const { projectId, studentId } = req.body;

    // Validate input
    if (!projectId || !studentId) {
      return res.redirect(`/supervisors/projects/student-project/${projectId || ''}?error=missing-parameters`);
    }

    // Find and validate project
    const project = await Project.findById(projectId)
      .populate('applicants.student', '_id role.type')
      .populate('supervisors coSupervisors', '_id');

    if (!project) {
      return res.redirect('/supervisors/projects/applicants?error=project-not-found');
    }

    // Find and validate applicant
    const applicant = project.applicants.find(a => 
      a.student && a.student._id.toString() === studentId
    );

    if (!applicant) {
      return res.redirect(`/supervisors/projects/student-project/${projectId}?error=invalid-applicant`);
    }

    // Verify applicant is a student
    if (applicant.student.role.type !== 'student') {
      return res.redirect(`/supervisors/projects/student-project/${projectId}?error=invalid-applicant-role`);
    }

    // Update project and applicant status
    project.status = 'assigned';
    project.selectedStudent = studentId;
    project.approvedAt = new Date();
    
    // Update all applicants' statuses
    project.applicants.forEach(app => {
      app.status = app.student._id.toString() === studentId ? 'approved' : 'rejected';
    });

    await project.save();

    // Update student's project reference
    await User.findByIdAndUpdate(studentId, {
      $addToSet: { 'projects.asStudent': projectId }
    });

    res.redirect('/supervisors/projects/applicants?success=application-approved');

  } catch (error) {
    console.error('Approval error:', error);
    res.redirect(`/supervisors/projects/student-project/${req.body.projectId || ''}?error=approval-failed`);
  }
});

router.post('/projects/reject-applicant', async (req, res) => {
  try {
    const { projectId, studentId } = req.body;

    // Validate input
    if (!projectId || !studentId) {
      return res.redirect(`/supervisors/projects/student-project/${projectId || ''}?error=missing-parameters`);
    }

    // Find and validate project
    const project = await Project.findById(projectId)
      .populate('applicants.student', '_id role.type');

    if (!project) {
      return res.redirect('/supervisors/projects/applicants?error=project-not-found');
    }

    // Find and update applicant status
    const applicant = project.applicants.find(a => 
      a.student && a.student._id.toString() === studentId
    );

    if (!applicant) {
      return res.redirect(`/supervisors/projects/student-project/${projectId}?error=invalid-applicant`);
    }

    // Update applicant status
    applicant.status = 'rejected';
    applicant.rejectedAt = new Date();
    
    // Reset project status if it was previously assigned
    if (project.status === 'assigned' && project.selectedStudent?.toString() === studentId) {
      project.status = 'available';
      project.selectedStudent = null;
      
      // Remove project reference from student
      await User.findByIdAndUpdate(studentId, {
        $pull: { 'projects.asStudent': projectId }
      });
    }

    await project.save();

    res.redirect('/supervisors/projects/applicants?success=application-rejected');

  } catch (error) {
    console.error('Rejection error:', error);
    res.redirect(`/supervisors/projects/student-project/${req.body.projectId || ''}?error=rejection-failed`);
  }
});

// GET Phases
router.get('/projects/phases/:id', async (req, res) => {
  try {
    // First get the base project data
    const project = await Project.findById(req.params.id)
      .populate('selectedStudent')
      .populate('supervisors')
      .populate('coSupervisors')
      .lean(); // Convert to plain JS object

    if (!project) {
      return res.redirect('/supervisors/projects/applicants?error=project-not-found');
    }

    // Define all phases that need population
    const phases = [
      'proposal',
      'literatureReview',
      'planning',
      'design',
      'implementation',
      'presentation',
      'reportPaper',
      'poster'
    ];

    // Population promises for each phase
    const populationPromises = phases.map(phase => {
      const phasePath = `phases.${phase}`;
      return Project.populate(project, [
        { 
          path: `${phasePath}.submittedBy`,
          model: 'User',
          select: 'name email' 
        },
        {
          path: `${phasePath}.feedback.givenBy`,
          model: 'User',
          select: 'name email'
        }
      ]);
    });

    // Execute all population in parallel
    await Promise.all(populationPromises);

    res.render('supervisors/projects/phases/index', {
      project,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading project phases:', error);
    res.redirect('/supervisors/projects/applicants?error=server-error');
  }
});

// POST Phase Feedback
router.post('/projects/phases/feedback/:id', async (req, res) => {
  try {
    const { phase, comment } = req.body;
    const projectId = req.params.id;
    const supervisorId = req.session.user._id;

    // Add feedback to the specific phase
    await Project.findByIdAndUpdate(projectId, {
      $push: {
        [`phases.${phase}.feedback`]: {
          comment,
          givenBy: supervisorId,
          createdAt: new Date()
        }
      }
    });

    res.redirect(`/supervisors/projects/phases/${projectId}?success=feedback-added`);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.redirect(`/supervisors/projects/phases/${projectId}?error=feedback-failed`);
  }
});

// Assigned Projects - GET
router.get('/projects/assigned-projects', async (req, res) => {
  try {
    // Get projects where user is either evaluator or supervisor
    const projects = await Project.find({
      $or: [
        { evaluators: req.session.user._id },
        { supervisors: req.session.user._id }
      ],
      status: { $in: ['in_progress', 'completed'] }
    })
    .populate('selectedStudent', 'firstName lastName email username')
    .populate('ideaSubmittedBy', 'firstName lastName email username')
    .populate('supervisors', 'firstName lastName email')
    .populate({
      path: 'evaluations',
      match: { evaluator: req.session.user._id }
    });

    // Transform projects data for the view
    const transformedProjects = projects.map(p => {
      // Determine student information
      const student = p.selectedStudent || p.ideaSubmittedBy;
      const studentDisplay = student ? 
        `${student.email}` : 
        'No student assigned';

      // Check if evaluation exists
      const hasEvaluation = p.evaluations && p.evaluations.length > 0;

      return {
        ...p.toObject(),
        studentDisplay,
        hasEvaluation
      };
    });

    res.render('supervisors/projects/assigned-projects', {
      projects: transformedProjects,
      user: req.user // Pass user data if needed
    });
  } catch (error) {
    console.error('Error loading assigned projects:', error);
    res.redirect('/supervisors/dashboard?error=load-failed');
  }
});

// GET evaluation form
router.get('/projects/evaluate/:projectId', async (req, res) => {
  try {
    // Get the project with all necessary data
    const project = await Project.findById(req.params.projectId)
      .populate('selectedStudent', 'firstName lastName email username')
      .populate('ideaSubmittedBy', 'firstName lastName email username')
      .populate('supervisors', 'firstName lastName email')
      .populate('documents')
      .populate({
        path: 'evaluations',
        match: { evaluator: req.session.user._id }
      });

    if (!project) {
      return res.redirect('/supervisors/projects/assigned-projects?error=project-not-found');
    }

    // Check authorization
    const isEvaluator = project.evaluators?.some(e => e.equals(req.session.user._id));
    const isSupervisor = project.supervisors?.some(s => s._id.equals(req.session.user._id));

    if (!isEvaluator && !isSupervisor) {
      return res.redirect('/supervisors/projects/assigned-projects?error=not-authorized');
    }

    // Get existing evaluation if it exists
    const evaluation = project.evaluations?.length > 0 ? project.evaluations[0] : null;

    res.render('supervisors/projects/evaluation-form', {
      project: {
        ...project.toObject(),
        studentDisplay: project.selectedStudent ? 
          `${project.selectedStudent.email}` :
          project.ideaSubmittedBy ?
          `${project.ideaSubmittedBy.email}` :
          'No student assigned'
      },
      evaluation,
      error: req.query.error
    });

  } catch (error) {
    console.error('Error loading evaluation form:', error);
    res.redirect('/supervisors/projects/assigned-projects?error=load-failed');
  }
});

// POST evaluation submission
router.post('/projects/evaluate/:projectId', async (req, res) => {
  try {
    const { 
      codeQuality,
      researchDepth,
      documentationQuality,
      presentationQuality,
      finalGrade,
      overallFeedback
    } = req.body;

    // Validate required fields
    if (!codeQuality || !researchDepth || !documentationQuality || 
        !presentationQuality || !finalGrade || !overallFeedback) {
      return res.redirect(`/supervisors/projects/evaluate/${req.params.projectId}?error=All+fields+are+required`);
    }

    // Validate grade format
    const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];
    if (!validGrades.includes(finalGrade)) {
      return res.redirect(`/supervisors/projects/evaluate/${req.params.projectId}?error=Invalid+grade+selection`);
    }

    // Create/update evaluation
    const evaluationData = {
      project: req.params.projectId,
      evaluator: req.session.user._id,
      codeQuality: parseInt(codeQuality),
      researchDepth: parseInt(researchDepth),
      documentationQuality: parseInt(documentationQuality),
      presentationQuality: parseInt(presentationQuality),
      finalGrade,
      overallFeedback,
      evaluationDate: new Date()
    };

    // Upsert evaluation
    const evaluation = await Evaluation.findOneAndUpdate(
      { project: req.params.projectId, evaluator: req.session.user._id },
      evaluationData,
      { upsert: true, new: true, runValidators: true }
    );

    // Update project with evaluation reference if new
    if (evaluation.isNew) {
      await Project.findByIdAndUpdate(
        req.params.projectId,
        { $addToSet: { evaluations: evaluation._id } }
      );
    }

    // Check if all evaluations are complete
    const project = await Project.findById(req.params.projectId)
      .populate('evaluators');
    
    if (project.evaluators && project.evaluators.length > 0) {
      const evaluationCount = await Evaluation.countDocuments({
        project: req.params.projectId
      });
      
      if (evaluationCount >= project.evaluators.length) {
        await Project.findByIdAndUpdate(
          req.params.projectId,
          { status: 'completed', completedAt: new Date() }
        );
      }
    }

    res.redirect(`/supervisors/projects/evaluate/${req.params.projectId}?success=Evaluation+submitted+successfully`);
  } catch (error) {
    console.error('Error submitting evaluation:', error);
    
    let errorMessage = 'Evaluation+failed';
    if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(err => err.message).join('+');
    } else if (error.code === 11000) {
      errorMessage = 'You+have+already+submitted+an+evaluation+for+this+project';
    }
    
    res.redirect(`/supervisors/projects/evaluate/${req.params.projectId}?error=${errorMessage}`);
  }
});

module.exports = router;