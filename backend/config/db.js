const mongoose = require("mongoose");

mongoose.set('strictQuery', false);

let cachedConnection = null;
let connectionPromise = null;

const connectDB = async () => {
    // 1. Connection already active in this function invocation
    if (mongoose.connection.readyState === 1) {
        console.log("✅ Using existing active MongoDB connection");
        return mongoose.connection;
    }

    // 2. Connection in progress - wait for it
    if (connectionPromise) {
        console.log("⏳ Waiting for in-progress MongoDB connection...");
        return await connectionPromise;
    }

    // 3. Establish new connection
    connectionPromise = (async () => {
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

            console.log("⏳ Connecting to MongoDB Atlas...");
            const connection = await mongoose.connect(uri, options);
            
            cachedConnection = connection;
            console.log("✅ MongoDB Connected Successfully (Vercel Serverless Mode)");
            
            return connection;
        } catch (error) {
            console.error("❌ MongoDB Connection Failed:", error.message);
            connectionPromise = null;
            cachedConnection = null;
            throw error;
        }
    })();

    return await connectionPromise;
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