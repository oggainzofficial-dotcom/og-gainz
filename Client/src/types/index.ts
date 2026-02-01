// OZ GAINZ Type Definitions

// ============ Meal Pack Types ============

export type PackTier = 'signature' | 'elite' | 'royal';
export type SubscriptionType = 'trial' | 'weekly' | 'monthly';
export type TrialDuration = 3 | 5 | 7;

export interface MealPackPricing {
  trial: {
    3: number;
    5: number;
    7: number;
  };
  weekly: number;
  monthly: number;
}

export interface MealPackItem {
  name: string;
  description: string;
  proteinGrams: number;
}

export interface CustomizationRule {
  category: string;
  maxSelections: number;
  options: string[];
}

export interface MealPack {
  id: string;
  name: string;
  tier: PackTier;
  proteinPerMeal: number;
  description: string;
  shortDescription: string;
  targetUser: string;
  items: MealPackItem[];
  pricing: MealPackPricing;
  customizationRules: CustomizationRule[];
  addOnEligible: boolean;
  isTrialAvailable: boolean;
  image: string;
}

// ============ Add-On Types ============

export type AddOnCategory = 'protein' | 'sides' | 'shakes' | 'snacks';

export interface AddOn {
  id: string;
  name: string;
  category: AddOnCategory;
  description: string;
  priceOneTime: number;
  priceSubscription: number;
  image: string;
  proteinGrams?: number;
  isAvailable: boolean;
}

// ============ Cart Types ============

export interface CartItemAddOn {
  addOnId: string;
  quantity: number;
  isSubscription: boolean;
}

export interface CartItem {
  id: string;
  type: 'mealPack' | 'customMeal' | 'addOn';
  mealPackId?: string;
  subscriptionType: SubscriptionType;
  trialDays?: TrialDuration;
  quantity: number;
  addOns: CartItemAddOn[];
  customizations?: Record<string, string[]>;
  pricePerUnit: number;
}

export interface Cart {
  items: CartItem[];
  deliveryFee: number;
  creditsApplied: number;
  subtotal: number;
  total: number;
}

// ============ Subscription Types ============

export type SubscriptionStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type DeliveryStatus = 'scheduled' | 'cooking' | 'sent' | 'delivered' | 'skipped';

export interface Delivery {
  id: string;
  date: string; // ISO date string
  status: DeliveryStatus;
  deliveryTime: string;
  isSkipped: boolean;
  skipReason?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  mealPackId: string;
  mealPackName: string;
  type: SubscriptionType;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  totalServings: number;
  remainingServings: number;
  deliveries: Delivery[];
  addOns: CartItemAddOn[];
  pauseReason?: string;
  pausedAt?: string;
  createdAt: string;
}

// ============ Pause/Skip Request Types (Phase 7) ============

export type PauseSkipRequestType = 'PAUSE' | 'SKIP' | 'WITHDRAW_PAUSE';
export type PauseSkipRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';
export type PauseSkipRequestKind = 'customMeal' | 'addon' | 'mealPack' | 'delivery' | 'unknown';

export interface PauseSkipRequest {
  id: string;
  requestType: PauseSkipRequestType;
  status: PauseSkipRequestStatus;
  kind: PauseSkipRequestKind;
  subscriptionId?: string;
  deliveryId?: string;
  linkedTo?: string;
  userId?: string;
  reason?: string;
  pauseStartDate?: string;
  pauseEndDate?: string;
  skipDate?: string;
  adminNote?: string;
  decidedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    contactNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    pincode?: string;
  };
}

// ============ User Types ============

export interface Address {
  id: string;
  label: string;
  username?: string;
  contactNumber?: string;
  housePlotNo?: string;
  street?: string;
  area?: string;
  district?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
	googleMapsLink?: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar?: string;
  role?: 'user' | 'admin';
  addresses: Address[];
  walletBalance: number;
  isVerified: boolean;
  createdAt: string;
}

// ============ Wallet Types ============

export type TransactionType = 'credit' | 'debit';
export type TransactionReason = 
  | 'signup_bonus'
  | 'referral'
  | 'refund'
  | 'order_payment'
  | 'admin_adjustment'
  | 'cashback';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  reason: TransactionReason;
  description: string;
  orderId?: string;
  createdAt: string;
}

// ============ Consultation Types ============

export type FitnessGoal = 
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'athletic_performance'
  | 'general_health';

export type WorkRoutine = 
  | 'sedentary'
  | 'light_activity'
  | 'moderate_activity'
  | 'very_active'
  | 'extremely_active';

export interface ConsultationLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  fitnessGoal: FitnessGoal;
  workRoutine: WorkRoutine;
  foodPreferences: string;
  additionalNotes?: string;
  isContacted: boolean;
  contactedAt?: string;
  createdAt: string;
}

// ============ Delivery Location Types ============

export interface DeliveryLocation {
  address: string;
  latitude: number;
  longitude: number;
  distance: number; // in km
  deliveryFee: number;
  isServiceable: boolean;
}

// ============ Order Types ============

export type PaymentMethod = 'gpay' | 'phonepe' | 'upi' | 'card';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  subscriptionId?: string;
  subtotal: number;
  deliveryFee: number;
  creditsUsed: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  orderStatus: OrderStatus;
  deliveryAddress: Address;
  createdAt: string;
}
