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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const CodingQuestion = mongoose.model("CodingQuestion", codingQuestionSchema);
export default CodingQuestion;
