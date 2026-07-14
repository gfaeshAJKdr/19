export function createEmptyScores(dimensions) {
  return Object.fromEntries(dimensions.map((dimension) => [dimension, 0]));
}

export function calculateScores({ questions, answers, dimensions }) {
  const scores = createEmptyScores(dimensions);

  questions.forEach((question) => {
    const selectedKey = answers[String(question.id)];
    const selectedOption = question.options.find((option) => option.key === selectedKey);

    if (!selectedOption) {
      return;
    }

    Object.entries(selectedOption.scores).forEach(([dimension, value]) => {
      if (Object.prototype.hasOwnProperty.call(scores, dimension)) {
        scores[dimension] += value;
      }
    });
  });

  return scores;
}

export function pickPrimaryAndSecondary(scores, dimensions) {
  const ranked = dimensions
    .map((dimension, order) => ({ dimension, order, score: scores[dimension] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.order - b.order);

  return {
    primary: ranked[0]?.dimension || "",
    secondary: ranked[1]?.dimension || "",
    ranked
  };
}

export function isComplete(questions, answers) {
  return questions.every((question) => Boolean(answers[String(question.id)]));
}
