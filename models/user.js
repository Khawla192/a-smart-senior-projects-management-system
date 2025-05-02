const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const roleSchema = mongoose.Schema({
  type: {
    type: String,
    enum: ['student', 'admin', 'supervisor', 'external_examiner'],
    required: true,
  },
  permissions: {
    type: [String],
    default: [],
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
      required: true,
    },
    firstName: String,
    lastName: String,
    phone: Number,
  },
  {
    timestamps: true,
  },
);

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
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;