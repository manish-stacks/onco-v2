export interface Category {
  category_id: number;
  category_name: string;
  slug: string;

  parent_id: number;

  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;

  category_banner: string | null;
  category_image: string;

  footer_description: string | null;

  status: "Active" | "Inactive";

  created_at: string;
  updated_at: string;

  // API calculated field
  product_count?: number;
}


export interface Banner {
  banner_id: number;
  banner_image: string;
  banner_link: string;

  banner_type: 'normal' | 'rich';

  ribbon?: string;
  title_top?: string;
  title_bottom?: string;
  body?: string;
  price?: string;

  status: string;

  created_at?: string;
  updated_at?: string;
}

/** Legacy/UI-friendly shapes used by marketing components (adapted from API data) */
export interface CategoryTag {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  productCount?: number;
  description?: string;
}

/** `categoryTree` API se — nested parent/child structure, mega-menu ke liye */
export interface CategoryTreeNode extends CategoryTag {
  /** Meta description se short one-liner — mega-menu tiles ke liye */
  blurb?: string;
  children: CategoryTreeNode[];
}

export interface BrandTag {
  id: string;
  name: string;
  slug: string;
  logo: string;
  productCount?: number;
}

export interface TestimonialTag {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatar: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
}

// =============================================================================
// BACKEND (storefront API) shapes
// =============================================================================

export interface ApiBrand {
  id: number | string;
  title: string;
  slug: string;
  image_url: string;
  category_id?: number | string;
  live_product_count?: number;
}

export interface ApiTestimonial {
  review_id: number | string;
  name: string;
  profession?: string;
  review: string;
  stars: number | string;
}

export interface ApiDeal {
  id: number;
  title: string;
  description?: string;
  image: string;
  public_id?: string;
  bgColor?: string;
  textColor?: string;
  active_status: number;
  position: number;
  cta: string;
  link: string;
}

export interface ApiOffer {
  id: string | number;
  title: string;
  CODE: string;
  desc_code?: string;
  percenatge_off?: number;
  discount_type?: string;
  min_order_value?: number;
  maxDiscount?: number;
  theme?: string;
}

export interface HomeData {
  banners: Banner[];
  categories: Category[];
  brands: ApiBrand[];
  deals: ApiDeal[];
  offers: ApiOffer[];
  testimonials: ApiTestimonial[];
  top_selling: ApiProduct[];
  latest_products: ApiProduct[];
  deal_of_the_day: ApiProduct[];
  settings: SiteSettings | null;
}

export interface ApiProduct {
  product_id: number;
  product_name: string;
  slug: string;
  sku?: string;
  hsn_code?: string;
  short_description?: string;
  long_description?: string;
  about_product?: string;
  key_features?: string;
  benifits?: string;
  how_to_use?: string;
  specification?: string;
  side_effects?: string;
  caution?: string;
  storage?: string;
  salt?: string;
  image_1?: string | null;
  image_2?: string | null;
  image_3?: string | null;
  image_4?: string | null;
  image_5?: string | null;
  alt_text_1?: string;
  product_mrp: number | string;
  product_sp: number | string;
  product_gst?: number | string;
  weight_quantity?: string;
  stock?: string;
  stock_quantity?: number;
  low_stock_alert?: number;
  allow_backorder?: number | string;
  batch_number?: string;
  expiry_date?: string;
  total_sold?: number;
  brand_id?: number | string;
  brand_name?: string;
  company_name?: string;
  presciption_required?: 'Yes' | 'No' | string;
  isCOD?: number | string;
  is_featured?: string;
  deal_of_the_day?: string;
  top_selling?: string;
  latest_product?: string;
  meta_title?: string;
  meta_description?: string;
  status?: string;
  categories?: { category_id: number; category_name: string; slug: string }[];
  related?: ApiProduct[];
  avg_rating?: number;
  review_count?: number;
  in_wishlist?: boolean;
  [key: string]: unknown;
}

export interface ApiCartItem {
  cart_id: number | string;
  product_id: number | string;
  product_quantity: number;
  product_name: string;
  slug: string;
  image_1?: string | null;
  sku?: string;
  product_sp: number | string;
  product_mrp: number | string;
  product_gst?: number | string;
  stock?: string;
  stock_quantity?: number;
  presciption_required?: 'Yes' | 'No' | string;
  isCOD?: number | string;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
  in_stock: boolean;
  available_quantity?: number;
  /** false = this specific item is blocking COD (cold-chain or isCOD=0) */
  cod_eligible?: boolean;
}

export interface CartSummary {
  item_count: number;
  total_quantity: number;
  subtotal: number;
  gst: number;
  total: number;
  requires_prescription: boolean;
  cod_allowed: boolean;
  has_out_of_stock: boolean;
  out_of_stock_items?: string[];
}

export interface Customer {
  customer_id: number | string;
  customer_name?: string;
  mobile?: string;
  // The backend DB column is named email_id, not `email` — the response
  // carries this key.
  email_id?: string;
  [key: string]: unknown;
}

export interface OrderItem {
  item_id?: number;
  // The backend does SELECT * on the `order_items` table — product_id is always
  // present, but was missing from the type earlier (needed for the eligibility check).
  product_id: string | number;
  product_name: string;
  product_image?: string;
  sku?: string;
  hsn_code?: string;
  unit_price: number;
  unit_mrp?: number;
  unit_quantity: number;
  line_subtotal: number;
  tax_percent?: number;
  tax_amount?: number;
  line_total: number;
}

export interface OrderHistoryEntry {
  old_status: string;
  new_status: string;
  changed_by?: string;
  note?: string;
  created_at: string;
}

export interface OrderPrescription {
  prescription_id: number | string;
  reference_code?: string;
  images?: string[];
  status?: string;
}

export interface Order {
  order_id: number | string;
  databaseOrderID?: number | string;
  invoice_number?: string;
  original_invoice_url?: string | null;
  order_date: string;
  status: string;
  payment_status: string;
  payment_mode?: string;
  payment_gateway?: string;
  cod_advance_amount?: number | string;
  cod_advance_paid?: number | boolean;
  cod_balance_due?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_pincode?: string;
  patient_name?: string;
  doctor_name?: string;
  hospital_name?: string;
  subtotal?: number;
  order_gst?: number;
  coupon_code?: string;
  coupon_discount?: number;
  shipping_charge?: number;
  additional_charge?: number;
  amount: number;
  refund_amount?: number;
  awb_number?: string;
  courier_name?: string;
  tracking_status?: string;
  tracking_location?: string;
  delivered_at?: string;
  orderFrom?: 'web' | 'app';
  items?: OrderItem[];
  history?: OrderHistoryEntry[];
  prescription?: OrderPrescription;
  [key: string]: unknown;
}

export interface Prescription {
  prescription_id: number | string;
  reference_code?: string;
  images?: string[];
  status: string;
  rejection_reason?: string;
  medicines?: ApiProduct[];
  patient_name?: string;
  doctor_name?: string;
  hospital_name?: string;
  notes?: string;
  contact_number?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface SiteSettings {
  organization?: string;
  logo?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  facebook_link?: string;
  instagram_link?: string;
  twitter_link?: string;
  shipping_charge?: number;
  shipping_threshold?: number;
  is_cod?: string | number | boolean;
  cod_fee?: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export interface Medicine {
  id: string;
  slug: string;
  name: string;
  manufacturer: string;
  brandId: string;
  categoryId: string;
  image: string;
  images: string[];
  mrp: number;
  price: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  prescriptionRequired: boolean;
  inStock: boolean;
  packSize: string;
  composition: string;
  description: string;
  benefits: string;
  uses: string[];
  dosage: string;
  specification: string;
  sideEffects: string[];
  storage: string;
  tags: string[];
  reviews: Review[];
  faqs: { question: string; answer: string }[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  experience: string;
  image: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatar: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  color: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  author: string;
  date: string;
  readTime: string;
}

export interface CartItem {
  medicineId: string;
  quantity: number;
}


export interface Deals {
    id: number;
  title: string;
  description?: string;
  image: string;
  public_id?: string;
  bgColor?: string;
  textColor?: string;
  active_status: number;
  position: number;
  cta: string;
  link: string;
}