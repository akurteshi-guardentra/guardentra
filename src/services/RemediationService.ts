import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface RemediationTicket {
  id: string;
  vendorId: string;
  vendorName: string;
  findingId?: string;
  finding: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  businessImpact: string;
  recommendedFix: string;
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  ownerSuggestion: string;
  requiredEvidence: string;
  problem: string;
  impact: string;
  recommendedAction: string;
  deadline: string;
  successCriteria: string;
  status: 'Backlog' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
  organizationId?: string;
}

export class RemediationService {
  /**
   * Generates a fully populated AI Remediation Plan from a finding
   */
  static async generateAIPlan(
    finding: string,
    recommendation?: string,
    vendorName?: string
  ): Promise<Omit<RemediationTicket, 'id' | 'vendorId' | 'vendorName' | 'status' | 'createdAt'>> {
    try {
      const response = await fetch('/api/ai/remediation-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finding,
          recommendation,
          vendorName,
        }),
      });

      if (!response.ok) {
        throw new Error(`API remediation-plan request failed with status ${response.status}`);
      }

      return (await response.json()) as Omit<RemediationTicket, 'id' | 'vendorId' | 'vendorName' | 'status' | 'createdAt'>;
    } catch (error) {
      console.error('RemediationService.generateAIPlan error:', error);
      throw error;
    }
  }

  /**
   * Persists a remediation ticket into Google Cloud Firestore
   */
  static async createTicket(
    ticket: Omit<RemediationTicket, 'id'>
  ): Promise<RemediationTicket> {
    try {
      const docRef = await addDoc(collection(db, 'remediations'), {
        ...ticket,
        createdAt: ticket.createdAt || new Date().toISOString(),
      });
      return {
        id: docRef.id,
        ...ticket,
      };
    } catch (error) {
      console.error('RemediationService.createTicket error:', error);
      throw error;
    }
  }

  /**
   * Retrieves all remediation tickets for a specific vendor
   */
  static async getTicketsByVendor(vendorId: string, organizationId: string): Promise<RemediationTicket[]> {
    try {
      const q = query(
        collection(db, 'remediations'),
        where('vendorId', '==', vendorId),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const tickets: RemediationTicket[] = [];
      querySnapshot.forEach((docSnap) => {
        tickets.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as RemediationTicket);
      });
      return tickets;
    } catch (error) {
      console.error('RemediationService.getTicketsByVendor error:', error);
      // Fallback on empty but log
      return [];
    }
  }

  /**
   * Retrieves all remediation tickets globally
   */
  static async getAllTickets(organizationId: string): Promise<RemediationTicket[]> {
    try {
      const q = query(
        collection(db, 'remediations'),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const tickets: RemediationTicket[] = [];
      querySnapshot.forEach((docSnap) => {
        tickets.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as RemediationTicket);
      });
      return tickets;
    } catch (error) {
      console.error('RemediationService.getAllTickets error:', error);
      return [];
    }
  }

  /**
   * Updates the status of an existing ticket
   */
  static async updateTicketStatus(
    id: string,
    status: 'Backlog' | 'In Progress' | 'Resolved' | 'Closed'
  ): Promise<void> {
    try {
      const ticketRef = doc(db, 'remediations', id);
      await updateDoc(ticketRef, { status });
    } catch (error) {
      console.error('RemediationService.updateTicketStatus error:', error);
      throw error;
    }
  }

  /**
   * Modifies any details of a ticket
   */
  static async updateTicket(
    id: string,
    updates: Partial<RemediationTicket>
  ): Promise<void> {
    try {
      const ticketRef = doc(db, 'remediations', id);
      await updateDoc(ticketRef, updates);
    } catch (error) {
      console.error('RemediationService.updateTicket error:', error);
      throw error;
    }
  }

  /**
   * Deletes a ticket from standard records
   */
  static async deleteTicket(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'remediations', id));
    } catch (error) {
      console.error('RemediationService.deleteTicket error:', error);
      throw error;
    }
  }
}
