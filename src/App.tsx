/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  X, 
  Menu, 
  ChevronRight, 
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Languages,
  Package,
  RefreshCw,
  User as UserIcon,
  LogOut,
  Facebook,
  Phone,
  MapPin,
  Truck,
  MessageSquare,
  RotateCcw,
  Heart
} from 'lucide-react';
import { Product, CartItem, Page, Order, CustomerDetails } from './types';
import { PRODUCTS as STATIC_PRODUCTS, CATEGORIES, PRICING_CONFIG, DELIVERY_CONFIG } from './constants';
import { Language, translations } from './translations';
import { supabase } from './lib/supabase';
import { saveLocalUserBackup, syncCustomerToGoogleSheets } from './lib/webhook';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import AuthModal from './components/AuthModal';

// Helper to calculate Levenshtein distance for fuzzy search typo tolerance
function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if query is a fuzzy match for target
function isFuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  // Basic substring matches check
  if (t.includes(q)) return true;

  // For very short queries, only accept substring matching to prevent noise
  if (q.length <= 2) {
    return false;
  }

  // Check subsequence: characters of q appear in t in order
  let qIdx = 0;
  let tIdx = 0;
  while (qIdx < q.length && tIdx < t.length) {
    if (q[qIdx] === t[tIdx]) {
      qIdx++;
    }
    tIdx++;
  }
  if (qIdx === q.length) {
    return true; // Match found as subsequence
  }

  // Token / word level matching
  const targetWords = t.split(/[\s,.\-()]+/);
  for (const word of targetWords) {
    if (!word) continue;

    // Substring match on word level
    if (word.includes(q) || q.includes(word)) {
      return true;
    }

    // Levenshtein edit distance check (typo handling)
    const distance = getLevenshteinDistance(q, word);
    // Allow distance up to 2 for length >= 5, 1 for shorter
    const allowedDist = q.length >= 5 ? 2 : 1;
    if (distance <= allowedDist) {
      return true;
    }
    
    // Check if characters overlapping is very high (say, >= 85% of query chars are in the word)
    const qChars = Array.from(new Set(q));
    const matchedChars = qChars.filter(char => word.includes(char));
    if (matchedChars.length / qChars.length >= 0.85 && q.length >= 4) {
      return true;
    }
  }

  return false;
}

interface PriceDisplayProps {
  product: Product;
  className?: string;
  priceClassName?: string;
  regularPriceClassName?: string;
}

function PriceDisplay({ 
  product, 
  className = "flex items-baseline gap-1.5 flex-wrap", 
  priceClassName = "font-extrabold text-amber-600", 
  regularPriceClassName = "text-xs text-slate-400" 
}: PriceDisplayProps) {
  const hasDiscount = PRICING_CONFIG.hasDiscount(product);
  const regularPrice = PRICING_CONFIG.getRegularPrice(product);
  const discountPrice = PRICING_CONFIG.getDiscountPrice(product);

  const regularPriceElement = hasDiscount && regularPrice ? (
    <span className={`${regularPriceClassName} ${PRICING_CONFIG.strikeThroughRegularPrice ? 'line-through' : ''}`}>
      ৳{regularPrice}
    </span>
  ) : null;

  const discountPriceElement = (
    <span className={priceClassName}>
      ৳{discountPrice}
    </span>
  );

  return (
    <div className={className}>
      {PRICING_CONFIG.showDiscountFirst ? (
        <>
          {discountPriceElement}
          {regularPriceElement}
        </>
      ) : (
        <>
          {regularPriceElement}
          {discountPriceElement}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>('bn');
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [homeTab, setHomeTab] = useState<'all' | 'categories' | 'offers'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showOffersOnly, setShowOffersOnly] = useState(false);
  const [products, setProducts] = useState<Product[]>(() => {
    const seen = new Set<string>();
    return STATIC_PRODUCTS.filter(p => {
      if (!p || !p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  });
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [siteSettings, setSiteSettings] = useState({
    heroTitle: '',
    heroDesc: '',
    heroTitleBn: '',
    heroDescBn: '',
    logoUrl: '',
    companyInfo: {
      description: '',
      descriptionBn: '',
      mission: '',
      missionBn: '',
      team: [],
      sliders: [] as { id: string; image: string; titleEn: string; titleBn: string; subtitleEn: string; subtitleBn: string; linkProductId?: string; price?: number }[],
      deliveryChargeInside: DELIVERY_CONFIG ? DELIVERY_CONFIG.chargeInside : 60,
      deliveryChargeOutside: DELIVERY_CONFIG ? DELIVERY_CONFIG.chargeOutside : 120,
      deliveryFreeThreshold: DELIVERY_CONFIG ? DELIVERY_CONFIG.freeThreshold : 1000,
      deliveryChargeEnabled: DELIVERY_CONFIG ? DELIVERY_CONFIG.enabled : true,
    }
  });
  const [checkoutForm, setCheckoutForm] = useState<CustomerDetails & { deliveryZone?: 'inside' | 'outside' }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    area: '',
    note: '',
    paymentMethod: 'cod',
    transactionId: '',
    deliveryZone: 'inside',
    deliveryDate: '',
    deliveryTime: ''
  });
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const userId = user?.id || 'guest';
    const savedFavorites = localStorage.getItem(`yummydash_favorites_${userId}`);
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    } else {
      setFavorites([]);
    }
  }, [user?.id]);

  const toggleFavorite = (productId: string) => {
    const userId = user?.id || 'guest';
    setFavorites(prev => {
      const updated = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      localStorage.setItem(`yummydash_favorites_${userId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const [dbSyncStatus, setDbSyncStatus] = useState<{ show: boolean; message: string; type: 'success' | 'syncing' | 'error' | null }>({ show: false, message: '', type: null });

  // Password reset state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error(language === 'en' ? 'Password must be at least 6 characters long.' : 'পাসওয়ার্ড অবশ্যই কমপক্ষে ৬ অক্ষরের হতে হবে।');
      }
      if (newPassword !== confirmPassword) {
        throw new Error(language === 'en' ? 'Passwords do not match.' : 'পাসওয়ার্ড দুটি মেলেনি।');
      }

      if (!supabase) throw new Error('Supabase not configured');

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setResetSuccess(language === 'en' ? 'Password updated successfully!' : 'পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে!');
      setNewPassword('');
      setConfirmPassword('');
      
      // Auto-close after 2.5 seconds
      setTimeout(() => {
        setShowResetPasswordModal(false);
        setResetSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error('Password update error:', err);
      setResetError(err.message || (language === 'en' ? 'Failed to update password' : 'পাসওয়ার্ড আপডেট করতে ব্যর্থ হয়েছে'));
    } finally {
      setResetLoading(false);
    }
  };

  // Keyboard shortcut for Admin Panel (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        if (isAdmin) {
          setShowAdminPanel(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Fetch orders for logged-in user
  useEffect(() => {
    if (!user) {
      setUserOrders([]);
      return;
    }

    const isValidUUID = (str: string) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    const fetchOrders = async () => {
      // 1. Get all local orders matching this user
      const localOrdersStr = localStorage.getItem('yummydash_custom_orders');
      let baseOrders: Order[] = [];
      if (localOrdersStr) {
        try {
          const parsed = JSON.parse(localOrdersStr);
          baseOrders = parsed.filter((o: any) => {
            if (!o) return false;
            const matchesUserId = o.user_id === user.id;
            const matchesEmail = user.email && o.customer?.email?.toLowerCase() === user.email.toLowerCase();
            const matchesPhone = (user.phone && o.customer?.phone === user.phone) || 
                                 (user.user_metadata?.phone && o.customer?.phone === user.user_metadata?.phone);
            return matchesUserId || matchesEmail || matchesPhone;
          });
        } catch (e) {
          console.error("Error parsing local orders for user:", e);
        }
      }

      if (!supabase) {
        setUserOrders(baseOrders);
        return;
      }

      // 2. Query remote orders from Supabase matching user profile parameters
      try {
        let query = supabase.from('orders').select('*');
        const conditions: string[] = [];

        if (isValidUUID(user.id)) {
          conditions.push(`user_id.eq.${user.id}`);
        }
        
        if (user.email) {
          conditions.push(`customer->>email.eq.${user.email}`);
        }
        
        const userPhone = user.phone || user.user_metadata?.phone;
        if (userPhone) {
          conditions.push(`customer->>phone.eq.${userPhone}`);
        }

        let remoteOrders: Order[] = [];
        if (conditions.length > 0) {
          const { data, error } = await query.or(conditions.join(',')).order('created_at', { ascending: false });
          if (error) {
            console.error("Supabase fetch orders with OR query error:", error);
            // Fallback to simpler user_id query
            const { data: fallbackData } = await supabase
              .from('orders')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
            if (fallbackData) remoteOrders = fallbackData as Order[];
          } else if (data) {
            remoteOrders = data as Order[];
          }
        } else {
          const { data, error } = await query.eq('user_id', user.id).order('created_at', { ascending: false });
          if (!error && data) {
            remoteOrders = data as Order[];
          }
        }

        // 3. Merge and deduplicate by order ID (so local & remote records blend seamlessly)
        const mergedMap = new Map<string, Order>();
        
        remoteOrders.forEach(o => {
          if (o && o.id) mergedMap.set(o.id, o);
        });

        baseOrders.forEach(o => {
          if (o && o.id) {
            if (!mergedMap.has(o.id)) {
              mergedMap.set(o.id, o);
            }
          }
        });

        const mergedOrders = Array.from(mergedMap.values()).sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        setUserOrders(mergedOrders);
      } catch (err) {
        console.error("Error in fetchOrders chain:", err);
        setUserOrders(baseOrders);
      }
    };

    fetchOrders();

    const handleLocalOrdersChange = () => {
      fetchOrders();
    };
    window.addEventListener('yummydash_orders_change', handleLocalOrdersChange);

    if (!supabase) {
      return () => {
        window.removeEventListener('yummydash_orders_change', handleLocalOrdersChange);
      };
    }

    // Subscribe to real-time changes
    const channel = supabase
      .channel('user_orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders'
      }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      window.removeEventListener('yummydash_orders_change', handleLocalOrdersChange);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    
    if (!supabase) {
      // Offline fallback Google sign-in simulation
      const gmailPrompt = language === 'en' 
        ? 'Enter your Gmail address to simulate Google login:' 
        : 'গুগল লগইন সিমুলেট করতে আপনার জিমেইল এড্রেস লিখুন:';
      const promptEmail = window.prompt(gmailPrompt, 'customer@gmail.com');
      
      if (!promptEmail) return;
      
      const trimmedEmail = promptEmail.trim().toLowerCase();
      if (!trimmedEmail.includes('@') || !trimmedEmail.endsWith('.com')) {
        alert(language === 'en' ? 'Invalid Gmail/Email format!' : 'ভুল জিমেইল ফরম্যাট!');
        return;
      }

      setIsLoggingIn(true);
      setTimeout(() => {
        const nameFromEmail = trimmedEmail.split('@')[0];
        const mockUser = {
          id: 'mock-google-' + Math.random().toString(36).substring(2, 9),
          email: trimmedEmail,
          user_metadata: {
            full_name: nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${nameFromEmail}`
          }
        };

        const localProfile = {
          displayName: mockUser.user_metadata.full_name,
          phone: '',
          photoURL: mockUser.user_metadata.avatar_url,
          address: '',
          city: '',
          area: '',
          bio: ''
        };

        localStorage.setItem(`mock_profile_${mockUser.id}`, JSON.stringify(localProfile));
        localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
        window.dispatchEvent(new Event('mock_auth_change'));
        setIsLoggingIn(false);
        setIsAuthModalOpen(false);
      }, 600);
      return;
    }

    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error('Login error:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const t = translations[language];

  const mergeSiteSettings = (fetchedData: any) => {
    if (!fetchedData) return;
    setSiteSettings(prev => {
      const companyInfo = fetchedData.companyInfo || {};
      return {
        ...prev,
        ...fetchedData,
        companyInfo: {
          ...prev.companyInfo,
          ...companyInfo,
          deliveryChargeInside: companyInfo.deliveryChargeInside !== undefined && companyInfo.deliveryChargeInside !== null
            ? Number(companyInfo.deliveryChargeInside)
            : prev.companyInfo.deliveryChargeInside,
          deliveryChargeOutside: companyInfo.deliveryChargeOutside !== undefined && companyInfo.deliveryChargeOutside !== null
            ? Number(companyInfo.deliveryChargeOutside)
            : prev.companyInfo.deliveryChargeOutside,
          deliveryFreeThreshold: companyInfo.deliveryFreeThreshold !== undefined && companyInfo.deliveryFreeThreshold !== null
            ? Number(companyInfo.deliveryFreeThreshold)
            : prev.companyInfo.deliveryFreeThreshold,
          deliveryChargeEnabled: companyInfo.deliveryChargeEnabled !== undefined && companyInfo.deliveryChargeEnabled !== null
            ? !!companyInfo.deliveryChargeEnabled
            : prev.companyInfo.deliveryChargeEnabled,
        }
      };
    });
  };

  // Site Settings Subscription
  useEffect(() => {
    const fetchSettings = async () => {
      const localSettingsStr = localStorage.getItem('yummydash_custom_settings');
      if (localSettingsStr) {
        try {
          const localSettings = JSON.parse(localSettingsStr);
          if (localSettings) mergeSiteSettings(localSettings);
        } catch (err) {
          console.error('Error parsing local settings in App:', err);
        }
      }
      if (!supabase) return;
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error) {
        console.error("Settings error:", error);
      } else if (data) {
        mergeSiteSettings(data as any);
      }
    };

    fetchSettings();

    if (!supabase) {
      const handleLocalSettingsChange = () => {
        const localSettingsStr = localStorage.getItem('yummydash_custom_settings');
        if (localSettingsStr) {
          try {
            const localSettings = JSON.parse(localSettingsStr);
            if (localSettings) mergeSiteSettings(localSettings);
          } catch (err) {
            console.error('Error parsing local settings on event:', err);
          }
        }
      };
      window.addEventListener('yummydash_settings_change', handleLocalSettingsChange);
      return () => {
        window.removeEventListener('yummydash_settings_change', handleLocalSettingsChange);
      };
    }

    const channel = supabase
      .channel('site_settings')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'settings', 
        filter: 'id=eq.global' 
      }, (payload) => {
        mergeSiteSettings(payload.new as any);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auth Subscription & Profile Synchronization
  useEffect(() => {
    const syncUserProfile = async (sessionUser: any) => {
      if (!sessionUser || !supabase) return;
      try {
        setDbSyncStatus({
          show: true,
          message: language === 'en' ? 'Synchronizing account database...' : 'ডাটাবেজের সাথে অ্যাকাউন্ট সিঙ্ক করা হচ্ছে...',
          type: 'syncing'
        });

        const { id, email, user_metadata } = sessionUser;
        const displayName = user_metadata?.full_name || user_metadata?.name || email?.split('@')[0] || '';
        const photoUrl = user_metadata?.avatar_url || '';
        
        const { data: existingProfile, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching existing profile:', fetchError);
        }
          
        let syncCompletedSuccessfully = false;

        if (!existingProfile) {
          const { error: insertError } = await supabase.from('users').insert({
            id: id,
            display_name: displayName,
            photo_url: photoUrl,
            updated_at: new Date().toISOString()
          });
          if (insertError) {
            console.error('Insert error syncing user profile:', insertError);
            setDbSyncStatus({
              show: true,
              message: language === 'en' ? 'Database sync error! Profile not initialized.' : 'ডাটাবেজে প্রোফাইল তথ্য সংরক্ষণে সমস্যা হয়েছে!',
              type: 'error'
            });
            setTimeout(() => {
              setDbSyncStatus(prev => ({ ...prev, show: false }));
            }, 4000);
          } else {
            syncCompletedSuccessfully = true;
          }
        } else {
          const updates: any = {};
          let needsUpdate = false;
          if (!existingProfile.display_name && displayName) {
            updates.display_name = displayName;
            needsUpdate = true;
          }
          if (!existingProfile.photo_url && photoUrl) {
            updates.photo_url = photoUrl;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            updates.updated_at = new Date().toISOString();
            const { error: updateError } = await supabase
              .from('users')
              .update(updates)
              .eq('id', id);
            if (updateError) {
              console.error('Update error syncing user profile:', updateError);
            }
          }
          syncCompletedSuccessfully = true;
        }

        if (syncCompletedSuccessfully) {
          const finalProfile = existingProfile || {
            display_name: displayName,
            photo_url: photoUrl
          };

          // Merge db fields into active React user state
          setUser((currentUser: any) => {
            if (!currentUser || currentUser.id !== id) return currentUser;
            return {
              ...currentUser,
              displayName: finalProfile.display_name || currentUser.displayName,
              photoURL: finalProfile.photo_url || currentUser.photoURL,
              phone: finalProfile.phone || currentUser.phone || '',
              address: finalProfile.address || currentUser.address || '',
              city: finalProfile.city || currentUser.city || '',
              area: finalProfile.area || currentUser.area || '',
              bio: finalProfile.bio || currentUser.bio || '',
              user_metadata: {
                ...currentUser.user_metadata,
                full_name: finalProfile.display_name || currentUser.user_metadata?.full_name,
                avatar_url: finalProfile.photo_url || currentUser.user_metadata?.avatar_url,
              }
            };
          });

          // Trigger local backup and Google Sheet webhook sync!
          try {
            const customerPayload = {
              id: id,
              name: finalProfile.display_name || displayName,
              email: email || undefined,
              phone: finalProfile.phone || undefined,
              address: finalProfile.address || undefined,
              city: finalProfile.city || undefined,
              area: finalProfile.area || undefined,
              bio: finalProfile.bio || undefined,
              updated_at: new Date().toISOString()
            };
            saveLocalUserBackup(customerPayload);
            syncCustomerToGoogleSheets(customerPayload);
          } catch (syncErr) {
            console.error('Error dispatching automated Google Sheets sync:', syncErr);
          }

          setDbSyncStatus({
            show: true,
            message: language === 'en' ? 'Database synced! Account successfully saved. ✅' : 'সফল হয়েছে! অ্যাকাউন্ট ডাটাবেজে অটো সেভ করা হয়েছে। ✅',
            type: 'success'
          });
          setTimeout(() => {
            setDbSyncStatus(prev => ({ ...prev, show: false }));
          }, 3500);
        }
      } catch (err) {
        console.error('Error syncing user profile:', err);
        setDbSyncStatus({
          show: true,
          message: language === 'en' ? 'Database sync error.' : 'ডাটাবেজ সিঙ্ক সমস্যা।',
          type: 'error'
        });
        setTimeout(() => {
          setDbSyncStatus(prev => ({ ...prev, show: false }));
        }, 3000);
      }
    };

    const checkUserAdminStatus = async (currentUser: any) => {
      if (!currentUser || !supabase) {
        setIsAdmin(false);
        return;
      }
      try {
        let { data } = await supabase
          .from('admins')
          .select('id, email')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        let isAuthorized = !!data;

        if (!isAuthorized && currentUser.email) {
          const { data: adminByEmail } = await supabase
            .from('admins')
            .select('*')
            .eq('email', currentUser.email)
            .maybeSingle();

          if (adminByEmail) {
            isAuthorized = true;
            // Map their proper authenticated uid to the record
            await supabase
              .from('admins')
              .update({ id: currentUser.id })
              .eq('email', currentUser.email);
          }
        }
        
        if (!isAuthorized && currentUser.email === 'careers.growthexpress@gmail.com') {
          // Auto-add default Super Admin email to prevent initial setup lockouts
          const { error: insertError } = await supabase
            .from('admins')
            .insert({
              id: currentUser.id,
              email: currentUser.email,
              created_at: new Date().toISOString()
            });
          if (!insertError) {
            isAuthorized = true;
          } else {
            console.error('Error auto-registering super admin on launch:', insertError);
            isAuthorized = true; // allow recovery session fallback
          }
        }
        setIsAdmin(isAuthorized);
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
    };

    // Check if URL hash indicates a recovery flow on mount
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setShowResetPasswordModal(true);
    }

    const syncMockAuth = () => {
      const mockStr = localStorage.getItem('mock_user_session');
      if (mockStr) {
        try {
          let parsed = JSON.parse(mockStr);
          if (parsed) {
            // Also merge cached profile details if available
            const mockProfileStr = localStorage.getItem(`mock_profile_${parsed.id}`);
            if (mockProfileStr) {
              try {
                const localProfile = JSON.parse(mockProfileStr);
                parsed = {
                  ...parsed,
                  displayName: localProfile.displayName || parsed.displayName,
                  photoURL: localProfile.photoURL || parsed.photoURL,
                  phone: localProfile.phone || '',
                  address: localProfile.address || '',
                  city: localProfile.city || '',
                  area: localProfile.area || '',
                  bio: localProfile.bio || '',
                  user_metadata: {
                    ...parsed.user_metadata,
                    full_name: localProfile.displayName || parsed.user_metadata?.full_name,
                    avatar_url: localProfile.photoURL || parsed.user_metadata?.avatar_url,
                  }
                };
              } catch (profileErr) {
                console.error('Error merging offline profile in syncMockAuth:', profileErr);
              }
            }
            setUser(parsed);
            if (parsed.email === 'careers.growthexpress@gmail.com') {
              setIsAdmin(true);
            } else {
              checkUserAdminStatus(parsed);
            }
            return true;
          }
        } catch (e) {
          console.error('Error parsing mock session:', e);
        }
      }
      return false;
    };

    const hasMock = syncMockAuth();
    window.addEventListener('mock_auth_change', syncMockAuth);

    const handleProfileUpdate = () => {
      const mockStr = localStorage.getItem('mock_user_session');
      if (mockStr) {
        syncMockAuth();
      } else if (supabase) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const currentUser = session?.user ?? null;
          if (currentUser) {
            syncUserProfile(currentUser);
          }
        });
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdate);

    let unsubscribeFn = () => {};

    if (supabase) {
      if (!hasMock) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          checkUserAdminStatus(currentUser);
          if (currentUser) {
            syncUserProfile(currentUser);
          }
        });
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // If we are currently utilizing a mock auth session, don't overwrite it here
        if (localStorage.getItem('mock_user_session')) {
          syncMockAuth();
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        checkUserAdminStatus(currentUser);
        
        if (currentUser && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          syncUserProfile(currentUser);
        }

        if (event === 'PASSWORD_RECOVERY') {
          setShowResetPasswordModal(true);
        }
      });

      unsubscribeFn = () => subscription.unsubscribe();
    }

    return () => {
      window.removeEventListener('mock_auth_change', syncMockAuth);
      window.removeEventListener('user_profile_updated', handleProfileUpdate);
      unsubscribeFn();
    };
  }, []);

  // Products Subscription
  useEffect(() => {
    const fetchProducts = async () => {
      const localProductsStr = localStorage.getItem('yummydash_custom_products');
      let baseProducts = [...STATIC_PRODUCTS];
      if (localProductsStr) {
        try {
          const localProducts = JSON.parse(localProductsStr) as Product[];
          if (Array.isArray(localProducts)) {
            const staticIds = new Set(STATIC_PRODUCTS.map(p => p.id));
            
            // Map static products, overriding any with local versions if they exist
            const merged = STATIC_PRODUCTS.map(sp => {
              const lp = localProducts.find(p => p.id === sp.id);
              return lp ? { ...sp, ...lp } : sp;
            });
            
            // Append local products that are not present in static products
            const extraLocalProducts = localProducts.filter(lp => lp && lp.id && !staticIds.has(lp.id));
            baseProducts = [...merged, ...extraLocalProducts];
          }
        } catch (e) {
          console.error('Error parsing local products in App:', e);
        }
      }

      // Merge local product-specific delivery charges
      const applyCustomCharges = (prods: Product[]) => {
        try {
          const localChargesStr = localStorage.getItem('yummydash_product_delivery_charges');
          if (localChargesStr) {
            const localCharges = JSON.parse(localChargesStr);
            return prods.map(p => ({
              ...p,
              deliveryCharge: localCharges[p.id] !== undefined ? Number(localCharges[p.id]) : p.deliveryCharge
            }));
          }
        } catch (err) {
          console.error('Error merging product delivery charges:', err);
        }
        return prods;
      };

      const sanitizeUniqueProducts = (prods: Product[]) => {
        const seen = new Set<string>();
        return prods.filter(p => {
          if (!p || !p.id) return false;
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      };

      if (!supabase) {
        setProducts(sanitizeUniqueProducts(applyCustomCharges(baseProducts)));
        return;
      }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error("Supabase products error:", error);
        setProducts(sanitizeUniqueProducts(applyCustomCharges(baseProducts)));
      } else {
        // If Supabase is active and returns data successfully, we should use it.
        // However, if the database is completely empty (0 products) and there is no local custom products
        // (meaning it's a first-time visit with an unseeded database), we can fallback to baseProducts (demo products)
        // so the site doesn't look blank. But if local custom products was cleared explicitly (set to []),
        // or if the user wants an empty catalog, we respect that.
        const dbProds = (data.length === 0 && localProductsStr === null) ? baseProducts : (data as Product[]);
        setProducts(sanitizeUniqueProducts(applyCustomCharges(dbProds)));
      }
    };

    fetchProducts();

    const handleLocalProductsChange = () => {
      fetchProducts();
    };
    window.addEventListener('yummydash_products_change', handleLocalProductsChange);

    if (!supabase) {
      return () => {
        window.removeEventListener('yummydash_products_change', handleLocalProductsChange);
      };
    }

    const channel = supabase
      .channel('products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      window.removeEventListener('yummydash_products_change', handleLocalProductsChange);
      supabase.removeChannel(channel);
    };
  }, []);

  // Featured Slider Logic
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredProducts = useMemo(() => products.filter(p => p.isNew).slice(0, 4), [products]);

  const slides = useMemo(() => {
    if (siteSettings.companyInfo?.sliders && siteSettings.companyInfo.sliders.length > 0) {
      return siteSettings.companyInfo.sliders;
    }
    // Fallback to featuredProducts
    return featuredProducts.map(p => ({
      id: p.id,
      image: p.image || '',
      titleEn: p.name,
      titleBn: p.nameBn || p.name,
      subtitleEn: p.description || '',
      subtitleBn: p.descriptionBn || p.description || '',
      linkProductId: p.id,
      price: p.price
    }));
  }, [siteSettings.companyInfo?.sliders, featuredProducts]);

  useEffect(() => {
    if (slides.length === 0) return;
    setFeaturedIndex(0); // reset index when list changes
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;
    const interval = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  // Cart Logic
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

  const shippingCost = useMemo(() => {
    // 1. Fallback to site settings if delivery charge is disabled
    const isDeliveryChargeEnabled = siteSettings.companyInfo && siteSettings.companyInfo.deliveryChargeEnabled !== undefined
      ? !!siteSettings.companyInfo.deliveryChargeEnabled
      : false;
    
    if (!isDeliveryChargeEnabled) return 0;
    
    const threshold = siteSettings.companyInfo && siteSettings.companyInfo.deliveryFreeThreshold !== undefined
      ? Number(siteSettings.companyInfo.deliveryFreeThreshold) || 1000
      : 1000;
      
    const inside = siteSettings.companyInfo && siteSettings.companyInfo.deliveryChargeInside !== undefined
      ? Number(siteSettings.companyInfo.deliveryChargeInside) || 60
      : 60;
      
    const outside = siteSettings.companyInfo && siteSettings.companyInfo.deliveryChargeOutside !== undefined
      ? Number(siteSettings.companyInfo.deliveryChargeOutside) || 120
      : 120;
      
    const standardGlobalCharge = cartTotal >= threshold ? 0 : (checkoutForm.deliveryZone === 'outside' ? outside : inside);
    
    if (cart.length === 0) return 0;

    let maxEffectiveCharge = 0;
    let hasCustomProductCharge = false;
    
    cart.forEach(item => {
      let itemCharge = 0;
      if (item.deliveryCharge !== undefined && item.deliveryCharge !== null && item.deliveryCharge >= 0) {
        itemCharge = Number(item.deliveryCharge);
        hasCustomProductCharge = true;
      } else {
        itemCharge = standardGlobalCharge;
      }
      if (itemCharge > maxEffectiveCharge) {
        maxEffectiveCharge = itemCharge;
      }
    });
    
    if (!hasCustomProductCharge) {
      return standardGlobalCharge;
    }
    
    return maxEffectiveCharge;
  }, [siteSettings, cartTotal, checkoutForm.deliveryZone, cart]);

  const finalCategories = useMemo(() => {
    if (siteSettings.companyInfo?.categories && siteSettings.companyInfo.categories.length > 0) {
      return siteSettings.companyInfo.categories;
    }
    return CATEGORIES.filter(c => c.en !== 'All');
  }, [siteSettings.companyInfo?.categories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => {
      const matchesCategory = homeTab !== 'categories' || selectedCategory === 'All' || p.category === selectedCategory;
      const matchesOffer = homeTab !== 'offers' || (p.isOffer || (p.discount !== undefined && p.discount > 0));
      
      if (!q) {
        return matchesCategory && matchesOffer;
      }

      // Check all available matching text dimensions using fuzzy matching algorithm
      const matchesSearch = isFuzzyMatch(q, p.name || '') ||
                            isFuzzyMatch(q, p.nameBn || '') ||
                            isFuzzyMatch(q, p.description || '') ||
                            isFuzzyMatch(q, p.descriptionBn || '') ||
                            isFuzzyMatch(q, p.category || '') ||
                            isFuzzyMatch(q, p.categoryBn || '');

      return matchesCategory && matchesSearch && matchesOffer;
    });
  }, [products, selectedCategory, searchQuery, homeTab]);

  const newArrivals = useMemo(() => products.filter(p => p.isNew), [products]);
  const specialOffers = useMemo(() => products.filter(p => p.isOffer), [products]);

  // Smooth scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Track website visits automatically
  useEffect(() => {
    const trackVisit = async () => {
      try {
        const { registerVisitorVisit } = await import('./lib/webhook');
        let loggedInDetails = undefined;
        if (user) {
          loggedInDetails = {
            name: user.user_metadata?.full_name || user.displayName || user.email || 'Registered User',
            email: user.email || undefined,
            phone: user.phone || undefined
          };
        }
        
        let pageLabel = currentPage;
        if (currentPage === 'home') {
          pageLabel = `Home Feed (${homeTab})`;
        } else if (currentPage === 'product') {
          pageLabel = 'Product Details';
        } else if (currentPage === 'checkout') {
          pageLabel = 'Checkout Form';
        } else if (currentPage === 'success') {
          pageLabel = 'Order Success Landing';
        } else if (currentPage === 'profile') {
          pageLabel = 'User Self Profile';
        }
        
        registerVisitorVisit(`YummyDash - ${pageLabel}`, loggedInDetails);
      } catch (err) {
        console.error('Error triggered during visit registration:', err);
      }
    };
    trackVisit();
  }, [currentPage, homeTab, user]);

  const handleCheckout = () => {
    setIsCartOpen(false);
    
    // Auto-populate checkout form with user profile details if logged in
    if (user) {
      const displayName = user.displayName || user.user_metadata?.full_name || '';
      let fName = '';
      let lName = '';
      if (displayName) {
        const parts = displayName.trim().split(' ');
        if (parts.length > 1) {
          fName = parts[0];
          lName = parts.slice(1).join(' ');
        } else {
          fName = displayName;
        }
      }
      setCheckoutForm(prev => ({
        ...prev,
        firstName: prev.firstName || fName,
        lastName: prev.lastName || lName,
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
        address: prev.address || user.address || '',
        city: prev.city || user.city || '',
        area: prev.area || user.area || ''
      }));
    }

    setCurrentPage('checkout');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setIsPlacingOrder(true);
    try {
      const generatedOrderId = 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const isValidUUID = (str: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      };

      const isUidValid = user?.id && isValidUUID(user.id);
      
      const orderData = {
        user_id: isUidValid ? user.id : null,
        items: cart,
        total: cartTotal + shippingCost,
        customer: checkoutForm,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!supabase) {
        // Local storage fallback
        const offlineOrder = { ...orderData, id: generatedOrderId };
        
        // Always store locally so that the admin can see and manage orders in the admin panel
        const localOrdersStr = localStorage.getItem('yummydash_custom_orders');
        let localOrders = [];
        if (localOrdersStr) {
          try {
            localOrders = JSON.parse(localOrdersStr);
          } catch (err) {
            console.error('Error parsing local orders on place:', err);
          }
        }
        localOrders.unshift(offlineOrder);
        localStorage.setItem('yummydash_custom_orders', JSON.stringify(localOrders));
        window.dispatchEvent(new Event('yummydash_orders_change'));

        // Try syncing to Google Sheets webhook in the background
        try {
          const { syncOrderToGoogleSheets } = await import('./lib/webhook');
          await syncOrderToGoogleSheets(offlineOrder);
        } catch (e) {
          console.error('Failed to auto-sync order on place:', e);
        }

        // Update local stock
        const localProductsStr = localStorage.getItem('yummydash_custom_products');
        let localProducts = [...STATIC_PRODUCTS];
        if (localProductsStr) {
          try {
            localProducts = JSON.parse(localProductsStr);
          } catch (err) {
            console.error('Error parsing local products on place:', err);
          }
        }

        const updatedProducts = localProducts.map(p => {
          const cartItem = cart.find(item => item.id === p.id);
          if (cartItem && p.stock !== undefined) {
            return { ...p, stock: Math.max(0, p.stock - cartItem.quantity), updated_at: new Date().toISOString() };
          }
          return p;
        });
        localStorage.setItem('yummydash_custom_products', JSON.stringify(updatedProducts));
        window.dispatchEvent(new Event('yummydash_products_change'));

        setLastOrder(generatedOrderId);
        setCart([]);
        setCheckoutStep(1);
        setCurrentPage('success');
        return;
      }
      
      let data, error;
      try {
        const res = await supabase
          .from('orders')
          .insert([orderData])
          .select()
          .single();
        data = res.data;
        error = res.error;
      } catch (insertErr) {
        if (orderData.user_id) {
          console.warn('Foreign key sync constraint issue detected. Retrying order placement without profile user_id...', insertErr);
          const fallbackOrderData = { ...orderData, user_id: null };
          const res = await supabase
            .from('orders')
            .insert([fallbackOrderData])
            .select()
            .single();
          data = res.data;
          error = res.error;
        } else {
          throw insertErr;
        }
      }

      if (error) throw error;

      // Cache successfully placed database order in local storage as well for seamless instant retrieval
      const localOrdersStr = localStorage.getItem('yummydash_custom_orders');
      let localOrders = [];
      if (localOrdersStr) {
        try {
          localOrders = JSON.parse(localOrdersStr);
        } catch (err) {
          console.error('Error parsing local orders on place:', err);
        }
      }
      localOrders.unshift(data);
      localStorage.setItem('yummydash_custom_orders', JSON.stringify(localOrders));
      window.dispatchEvent(new Event('yummydash_orders_change'));

      setLastOrder(data.id);
      setCart([]);
      setCheckoutStep(1);
      setCurrentPage('success');
      
      // Update stock for each item
      for (const item of cart) {
        if (item.stock !== undefined) {
          const newStock = Math.max(0, item.stock - item.quantity);
          await supabase
            .from('products')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', item.id);
        }
      }

      // Sync to Google Sheet if enabled (in the background, keeping the record in Supabase for Admin viewing)
      try {
        const { syncOrderToGoogleSheets } = await import('./lib/webhook');
        await syncOrderToGoogleSheets(data);
      } catch (syncErr) {
        console.error('Failed background syncing order to Google Sheets:', syncErr);
      }

    } catch (error) {
      console.error("Order error:", error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Impersonation Warning Banner */}
      {localStorage.getItem("admin_impersonator_session") && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white font-bold py-2 px-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs md:text-sm shadow-md animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>
              {language === "en"
                ? `🚨 IMPERSONATOR MODE ACTIVE: You are logged in as "${user?.displayName || user?.email || 'Customer'}"`
                : `🚨 অ্যাডমিন ইমপারসোনেশন সক্রিয়: আপনি এখন "${user?.displayName || user?.email || 'গ্রাহক'}" হয়ে ব্রাউজ করছেন`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const adminSession = localStorage.getItem("admin_impersonator_session");
                if (adminSession) {
                  if (adminSession === "supabase_admin") {
                    localStorage.removeItem("mock_user_session");
                    localStorage.removeItem("admin_impersonator_session");
                  } else {
                    localStorage.setItem("mock_user_session", adminSession);
                    localStorage.removeItem("admin_impersonator_session");
                  }
                  window.dispatchEvent(new Event("mock_auth_change"));
                  setShowAdminPanel(true);
                  alert(
                    language === "en"
                      ? "Returned to administrator session successfully!"
                      : "আপনার অ্যাডমিন সেশন পুনরায় চালু করা হয়েছে!"
                  );
                }
              }}
              className="px-3 py-1 bg-white hover:bg-neutral-100 text-amber-700 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
            >
              {language === "en" ? "Return to Admin" : "এডমিন প্যানেলে ফিরুন"}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("mock_user_session");
                localStorage.removeItem("admin_impersonator_session");
                window.dispatchEvent(new Event("mock_auth_change"));
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
            >
              {language === "en" ? "Log Out All" : "লগআউট করুন"}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`glass-nav fixed ${localStorage.getItem("admin_impersonator_session") ? "top-[44px]" : "top-0"} left-0 right-0 z-40 px-6`}>
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setCurrentPage('home')}
              className="flex items-center gap-3 group"
              id="logo-button"
            >
              {siteSettings.logoUrl ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-xl shadow-amber-900/10 group-hover:scale-110 transition-transform">
                  <img src={siteSettings.logoUrl} className="w-full h-full object-contain" alt="Yummy Express" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-600/20 text-white font-black italic">
                  Y
                </div>
              )}
              <span className="text-xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent tracking-tight">
                {language === 'en' ? (siteSettings.heroTitle || t.logo) : t.logo}
              </span>
            </button>
            <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
              <button 
                onClick={() => {
                  setCurrentPage('home');
                  setHomeTab('all');
                  setSelectedCategory('All');
                  setShowOffersOnly(false);
                }}
                className={`transition-colors font-bold ${currentPage === 'home' && homeTab === 'all' ? 'text-amber-600' : 'hover:text-slate-950'}`}
              >
                {t.navHome}
              </button>
              <button 
                onClick={() => {
                  setCurrentPage('home');
                  setHomeTab('categories');
                  setSelectedCategory('All');
                  setShowOffersOnly(false);
                }}
                className={`transition-colors font-bold ${currentPage === 'home' && homeTab === 'categories' ? 'text-amber-600' : 'hover:text-slate-950'}`}
              >
                {t.navCatalog}
              </button>
              <button 
                onClick={() => {
                  setCurrentPage('home');
                  setHomeTab('offers');
                  setSelectedCategory('All');
                  setShowOffersOnly(true);
                }}
                className={`transition-colors font-bold ${currentPage === 'home' && homeTab === 'offers' ? 'text-amber-600' : 'hover:text-slate-950'}`}
              >
                {t.navCollections}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <button 
                onClick={() => setCurrentPage('profile')}
                className={`group flex items-center gap-2 p-1 pr-4 border rounded-full transition-all ${currentPage === 'profile' ? 'bg-amber-600 border-amber-600' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50 shadow-sm'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all ${currentPage === 'profile' ? 'border-white bg-slate-800 text-white' : 'border-white bg-slate-900 text-white group-hover:scale-105'}`}>
                  {user.user_metadata?.avatar_url || user.photoURL ? (
                    <img src={user.user_metadata?.avatar_url || user.photoURL} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-[10px] font-black">{user.email?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div className="flex flex-col items-start leading-[1.2]">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${currentPage === 'profile' ? 'text-white' : 'text-slate-400 group-hover:text-amber-600'}`}>{language === 'en' ? 'My Account' : 'প্রোফাইল'}</span>
                  <span className={`text-[11px] font-bold truncate max-w-[100px] hidden lg:block ${currentPage === 'profile' ? 'text-amber-100' : 'text-slate-700'}`}>{user.user_metadata?.full_name?.split(' ')[0] || user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</span>
                </div>
              </button>
            ) : (
              <>
                {/* Desktop Login Button */}
                <button 
                  onClick={handleLogin}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-slate-500 hover:text-amber-600 transition-colors uppercase tracking-widest"
                >
                  {language === 'en' ? 'Log In / Sign Up' : 'লগইন / সাইন আপ'}
                </button>
                {/* Mobile Login Button */}
                <button 
                  onClick={handleLogin}
                  className="flex sm:hidden p-2 text-slate-400 hover:text-amber-600 transition-colors"
                  title={language === 'en' ? 'Log In / Sign Up' : 'লগইন / সাইন আপ'}
                >
                  <UserIcon className="w-6 h-6" />
                </button>
              </>
            )}
            
            <button
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-2 p-2 px-3 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600 bg-slate-100 rounded-full transition-all"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input w-64"
              />
            </div>
            <button 
              id="cart-toggle"
              onClick={() => setIsCartOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 relative"
            >
              <ShoppingBag className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute top-1 right-1 bg-amber-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm">
                  {cart.length}
                </span>
              )}
            </button>
            <button 
              className="md:hidden p-2 text-slate-400 hover:text-slate-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-100 p-6 z-40 space-y-6 shadow-xl"
            >
              {/* Search in mobile */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                />
              </div>
              
              <nav className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    setCurrentPage('home');
                    setHomeTab('all');
                    setSelectedCategory('All');
                    setShowOffersOnly(false);
                    setIsMenuOpen(false);
                  }}
                  className={`text-left text-sm font-bold uppercase tracking-widest py-2 transition-colors ${currentPage === 'home' && homeTab === 'all' ? 'text-amber-600' : 'text-slate-500'}`}
                >
                  {t.navHome}
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('home');
                    setHomeTab('categories');
                    setSelectedCategory('All');
                    setShowOffersOnly(false);
                    setIsMenuOpen(false);
                  }}
                  className={`text-left text-sm font-bold uppercase tracking-widest py-2 transition-colors ${currentPage === 'home' && homeTab === 'categories' ? 'text-amber-600' : 'text-slate-500'}`}
                >
                  {t.navCatalog}
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('home');
                    setHomeTab('offers');
                    setSelectedCategory('All');
                    setShowOffersOnly(true);
                    setIsMenuOpen(false);
                  }}
                  className={`text-left text-sm font-bold uppercase tracking-widest py-2 transition-colors ${currentPage === 'home' && homeTab === 'offers' ? 'text-amber-600' : 'text-slate-500'}`}
                >
                  {t.navCollections}
                </button>
              </nav>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                    className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    {language === 'en' ? 'বাংলা' : 'English'}
                  </button>
                  <button 
                    onClick={() => {
                      setCurrentPage('home');
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-600"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {t.cart} ({cart.length})
                  </button>
                </div>
                
                {user ? (
                  <div className="space-y-3">
                    <button 
                      onClick={() => {
                        setCurrentPage('profile');
                        setIsMenuOpen(false);
                      }}
                      className="w-full p-4 bg-slate-900 rounded-2xl flex items-center gap-4 text-left shadow-lg"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                        {user.user_metadata?.avatar_url || user.photoURL ? (
                          <img src={user.user_metadata?.avatar_url || user.photoURL} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-amber-500 flex items-center justify-center text-white font-bold">
                            {user.email?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm leading-tight">{user.user_metadata?.full_name || user.displayName || user.email?.split('@')[0]}</p>
                        <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-0.5">{language === 'en' ? 'Manage Account' : 'অ্যাকাউন্ট পরিচালনা'}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </button>
                    <button 
                      onClick={async () => {
                        localStorage.removeItem('mock_user_session');
                        setUser(null);
                        setIsAdmin(false);
                        if (supabase) {
                          try {
                            await supabase.auth.signOut();
                          } catch (err) {
                            console.error('Logout error:', err);
                          }
                        }
                        setIsMenuOpen(false);
                      }}
                      className="w-full py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-3 h-3" />
                      {language === 'en' ? 'Logout' : 'লগআউট'}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      handleLogin();
                      setIsMenuOpen(false);
                    }}
                    className="w-full py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-900/10 active:scale-95 transition-all"
                  >
                    {language === 'en' ? 'Log In / Create Account' : 'লগইন / নতুন অ্যাকাউন্ট'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className={`transition-all duration-500 ${localStorage.getItem("admin_impersonator_session") ? "pt-[112px]" : "pt-16"} ${isCartOpen ? 'md:pr-[320px]' : ''}`}>
        <AnimatePresence mode="wait">
          {currentPage === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-24 pb-24"
            >
              {/* Hero Section */}
              {slides.length > 0 && (
                <section className="relative h-[500px] rounded-2xl overflow-hidden bg-slate-900 mx-6 shadow-2xl">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={featuredIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0"
                    >
                      <img 
                        src={slides[featuredIndex]?.image || undefined} 
                        alt={language === 'en' ? slides[featuredIndex]?.titleEn : slides[featuredIndex]?.titleBn}
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                      />
                      <div className="absolute inset-0 hero-gradient z-10" />
                      
                      <div className="relative z-20 h-full flex flex-col justify-center px-12 md:px-24">
                        <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="max-w-4xl text-white space-y-6"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] bg-amber-400/10 px-3 py-1 rounded-full backdrop-blur-sm border border-amber-400/20">{t.seasonalDrop}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{featuredIndex + 1} / {slides.length}</span>
                        </div>
                        
                        <h1 className="text-5xl md:text-8xl font-black text-white leading-tight tracking-tighter italic uppercase">
                          {language === 'en' ? slides[featuredIndex]?.titleEn : slides[featuredIndex]?.titleBn}
                        </h1>
                        
                        <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl leading-relaxed line-clamp-2">
                          {language === 'en' ? slides[featuredIndex]?.subtitleEn : slides[featuredIndex]?.subtitleBn}
                        </p>
                          
                          <div className="flex items-center gap-8 pt-4">
                            {slides[featuredIndex]?.linkProductId ? (
                              <button 
                                onClick={() => {
                                  const linkedProd = products.find(p => p.id === slides[featuredIndex]?.linkProductId);
                                  if (linkedProd) setSelectedProduct(linkedProd);
                                }}
                                className="px-10 py-4 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 shadow-xl shadow-amber-900/40 transition-all active:scale-[0.98]"
                              >
                                {t.shopNow} {slides[featuredIndex]?.price ? `— ৳${slides[featuredIndex].price}` : ''}
                              </button>
                            ) : null}
                            
                            <div className="flex gap-2">
                              {slides.map((_, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setFeaturedIndex(idx)}
                                  className={`w-8 h-1 rounded-full transition-all duration-300 ${idx === featuredIndex ? 'bg-amber-500 w-12' : 'bg-white/30 hover:bg-white/50'}`}
                                />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </section>
              )}

               {/* Dynamic Tabbed Experience: Home (all), Catalog (categories), Offers (offers) */}
              {homeTab === 'all' && (
                <div className="space-y-16 py-10">
                  {/* All Products Grid */}
                  <section id="catalog" className="max-w-7xl mx-auto px-6 space-y-8">
                    <div className="border-b border-slate-100 pb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                          {language === 'en' ? 'All Gourmet Dishes' : 'আমাদের সকল পণ্যসমূহ'}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                          {language === 'en' ? 'Explore our complete menu crafted by master chefs' : 'মাস্টার শেফদের পরম যত্নে তৈরি আমাদের সম্পূর্ণ মেনু অন্বেষণ করুন'}
                        </p>
                      </div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-4 py-2 rounded-full">
                        {filteredProducts.length} {language === 'en' ? 'Items' : 'টি পণ্য'}
                      </div>
                    </div>
                    
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <p className="text-sm font-bold text-slate-400">
                          {language === 'en' ? 'No products matches your criteria.' : 'কোন পণ্য পাওয়া যায়নি।'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {filteredProducts.map((p, idx) => (
                          <ProductCard 
                            key={p.id} 
                            product={p} 
                            onClick={() => setSelectedProduct(p)} 
                            priority={idx < 8}
                            language={language}
                            isFavorited={favorites.includes(p.id)}
                            onToggleFavorite={(e) => {
                              e.stopPropagation();
                              toggleFavorite(p.id);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Special Offers Section Banner */}
                  <section className="bg-slate-900 py-20 mx-6 rounded-[2rem] overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-900/50 to-transparent z-10"></div>
                    <div className="relative z-20 max-w-7xl mx-auto px-10 grid grid-cols-1 md:grid-cols-2 items-center gap-10">
                      <div className="space-y-4">
                        <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">{t.seasonalDrop}</span>
                        <h2 className="text-5xl font-black text-white leading-tight italic uppercase">
                            {siteSettings.heroTitle && (language === 'en' ? siteSettings.heroTitle : siteSettings.heroTitleBn) || t.heroTitle}
                        </h2>
                        <p className="text-slate-300 text-base max-w-sm">
                            {siteSettings.heroDesc && (language === 'en' ? siteSettings.heroDesc : siteSettings.heroDescBn) || t.heroDesc}
                        </p>
                        <button 
                          onClick={() => {
                            setHomeTab('offers');
                            document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                          }} 
                          className="w-fit px-10 py-4 bg-amber-600 text-white text-xs font-black uppercase tracking-widest rounded-full hover:bg-amber-700 shadow-2xl shadow-amber-900/40 transition-all hover:scale-105"
                        >
                          {language === 'en' ? 'View Offers' : 'অফার সমূহ দেখুন'}
                        </button>
                      </div>
                      <div className="hidden md:flex gap-4 justify-end">
                        {specialOffers.slice(0, 1).map((p) => (
                          <div key={p.id} className="w-48 h-64 bg-slate-800 rounded-xl shadow-2xl relative group overflow-hidden cursor-pointer" onClick={() => setSelectedProduct(p)}>
                            <img src={p.image || undefined} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" alt={language === 'en' ? p.name : p.nameBn} />
                            <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-slate-900 via-transparent">
                              <p className="text-xs font-bold text-white truncate">{language === 'en' ? p.name : p.nameBn}</p>
                              <PriceDisplay 
                                product={p} 
                                className="flex items-center gap-1.5 flex-wrap" 
                                priceClassName="text-xs text-amber-400 font-bold" 
                                regularPriceClassName="text-slate-400 text-[9px]" 
                              />
                            </div>
                          </div>
                        ))}
                        <div className="w-48 h-64 bg-amber-500 rounded-xl shadow-2xl skew-x-3 -ml-12 border-4 border-slate-900 relative overflow-hidden hidden lg:block">
                          <div className="absolute inset-0 flex items-center justify-center text-4xl font-black text-amber-700/30 select-none uppercase tracking-tighter">YUMMY.</div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {homeTab === 'categories' && (
                <div className="py-10">
                  {selectedCategory === 'All' ? (
                    <section id="catalog" className="max-w-7xl mx-auto px-6 space-y-8 animate-in fade-in duration-300">
                      <div className="border-b border-slate-100 pb-6 flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                            {language === 'en' ? 'Gourmet Categories' : 'খাবারের ক্যাটাগরি সমূহ'}
                          </h2>
                          <p className="text-sm text-slate-400 mt-1">
                            {language === 'en' ? 'Select a category to explore authentic mouthwatering recipes' : 'আমাদের প্রতিটি অনন্য স্বাদের খাবারের ক্যাটাগরিগুলো থেকে বেছে নিন'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {finalCategories.map(cat => {
                          const count = products.filter(p => p.category === cat.en).length;
                          return (
                            <button
                              key={cat.en}
                              onClick={() => setSelectedCategory(cat.en)}
                              className="group relative w-full h-64 rounded-[2rem] overflow-hidden transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-102 border border-slate-100 focus:outline-none"
                            >
                              <img src={cat.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-115" alt={cat.en} />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent opacity-90 transition-opacity" />
                              <div className="absolute inset-0 p-6 flex flex-col justify-end items-start text-left">
                                <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/20 mb-3 block">
                                  {count} {language === 'en' ? 'Dishes' : 'টি পণ্য'}
                                </span>
                                <span className="text-2xl font-black text-white tracking-tight uppercase">
                                  {language === 'en' ? cat.en : cat.bn}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="max-w-7xl mx-auto px-6 space-y-8 animate-in fade-in duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                        <div className="space-y-2">
                          <button
                            onClick={() => setSelectedCategory('All')}
                            className="flex items-center gap-2 text-xs font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest"
                          >
                            ← {language === 'en' ? 'Back to Categories' : 'সকল ক্যাটাগরিতে ফিরে যান'}
                          </button>
                          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 mt-1">
                            {language === 'en' ? selectedCategory : (finalCategories.find(c => c.en === selectedCategory)?.bn || selectedCategory)}
                          </h2>
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-4 py-2 rounded-full">
                          {filteredProducts.length} {language === 'en' ? 'Dishes Found' : 'টি সুস্বাদু খাবার পাওয়া গেছে'}
                        </div>
                      </div>
                      
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-24 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                          <p className="text-sm font-bold text-slate-400">
                            {language === 'en' ? 'No dishes available in this category yet.' : 'এই ক্যাটাগরিতে কোনো খাবার পাওয়া যায়নি।'}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {filteredProducts.map((p, idx) => (
                            <ProductCard 
                              key={p.id} 
                              product={p} 
                              onClick={() => setSelectedProduct(p)} 
                              priority={idx < 8}
                              language={language}
                              isFavorited={favorites.includes(p.id)}
                              onToggleFavorite={(e) => {
                                e.stopPropagation();
                                toggleFavorite(p.id);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}

              {homeTab === 'offers' && (
                <div className="py-10 animate-in fade-in duration-300">
                  <section className="max-w-7xl mx-auto px-6 space-y-8">
                    <div className="border-b border-slate-100 pb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                          {language === 'en' ? 'Special Discount Offers' : 'স্পেশাল ধামাকা অফার সমূহ'}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                          {language === 'en' ? 'Relish premium dishes with maximum savings' : 'সর্বোচ্চ ছাড়ের ধামাকা মূল্যে প্রিয় খাবারগুলো উপভোগ করুন'}
                        </p>
                      </div>
                      <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-full uppercase tracking-widest">
                        {filteredProducts.length} {language === 'en' ? 'Offers Active' : 'টি অফার চালু'}
                      </div>
                    </div>
                    
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-24 bg-rose-50/30 rounded-[2rem] border-2 border-dashed border-rose-200">
                        <p className="text-sm font-bold text-rose-800">
                          {language === 'en' ? 'No active promotional offers right now. Check back soon!' : 'এই মুহূর্তে কোনো অফার চালু নেই। অনুগ্রহ করে শীঘ্রই আবার ক্যাটাগরিগুলো দেখুন!'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {filteredProducts.map((p, idx) => (
                          <ProductCard 
                            key={p.id} 
                            product={p} 
                            onClick={() => setSelectedProduct(p)} 
                            priority={idx < 8}
                            language={language}
                            isFavorited={favorites.includes(p.id)}
                            onToggleFavorite={(e) => {
                              e.stopPropagation();
                              toggleFavorite(p.id);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

            </motion.div>
          ) : currentPage === 'checkout' ? (
            <motion.div
              key="checkout"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="max-w-6xl mx-auto px-6 py-12"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                <div className="lg:col-span-2 space-y-12">
                  <div className="space-y-4">
                    <button 
                      onClick={() => {
                        if (checkoutStep === 2) setCheckoutStep(1);
                        else setCurrentPage('home');
                      }}
                      className="text-amber-600 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:-translate-x-1 transition-transform"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180" />
                      {checkoutStep === 2 ? t.previousStep : 'Back to Menu'}
                    </button>
                    <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900">{t.checkout}</h1>
                    <div className="flex items-center gap-4">
                      <div className={`p-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest ${checkoutStep === 1 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        01 {t.stepDetails}
                      </div>
                      <div className="w-8 h-px bg-slate-200" />
                      <div className={`p-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest ${checkoutStep === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        02 {t.stepPayment}
                      </div>
                    </div>
                  </div>

                  {checkoutStep === 1 ? (
                    <form onSubmit={(e) => { e.preventDefault(); setCheckoutStep(2); }} className="space-y-10">
                      <div className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-4 border-slate-50">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.firstName}</label>
                            <input required value={checkoutForm.firstName} onChange={e => setCheckoutForm({...checkoutForm, firstName: e.target.value})} type="text" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.lastName}</label>
                            <input required value={checkoutForm.lastName} onChange={e => setCheckoutForm({...checkoutForm, lastName: e.target.value})} type="text" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.email}</label>
                            <input value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} type="email" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.phone}</label>
                            <input required value={checkoutForm.phone} onChange={e => setCheckoutForm({...checkoutForm, phone: e.target.value})} type="tel" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-lg font-bold" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-4 border-slate-50">Delivery Address</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Dynamic Delivery Zone Selector */}
                          {siteSettings.companyInfo?.deliveryChargeEnabled && (
                            <div className="md:col-span-2 space-y-3">
                              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">
                                {language === 'bn' ? 'ডেলিভারি এরিয়া / এলাকা নির্বাচন করুন' : 'Select Delivery Area / Zone'}
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                  type="button"
                                  onClick={() => setCheckoutForm({ 
                                    ...checkoutForm, 
                                    deliveryZone: 'inside', 
                                    city: checkoutForm.city ? checkoutForm.city : (language === 'bn' ? 'ঢাকা' : 'Dhaka')
                                  })}
                                  className={`p-5 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${
                                    checkoutForm.deliveryZone === 'inside'
                                      ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                                      : 'border-slate-100 bg-white hover:border-slate-200'
                                  }`}
                                >
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">
                                      {language === 'bn' ? 'ঢাকার ভিতরে (Inside Dhaka)' : 'Inside Dhaka'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      {cartTotal >= (Number(siteSettings.companyInfo?.deliveryFreeThreshold) || 1000)
                                        ? (language === 'bn' ? 'ফ্রি ডেলিভারি অফার!' : 'Free delivery offer!')
                                        : (language === 'bn' ? `চার্জ: ৳${siteSettings.companyInfo?.deliveryChargeInside || 60}` : `Charge: ৳${siteSettings.companyInfo?.deliveryChargeInside || 60}`)}
                                    </p>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    checkoutForm.deliveryZone === 'inside' ? 'border-amber-600' : 'border-slate-300'
                                  }`}>
                                    {checkoutForm.deliveryZone === 'inside' && <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />}
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setCheckoutForm({ 
                                    ...checkoutForm, 
                                    deliveryZone: 'outside'
                                  })}
                                  className={`p-5 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${
                                    checkoutForm.deliveryZone === 'outside'
                                      ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                                      : 'border-slate-100 bg-white hover:border-slate-200'
                                  }`}
                                >
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">
                                      {language === 'bn' ? 'ঢাকার বাইরে (Outside Dhaka)' : 'Outside Dhaka'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      {cartTotal >= (Number(siteSettings.companyInfo?.deliveryFreeThreshold) || 1000)
                                        ? (language === 'bn' ? 'ফ্রি ডেলিভারি অফার!' : 'Free delivery offer!')
                                        : (language === 'bn' ? `চার্জ: ৳${siteSettings.companyInfo?.deliveryChargeOutside || 120}` : `Charge: ৳${siteSettings.companyInfo?.deliveryChargeOutside || 120}`)}
                                    </p>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    checkoutForm.deliveryZone === 'outside' ? 'border-amber-600' : 'border-slate-300'
                                  }`}>
                                    {checkoutForm.deliveryZone === 'outside' && <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />}
                                  </div>
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.shippingAddress}</label>
                            <textarea required value={checkoutForm.address} onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})} rows={3} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all resize-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.city}</label>
                            <input required value={checkoutForm.city} onChange={e => setCheckoutForm({...checkoutForm, city: e.target.value})} type="text" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.area}</label>
                            <input required value={checkoutForm.area} onChange={e => setCheckoutForm({...checkoutForm, area: e.target.value})} type="text" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-4 border-slate-50">
                          {language === 'bn' ? 'ডেলিভারির সময় ও তারিখ' : 'Preferred Delivery Schedule'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.deliveryDateLabel}</label>
                            <input 
                              type="date" 
                              required
                              min={new Date().toISOString().split('T')[0]} 
                              value={checkoutForm.deliveryDate || ''} 
                              onChange={e => setCheckoutForm({...checkoutForm, deliveryDate: e.target.value})} 
                              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-slate-700" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">{t.deliveryTimeLabel}</label>
                            <input 
                              type="time" 
                              required
                              value={checkoutForm.deliveryTime || ''} 
                              onChange={e => setCheckoutForm({...checkoutForm, deliveryTime: e.target.value})} 
                              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-slate-700" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-4 border-slate-50">{t.orderNote}</h3>
                        <textarea placeholder="..." value={checkoutForm.note} onChange={e => setCheckoutForm({...checkoutForm, note: e.target.value})} rows={2} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all resize-none" />
                      </div>

                      <div className="pt-6">
                        <button 
                          className="w-full py-6 bg-slate-900 text-white rounded-[2rem] text-lg font-black uppercase tracking-[0.2em] hover:bg-amber-600 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-slate-900/20 active:scale-[0.98]"
                        >
                          {t.nextStep}
                          <ArrowRight className="w-6 h-6" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handlePlaceOrder} className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-4 border-slate-50">{t.selectPayment}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            { id: 'cod', name: t.cod, color: 'slate' },
                            { id: 'bkash', name: t.bkash, color: 'pink' },
                            { id: 'nagad', name: t.nagad, color: 'orange' },
                            { id: 'rocket', name: t.rocket, color: 'purple' }
                          ].map((method) => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setCheckoutForm({...checkoutForm, paymentMethod: method.id as any})}
                              className={`p-6 rounded-2xl border-2 flex items-center gap-4 transition-all ${checkoutForm.paymentMethod === method.id ? 'border-amber-600 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${checkoutForm.paymentMethod === method.id ? 'border-amber-600' : 'border-slate-300'}`}>
                                {checkoutForm.paymentMethod === method.id && <div className="w-2 h-2 rounded-full bg-amber-600" />}
                              </div>
                              <span className="font-bold text-slate-900">{method.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {checkoutForm.paymentMethod !== 'cod' && (
                        <div className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in zoom-in-95 duration-300">
                          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-4 border-slate-50">{t.transactionId}</h3>
                          <p className="text-xs text-slate-400 font-medium italic">Please pay first and then provide your transaction ID here.</p>
                          <input 
                            required 
                            value={checkoutForm.transactionId} 
                            onChange={e => setCheckoutForm({...checkoutForm, transactionId: e.target.value})} 
                            type="text" 
                            placeholder="e.g. 9J2HXS..."
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-mono text-lg" 
                          />
                        </div>
                      )}

                      <div className="pt-6">
                        <button 
                          disabled={isPlacingOrder || cart.length === 0}
                          className="w-full py-6 bg-slate-900 text-white rounded-[2rem] text-lg font-black uppercase tracking-[0.2em] hover:bg-amber-600 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-slate-900/20 disabled:opacity-50 group active:scale-[0.98]"
                        >
                          {isPlacingOrder ? 'Processing Order...' : `${t.placeOrder} — ৳${(cartTotal + shippingCost).toLocaleString()}`}
                          {isPlacingOrder ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="space-y-8 lg:sticky lg:top-32 h-fit">
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
                    <h3 className="text-xl font-black italic uppercase tracking-tight mb-8 text-slate-800">{t.orderSummary}</h3>
                    <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-4 scrollbar-hide">
                      {cart.map(item => (
                        <div key={item.id} className="flex gap-6 group items-center">
                          <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-50">
                            <img src={item.image || undefined} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={language === 'en' ? item.name : item.nameBn} />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className="text-sm font-black text-slate-900 truncate tracking-tight">
                              {language === 'en' ? item.name : item.nameBn}
                              {item.weight && ` (${language === 'en' ? item.weight : (item.weightBn || item.weight)})`}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-baseline gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{item.quantity} x</span>
                                <PriceDisplay 
                                  product={item} 
                                  className="inline-flex items-baseline gap-1 flex-wrap" 
                                  priceClassName="text-xs font-bold text-slate-700" 
                                  regularPriceClassName="text-[10px] text-slate-400 line-through" 
                                />
                              </div>
                              <button 
                                type="button"
                                onClick={() => removeFromCart(item.id)} 
                                className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                                title={language === 'en' ? 'Remove' : 'বাদ দিন'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center text-sm font-black text-slate-900">
                             ৳{(item.price * item.quantity).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-10 pt-8 border-t-2 border-dashed border-slate-100 space-y-4">
                      <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>{t.subtotal}</span>
                        <span className="text-slate-900">৳{cartTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>{t.shipping}</span>
                        {shippingCost === 0 ? (
                          <span className="text-emerald-600 font-black">{t.free}</span>
                        ) : (
                          <span className="text-slate-900 font-black">৳{shippingCost.toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-2xl font-black italic text-slate-900 pt-4 border-t border-slate-50">
                        <span>{t.total}</span>
                        <span className="bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">৳{(cartTotal + shippingCost).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-center gap-6">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/10">
                      <CreditCard className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Secure Order</h4>
                      <p className="text-xs text-amber-900/60 font-medium leading-relaxed">Cash on delivery available. Pay only when you receive your meal.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : currentPage === 'success' ? (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-xl mx-auto px-6 py-32 text-center space-y-8"
            >
              <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-900/10">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-in zoom-in duration-500" />
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">{t.orderSuccess}</h1>
                <p className="text-slate-500 font-medium text-lg leading-relaxed">{t.orderSuccessDesc}</p>
              </div>
              {lastOrder && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm inline-block">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Confirmation ID</p>
                  <p className="text-xl font-mono font-bold text-slate-900">#{lastOrder?.slice(-12).toUpperCase() || 'N/A'}</p>
                </div>
              )}
              <div className="pt-8">
                <button 
                  onClick={() => setCurrentPage('home')}
                  className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-2xl shadow-slate-900/20 active:scale-95 flex items-center gap-4 mx-auto"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                  {t.backToHome}
                </button>
              </div>
            </motion.div>
          ) : currentPage === 'profile' ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {user ? (
                <UserProfile 
                  user={user} 
                  orders={userOrders} 
                  language={language}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  products={products}
                  onProductClick={(p) => setSelectedProduct(p)}
                  onLogout={async () => {
                    localStorage.removeItem('mock_user_session');
                    setUser(null);
                    setIsAdmin(false);
                    if (supabase) {
                      try {
                        await supabase.auth.signOut();
                      } catch (err) {
                        console.error('Logout error:', err);
                      }
                    }
                    setCurrentPage('home');
                  }}
                  onBack={() => setCurrentPage('home')}
                />
              ) : (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                  <div className="max-w-md bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl space-y-6">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto">
                      <UserIcon className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">{language === 'en' ? 'Access Denied' : 'প্রবেশাধিকার নেই'}</h3>
                      <p className="text-sm text-slate-400">{language === 'en' ? 'Please log in to view your profile and order history.' : 'আপনার প্রোফাইল এবং অর্ডার হিস্ট্রি দেখতে দয়া করে লগইন করুন।'}</p>
                    </div>
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-600 transition-all cursor-pointer"
                    >
                      {language === 'en' ? 'Log In / Register' : 'লগইন / রেজিস্টার করুন'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div>
              {/* Product page handled separately if needed */}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Database Sync Status Toast */}
      <AnimatePresence>
        {dbSyncStatus.show && (
          <div className="fixed bottom-6 right-6 z-[110] max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden" id="db-sync-toast">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="p-4"
            >
              <div className="flex items-start gap-3">
                {dbSyncStatus.type === 'syncing' && (
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
                {dbSyncStatus.type === 'success' && (
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {dbSyncStatus.type === 'error' && (
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {dbSyncStatus.type === 'syncing' && (language === 'en' ? 'Database Connection' : 'ডাটাবেজ সংযোগ')}
                    {dbSyncStatus.type === 'success' && (language === 'en' ? 'Database Sync Success' : 'ডাটাবেজ সিঙ্ক সফল')}
                    {dbSyncStatus.type === 'error' && (language === 'en' ? 'Database Sync Error' : 'ডাটাবেজ সিঙ্ক ত্রুটি')}
                  </h4>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed">
                    {dbSyncStatus.message}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} language={language} />}
      
      {/* Product Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 24 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.1 }}
              className="bg-white rounded-3xl sm:rounded-[2.5rem] w-full max-w-5xl overflow-hidden relative z-10 flex flex-col md:flex-row h-full max-h-[90vh] md:h-auto"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 p-2 bg-white/80 backdrop-blur-sm rounded-full text-slate-900 hover:bg-slate-100 transition-colors z-20"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="md:w-1/2 relative group">
                <img 
                  src={selectedProduct.image || undefined} 
                  alt={selectedProduct.name}
                  className="w-full h-[40vh] md:h-full object-cover"
                />
              </div>

              <div className="md:w-1/2 p-8 sm:p-12 flex flex-col justify-center space-y-8 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                        {language === 'en' ? selectedProduct.category : selectedProduct.categoryBn}
                      </span>
                      {selectedProduct.isNew && (
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                          {t.new}
                        </span>
                      )}
                      {selectedProduct.discount && (
                        <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full">
                          {selectedProduct.discount}% OFF
                        </span>
                      )}
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
                      {language === 'en' ? selectedProduct.name : selectedProduct.nameBn}
                      {selectedProduct.weight && (
                        <span className="text-2xl sm:text-3xl font-light text-slate-400 block sm:inline sm:ml-3">
                          ({language === 'en' ? selectedProduct.weight : (selectedProduct.weightBn || selectedProduct.weight)})
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <PriceDisplay 
                          product={selectedProduct} 
                          className="flex items-baseline gap-2 flex-wrap" 
                          priceClassName="text-3xl font-extrabold text-amber-600" 
                          regularPriceClassName="text-lg font-semibold text-slate-400" 
                        />
                        {selectedProduct.weight && (
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            {language === 'en' ? selectedProduct.weight : (selectedProduct.weightBn || selectedProduct.weight)}
                          </span>
                        )}
                      </div>
                      {selectedProduct.stock !== undefined && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {selectedProduct.stock} {language === 'en' ? 'Units left' : 'ইউনিট বাকি আছে'}
                          </span>
                        </div>
                      )}
                      {/* Delivery Charge Indicator */}
                      {(() => {
                        const delChargeText = (() => {
                          if (selectedProduct.deliveryCharge !== undefined && selectedProduct.deliveryCharge !== null) {
                            return selectedProduct.deliveryCharge === 0 
                              ? (language === 'en' ? 'FREE' : 'ফ্রি') 
                              : `৳${selectedProduct.deliveryCharge}`;
                          }
                          if (!siteSettings.companyInfo?.deliveryChargeEnabled) {
                            return language === 'en' ? 'FREE' : 'ফ্রি';
                          }
                          const inside = siteSettings.companyInfo?.deliveryChargeInside ?? 60;
                          const outside = siteSettings.companyInfo?.deliveryChargeOutside ?? 120;
                          if (inside === 0 && outside === 0) {
                            return language === 'en' ? 'FREE' : 'ফ্রি';
                          }
                          if (inside === outside) {
                            return `৳${inside}`;
                          }
                          return language === 'en' 
                            ? `৳${inside} (Inside) / ৳${outside} (Outside)` 
                            : `৳${inside} (ভিতরে) / ৳${outside} (বাইরে)`;
                        })();

                        const isFree = delChargeText === 'FREE' || delChargeText === 'ফ্রি';

                        return (
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                            isFree 
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                              : 'bg-amber-50 border-amber-100 text-slate-500'
                          }`}>
                            <Truck className={`w-3.5 h-3.5 ${isFree ? 'text-emerald-600' : 'text-amber-600'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {language === 'en' ? 'Delivery: ' : 'ডেলিভারি চার্জ: '}
                              <span className={`font-extrabold ${isFree ? 'text-emerald-600 font-black' : 'text-amber-600'}`}>
                                {delChargeText}
                              </span>
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
  
                  <p className="text-slate-600 leading-relaxed font-light text-lg">
                    {language === 'en' ? selectedProduct.description : selectedProduct.descriptionBn}
                  </p>
  
                  <div className="space-y-4 pt-4">
                    <button 
                      onClick={() => {
                        addToCart(selectedProduct);
                        setSelectedProduct(null);
                      }}
                      className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all duration-300 flex items-center justify-center gap-4 text-lg active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                      {t.addCollection}
                      <ShoppingBag className="w-5 h-5" />
                    </button>
                  <p className="text-center text-xs text-slate-400 uppercase tracking-widest">
                    {t.deliveryNote}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-50"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-[320px] bg-white border-l border-slate-200 flex flex-col shadow-2xl z-50"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <h2 className="text-lg font-bold">{t.cartTitle}</h2>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{cart.length} {t.cartItems}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <ShoppingBag className="w-16 h-16" />
                    <p className="text-sm font-medium">{t.cartEmpty}</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center overflow-hidden">
                        <img src={item.image || undefined} className="w-full h-full object-cover" alt={language === 'en' ? item.name : item.nameBn} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate pr-4">
                          {language === 'en' ? item.name : item.nameBn}
                          {item.weight && ` (${language === 'en' ? item.weight : (item.weightBn || item.weight)})`}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">{language === 'en' ? item.category : item.categoryBn}</div>
                        <div className="flex items-center justify-between mt-1">
                          <PriceDisplay 
                            product={item} 
                            className="flex items-baseline gap-1.5 flex-wrap" 
                            priceClassName="text-xs font-bold text-amber-600" 
                            regularPriceClassName="text-[10px] text-slate-400 line-through" 
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 border border-slate-200 rounded-md px-1 bg-slate-50">
                              <button onClick={() => updateQuantity(item.id, -1)} className="text-xs px-1 hover:text-amber-600">-</button>
                              <span className="text-[10px] font-bold w-3 text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="text-xs px-1 hover:text-amber-600">+</button>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)} 
                              className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title={language === 'en' ? 'Remove' : 'বাদ দিন'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{t.subtotal}</span>
                      <span>৳{cartTotal}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{t.shipping}</span>
                      {shippingCost === 0 ? (
                        <span className="text-emerald-600 font-bold uppercase text-[10px]">{t.free}</span>
                      ) : (
                        <span className="text-slate-900 font-bold">৳{shippingCost.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200 mt-2">
                      <span>{t.total}</span>
                      <span>৳{(cartTotal + shippingCost).toLocaleString()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full py-4 bg-amber-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-100/50 hover:bg-amber-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {t.placeOrder} — ৳{(cartTotal + shippingCost).toLocaleString()}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetPasswordModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetPasswordModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl z-[130]"
            >
              {/* Decorative Header Banner */}
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-amber-500 to-amber-600" />
              
              <div className="relative p-10 space-y-8">
                {/* Close Button */}
                <button 
                  onClick={() => setShowResetPasswordModal(false)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-lg rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="space-y-2 text-center pt-4">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-xl mx-auto flex items-center justify-center text-amber-600 mb-6">
                    <RefreshCw className="w-10 h-10 animate-spin" />
                  </div>
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">
                    {language === 'en' ? 'Set New Password' : 'নতুন পাসওয়ার্ড'}
                  </h3>
                  <p className="text-slate-400 font-medium">
                    {language === 'en' 
                      ? 'Secure your account with a brand new password' 
                      : 'নতুন পাসওয়ার্ড দিয়ে আপনার অ্যাকাউন্টটি নিরাপদ করুন'}
                  </p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Lock className="w-3 h-3" />
                        {language === 'en' ? 'New Password' : 'নতুন পাসওয়ার্ড'}
                      </label>
                      <input 
                        type="password"
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-4 ring-amber-500/10 font-bold text-slate-700 transition-all"
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Lock className="w-3 h-3" />
                        {language === 'en' ? 'Confirm New Password' : 'পাসওয়ার্ড নিশ্চিত করুন'}
                      </label>
                      <input 
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-4 ring-amber-500/10 font-bold text-slate-700 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {resetError && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3"
                      >
                        <X className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-rose-600 leading-tight">{resetError}</p>
                      </motion.div>
                    )}
                    {resetSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-emerald-600 leading-tight">{resetSuccess}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    type="submit"
                    disabled={resetLoading}
                    className={`w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all ${resetLoading ? 'opacity-70 scale-95' : 'hover:bg-amber-600 active:scale-95'}`}
                  >
                    {resetLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {language === 'en' ? 'Update Password' : 'পাসওয়ার্ড পরিবর্তন করুন'}
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleLogin={handleGoogleLogin}
        language={language}
        onSuccess={() => setCurrentPage('profile')}
      />

      <footer className="bg-white border-t border-slate-200 py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-4">
              {siteSettings.logoUrl ? (
                <img src={siteSettings.logoUrl} className="h-12 w-auto object-contain" alt="Yummy Express" />
              ) : (
                <h2 className="text-2xl font-bold text-amber-600 tracking-tight">{t.logo}</h2>
              )}
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
              {t.footerDesc}
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest font-bold text-slate-900">{t.footerCompany}</h4>
            <div className="space-y-4 text-xs sm:text-sm text-slate-600">
              {/* Our Kitchen */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{language === 'bn' ? 'আমাদের রান্নাঘর' : 'Our Kitchen'}</span>
                </div>
                <p className="pl-6 text-slate-500">{language === 'bn' ? 'যশোর' : 'Jessore'}</p>
              </div>

              {/* Contact Us */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{language === 'bn' ? 'আমাদের সাথে যোগাযোগ করুন' : 'Contact Us'}</span>
                </div>
                <div className="pl-6 space-y-1.5 flex flex-col">
                  {/* Facebook */}
                  <a 
                    href="https://www.facebook.com/share/17KKWKD3qZ/?mibextid=wwXIfr" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-amber-600 transition-colors w-fit"
                  >
                    <Facebook className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium underline underline-offset-2">
                      {language === 'bn' ? 'ফেসবুক পেজ' : 'Facebook Page'}
                    </span>
                  </a>
                  
                  {/* WhatsApp */}
                  <a 
                    href="https://wa.me/8801818056960" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors w-fit"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-mono">
                      {language === 'bn' ? 'হোয়াটসঅ্যাপ: ' : 'WhatsApp: '}01818056960
                    </span>
                  </a>

                  {/* Phone Call */}
                  <a 
                    href="tel:01818056960" 
                    className="flex items-center gap-1.5 hover:text-amber-600 transition-colors w-fit"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono">
                      {language === 'bn' ? 'ফোন: ' : 'Phone: '}01818056960
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest font-bold text-slate-900">{t.footerService}</h4>
            <div className="space-y-4 text-xs sm:text-sm text-slate-600">
              {/* Delivery Area */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{language === 'bn' ? 'ডেলিভারি এরিয়া' : 'Delivery Area'}</span>
                </div>
                <p className="pl-6 text-slate-500">
                  {language === 'bn' ? 'সারা বাংলাদেশ' : 'All Bangladesh'}
                </p>
              </div>

              {/* Refund Policy */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{language === 'bn' ? 'রিফান্ড পলিসি' : 'Refund Policy'}</span>
                </div>
                <p className="pl-6 text-slate-500 leading-relaxed text-xs sm:text-sm max-w-xs">
                  {language === 'bn' 
                    ? 'প্রোডাক্ট হাতে পেয়ে কাস্টমার পেমেন্ট করতে পারবে' 
                    : 'Customer can inspect and pay upon hand-to-hand delivery'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">© 2026 Yummy Express. All rights reserved.</p>
          {isAdmin && (
            <button 
              onClick={() => setShowAdminPanel(true)}
              className="text-[10px] font-bold text-amber-600 hover:bg-amber-100 uppercase tracking-[0.2em] px-4 py-2 border border-amber-200 rounded-full transition-all"
            >
              Admin Access
            </button>
          )}
        </div>
      </footer>

      <AnimatePresence>
        {showAdminPanel && (
          <AdminPanel 
            onClose={() => setShowAdminPanel(false)}
            language={language}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  priority?: boolean;
  language: Language;
  key?: React.Key;
  isFavorited?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

function ProductCard({ product, onClick, priority = false, language, isFavorited = false, onToggleFavorite }: ProductCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="card-sleek group cursor-pointer h-full"
      onClick={onClick}
    >
      <div className="aspect-square bg-slate-100 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
        {product.isNew && (
          <span className="absolute top-2 left-2 bg-white px-2 py-1 text-[10px] font-bold rounded shadow-sm z-10">{language === 'en' ? 'NEW' : 'নতুন'}</span>
        )}
        {product.discount && (
          <span className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-[10px] font-bold rounded shadow-sm z-10">
            -{product.discount}%
          </span>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 hover:bg-white text-slate-700 hover:text-rose-500 rounded-full flex items-center justify-center shadow-md transition-all duration-300 z-10 active:scale-95 cursor-pointer hover:scale-110"
            title={language === 'en' ? 'Add to Wishlist' : 'প্রিয় তালিকায় যোগ করুন'}
          >
            <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
          </button>
        )}
        <motion.img 
          src={product.image || undefined} 
          loading={priority ? "eager" : "lazy"}
          alt={language === 'en' ? product.name : product.nameBn}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      </div>
      <div className="flex flex-col flex-1">
        <h3 className="font-bold text-sm text-slate-800 line-clamp-1">
          {language === 'en' ? product.name : product.nameBn}
        </h3>
        {product.weight && (
          <span className="text-xs font-semibold text-slate-500 mt-1">
            {language === 'en' ? `Weight: ${product.weight}` : `পরিমাপ: ${product.weightBn || product.weight}`}
          </span>
        )}
        <div className="flex items-center justify-between gap-2 mt-0.5 mb-2">
          <p className="text-xs text-slate-400">{language === 'en' ? product.category : product.categoryBn}</p>
          {product.deliveryCharge !== undefined && product.deliveryCharge !== null && (
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border ${
              product.deliveryCharge === 0 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' 
                : 'bg-slate-50 text-slate-500 border-slate-100/50'
            }`}>
              <Truck className={`w-2.5 h-2.5 ${product.deliveryCharge === 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
              {product.deliveryCharge === 0 
                ? (language === 'en' ? 'Free' : 'ফ্রি') 
                : `৳${product.deliveryCharge}`}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <PriceDisplay product={product} />
            {product.weight && (
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                / {language === 'en' ? product.weight : (product.weightBn || product.weight)}
              </span>
            )}
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="p-1.5 bg-slate-900 text-white rounded-md hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
