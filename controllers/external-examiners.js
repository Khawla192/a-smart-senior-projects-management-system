const express = require('express');
const router = express.Router();

const User = require('./../models/user');
const Project = require('./../models/project');


router.get('/dashboard', async (req, res, next) => {
  try {
    console.log("Dashboard route is working!");
    console.log('Session user:', req.session.user);
    
    if (!req.session.user) {
      console.log('No session - redirecting to login');
      return res.redirect('/auth/sign-in');
    }

    // Check for external examiner role
    if (req.session.user.role?.type !== 'external_examiner') {
      console.log('User is not an external examiner - redirecting');
      return res.redirect('/');
    }

    const currentUser = await User.findById(req.session.user._id);

    if (!currentUser) {
      console.log('User not found in DB');
      return res.redirect('/auth/sign-in');
    }

    // Get counts for dashboard
    let assignedProjectsCount = 0;
    let pendingEvaluationsCount = 0;
    let completedEvaluationsCount = 0;

    try {
      // Get projects where the user is an evaluator
      const projects = await Project.find({
        evaluators: req.session.user._id,
        status: { $in: ['in_progress', 'completed'] }
      });

      assignedProjectsCount = projects.length;
      
      if (assignedProjectsCount > 0) {
        // Get project IDs for further queries
        const projectIds = projects.map(p => p._id);
        
        pendingEvaluationsCount = await Evaluation.countDocuments({
          project: { $in: projectIds },
          examiner: { $ne: req.session.user._id }
        });
        
        completedEvaluationsCount = await Evaluation.countDocuments({
          project: { $in: projectIds },
          examiner: req.session.user._id
        });
      }
    } catch (dbError) {
      console.error('Error counting projects:', dbError);
    }

    console.log('Rendering dashboard for:', currentUser.email);
    res.render('external-examiners/dashboard', {
      user: currentUser,
      assignedProjectsCount,
      pendingEvaluationsCount,
      completedEvaluationsCount
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/external-examiners/dashboard?error=load-failed');
  }
});

// Assigned Projects - GET
router.get('/assigned-projects', async (req, res) => {
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

    res.render('external-examiners/assigned-projects', {
      projects: transformedProjects,
      user: req.user // Pass user data if needed
    });
  } catch (error) {
    console.error('Error loading assigned projects:', error);
    res.redirect('/external-examiners/dashboard?error=load-failed');
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
      return res.redirect('/external-examiners/assigned-projects?error=project-not-found');
    }

    // Check authorization
    const isEvaluator = project.evaluators?.some(e => e.equals(req.session.user._id));
    const isSupervisor = project.supervisors?.some(s => s._id.equals(req.session.user._id));

    if (!isEvaluator && !isSupervisor) {
      return res.redirect('/external-examiners/assigned-projects?error=not-authorized');
    }

    // Get existing evaluation if it exists
    const evaluation = project.evaluations?.length > 0 ? project.evaluations[0] : null;

    res.render('external-examiners/evaluation-form', {
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
    res.redirect('/external-examiners/assigned-projects?error=load-failed');
  }
});

// POST evaluation submission
router.post('/evaluate/:projectId', async (req, res) => {
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
      return res.redirect(`/external-examiners/evaluate/${req.params.projectId}?error=All+fields+are+required`);
    }

    // Validate grade format
    const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];
    if (!validGrades.includes(finalGrade)) {
      return res.redirect(`/external-examiners/evaluate/${req.params.projectId}?error=Invalid+grade+selection`);
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

    res.redirect(`/external-examiners/evaluate/${req.params.projectId}?success=Evaluation+submitted+successfully`);
  } catch (error) {
    console.error('Error submitting evaluation:', error);
    
    let errorMessage = 'Evaluation+failed';
    if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(err => err.message).join('+');
    } else if (error.code === 11000) {
      errorMessage = 'You+have+already+submitted+an+evaluation+for+this+project';
    }
    
    res.redirect(`/external-examiners/evaluate/${req.params.projectId}?error=${errorMessage}`);
  }
});

module.exports = router;