import { describe, expect, it } from 'vitest';
import {
  applyLearningEvent,
  extractLearningKeywords,
  rewriteScoutQueriesWithLearning,
  type LearningSignals,
} from '../learningSignals';

const baseSignals: LearningSignals = {
  likedKeywords: [],
  dislikedKeywords: [],
  keywordScores: {},
  events: {
    saved: 0,
    dismissed: 0,
    applied: 0,
    clicked: 0,
  },
};

describe('extractLearningKeywords', () => {
  it('extracts concrete skill terms and removes generic words', () => {
    const result = extractLearningKeywords({
      title: 'Senior React Engineer',
      company: 'Acme',
      description:
        'Build frontend systems with React, TypeScript, GraphQL and performance tuning.',
      requirements: ['React', 'TypeScript', 'GraphQL'],
    });

    expect(result).toContain('react');
    expect(result).toContain('typescript');
    expect(result).toContain('graphql');
    expect(result).not.toContain('engineer');
    expect(result).not.toContain('senior');
    expect(result).not.toContain('remote');
  });
});

describe('applyLearningEvent', () => {
  it('promotes liked keywords from saved and applied events', () => {
    const afterSave = applyLearningEvent(baseSignals, 'saved', {
      title: 'Frontend Engineer',
      company: 'Acme',
      description: 'React and TypeScript work.',
      requirements: ['React', 'TypeScript'],
    });

    const afterApply = applyLearningEvent(afterSave, 'applied', {
      title: 'Frontend Engineer',
      company: 'Acme',
      description: 'React and TypeScript work.',
      requirements: ['React', 'TypeScript'],
    });

    expect(afterApply.keywordScores.react).toBeGreaterThan(
      afterSave.keywordScores.react
    );
    expect(afterApply.likedKeywords).toContain('react');
    expect(afterApply.events?.saved).toBe(1);
    expect(afterApply.events?.applied).toBe(1);
  });

  it('promotes disliked keywords from repeated dismissals', () => {
    const once = applyLearningEvent(baseSignals, 'dismissed', {
      title: 'Java Backend Engineer',
      company: 'Globex',
      description: 'Java, Spring Boot, Kafka.',
      requirements: ['Java', 'Spring Boot'],
    });

    const twice = applyLearningEvent(once, 'dismissed', {
      title: 'Java Backend Engineer',
      company: 'Globex',
      description: 'Java, Spring Boot, Kafka.',
      requirements: ['Java', 'Spring Boot'],
    });

    expect(twice.keywordScores.java).toBeLessThan(0);
    expect(twice.dislikedKeywords).toContain('java');
    expect(twice.events?.dismissed).toBe(2);
  });
});

describe('rewriteScoutQueriesWithLearning', () => {
  it('removes disliked optional modifiers and appends liked ones safely', () => {
    const result = rewriteScoutQueriesWithLearning(
      [
        'remote frontend engineer react java site:greenhouse.io',
        'remote software engineer java site:lever.co',
      ],
      {
        likedKeywords: ['typescript'],
        dislikedKeywords: ['java'],
      }
    );

    expect(result[0]).toContain('typescript');
    expect(result[0]).not.toMatch(/\bjava\b/i);
    expect(result[1]).toContain('remote');
    expect(result[1]).toMatch(/site:(greenhouse\.io|lever\.co)/);
  });
});
