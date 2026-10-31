/**
 * Shared TypeScript type definitions for Brightloop Subscription Management System.
 */

export type UserRole = "admin" | "staff" | "customer";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerAccount {
  id: string;
  customerCode: string;
  legalName: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  currencyCode: string;
  isActive: boolean;
}

export interface UserSession {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  customer?: CustomerAccount | null;
}

export interface NavigationItem {
  title: string;
  href: string;
  iconName?: string;
  badge?: string;
  disabled?: boolean;
}

export interface AuthActionResult {
  success: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

// ---------------------------------------------------------------------------
// Phase 2: Catalogue, Variants, Taxes, Plans, Discounts
// ---------------------------------------------------------------------------

export type ProductType = "software" | "service" | "physical" | "addon" | "other";

export interface ProductVariant {
  id: string;
  productId: string;
  attributeName: string;
  attributeValue: string;
  priceDelta: number;
  isActive: boolean;
  createdAt?: string;
}

export interface Tax {
  id: string;
  taxCode: string;
  name: string;
  ratePercent: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  productCode: string;
  name: string;
  productType: ProductType;
  salesPrice: number;
  costPrice: number;
  currencyCode: string;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  variants?: ProductVariant[];
  taxes?: Tax[];
}

export type BillingIntervalUnit = "daily" | "weekly" | "monthly" | "yearly";

export interface Plan {
  id: string;
  planCode: string;
  name: string;
  description?: string | null;
  price: number;
  currencyCode: string;
  billingIntervalUnit: BillingIntervalUnit;
  billingIntervalCount: number;
  minimumQuantity: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
  autoCloseOnEnd: boolean;
  allowEarlyClose: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  taxes?: Tax[];
}

export type DiscountScope = "product" | "subscription";
export type DiscountType = "fixed" | "percentage";

export interface Discount {
  id: string;
  discountCode: string;
  name: string;
  scope: DiscountScope;
  discountType: DiscountType;
  value: number;
  currencyCode: string;
  minimumPurchaseAmount: number;
  minimumQuantity: number;
  startsOn: string;
  endsOn: string;
  maxUses?: number | null;
  priority: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  productIds?: string[];
  products?: { id: string; name: string; productCode: string }[];
}

export type SubscriptionStatus =
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "paused"
  | "closed";

export type SubscriptionActionType =
  | "send_quotation"
  | "confirm"
  | "activate"
  | "pause"
  | "resume"
  | "close"
  | "renew";

export interface QuotationTemplateLine {
  id: string;
  templateId: string;
  productId: string;
  variantId?: string | null;
  description?: string | null;
  quantity: number;
  unitPriceOverride?: number | null;
  createdAt?: string;
  product?: Product;
  variant?: ProductVariant;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  planId: string;
  validityDays: number;
  isActive: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  plan?: Plan;
  lines?: QuotationTemplateLine[];
}

export interface SubscriptionLine {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId?: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  product?: Product;
  variant?: ProductVariant;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  fromStatus?: string | null;
  toStatus: string;
  action: string;
  note?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface Subscription {
  id: string;
  subscriptionNumber: string;
  customerId: string;
  planId: string;
  planNameSnapshot: string;
  quotationTemplateId?: string | null;
  renewedFromSubscriptionId?: string | null;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate?: string | null;
  quotationValidUntil?: string | null;
  paymentTermsDays: number;
  planPriceSnapshot: number;
  planQuantity: number;
  currencyCode: string;
  nextBillingDate?: string | null;
  billingAnchorDay?: number;
  billingAnchorMonth?: number;
  pausedAt?: string | null;
  closedAt?: string | null;
  closureReason?: string | null;
  confirmedAt?: string | null;
  activatedAt?: string | null;
  autoCloseOnEnd: boolean;
  allowEarlyClose: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  customer?: {
    id: string;
    customerCode: string;
    legalName: string;
    email: string;
    companyName?: string | null;
    phone?: string | null;
  };
  plan?: Plan;
  lines?: SubscriptionLine[];
  events?: SubscriptionEvent[];
}

export type InvoiceStatus =
  | "draft"
  | "confirmed"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "void";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "upi"
  | "card"
  | "cheque"
  | "other";

export type PaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export type InvoiceLineType = "plan" | "product" | "other";

export interface InvoiceLineTax {
  id: string;
  invoiceLineId: string;
  taxId?: string | null;
  taxNameSnapshot: string;
  ratePercentSnapshot: number;
  taxAmount: number;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  productId?: string | null;
  variantId?: string | null;
  lineType: InvoiceLineType;
  descriptionSnapshot: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  taxes?: InvoiceLineTax[];
  product?: Product;
  variant?: ProductVariant;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  note?: string | null;
  referenceNumber?: string | null;
  recordedBy?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    customerCode: string;
    legalName: string;
    email: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    total: number;
    balanceDue: number;
    status: InvoiceStatus;
    customer?: {
      id: string;
      customerCode: string;
      legalName: string;
      email: string;
    };
  };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subscriptionId?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    customerCode: string;
    legalName: string;
    email: string;
    companyName?: string | null;
    phone?: string | null;
  };
  subscription?: Subscription;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface BillingRun {
  id: string;
  triggerSource: "scheduled" | "manual" | "retry";
  status: "running" | "completed" | "completed_with_errors" | "failed";
  startedAt: string;
  completedAt?: string | null;
  subscriptionsChecked: number;
  invoicesCreated: number;
  invoicesSkipped: number;
  errors: {
    subscriptionId?: string;
    subscriptionNumber?: string;
    error: string;
  }[];
  initiatedBy?: string | null;
}

export interface BillingRunResult {
  runId: string;
  triggerSource: "scheduled" | "manual" | "retry";
  status: "completed" | "completed_with_errors" | "failed";
  subscriptionsChecked: number;
  invoicesCreated: number;
  invoicesSkipped: number;
  expiredSubscriptionsClosed: number;
  errors: {
    subscriptionId?: string;
    subscriptionNumber?: string;
    error: string;
  }[];
}

export interface FinancialSummaryMetrics {
  invoicedTotal: number;
  collectedTotal: number;
  outstandingTotal: number;
  overdueTotal: number;
  overdueCount: number;
  totalInvoicesCount: number;
  paidInvoicesCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  draftCount: number;
}

export interface CustomerDashboardMetrics {
  activeSubscriptionsCount: number;
  pausedSubscriptionsCount: number;
  totalSubscriptionsCount: number;
  pendingQuotationsCount: number;
  openInvoicesCount: number;
  outstandingBalance: number;
  totalPaid: number;
  overdueInvoicesCount: number;
  overdueAmount: number;
  currencyCode: string;
}

export interface CustomerProfileDetails extends CustomerAccount {
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  createdAt?: string;
  updatedAt?: string;
}


