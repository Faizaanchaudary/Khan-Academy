import mongoose from 'mongoose';

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'trial', 'expired', 'cancelled', 'paused', 'pending'],
    default: 'trial',
    index: true
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  trialEndDate: {
    type: Date,
    required: true
  },
  isTrialActive: {
    type: Boolean,
    default: true
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'paypal', 'gpay', 'debit', 'free', 'stripe'],
    default: 'card'
  },
  billingInfo: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phoneNumber: {
      type: String
    }
  },
  paymentDetails: {
    cardHolderName: {
      type: String
    },
    cardNumber: {
      type: String,
      set: function(value) {
        return value ? value.slice(-4) : value;
      }
    },
    cardType: {
      type: String,
      enum: ['debit', 'credit']
    },
    cardBrand: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover']
    },
    expiryMonth: {
      type: String
    },
    expiryYear: {
      type: String
    },
    cvv: {
      type: String
    }
  },
  paypalDetails: {
    orderId: {
      type: String
    },
    captureId: {
      type: String
    },
    payerId: {
      type: String
    },
    payerEmail: {
      type: String
    },
    transactionId: {
      type: String
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
      default: 'pending'
    }
  },
  stripeDetails: {
    customerId: {
      type: String
    },
    paymentIntentId: {
      type: String
    },
    subscriptionId: {
      type: String
    },
    paymentMethodId: {
      type: String
    },
    chargeId: {
      type: String
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'],
      default: 'pending'
    },
    last4: {
      type: String
    },
    brand: {
      type: String
    },
    expiryMonth: {
      type: String
    },
    expiryYear: {
      type: String
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    amountDueNow: {
      type: Number,
      default: 0
    },
    nextBillingAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  promoCode: {
    type: String
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  lastPaymentDate: {
    type: Date
  },
  nextBillingDate: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
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

userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1, status: 1 });
userSubscriptionSchema.index({ trialEndDate: 1, isTrialActive: 1 });

userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

userSubscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endDate = this.isTrialActive ? this.trialEndDate : this.endDate;
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

userSubscriptionSchema.virtual('isExpired').get(function() {
  const now = new Date();
  const endDate = this.isTrialActive ? this.trialEndDate : this.endDate;
  return now > endDate;
});

userSubscriptionSchema.virtual('isTrialExpired').get(function() {
  const now = new Date();
  return this.isTrialActive && now > this.trialEndDate;
});

userSubscriptionSchema.methods.isActive = function() {
  const now = new Date();
  const endDate = this.isTrialActive ? this.trialEndDate : this.endDate;
  return this.status === 'active' && now <= endDate;
};

userSubscriptionSchema.methods.isTrialCurrentlyActive = function() {
  const now = new Date();
  return this.isTrialActive && now <= this.trialEndDate;
};

const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);

export default UserSubscription;