export interface Product {
  id: string;
  name: string;
  nameBn: string;
  price: number;
  discount?: number;
  originalPrice?: number;
  description: string;
  descriptionBn: string;
  image: string;
  category: string;
  categoryBn: string;
  isNew?: boolean;
  isOffer?: boolean;
  stock?: number;
  weight?: string;
  weightBn?: string;
  deliveryCharge?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export type Page = 'home' | 'product' | 'checkout' | 'success' | 'profile';

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  area: string;
  note?: string;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'rocket';
  transactionId?: string;
  deliveryDate?: string;
  deliveryTime?: string;
}

export interface Order {
  id?: string;
  userId?: string;
  items: CartItem[];
  total: number;
  customer: CustomerDetails;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt?: any;
  updatedAt?: any;
  created_at?: string;
  updated_at?: string;
}
