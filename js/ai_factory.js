/**
 * AIFactory - Creates instances of AI based on difficulty level.
 */
const AI_TYPES = [
  { id: 'beginner', label: '初學者' },
  { id: 'normal', label: '一般人' },
  { id: 'expert', label: '高手' },
  { id: 'kokushi', label: '国士命' },
  { id: 'tanyao', label: '断么厨' },
  { id: 'menzen', label: '門清俠' },
];

const AIFactory = {
  create: function(difficulty) {
    switch (difficulty) {
      case 'expert':
        return new ExpertAI();
      case 'beginner':
        return new BeginnerAI();
      case 'kokushi':
        return new KokushiAI();
      case 'tanyao':
        return new TanyaoAI();
      case 'menzen':
        return new MenzenAI();
      case 'normal':
      default:
        return new NormalAI();
    }
  }
};
