const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const roleSchema = mongoose.Schema({
  type: {
    type: String,
    enum: ['student', 'admin', 'supervisor', 'external_examiner'],
    required: true,
  },
});

const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(v);
        },
        message: props => `${props.value} is not a valid email address!`
      },
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: [8, 'Password must be at least 8 characters long'],
    },
    role: {
      type: roleSchema,
    },
    id: {
      type: Number,
      required: false, 
    },
    firstName: String,
    lastName: String,
    phone: Number,

    // Add projects reference
    projects: {
      asStudent: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        validate: {
          validator: async function(v) {
            const project = await mongoose.model('Project').findById(v);
            return project && project.student.toString() === this._id.toString();
          },
          message: 'Project is not assigned to this student',
        },
      }],
      asTeamMember: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        validate: {
          validator: async function(v) {
            const project = await mongoose.model('Project').findById(v);
            return project && project.teamMembers.includes(this._id);
          },
          message: 'You are not a team member of this project',
        },
      }],
      asSupervisor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        validate: {
          validator: async function(v) {
            const project = await mongoose.model('Project').findById(v);
            return project && project.supervisors.includes(this._id);
          },
          message: 'You are not a supervisor of this project',
        },
      }],
      asExaminer: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        validate: {
          validator: async function(v) {
            const project = await mongoose.model('Project').findById(v);
            return project && project.externalExaminer?.toString() === this._id.toString();
          },
          message: 'You are not the examiner of this project'
        },
      }],
    },
    managedSupervisors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        return ret;
      }
    },
    toObject: {
      virtuals: true
    },
  }
);

// // Virtual for full name
// userSchema.virtual('fullName').get(function() {
//   return `${this.firstName} ${this.lastName}`;
// });

// Determine role based on email before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('email') && this.role.type) return next();
  
  const emailDomain = this.email.split('@')[1];
  
  if (emailDomain === 'stu.uob.edu.bh') {
    this.role = { type: 'student' };
  } else if (emailDomain === 'uob.edu.bh') {
    if (this.isNew) {
      const adminCount = await User.countDocuments({ 'role.type': 'admin' });
      this.role = { type: adminCount === 0 ? 'admin' : 'supervisor' };
    }
  } else {
    this.role = { type: 'external_examiner' };
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// Add project reference method
userSchema.methods.addProjectReference = async function(projectId, roleType) {
  const updateField = `projects.as${roleType.charAt(0).toUpperCase() + roleType.slice(1)}`;
  await this.updateOne({
    $addToSet: { [updateField]: projectId }
  });
};

// Query helper for active users
userSchema.query.active = function() {
  return this.where({ active: true });
};

const User = mongoose.model('User', userSchema);

module.exports = User;