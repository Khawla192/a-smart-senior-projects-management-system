const express = require('express');
const router = express.Router();

const User = require('./../models/user');
const Project = require('./../models/project');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 },// 25MB
});

// Dashboard Route
router.get('/dashboard', async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/sign-in');
    }

    const user = await User.findById(req.session.user._id)
      .populate({
        path: 'projects.asStudent',
        match: { status: { $ne: 'rejected' } }
      })
      .populate({
        path: 'projects.asTeamMember',
        match: { status: { $ne: 'rejected' } }
      });

    // Initialize projects if they don't exist
    if (!user.projects) {
      user.projects = {
        asStudent: [],
        asTeamMember: []
      };
    }

    // Check length safely
    const hasProject = (user.projects.asStudent && user.projects.asStudent.length > 0) || 
                      (user.projects.asTeamMember && user.projects.asTeamMember.length > 0);

    res.render('students/dashboard', {
      user,
      hasProject,
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    next(error);
  }
});

// View proposed projects
router.get('/projects/proposed-projects', async (req, res) => {
  try {
    const student = await User.findById(req.session.user._id)
      .populate({
        path: 'projects.asStudent',
        match: { status: { $ne: 'rejected' } }
      })
      .populate({
        path: 'projects.asTeamMember',
        match: { status: { $ne: 'rejected' } }
      });

    // Check if student already has an approved/assigned project
    const hasProject = student.projects.asStudent.some(p => ['approved', 'assigned', 'in_progress'].includes(p.status)) ||
      student.projects.asTeamMember.some(p => ['approved', 'assigned', 'in_progress'].includes(p.status));

    // Get available projects
    const availableProjects = await Project.find({
      status: 'available',
      $or: [
        { isStudentIdea: false }, // Supervisor-created projects
        {
          isStudentIdea: true,
          $nor: [
            { ideaSubmittedBy: req.session.user._id }, // Not their own rejected ideas
            { 'teamMembers.member': req.session.user._id } // Not their team's rejected ideas
          ]
        }
      ]
    })
      .populate('supervisors', 'email firstName lastName')
      .populate('selectedStudent', 'email firstName lastName')
      .populate('ideaSubmittedBy', 'email firstName lastName');

    // Get the student's rejected projects (if any)
    const rejectedProjects = await Project.find({
      status: 'available',
      isStudentIdea: true,
      $or: [
        { ideaSubmittedBy: req.session.user._id },
        { 'teamMembers.member': req.session.user._id }
      ],
      rejectionReason: { $exists: true }
    })
      .populate('supervisors', 'email firstName lastName');

    res.render('students/projects/proposed-projects', {
      projects: availableProjects,
      rejectedProjects,
      student: req.session.user,
      hasProject,
      error: req.query.error,
      success: req.query.success,
    });
  } catch (error) {
    console.error('Error loading proposed projects:', error);
    res.redirect('/students/dashboard?error=load-projects-failed');
  }
});

// Apply for project
router.post('/projects/apply-project', async (req, res) => {
  try {
    const { projectId, studentId } = req.body;
    
    // Validate input
    if (!projectId || !studentId) {
      return res.redirect('/students/projects/proposed-projects?error=missing-parameters');
    }

    // Check if student already has a pending/approved project
    const hasProject = await Project.findOne({
      $or: [
        { selectedStudent: studentId, status: { $in: ['pending', 'approved', 'in_progress'] } },
        { 'teamMembers.member': studentId, status: { $in: ['pending', 'approved', 'in_progress'] } }
      ]
    });

    if (hasProject) {
      return res.redirect('/students/projects/proposed-projects?error=already-has-project');
    }

    // Update project status and add applicant
    await Project.findByIdAndUpdate(projectId, {
      $set: { status: 'pending', selectedStudent: studentId },
      $push: { applicants: { student: studentId, appliedAt: new Date() } }
    });

    // Add to student's projects
    await User.findByIdAndUpdate(studentId, {
      $addToSet: { 'projects.asStudent': projectId }
    });
    
    res.redirect('/students/projects/proposed-projects?success=application-submitted');
  } catch (error) {
    console.error('Application error:', error);
    res.redirect('/students/projects/proposed-projects?error=application-failed');
  }
});

// Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    // Verify student owns this project
    if (!project.selectedStudent.equals(req.session.user._id)) {
      return res.redirect('/students/projects/index?error=unauthorized');
    }

    // Only allow deletion if status is pending or rejected
    if (!['pending', 'rejected'].includes(project.status)) {
      return res.redirect('/students/projects/index?error=cannot-delete');
    }

    // Update project status back to available
    await Project.findByIdAndUpdate(req.params.id, {
      status: 'available',
      $pull: { applicants: { student: req.session.user._id } },
      selectedStudent: null
    });

    // Remove from student's projects
    await User.findByIdAndUpdate(req.session.user._id, {
      $pull: { 'projects.asStudent': req.params.id }
    });

    res.redirect('/students/projects/index?success=project-deleted');
  } catch (error) {
    console.error('Delete project error:', error);
    res.redirect('/students/projects/index?error=delete-failed');
  }
});

// Add route to view project status
router.get('/projects/my-project', async (req, res) => {
  try {
    const student = await User.findById(req.session.user._id)
      .populate({
        path: 'projects.asStudent',
        populate: [
          { path: 'supervisors', select: 'firstName lastName email' },
          { path: 'selectedStudent', select: 'firstName lastName email' }
        ]
      });

    if (student.projects.asStudent.length === 0) {
      return res.redirect('/students/projects/proposed-projects');
    }

    const project = student.projects.asStudent[0];
    res.render('students/projects/my-project', { project });
  } catch (error) {
    console.error('My project error:', error);
    res.redirect('/students/dashboard?error=load-project-failed');
  }
});

// Project Ideas Submission form
router.get('/projects/project-ideas', async (req, res) => {
  try {
    const [students, supervisors] = await Promise.all([
      User.find({ 'role.type': 'student' })
        .select('_id email firstName lastName')
        .lean(),
      User.find({ 'role.type': 'supervisor' })
        .select('_id email firstName lastName')
        .lean()
    ]);

    res.render('students/projects/new', {
      students,
      supervisors,
      user: req.session.user,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading idea form:', error);
    res.redirect('/students/dashboard?error=load-form-failed');
  }
});

// Handle idea submission
router.post('/projects/project-ideas', async (req, res) => {
  try {
    const { title, description, teamMembers, mainSupervisor, coSupervisor } = req.body;
    const studentId = req.session.user._id;

    // Validate required fields
    if (!title || !description || !mainSupervisor) {
      return res.redirect('/students/projects/project-ideas?error=missing-fields');
    }

    // Convert teamMembers to array (handles both single and multiple selections)
    const teamMembersArray = teamMembers ?
      (Array.isArray(teamMembers) ? teamMembers : [teamMembers]) :
      [];

    // Validate team size (1-4 members excluding the leader)
    if (teamMembersArray.length < 1 || teamMembersArray.length > 4) {
      return res.redirect('/students/projects/project-ideas?error=invalid-team-size');
    }

    // Validate co-supervisor is different from main supervisor
    if (coSupervisor && coSupervisor === mainSupervisor) {
      return res.redirect('/students/projects/project-ideas?error=same-supervisors');
    }

    // Create project
    const newProject = new Project({
      title,
      description,
      supervisors: coSupervisor ? [mainSupervisor, coSupervisor] : [mainSupervisor],
      teamMembers: [
        { member: studentId, role: 'leader' },
        ...teamMembersArray.map(memberId => ({ member: memberId, role: 'member' }))
      ],
      status: 'pending',
      isStudentIdea: true,
      ideaSubmittedBy: studentId
    });

    await newProject.save();

    // Update team members' projects
    await User.updateMany(
      { _id: { $in: teamMembersArray } },
      { $addToSet: { 'projects.asTeamMember': newProject._id } }
    );

    // Update submitter's projects
    await User.findByIdAndUpdate(studentId, {
      $addToSet: { 'projects.asStudent': newProject._id }
    });

    res.redirect('/students/projects/index?success=idea-submitted');

  } catch (error) {
    console.error('Project idea submission error:', error);
    res.redirect('/students/projects/project-ideas?error=submission-failed');
  }
});

// GET route to display edit form
router.get('/projects/edit/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('teamMembers.member', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email');

    // Verify student is the owner of this idea
    if (!project.ideaSubmittedBy.equals(req.session.user._id)) {
      return res.redirect('/students/projects?error=unauthorized');
    }

    // Get all students and supervisors for dropdowns
    const [students, supervisors] = await Promise.all([
      User.find({ 'role.type': 'student' }).select('firstName lastName email'),
      User.find({ 'role.type': 'supervisor' }).select('firstName lastName email')
    ]);

    res.render('students/projects/edit', {
      project,
      students,
      supervisors,
      user: req.session.user,
      error: req.query.error
    });
  } catch (error) {
    console.error('Edit project error:', error);
    res.redirect(`/students/projects/${req.params.id}?error=load-edit-failed`);
  }
});

// PUT route to handle project update
router.put('/projects/:id', async (req, res) => {
  try {
    const { title, description, teamMembers, mainSupervisor, coSupervisor } = req.body;
    const projectId = req.params.id;
    const studentId = req.session.user._id;

    // Get current project to verify ownership
    const currentProject = await Project.findById(projectId);
    if (!currentProject.ideaSubmittedBy.equals(studentId)) {
      return res.redirect('/students/projects?error=unauthorized');
    }

    // Convert teamMembers to array
    const teamMembersArray = Array.isArray(teamMembers) ? teamMembers : [teamMembers];

    // Prepare supervisors array
    const supervisors = [mainSupervisor];
    if (coSupervisor) supervisors.push(coSupervisor);

    // Update project
    await Project.findByIdAndUpdate(projectId, {
      title,
      description,
      supervisors,
      teamMembers: [
        { member: studentId, role: 'leader' },
        ...teamMembersArray.map(memberId => ({ member: memberId, role: 'member' }))
      ]
    });

    // Update team members' projects
    await User.updateMany(
      { _id: { $in: teamMembersArray } },
      { $addToSet: { 'projects.asTeamMember': projectId } }
    );

    // Remove from old team members who are no longer in the team
    const oldTeamMembers = currentProject.teamMembers
      .map(m => m.member.toString())
      .filter(id => id !== studentId && !teamMembersArray.includes(id));

    if (oldTeamMembers.length > 0) {
      await User.updateMany(
        { _id: { $in: oldTeamMembers } },
        { $pull: { 'projects.asTeamMember': projectId } }
      );
    }

    res.redirect(`/students/projects/${projectId}?success=project-updated`);
  } catch (error) {
    console.error('Update project error:', error);
    res.redirect(`/students/projects/edit/${req.params.id}?error=update-failed`);
  }
});

// View student's projects (both submitted and selected)
router.get('/projects/index', async (req, res) => {
  try {
    const student = await User.findById(req.session.user._id)
      .populate({
        path: 'projects.asStudent',
        match: {
          $or: [
            { isStudentIdea: true },
            { selectedStudent: req.session.user._id }
          ]
        },
        populate: [
          { path: 'supervisors', select: 'firstName lastName email' },
          { path: 'teamMembers.member', select: 'firstName lastName email' },
          { path: 'ideaSubmittedBy', select: 'firstName lastName email' }
        ]
      })
      .populate({
        path: 'projects.asTeamMember',
        populate: [
          { path: 'supervisors', select: 'firstName lastName email' },
          { path: 'teamMembers.member', select: 'firstName lastName email' },
          { path: 'ideaSubmittedBy', select: 'firstName lastName email' }
        ]
      });

    // Filter out null values and combine projects
    const allProjects = [
      ...student.projects.asStudent.filter(p => p !== null),
      ...student.projects.asTeamMember
    ];

    res.render('students/projects/index', {
      projects: allProjects,
      student: req.session.user,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Project process error:', error);
    res.redirect('/students/dashboard?error=load-projects-failed');
  }
});

// View single project details
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('supervisors', 'firstName lastName email username')
      .populate('teamMembers.member', 'firstName lastName email username')
      .populate('selectedStudent', 'firstName lastName email username')
      .populate('ideaSubmittedBy', 'firstName lastName email username');

    // Verify student has access to this project
    const student = await User.findById(req.session.user._id);
    if (!student.projects.asStudent.includes(project._id) &&
      !student.projects.asTeamMember.includes(project._id)) {
      return res.redirect('/students/projects?error=unauthorized-access');
    }

    res.render('students/projects/details', {
      project,
      isOwner: project.ideaSubmittedBy?.equals(student._id)
    });
  } catch (error) {
    console.error('Project details error:', error);
    res.redirect('/students/projects?error=load-project-failed');
  }
});

// GET Phases Page
router.get('/projects/phases/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('selectedStudent')
      .populate('supervisors')
      .populate('teamMembers.member');

    if (!project) {
      return res.redirect('/students/projects?error=project-not-found');
    }

    // Verify student access
    const student = await User.findById(req.session.user._id);
    const isTeamMember = project.teamMembers.some(member => 
      member.member._id.equals(student._id)
    );

    if (!student.projects.asStudent.includes(project._id) && !isTeamMember) {
      return res.redirect('/students/projects?error=unauthorized-access');
    }

    res.render('students/projects/phases/index', {
      project,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Phases error:', error);
    res.redirect('/students/projects?error=phases-error');
  }
});

// POST Submit Phase
router.post('/projects/phases/:id', upload.single('file'), async (req, res) => {
  try {
    const { phase, note } = req.body;
    const projectId = req.params.id;
    const studentId = req.session.user._id;

    if (!phase) {
      return res.redirect(`/students/projects/phases/${projectId}?error=phase-required`);
    }

    // Verify student access
    const student = await User.findById(studentId);
    const project = await Project.findById(projectId);
    const isTeamMember = project.teamMembers.some(member => 
      member.member.equals(studentId)
    );

    if (!student.projects.asStudent.includes(project._id) && !isTeamMember) {
      return res.redirect('/students/projects?error=unauthorized-access');
    }

    const updateData = {
      [`phases.${phase}.submittedAt`]: new Date(),
      [`phases.${phase}.submittedBy`]: studentId,
      [`phases.${phase}.note`]: note || ''
    };

    if (req.file) {
      updateData[`phases.${phase}.file`] = `/uploads/${req.file.filename}`;
    }

    await Project.findByIdAndUpdate(projectId, updateData);

    res.redirect(`/students/projects/phases/${projectId}?success=phase-submitted`);
  } catch (error) {
    console.error('Submit phase error:', error);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.redirect(`/students/projects/phases/${projectId}?error=submission-failed`);
  }
});

module.exports = router;