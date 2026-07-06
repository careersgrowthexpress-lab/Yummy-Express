 import { Product } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Chingri Balachao',
    nameBn: 'চিংড়ি বালাচাও',
    price: 900,
    discount: 850,
    description: 'Shrimp Balachao is a traditional and flavorful spicy delicacy made with shrimp, garlic, onions, dried chilies, and a blend of aromatic spices. Known for its rich taste and distinctive aroma, it pairs perfectly with steamed rice, khichuri, pulao, paratha, or bread. When prepared and stored properly, Shrimp Balachao has a long shelf life and adds a delicious',
    descriptionBn: 'চিংড়ি বালাচাও একটি ঐতিহ্যবাহী ও সুস্বাদু ঝাল খাবার, যা চিংড়ি, রসুন, পেঁয়াজ, শুকনা মরিচ এবং বিভিন্ন মসলার সমন্বয়ে তৈরি করা হয়। এর অনন্য স্বাদ ও মনমুগ্ধকর ঘ্রাণ ভাত, খিচুড়ি, পোলাও, পরোটা কিংবা রুটির সঙ্গে দারুণ মানিয়ে যায়। সঠিকভাবে প্রস্তুত ও সংরক্ষণ করলে এটি দীর্ঘদিন ভালো থাকে এবং প্রতিটি খাবারে যোগ করে বাড়তি স্বাদ।',
    image: 'https://res.cloudinary.com/rbjnn5rh/image/upload/v1783255816/WhatsApp_Image_2026-07-05_at_6.32.47_PM_mooh1a.jpg',
    category: 'Combo',
    categoryBn: 'বালাচাও',
    isNew: true,
    weight: '500g',
    weightBn: '৫০০ গ্রাম',
    deliveryCharge: o
},
  {
    id: '2',
    name: 'Chingri Balachao',
    nameBn: 'চিংড়ি বালাচাও',
    price: 350,
    discount: 0,
    description: 'Shrimp Balachao is a traditional and flavorful spicy delicacy made with shrimp, garlic, onions, dried chilies, and a blend of aromatic spices. Known for its rich taste and distinctive aroma, it pairs perfectly with steamed rice, khichuri, pulao, paratha, or bread. When prepared and stored properly, Shrimp Balachao has a long shelf life and adds a delicious',
    descriptionBn: 'িংড়ি বালাচাও একটি ঐতিহ্যবাহী ও সুস্বাদু ঝাল খাবার, যা চিংড়ি, রসুন, পেঁয়াজ, শুকনা মরিচ এবং বিভিন্ন মসলার সমন্বয়ে তৈরি করা হয়। এর অনন্য স্বাদ ও মনমুগ্ধকর ঘ্রাণ ভাত, খিচুড়ি, পোলাও, পরোটা কিংবা রুটির সঙ্গে দারুণ মানিয়ে যায়। সঠিকভাবে প্রস্তুত ও সংরক্ষণ করলে এটি দীর্ঘদিন ভালো থাকে এবং প্রতিটি খাবারে যোগ করে বাড়তি স্বাদ।',
    image: 'https://res.cloudinary.com/rbjnn5rh/image/upload/v1783375923/photo_2_2026-07-07_04-11-21_trfi2v.jpg',
    category: 'Regular',
    categoryBn: 'বালাচাও',
    isOffer: true,
    weight: '200g',
    weightBn: '২০০ গ্রাম',
    deliveryCharge: 130
  },
  {
    id: '3',
    name: 'Quinoa & Avocado Bowl',
    nameBn: 'কিনোয়া ও অ্যাভোকাডো বোল',
    price: 15,
    description: 'Nutritious mix of quinoa, fresh avocado, honey mustard dressing.',
    descriptionBn: 'কিনোয়া, তাজা অ্যাভোকাডো এবং হানি মাস্টার্ড ড্রেসিংয়ের পুষ্টিকর মিশ্রণ।',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর',
    isNew: true,
    weight: '400g',
    weightBn: '৪০০ গ্রাম'
  },
  {
    id: '4',
    name: 'Dark Chocolate Lava Cake',
    nameBn: 'ডার্ক চকলেট লাভা কেক',
    price: 9,
    discount: 10,
    description: 'Warm chocolate cake with a molten center, served with vanilla bean ice cream.',
    descriptionBn: 'গলিত কেন্দ্রসহ গরম চকলেট কেক, সাথে ভ্যানিলা বিন আইসক্রিম।',
    image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?q=80&w=800&auto=format&fit=crop',
    category: 'Desserts',
    categoryBn: 'ডেজার্ট',
    isOffer: true
  },
  {
    id: '5',
    name: 'Classic Berry Smoothie',
    nameBn: 'ক্লাসিক বেরি স্মুদি',
    price: 7,
    description: 'A refreshing blend of strawberries, blueberries, and greek yogurt.',
    descriptionBn: 'স্ট্রবেরি, ব্লুবেরি এবং গ্রিক দইয়ের এক রিফ্রেশিং ব্লেন্ড।',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=800&auto=format&fit=crop',
    category: 'Beverages',
    categoryBn: 'পানীয়',
    isNew: true
  },
  {
    id: '6',
    name: 'Grilled Salmon Steak',
    nameBn: 'গ্রিলড স্যামন স্টেক',
    price: 28,
    discount: 5,
    description: 'Atlantic salmon grilled to perfection with lemon butter sauce.',
    descriptionBn: 'লেমন বাটার সসসহ নিখুঁতভাবে গ্রিল করা আটলান্টিক স্যামন।',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop',
    category: 'Fine Dining',
    categoryBn: 'ফাইন ডাইনিং'
  },
  {
    id: '7',
    name: 'Spicy Thai Noodles',
    nameBn: 'স্পাইসি থাই নুডলস',
    price: 14,
    discount: 10,
    description: 'Wok-fried rice noodles with shrimp, tofu, and crushed peanuts.',
    descriptionBn: 'চিংড়ি, টফু এবং বাদাম কুচি দিয়ে তৈরি স্পাইসি থাই নুডলস।',
    image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর',
    isOffer: true
  },
  {
    id: '8',
    name: 'Creamy Mushroom Pasta',
    nameBn: 'ক্রিমি মাশরুম পাস্তা',
    price: 16,
    description: 'Fettuccine in a rich wild mushroom cream sauce.',
    descriptionBn: 'সমৃদ্ধ ওয়াইল্ড মাশরুম ক্রিম সসে ফ্লেভারফুল ফেটুচিনি পাস্তা।',
    image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?q=80&w=800&auto=format&fit=crop',
    category: 'Pizza',
    categoryBn: 'পিৎজা'
  },
  {
    id: '9',
    name: 'Fresh Mango Lassi',
    nameBn: 'তাজা আম লচ্ছি',
    price: 6,
    description: 'Creamy yogurt drink blended with sweet ripe mangoes.',
    descriptionBn: 'মিষ্টি পাকা আমের সাথে ব্লেন্ড করা ক্রিমি দইয়ের পানীয়।',
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?q=80&w=800&auto=format&fit=crop',
    category: 'Beverages',
    categoryBn: 'পানীয়',
    isOffer: true
  },
  {
    id: '10',
    name: 'BBQ Chicken Pizza',
    nameBn: 'বিবিকিউ চিকেন পিৎজা',
    price: 22,
    discount: 15,
    description: 'Tender chicken, smoky BBQ sauce, and pickled red onions.',
    descriptionBn: 'নরম চিকেন, ধোঁয়াটে বিবিকিউ সস এবং আচারযুক্ত লাল পেঁয়াজ।',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop',
    category: 'Pizza',
    categoryBn: 'পিৎজা',
    isNew: true
  },
  {
    id: '11',
    name: 'Raw Wildflower Honey',
    nameBn: 'খাঁটি বনজ মধু',
    price: 12,
    discount: 5,
    description: '100% pure, unfiltered wildflower honey harvested responsibly.',
    descriptionBn: 'সম্পূর্ণ খাঁটি এবং অপরিশোধিত বনজ মধু, যা দায়িত্বশীলভাবে সংগ্রহ করা হয়েছে।',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর',
    isNew: true
  },
  {
    id: '12',
    name: 'Premium Alphonso Mangoes',
    nameBn: 'প্রিমিয়াম আলফনসো আম',
    price: 15,
    description: 'Sweet, juicy, and aromatic premium quality mangoes from the orchard.',
    descriptionBn: 'মিষ্টি, রসালো এবং সুগন্ধি প্রিমিয়াম কোয়ালিটির বাগান থেকে আসা আম।',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর',
    isOffer: true
  },
  {
    id: '13',
    name: 'Spicy Beef Pickle',
    nameBn: 'গরুর মাংসের আচার',
    price: 12,
    discount: 10,
    description: 'Traditional homemade spicy beef pickle with aromatic spices.',
    descriptionBn: 'সুগন্ধি মশলা দিয়ে তৈরি ঐতিহ্যবাহী হাতে তৈরি গরুর মাংসের আচার।',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর',
    isNew: true
  },
  {
    id: '14',
    name: 'Fresh Tiger Prawns',
    nameBn: 'তাজা বাগদা চিংড়ি',
    price: 25,
    description: 'Huge, fresh tiger prawns sourced directly from the coast.',
    descriptionBn: 'সরাসরি উপকূল থেকে সংগৃহীত বিশাল এবং তাজা বাগদা চিংড়ি।',
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?q=80&w=800&auto=format&fit=crop',
    category: 'Fine Dining',
    categoryBn: 'ফাইন ডাইনিং',
    isNew: true
  },
  {
    id: '15',
    name: 'Organic Date Jaggery',
    nameBn: 'খাঁটি খেজুরের গুড়',
    price: 8,
    description: 'Premium quality organic date jaggery (Patali Gur) from Jessore.',
    descriptionBn: 'যশোরের বিখ্যাত প্রিমিয়াম কোয়ালিটির খাঁটি খেজুরের পাটালি গুড়।',
    image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর'
  },
  {
    id: '16',
    name: 'Premium Saffron Biryani',
    nameBn: 'প্রিমিয়াম জাফরান বিরিয়ানি',
    price: 35,
    discount: 10,
    description: 'Aromatic long-grain basmati rice with tender lamb and real saffron.',
    descriptionBn: 'তাজা জাফরান এবং নরম ভেড়ার মাংস দিয়ে তৈরি সুগন্ধি বাসমতি বিরিয়ানি।',
    image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop',
    category: 'Fine Dining',
    categoryBn: 'ফাইন ডাইনিং',
    isNew: true
  },
  {
    id: '17',
    name: 'Dragon Fruit Smoothie Bowl',
    nameBn: 'ড্রাগন ফ্রুট স্মুদি বোল',
    price: 18,
    description: 'Vibrant pink dragon fruit base topped with chia seeds, granola, and fresh kiwi.',
    descriptionBn: 'চিয়া সিড, গ্রানোলা এবং তাজা কিউই দিয়ে সাজানো গোলাপি ড্রাগন ফ্রুট স্মুদি।',
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর',
    isNew: true
  },
  {
    id: '18',
    name: 'Japanese Wagyu Sushi Set',
    nameBn: 'জাপানিজ ওয়াগিউ সুশি সেট',
    price: 45,
    description: 'Exquisite wagyu beef nigiri with gold leaf garnish and truffle soy.',
    descriptionBn: 'সোনার প্রলেপ এবং ট্রাফল সয়াসহ চমৎকার ওয়াগিউ বিফ নিগিরি সুশি।',
    image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=800&auto=format&fit=crop',
    category: 'Fine Dining',
    categoryBn: 'ফাইন ডাইনিং',
    isOffer: true
  },
  {
    id: '19',
    name: 'Mediterranean Mezze Platter',
    nameBn: 'মেডিটেরেনিয়ান মেজে প্লাটার',
    price: 22,
    description: 'Hummus, falafel, stuffed grape leaves, and warm pita bread.',
    descriptionBn: 'হামাস, ফালাফেল, গ্রেপ লিভস এবং গরম পিটা ব্রেডের সুস্বাদু প্লাটার।',
    image: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?q=80&w=800&auto=format&fit=crop',
    category: 'Healthy',
    categoryBn: 'স্বাস্থ্যকর'
  },
  {
    id: '20',
    name: 'Red Velvet Opera Cake',
    nameBn: 'রেড ভেলভেট অপেরা কেক',
    price: 12,
    discount: 15,
    description: 'Layers of almond sponge, beetroot-infused cream cheese, and dark chocolate ganache.',
    descriptionBn: 'অ্যালমন্ড স্পঞ্জ, ক্রিম চিজ এবং ডার্ক চকলেট গ্যানাচে তৈরি চমৎকার লেয়ার্ড কেক।',
    image: 'https://images.unsplash.com/photo-1586985289906-40698897450a?q=80&w=800&auto=format&fit=crop',
    category: 'Desserts',
    categoryBn: 'ডেজার্ট',
    isNew: true,
    deliveryCharge: 0
  },
  {
    id: '21',
    name: 'Red Velvet Opera Cake',
    nameBn: 'রেড ভেলভেট অপেরা কেক',
    price: 12,
    discount: 15,
    description: 'Layers of almond sponge, beetroot-infused cream cheese, and dark chocolate ganache.',
    descriptionBn: 'অ্যালমন্ড স্পঞ্জ, ক্রিম চিজ এবং ডার্ক চকলেট গ্যানাচে তৈরি চমৎকার লেয়ার্ড কেক।',
    image: 'https://images.unsplash.com/photo-1586985289906-40698897450a?q=80&w=800&auto=format&fit=crop',
    category: 'Desserts',
    categoryBn: 'ডেজার্ট',
    isNew: true,
    deliveryCharge: 0
  },
  {
    id: '22',
    name: 'Red Velvet Opera Cake',
    nameBn: 'রেড ভেলভেট অপেরা কেক',
    price: 12,
    discount: 15,
    description: 'Layers of almond sponge, beetroot-infused cream cheese, and dark chocolate ganache.',
    descriptionBn: 'অ্যালমন্ড স্পঞ্জ, ক্রিম চিজ এবং ডার্ক চকলেট গ্যানাচে তৈরি চমৎকার লেয়ার্ড কেক।',
    image: 'https://images.unsplash.com/photo-1586985289906-40698897450a?q=80&w=800&auto=format&fit=crop',
    category: 'Desserts',
    categoryBn: 'ডেজার্ট',
    isNew: true,
    deliveryCharge: 0
  },
  {
    id: '23',
    name: 'Red Velvet Opera Cake',
    nameBn: 'রেড ভেলভেট অপেরা কেক',
    price: 12,
    discount: 15,
    description: 'Layers of almond sponge, beetroot-infused cream cheese, and dark chocolate ganache.',
    descriptionBn: 'অ্যালমন্ড স্পঞ্জ, ক্রিম চিজ এবং ডার্ক চকলেট গ্যানাচে তৈরি চমৎকার লেয়ার্ড কেক।',
    image: 'https://images.unsplash.com/photo-1586985289906-40698897450a?q=80&w=800&auto=format&fit=crop',
    category: 'Desserts',
    categoryBn: 'ডেজার্ট',
    isNew: true,
    deliveryCharge: 0
  }
];

export const CATEGORIES = [
  { en: 'All', bn: 'সবগুলো', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&auto=format&fit=crop' },
  { en: 'Burgers', bn: 'বার্গার', image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop' },
  { en: 'Pizza', bn: 'পিৎজা', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop' },
  { en: 'Healthy', bn: 'স্বাস্থ্যকর', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop' },
  { en: 'Desserts', bn: 'ডেজার্ট', image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=400&auto=format&fit=crop' },
  { en: 'Beverages', bn: 'পানীয়', image: 'https://images.unsplash.com/photo-1544145945-f904253d0c7b?q=80&w=400&auto=format&fit=crop' },
  { en: 'Fine Dining', bn: 'ফাইন ডাইনিং', image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=400&auto=format&fit=crop' }
];

export const PRICING_CONFIG = {
  // Config: Set true to display discount/selling price first, then regular price. Set false for regular price first.
  showDiscountFirst: true,

  // Config: Set true to apply a strike-through line on the regular (original) price
  strikeThroughRegularPrice: true,

  // Helper to check if the product has a discount set and active
  hasDiscount: (product: any): boolean => {
    if (!product) return false;
    const hasOriginalPrice = product.originalPrice !== undefined && product.originalPrice !== null && Number(product.originalPrice) > Number(product.price);
    const hasDiscountPercent = product.discount !== undefined && product.discount !== null && Number(product.discount) > 0;
    return !!(hasOriginalPrice || hasDiscountPercent);
  },

  // Helper to retrieve the regular (original) price
  getRegularPrice: (product: any): number | null => {
    if (!product) return null;
    if (product.originalPrice !== undefined && product.originalPrice !== null && Number(product.originalPrice) > 0) {
      return Number(product.originalPrice);
    }
    if (product.discount !== undefined && product.discount !== null && Number(product.discount) > 0) {
      // Calculate original price based on discount percentage
      return Math.round(Number(product.price) / (1 - Number(product.discount) / 100));
    }
    return null;
  },

  // Helper to retrieve the discount/active selling price
  getDiscountPrice: (product: any): number => {
    if (!product) return 0;
    return Number(product.price);
  },

  // Helper to retrieve the discount percentage (either direct or calculated)
  getDiscountPercentage: (product: any): number | null => {
    if (!product) return null;
    if (product.discount !== undefined && product.discount !== null && Number(product.discount) > 0) {
      return Number(product.discount);
    }
    if (product.originalPrice !== undefined && product.originalPrice !== null && Number(product.originalPrice) > Number(product.price)) {
      return Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100);
    }
    return null;
  }
};

export const DELIVERY_CONFIG = {
  enabled: true,                // Whether delivery charge is enabled by default
  chargeInside: 60,             // Default delivery charge inside Dhaka/City
  chargeOutside: 130,           // Default delivery charge outside Dhaka/City
  freeThreshold: 1000           // Free delivery threshold
};
