import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class GeminiService {
  async generateGameAnalysisReport(gameSummary, moveAnalysis) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      Analyze this chess game and provide a comprehensive report for the player:
      
      Game Summary:
      ${JSON.stringify(gameSummary, null, 2)}
      
      Key Move Analysis:
      ${JSON.stringify(moveAnalysis.filter(m => 
        m.classification === 'blunder' || 
        m.classification === 'mistake'
      ).slice(0, 5), null, 2)}
      
      Provide your analysis in this JSON format:
      {
        "summary": "Brief overall assessment of the game",
        "strengths": ["list of 2-3 player strengths"],
        "weaknesses": ["list of 2-3 areas for improvement"],
        "keyInsights": [
          {
            "moveNumber": 5,
            "playerMove": "e4e5",
            "bestMove": "d2d4",
            "explanation": "Why the best move was better"
          }
        ],
        "trainingRecommendations": ["specific areas to focus on in training"]
      }
      
      Use chess terminology and focus on educational value. Be constructive but honest.
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from the response
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      const jsonString = text.substring(jsonStart, jsonEnd);
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackReport();
    }
  }

  getFallbackReport() {
    return {
      summary: "Game analysis is currently unavailable. Please try again later.",
      strengths: [],
      weaknesses: [],
      keyInsights: [],
      trainingRecommendations: []
    };
  }
}

export default new GeminiService();