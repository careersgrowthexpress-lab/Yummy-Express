import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Package, 
  MapPin, 
  Mail, 
  Phone, 
  LogOut, 
  ChevronRight, 
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Box,
  Edit3,
  Save,
  X,
  Camera,
  Home,
  Navigation,
  Copy,
  Check,
  Fingerprint,
  Heart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveLocalUserBackup, syncCustomerToGoogleSheets } from '../lib/webhook';
import { Order, Product } from '../types';
import { translations, Language } from '../translations';

interface UserProfileProps {
  user: any;
  orders: Order[];
  language: Language;
  onLogout: () => void;
  onBack: () => void;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  products: Product[];
  onProductClick?: (product: Product) => void;
}

interface ProfileData {
  displayName: string;
  photoURL: string;
  phone: string;
  address: string;
  city: string;
  area: string;
  bio: string;
}

export default function UserProfile({ 
  user, 
  orders, 
  language, 
  onLogout, 
  onBack,
  favorites,
  onToggleFavorite,
  products,
  onProductClick
}: UserProfileProps) {
  const t = translations[language];
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'favorites'>('orders');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: user.displayName || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    photoURL: user.photoURL || user.user_metadata?.avatar_url || '',
    phone: '',
    address: '',
    city: '',
    area: '',
    bio: ''
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus({
        text: language === 'en' ? 'File too large (max 5MB)' : 'ফাইলের সাইজ অনেক বড় (সর্বোচ্চ ৫ মেগাবাইট)',
        type: 'error'
      });
      return;
    }

    setUploading(true);
    setUploadStatus({
      text: language === 'en' ? 'Uploading profile picture...' : 'প্রোফাইল পিকচার আপলোড হচ্ছে...',
      type: 'success'
    });

    if (!supabase) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, photoURL: reader.result as string }));
        setUploadStatus({
          text: language === 'en' ? 'Uploaded successfully!' : 'সফলভাবে আপলোড সম্পন্ন হয়েছে!',
          type: 'success'
        });
        setUploading(false);
      };
      reader.onerror = () => {
        setUploadStatus({
          text: language === 'en' ? 'Failed to read file' : 'ফাইল পড়তে ব্যর্থ হয়েছে',
          type: 'error'
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id || Math.random()}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      try {
        await supabase.storage.createBucket('images', { public: true });
      } catch (bErr) {
        console.log('Bucket check auto-create:', bErr);
      }

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setProfileData(prev => ({ ...prev, photoURL: publicUrl }));
      setUploadStatus({
        text: language === 'en' ? 'Profile picture uploaded successfully!' : 'প্রোফাইল পিকচার সফলভাবে আপলোড হয়েছে!',
        type: 'success'
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, photoURL: reader.result as string }));
        setUploadStatus({
          text: language === 'en' 
            ? 'Success (Offline/Base64 backup saved)!' 
            : 'অফলাইন ও বেস-৬৪ ব্যাকআপ হিসেবে সফলভাবে ছবি সংরক্ষণ করা হলো!',
          type: 'success'
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    // 1. Load from localStorage if mock session or backup exists
    const mockProfileStr = localStorage.getItem(`mock_profile_${user.id}`);
    if (mockProfileStr) {
      try {
        const localData = JSON.parse(mockProfileStr);
        setProfileData(prev => ({
          ...prev,
          ...localData,
          displayName: localData.displayName || prev.displayName || '',
          photoURL: localData.photoURL || prev.photoURL || '',
          phone: localData.phone || prev.phone || '',
          address: localData.address || prev.address || '',
          city: localData.city || prev.city || '',
          area: localData.area || prev.area || '',
          bio: localData.bio || prev.bio || ''
        }));
      } catch (e) {
        console.error('Error loading mock profile:', e);
      }
    } else {
      // Set stable defaults from the session object
      setProfileData(prev => ({
        ...prev,
        displayName: user.displayName || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        photoURL: user.photoURL || user.user_metadata?.avatar_url || ''
      }));
    }

    const fetchExtendedProfile = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setProfileData(prev => {
            const merged = {
              ...prev,
              displayName: data.display_name || prev.displayName || user.user_metadata?.full_name || '',
              photoURL: data.photo_url || prev.photoURL || user.user_metadata?.avatar_url || '',
              phone: data.phone || prev.phone || '',
              address: data.address || prev.address || '',
              city: data.city || prev.city || '',
              area: data.area || prev.area || '',
              bio: data.bio || prev.bio || ''
            };
            // Cache in localStorage too for offline/high-performance retrieval
            localStorage.setItem(`mock_profile_${user.id}`, JSON.stringify(merged));
            return merged;
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchExtendedProfile();
  }, [user.id, user.user_metadata]);

  const handleCopyUid = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedUid(true);
    setTimeout(() => {
      setCopiedUid(false);
    }, 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Standardize data to save
      const finalData = {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL,
        phone: profileData.phone,
        address: profileData.address,
        city: profileData.city,
        area: profileData.area,
        bio: profileData.bio
      };

      // Always save locally so offline support/instant state works instantly
      localStorage.setItem(`mock_profile_${user.id}`, JSON.stringify(finalData));

      // Sync mock user session in localStorage so that display names inside App.tsx update seamlessly
      const mockSessionStr = localStorage.getItem('mock_user_session');
      if (mockSessionStr) {
        try {
          const parsed = JSON.parse(mockSessionStr);
          if (parsed && parsed.id === user.id) {
            parsed.user_metadata = {
              ...parsed.user_metadata,
              full_name: profileData.displayName,
              avatar_url: profileData.photoURL
            };
            localStorage.setItem('mock_user_session', JSON.stringify(parsed));
            window.dispatchEvent(new Event('mock_auth_change'));
          }
        } catch (e) {
          console.error('Error syncing mock user session metadata:', e);
        }
      }

      if (!supabase) {
        // Fallback for when there's no configured database
        setTimeout(() => {
          setIsLoading(false);
          setIsEditing(false);
          window.dispatchEvent(new Event('user_profile_updated'));
        }, 600);
        return;
      }

      // Update Supabase Auth Metadata (Safe fallback if policies are restrictive)
      try {
        const { error: authError } = await supabase.auth.updateUser({
          data: { 
            full_name: profileData.displayName,
            avatar_url: profileData.photoURL
          }
        });
        if (authError) console.warn('Supabase auth metadata update failed:', authError);
      } catch (authErr) {
        console.warn('Silent fallback: auth updateUser not supported/failed');
      }

      // Update users database table
      const customerPayload = {
        id: user.id,
        name: profileData.displayName,
        email: user.email || undefined,
        phone: profileData.phone || undefined,
        address: profileData.address || undefined,
        city: profileData.city || undefined,
        area: profileData.area || undefined,
        bio: profileData.bio || undefined,
        updated_at: new Date().toISOString()
      };

      // Save local backup always
      saveLocalUserBackup(customerPayload);

      // Trigger Webhook Sync
      syncCustomerToGoogleSheets(customerPayload);

      const { error: dbError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          display_name: profileData.displayName,
          photo_url: profileData.photoURL,
          phone: profileData.phone,
          address: profileData.address,
          city: profileData.city,
          area: profileData.area,
          bio: profileData.bio,
          updated_at: new Date().toISOString()
        });
      if (dbError) throw dbError;

      // Dispatch unified event so App.tsx knows to refresh user profile instantly
      window.dispatchEvent(new Event('user_profile_updated'));

      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'shipped': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'pending': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="w-3 h-3" />;
      case 'cancelled': return <AlertCircle className="w-3 h-3" />;
      case 'shipped': return <Truck className="w-3 h-3" />;
      case 'processing': return <RefreshCwIcon className="w-3 h-3 animate-spin" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Spacer */}
      <div className="h-20 lg:h-24" />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Sidebar / User Info */}
          <div className="lg:col-span-1 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              
              <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-100">
                    {profileData.photoURL || user.user_metadata?.avatar_url ? (
                      <img src={profileData.photoURL || user.user_metadata?.avatar_url} className="w-full h-full object-cover" alt={profileData.displayName || 'User'} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-600 bg-amber-50">
                        <UserIcon className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full" />
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{profileData.displayName || 'Set Name'}</h2>
                  <p className="text-sm font-medium text-slate-400">{language === 'en' ? 'Verified Customer' : 'ভেরিফাইড ক্রেতা'}</p>
                </div>

                <div className="w-full pt-8 space-y-4 text-left">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.email}</p>
                      <p className="text-sm font-bold text-slate-700 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.phone}</p>
                      <p className="text-sm font-bold text-slate-700">{profileData.phone || (language === 'en' ? 'Not set' : 'সেট করা নেই')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Joined' : 'যোগদান'}</p>
                      <p className="text-sm font-bold text-slate-700">{new Date(user.created_at || '').toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'User UID' : 'ইউজার UID'}</p>
                      <p className="text-xs font-mono font-bold text-slate-500 truncate" id="user-uid-display">{user.id}</p>
                    </div>
                    <button
                      onClick={handleCopyUid}
                      className="p-2 hover:bg-slate-200/50 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      title={language === 'en' ? 'Copy UID' : 'UID কপি করুন'}
                    >
                      {copiedUid ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {profileData.bio && (
                    <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">{language === 'en' ? 'Biodata / Bio' : 'বায়োডাটা / বায়ো'}</p>
                      <p className="text-xs font-semibold text-slate-600 italic leading-relaxed">"{profileData.bio}"</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-amber-600 transition-all shadow-lg shadow-slate-900/10"
                  >
                    <Edit3 className="w-4 h-4" />
                    {language === 'en' ? 'Edit Profile' : 'প্রোফাইল এডিট'}
                  </button>
                  <button 
                    onClick={onLogout}
                    className="w-full py-4 px-6 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-rose-600 hover:text-white transition-all duration-300"
                  >
                    <LogOut className="w-4 h-4" />
                    {language === 'en' ? 'Logout Account' : 'লগআউট করুন'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div
                  key="edit-form"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">
                        {language === 'en' ? 'Edit Profile' : 'প্রোফাইল সংশোধন'}
                      </h3>
                      <p className="text-slate-400 font-medium">Update your personal information</p>
                    </div>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.fullName}</label>
                        <input 
                          type="text"
                          value={profileData.displayName}
                          onChange={e => setProfileData({...profileData, displayName: e.target.value})}
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700"
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.phone}</label>
                        <input 
                          type="tel"
                          value={profileData.phone}
                          onChange={e => setProfileData({...profileData, phone: e.target.value})}
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700 font-mono"
                          placeholder="017xxxxxxxx"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {language === 'en' ? 'Profile Picture URL' : 'প্রোফাইল পিকচার লিংক (URL)'}
                          </label>
                          <div className="relative">
                            <input 
                              type="url"
                              value={profileData.photoURL}
                              onChange={e => setProfileData({...profileData, photoURL: e.target.value})}
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700 text-xs font-mono pr-12"
                              placeholder="https://images.unsplash.com/..."
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                              <Camera className="w-5 h-5" />
                            </div>
                          </div>
                        </div>

                        <div className="w-full md:w-auto shrink-0">
                          <label className="block md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            {language === 'en' ? 'OR UPLOAD FILE' : 'অথবা ফাইল আপলোড করুন'}
                          </label>
                          <input 
                            type="file" 
                            id="user-avatar-upload" 
                            accept="image/*" 
                            onChange={handleAvatarUpload} 
                            className="hidden" 
                            disabled={uploading}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('user-avatar-upload')?.click()}
                            disabled={uploading}
                            className={`w-full px-6 py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-2 border-2 transition-all ${
                              uploading 
                                ? 'bg-slate-100 border-slate-200 text-slate-400' 
                                : 'bg-white border-slate-200 hover:border-amber-500 hover:bg-slate-50 active:scale-95 text-slate-700 shadow-sm'
                            }`}
                          >
                            {uploading ? (
                              <>
                                <RefreshCwIcon className="w-4 h-4 animate-spin text-amber-500" />
                                <span>{language === 'en' ? 'Uploading...' : 'আপলোড হচ্ছে...'}</span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-4 h-4 text-amber-500" />
                                <span>{language === 'en' ? 'Upload Photo / Files' : 'ফাইল/ড্রাইভ থেকে আপলোড'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {uploadStatus.text && (
                        <p className={`text-xs font-bold px-4 py-2.5 rounded-xl ${
                          uploadStatus.type === 'error' 
                            ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {uploadStatus.text}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">About Me / Bio</label>
                      <textarea 
                        rows={3}
                        value={profileData.bio}
                        onChange={e => setProfileData({...profileData, bio: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700 resize-none"
                        placeholder="Tell us a bit about yourself..."
                      />
                    </div>

                    <div className="pt-6 border-t border-slate-50 space-y-6">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2">
                        <Home className="w-3.5 h-3.5" />
                        Default Shipping Address
                      </p>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.address}</label>
                        <input 
                          type="text"
                          value={profileData.address}
                          onChange={e => setProfileData({...profileData, address: e.target.value})}
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700"
                          placeholder="House, Road, Block..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.area}</label>
                          <input 
                            type="text"
                            value={profileData.area}
                            onChange={e => setProfileData({...profileData, area: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700"
                            placeholder="Dhanmondi / Gulshan"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.city}</label>
                          <input 
                            type="text"
                            value={profileData.city}
                            onChange={e => setProfileData({...profileData, city: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-amber-500/20 font-bold text-slate-700"
                            placeholder="Dhaka"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading}
                      className={`w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all ${isLoading ? 'opacity-70 scale-95' : 'hover:bg-amber-600 active:scale-95'}`}
                    >
                      {isLoading ? (
                        <RefreshCwIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                      {language === 'en' ? 'Save Changes' : 'পরিবর্তন সংরক্ষণ করুন'}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="profile-tabs"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-10"
                >
                  {/* Premium Tab Toggle */}
                  <div className="flex border-b border-slate-200 gap-8 pb-1">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('orders')}
                      className={`pb-4 text-lg font-black uppercase tracking-tight relative transition-all cursor-pointer ${
                        activeSubTab === 'orders' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {language === 'en' ? 'Your Orders' : 'আপনার অর্ডার'}
                      {activeSubTab === 'orders' && (
                        <motion.div layoutId="profileActiveTab" className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-full" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('favorites')}
                      className={`pb-4 text-lg font-black uppercase tracking-tight relative transition-all cursor-pointer ${
                        activeSubTab === 'favorites' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {language === 'en' ? 'Favorite Items' : 'প্রিয় তালিকা'}
                      {activeSubTab === 'favorites' && (
                        <motion.div layoutId="profileActiveTab" className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-full" />
                      )}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeSubTab === 'orders' ? (
                      <motion.div
                        key="orders-sub-section"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
                              {language === 'en' ? 'Your Orders' : 'আপনার অর্ডার'}
                            </h3>
                            <p className="text-slate-400 font-medium">
                              {language === 'en' 
                                ? `You have placed ${orders.length} orders so far.` 
                                : `আপনি এ পর্যন্ত ${orders.length}টি অর্ডার করেছেন।`}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-amber-600">
                            <Package className="w-6 h-6" />
                          </div>
                        </div>

                        <div className="space-y-6">
                          {orders.length === 0 ? (
                            <div className="bg-white rounded-[2.5rem] p-16 text-center space-y-6 border border-slate-100 border-dashed">
                              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                <Box className="w-10 h-10 text-slate-200" />
                              </div>
                              <div className="space-y-2">
                                <p className="font-bold text-slate-900 text-xl">{language === 'en' ? 'No orders found yet' : 'এখনও কোন অর্ডার পাওয়া যায়নি'}</p>
                                <p className="text-slate-400 text-sm max-w-xs mx-auto">{language === 'en' ? 'Seems like you haven\'t tried our gourmet experience yet!' : 'মনে হচ্ছে আপনি এখনও আমাদের গুরমেট অভিজ্ঞতা চেষ্টা করেননি!'}</p>
                              </div>
                              <button 
                                onClick={onBack}
                                className="px-8 py-3 bg-amber-600 text-white rounded-full font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform"
                              >
                                {language === 'en' ? 'Start Shopping' : 'কেনাকাটা শুরু করুন'}
                              </button>
                            </div>
                          ) : (
                            orders.map((order, idx) => (
                              <motion.div 
                                key={order.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 group"
                              >
                                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between pb-8 border-b border-slate-50">
                                  <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 font-black text-xl italic border border-slate-100">
                                      #{idx + 1}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order ID</p>
                                      <p className="font-mono text-xs font-bold text-slate-600">{order.id}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-12">
                                    <div className="space-y-1 text-right hidden sm:block">
                                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</p>
                                      <p className="text-sm font-bold text-slate-700">
                                        {order.created_at ? new Date(order.created_at).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US') : 'Recent'}
                                      </p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Amount</p>
                                      <p className="text-xl font-black text-amber-600">৳{order.total}</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${getStatusColor(order.status)}`}>
                                      {getStatusIcon(order.status)}
                                      {order.status}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Items Ordered</p>
                                    <div className="space-y-3">
                                      {order.items.map((item, itemIdx) => (
                                         <div key={itemIdx} className="flex items-center justify-between group/item">
                                            <div className="flex items-center gap-4">
                                               <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-50 border border-slate-100">
                                                  <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                               </div>
                                               <div>
                                                  <p className="text-sm font-bold text-slate-800">{language === 'en' ? item.name : item.nameBn}</p>
                                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.quantity} x ৳{item.price}</p>
                                               </div>
                                            </div>
                                            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full group-hover/item:bg-amber-500 transition-colors" />
                                         </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Shipping Details</p>
                                    <div className="space-y-3">
                                      <div className="flex items-start gap-3">
                                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                                        <div>
                                           <p className="text-sm font-bold text-slate-700 leading-snug">{order.customer.address}</p>
                                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{order.customer.area}, {order.customer.city}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <p className="text-xs font-bold text-slate-700">{order.customer.phone}</p>
                                      </div>
                                      {order.customer.deliveryDate && (
                                        <div className="flex items-center gap-3 pt-2 border-t border-slate-100/50">
                                          <Calendar className="w-4 h-4 text-amber-500" />
                                          <p className="text-xs font-bold text-slate-700">
                                            {language === 'bn' ? 'ডেলিভারি তারিখ: ' : 'Delivery Date: '} 
                                            {order.customer.deliveryDate}
                                          </p>
                                        </div>
                                      )}
                                      {order.customer.deliveryTime && (
                                        <div className="flex items-center gap-3">
                                          <Clock className="w-4 h-4 text-amber-500" />
                                          <p className="text-xs font-bold text-slate-700">
                                            {language === 'bn' ? 'ডেলিভারি সময়: ' : 'Delivery Time: '} 
                                            {order.customer.deliveryTime}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="favorites-sub-section"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
                              {language === 'en' ? 'Your Favorites' : 'প্রিয় তালিকা'}
                            </h3>
                            <p className="text-slate-400 font-medium">
                              {language === 'en' 
                                ? `You have saved ${favorites.length} items so far.` 
                                : `আপনি এ পর্যন্ত ${favorites.length}টি পণ্য সংরক্ষণ করেছেন।`}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-rose-500">
                            <Heart className="w-6 h-6 fill-rose-500" />
                          </div>
                        </div>

                        {products.filter(p => favorites.includes(p.id)).length === 0 ? (
                          <div className="bg-white rounded-[2.5rem] p-16 text-center space-y-6 border border-slate-100 border-dashed">
                            <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
                              <Heart className="w-10 h-10 text-rose-300" />
                            </div>
                            <div className="space-y-2">
                              <p className="font-bold text-slate-900 text-xl">
                                {language === 'en' ? 'No favorites saved yet' : 'প্রিয় তালিকায় কোন পণ্য নেই'}
                              </p>
                              <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                {language === 'en' 
                                  ? 'Mark your favorite dishes from our menu to see them here!' 
                                  : 'আপনার প্রিয় খাবারগুলো মেনু থেকে সিলেক্ট করে এখানে জমা রাখুন!'}
                              </p>
                            </div>
                            <button 
                              onClick={onBack}
                              className="px-8 py-3 bg-amber-600 text-white rounded-full font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform"
                            >
                              {language === 'en' ? 'Explore Menu' : 'মেনু দেখুন'}
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {products.filter(p => favorites.includes(p.id)).map((p) => (
                              <div 
                                key={p.id}
                                className="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 flex gap-4 relative group cursor-pointer"
                                onClick={() => onProductClick?.(p)}
                              >
                                <div className="w-24 h-24 bg-slate-50 rounded-2xl overflow-hidden shrink-0 border border-slate-100 relative">
                                  <img src={p.image || undefined} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={language === 'en' ? p.name : p.nameBn} />
                                  {p.discount && (
                                    <span className="absolute top-1.5 left-1.5 bg-red-600 text-white px-1.5 py-0.5 text-[8px] font-black rounded z-10">
                                      -{p.discount}%
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-sm truncate">
                                      {language === 'en' ? p.name : p.nameBn}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                                      {language === 'en' ? p.category : p.categoryBn}
                                    </p>
                                    {p.weight && (
                                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                                        {language === 'en' ? `Weight: ${p.weight}` : `পরিমাপ: ${p.weightBn || p.weight}`}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-baseline gap-1.5 mt-2">
                                    {p.originalPrice && p.originalPrice > p.price && (
                                      <span className="text-xs text-slate-400 line-through">৳{p.originalPrice}</span>
                                    )}
                                    <span className="font-extrabold text-amber-600 text-sm">৳{p.price}</span>
                                  </div>
                                </div>
                                
                                {/* Floating heart toggle button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(p.id);
                                  }}
                                  className="absolute top-4 right-4 w-8 h-8 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 hover:scale-110 transition-transform cursor-pointer"
                                  title={language === 'en' ? 'Remove from Favorites' : 'প্রিয় তালিকা থেকে বাদ দিন'}
                                >
                                  <Heart className="w-4 h-4 fill-rose-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}

function RefreshCwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
