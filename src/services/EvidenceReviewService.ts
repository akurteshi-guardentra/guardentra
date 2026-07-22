import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';

export interface KeyFinding {
  finding: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  impact: string;
}

export interface DetectedRisk {
  risk: string;
  impactScore: number;
  coverage: string;
}

export interface MissingEvidence {
  evidenceName: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface Recommendation {
  action: string;
  timeframe: string;
  difficulty: 'Easy' | 'Moderate' | 'Complex';
}

export interface EvidenceReviewResult {
  executiveSummary: string;
  keyFindings: KeyFinding[];
  detectedRisks: DetectedRisk[];
  missingEvidence: MissingEvidence[];
  recommendations: Recommendation[];
  expirationDate: string;
  complianceSignal: 'Compliant' | 'Partial' | 'Non-Compliant';
}

export interface EvidenceReviewRecord {
  id: string;
  vendorId: string;
  documentType: string;
  fileName: string;
  createdAt: string;
  result: EvidenceReviewResult;
}

export class EvidenceReviewService {
  /**
   * Generates a structural AI review from an uploaded policy/evidence document.
   */
  static async analyzeEvidence(
    documentType: string,
    fileName: string,
    fileContent: string,
    vendorName: string
  ): Promise<EvidenceReviewResult> {
    try {
      const response = await fetch('/api/ai/evidence-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          fileName,
          fileContent,
          vendorName,
        }),
      });

      if (!response.ok) {
        throw new Error(`API analysis request failed with status ${response.status}`);
      }

      return (await response.json()) as EvidenceReviewResult;
    } catch (error) {
      console.error('EvidenceReviewService.analyzeEvidence error:', error);
      throw error;
    }
  }

  /**
   * Persists the AI review details permanently into Firestore for audits.
   */
  static async saveReview(
    vendorId: string,
    documentType: string,
    fileName: string,
    result: EvidenceReviewResult,
    organizationId: string
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'evidence_reviews'), {
        vendorId,
        documentType,
        fileName,
        createdAt: new Date().toISOString(),
        result,
        organizationId,
      });
      return docRef.id;
    } catch (error) {
      console.error('EvidenceReviewService.saveReview error:', error);
      throw error;
    }
  }

  /**
   * Deletes a review record from Firestore.
   */
  static async deleteReview(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'evidence_reviews', id));
    } catch (error) {
      console.error('EvidenceReviewService.deleteReview error:', error);
      throw error;
    }
  }

  /**
   * Retrieves all the historic AI analysis records for a specific vendor.
   */
  static async getReviewsByVendor(vendorId: string, organizationId: string): Promise<EvidenceReviewRecord[]> {
    try {
      const q = query(
        collection(db, 'evidence_reviews'),
        where('vendorId', '==', vendorId),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const records: EvidenceReviewRecord[] = [];
      querySnapshot.forEach((docSnap) => {
        records.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as EvidenceReviewRecord);
      });
      return records;
    } catch (error) {
      console.error('EvidenceReviewService.getReviewsByVendor error:', error);
      // Return empty array on error but log it
      return [];
    }
  }
}
