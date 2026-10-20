/** E6: public order proposals (staff review). */
export type OrderProposalStatus = "PENDING_REVIEW" | "CONFIRMED" | "CANCELLED";

export interface OrderProposalItem {
  id: string;
  proposalId: string;
  productId: string;
  name: string;
  variantOptions: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderProposal {
  id: string;
  proposalNumber: string;
  customerName: string;
  phone: string;
  email: string;
  deliveryType: string;
  deliveryLocation: string;
  requiredBy: string | null;
  notes: string;
  status: OrderProposalStatus;
  items: OrderProposalItem[];
  createdAt: string;
  updatedAt: string;
  customerId: string | null;
  inquiryId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string;
}
