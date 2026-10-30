// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  executeAssessmentTransaction,
  handlePortalSubmit,
  type EvidenceDeps,
} from '../../server/lib/evidenceAccess';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host && !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Local emulator required');
}

const question = {
  id: 'q1',
  controlKey: 'q1',
  category: 'Access Control',
  question: 'MFA?',
  type: 'yesno',
  options: ['Yes', 'No'],
  required: true,
};

function mockRes() {
  const res: {
    statusCode: number;
    body: unknown;
    status: (n: number) => typeof res;
    json: (b: unknown) => typeof res;
  } = {
    statusCode: 200,
    body: null,
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return res;
}

function submitBody(assessmentId: string) {
  return {
    assessmentId,
    answers: { q1: 'Yes' },
    comments: {},
    evidenceByQuestion: {},
    attestations: { accuracy: true, authority: true, attestedByName: 'Vendor User' },
  };
}

describe.skipIf(!host)('portal submit vendor projection on the local Firestore emulator', () => {
  let app: App;
  let db: Firestore;
  const assessmentIds: string[] = [];
  const vendorIds: string[] = [];

  beforeAll(() => {
    app = initializeApp({ projectId: 'demo-guardentra-local' }, 'portal-submit-replay');
    db = getFirestore(app);
  });

  afterAll(async () => {
    for (const id of assessmentIds) {
      const intents = await db
        .collection('audit_material_intents')
        .where('envelope.objectId', '==', id)
        .get();
      for (const doc of intents.docs) await doc.ref.delete();
      await db.collection('assessments').doc(id).delete();
    }
    for (const id of vendorIds) await db.collection('vendors').doc(id).delete();
    await db.terminate();
    await deleteApp(app);
  });

  function deps(
    claimAssessmentId: string,
    hooks?: { afterAssessmentRead?: (attempt: number) => Promise<void> },
  ): EvidenceDeps {
    return {
      verifyIdToken: async () =>
        ({ uid: `portal_${claimAssessmentId}`, portalAssessmentId: claimAssessmentId }) as never,
      getAssessment: async () => null,
      getUser: async () => null,
      getStorageMetadata: async () => null,
      writeTrustRecord: async (_id, _path, record) => record,
      signReadUrl: async () => 'http://127.0.0.1/unused',
      runAssessmentTransaction: (id, updater, audit, skip, related) =>
        executeAssessmentTransaction(db, id, updater, audit, skip, related, hooks),
    };
  }

  async function seed(input: {
    assessmentId: string;
    vendorId: string;
    assessment: Record<string, unknown>;
    vendor: Record<string, unknown>;
  }) {
    assessmentIds.push(input.assessmentId);
    vendorIds.push(input.vendorId);
    await db.collection('assessments').doc(input.assessmentId).set(input.assessment);
    await db.collection('vendors').doc(input.vendorId).set(input.vendor);
  }

  async function submit(assessmentId: string, claim = assessmentId, hooks?: {
    afterAssessmentRead?: (attempt: number) => Promise<void>;
  }) {
    const res = mockRes();
    await handlePortalSubmit(
      { headers: { authorization: 'Bearer portal' }, body: submitBody(assessmentId), query: {} } as never,
      res as never,
      deps(claim, hooks),
    );
    return res;
  }

  it('writes the assessment, vendor projection, and audit intent on the first submit', async () => {
    const assessmentId = `asmfirst${Date.now()}`;
    const vendorId = `vendorfirst${Date.now()}`;
    await seed({
      assessmentId,
      vendorId,
      assessment: {
        organizationId: 'org1',
        vendorId,
        portalOpen: true,
        status: 'In Progress',
        sentAt: '2026-10-07T10:00:00.000Z',
        createdAt: '2026-10-07T09:00:00.000Z',
        questions: [question],
      },
      vendor: { organizationId: 'org1', assessmentStatus: 'In Progress' },
    });

    const res = await submit(assessmentId);
    expect(res.statusCode).toBe(200);
    expect((res.body as { deduplicated?: boolean }).deduplicated).toBe(false);

    const assessment = (await db.collection('assessments').doc(assessmentId).get()).data();
    const vendor = (await db.collection('vendors').doc(vendorId).get()).data();
    expect(assessment?.status).toBe('Under Review');
    expect(assessment?.portalOpen).toBe(false);
    expect(vendor?.assessmentStatus).toBe('Under Review');

    const intents = await db
      .collection('audit_material_intents')
      .where('envelope.objectId', '==', assessmentId)
      .get();
    expect(intents.size).toBe(1);
    expect(intents.docs[0].data().envelope.eventType).toBe('assessment.submitted');
  });

  it('keeps an immediate duplicate from rewriting the vendor projection', async () => {
    const assessmentId = `asmdup${Date.now()}`;
    const vendorId = `vendordup${Date.now()}`;
    await seed({
      assessmentId,
      vendorId,
      assessment: {
        organizationId: 'org1',
        vendorId,
        portalOpen: true,
        status: 'In Progress',
        sentAt: '2026-10-07T10:00:00.000Z',
        createdAt: '2026-10-07T09:00:00.000Z',
        questions: [question],
      },
      vendor: { organizationId: 'org1', assessmentStatus: 'In Progress' },
    });

    expect((await submit(assessmentId)).statusCode).toBe(200);
    const before = (await db.collection('vendors').doc(vendorId).get()).data();
    const replay = await submit(assessmentId);
    const after = (await db.collection('vendors').doc(vendorId).get()).data();
    const assessment = (await db.collection('assessments').doc(assessmentId).get()).data();

    expect(replay.statusCode).toBe(200);
    expect((replay.body as { deduplicated?: boolean }).deduplicated).toBe(true);
    expect(after).toEqual(before);
    expect(assessment?.status).toBe('Under Review');
    const intents = await db
      .collection('audit_material_intents')
      .where('envelope.objectId', '==', assessmentId)
      .get();
    expect(intents.size).toBe(1);
  });

  it('preserves a terminal vendor state when a decided assessment is replayed', async () => {
    const assessmentId = `asmterm${Date.now()}`;
    const vendorId = `vendorterm${Date.now()}`;
    await seed({
      assessmentId,
      vendorId,
      assessment: {
        organizationId: 'org1',
        vendorId,
        portalOpen: false,
        status: 'Completed',
        decisionOutcome: 'conditional',
        sentAt: '2026-10-07T10:00:00.000Z',
        createdAt: '2026-10-07T09:00:00.000Z',
        submittedSnapshot: {
          submittedAt: '2026-10-07T12:00:00.000Z',
          answers: { q1: 'Yes' },
        },
        questions: [question],
      },
      vendor: { organizationId: 'org1', assessmentStatus: 'Completed' },
    });

    const res = await submit(assessmentId);
    const assessment = (await db.collection('assessments').doc(assessmentId).get()).data();
    const vendor = (await db.collection('vendors').doc(vendorId).get()).data();

    expect(res.statusCode).toBe(200);
    expect((res.body as { deduplicated?: boolean }).deduplicated).toBe(true);
    expect(assessment?.status).toBe('Completed');
    expect(assessment?.decisionOutcome).toBe('conditional');
    expect(vendor?.assessmentStatus).toBe('Completed');
  });

  it('preserves a newer vendor state when an older submitted assessment is replayed', async () => {
    const assessmentId = `asmolder${Date.now()}`;
    const vendorId = `vendorolder${Date.now()}`;
    await seed({
      assessmentId,
      vendorId,
      assessment: {
        organizationId: 'org1',
        vendorId,
        portalOpen: false,
        status: 'Under Review',
        sentAt: '2026-09-01T10:00:00.000Z',
        createdAt: '2026-09-01T09:00:00.000Z',
        submittedSnapshot: {
          submittedAt: '2026-09-02T12:00:00.000Z',
          answers: { q1: 'Yes' },
        },
        questions: [question],
      },
      vendor: { organizationId: 'org1', assessmentStatus: 'Completed' },
    });

    const res = await submit(assessmentId);
    const assessment = (await db.collection('assessments').doc(assessmentId).get()).data();
    const vendor = (await db.collection('vendors').doc(vendorId).get()).data();

    expect(res.statusCode).toBe(200);
    expect((res.body as { deduplicated?: boolean }).deduplicated).toBe(true);
    expect(assessment?.status).toBe('Under Review');
    expect(vendor?.assessmentStatus).toBe('Completed');
  });

  it('follows the retried transaction snapshot when an earlier commit wins', async () => {
    const assessmentId = `asmretry${Date.now()}`;
    const vendorId = `vendorretry${Date.now()}`;
    await seed({
      assessmentId,
      vendorId,
      assessment: {
        organizationId: 'org1',
        vendorId,
        portalOpen: true,
        status: 'In Progress',
        sentAt: '2026-10-07T10:00:00.000Z',
        createdAt: '2026-10-07T09:00:00.000Z',
        questions: [question],
      },
      vendor: { organizationId: 'org1', assessmentStatus: 'In Progress' },
    });

    let attempts = 0;
    let holderReading = false;
    const holder = db.runTransaction(async (tx) => {
      await tx.get(db.collection('assessments').doc(assessmentId));
      holderReading = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      tx.update(db.collection('assessments').doc(assessmentId), {
        status: 'Completed',
        portalOpen: false,
        decisionOutcome: 'conditional',
        submittedSnapshot: {
          submittedAt: '2020-01-01T00:00:00.000Z',
          answers: { q1: 'Yes' },
        },
      });
      tx.set(
        db.collection('vendors').doc(vendorId),
        { assessmentStatus: 'Completed' },
        { merge: true },
      );
    });
    while (!holderReading) await new Promise((resolve) => setTimeout(resolve, 15));

    const res = await submit(assessmentId, assessmentId, {
      async afterAssessmentRead(attempt) {
        attempts = attempt;
      },
    });
    await holder;

    const assessment = (await db.collection('assessments').doc(assessmentId).get()).data();
    const vendor = (await db.collection('vendors').doc(vendorId).get()).data();
    expect(attempts).toBeGreaterThan(1);
    expect(res.statusCode).toBe(200);
    expect((res.body as { deduplicated?: boolean }).deduplicated).toBe(true);
    expect(assessment?.status).toBe('Completed');
    expect(assessment?.decisionOutcome).toBe('conditional');
    expect(
      (assessment?.submittedSnapshot as { submittedAt?: string } | undefined)?.submittedAt,
    ).toBe('2020-01-01T00:00:00.000Z');
    expect(vendor?.assessmentStatus).toBe('Completed');
  }, 20000);

  it('denies a mismatched portal claim and a cross-tenant vendor without writing', async () => {
    const assessmentId = `asmdeny${Date.now()}`;
    const vendorId = `vendordeny${Date.now()}`;
    await seed({
      assessmentId,
      vendorId,
      assessment: {
        organizationId: 'org1',
        vendorId,
        portalOpen: true,
        status: 'In Progress',
        sentAt: '2026-10-07T10:00:00.000Z',
        createdAt: '2026-10-07T09:00:00.000Z',
        questions: [question],
      },
      vendor: { organizationId: 'org1', assessmentStatus: 'Sent' },
    });

    const wrongClaim = await submit(assessmentId, `other${assessmentId}`);
    expect(wrongClaim.statusCode).toBe(403);
    expect((await db.collection('vendors').doc(vendorId).get()).data()?.assessmentStatus).toBe('Sent');
    expect((await db.collection('assessments').doc(assessmentId).get()).data()?.status).toBe('In Progress');

    await db.collection('vendors').doc(vendorId).update({ organizationId: 'org-other' });
    const wrongTenant = await submit(assessmentId);
    expect(wrongTenant.statusCode).toBe(403);
    expect((await db.collection('vendors').doc(vendorId).get()).data()?.assessmentStatus).toBe('Sent');
    expect((await db.collection('assessments').doc(assessmentId).get()).data()?.status).toBe('In Progress');

    await db.collection('vendors').doc(vendorId).delete();
    const missing = await submit(assessmentId);
    expect(missing.statusCode).toBe(409);
    expect((await db.collection('assessments').doc(assessmentId).get()).data()?.status).toBe('In Progress');
  });
});
