import CodeExecutor from "../services/codeExecutor.js";
import CodingQuestion from "../model/codingQuestion.js";
import User from "../model/user.js";

const codeExecutor = new CodeExecutor();

export const executeCode = async (req, res) => {
  try {
    const { code, language, questionId } = req.body;

    if (!code || !language || !questionId) {
      return res.status(400).json({
        message: "Code, language and questionId are required",
      });
    }

    // Validate language
    const validLanguages = ["javascript", "python", "java", "cpp"];
    if (!validLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid language. Supported languages: ${validLanguages.join(
          ", "
        )}`,
      });
    }

    // Get question by ID
    const question = await CodingQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    // Execute code with samples first
    console.log("Running sample test cases...");
    const sampleResults = await codeExecutor.executeCode(
      code,
      question.samples,
      language
    );

    // Check if all samples passed
    const allSamplesPassed = sampleResults.every((result) => result.passed);
    console.log("Sample tests passed:", allSamplesPassed);

    // If samples pass, run hidden test cases
    let testCaseResults = [];
    if (allSamplesPassed) {
      console.log("Running hidden test cases...");
      testCaseResults = await codeExecutor.executeCode(
        code,
        question.testcases,
        language
      );
    }

    // Calculate score
    const totalTests = testCaseResults.length;
    const passedTests = testCaseResults.filter((result) => result.passed)
      .length;
    const score =
      totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Save submission
    await saveSubmission(req.user._id, {
      questionId: question._id,
      code,
      language,
      difficulty: question.difficulty,
      score,
      samples: sampleResults,
      testCases: testCaseResults.map((result) => ({
        ...result,
        output: result.isHidden ? "Hidden" : result.output,
      })),
      executedAt: new Date(),
    });

    res.status(200).json({
      message: "Code executed successfully",
      question: {
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        inputFormat: question.inputFormat,
        outputFormat: question.outputFormat,
        constraints: question.constraints,
        samples: question.samples.map((s) => ({
          input: s.input,
          output: s.output,
        })),
      },
      execution: {
        samples: sampleResults,
        testCases: testCaseResults.map((result) => ({
          ...result,
          output: result.isHidden ? "Hidden" : result.output,
        })),
        score,
        passed: score === 100,
        language,
        timeTaken: Date.now() - req.startTime,
      },
    });
  } catch (error) {
    console.error("Code execution error:", error);
    res.status(500).json({
      message: "Code execution failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const saveSubmission = async (userId, submission) => {
  try {
    // Ensure score is a valid number
    const score = isNaN(submission.score)
      ? 0
      : Math.min(100, Math.max(0, submission.score));

    const submissionData = {
      questionId: submission.questionId,
      code: submission.code,
      language: submission.language,
      difficulty: submission.difficulty,
      score: score,
      samples: submission.samples.map((s) => ({
        input: s.input,
        output: s.output || "",
        expected: s.expected,
        status: s.status,
        time: s.time || "0",
        memory: s.memory || 0,
        error: s.error || "",
        passed: !!s.passed,
      })),
      testCases: submission.testCases.map((t) => ({
        input: t.input,
        output: t.output || "",
        expected: t.expected,
        status: t.status,
        time: t.time || "0",
        memory: t.memory || 0,
        error: t.error || "",
        passed: !!t.passed,
      })),
      executedAt: new Date(),
    };

    await User.findByIdAndUpdate(
      userId,
      { $push: { submissions: submissionData } },
      { new: true, runValidators: true }
    );
  } catch (error) {
    console.error("Error saving submission:", error);
    throw error;
  }
};
