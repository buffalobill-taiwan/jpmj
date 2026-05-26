/**
 * AIFactory - Creates instances of AI based on difficulty level.
 */
const AIFactory = {
  create: function(difficulty) {
    switch (difficulty) {
      case 'expert':
        return new ExpertAI();
      case 'beginner':
        return new BeginnerAI();
      case 'normal':
      default:
        return new NormalAI();
    }
  }
};
