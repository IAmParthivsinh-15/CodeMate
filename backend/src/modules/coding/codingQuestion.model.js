import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
  input: String,
  output: String,
});

const codingQuestionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    slug : {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    statement: {
      type: String,
      required: true,
    },
    inputFormat: {
      type: String,
      required: true,
    },
    outputFormat: {
      type: String,
      required: true,
    },
    constraints: {
      type: String,
      required: true,
    },
    samples: [testCaseSchema],
    testcases: [testCaseSchema],
    difficulty: {
      type: String,
      enum: [
        "beginner",
        "intermediate",
        "advanced",
        "master",
        "grandmaster",
        "legendary",
      ],
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    // stdio: the program reads stdin and writes stdout (all new problems).
    // function: legacy problems whose code defines solve(n, arr), wrapped by the executor.
    mode: { type: String, enum: ["stdio", "function"], default: "function" },
    starterCode: { type: Map, of: String, default: {} }, // language -> template
    timeLimitSec: { type: Number, default: 2 },
    memoryLimitKb: { type: Number, default: 128000 },
    published: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null, // null for seeded problems
    },
  },
  {
    timestamps: true,
  }
);

codingQuestionSchema.index({ difficulty: 1, tags: 1 });

const CodingQuestion = mongoose.model("CodingQuestion", codingQuestionSchema);
export default CodingQuestion;
