export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  productCount: number;
  description: string;
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
  benefits: string[];
  uses: string[];
  dosage: string;
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
