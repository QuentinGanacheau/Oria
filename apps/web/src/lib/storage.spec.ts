import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSession,
  saveSession,
  isUnlocked,
  setUnlocked,
  STORAGE_KEY,
  UNLOCK_PREFIX,
  type StoredSession,
} from './storage';

// jsdom (configure dans vitest.config.ts) fournit sessionStorage et localStorage

describe('storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  // ── loadSession ──────────────────────────────────────────────────────────

  describe('loadSession', () => {
    it('retourne null quand aucune session nest stockee', () => {
      expect(loadSession()).toBeNull();
    });

    it('retourne la session deserialisee si elle est presente', () => {
      const session: StoredSession = {
        sessionId: 'abc-123',
        answers: { situation: 'actif' },
        matches: [],
        hasEmail: false,
        portrait: null,
        ratings: {},
        refinedMatches: null,
        refineInsight: null,
        savedAt: '2025-01-01T00:00:00.000Z',
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      expect(loadSession()).toEqual(session);
    });

    it('retourne null si la valeur stockee nest pas du JSON valide', () => {
      sessionStorage.setItem(STORAGE_KEY, 'ceci-nest-pas-du-json');

      expect(loadSession()).toBeNull();
    });
  });

  // ── saveSession ──────────────────────────────────────────────────────────

  describe('saveSession', () => {
    it('enregistre la session avec un horodatage savedAt genere automatiquement', () => {
      const data = {
        sessionId: 'xyz-456',
        answers: { domaine: 'tech' },
        matches: [],
        hasEmail: false,
        portrait: null,
        ratings: {},
        refinedMatches: null,
        refineInsight: null,
      };

      saveSession(data);

      const raw = sessionStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!) as StoredSession;
      expect(parsed.sessionId).toBe('xyz-456');
      expect(parsed.answers).toEqual({ domaine: 'tech' });
      expect(parsed.savedAt).toBeDefined();
      // savedAt doit etre parseable en Date valide
      expect(new Date(parsed.savedAt).getTime()).not.toBeNaN();
    });

    it('ecrase une session precedente avec les nouvelles donnees', () => {
      saveSession({ sessionId: 'first', answers: {}, matches: [], hasEmail: false, portrait: null, ratings: {}, refinedMatches: null, refineInsight: null });
      saveSession({ sessionId: 'second', answers: {}, matches: [], hasEmail: false, portrait: null, ratings: {}, refinedMatches: null, refineInsight: null });

      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!) as StoredSession;
      expect(parsed.sessionId).toBe('second');
    });
  });

  // ── isUnlocked ───────────────────────────────────────────────────────────

  describe('isUnlocked', () => {
    it('retourne false quand la session na pas ete debloquee', () => {
      expect(isUnlocked('sess-a')).toBe(false);
    });

    it('retourne false sans sessionId', () => {
      expect(isUnlocked()).toBe(false);
    });

    it('retourne true apres un appel a setUnlocked() pour la meme session', () => {
      setUnlocked('sess-a');

      expect(isUnlocked('sess-a')).toBe(true);
    });

    it('reste cloisonne par session : debloquer sess-a ne debloque pas sess-b', () => {
      setUnlocked('sess-a');

      // Regression : un flag global laissait une 2e session gratuite se croire
      // payee -> paywall court-circuite puis 400 sur /next-batch.
      expect(isUnlocked('sess-b')).toBe(false);
    });
  });

  // ── setUnlocked ──────────────────────────────────────────────────────────

  describe('setUnlocked', () => {
    it('persiste la cle de deverrouillage par session en localStorage', () => {
      setUnlocked('sess-a');

      expect(localStorage.getItem(`${UNLOCK_PREFIX}_sess-a`)).toBe('1');
    });
  });
});
