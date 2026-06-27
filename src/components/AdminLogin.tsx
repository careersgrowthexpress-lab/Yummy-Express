import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  X,
  Key,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminLoginProps {
  onSuccess: () => void;
  onClose: () => void;
  language: 'en' | 'bn';
}

export default function AdminLogin({ onSuccess, onClose, language }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'forgot_password'>('login');
  const [message, setMessage] = useState<string | null>(null);
  const [currentLoggedInAdmin, setCurrentLoggedInAdmin] = useState<{ email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkActiveSession = async () => {
      // First check mock user session fallback
      const mockUserStr = localStorage.getItem('mock_user_session');
      if (mockUserStr) {
        try {
          const mockUser = JSON.parse(mockUserStr);
          if (mockUser && mockUser.email) {
            setCurrentLoggedInAdmin({ email: mockUser.email });
            setCheckingSession(false);
            return;
          }
        } catch (e) {
          console.error('Error parsing mock session:', e);
        }
      }

      if (!supabase) {
        setCheckingSession(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          const isMainAdmin = user.email === 'careers.growthexpress@gmail.com';
          let isAuthorized = isMainAdmin;
          
          if (!isAuthorized && user.email) {
            const { data: adminByEmail } = await supabase
              .from('admins')
              .select('*')
              .eq('email', user.email)
              .maybeSingle();
            if (adminByEmail) {
              isAuthorized = true;
            }
          }
          
          if (isAuthorized && user.email) {
            // Auto add/verify super admin or mapping to 'admins' table
            await supabase.from('admins').upsert({
              id: user.id,
              email: user.email,
              created_at: new Date().toISOString()
            });
            setCurrentLoggedInAdmin({ email: user.email });
          }
        }
      } catch (err) {
        console.error('Error checking active admin session:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkActiveSession();
  }, []);

  const handleGoogleSignIn = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || (language === 'en' ? 'Google authentication failed' : 'গুগল অথেন্টিকেশন ব্যর্থ হয়েছে'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim();
    let preAuthorized = normalizedEmail === 'careers.growthexpress@gmail.com';
    
    if (supabase && !preAuthorized) {
      try {
        const { data: adminData } = await supabase
          .from('admins')
          .select('email')
          .eq('email', normalizedEmail)
          .maybeSingle();
        if (adminData) {
          preAuthorized = true;
        }
      } catch (err) {
        console.error('Error pre-checking admin email:', err);
      }
    }

    if (!preAuthorized) {
      setError(language === 'en' 
        ? 'Access Denied: This email is not authorized as an administrator.' 
        : 'প্রবেশাধিকার নেই: এই ইমেলটি কোনো এডমিন হিসেবে অনুমোদিত নয়।');
      return;
    }

    if (!password || password.length < 6) {
      setError(language === 'en' 
        ? 'Password must be at least 6 characters.' 
        : 'পাসওয়ার্ড অবশ্যই কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }

    setLoading(true);
    setError(null);

    // Support master password "admin123456" for instant successful login
    if (password === 'admin123456') {
      setTimeout(() => {
        const isMainAdmin = normalizedEmail === 'careers.growthexpress@gmail.com';
        const mockUser = {
          id: isMainAdmin ? 'admin-careers-fallback' : 'admin-custom-' + normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-'),
          email: normalizedEmail,
          user_metadata: {
            full_name: isMainAdmin ? 'Super Admin' : 'Admin'
          }
        };
        localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
        window.dispatchEvent(new Event('mock_auth_change'));
        setLoading(false);
        onSuccess();
      }, 500);
      return;
    }

    if (!supabase) {
      // Offline fallback
      setTimeout(() => {
        const isMainAdmin = normalizedEmail === 'careers.growthexpress@gmail.com';
        const mockUser = {
          id: isMainAdmin ? 'admin-careers-fallback' : 'admin-custom-' + normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-'),
          email: normalizedEmail,
          user_metadata: {
            full_name: isMainAdmin ? 'Super Admin' : 'Admin'
          }
        };
        localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
        window.dispatchEvent(new Event('mock_auth_change'));
        setLoading(false);
        onSuccess();
      }, 500);
      return;
    }

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (loginError) throw loginError;

      const user = data.user;
      let isAuthorized = false;
      
      if (user) {
        const { data: adminData } = await supabase
          .from('admins')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (adminData) {
          isAuthorized = true;
        } else if (user.email) {
          const { data: adminByEmail } = await supabase
            .from('admins')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (adminByEmail) {
            isAuthorized = true;
            // Map their proper authenticated uid to the record
            await supabase
              .from('admins')
              .update({ id: user.id })
              .eq('email', user.email);
          }
        }

        if (!isAuthorized && user.email === 'careers.growthexpress@gmail.com') {
          // Auto add the super admin to the admins table to prevent lockout
          const { error: insertError } = await supabase
            .from('admins')
            .insert({
              id: user.id,
              email: user.email,
              created_at: new Date().toISOString()
            });
          if (!insertError) {
            isAuthorized = true;
          } else {
            console.error('Error auto-adding super admin on login:', insertError);
            isAuthorized = true; // allow as fallback
          }
        }
      }

      if (isAuthorized) {
        // Clear mock session if there is one
        localStorage.removeItem('mock_user_session');
        onSuccess();
      } else {
        await supabase.auth.signOut();
        setError(language === 'en' ? 'Access Denied: Not an authorized admin.' : 'অ্যাক্সেস প্রত্যাখ্যান করা হয়েছে: আপনি অনুমোদিত এডমিন নন।');
      }
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(err.message || (language === 'en' ? 'Login failed' : 'লগইন ব্যর্থ হয়েছে'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickBypass = () => {
    setLoading(true);
    const mockUser = {
      id: 'admin-careers-fallback',
      email: 'careers.growthexpress@gmail.com',
      user_metadata: {
        full_name: 'Super Admin'
      }
    };
    localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
    window.dispatchEvent(new Event('mock_auth_change'));
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 450);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError(language === 'en' ? 'Supabase is not configured yet.' : 'সুপাবেস এখনও কনফিগার করা হয়নি।');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!email) {
        throw new Error(language === 'en' ? 'Please enter your email.' : 'অনুগ্রহ করে আপনার ইমেল লিখুন।');
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`
      });

      if (resetError) throw resetError;

      setMessage(
        language === 'en' 
          ? 'Password reset link sent successfully! Check your email inbox and spam folder.' 
          : 'পাসওয়ার্ড রিসেট লিঙ্কটি সফলভাবে পাঠানো হয়েছে! আপনার ইমেইল ইনবক্স এবং স্প্যাম ফোল্ডার পরীক্ষা করুন।'
      );
    } catch (err: any) {
      console.error('Password reset request error:', err);
      setError(err.message || (language === 'en' ? 'Failed to send reset link' : 'রিসেট লিঙ্ক পাঠানো ব্যর্থ হয়েছে'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100"
      >
        {/* Animated Background Accent */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-br from-slate-900 to-slate-800" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full -mr-24 -mt-24 blur-3xl animate-pulse" />
        
        <div className="relative p-10 space-y-8">
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-3 text-center pt-6">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl mx-auto flex items-center justify-center text-slate-900 mb-6 group">
              <ShieldCheck className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">
              {view === 'login' 
                ? (language === 'en' ? 'Admin Access' : 'এডমিন অ্যাক্সেস')
                : (language === 'en' ? 'Reset Password' : 'পাসওয়ার্ড রিসেট')}
            </h3>
            <p className="text-slate-400 font-medium">
              {view === 'login'
                ? (language === 'en' ? 'Secure backend management portal' : 'নিরাপদ ব্যাকএন্ড ম্যানেজমেন্ট পোর্টাল')
                : (language === 'en' ? 'Request a password reset link' : 'একটি পাসওয়ার্ড রিসেট লিঙ্ক অনুরোধ করুন')}
            </p>
          </div>

          {currentLoggedInAdmin ? (
            <div className="space-y-6 text-center py-4">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3 text-left"
                  >
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-rose-600 leading-tight">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10 space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  {language === 'en' 
                    ? 'Already logged in with Gmail:' 
                    : 'ইতিমধ্যেই জিমেইল দিয়ে লগইন করা আছেন:'}
                </p>
                <div className="inline-block px-4 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700">
                  {currentLoggedInAdmin.email}
                </div>
                <p className="text-xs text-slate-400">
                  {language === 'en' 
                    ? 'No password is required to access the Admin Panel.' 
                    : 'এডমিন প্যানেলে প্রবেশ করতে কোনো পাসওয়ার্ডের প্রয়োজন নেই।'}
                </p>
                
                <button
                  type="button"
                  onClick={onSuccess}
                  className="w-full py-4 bg-slate-900 hover:bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {language === 'en' ? 'Continue to Dashboard' : 'ড্যাশবোর্ডে প্রবেশ করুন'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                
                <button
                  type="button"
                  onClick={async () => {
                    localStorage.removeItem('mock_user_session');
                    window.dispatchEvent(new Event('mock_auth_change'));
                    if (supabase) {
                      try {
                        await supabase.auth.signOut();
                      } catch (err) {
                        console.error('Logout error:', err);
                      }
                    }
                    setCurrentLoggedInAdmin(null);
                  }}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:underline transition-all block mx-auto pt-2"
                >
                  {language === 'en' ? 'Log out from this account' : 'এই অ্যাকাউন্ট থেকে লগ আউট করুন'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={view === 'login' ? handleSubmit : handleForgotPassword} className="space-y-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-rose-600 leading-tight">{error}</p>
                  </motion.div>
                )}
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-emerald-600 leading-tight">{message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    {language === 'en' ? 'Admin Email' : 'এডমিন ইমেইল'}
                  </label>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-4 ring-amber-500/10 font-bold text-slate-700 transition-all"
                    placeholder="admin@yummyexpress.com"
                  />
                </div>

                {view === 'login' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Key className="w-3 h-3" />
                        {language === 'en' ? 'Secret Key' : 'গোপন কী'}
                      </label>
                    </div>
                    <div className="relative">
                      <input 
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-4 ring-amber-500/10 font-bold text-slate-700 transition-all pr-12"
                        placeholder="••••••••"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Lock className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1.5">
                      <div className="text-[10px] text-amber-600 bg-amber-50/70 border border-amber-100 px-3 py-1 rounded-xl font-bold flex items-center gap-1">
                        <span>🔑</span>
                        <span>{language === 'en' ? 'Default Admin Key: admin123456' : 'ডিফল্ট এডমিন কি: admin123456'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setView('forgot_password');
                          setError(null);
                          setMessage(null);
                        }}
                        className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline transition-all"
                      >
                        {language === 'en' ? 'Forgot Password?' : 'পাসওয়ার্ড ভুলে গেছেন?'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={`w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all ${loading ? 'opacity-70 scale-95' : 'hover:bg-amber-600 active:scale-95'}`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {view === 'login' 
                      ? (language === 'en' ? 'Enter Dashboard' : 'ড্যাশবোর্ড প্রবেশ')
                      : (language === 'en' ? 'Send Reset Link' : 'রিসেট লিঙ্ক পাঠান')}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {view === 'login' && (
                <div className="relative pt-4 text-center">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-black text-slate-400">
                    <span className="bg-white px-4">OR / অথবা</span>
                  </div>
                </div>
              )}

              {view === 'login' && (
                <button 
                  type="button"
                  onClick={handleQuickBypass}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-3xl font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                  <ShieldCheck className="w-5 h-5 animate-pulse text-amber-100 animate-duration-1000 shrink-0" />
                  <span>
                    {language === 'en' 
                      ? 'Quick Admin Login (1-Click)' 
                      : '১-ক্লিকে সরাসরি এডমিন প্রবেশ'}
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {view === 'forgot_password' && (
                <div className="flex justify-center -mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline transition-all"
                  >
                    {language === 'en' ? 'Back to Login' : 'লগইন এ ফিরে যান'}
                  </button>
                </div>
              )}
            </form>
          )}

          <div className="pt-6 border-t border-slate-50 text-center">
             <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
                Authorized Personnel Only • <span className="text-amber-500">System V.2.0</span>
             </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
