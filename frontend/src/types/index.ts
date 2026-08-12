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

  status: 'active' | 'inactive';

  created_at?: string;
  updated_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
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
  product_id: number;
  product_name: string;
  short_description?: string;
  long_description?: string;
  sku?: string;
  hsn_code?: string;
  company_name?: string;
  brand_id?: number;
  brand_name?: string;

  slug: string;

  image_1?: string;
  image_2?: string;
  image_3?: string;
  image_4?: string;
  image_5?: string;
  alt_text_1?: string;

  category?: string;

  product_mrp: number;
  product_sp: number;
  product_gst?: number;

  weight_quantity?: string;

  stock?: string;
  stock_quantity?: number;
  low_stock_alert?: number;
  allow_backorder?: number;

  total_sold?: number;

  discount_type?: string;
  discount_amount?: number;

  salt?: string;

  presciption_required?: string;

  deal_of_the_day?: string | null;
  top_selling?: string | null;
  latest_product?: string | null;
  is_featured?: string | null;

  storage?: string;
  isCOD?: number;

  adding_date?: string;
  status?: string;

  meta_title?: string;
  meta_description?: string;

  // Extra fields returned on the product detail endpoint
  about_product?: string;
  key_features?: string;
  benifits?: string;
  how_to_use?: string;
  side_effects?: string;
  caution?: string;
  batch_number?: string;
  expiry_date?: string;

  categories?: { category_id: number; category_name: string; slug: string }[];
  related?: Medicine[];
  avg_rating?: number;
  review_count?: number;
  in_wishlist?: boolean;
}

export interface ProductReview {
  review_id?: number;
  id?: number;
  customer_name?: string;
  author?: string;
  rating: number;
  title?: string;
  review?: string;
  comment?: string;
  created_at?: string;
  date?: string;
  verified?: boolean;
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