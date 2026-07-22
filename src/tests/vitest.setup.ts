import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user', email: 'test@example.com' },
  })),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({ uid: 'test-user', email: 'test@example.com' });
    return vi.fn();
  }),
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(() => Promise.resolve({ user: { uid: 'anon' } })),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'browserLocalPersistence',
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((ref, cb) => {
    // Default snapshot for users
    if (ref && ref.path && ref.path.includes('users')) {
      cb({ 
        exists: () => true, 
        data: () => ({ 
          organizationId: 'test-org',
          onboarded: true,
          role: 'admin',
          displayName: 'Test User',
          email: 'test@example.com'
        }) 
      });
    } else {
      cb({ docs: [], size: 0, forEach: (fn: any) => [] });
    }
    return vi.fn();
  }),
  addDoc: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((db, coll, id) => ({ id, collection: coll, path: `${coll}/${id}` })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], size: 0, empty: true })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}) })),
  getDocFromServer: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  getDocFromCache: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  deleteDoc: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/file.pdf')),
}));

// Mock Google Generative AI
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function() {
    return {
      getGenerativeModel: vi.fn(({ model }) => ({
        generateContent: vi.fn((prompt) => {
          let text = '';
          const p = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
          if (p.includes('briefing')) {
            text = JSON.stringify({ briefing: 'Mocked AI Briefing', priorities: ['Fix tests', 'Build UI'] });
          } else if (p.includes('incident response playbook')) {
            text = JSON.stringify({ incident_type: 'Security Breach', severity: 'High', steps: [], communications: [], evidence_to_collect: [] });
          } else if (p.includes('predict 4 high-probability')) {
            text = JSON.stringify([{ title: 'AI Risk 1', severity: 'High', impact: 'Significant', likelihood: 'Frequent', category: 'Operational' }]);
          } else {
            text = JSON.stringify({ result: 'Generic AI response' });
          }
          return Promise.resolve({
            response: {
              text: () => text,
            },
          });
        }),
      })),
      models: {
        generateContent: vi.fn(({ contents }) => {
          let text = '';
          if (contents.includes('briefing')) {
            text = JSON.stringify({ briefing: 'Mocked AI Briefing', priorities: ['Fix tests', 'Build UI'] });
          } else if (contents.includes('incident response playbook')) {
            text = JSON.stringify({ incident_type: 'Security Breach', severity: 'High', steps: [], communications: [], evidence_to_collect: [] });
          } else if (contents.includes('predict 4 high-probability')) {
            text = JSON.stringify([{ title: 'AI Risk 1', severity: 'High', impact: 'Significant', likelihood: 'Frequent', category: 'Operational' }]);
          } else {
            text = JSON.stringify({ result: 'Generic AI response' });
          }
          return Promise.resolve({ text });
        }),
      },
    };
  }),
  Type: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    NUMBER: 'number',
  },
}));
