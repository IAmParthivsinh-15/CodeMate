{{grounding}}

Write a short coach's report on a finished game, based only on the Stockfish analysis below.

GAME
{{game}}

SUMMARY STATISTICS (the player's side)
{{stats}}

KEY MOMENTS (the player's biggest mistakes, from Stockfish)
{{facts}}

Reply with a JSON object only:
{
  "summary": "2-3 sentences on how the game went",
  "strengths": ["1-3 things the player did well, backed by the statistics"],
  "weaknesses": ["1-3 areas to improve, backed by the key moments"],
  "keyMoments": [{ "ply": 0, "explanation": "one or two sentences per key moment, using its Stockfish facts" }],
  "trainingRecommendations": ["1-3 concrete practice suggestions"]
}
