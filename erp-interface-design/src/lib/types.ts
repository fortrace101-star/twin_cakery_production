export type OrderProposalStatus = "PENDING_REVIEW" | "CONFIRMED" | "CANCELLED";

export interface OrderProposalItem {
  id: string;
  proposalId: string;
  productId: string;
  productName: string;
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
  productSummary: string;
  quantity: number;
  preferredDate: string | null;
  preferredTime: string;
  deliveryType: string;
  deliveryLocation: string;
  customerNotes: string;
  referenceImage: string;
  status: OrderProposalStatus;
  items: OrderProposalItem[];
  createdAt: string;
  updatedAt: string;
  customerId: string | null;
  inquiryId: string | null;
  orderId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string;
}
