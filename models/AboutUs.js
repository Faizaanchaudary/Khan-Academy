import mongoose from 'mongoose';

const aboutUsSchema = new mongoose.Schema({
  section: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'what_students_say',
      'what_we_do',
      'our_core_values',
      'our_mission',
      'our_vision',
      'meet_our_team'
    ]
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String
  },
  content: {
    type: String,
    required: true
  },
  features: [{
    title: {
      type: String
    },
    description: {
      type: String
    },
    icon: {
      type: String
    }
  }],
  teamMembers: [{
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    },
    image: {
      type: String
    },
    bio: {
      type: String
    }
  }],
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String
    },
    caption: {
      type: String
    }
  }],
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

aboutUsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

aboutUsSchema.index({ section: 1 });
aboutUsSchema.index({ order: 1 });
aboutUsSchema.index({ isActive: 1 });

const AboutUs = mongoose.model('AboutUs', aboutUsSchema);

export default AboutUs;