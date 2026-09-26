import crypto from "crypto";
import CodingQuestion from "./codingQuestion.model.js";
import { ok, created } from "../../shared/http.js";
import { badRequest, notFound } from "../../shared/errors.js";

export const addQuestion = async (req, res) => {
  const question = await CodingQuestion.create({ ...req.body, createdBy: req.user._id });
  created(res, { message: "Question added successfully", question });
};

// Legacy random pick. `difficulty` may be in the query (correct for GET) or,
// for old clients, the body.
export const getAquestion = async (req, res) => {
  const difficulty = req.query?.difficulty || req.body?.difficulty;
  if (!difficulty) throw badRequest("Difficulty is required", undefined, "DIFFICULTY_REQUIRED");
  const count = await CodingQuestion.countDocuments({ difficulty });
  if (!count) throw notFound("Question for this difficulty", "NO_QUESTIONS");
  const question = await CodingQuestion.findOne({ difficulty }).skip(crypto.randomInt(0, count)).populate("createdBy", "username email");
  ok(res, { message: "Question fetched successfully", question });
};

export const listAll = async (req, res) => {
  ok(res, { questions: await CodingQuestion.find().sort({ createdAt: -1 }).select("-testcases") });
};

export const updateQuestion = async (req, res) => {
  const q = await CodingQuestion.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!q) throw notFound("Question");
  ok(res, { question: q });
};

export const deleteQuestion = async (req, res) => {
  const q = await CodingQuestion.findByIdAndDelete(req.params.id);
  if (!q) throw notFound("Question");
  ok(res, { message: "Question deleted" });
};
