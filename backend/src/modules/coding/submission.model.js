import mongoose from "mongoose";

// One document per submission (spec §39). Replaces the unbounded array that
// was embedded in User.submissions.
const testResultSchema = new mongoose.Schema(
  {
    index: Number,
    hidden: Boolean,
    input: String, // omitted for hidden cases when sent to clients
    expected: String,
    output: String,
    status: String,
    passed: Boolean,
    time: Number, // seconds
    memory: Number, // KB
    error: String,
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: "CodingQuestion", required: true, index: true },
    language: { type: String, required: true },
    code: { type: String, required: true, maxlength: 65536 },
    kind: { type: String, enum: ["run", "submit"], default: "submit" }, // run = samples only
    status: {
      type: String,
      enum: ["queued", "running", "accepted", "wrong_answer", "compilation_error", "runtime_error",
        "time_limit_exceeded", "memory_limit_exceeded", "internal_error", "unavailable"],
      default: "queued",
      index: true,
    },
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    executionTime: Number, // max seconds across tests
    memory: Number, // max KB across tests
    compileOutput: String,
    testResults: [testResultSchema],
    firstAccept: { type: Boolean, default: false }, // earned a hint credit
    completedAt: Date,
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Submission", submissionSchema);
