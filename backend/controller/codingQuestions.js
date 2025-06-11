import CodingQuestion from "../model/codingQuestion.js";
import crypto from "crypto";

export const addQuestion = async (req, res) => {
  try {
    const {
      title,
      slug,
      statement,
      inputFormat,
      outputFormat,
      constraints,
      samples,
      testcases,
      difficulty,
      tags,
    } = req.body;

    if (
      !title ||
      !statement ||
      !inputFormat ||
      !outputFormat ||
      !constraints ||
      !difficulty ||
      !samples ||
      !testcases ||
      !slug
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newQuestion = new CodingQuestion({
      title,
      slug,
      statement,
      inputFormat,
      outputFormat,
      constraints,
      samples,
      testcases,
      difficulty,
      tags: tags || [],
      createdBy: req.user._id,
    });

    const savedQuestion = await newQuestion.save();
    res.status(201).json({
      message: "Question added successfully",
      question: savedQuestion,
    });
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAquestion = async (req, res) => {
  try {
    const { difficulty } = req.body;
    if (!difficulty) {
      return res.status(400).json({ message: "Difficulty is required" });
    }
    const questions = await CodingQuestion.find({ difficulty }).populate(
      "createdBy"
    );
    if (questions.length === 0) {
      return res
        .status(404)
        .json({ message: "No questions found for this difficulty" });
    }

    const randomInd = crypto.randomInt(0, questions.length);
    const randomQuestion = questions[randomInd];
    res.status(200).json({
      message: "Question fetched successfully",
      question: randomQuestion,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
