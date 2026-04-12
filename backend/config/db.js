const mongoose = require("mongoose");

mongoose.set('strictQuery', false);

/**
 * STRICT CACHED DATABASE CONNECTION PATTERN FOR VERCEL SERVERLESS
 * Uses global.mongoose to cache connection across Lambda invocations
 * Prevents FUNCTION_INVOCATION_FAILED errors from repeated connections
 */

const connectDB = async () => {
    // 1. Check if cached connection exists and is active
    if (global.mongoose && global.mongoose.connection.readyState === 1) {
        console.log("✅ Using cached MongoDB connection from global scope");
        return global.mongoose.connection;
    }

    // 2. Connection in progress - wait for it
    if (global.mongoosePromise) {
        console.log("⏳ Waiting for in-progress MongoDB connection...");
        return await global.mongoosePromise;
    }

    // 3. Establish new connection and cache in global scope
    global.mongoosePromise = (async () => {
        try {
            const uri = process.env.MONGODB_URI;
            if (!uri) {
                throw new Error("❌ CRITICAL: MONGODB_URI environment variable not set");
            }

            // Optimized options for Vercel Serverless Functions
            const options = {
                // Connection Pool Settings
                maxPoolSize: 5,
                minPoolSize: 1,
                
                // Timeouts (balanced for serverless 120s max)
                serverSelectionTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 15000,
                
                // Connection Behavior
                family: 4,
                bufferCommands: false,
                
                // Retry Strategy
                retryWrites: true,
                retryReads: true,
                
                // Additional Optimizations
                useNewUrlParser: true,
                useUnifiedTopology: true
            };

            console.log("⏳ Connecting to MongoDB Atlas (Vercel Serverless)...");
            const connection = await mongoose.connect(uri, options);
            
            // Cache connection in global scope for reuse
            global.mongoose = mongoose;
            console.log("✅ MongoDB Connected Successfully & Cached in Global Scope");
            
            return connection;
        } catch (error) {
            console.error("❌ MongoDB Connection Failed:", error.message);
            global.mongoosePromise = null;
            global.mongoose = null;
            throw error;
        }
    })();

    return await global.mongoosePromise;
};

const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRecord = require('../models/PayrollRecord');
const Attendance = require('../models/Attendance');
const Penalty = require('../models/Penalty');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Subscription = require('../models/Subscription');
const Shift = require('../models/Shift');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const JobPosting = require('../models/JobPosting');
const Candidate = require('../models/Candidate');
const Offer = require('../models/Offer');
const OnboardingTask = require('../models/OnboardingTask');
const OnboardingChecklist = require('../models/OnboardingChecklist');

module.exports = { connectDB, User, Company, Employee, PayrollRecord, Attendance, Penalty, Leave, LeaveBalance, Subscription, Shift, AppraisalCycle, AppraisalTemplate, Appraisal, JobPosting, Candidate, Offer, OnboardingTask, OnboardingChecklist };