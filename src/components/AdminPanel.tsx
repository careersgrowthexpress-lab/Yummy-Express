import React, { useState, useEffect } from "react";
import {
  Plus,
  BarChart2,
  Trash2,
  Edit2,
  X,
  Save,
  Package,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  Layout,
  TrendingUp,
  PieChart as PieIcon,
  Upload,
  ClipboardList,
  Search,
  Minus,
  Check,
  ShoppingBag,
  CreditCard,
  ExternalLink,
  ChevronRight,
  User,
  MapPin,
  Phone as PhoneIcon,
  Mail,
  MoreVertical,
  Shield,
  Fingerprint,
  Tag,
  Users,
  Database,
  Download,
  Truck,
  Calendar,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "../lib/supabase";
import { syncCustomerToGoogleSheets } from "../lib/webhook";
import { Product, Order } from "../types";
import { PRODUCTS, CATEGORIES } from "../constants";
import AdminLogin from "./AdminLogin";

interface AdminPanelProps {
  onClose: () => void;
  language: "en" | "bn";
}

type Tab =
  | "products"
  | "categories"
  | "inventory"
  | "orders"
  | "settings"
  | "analytics"
  | "admins"
  | "customers";

export default function AdminPanel({ onClose, language }: AdminPanelProps) {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showGoogleSheetsConfig, setShowGoogleSheetsConfig] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<Partial<Product>>({
    name: "",
    nameBn: "",
    price: 0,
    discount: 0,
    originalPrice: 0,
    description: "",
    descriptionBn: "",
    image: "",
    category: "Healthy",
    categoryBn: "স্বাস্থ্যকর",
    isNew: false,
    isOffer: false,
    stock: 0,
    weight: "",
    weightBn: "",
    deliveryCharge: undefined,
  });
  const [uploading, setUploading] = useState(false);

  // Admins state
  const [admins, setAdmins] = useState<
    { id: string; email: string; created_at: string; role?: string; permissions?: string }[]
  >([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loggedInAdmin, setLoggedInAdmin] = useState<{
    id: string;
    email: string;
    role?: string;
    permissions?: string;
  } | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "products",
    "orders",
    "settings",
    "customers",
  ]);
  const [showUidField, setShowUidField] = useState(false);

  // Customers state
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [syncingAll, setSyncingAll] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // New customer creation states
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustCity, setNewCustCity] = useState("");
  const [newCustArea, setNewCustArea] = useState("");
  const [newCustPassword, setNewCustPassword] = useState("123456");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Quick impersonation input
  const [quickImpersonateVal, setQuickImpersonateVal] = useState("");

  // Visitors state
  const [visitorLogs, setVisitorLogs] = useState<any[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visitorSearchTerm, setVisitorSearchTerm] = useState("");
  const [syncingAllVisits, setSyncingAllVisits] = useState(false);
  const [syncingAllOrders, setSyncingAllOrders] = useState(false);

  const [siteSettings, setSiteSettings] = useState({
    heroTitle: "",
    heroDesc: "",
    heroTitleBn: "",
    heroDescBn: "",
    logoUrl: "",
    companyInfo: {
      description: "",
      descriptionBn: "",
      mission: "",
      missionBn: "",
      team: [],
      googleSheetsWebhook: "",
      googleSheetsWebhookEnabled: false,
      googleSheetsLink: "",
      categories: [] as any[],
      sliders: [] as {
        id: string;
        image: string;
        titleEn: string;
        titleBn: string;
        subtitleEn: string;
        subtitleBn: string;
        linkProductId?: string;
        price?: number;
      }[],
      deliveryChargeInside: 60,
      deliveryChargeOutside: 120,
      deliveryFreeThreshold: 1000,
      deliveryChargeEnabled: false,
    },
  });

  const hasTabPermission = (tab: Tab) => {
    const adminEmail = loggedInAdmin?.email?.toLowerCase().trim();
    // Super admin gets all permissions
    if (adminEmail === "careers.growthexpress@gmail.com") return true;

    // For local mock / no supabase or if we are using mock auth of super admin
    const mockUserStr = localStorage.getItem("mock_user_session");
    if (mockUserStr) {
      try {
        const mockUser = JSON.parse(mockUserStr);
        if (mockUser?.email?.toLowerCase().trim() === "careers.growthexpress@gmail.com") return true;
      } catch (e) {}
    }

    if (!loggedInAdmin) return false;

    // By default, non-super-admins cannot manage other admins
    if (tab === "admins") return false;

    let permissionsStr = loggedInAdmin.permissions;
    if (!permissionsStr) {
      // Fallback to settings
      const fallbackMapping = (siteSettings.companyInfo as any)?.admin_permissions;
      if (fallbackMapping && fallbackMapping[adminEmail]) {
        permissionsStr = fallbackMapping[adminEmail];
      }
    }

    if (!permissionsStr) {
      // Default fallback if totally empty (all permissions except settings & admins)
      if (tab === "settings") return false;
      return true;
    }

    const allowedTabs = permissionsStr.split(",").map((s) => s.trim());
    
    // Sub-tab mapping rules
    if (tab === "categories" || tab === "inventory") {
      return allowedTabs.includes("products");
    }
    if (tab === "analytics") {
      return allowedTabs.includes("orders");
    }

    return allowedTabs.includes(tab);
  };

  const getPermissionsForAdminRecord = (adm: any) => {
    const emailToCheck = adm.email?.toLowerCase().trim();
    if (emailToCheck === "careers.growthexpress@gmail.com") {
      return language === "en" ? ["Super Admin"] : ["সুপার এডমিন"];
    }

    let permissionsStr = adm.permissions;
    if (!permissionsStr) {
      permissionsStr = (siteSettings.companyInfo as any)?.admin_permissions?.[emailToCheck];
    }

    if (!permissionsStr) {
      return language === "en"
        ? ["Catalog", "Inventory", "Orders", "Customers"]
        : ["ক্যাটালগ", "ইনভেন্টরি", "অর্ডার", "গ্রাহক"];
    }

    const list: string[] = [];
    const perms = permissionsStr.split(",").map((s: string) => s.trim());

    if (perms.includes("products")) list.push(language === "en" ? "Catalog & Inventory" : "ক্যাটালগ ও ইনভেন্টরি");
    if (perms.includes("orders")) list.push(language === "en" ? "Orders & Analytics" : "অর্ডার ও অ্যানালিটিক্স");
    if (perms.includes("settings")) list.push(language === "en" ? "Site Settings" : "সাইট সেটিংস");
    if (perms.includes("customers")) list.push(language === "en" ? "Customers" : "গ্রাহক");

    return list.length > 0 ? list : [language === "en" ? "No Access" : "কোন অ্যাক্সেস নেই"];
  };

  // Auto-redirect to first allowed tab if active tab is restricted
  useEffect(() => {
    if (isAdminAuthenticated && loggedInAdmin) {
      if (!hasTabPermission(activeTab)) {
        const tabsOrder: Tab[] = [
          "products",
          "categories",
          "inventory",
          "orders",
          "analytics",
          "settings",
          "admins",
          "customers",
        ];
        const firstAllowed = tabsOrder.find((t) => hasTabPermission(t));
        if (firstAllowed) {
          setActiveTab(firstAllowed);
        }
      }
    }
  }, [isAdminAuthenticated, loggedInAdmin, activeTab]);

  useEffect(() => {
    const checkUser = async () => {
      // First check mock user session fallback
      const mockUserStr = localStorage.getItem("mock_user_session");
      if (mockUserStr) {
        try {
          const mockUser = JSON.parse(mockUserStr);
          if (mockUser) {
            const isMainAdmin = mockUser.email?.toLowerCase() === "careers.growthexpress@gmail.com";
            let isAuthorized = isMainAdmin;
            let mockAdminData: any = null;

            if (supabase) {
              const { data } = await supabase
                .from("admins")
                .select("*")
                .eq("email", mockUser.email)
                .maybeSingle();
              if (data) {
                isAuthorized = true;
                mockAdminData = data;
              }
            }

            if (isAuthorized) {
              setIsAdminAuthenticated(true);
              setLoggedInAdmin({
                id: mockUser.id || "mock-id",
                email: mockUser.email || "",
                role: mockAdminData?.role,
                permissions: mockAdminData?.permissions
              });
              return;
            }
          }
        } catch (e) {
          console.error("Error parsing mock session:", e);
        }
      }

      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const user = session.user;
        let isAuthorized = user.email?.toLowerCase() === "careers.growthexpress@gmail.com";
        let dbAdminRow: any = null;

        const { data: adminData } = await supabase
          .from("admins")
          .select("*")
          .eq("email", user.email)
          .maybeSingle();

        if (adminData) {
          isAuthorized = true;
          dbAdminRow = adminData;
          if (adminData.id !== user.id) {
            await supabase
              .from("admins")
              .update({ id: user.id })
              .eq("email", user.email);
            dbAdminRow.id = user.id;
          }
        }

        if (!isAuthorized && user.email?.toLowerCase() === "careers.growthexpress@gmail.com") {
          const { error: insertError, data: insertedData } = await supabase.from("admins").insert({
            id: user.id,
            email: user.email,
            created_at: new Date().toISOString(),
          }).select().maybeSingle();

          if (!insertError) {
            isAuthorized = true;
            dbAdminRow = insertedData || { id: user.id, email: user.email };
          } else {
            console.error("Error auto-adding super admin to admins:", insertError);
            isAuthorized = true;
            dbAdminRow = { id: user.id, email: user.email };
          }
        }

        if (isAuthorized) {
          setIsAdminAuthenticated(true);
          setLoggedInAdmin({
            id: user.id,
            email: user.email || "",
            role: dbAdminRow?.role,
            permissions: dbAdminRow?.permissions
          });
        }
      }
    };
    checkUser();
  }, []);

  const fetchAdmins = async () => {
    if (!supabase) return;
    setAdminsLoading(true);
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error("Error fetching admins:", error);
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!newAdminEmail.trim()) {
      setStatusMessage({
        text:
          language === "en"
            ? "Email is required"
            : "ইমেল আবশ্যক",
        type: "error",
      });
      return;
    }

    const emailToInsert = newAdminEmail.trim().toLowerCase();
    let idToInsert = newAdminId.trim();

    if (!idToInsert) {
      idToInsert = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    const permissionsString = selectedPermissions.join(",");
    const roleString = selectedPermissions.length === 4 ? "full" : "custom";

    try {
      const { error: insertError } = await supabase.from("admins").insert({
        id: idToInsert,
        email: emailToInsert,
        role: roleString,
        permissions: permissionsString,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        if (insertError.code === "42703" || insertError.message?.includes("column") || insertError.message?.includes("role")) {
          console.warn("Table does not have role/permissions yet. Using settings fallback.");
          const { error: fallbackInsertError } = await supabase.from("admins").insert({
            id: idToInsert,
            email: emailToInsert,
            created_at: new Date().toISOString(),
          });
          if (fallbackInsertError) {
            if (fallbackInsertError.code === "23505") {
              throw new Error(
                language === "en"
                  ? "Admin with this UID/Email already exists"
                  : "এই UID/ইমেল সহ এডমিন ইতিমধ্যেই নিবন্ধিত",
              );
            }
            throw fallbackInsertError;
          }
        } else {
          if (insertError.code === "23505") {
            throw new Error(
              language === "en"
                ? "Admin with this UID/Email already exists"
                : "এই UID/ইমেল সহ এডমিন ইতিমধ্যেই নিবন্ধিত",
            );
          }
          throw insertError;
        }
      }

      // Sync and back up to settings JSON
      const updatedCompanyInfo = {
        ...siteSettings.companyInfo,
        admin_permissions: {
          ...((siteSettings.companyInfo as any)?.admin_permissions || {}),
          [emailToInsert]: permissionsString
        }
      };

      const { error: settingsError } = await supabase.from("settings").upsert({
        id: "global",
        ...siteSettings,
        companyInfo: updatedCompanyInfo,
        updated_at: new Date().toISOString(),
      });

      if (!settingsError) {
        setSiteSettings(prev => ({
          ...prev,
          companyInfo: updatedCompanyInfo
        }));
      }

      setStatusMessage({
        text:
          language === "en"
            ? "New admin added successfully with custom permissions!"
            : "নতুন এডমিন সফলভাবে কাস্টম পারমিশনসহ যোগ করা হয়েছে!",
        type: "success",
      });
      setNewAdminId("");
      setNewAdminEmail("");
      // Reset selected permissions
      setSelectedPermissions(["products", "orders", "settings", "customers"]);
      fetchAdmins();
    } catch (error: any) {
      console.error("Error adding admin:", error);
      setStatusMessage({
        text:
          error.message ||
          (language === "en"
            ? "Failed to add admin."
            : "এডমিন যোগ করতে ব্যর্থ হয়েছে।"),
        type: "error",
      });
    }
  };

  const handleDeleteAdmin = async (id: string, email: string) => {
    if (!supabase) return;

    if (email?.toLowerCase().trim() === "careers.growthexpress@gmail.com") {
      setStatusMessage({
        text:
          language === "en"
            ? "Super Admin cannot be deleted"
            : "সুপার এডমিন বাদ দেওয়া সম্ভব নয়!",
        type: "error",
      });
      return;
    }

    if (
      !window.confirm(
        language === "en"
          ? `Are you sure you want to remove ${email}?`
          : `আপনি কি নিশ্চিত যে আপনি ${email} কে এডমিন থেকে বাদ দিতে চান?`,
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from("admins").delete().eq("id", id);
      if (error) throw error;

      // Clean up fallback permissions
      const normalizedEmail = email.toLowerCase().trim();
      const updatedPermissionsBackup = { ...((siteSettings.companyInfo as any)?.admin_permissions || {}) };
      delete updatedPermissionsBackup[normalizedEmail];

      const updatedCompanyInfo = {
        ...siteSettings.companyInfo,
        admin_permissions: updatedPermissionsBackup
      };

      const { error: settingsError } = await supabase.from("settings").upsert({
        id: "global",
        ...siteSettings,
        companyInfo: updatedCompanyInfo,
        updated_at: new Date().toISOString(),
      });

      if (!settingsError) {
        setSiteSettings(prev => ({
          ...prev,
          companyInfo: updatedCompanyInfo
        }));
      }

      setStatusMessage({
        text:
          language === "en"
            ? "Admin removed successfully!"
            : "এডমিন সফলভাবে বাদ দেওয়া হয়েছে!",
        type: "success",
      });
      fetchAdmins();
    } catch (error: any) {
      console.error("Error deleting admin:", error);
      setStatusMessage({
        text:
          language === "en"
            ? "Failed to remove admin."
            : "এডমিন বাদ দিতে ব্যর্থ হয়েছে।",
        type: "error",
      });
    }
  };

  const backupProductsLocally = (productsList: Product[]) => {
    try {
      const backupStr = localStorage.getItem("yummydash_products_backup") || "[]";
      let currentBackup: Product[] = [];
      try {
        currentBackup = JSON.parse(backupStr);
      } catch {
        currentBackup = [];
      }
      
      let changed = false;
      productsList.forEach(prod => {
        // Strip out giant base64 images from backup data to conserve localStorage quota
        const minifiedProd = { ...prod };
        if (minifiedProd.image && minifiedProd.image.length > 1000) {
          minifiedProd.image = "";
        }
        
        const idx = currentBackup.findIndex(p => p.id === prod.id || p.name.trim().toLowerCase() === prod.name.trim().toLowerCase());
        if (idx !== -1) {
          // Merge with existing
          currentBackup[idx] = { ...currentBackup[idx], ...minifiedProd };
          changed = true;
        } else {
          currentBackup.push(minifiedProd);
          changed = true;
        }
      });

      // Keep only latest 300 products to prevent unbounded growth
      if (currentBackup.length > 300) {
        currentBackup = currentBackup.slice(-300);
        changed = true;
      }
      
      if (changed || !backupStr || backupStr === "[]") {
        try {
          localStorage.setItem("yummydash_products_backup", JSON.stringify(currentBackup));
        } catch (innerErr) {
          // If still exceeding quota, clear all images completely
          const superMinified = currentBackup.map(p => ({
            ...p,
            image: ""
          }));
          localStorage.setItem("yummydash_products_backup", JSON.stringify(superMinified));
        }
      }
    } catch (e) {
      console.warn("Failed to save local products backup (non-critical, quota limit exceeded):", e);
    }
  };

  const restoreProductsFromBackup = async () => {
    const backupStr = localStorage.getItem("yummydash_products_backup");
    if (!backupStr) {
      alert(language === "en" ? "No product backup found in this browser." : "এই ব্রাউজারে কোনো প্রোডাক্ট ব্যাকআপ পাওয়া যায়নি।");
      return;
    }

    let backupList: Product[] = [];
    try {
      backupList = JSON.parse(backupStr);
    } catch {
      alert(language === "en" ? "Backup data is corrupted." : "ব্যাকআপ ডাটা ক্ষতিগ্রস্ত হয়েছে।");
      return;
    }

    if (backupList.length === 0) {
      alert(language === "en" ? "Backup list is empty." : "ব্যাকআপ তালিকাটি খালি।");
      return;
    }

    const confirmMsg = language === "en"
      ? `Do you want to restore ${backupList.length} products from your browser backup?`
      : `আপনি কি ব্রাউজার ব্যাকআপ থেকে আপনার আগের ${backupList.length} টি প্রোডাক্ট পুনরুদ্ধার করতে চান?`;

    if (!window.confirm(confirmMsg)) return;

    setSeeding(true);
    try {
      if (!supabase) {
        localStorage.setItem("yummydash_custom_products", JSON.stringify(backupList));
        window.dispatchEvent(new Event("yummydash_products_change"));
        setProducts(backupList);
        setStatusMessage({
          text: language === "en" ? "Products restored successfully!" : "সফলভাবে প্রোডাক্ট পুনরুদ্ধার করা হয়েছে!",
          type: "success",
        });
        return;
      }

      // If Supabase is active, let's insert each product if it doesn't exist by name
      let restoredCount = 0;
      for (const prod of backupList) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("name", prod.name)
          .maybeSingle();

        if (!existing) {
          const { id, updated_at, ...cleanProd } = prod as any;
          const { error: insErr } = await supabase.from("products").insert([{
            ...cleanProd,
            updated_at: new Date().toISOString()
          }]);
          if (!insErr) restoredCount++;
        }
      }

      setStatusMessage({
        text: language === "en" 
          ? `Restored ${restoredCount} new products from backup!` 
          : `ব্যাকআপ থেকে ${restoredCount} টি নতুন প্রোডাক্ট সফলভাবে যোগ করা হয়েছে!`,
        type: "success",
      });
      fetchProducts();
    } catch (err) {
      console.error("Error restoring backup:", err);
      setStatusMessage({
        text: language === "en" ? "Restoration failed." : "পুনরুদ্ধার করতে ব্যর্থ হয়েছে।",
        type: "error",
      });
    } finally {
      setSeeding(false);
    }
  };

  const fetchProducts = async () => {
    const localProductsStr = localStorage.getItem("yummydash_custom_products");
    let localProducts = PRODUCTS;
    if (localProductsStr) {
      try {
        localProducts = JSON.parse(localProductsStr);
      } catch (err) {
        console.error("Error parsing local products: ", err);
      }
    }

    if (localProducts && localProducts.length > 0) {
      backupProductsLocally(localProducts);
    }

    const applyCustomCharges = (prods: Product[]) => {
      try {
        const localChargesStr = localStorage.getItem("yummydash_product_delivery_charges");
        if (localChargesStr) {
          const localCharges = JSON.parse(localChargesStr);
          return prods.map(p => ({
            ...p,
            deliveryCharge: localCharges[p.id] !== undefined ? Number(localCharges[p.id]) : p.deliveryCharge
          }));
        }
      } catch (err) {
        console.error("Error applying product delivery charges in AdminPanel:", err);
      }
      return prods;
    };

    if (!supabase) {
      setProducts(applyCustomCharges(localProducts));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const dbProds = data as Product[];
      const mergedProds = applyCustomCharges(dbProds);
      setProducts(mergedProds);
      if (mergedProds && mergedProds.length > 0) {
        backupProductsLocally(mergedProds);
      }
    } catch (error) {
      console.error("Supabase products error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const localSettingsStr = localStorage.getItem("yummydash_custom_settings");
    if (localSettingsStr) {
      try {
        const localSettings = JSON.parse(localSettingsStr);
        if (localSettings) {
          setSiteSettings({
            heroTitle: localSettings.heroTitle || "",
            heroDesc: localSettings.heroDesc || "",
            heroTitleBn: localSettings.heroTitleBn || "",
            heroDescBn: localSettings.heroDescBn || "",
            logoUrl: localSettings.logoUrl || "",
            companyInfo: {
              description: localSettings.companyInfo?.description || "",
              descriptionBn: localSettings.companyInfo?.descriptionBn || "",
              mission: localSettings.companyInfo?.mission || "",
              missionBn: localSettings.companyInfo?.missionBn || "",
              team: localSettings.companyInfo?.team || [],
              googleSheetsWebhook:
                localSettings.companyInfo?.googleSheetsWebhook || "",
              googleSheetsWebhookEnabled:
                !!localSettings.companyInfo?.googleSheetsWebhookEnabled,
              googleSheetsLink: localSettings.companyInfo?.googleSheetsLink || "",
              categories: localSettings.companyInfo?.categories || [],
              sliders: localSettings.companyInfo?.sliders || [],
              deliveryChargeInside: localSettings.companyInfo?.deliveryChargeInside !== undefined ? localSettings.companyInfo.deliveryChargeInside : 60,
              deliveryChargeOutside: localSettings.companyInfo?.deliveryChargeOutside !== undefined ? localSettings.companyInfo.deliveryChargeOutside : 120,
              deliveryFreeThreshold: localSettings.companyInfo?.deliveryFreeThreshold !== undefined ? localSettings.companyInfo.deliveryFreeThreshold : 1000,
              deliveryChargeEnabled: !!localSettings.companyInfo?.deliveryChargeEnabled,
            },
          });
        }
      } catch (err) {
        console.error("Error parsing local settings in AdminPanel:", err);
      }
    }
    if (!supabase) {
      console.warn("Supabase is not configured. Skipping settings fetch.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("id", "global")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        setSiteSettings({
          heroTitle: data.heroTitle || "",
          heroDesc: data.heroDesc || "",
          heroTitleBn: data.heroTitleBn || "",
          heroDescBn: data.heroDescBn || "",
          logoUrl: data.logoUrl || "",
          companyInfo: {
            description: data.companyInfo?.description || "",
            descriptionBn: data.companyInfo?.descriptionBn || "",
            mission: data.companyInfo?.mission || "",
            missionBn: data.companyInfo?.missionBn || "",
            team: data.companyInfo?.team || [],
            googleSheetsWebhook: data.companyInfo?.googleSheetsWebhook || "",
            googleSheetsWebhookEnabled:
              !!data.companyInfo?.googleSheetsWebhookEnabled,
            googleSheetsLink: data.companyInfo?.googleSheetsLink || "",
            categories: data.companyInfo?.categories || [],
            sliders: data.companyInfo?.sliders || [],
            deliveryChargeInside: data.companyInfo?.deliveryChargeInside !== undefined ? data.companyInfo.deliveryChargeInside : 60,
            deliveryChargeOutside: data.companyInfo?.deliveryChargeOutside !== undefined ? data.companyInfo.deliveryChargeOutside : 120,
            deliveryFreeThreshold: data.companyInfo?.deliveryFreeThreshold !== undefined ? data.companyInfo.deliveryFreeThreshold : 1000,
            deliveryChargeEnabled: !!data.companyInfo?.deliveryChargeEnabled,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const fetchOrders = async () => {
    const localOrdersStr = localStorage.getItem("yummydash_custom_orders");
    let localOrders: Order[] = [];
    if (localOrdersStr) {
      try {
        localOrders = JSON.parse(localOrdersStr);
      } catch (err) {
        console.error("Error parsing local orders:", err);
      }
    }

    if (!supabase) {
      setOrders(localOrders);
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data as Order[]);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    let list: any[] = [];

    // 1. Fetch from local storage backup first
    const localUsersStr = localStorage.getItem("yummydash_custom_users");
    if (localUsersStr) {
      try {
        list = JSON.parse(localUsersStr);
        if (!Array.isArray(list)) list = [];
      } catch (err) {
        console.error("Error parsing local fallback users:", err);
      }
    }

    // 2. Try fetching from Supabase 'users' table
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const mappedList = data.map((u: any) => ({
            id: u.id,
            name: u.display_name || "No Name",
            email: u.email || "",
            phone: u.phone || "",
            address: u.address || "",
            city: u.city || "",
            area: u.area || "",
            bio: u.bio || "",
            updated_at: u.updated_at || new Date().toISOString(),
          }));

          const mergedMap = new Map();
          list.forEach((u) => mergedMap.set(u.id, u));
          mappedList.forEach((u) => mergedMap.set(u.id, u));
          list = Array.from(mergedMap.values());
        }
      } catch (err) {
        console.error("Error fetching Supabase users in AdminPanel:", err);
      }
    }

    list.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    setCustomers(list);
    setCustomersLoading(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (
      !window.confirm(
        language === "en"
          ? "Are you sure you want to delete this customer profile?"
          : "আপনি কি নিশ্চিত যে এই কাস্টমারের প্রোফাইলটি মুছে ফেলতে চান?",
      )
    )
      return;

    const localUsersStr = localStorage.getItem("yummydash_custom_users");
    if (localUsersStr) {
      try {
        let list = JSON.parse(localUsersStr);
        if (Array.isArray(list)) {
          list = list.filter((u: any) => u.id !== id);
          localStorage.setItem("yummydash_custom_users", JSON.stringify(list));
        }
      } catch (err) {
        console.error("Error deleting user from local storage:", err);
      }
    }

    if (supabase) {
      try {
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) throw error;
        setStatusMessage({
          text:
            language === "en"
              ? "Customer deleted successfully!"
              : "কাস্টমার প্রোফাইল সফলভাবে মুছে ফেলা হয়েছে!",
          type: "success",
        });
      } catch (err) {
        console.error("Error deleting Supabase customer:", err);
        setStatusMessage({
          text: "Failed to delete customer from database.",
          type: "error",
        });
      }
    } else {
      setStatusMessage({
        text:
          language === "en"
            ? "Customer deleted successfully (locally)!"
            : "কাস্টমার প্রোফাইল লোকাল মেমোরি থেকে মুছে ফেলা হয়েছে!",
        type: "success",
      });
    }

    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert(language === 'en' ? 'Name and Phone are strictly required!' : 'নাম এবং মোবাইল নম্বর অবশ্যই দিতে হবে!');
      return;
    }

    const cleanPhone = newCustPhone.trim();
    const finalEmail = newCustEmail.trim() ? newCustEmail.trim() : `${cleanPhone}@yummydash.phone`;

    // 1. Generate standard custom ID
    const customerId = 'cust-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();

    const customerPayload = {
      id: customerId,
      name: newCustName.trim(),
      email: finalEmail,
      phone: cleanPhone,
      address: newCustAddress.trim(),
      city: newCustCity.trim(),
      area: newCustArea.trim(),
      bio: "",
      updated_at: new Date().toISOString()
    };

    // 2. Save in local user backup list (yummydash_custom_users)
    try {
      const { saveLocalUserBackup } = await import("../lib/webhook");
      saveLocalUserBackup(customerPayload);
    } catch (err) {
      console.error("Error importing/using saveLocalUserBackup:", err);
      // Fallback manual local saving
      const localUsersStr = localStorage.getItem("yummydash_custom_users") || "[]";
      let list = [];
      try { list = JSON.parse(localUsersStr); } catch (e) { list = []; }
      list = list.filter((u: any) => u.id !== customerId);
      list.push(customerPayload);
      localStorage.setItem("yummydash_custom_users", JSON.stringify(list));
    }

    // 3. Save to local mock users list for AuthModal manual login support
    try {
      const mockUsersStr = localStorage.getItem("mock_users_list") || "[]";
      let mockUsers = [];
      try { mockUsers = JSON.parse(mockUsersStr); } catch (e) { mockUsers = []; }
      mockUsers.push({
        id: customerId,
        name: newCustName.trim(),
        email: finalEmail,
        phone: cleanPhone,
        password: newCustPassword
      });
      localStorage.setItem("mock_users_list", JSON.stringify(mockUsers));
    } catch (err2) {
      console.error("Error updating mock users list:", err2);
    }

    // 4. Save to mock profile registry
    try {
      const custProf = {
        displayName: newCustName.trim(),
        phone: cleanPhone,
        photoURL: "",
        address: newCustAddress.trim(),
        city: newCustCity.trim(),
        area: newCustArea.trim(),
        bio: ""
      };
      localStorage.setItem(`mock_profile_${customerId}`, JSON.stringify(custProf));
    } catch (err3) {
      console.error("Error saving mock profile:", err3);
    }

    // 5. Try syncing with Supabase users table (ignoring relation errors)
    if (supabase) {
      try {
        const { error } = await supabase.from("users").insert([{
          id: customerId,
          display_name: newCustName.trim(),
          phone: cleanPhone,
          address: newCustAddress.trim(),
          city: newCustCity.trim(),
          area: newCustArea.trim(),
          updated_at: new Date().toISOString()
        }]);
        if (error) {
          console.log("Supabase users direct insert failed (expected due to FK references auth.users):", error.message);
        }
      } catch (dbErr) {
        // Safe to ignore
      }
    }

    // 6. Sync individual to Google Sheets webhook if setting is active
    try {
      const { syncCustomerToGoogleSheets } = await import("../lib/webhook");
      await syncCustomerToGoogleSheets(customerPayload);
    } catch (sheetsErr) {
      console.error("Webhook sync on creation failed/skipped:", sheetsErr);
    }

    // 7. Clear fields and success response
    setNewCustName("");
    setNewCustPhone("");
    setNewCustEmail("");
    setNewCustAddress("");
    setNewCustCity("");
    setNewCustArea("");
    setNewCustPassword("123456");
    setShowCreateForm(false);

    setStatusMessage({
      text: language === 'en'
        ? "Customer account created successfully!"
        : "কাস্টমার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!",
      type: "success"
    });

    fetchCustomers();
  };

  const handleImpersonateCustomer = (cust: any) => {
    const confirmMsg = language === "en"
      ? `Are you sure you want to log in/impersonate ${cust.name}? Your administrator credentials will be backed up so you can return anytime.`
      : `আপনি কি নিশ্চিত যে ${cust.name}-এর কাস্টমার একাউন্টে প্রবেশ করতে চান? বর্তমান এডমিন একাউন্ট ব্যাকআপ করে রাখা হবে যেন ইচ্ছে করলেই ফিরতে পারেন।`;

    if (!window.confirm(confirmMsg)) return;

    // 1. Save current admin session for restoring later
    const adminSessionFlag = localStorage.getItem("mock_user_session") || "supabase_admin";
    localStorage.setItem("admin_impersonator_session", adminSessionFlag);

    // 2. Set mock session with customer characteristics
    const customerUserSession = {
      id: cust.id,
      email: cust.email || `${cust.phone}@yummydash.phone`,
      user_metadata: {
        full_name: cust.name,
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${cust.name.replace(/\s+/g, '')}`
      }
    };

    const customerProfile = {
      displayName: cust.name,
      phone: cust.phone || "",
      address: cust.address || "",
      city: cust.city || "",
      area: cust.area || "",
      bio: cust.bio || ""
    };

    localStorage.setItem(`mock_profile_${cust.id}`, JSON.stringify(customerProfile));
    localStorage.setItem("mock_user_session", JSON.stringify(customerUserSession));

    // 3. Inform browser of auth transition
    window.dispatchEvent(new Event("mock_auth_change"));

    // 4. Close Admin Panel
    if (onClose) onClose();

    alert(
      language === "en"
        ? `Impersonation active. You are now browsing Yummy Express as ${cust.name}!`
        : `${cust.name} হিসেবে ইমপারসোনেশন সক্রিয় হয়েছে! আপনি এখন তার প্রোফাইল দিয়ে ব্রাউজ বা অর্ডার করতে পারবেন।`
    );
  };

  const handleQuickImpersonate = (e: React.FormEvent) => {
    e.preventDefault();
    const query = quickImpersonateVal.trim().toLowerCase();
    if (!query) return;

    // Search inside loaded customers list (matches phone or email or name)
    const found = customers.find(c => 
      (c.phone && c.phone.toLowerCase() === query) || 
      (c.email && c.email.toLowerCase() === query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) || 
      (c.email && c.email.toLowerCase().includes(query))
    );

    if (found) {
      setQuickImpersonateVal("");
      handleImpersonateCustomer(found);
    } else {
      alert(
        language === "en"
          ? `No registered customer found matching standard email or phone number: "${query}". Please verify or Register them first.`
          : `এই জিমেইল বা মোবাইল নাম্বার দিয়ে কোনো রেজিস্টার্ড কাস্টমার পাওয়া যায়নি: "${query}"। দয়া করে সঠিক নাম্বার টাইপ করুন বা নতুন কাস্টমার হিসেবে যুক্ত করুন।`
      );
    }
  };

  const handleSaveWebhookSettings = async (
    webhookUrl: string,
    enabled: boolean,
    googleSheetsLink?: string,
  ) => {
    setStatusMessage(null);
    try {
      const updatedSettings = {
        ...siteSettings,
        companyInfo: {
          ...siteSettings.companyInfo,
          googleSheetsWebhook: webhookUrl,
          googleSheetsWebhookEnabled: enabled,
          googleSheetsLink: googleSheetsLink || "",
        },
      };

      setSiteSettings(updatedSettings);

      if (supabase) {
        const { error } = await supabase.from("settings").upsert({
          id: "global",
          ...updatedSettings,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      localStorage.setItem(
        "yummydash_custom_settings",
        JSON.stringify(updatedSettings),
      );
      window.dispatchEvent(new Event("yummydash_settings_change"));

      setStatusMessage({
        text:
          language === "en"
            ? "Google Sheets Webhook Settings saved successfully!"
            : "গুগল শিট ওয়েব হুক সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!",
        type: "success",
      });
    } catch (err) {
      console.error("Error saving webhook settings:", err);
      setStatusMessage({ text: "Failed to save settings.", type: "error" });
    }
  };

  const handleSyncAllCustomers = async () => {
    const webhookUrl = siteSettings.companyInfo?.googleSheetsWebhook;
    const enabled = siteSettings.companyInfo?.googleSheetsWebhookEnabled;
    if (!webhookUrl || !enabled) {
      alert(
        language === "en"
          ? "Please configure and enable your Google Sheets Webhook URL first."
          : "দয়া করে প্রথমে গুগল শিট ওয়েবহুক ইউআরএল কনফিগার এবং সচল করুন।",
      );
      return;
    }

    if (customers.length === 0) {
      alert(
        language === "en"
          ? "No customers found to sync."
          : "সিঙ্ক করার জন্য কোন কাস্টমার পাওয়া যায়নি।",
      );
      return;
    }

    if (
      !window.confirm(
        language === "en"
          ? `Are you sure you want to sync all ${customers.length} customers to Google Sheets and REMOVE them from Admin?`
          : `আপনি কি সকল ${customers.length} জন কাস্টমারের ডাটা গুগল শিটে পাঠিয়ে এডমিন থেকে মুছে ফেলতে চান?`,
      )
    )
      return;

    setSyncingAll(true);
    let successCount = 0;
    const syncedIds: string[] = [];
    try {
      const { syncCustomerToGoogleSheets } = await import("../lib/webhook");
      for (const cust of customers) {
        try {
          await syncCustomerToGoogleSheets(cust);
          successCount++;
          syncedIds.push(cust.id);
        } catch (err) {
          console.error(`Failed to sync customer ${cust.id}:`, err);
        }
      }

      // Remove successfully synced customers from the Admin database & local storage to relieve pressure
      if (syncedIds.length > 0) {
        // Remove from local storage backup
        const localUsersStr = localStorage.getItem("yummydash_custom_users");
        if (localUsersStr) {
          try {
            let localUsers = JSON.parse(localUsersStr);
            if (Array.isArray(localUsers)) {
              localUsers = localUsers.filter((u: any) => !syncedIds.includes(u.id));
              localStorage.setItem("yummydash_custom_users", JSON.stringify(localUsers));
            }
          } catch (e) {}
        }
        
        // Remove from Supabase 'users' table
        if (supabase) {
          try {
            await supabase.from("users").delete().in("id", syncedIds);
          } catch (err) {
            console.error("Failed to delete synced customers from Supabase:", err);
          }
        }
        
        // Refresh customer list
        fetchCustomers();
      }

      setStatusMessage({
        text:
          language === "en"
            ? `Successfully synced & cleared ${successCount} customers to Google Sheets!`
            : `মোট ${successCount} জন কাস্টমারের ডাটা গুগল শিটে পাঠানো হয়েছে এবং এডমিন থেকে রিমুভ করা হয়েছে!`,
        type: "success",
      });
    } catch (err) {
      console.error("Bulk sync failed:", err);
      setStatusMessage({ text: "Bulk synchronization failed.", type: "error" });
    } finally {
      setSyncingAll(false);
    }
  };

  const exportOrdersToCSV = () => {
    if (orders.length === 0) {
      alert(
        language === "en"
          ? "No order records to export."
          : "ডাউনলোডের জন্য পর্যাপ্ত অর্ডার ডাটা নেই।",
      );
      return;
    }

    const headers = [
      "Order ID",
      "Customer Name",
      "Email",
      "Phone",
      "Address",
      "City/Area",
      "Payment Method",
      "Transaction ID",
      "Items Summary",
      "Total Amount",
      "Status",
      "Date Time",
    ];

    const rows = orders.map((order) => {
      const itemsList = order.items || [];
      const itemsSummary = itemsList
        .map((item: any) => `${item.quantity || 1}x ${item.name || item.nameBn || "Item"}`)
        .join("; ");

      const customerName = order.customer?.firstName
        ? `${order.customer.firstName} ${order.customer.lastName || ""}`.trim()
        : "Guest";

      return [
        order.id,
        `"${customerName.replace(/"/g, '""')}"`,
        order.customer?.email || "",
        order.customer?.phone || "",
        `"${(order.customer?.address || "").replace(/"/g, '""')}"`,
        `"${(order.customer?.area ? order.customer.area + ", " : "") + (order.customer?.city || "")}"`,
        order.customer?.paymentMethod || "Cash",
        order.customer?.transactionId || "",
        `"${itemsSummary.replace(/"/g, '""')}"`,
        order.total || 0,
        order.status,
        order.created_at ? new Date(order.created_at).toLocaleString() : "N/A",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `YummyDash_Orders_Export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncAllOrdersToSheets = async () => {
    const webhookUrl = siteSettings.companyInfo?.googleSheetsWebhook;
    const enabled = siteSettings.companyInfo?.googleSheetsWebhookEnabled;
    if (!webhookUrl || !enabled) {
      alert(
        language === "en"
          ? "Please configure and enable your Google Sheets Webhook URL first."
          : "দয়া করে প্রথমে গুগল শিট ওয়েবহুক ইউআরএল কনফিগার এবং সচল করুন।",
      );
      return;
    }

    if (orders.length === 0) {
      alert(
        language === "en"
          ? "No orders found to sync."
          : "সিঙ্ক করার জন্য কোন অর্ডার ডাটা পাওয়া যায়নি।",
      );
      return;
    }

    if (
      !window.confirm(
        language === "en"
          ? `Are you sure you want to sync all ${orders.length} orders to Google Sheets and REMOVE them from Admin?`
          : `আপনি কি সকল ${orders.length} টি অর্ডার গুগল শিটে পাঠিয়ে এডমিন থেকে মুছে ফেলতে চান?`,
      )
    )
      return;

    setSyncingAllOrders(true);
    let successCount = 0;
    const syncedIds: string[] = [];

    try {
      const { syncOrderToGoogleSheets } = await import("../lib/webhook");
      for (const order of orders) {
        try {
          const success = await syncOrderToGoogleSheets(order);
          if (success) {
            successCount++;
            syncedIds.push(order.id!);
          }
        } catch (err) {
          console.error(`Failed to sync order ${order.id}:`, err);
        }
      }

      // Remove successfully synced orders from the Admin database & local storage to relieve pressure
      if (syncedIds.length > 0) {
        // Remove from local storage
        const localOrdersStr = localStorage.getItem("yummydash_custom_orders");
        if (localOrdersStr) {
          try {
            let localOrders = JSON.parse(localOrdersStr);
            if (Array.isArray(localOrders)) {
              localOrders = localOrders.filter((o: any) => !syncedIds.includes(o.id));
              localStorage.setItem("yummydash_custom_orders", JSON.stringify(localOrders));
            }
          } catch (e) {}
        }

        // Remove from Supabase 'orders' table
        if (supabase) {
          try {
            await supabase.from("orders").delete().in("id", syncedIds);
          } catch (err) {
            console.error("Failed to delete synced orders from Supabase:", err);
          }
        }

        // Refresh orders list
        fetchOrders();
      }

      setStatusMessage({
        text:
          language === "en"
            ? `Successfully synced & cleared ${successCount} orders to Google Sheets!`
            : `মোট ${successCount} টি অর্ডার গুগল শিটে পাঠানো হয়েছে এবং এডমিন থেকে রিমুভ করা হয়েছে!`,
        type: "success",
      });
    } catch (err) {
      console.error("Bulk sync orders failed:", err);
      setStatusMessage({ text: "Orders bulk sync failed.", type: "error" });
    } finally {
      setSyncingAllOrders(false);
    }
  };


  const handleTestWebhook = async (webhookUrl: string) => {
    if (!webhookUrl) {
      alert(
        language === "en"
          ? "Please enter a webhook URL first."
          : "দয়া করে প্রথমে একটি ওয়েব হুক লিংক লিখুন।",
      );
      return;
    }
    setTestingWebhook(true);
    try {
      const dummyPayload = {
        id: "TEST-ID-1234",
        name: "Test Customer (YummyDash)",
        email: "test@yummydash.app",
        phone: "+8801700000000",
        address: "123 Dhanmondi, Dhaka",
        city: "Dhaka",
        area: "Dhanmondi",
        bio: "This is a test synchronization dispatch from YummyDash Admin Panel.",
        updated_at: new Date().toISOString(),
      };

      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dummyPayload),
      });

      setStatusMessage({
        text:
          language === "en"
            ? "Test record sent successfully! Check your Google Sheet."
            : "টেস্ট কাস্টমার ডাটা পাঠানো হয়েছে! আপনার গুগল শিটটি চেক করুন।",
        type: "success",
      });
    } catch (e) {
      console.error("Test sync failed:", e);
      setStatusMessage({
        text: "Test webhook failed to dispatch.",
        type: "error",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const exportCustomersToCSV = () => {
    if (customers.length === 0) {
      alert(
        language === "en"
          ? "No customer records to export."
          : "ডাউনলোডের জন্য পর্যাপ্ত কাস্টমার ডাটা নেই।",
      );
      return;
    }

    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Address",
      "City",
      "Area",
      "Bio",
      "Last Updated",
    ];
    const rows = customers.map((c) => [
      c.id,
      `"${(c.name || "").replace(/"/g, '""')}"`,
      c.email || "",
      c.phone || "",
      `"${(c.address || "").replace(/"/g, '""')}"`,
      `"${(c.city || "").replace(/"/g, '""')}"`,
      `"${(c.area || "").replace(/"/g, '""')}"`,
      `"${(c.bio || "").replace(/"/g, '""')}"`,
      c.updated_at,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `YummyDash_Customers_Export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchVisitorLogs = async () => {
    setVisitorsLoading(true);
    let list: any[] = [];

    // 1. Get from localStorage
    const localLogsStr = localStorage.getItem("yummydash_visitor_logs");
    if (localLogsStr) {
      try {
        list = JSON.parse(localLogsStr);
        if (!Array.isArray(list)) list = [];
      } catch (err) {
        console.error("Error parsing local visitor logs:", err);
      }
    }

    // 2. Fetch from Supabase as supplementary source if table exists
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("visitor_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(200);

        if (!error && data && data.length > 0) {
          const mergedMap = new Map();
          list.forEach((item) => mergedMap.set(item.id, item));
          data.forEach((item) =>
            mergedMap.set(item.id, {
              id: item.id,
              visitor_id: item.visitor_id,
              visitor_name: item.visitor_name,
              email: item.email || "",
              phone: item.phone || "",
              device: item.device,
              ip: item.ip,
              location: item.location,
              page_viewed: item.page_viewed,
              referrer: item.referrer || "",
              timestamp: item.timestamp,
            }),
          );
          list = Array.from(mergedMap.values());
        }
      } catch (err) {
        // Soft fail if Table visitor_logs does not exist
      }
    }

    list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    setVisitorLogs(list);
    setVisitorsLoading(false);
  };

  const handleClearVisitorLogs = () => {
    if (
      !window.confirm(
        language === "en"
          ? "Are you sure you want to clear all website visitor traffic logs?"
          : "আপনি কি নিশ্চিত যে সকল ভিজিটর লগ মুছে ফেলতে চান?",
      )
    )
      return;

    localStorage.removeItem("yummydash_visitor_logs");
    setVisitorLogs([]);
    setStatusMessage({
      text:
        language === "en"
          ? "Visitor logs cleared successfully!"
          : "সকল ভিজিটর লগ সফলভাবে ডিলিট করা হয়েছে!",
      type: "success",
    });
  };

  const handleSyncAllVisitsToSheets = async () => {
    const webhookUrl = siteSettings.companyInfo?.googleSheetsWebhook;
    const enabled = siteSettings.companyInfo?.googleSheetsWebhookEnabled;
    if (!webhookUrl || !enabled) {
      alert(
        language === "en"
          ? "Please configure and enable your Google Sheets Webhook URL first."
          : "দয়া করে প্রথমে গুগল শিট ওয়েবহুক ইউআরএল কনফিগার এবং সচল করুন।",
      );
      return;
    }

    if (visitorLogs.length === 0) {
      alert(
        language === "en"
          ? "No visits found to sync."
          : "সিঙ্ক করার জন্য কোন ভিজিটর ডাটা পাওয়া যায়নি।",
      );
      return;
    }

    if (
      !window.confirm(
        language === "en"
          ? `Sync all ${visitorLogs.length} page visits to Google Sheets and REMOVE them from Admin?`
          : `আপনি কি সকল ${visitorLogs.length} টি ভিজিট ডাটা গুগল শিটে পাঠিয়ে এডমিন থেকে মুছে ফেলতে চান?`,
      )
    )
      return;

    setSyncingAllVisits(true);
    let successCount = 0;
    const syncedIds: string[] = [];
    try {
      const { syncVisitToGoogleSheets } = await import("../lib/webhook");
      for (const visit of visitorLogs) {
        try {
          await syncVisitToGoogleSheets(visit);
          successCount++;
          syncedIds.push(visit.id);
        } catch (err) {
          console.error("Failed syncing visit:", err);
        }
      }

      // Remove synced visitor logs from local storage and Supabase to reduce pressure
      if (syncedIds.length > 0) {
        // Remove from local storage
        const localLogsStr = localStorage.getItem("yummydash_visitor_logs");
        if (localLogsStr) {
          try {
            let localLogs = JSON.parse(localLogsStr);
            if (Array.isArray(localLogs)) {
              localLogs = localLogs.filter((v: any) => !syncedIds.includes(v.id));
              localStorage.setItem("yummydash_visitor_logs", JSON.stringify(localLogs));
            }
          } catch (e) {}
        }

        // Remove from Supabase 'visitor_logs' table
        if (supabase) {
          try {
            await supabase.from("visitor_logs").delete().in("id", syncedIds);
          } catch (err) {
            console.error("Failed to delete synced visits from Supabase:", err);
          }
        }

        // Refresh list
        fetchVisitorLogs();
      }

      setStatusMessage({
        text:
          language === "en"
            ? `Successfully synced & cleared ${successCount} visits to Google Sheets!`
            : `মোট ${successCount} টি ভিজিট ডাটা গুগল শিটে পাঠানো হয়েছে এবং এডমিন থেকে রিমুভ করা হয়েছে!`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingAllVisits(false);
    }
  };

  const exportVisitorsToCSV = () => {
    if (visitorLogs.length === 0) {
      alert(
        language === "en"
          ? "No visitor logs to export."
          : "ডাউনলোডের জন্য পর্যাপ্ত ভিজিটর ডাটা নেই।",
      );
      return;
    }

    const headers = [
      "Visit ID",
      "Visitor ID",
      "Name / Persona",
      "Email",
      "Phone",
      "Device / OS",
      "IP Address",
      "Location",
      "Page Viewed",
      "Referrer Host",
      "Timestamp",
    ];
    const rows = visitorLogs.map((v) => [
      v.id,
      v.visitor_id,
      `"${(v.visitor_name || "").replace(/"/g, '""')}"`,
      v.email || "",
      v.phone || "",
      `"${(v.device || "").replace(/"/g, '""')}"`,
      v.ip || "",
      `"${(v.location || "").replace(/"/g, '""')}"`,
      `"${(v.page_viewed || "").replace(/"/g, '""')}"`,
      `"${(v.referrer || "").replace(/"/g, '""')}"`,
      v.timestamp,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `YummyDash_TrafficLogs_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchProducts();
    fetchSettings();
    fetchOrders();
    fetchAdmins();
    fetchCustomers();
    fetchVisitorLogs();

    // Listen to real-time visit logs
    const handleNewVisitLogged = () => {
      fetchVisitorLogs();
    };
    window.addEventListener("yummydash_new_visit_logged", handleNewVisitLogged);
    return () => {
      window.removeEventListener(
        "yummydash_new_visit_logged",
        handleNewVisitLogged,
      );
    };
  }, []);

  useEffect(() => {
    if (activeTab === "admins") {
      fetchAdmins();
    } else if (activeTab === "customers") {
      fetchCustomers();
      fetchVisitorLogs();
    }
  }, [activeTab]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supabase) {
      // Fallback directly to base64 if Supabase is not configured
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result as string }));
        setStatusMessage({
          text: "ইমেজটি সফলভাবে লোকাল মেমোরি (Base64) আকারে যুক্ত করা হয়েছে!",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ text: "File too large (max 5MB)", type: "error" });
      return;
    }

    setUploading(true);
    setStatusMessage({ text: "Uploading image...", type: "success" });
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Automatically attempt to create 'images' bucket in case it doesn't exist
      try {
        await supabase.storage.createBucket("images", { public: true });
      } catch (bErr) {
        console.log(
          'Tried creating "images" bucket, might already exist or need dashboard setup:',
          bErr,
        );
      }

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image: publicUrl }));
      setStatusMessage({
        text: "Image uploaded successfully!",
        type: "success",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      // Fall back to reading as base64 so the user can still save the product!
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result as string }));
        setStatusMessage({
          text: "আপলোড সফল হয়েছে! (Supabase বাকেট তৈরি না থাকায় ইমেজটি লোকাল মেমোরি Base64 আকারে সফলভাবে যুক্ত করা হয়েছে)",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supabase) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSiteSettings((prev) => ({
          ...prev,
          logoUrl: reader.result as string,
        }));
        setStatusMessage({
          text: "লোগোটি সফলভাবে লোকাল মেমোরি (Base64) আকারে যুক্ত করা হয়েছে!",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    setUploading(true);
    setStatusMessage({ text: "Uploading logo...", type: "success" });
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `site/${fileName}`;

      // Automatically attempt to create 'images' bucket in case it doesn't exist
      try {
        await supabase.storage.createBucket("images", { public: true });
      } catch (bErr) {
        console.log(
          'Tried creating "images" bucket, might already exist or need dashboard setup:',
          bErr,
        );
      }

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filePath);

      setSiteSettings((prev) => ({ ...prev, logoUrl: publicUrl }));
      setStatusMessage({ text: "Logo uploaded!", type: "success" });
    } catch (error: any) {
      console.error("Logo upload error:", error);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSiteSettings((prev) => ({
          ...prev,
          logoUrl: reader.result as string,
        }));
        setStatusMessage({
          text: "আপলোড সফল হয়েছে! (Supabase বাকেট তৈরি না থাকায় লোগোটি লোকাল মেমোরি Base64 আকারে সফলভাবে যুক্ত করা হয়েছে)",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const [newCategory, setNewCategory] = useState({
    en: "",
    bn: "",
    image: "",
  });
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(
    null,
  );
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);

  const handleCategoryImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supabase) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCategory((prev) => ({ ...prev, image: reader.result as string }));
        setStatusMessage({
          text: "Category image loaded locally as Base64!",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    setCategoryImageUploading(true);
    setStatusMessage({ text: "Uploading category image...", type: "success" });
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `category-${Date.now()}.${fileExt}`;
      const filePath = `categories/${fileName}`;

      try {
        await supabase.storage.createBucket("images", { public: true });
      } catch (bErr) {
        console.log('Bucket "images" already exists:', bErr);
      }

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filePath);

      setNewCategory((prev) => ({ ...prev, image: publicUrl }));
      setStatusMessage({
        text: "Category image successfully uploaded!",
        type: "success",
      });
    } catch (error: any) {
      console.error("Category image upload error:", error);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCategory((prev) => ({ ...prev, image: reader.result as string }));
        setStatusMessage({
          text: "আপলোড সফল হয়েছে! (Supabase বাকেট তৈরি না থাকায় ইমেজটি লোকাল মেমোরি Base64 আকারে সফলভাবে যুক্ত করা হয়েছে)",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setCategoryImageUploading(false);
    }
  };

  const [newSlider, setNewSlider] = useState({
    image: "",
    titleEn: "",
    titleBn: "",
    subtitleEn: "",
    subtitleBn: "",
    linkProductId: "",
    price: 0,
  });
  const [sliderUploading, setSliderUploading] = useState(false);

  const handleSliderImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supabase) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewSlider((prev) => ({ ...prev, image: reader.result as string }));
        setStatusMessage({
          text: "স্লাইডার ইমেজটি সফলভাবে লোকাল মেমোরি (Base64) আকারে যুক্ত করা হয়েছে!",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    setSliderUploading(true);
    setStatusMessage(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `slider-${Date.now()}.${fileExt}`;
      const filePath = `sliders/${fileName}`;

      try {
        await supabase.storage.createBucket("images", { public: true });
      } catch (bErr) {
        console.log('Bucket "images" already exists or is handled:', bErr);
      }

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filePath);

      setNewSlider((prev) => ({ ...prev, image: publicUrl }));
      setStatusMessage({
        text: "স্লাইডার ইমেজ আপলোড সফল হয়েছে!",
        type: "success",
      });
    } catch (error: any) {
      console.error("Slider upload error:", error);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewSlider((prev) => ({ ...prev, image: reader.result as string }));
        setStatusMessage({
          text: "আপলোড সফল হয়েছে! (Supabase বাকেট তৈরি না থাকায় ইমেজটি লোকাল মেমোরি Base64 আকারে সফলভাবে যুক্ত করা হয়েছে)",
          type: "success",
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setSliderUploading(false);
    }
  };

  const handleAddSlider = () => {
    if (!newSlider.image) {
      alert(
        language === "en"
          ? "Please upload or select an image for this banner."
          : "দয়া করে এই ব্যানারটির জন্য একটি ছবি আপলোড করুন।",
      );
      return;
    }
    const sliderId = Math.random().toString(36).substr(2, 9);

    let linkedPrice = 0;
    if (newSlider.linkProductId) {
      const p = products.find((prod) => prod.id === newSlider.linkProductId);
      if (p) {
        linkedPrice = p.price - (p.price * (p.discount || 0)) / 100;
      }
    }

    const sliderToAdd = {
      id: sliderId,
      image: newSlider.image,
      titleEn: newSlider.titleEn || "Seasonal Hot Pick",
      titleBn: newSlider.titleBn || "গরমের নতুন কালেকশন",
      subtitleEn: newSlider.subtitleEn || "",
      subtitleBn: newSlider.subtitleBn || "",
      linkProductId: newSlider.linkProductId || undefined,
      price: linkedPrice || undefined,
    };

    setSiteSettings((prev) => ({
      ...prev,
      companyInfo: {
        ...prev.companyInfo,
        sliders: [...(prev.companyInfo.sliders || []), sliderToAdd],
      },
    }));

    setNewSlider({
      image: "",
      titleEn: "",
      titleBn: "",
      subtitleEn: "",
      subtitleBn: "",
      linkProductId: "",
      price: 0,
    });

    setStatusMessage({
      text:
        language === "en"
          ? 'New slide added! Click "Save Configuration" at the bottom to save permanently.'
          : 'নতুন স্লাইড যোগ হয়েছে! স্থায়ীভাবে সংরক্ষণ করতে নিচের "Save Configuration" বাটনে ক্লিক করুন।',
      type: "success",
    });
  };

  const handleRemoveSlider = (sliderId: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      companyInfo: {
        ...prev.companyInfo,
        sliders: (prev.companyInfo.sliders || []).filter(
          (item) => item.id !== sliderId,
        ),
      },
    }));

    setStatusMessage({
      text:
        language === "en"
          ? 'Slide removed! Click "Save Configuration" at the bottom to save permanently.'
          : 'স্লাইডটি সরানো হয়েছে! স্থায়ীভাবে সংরক্ষণ করতে নিচের "Save Configuration" বাটনে ক্লিক করুন।',
      type: "success",
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newCategory.en || !newCategory.bn) {
        setStatusMessage({
          text: "Please fill in both English and Bengali names",
          type: "error",
        });
        return;
      }
      const enFormatted = newCategory.en.trim();
      const bnFormatted = newCategory.bn.trim();

      if (enFormatted.toLowerCase() === "all") {
        setStatusMessage({
          text: 'Category name "All" is reserved.',
          type: "error",
        });
        return;
      }

      const existing = siteSettings.companyInfo?.categories || [];

      if (editingCategoryName) {
        if (
          editingCategoryName.toLowerCase() !== enFormatted.toLowerCase() &&
          existing.some((c) => c.en.toLowerCase() === enFormatted.toLowerCase())
        ) {
          setStatusMessage({
            text: "Category already exists with that name",
            type: "error",
          });
          return;
        }

        const updatedCats = existing.map((c) =>
          c.en === editingCategoryName
            ? {
                en: enFormatted,
                bn: bnFormatted,
                image:
                  newCategory.image ||
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop",
              }
            : c,
        );

        const updatedSettings = {
          ...siteSettings,
          companyInfo: {
            ...siteSettings.companyInfo,
            categories: updatedCats,
          },
        };

        setSiteSettings(updatedSettings);

        // Update product categories to stay synced
        if (editingCategoryName !== enFormatted) {
          if (!supabase) {
            const localProductsStr = localStorage.getItem(
              "yummydash_custom_products",
            );
            if (localProductsStr) {
              try {
                let localProducts = JSON.parse(localProductsStr);
                localProducts = localProducts.map((p: any) =>
                  p.category === editingCategoryName
                    ? { ...p, category: enFormatted }
                    : p,
                );
                localStorage.setItem(
                  "yummydash_custom_products",
                  JSON.stringify(localProducts),
                );
                window.dispatchEvent(new Event("yummydash_products_change"));
              } catch (err) {
                console.error("Error updating local products category:", err);
              }
            }
          } else {
            const { error: prodError } = await supabase
              .from("products")
              .update({ category: enFormatted })
              .eq("category", editingCategoryName);
            if (prodError) {
              console.error(
                "Error updating supabase products category:",
                prodError,
              );
            }
          }
          fetchProducts();
        }

        setNewCategory({ en: "", bn: "", image: "" });
        setEditingCategoryName(null);

        if (supabase) {
          const { error } = await supabase.from("settings").upsert({
            id: "global",
            ...updatedSettings,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        } else {
          localStorage.setItem(
            "yummy_site_settings",
            JSON.stringify(updatedSettings),
          );
        }

        setStatusMessage({
          text: "Category updated successfully!",
          type: "success",
        });
      } else {
        if (
          existing.some((c) => c.en.toLowerCase() === enFormatted.toLowerCase())
        ) {
          setStatusMessage({ text: "Category already exists", type: "error" });
          return;
        }

        const updatedCats = [
          ...existing,
          {
            en: enFormatted,
            bn: bnFormatted,
            image:
              newCategory.image ||
              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop",
          },
        ];

        const updatedSettings = {
          ...siteSettings,
          companyInfo: {
            ...siteSettings.companyInfo,
            categories: updatedCats,
          },
        };

        setSiteSettings(updatedSettings);
        setNewCategory({ en: "", bn: "", image: "" });

        if (supabase) {
          const { error } = await supabase.from("settings").upsert({
            id: "global",
            ...updatedSettings,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        } else {
          localStorage.setItem(
            "yummy_site_settings",
            JSON.stringify(updatedSettings),
          );
        }

        setStatusMessage({
          text: "Category added successfully!",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Error saving category:", error);
      setStatusMessage({ text: "Failed to save category", type: "error" });
    }
  };

  const handleDeleteCategory = async (catEn: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the category "${catEn}"?`,
      )
    )
      return;
    try {
      const existing = siteSettings.companyInfo?.categories || [];
      const updatedCats = existing.filter((c) => c.en !== catEn);

      const updatedSettings = {
        ...siteSettings,
        companyInfo: {
          ...siteSettings.companyInfo,
          categories: updatedCats,
        },
      };

      setSiteSettings(updatedSettings);

      if (supabase) {
        const { error } = await supabase.from("settings").upsert({
          id: "global",
          ...updatedSettings,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        localStorage.setItem(
          "yummy_site_settings",
          JSON.stringify(updatedSettings),
        );
      }

      setStatusMessage({
        text: "Category deleted successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      setStatusMessage({ text: "Failed to delete category", type: "error" });
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    try {
      const { id, ...cleanData } = formData as any;
      const dataToSave = {
        ...cleanData,
        updated_at: new Date().toISOString(),
      };

      const saveLocalDeliveryCharge = (prodId: string, charge: number | undefined) => {
        try {
          const currentChargesStr = localStorage.getItem("yummydash_product_delivery_charges") || "{}";
          const currentCharges = JSON.parse(currentChargesStr);
          if (charge !== undefined && charge !== null && charge >= 0) {
            currentCharges[prodId] = charge;
          } else {
            delete currentCharges[prodId];
          }
          localStorage.setItem("yummydash_product_delivery_charges", JSON.stringify(currentCharges));
        } catch (err) {
          console.error("Error saving local delivery charge mapping:", err);
        }
      };

      if (!supabase) {
        // Fallback for when there's no configured database
        const localProductsStr = localStorage.getItem(
          "yummydash_custom_products",
        );
        let localProducts = [...PRODUCTS];
        if (localProductsStr) {
          try {
            localProducts = JSON.parse(localProductsStr);
          } catch (err) {
            console.error("Error parsing local products in save:", err);
          }
        }

        if (editingId) {
          localProducts = localProducts.map((p) =>
            p.id === editingId
              ? ({ ...p, ...formData, id: editingId } as Product)
              : p,
          );
          saveLocalDeliveryCharge(editingId, formData.deliveryCharge);
          setStatusMessage({
            text: "Product updated successfully!",
            type: "success",
          });
          backupProductsLocally([{ ...formData, id: editingId } as Product]);
        } else {
          const newProduct: Product = {
            ...formData,
            id: "prod_" + Math.random().toString(36).substring(2, 9),
          } as Product;
          localProducts.unshift(newProduct);
          saveLocalDeliveryCharge(newProduct.id, formData.deliveryCharge);
          setStatusMessage({
            text: "Product added successfully!",
            type: "success",
          });
          backupProductsLocally([newProduct]);
        }

        localStorage.setItem(
          "yummydash_custom_products",
          JSON.stringify(localProducts),
        );
        window.dispatchEvent(new Event("yummydash_products_change"));
        setEditingId(null);
        setIsAdding(false);
        fetchProducts();
        return;
      }

      if (editingId) {
        saveLocalDeliveryCharge(editingId, formData.deliveryCharge);
        let { error } = await supabase
          .from("products")
          .update(dataToSave)
          .eq("id", editingId);

        if (error) {
          console.warn(
            "Retrying database update without optional columns due to error:",
            error,
          );
          const { originalPrice, deliveryCharge, ...staleData } = dataToSave;
          const retryRes = await supabase
            .from("products")
            .update(staleData)
            .eq("id", editingId);
          error = retryRes.error;
        }

        if (error) throw error;
        setStatusMessage({
          text: "Product updated successfully!",
          type: "success",
        });
      } else {
        let res = await supabase.from("products").insert([dataToSave]).select();
        let error = res.error;
        let insertedId = res.data?.[0]?.id;

        if (error) {
          console.warn(
            "Retrying database insert without optional columns due to error:",
            error,
          );
          const { originalPrice, deliveryCharge, ...staleData } = dataToSave;
          const retryRes = await supabase.from("products").insert([staleData]).select();
          error = retryRes.error;
          insertedId = retryRes.data?.[0]?.id;
        }

        if (error) throw error;

        if (insertedId) {
          saveLocalDeliveryCharge(insertedId, formData.deliveryCharge);
        } else {
          try {
            const { data: latestProds } = await supabase
              .from("products")
              .select("id")
              .eq("name", dataToSave.name)
              .order("updated_at", { ascending: false })
              .limit(1);
            if (latestProds && latestProds.length > 0) {
              saveLocalDeliveryCharge(latestProds[0].id, formData.deliveryCharge);
            }
          } catch (e) {
            console.error("Error getting inserted product ID for delivery charge:", e);
          }
        }

        setStatusMessage({
          text: "Product added successfully!",
          type: "success",
        });
      }

      setEditingId(null);
      setIsAdding(false);
      fetchProducts();
    } catch (error) {
      console.error("Save error:", error);
      setStatusMessage({ text: "Failed to save product.", type: "error" });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    try {
      if (!supabase) {
        localStorage.setItem(
          "yummydash_custom_settings",
          JSON.stringify(siteSettings),
        );
        window.dispatchEvent(new Event("yummydash_settings_change"));
        setStatusMessage({
          text: "Settings saved successfully (locally)!",
          type: "success",
        });
        return;
      }
      const { error } = await supabase.from("settings").upsert({
        id: "global",
        ...siteSettings,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      localStorage.setItem(
        "yummydash_custom_settings",
        JSON.stringify(siteSettings),
      );
      setStatusMessage({
        text: "Settings saved successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Settings save error:", error);
      setStatusMessage({ text: "Failed to save settings.", type: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;
    try {
      if (!supabase) {
        const localProductsStr = localStorage.getItem(
          "yummydash_custom_products",
        );
        let localProducts = [...PRODUCTS];
        if (localProductsStr) {
          try {
            localProducts = JSON.parse(localProductsStr);
          } catch (err) {
            console.error("Error parsing local products in delete:", err);
          }
        }
        localProducts = localProducts.filter((p) => p.id !== id);
        localStorage.setItem(
          "yummydash_custom_products",
          JSON.stringify(localProducts),
        );
        window.dispatchEvent(new Event("yummydash_products_change"));
        setStatusMessage({ text: "Product deleted.", type: "success" });
        fetchProducts();
        return;
      }

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setStatusMessage({ text: "Product deleted.", type: "success" });
      fetchProducts();
    } catch (error) {
      console.error("Delete error:", error);
      setStatusMessage({ text: "Failed to delete product.", type: "error" });
    }
  };

  const seedDatabase = async () => {
    if (!window.confirm("Seed database with default products?")) return;
    setSeeding(true);
    try {
      if (!supabase) {
        localStorage.setItem(
          "yummydash_custom_products",
          JSON.stringify(PRODUCTS),
        );
        window.dispatchEvent(new Event("yummydash_products_change"));
        setStatusMessage({ text: "Database seeded!", type: "success" });
        setProducts(PRODUCTS);
        setSeeding(false);
        return;
      }

      const dataToSeed = PRODUCTS.map(({ id: _, ...p }) => ({
        ...p,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("products").insert(dataToSeed);
      if (error) throw error;
      setStatusMessage({ text: "Database seeded!", type: "success" });
      fetchProducts();
    } catch (error) {
      console.error("Seeding error:", error);
      setStatusMessage({ text: "Seeding failed.", type: "error" });
    } finally {
      setSeeding(false);
    }
  };

  const clearInventory = async () => {
    if (!window.confirm("Delete ALL products?")) return;
    try {
      if (!supabase) {
        localStorage.setItem("yummydash_custom_products", JSON.stringify([]));
        window.dispatchEvent(new Event("yummydash_products_change"));
        setProducts([]);
        setStatusMessage({ text: "Inventory cleared!", type: "success" });
        return;
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete everything
      if (error) throw error;
      setProducts([]);
      setStatusMessage({ text: "Inventory cleared!", type: "success" });
    } catch (error) {
      console.error("Clear error:", error);
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name || "",
      nameBn: product.nameBn || "",
      price: product.price ?? 0,
      discount: product.discount ?? 0,
      originalPrice: product.originalPrice ?? 0,
      description: product.description || "",
      descriptionBn: product.descriptionBn || "",
      image: product.image || "",
      category: product.category || "Healthy",
      categoryBn: product.categoryBn || "স্বাস্থ্যকর",
      isNew: product.isNew ?? false,
      isOffer: product.isOffer ?? false,
      stock: product.stock ?? 0,
      weight: product.weight || "",
      weightBn: product.weightBn || "",
      deliveryCharge: product.deliveryCharge,
    });
    setIsAdding(true);
  };

  const handleUpdateStock = async (productId: string, newStock: number) => {
    if (newStock < 0) return;
    try {
      if (!supabase) {
        const localProductsStr = localStorage.getItem(
          "yummydash_custom_products",
        );
        let localProducts = [...PRODUCTS];
        if (localProductsStr) {
          try {
            localProducts = JSON.parse(localProductsStr);
          } catch (err) {
            console.error("Error parsing local products in stock update:", err);
          }
        }
        localProducts = localProducts.map((p) =>
          p.id === productId ? { ...p, stock: newStock } : p,
        );
        localStorage.setItem(
          "yummydash_custom_products",
          JSON.stringify(localProducts),
        );
        window.dispatchEvent(new Event("yummydash_products_change"));
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p)),
        );
        return;
      }

      const { error } = await supabase
        .from("products")
        .update({
          stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);
      if (error) throw error;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p)),
      );
    } catch (error) {
      console.error("Error updating stock:", error);
      setStatusMessage({ text: "Failed to update stock.", type: "error" });
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: Order["status"],
  ) => {
    try {
      if (!supabase) {
        const localOrdersStr = localStorage.getItem("yummydash_custom_orders");
        let localOrders: Order[] = [];
        if (localOrdersStr) {
          try {
            localOrders = JSON.parse(localOrdersStr);
          } catch (err) {
            console.error("Error parsing local orders in status update:", err);
          }
        }
        localOrders = localOrders.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus, updated_at: new Date().toISOString() }
            : o,
        );
        localStorage.setItem(
          "yummydash_custom_orders",
          JSON.stringify(localOrders),
        );
        window.dispatchEvent(new Event("yummydash_orders_change"));
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
        );
        setStatusMessage({ text: `Order ${newStatus}`, type: "success" });
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      setStatusMessage({ text: `Order ${newStatus}`, type: "success" });
    } catch (error) {
      console.error("Error updating status:", error);
      setStatusMessage({
        text: "Failed to update order status.",
        type: "error",
      });
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;

    const nameEn = (p.name || "").toLowerCase();
    const nameBn = (p.nameBn || "").toLowerCase();
    const catEn = (p.category || "").toLowerCase();
    const catBn = (p.categoryBn || "").toLowerCase();
    const descEn = (p.description || "").toLowerCase();
    const descBn = (p.descriptionBn || "").toLowerCase();

    return (
      nameEn.includes(q) ||
      nameBn.includes(q) ||
      catEn.includes(q) ||
      catBn.includes(q) ||
      descEn.includes(q) ||
      descBn.includes(q)
    );
  });

  if (!isAdminAuthenticated) {
    return (
      <AdminLogin
        onSuccess={() => setIsAdminAuthenticated(true)}
        onClose={onClose}
        language={language}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl h-auto md:h-[92vh] min-h-[500px] md:min-h-0 rounded-3xl sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 my-auto">
        {/* Header / Sidebar Tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-slate-50 border-r border-slate-100 p-8 flex flex-col">
            <div className="mb-12">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-600/20">
                  <Package className="w-5 h-5 text-white" />
                </div>
                ADMIN
              </h2>
            </div>

            <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              {hasTabPermission("products") && (
                <button
                  onClick={() => setActiveTab("products")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "products" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <Layout className="w-4 h-4" />
                  {language === "en" ? "Catalog" : "ক্যাটালগ"}
                </button>
              )}
              {hasTabPermission("categories") && (
                <button
                  onClick={() => setActiveTab("categories")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "categories" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <Tag className="w-4 h-4" />
                  {language === "en" ? "Categories" : "ক্যাটাগরি"}
                </button>
              )}
              {hasTabPermission("inventory") && (
                <button
                  onClick={() => setActiveTab("inventory")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "inventory" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {language === "en" ? "Inventory" : "ইনভেন্টরি"}
                </button>
              )}
              {hasTabPermission("orders") && (
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "orders" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  {language === "en" ? "Orders" : "অর্ডার"}
                </button>
              )}
              {hasTabPermission("analytics") && (
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "analytics" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <BarChart2 className="w-4 h-4" />
                  {language === "en" ? "Analytics" : "অ্যানালিটিক্স"}
                </button>
              )}
              {hasTabPermission("settings") && (
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "settings" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <SettingsIcon className="w-4 h-4" />
                  {language === "en" ? "Site Settings" : "সাইট সেটিংস"}
                </button>
              )}
              {hasTabPermission("admins") && (
                <button
                  onClick={() => setActiveTab("admins")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "admins" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <Shield className="w-4 h-4" />
                  {language === "en" ? "Manage Admins" : "অ্যাডমিন ম্যানেজমেন্ট"}
                </button>
              )}
              {hasTabPermission("customers") && (
                <button
                  onClick={() => setActiveTab("customers")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "customers" ? "bg-white text-amber-600 shadow-md border border-amber-100 shadow-amber-900/5" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                >
                  <Users className="w-4 h-4" />
                  {language === "en"
                    ? "Customers & Sheets"
                    : "গ্রাহক ও গুগল শিট সিঙ্ক"}
                </button>
              )}
            </nav>

            <button
              onClick={onClose}
              className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <X className="w-4 h-4" />
              Close Panel
            </button>
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Top Bar */}
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                {activeTab === "products"
                  ? "Product Management"
                  : activeTab === "categories"
                    ? "Category Management"
                    : activeTab === "inventory"
                      ? "Inventory Management"
                      : activeTab === "settings"
                        ? "Global Settings"
                        : activeTab === "admins"
                          ? "Admin Roles & Access"
                          : "Business Intelligence"}
              </h3>

              <div className="flex items-center gap-4 flex-wrap ml-auto">
                {activeTab === "inventory" && (
                  <div className="max-w-xs relative shrink-0">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      placeholder="Search inventory..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-50 border-none rounded-full px-12 py-2 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-amber-500/10 transition-all w-48 sm:w-64"
                    />
                  </div>
                )}

                {activeTab === "analytics" && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100 shrink-0">
                    <TrendingUp className="w-3 h-3 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                      Live Insights
                    </span>
                  </div>
                )}

                {statusMessage && (
                  <div
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-1 shrink-0 ${statusMessage.type === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"}`}
                  >
                    {statusMessage.text}
                  </div>
                )}

                {activeTab === "products" && !isAdding && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      disabled={seeding || loading}
                      onClick={clearInventory}
                      className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                    <button
                      disabled={seeding || loading}
                      onClick={restoreProductsFromBackup}
                      className="px-6 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-100 text-[10px] font-black uppercase tracking-widest rounded-full disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title={language === "en" ? "Restore previously added products" : "পূর্বের যোগকৃত প্রোডাক্ট পুনরুদ্ধার করুন"}
                    >
                      <RotateCcw className="w-3 h-3" />
                      {language === "en" ? "Restore Backup" : "ব্যাকআপ পুনরুদ্ধার"}
                    </button>
                    {products.length === 0 && (
                      <button
                        onClick={seedDatabase}
                        disabled={seeding || loading}
                        className="px-6 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-amber-100 transition-all border border-amber-100 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 inline-block mr-2 ${seeding ? "animate-spin" : ""}`}
                        />
                        {seeding ? "Syncing..." : "Sync Demo Data"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsAdding(true);
                        setEditingId(null);
                        setFormData({
                          name: "",
                          nameBn: "",
                          price: 0,
                          discount: 0,
                          originalPrice: 0,
                          description: "",
                          descriptionBn: "",
                          image: "",
                          category: "Healthy",
                          categoryBn: "স্বাস্থ্যকর",
                          isNew: false,
                          isOffer: false,
                          stock: 0,
                        });
                      }}
                      className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-amber-600 transition-all shadow-xl shadow-slate-900/10 cursor-pointer"
                    >
                      Add Product
                    </button>
                  </div>
                )}

                {/* Close Button / কোরাস অপশন */}
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-full transition-all flex items-center justify-center border border-slate-200 shadow-sm shrink-0"
                  aria-label="Close"
                  title={
                    language === "en"
                      ? "Close Admin Panel"
                      : "প্যানেল বন্ধ করুন"
                  }
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {activeTab === "products" ? (
                <>
                  {isAdding ? (
                    <form
                      onSubmit={handleSaveProduct}
                      className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500"
                    >
                      <div className="flex items-center justify-between mb-10">
                        <h4 className="text-2xl font-bold text-slate-900">
                          {editingId ? "Update Item" : "New Creation"}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsAdding(false)}
                          className="text-amber-600 font-bold text-sm"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Name (EN)
                            </label>
                            <input
                              required
                              value={formData.name || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  name: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Name (BN)
                            </label>
                            <input
                              required
                              value={formData.nameBn || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  nameBn: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en"
                                  ? "Current/Offer Price (৳)"
                                  : "বর্তমান/অফার মূল্য (৳)"}
                              </label>
                              <input
                                required
                                type="number"
                                value={formData.price !== undefined && formData.price !== null ? formData.price : ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    price: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en"
                                  ? "Previous/Original Price (৳)"
                                  : "আগের দাম/পূর্বমূল্য (৳)"}
                              </label>
                              <input
                                type="number"
                                value={formData.originalPrice || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    originalPrice: e.target.value
                                      ? parseFloat(e.target.value)
                                      : undefined,
                                  })
                                }
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none"
                                placeholder={
                                  language === "en"
                                    ? "Optional previous price"
                                    : "ঐচ্ছিক পূর্ববর্তী মূল্য"
                                }
                              />
                            </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en" ? "Stock (Units)" : "স্টক পরিমাণ (ইউনিট)"}
                              </label>
                              <input
                                required
                                type="number"
                                value={formData.stock !== undefined && formData.stock !== null ? formData.stock : ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    stock: parseInt(e.target.value),
                                  })
                                }
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 font-extrabold">
                                {language === "en" ? "Custom Delivery Charge (৳)" : "কাস্টম ডেলিভারি চার্জ (৳)"}
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.deliveryCharge !== undefined && formData.deliveryCharge !== null ? formData.deliveryCharge : ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    deliveryCharge: e.target.value ? parseFloat(e.target.value) : undefined,
                                  })
                                }
                                placeholder={
                                  language === "en"
                                    ? "Leave empty to use site default"
                                    : "খালি রাখলে ডিফল্ট চার্জ প্রযোজ্য হবে"
                                }
                                className="w-full bg-amber-50/40 border border-amber-150/80 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-bold"
                              />
                            </div>
                          </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Image Source
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="relative group">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageUpload}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  disabled={uploading}
                                />
                                <div className="flex items-center justify-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl px-6 py-4 group-hover:border-amber-400/50 transition-all text-center">
                                  <div className="flex flex-col items-center">
                                    <Upload
                                      className={`w-4 h-4 mb-1 ${uploading ? "animate-bounce text-amber-500" : "text-slate-400"}`}
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                      {uploading ? "Processing..." : "Upload"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <input
                                placeholder="Or paste URL"
                                value={formData.image || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    image: e.target.value,
                                  })
                                }
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                              />
                            </div>
                            {formData.image && (
                              <div className="mt-4 relative w-full h-32 rounded-2xl overflow-hidden bg-slate-100 group">
                                <img
                                  src={formData.image}
                                  className="w-full h-full object-cover"
                                  alt="Preview"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        image: "",
                                      }))
                                    }
                                    className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Discount (%)
                            </label>
                            <input
                              type="number"
                              value={formData.discount !== undefined && formData.discount !== null ? formData.discount : ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  discount: parseFloat(e.target.value),
                                })
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Weight/Volume (EN)
                              </label>
                              <input
                                value={formData.weight || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    weight: e.target.value,
                                  })
                                }
                                placeholder="e.g. 1 kg, 500g"
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Weight/Volume (BN)
                              </label>
                              <input
                                value={formData.weightBn || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    weightBn: e.target.value,
                                  })
                                }
                                placeholder="যেমন: ১ কেজি, ৫০০ গ্রাম"
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Desc (EN)
                            </label>
                            <textarea
                              required
                              rows={3}
                              value={formData.description || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  description: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none resize-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Desc (BN)
                            </label>
                            <textarea
                              required
                              rows={3}
                              value={formData.descriptionBn || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  descriptionBn: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none resize-none"
                            />
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block pb-1">
                              Product Category
                            </label>
                            <select
                              required
                              value={`${formData.category || ""}|${formData.categoryBn || ""}`}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [en, bn] = e.target.value.split("|");
                                  setFormData({
                                    ...formData,
                                    category: en,
                                    categoryBn: bn,
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    category: "",
                                    categoryBn: "",
                                  });
                                }
                              }}
                              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none text-xs font-bold appearance-none cursor-pointer"
                            >
                              <option value="">-- Choose Category --</option>
                              {(siteSettings.companyInfo?.categories &&
                              siteSettings.companyInfo.categories.length > 0
                                ? siteSettings.companyInfo.categories
                                : CATEGORIES
                              )
                                .filter((c) => c.en !== "All")
                                .map((c) => (
                                  <option key={c.en} value={`${c.en}|${c.bn}`}>
                                    {c.en} ({c.bn})
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-8 pt-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={formData.isNew}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    isNew: e.target.checked,
                                  })
                                }
                                className="hidden"
                              />
                              <div
                                className={`w-10 h-6 rounded-full transition-all relative ${formData.isNew ? "bg-emerald-500" : "bg-slate-200"}`}
                              >
                                <div
                                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isNew ? "left-5" : "left-1"}`}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-600">
                                New Arrival
                              </span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={formData.isOffer}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    isOffer: e.target.checked,
                                  })
                                }
                                className="hidden"
                              />
                              <div
                                className={`w-10 h-6 rounded-full transition-all relative ${formData.isOffer ? "bg-amber-500" : "bg-slate-200"}`}
                              >
                                <div
                                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isOffer ? "left-5" : "left-1"}`}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-600">
                                Special Offer
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="mt-12 flex items-center gap-6">
                        <button
                          type="submit"
                          className="px-12 py-5 bg-amber-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-amber-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                        >
                          <Save className="w-5 h-5" />
                          {editingId ? "Update Product" : "Publish Item"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      {products.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-slate-300 gap-4">
                          <Package className="w-16 h-16 opacity-10" />
                          <p className="font-bold tracking-widest text-xs uppercase">
                            Storehouse is empty
                          </p>
                          <button
                            onClick={seedDatabase}
                            className="mt-4 px-6 py-3 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-600 transition-all"
                          >
                            Import Defaults
                          </button>
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <div
                            key={p.id}
                            className="group bg-slate-50/50 hover:bg-white border hover:border-amber-200 p-4 rounded-[2rem] transition-all flex items-center gap-8 hover:shadow-2xl hover:shadow-slate-100"
                          >
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 shrink-0">
                              <img
                                src={p.image || undefined}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1 flex-wrap">
                                <h5 className="font-black text-slate-900 tracking-tight">
                                  {language === "en" ? p.name : p.nameBn}
                                </h5>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-1 bg-white rounded-full border border-slate-100">
                                  {p.category}
                                </span>
                                {p.deliveryCharge !== undefined && p.deliveryCharge !== null && p.deliveryCharge >= 0 && (
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 px-3 py-1 bg-amber-50 rounded-full border border-amber-200/50 flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    ৳{p.deliveryCharge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-1">
                                {p.description}
                              </p>
                            </div>
                            <div className="text-right shrink-0 pr-4">
                              <div className="text-xl font-black text-slate-900 flex flex-col items-end">
                                {p.originalPrice &&
                                  p.originalPrice > p.price && (
                                    <span className="text-xs font-semibold text-slate-400 line-through">
                                      ৳{p.originalPrice}
                                    </span>
                                  )}
                                <span>৳{p.price}</span>
                              </div>
                              {p.stock !== undefined && (
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                  {p.stock} Units
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={() => startEdit(p)}
                                  className="p-3 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : activeTab === "inventory" ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            Product
                          </th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            Category
                          </th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            Price
                          </th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            Status
                          </th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 text-center">
                            In Stock
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => {
                          const isLowStock =
                            (p.stock || 0) < 10 && (p.stock || 0) > 0;
                          const isOutOfStock = (p.stock || 0) <= 0;

                          return (
                            <tr
                              key={p.id}
                              className="group hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-8 py-4 border-b border-slate-50">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                    <img
                                      src={p.image}
                                      className="w-full h-full object-cover"
                                      alt=""
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate text-sm">
                                      {language === "en" ? p.name : p.nameBn}
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-400 truncate uppercase tracking-widest">
                                      ID: {p.id.slice(0, 8)}
                                    </div>
                                    {p.deliveryCharge !== undefined && p.deliveryCharge !== null && p.deliveryCharge >= 0 && (
                                      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 w-fit">
                                        <Truck className="w-2.5 h-2.5" />
                                        ৳{p.deliveryCharge} Delivery
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4 border-b border-slate-50">
                                <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                                  {language === "en"
                                    ? p.category
                                    : p.categoryBn}
                                </span>
                              </td>
                              <td className="px-8 py-4 border-b border-slate-50 font-black text-slate-900 text-sm">
                                <div className="flex flex-col">
                                  {p.originalPrice &&
                                    p.originalPrice > p.price && (
                                      <span className="text-xs font-semibold text-slate-400 line-through">
                                        ৳{p.originalPrice}
                                      </span>
                                    )}
                                  <span>৳{p.price}</span>
                                </div>
                              </td>
                              <td className="px-8 py-4 border-b border-slate-50">
                                {isOutOfStock ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                                      Out of Stock
                                    </span>
                                  </div>
                                ) : isLowStock ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                                      Low Stock
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                      Available
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-8 py-4 border-b border-slate-50">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateStock(
                                        p.id,
                                        (p.stock || 0) - 1,
                                      )
                                    }
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-30 active:scale-95"
                                    disabled={isOutOfStock}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <div
                                    className={`w-12 text-center text-sm font-black tabular-nums ${isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-slate-900"}`}
                                  >
                                    {p.stock || 0}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateStock(
                                        p.id,
                                        (p.stock || 0) + 1,
                                      )
                                    }
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredProducts.length === 0 && (
                      <div className="p-20 text-center text-slate-400">
                        <p className="text-xs font-black uppercase tracking-widest">
                          No products found
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === "orders" ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 pb-20">
                  {/* Orders Control Toolbar */}
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                        {language === "en" ? "Store Order Management" : "স্টোর অর্ডার ম্যানেজমেন্ট"}
                      </h4>
                      <p className="text-xs text-slate-400 font-bold mt-1">
                        {language === "en"
                          ? `Manage order workflows, track dispatch, or sync & clear data to Google Sheets (${orders.length} orders)`
                          : `অর্ডার প্রসেস করুন বা এডমিন ডাটাবেজের চাপ কমাতে গুগল শিটে সিঙ্ক করে রিমুভ করুন (মোট ${orders.length} টি অর্ডার)`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {siteSettings.companyInfo?.googleSheetsLink ? (
                        <a
                          href={siteSettings.companyInfo.googleSheetsLink}
                          target="_blank"
                          rel="noreferrer"
                          id="instant-view-sheet-btn"
                          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95"
                          title={
                            language === "en"
                              ? "Open the configured Google Sheet in a new tab"
                              : "গুগল স্প্রেডশিটটি নতুন ট্যাবে ওপেন করুন"
                          }
                        >
                          <ExternalLink className="w-4 h-4 text-white" />
                          {language === "en" ? "View Google Sheet" : "গুগল শিট দেখুন"}
                        </a>
                      ) : (
                        <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 font-medium">
                          {language === "en" 
                            ? "Save Google Sheet link in settings to show button" 
                            : "গুগল শিট বাটনটি দেখতে সেটিংসে শিট লিংক সেভ করুন"}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowGoogleSheetsConfig(!showGoogleSheetsConfig)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border ${
                          showGoogleSheetsConfig
                            ? "bg-amber-100 border-amber-200 text-amber-800"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                        title={
                          language === "en"
                            ? "Configure Google Sheet integration settings"
                            : "গুগল শিট কানেকশন সেটআপ করুন"
                        }
                      >
                        <SettingsIcon className="w-4 h-4 text-amber-600 animate-spin-slow" />
                        {language === "en" ? "Configure Sheet" : "গুগল শিট সেটআপ"}
                      </button>

                      <button
                        type="button"
                        onClick={exportOrdersToCSV}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title={
                          language === "en"
                            ? "Export Orders list as Excel/CSV file"
                            : "অর্ডার ডাটা এক্সেল/CSV ফাইল ডাউনলোড করুন"
                        }
                      >
                        <Download className="w-4 h-4" />
                        {language === "en" ? "Export CSV" : "রিপোর্ট ডাউনলোড"}
                      </button>

                      <button
                        type="button"
                        onClick={handleSyncAllOrdersToSheets}
                        disabled={syncingAllOrders}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-900/10 hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                        title={
                          language === "en"
                            ? "Sync all orders to Google Sheet & clear from Admin to optimize speed"
                            : "সকল অর্ডার গুগল শিটে সিঙ্ক করুন এবং এডমিন প্যানেল থেকে মুছে দিন"
                        }
                      >
                        <Database className="w-4 h-4 text-amber-300" />
                        {syncingAllOrders
                          ? (language === "en" ? "Syncing..." : "সিঙ্ক হচ্ছে...")
                          : (language === "en" ? "Sync & Clear to Sheets" : "সিঙ্ক ও শিট থেকে ক্লিয়ার")}
                      </button>
                    </div>
                  </div>

                  {showGoogleSheetsConfig && (
                    <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-slate-900 uppercase tracking-tight text-xs">
                            {language === "en"
                              ? "Google Sheets Sync API & Webhook"
                              : "গুগল শিট সিঙ্ক এবং ওয়েব হুক সেটিংস"}
                          </h4>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1">
                            {language === "en"
                              ? "Sync store orders and customer details directly with Google Sheets"
                              : "গ্রাহকের প্রেরিত অর্ডার ও তথ্য স্বয়ংক্রিয়ভাবে গুগল শিটে সিঙ্ক করার সেটিংস"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGoogleSheetsConfig(false)}
                          className="text-xs font-black uppercase text-slate-400 hover:text-slate-600 px-3 py-1 bg-white border border-slate-150 rounded-lg cursor-pointer"
                        >
                          {language === "en" ? "Hide" : "লুকান"}
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const url = (
                            form.elements.namedItem(
                              "webhookUrl"
                            ) as HTMLInputElement
                          ).value;
                          const enabled = (
                            form.elements.namedItem(
                              "webhookEnabled"
                            ) as HTMLInputElement
                          ).checked;
                          const sheetsLink = (
                            form.elements.namedItem(
                              "googleSheetsLink"
                            ) as HTMLInputElement
                          ).value;
                          handleSaveWebhookSettings(url, enabled, sheetsLink);
                        }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                          <div className="space-y-2 md:col-span-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en"
                                ? "Google Sheets Apps Script Web URL / Webhook URL"
                                : "গুগল শিট অ্যাপস স্ক্রিপ্ট ওয়েব ইউআরএল"}
                            </label>
                            <input
                              name="webhookUrl"
                              type="url"
                              placeholder="https://script.google.com/macros/s/..."
                              defaultValue={
                                siteSettings.companyInfo?.googleSheetsWebhook ||
                                ""
                              }
                              className="w-full bg-white border border-slate-150 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="col-span-1 flex items-center justify-between border border-slate-150 bg-white rounded-2xl p-4 h-[52px]">
                            <span className="text-xs font-bold text-slate-500">
                              {language === "en" ? "Enabled" : "সচল"}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                name="webhookEnabled"
                                type="checkbox"
                                defaultChecked={
                                  !!siteSettings.companyInfo
                                    ?.googleSheetsWebhookEnabled
                                }
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {language === "en"
                              ? "Google Sheet Spreadsheet URL (For easy viewing from Admin)"
                              : "গুগল শিট স্প্রেডশিট লিংক (এডমিন থেকে সহজে দেখার জন্য)"}
                          </label>
                          <input
                            name="googleSheetsLink"
                            type="url"
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            defaultValue={
                              siteSettings.companyInfo?.googleSheetsLink ||
                              ""
                            }
                            className="w-full bg-white border border-slate-150 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <button
                            type="submit"
                            className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {language === "en"
                              ? "Save Webhook Configuration"
                              : "সেটিংস সংরক্ষণ করুন"}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              const form = e.currentTarget.form;
                              if (form) {
                                const url = (
                                  form.elements.namedItem(
                                    "webhookUrl",
                                  ) as HTMLInputElement
                                ).value;
                                handleTestWebhook(url);
                              }
                            }}
                            className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-102 active:scale-98 transition-all cursor-pointer"
                          >
                            {testingWebhook
                              ? (language === "en" ? "Testing..." : "টেস্ট করা হচ্ছে...")
                              : (language === "en" ? "Test Connection" : "সংযোগ পরীক্ষা করুন")}
                          </button>
                        </div>

                        {/* Integration Guides */}
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 space-y-4">
                          <h5 className="font-bold text-amber-900 text-xs flex items-center gap-2">
                            <SettingsIcon className="w-4 h-4 text-amber-600 animate-spin-slow" />
                            {language === "en" ? "Google Sheets Apps Script Guide" : "গুগল স্প্রেডশিট কানেক্ট করার সহজ গাইড"}
                          </h5>
                          <div className="text-[11px] text-amber-800 space-y-2 leading-relaxed">
                            <p>
                              {language === "en"
                                ? "1. Open your target Google Sheet. Create a sheet tab named 'Orders'."
                                : "১. প্রথমে আপনার গুগল শিটটি ওপেন করুন এবং 'Orders' নামে একটি নতুন ট্যাব/শিট তৈরি করুন।"}
                            </p>
                            <p>
                              {language === "en"
                                ? "2. In Google Sheets menu, click Extensions > Apps Script."
                                : "২. গুগল শিটের উপরের মেনুবার থেকে Extensions > Apps Script এ যান।"}
                            </p>
                            <p>
                              {language === "en"
                                ? "3. Copy the Apps Script template code from the setup guide and paste it into Apps Script."
                                : "৩. নিচে দেওয়া Apps Script কোডটি কপি করে সেখানে পেস্ট করুন এবং 'Save' আইকনে ক্লিক করে সংরক্ষণ করুন।"}
                            </p>
                            <p>
                              {language === "en"
                                ? "4. Click Deploy > New Deployment > Select Type: Web App. Set 'Who has access' to 'Anyone'. Deploy and copy the Web URL here!"
                                : "৪. এরপর Deploy > New Deployment এ ক্লিক করে Web App সিলেক্ট করুন। 'Who has access' অপশনটি 'Anyone' সিলেক্ট করে Deploy করুন এবং প্রাপ্ত Web App URL লিংকটি এনে উপরের বক্সে পেস্ট করে সেভ করুন।"}
                            </p>
                          </div>
                        </div>

                        {/* Collapsible Apps Script Code */}
                        <div className="border border-slate-200 bg-white rounded-2xl p-6 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700">
                              {language === "en" ? "Google Apps Script Code Template" : "গুগল অ্যাপস স্ক্রিপ্ট কোড টেমপ্লেট"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const code = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.event_type === 'order_placement') {
      var sheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Serial Number", "Order ID", "Order Date", "Order Time", 
          "Customer Name", "Phone", "Email", "Address", "City", "Area", 
          "Items Summary", "Total Quantity", "Total Amount", "Payment Method", "Transaction ID", "Status", "Synced At"
        ]);
        sheet.getRange(1, 1, 1, 17).setFontWeight("bold").setBackground("#FFF2CC");
      }
      sheet.appendRow([
        data.serial_number || "",
        data.order_id || "",
        data.order_date || "",
        data.order_time || "",
        data.customer_name || "",
        data.customer_phone || "",
        data.customer_email || "",
        data.customer_address || "",
        data.customer_city || "",
        data.customer_area || "",
        data.items_summary || "",
        data.total_quantity || 0,
        data.total_amount || 0,
        data.payment_method || "",
        data.transaction_id || "",
        data.status || "",
        new Date()
      ]);
    } else if (data.event_type === 'visit_log') {
      var sheet = ss.getSheetByName("Visits") || ss.insertSheet("Visits");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Visit ID", "IP Address", "Device Info", "Path", "Referrer", "Country", "City", "Visited At"]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#D9EAD3");
      }
      sheet.appendRow([
        data.id || "",
        data.ip || "",
        data.userAgent || "",
        data.path || "",
        data.referrer || "",
        data.country || "",
        data.city || "",
        data.visited_at || new Date()
      ]);
    } else {
      // Default: Customer accounts
      var sheet = ss.getSheetByName("Customers") || ss.insertSheet("Customers");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Name", "Email", "Phone", "Address", "City", "Area", "Bio", "Synced At"]);
        sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#D0E0E3");
      }
      sheet.appendRow([
        data.id || "",
        data.name || "",
        data.email || "",
        data.phone || "",
        data.address || "",
        data.city || "",
        data.area || "",
        data.bio || "",
        data.updated_at || new Date()
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "error": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
                                navigator.clipboard.writeText(code);
                                alert(language === "en" ? "Apps Script code copied to clipboard!" : "অ্যাপস স্ক্রিপ্ট কোড কপি করা হয়েছে!");
                              }}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest cursor-pointer shadow-sm transition-all"
                            >
                              {language === "en" ? "Copy Code" : "কোড কপি করুন"}
                            </button>
                          </div>
                          <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 whitespace-pre select-all leading-relaxed">
                            {`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.event_type === 'order_placement') {
      var sheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Serial Number", "Order ID", "Order Date", "Order Time", 
          "Customer Name", "Phone", "Email", "Address", "City", "Area", 
          "Items Summary", "Total Quantity", "Total Amount", "Payment Method", "Transaction ID", "Status", "Synced At"
        ]);
        sheet.getRange(1, 1, 1, 17).setFontWeight("bold").setBackground("#FFF2CC");
      }
      sheet.appendRow([
        data.serial_number || "",
        data.order_id || "",
        data.order_date || "",
        data.order_time || "",
        data.customer_name || "",
        data.customer_phone || "",
        data.customer_email || "",
        data.customer_address || "",
        data.customer_city || "",
        data.customer_area || "",
        data.items_summary || "",
        data.total_quantity || 0,
        data.total_amount || 0,
        data.payment_method || "",
        data.transaction_id || "",
        data.status || "",
        new Date()
      ]);
    } else if (data.event_type === 'visit_log') {
      var sheet = ss.getSheetByName("Visits") || ss.insertSheet("Visits");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Visit ID", "IP Address", "Device Info", "Path", "Referrer", "Country", "City", "Visited At"]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#D9EAD3");
      }
      sheet.appendRow([
        data.id || "",
        data.ip || "",
        data.userAgent || "",
        data.path || "",
        data.referrer || "",
        data.country || "",
        data.city || "",
        data.visited_at || new Date()
      ]);
    } else {
      // Default: Customer accounts
      var sheet = ss.getSheetByName("Customers") || ss.insertSheet("Customers");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Name", "Email", "Phone", "Address", "City", "Area", "Bio", "Synced At"]);
        sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#D0E0E3");
      }
      sheet.appendRow([
        data.id || "",
        data.name || "",
        data.email || "",
        data.phone || "",
        data.address || "",
        data.city || "",
        data.area || "",
        data.bio || "",
        data.updated_at || new Date()
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "error": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                          </pre>
                        </div>
                      </form>
                    </div>
                  )}

                  {ordersLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-300 gap-4">
                      <RefreshCw className="w-12 h-12 animate-spin opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        Synchronizing Orders...
                      </p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-300 gap-4">
                      <ShoppingBag className="w-12 h-12 opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        No orders received yet
                      </p>
                    </div>
                  ) : (
                    orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all"
                      >
                        {/* Order Header */}
                        <div className="px-10 py-6 bg-slate-50/50 flex flex-wrap items-center justify-between gap-6">
                          <div className="flex items-center gap-6">
                            <div
                              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                order.status === "pending"
                                  ? "bg-amber-50 text-amber-600 border-amber-100"
                                  : order.status === "delivered"
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    : order.status === "cancelled"
                                      ? "bg-red-50 text-red-600 border-red-100"
                                      : "bg-blue-50 text-blue-600 border-blue-100"
                              }`}
                            >
                              {order.status}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Order #
                              {order.id?.slice(-8).toUpperCase() || "..."}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {order.created_at
                                ? new Date(order.created_at).toLocaleString()
                                : "Just now"}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {order.status === "pending" && (
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() =>
                                    handleUpdateOrderStatus(
                                      order.id!,
                                      "confirmed",
                                    )
                                  }
                                  className="px-6 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateOrderStatus(
                                      order.id!,
                                      "cancelled",
                                    )
                                  }
                                  className="px-6 py-2 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-red-100 transition-all border border-red-100"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            )}
                            <select
                              value={order.status}
                              onChange={(e) =>
                                handleUpdateOrderStatus(
                                  order.id!,
                                  e.target.value as any,
                                )
                              }
                              className="bg-white border border-slate-100 rounded-full px-6 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-amber-500/10 transition-all cursor-pointer"
                            >
                              <option value="pending">Pending Review</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>

                        {/* Order Content */}
                        <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
                          {/* Customer Info */}
                          <div className="space-y-8">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                  Customer
                                </h5>
                                <p className="font-bold text-slate-900">
                                  {order.customer.firstName}{" "}
                                  {order.customer.lastName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                <PhoneIcon className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                  Contact
                                </h5>
                                <p className="font-bold text-slate-900">
                                  {order.customer.phone}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {order.customer.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                <CreditCard className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                  Payment
                                </h5>
                                <p className="font-bold text-slate-900 uppercase">
                                  {order.customer.paymentMethod}
                                </p>
                                {order.customer.transactionId && (
                                  <p className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md mt-1 break-all">
                                    ID: {order.customer.transactionId}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                  Shipping
                                </h5>
                                <p className="font-bold text-slate-900 leading-tight">
                                  {order.customer.address}
                                </p>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
                                  {order.customer.area}, {order.customer.city}
                                </p>
                              </div>
                            </div>
                            {(order.customer.deliveryDate || order.customer.deliveryTime) && (
                              <div className="flex items-start gap-4 border-t border-slate-100 pt-4">
                                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                                  <Calendar className="w-4 h-4 text-amber-600" />
                                </div>
                                <div>
                                  <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-0.5">
                                    Delivery Schedule
                                  </h5>
                                  <p className="font-bold text-slate-900">
                                    {order.customer.deliveryDate || 'Any Date'}
                                  </p>
                                  <p className="text-xs text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 inline" /> {order.customer.deliveryTime || 'Any Time'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Order Items */}
                          <div className="lg:col-span-2 space-y-6">
                            <div className="bg-slate-50 rounded-2xl p-6">
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
                                Order Items ({order.items.length})
                              </h5>
                              <div className="space-y-3">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                                        <img
                                          src={item.image}
                                          className="w-full h-full object-cover"
                                          alt=""
                                        />
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-900 text-sm">
                                          {language === "en"
                                            ? item.name
                                            : item.nameBn}
                                        </div>
                                        <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                          ৳{item.price} x {item.quantity}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-sm font-black text-slate-900 tabular-nums">
                                      ৳
                                      {(
                                        item.price * item.quantity
                                      ).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-6 pt-6 border-t border-slate-200/50 flex items-center justify-between px-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Total Payable
                                </span>
                                <span className="text-xl font-black text-slate-900">
                                  ৳{order.total.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {order.customer.note && (
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <h6 className="text-[8px] font-black uppercase tracking-widest text-amber-600 mb-1">
                                  Customer Message
                                </h6>
                                <p className="text-xs text-amber-900 font-medium italic">
                                  "{order.customer.note}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === "settings" ? (
                <form
                  onSubmit={handleSaveSettings}
                  className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-xl font-bold flex items-center gap-2">
                        <Layout className="w-5 h-5 text-amber-600" />
                        Identity & Branding
                      </h4>
                      <p className="text-sm text-slate-400">
                        Manage your website logo and identity.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Website Logo
                        </label>
                        <div className="flex items-center gap-6">
                          <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                            {siteSettings.logoUrl ? (
                              <img
                                src={siteSettings.logoUrl}
                                className="w-full h-full object-contain"
                                alt="Logo"
                              />
                            ) : (
                              <TrendingUp className="w-6 h-6 text-slate-200" />
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              disabled={uploading}
                            />
                            <button
                              type="button"
                              className="px-6 py-3 bg-slate-100 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 transition-all"
                            >
                              {uploading ? "Uploading..." : "Choose Logo"}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Logo Text Overlay
                        </label>
                        <input
                          value={siteSettings.heroTitle}
                          onChange={(e) =>
                            setSiteSettings({
                              ...siteSettings,
                              heroTitle: e.target.value,
                            })
                          }
                          placeholder="Fallback Text"
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-8">
                      <h4 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-amber-600" />
                        Hero Section Override
                      </h4>
                      <p className="text-sm text-slate-400">
                        Change the main title and description shown on the home
                        page.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Hero Title (EN)
                        </label>
                        <input
                          value={siteSettings.heroTitle}
                          onChange={(e) =>
                            setSiteSettings({
                              ...siteSettings,
                              heroTitle: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Hero Title (BN)
                        </label>
                        <input
                          value={siteSettings.heroTitleBn}
                          onChange={(e) =>
                            setSiteSettings({
                              ...siteSettings,
                              heroTitleBn: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Hero Description (EN)
                        </label>
                        <textarea
                          rows={3}
                          value={siteSettings.heroDesc}
                          onChange={(e) =>
                            setSiteSettings({
                              ...siteSettings,
                              heroDesc: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Hero Description (BN)
                        </label>
                        <textarea
                          rows={3}
                          value={siteSettings.heroDescBn}
                          onChange={(e) =>
                            setSiteSettings({
                              ...siteSettings,
                              heroDescBn: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Homepage Slideshow Section */}
                    <div className="space-y-6 pt-8 border-t border-slate-100 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold flex items-center gap-2 font-black uppercase tracking-tight">
                          <Layout className="w-5 h-5 text-amber-600" />
                          Homepage Slideshow & Banners (লাইভ স্লাইডার ফটো)
                        </h4>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                          Add, edit or remove the live sliding banner images
                          shown on the home page.
                        </p>
                      </div>

                      {/* Active Custom Banners */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                          Existing Custom Slides (
                          {siteSettings.companyInfo?.sliders?.length || 0})
                        </label>

                        {!siteSettings.companyInfo?.sliders ||
                        siteSettings.companyInfo.sliders.length === 0 ? (
                          <div className="bg-amber-50/50 rounded-2xl p-6 border border-dashed border-amber-200 text-center space-y-2">
                            <p className="text-sm font-bold text-amber-800">
                              No custom slide banners configured!
                            </p>
                            <p className="text-xs text-amber-600 font-medium">
                              The home page is currently displaying the default
                              featured products (Products with "New/isNew" tag)
                              as slider images. Add custom slide banners below
                              to replace them.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {siteSettings.companyInfo.sliders.map((sld) => {
                              const matchedProduct = products.find(
                                (p) => p.id === sld.linkProductId,
                              );
                              return (
                                <div
                                  key={sld.id}
                                  className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex gap-4 items-start relative group"
                                >
                                  <div className="w-24 h-20 rounded-xl bg-white overflow-hidden flex-shrink-0 border border-slate-200 animate-in fade-in zoom-in-95 duration-300">
                                    <img
                                      src={sld.image}
                                      className="w-full h-full object-cover"
                                      alt={sld.titleEn}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-900 truncate">
                                      {sld.titleEn}
                                    </p>
                                    <p className="text-[10px] font-bold text-amber-600 truncate">
                                      {sld.titleBn}
                                    </p>
                                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                                      {sld.subtitleEn || "No En subtitle"}
                                    </p>

                                    {matchedProduct && (
                                      <span className="inline-block mt-2 px-2 py-1 bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500 rounded-full">
                                        Linked:{" "}
                                        {language === "en"
                                          ? matchedProduct.name
                                          : matchedProduct.nameBn}
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSlider(sld.id)}
                                    className="absolute top-2 right-2 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all font-bold"
                                    title="Remove Slide"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Add New Custom Banner Form */}
                      <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100 space-y-6">
                        <div className="space-y-1">
                          <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight font-bold">
                            Add New Banner Slide
                          </h5>
                          <p className="text-xs text-slate-400 font-medium font-bold">
                            Configure layout and photo for a new fullscreen
                            slider image.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Image Upload */}
                          <div className="space-y-2 col-span-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              Banner Photo/Image
                            </label>
                            <div className="flex items-center gap-6">
                              <div className="w-40 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                                {newSlider.image ? (
                                  <img
                                    src={newSlider.image}
                                    className="w-full h-full object-cover"
                                    alt="Slider Preview"
                                  />
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400">
                                    No Image Selected
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleSliderImageUpload}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  disabled={sliderUploading}
                                />
                                <button
                                  type="button"
                                  className="px-6 py-3 bg-white border border-slate-300 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-100 transition-all shadow-sm font-bold"
                                >
                                  {sliderUploading
                                    ? "Uploading..."
                                    : language === "en"
                                      ? "Choose Image File"
                                      : "নিজের ছবি আপলোড করুন"}
                                </button>
                              </div>
                              <div className="flex-1 w-full min-w-[200px]">
                                <input
                                  type="text"
                                  placeholder={
                                    language === "en"
                                      ? "Or paste custom image URL..."
                                      : "অথবা নিজের ছবির লিংক (URL) পেস্ট করুন..."
                                  }
                                  value={newSlider.image}
                                  onChange={(e) =>
                                    setNewSlider((prev) => ({
                                      ...prev,
                                      image: e.target.value,
                                    }))
                                  }
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10 placeholder:text-slate-400 text-slate-800"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Slider Title */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              Banner Title (EN)
                            </label>
                            <input
                              type="text"
                              value={newSlider.titleEn}
                              onChange={(e) =>
                                setNewSlider({
                                  ...newSlider,
                                  titleEn: e.target.value,
                                })
                              }
                              placeholder="e.g. Fresh Mango Fest"
                              className="w-full bg-slate-150 border border-slate-200 rounded-2xl px-6 py-4 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-500/10"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              Banner Title (BN)
                            </label>
                            <input
                              type="text"
                              value={newSlider.titleBn}
                              onChange={(e) =>
                                setNewSlider({
                                  ...newSlider,
                                  titleBn: e.target.value,
                                })
                              }
                              placeholder="যেমন: ফ্রেশ আমের উৎসব"
                              className="w-full bg-slate-150 border border-slate-200 rounded-2xl px-6 py-4 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-500/10"
                            />
                          </div>

                          {/* Slider Subtitle */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              Banner Subtitle / Offer Details (EN)
                            </label>
                            <input
                              type="text"
                              value={newSlider.subtitleEn}
                              onChange={(e) =>
                                setNewSlider({
                                  ...newSlider,
                                  subtitleEn: e.target.value,
                                })
                              }
                              placeholder="e.g. Up to 40% OFF on all fresh premium mangoes"
                              className="w-full bg-slate-150 border border-slate-205 rounded-2xl px-6 py-4 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-500/10"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              Banner Subtitle / Offer Details (BN)
                            </label>
                            <input
                              type="text"
                              value={newSlider.subtitleBn}
                              onChange={(e) =>
                                setNewSlider({
                                  ...newSlider,
                                  subtitleBn: e.target.value,
                                })
                              }
                              placeholder="যেমন: প্রিমিয়াম জাতের আমে ৪০% পর্যন্ত ছাড়"
                              className="w-full bg-slate-150 border border-slate-205 rounded-2xl px-6 py-4 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-500/10"
                            />
                          </div>

                          {/* Link to Products Dropdown */}
                          <div className="space-y-2 col-span-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              Linked Product (সরাসরি পপআপ খোলার লিংক)
                            </label>
                            <select
                              value={newSlider.linkProductId}
                              onChange={(e) =>
                                setNewSlider({
                                  ...newSlider,
                                  linkProductId: e.target.value,
                                })
                              }
                              className="w-full bg-slate-150 border border-slate-200 rounded-2xl px-6 py-4 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-500/10 appearance-none cursor-pointer"
                            >
                              <option value="">
                                -- No Product Linked / বাটন দরকার নেই --
                              </option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.category} ›{" "}
                                  {language === "en" ? p.name : p.nameBn} (৳
                                  {p.price})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddSlider}
                          className="px-8 py-3 bg-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 font-bold"
                        >
                          <Plus className="w-4 h-4" /> Add This Banner Image
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Charge Settings Section */}
                  <div className="space-y-6 pt-8 border-t border-slate-100 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <h4 className="text-xl font-bold flex items-center gap-2 font-black uppercase tracking-tight">
                        <Truck className="w-5 h-5 text-amber-600" />
                        {language === "en" ? "Delivery Charge Settings" : "ডেলিভারি চার্জ নিয়ন্ত্রণ"}
                      </h4>
                      <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                        {language === "en" 
                          ? "Configure inside/outside Dhaka charges and free delivery threshold." 
                          : "ঢাকার ভিতরে/বাইরে ডেলিভারি চার্জ এবং ফ্রি ডেলিভারি সীমা নির্ধারণ করুন।"}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 space-y-6">
                      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="space-y-1 font-sans">
                          <label className="text-sm font-bold text-slate-800 block">
                            {language === "en" ? "Enable Custom Delivery Charges" : "কাস্টম ডেলিভারি চার্জ সক্রিয় করুন"}
                          </label>
                          <span className="text-xs text-slate-450 block">
                            {language === "en" 
                              ? "If disabled, delivery is free for all orders." 
                              : "বন্ধ থাকলে সকল অর্ডারের জন্য ডেলিভারি চার্জ ফ্রি থাকবে।"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSiteSettings({
                            ...siteSettings,
                            companyInfo: {
                              ...siteSettings.companyInfo,
                              deliveryChargeEnabled: !siteSettings.companyInfo?.deliveryChargeEnabled
                            }
                          })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            siteSettings.companyInfo?.deliveryChargeEnabled ? "bg-amber-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              siteSettings.companyInfo?.deliveryChargeEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {siteSettings.companyInfo?.deliveryChargeEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
                          <div className="space-y-2 font-sans">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              {language === "en" ? "Inside Dhaka (৳)" : "ঢাকার ভিতরে চার্জ (৳)"}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={siteSettings.companyInfo?.deliveryChargeInside !== undefined ? siteSettings.companyInfo.deliveryChargeInside : 60}
                              onChange={(e) => setSiteSettings({
                                ...siteSettings,
                                companyInfo: {
                                  ...siteSettings.companyInfo,
                                  deliveryChargeInside: Number(e.target.value)
                                }
                              })}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                            />
                          </div>

                          <div className="space-y-2 font-sans">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              {language === "en" ? "Outside Dhaka (৳)" : "ঢাকার বাইরে চার্জ (৳)"}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={siteSettings.companyInfo?.deliveryChargeOutside !== undefined ? siteSettings.companyInfo.deliveryChargeOutside : 120}
                              onChange={(e) => setSiteSettings({
                                ...siteSettings,
                                companyInfo: {
                                  ...siteSettings.companyInfo,
                                  deliveryChargeOutside: Number(e.target.value)
                                }
                              })}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                            />
                          </div>

                          <div className="space-y-2 font-sans">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                              {language === "en" ? "Free Delivery Threshold (৳)" : "ফ্রি ডেলিভারি সীমা (৳)"}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={siteSettings.companyInfo?.deliveryFreeThreshold !== undefined ? siteSettings.companyInfo.deliveryFreeThreshold : 1000}
                              onChange={(e) => setSiteSettings({
                                ...siteSettings,
                                companyInfo: {
                                  ...siteSettings.companyInfo,
                                  deliveryFreeThreshold: Number(e.target.value)
                                }
                              })}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                  >
                    <Save className="w-5 h-5" />
                    Save Configuration
                  </button>
                </form>
              ) : activeTab === "categories" ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                  {/* Create New Category Card / ক্যাটাগরি কনফিগারেশন */}
                  <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight mb-2">
                      {editingCategoryName
                        ? language === "en"
                          ? `Edit Category: "${editingCategoryName}"`
                          : `ক্যাটাগরি সম্পাদনা: "${editingCategoryName}"`
                        : language === "en"
                          ? "Create New Category"
                          : "নতুন ক্যাটাগরি তৈরি করুন"}
                    </h4>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-black mb-6">
                      {language === "en"
                        ? "Categories appear in the main menu catalog of your homepage"
                        : "ক্যাটাগরি সমূহ হোমপেজের মেনু ক্যাটালগে প্রদর্শিত হবে"}
                    </p>

                    <form onSubmit={handleAddCategory} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {language === "en"
                              ? "Category Name (English)"
                              : "ক্যাটাগরি নাম (English)"}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g., Burgers"
                            value={newCategory.en}
                            onChange={(e) =>
                              setNewCategory((prev) => ({
                                ...prev,
                                en: e.target.value,
                              }))
                            }
                            className="w-full bg-white border border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {language === "en"
                              ? "Category Name (Bangla)"
                              : "ক্যাটাগরি নাম (বাংলা)"}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="যেমন, বার্গার"
                            value={newCategory.bn}
                            onChange={(e) =>
                              setNewCategory((prev) => ({
                                ...prev,
                                bn: e.target.value,
                              }))
                            }
                            className="w-full bg-white border border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold outline-none"
                          />
                        </div>
                      </div>

                      {/* Image Upload Row */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-bold">
                          {language === "en"
                            ? "Category Image/Photo"
                            : "ক্যাটাগরি ফটো/ইমেজ"}
                        </label>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="w-32 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                            {newCategory.image ? (
                              <img
                                src={newCategory.image}
                                className="w-full h-full object-cover"
                                alt="Category Preview"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">
                                No Image
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleCategoryImageUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              disabled={categoryImageUploading}
                            />
                            <button
                              type="button"
                              className="px-6 py-3 bg-white border border-slate-300 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-100 transition-all shadow-sm font-bold"
                            >
                              {categoryImageUploading
                                ? "Uploading..."
                                : "Choose Category Image"}
                            </button>
                          </div>

                          <div className="flex-1 w-full sm:w-auto">
                            <input
                              type="text"
                              placeholder={
                                language === "en"
                                  ? "Or paste image URL..."
                                  : "অথবা ইমেজ লিঙ্ক পেস্ট করুন..."
                              }
                              value={newCategory.image}
                              onChange={(e) =>
                                setNewCategory((prev) => ({
                                  ...prev,
                                  image: e.target.value,
                                }))
                              }
                              className="w-full bg-white border border-slate-100 rounded-2xl px-6 py-3 text-xs font-bold outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="submit"
                          className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-900/10 hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-[52px]"
                        >
                          {editingCategoryName ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          {editingCategoryName
                            ? language === "en"
                              ? "Update Category"
                              : "ক্যাটাগরি আপডেট করুন"
                            : language === "en"
                              ? "Add Category"
                              : "ক্যাটাগরি যোগ করুন"}
                        </button>

                        {editingCategoryName && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryName(null);
                              setNewCategory({ en: "", bn: "", image: "" });
                            }}
                            className="px-8 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-[52px]"
                          >
                            <X className="w-4 h-4" />
                            {language === "en" ? "Cancel" : "বাতিল করুন"}
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Active Categories Grid */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight">
                          {language === "en"
                            ? "Configured Categories"
                            : "সক্রিয় ক্যাটাগরি তালিকা"}
                        </h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1">
                          {language === "en"
                            ? "Active catalog structures of your store"
                            : "আপনার স্টোরের সচল ক্যাটাগরি কনফিগারেশন"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(siteSettings.companyInfo?.categories &&
                      siteSettings.companyInfo.categories.length > 0
                        ? siteSettings.companyInfo.categories
                        : CATEGORIES.filter((c) => c.en !== "All")
                      ).map((cat) => {
                        const count = products.filter(
                          (p) => p.category === cat.en,
                        ).length;
                        return (
                          <div
                            key={cat.en}
                            className="group relative bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-4 flex gap-4 items-center justify-between"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 cursor-default">
                                <img
                                  src={
                                    cat.image ||
                                    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop"
                                  }
                                  className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-all duration-300"
                                  alt={cat.en}
                                />
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-extrabold text-slate-800 text-sm truncate uppercase tracking-tight">
                                  {cat.en}
                                </h5>
                                <p className="text-xs text-slate-400 font-bold truncate">
                                  {cat.bn}
                                </p>
                                <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 text-amber-700 text-[10px] font-bold rounded-full mt-1.5 border border-amber-500/20">
                                  {count}{" "}
                                  {language === "en" ? "Products" : "টি পণ্য"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryName(cat.en);
                                  setNewCategory({
                                    en: cat.en,
                                    bn: cat.bn,
                                    image: cat.image || "",
                                  });
                                  // Find current category container or scroll window upwards slightly
                                  const element =
                                    document.querySelector(".bg-slate-50");
                                  if (element) {
                                    element.scrollIntoView({
                                      behavior: "smooth",
                                      block: "center",
                                    });
                                  } else {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }
                                }}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all border border-slate-200 outline-none"
                                title="Edit Category"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.en)}
                                className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-all rounded-xl border border-rose-100 outline-none"
                                title="Delete Category"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : activeTab === "admins" ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                  {/* Add Admin Card */}
                  <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight mb-2">
                      {language === "en"
                        ? "Register New Admin"
                        : "নতুন এডমিন নিবন্ধন করুন"}
                    </h4>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-black mb-6">
                      {language === "en"
                        ? "Add user by email (UID is optional; if left blank, other admins can log in and their account gets mapped automatically)"
                        : "ইমেলের মাধ্যমে নতুন এডমিন যোগ করুন (UID ঐচ্ছিক; খালি রাখলে তারা পরবর্তীতে লগইন করার সময় অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে ম্যাপ হবে)"}
                    </p>

                    <form
                      onSubmit={handleAddAdmin}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {language === "en"
                              ? "Target User Email"
                              : "টার্গেট ইউজার ইমেল"}
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="e.g., admin@example.com"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            className="w-full bg-white border border-slate-200/60 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="w-full md:w-auto px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-900/10 hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-[52px]"
                          >
                            <Plus className="w-4 h-4" />
                            {language === "en" ? "Add Admin" : "এডমিন যোগ করুন"}
                          </button>
                        </div>
                      </div>

                      {/* Advanced UID Toggle */}
                      <div className="flex justify-start">
                        <button
                          type="button"
                          onClick={() => setShowUidField(!showUidField)}
                          className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer outline-none"
                        >
                          {showUidField ? "[-] Hide UID Option" : "[+] Show UID Option (Advanced)"}
                        </button>
                      </div>

                      {showUidField && (
                        <div className="space-y-2 bg-slate-100/40 p-5 rounded-2xl border border-slate-200/40 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {language === "en"
                              ? "Target User ID (UID) - Advanced Option"
                              : "টার্গেট ইউজার আইডি (UID) - অ্যাডভান্সড অপশন"}
                          </label>
                          <input
                            type="text"
                            placeholder={language === "en" ? "Optional (Leave blank to generate automatically)" : "ঐচ্ছিক (অটো-মেপে নিতে চাইলে খালি রাখুন)"}
                            value={newAdminId}
                            onChange={(e) => setNewAdminId(e.target.value)}
                            className="bg-white border border-slate-200/60 rounded-xl px-4 py-3 text-xs font-bold outline-none w-full"
                          />
                        </div>
                      )}

                      {/* Permissions Checklist */}
                      <div className="space-y-4 pt-6 border-t border-slate-100">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                            {language === "en"
                              ? "Select Admin Permissions"
                              : "এডমিনের পারমিশন বা অ্যাক্সেস লেভেল সিলেক্ট করুন"}
                          </label>
                          <p className="text-[11px] text-slate-400">
                            {language === "en"
                              ? "Choose the panels this administrator is authorized to access and manage."
                              : "এই নতুন এডমিনকে ওয়েবসাইটের কোন কোন সেকশনের দায়িত্ব দেওয়া হবে তা নির্ধারণ করুন।"}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { id: "products", labelEn: "Catalog & Inventory", labelBn: "ক্যাটালগ ও ইনভেন্টরি", descEn: "Access product lists, category manager, and stock level controls", descBn: "প্রোডাক্ট ক্যাটালগ, ক্যাটাগরি এবং ইনভেন্টরি স্টক নিয়ন্ত্রণ" },
                            { id: "orders", labelEn: "Orders & Analytics", labelBn: "অর্ডার ও অ্যানালিটিক্স", descEn: "View and update orders, print records, analyze sale charts", descBn: "অর্ডার প্রসেস করা, মানি কুপন ও বিক্রয় রিপোর্ট ডাটা দেখা" },
                            { id: "customers", labelEn: "Customers & Sheets", labelBn: "গ্রাহক ও শিট সিঙ্ক", descEn: "View customer profiles and manage Google Sheets sync settings", descBn: "কাস্টমার অ্যাকাউন্ট প্রোফাইল ও গুগল শিট রিয়েলটাইম সিঙ্ক" },
                            { id: "settings", labelEn: "Site Settings", labelBn: "সাইট সেটিংস", descEn: "Manage slogans, banners, webhook details & configurations", descBn: "ওয়েবসাইটের ব্যানার ছবি, লোগো, স্লোগান ও সেটিংস আপডেট" }
                          ].map((perm) => {
                            const isChecked = selectedPermissions.includes(perm.id);
                            return (
                              <label
                                key={perm.id}
                                className={`flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${isChecked ? "bg-amber-50/40 border-amber-300" : "bg-white border-slate-200/60 hover:bg-slate-50"}`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedPermissions(prev => prev.filter(p => p !== perm.id));
                                      } else {
                                        setSelectedPermissions(prev => [...prev, perm.id]);
                                      }
                                    }}
                                    className="accent-amber-600 w-4 h-4 rounded cursor-pointer"
                                  />
                                  <span className="font-black text-slate-800 text-xs">
                                    {language === "en" ? perm.labelEn : perm.labelBn}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-2 font-medium leading-relaxed">
                                  {language === "en" ? perm.descEn : perm.descBn}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Admin list */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                      <h4 className="font-black text-slate-900 uppercase tracking-tight">
                        {language === "en"
                          ? "Configured Administrators"
                          : "নিবন্ধিত এডমিন তালিকা"}
                      </h4>
                      <button
                        type="button"
                        onClick={fetchAdmins}
                        disabled={adminsLoading}
                        className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${adminsLoading ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>

                    {adminsLoading ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        {language === "en"
                          ? "Loading administrators..."
                          : "এডমিন তালিকা লোড হচ্ছে..."}
                      </div>
                    ) : admins.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        {language === "en"
                          ? "No administrators registered"
                          : "কোন এডমিন নিবন্ধিত নেই"}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {admins.map((adm) => (
                          <div
                            key={adm.id}
                            className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="font-black text-slate-800 text-sm truncate">
                                  {adm.email}
                                </h5>
                                {adm.email?.toLowerCase().trim() ===
                                  "careers.growthexpress@gmail.com" && (
                                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black uppercase tracking-wider rounded-full">
                                    {language === "en"
                                      ? "Super Admin"
                                      : "সুপার এডমিন"}
                                  </span>
                                )}
                              </div>

                              {/* Display Granted Permissions Badges */}
                              <div className="flex flex-wrap gap-1.5 py-0.5">
                                {getPermissionsForAdminRecord(adm).map((perm, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100/60 text-[9px] font-black uppercase tracking-wide rounded"
                                  >
                                    {perm}
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                <Fingerprint className="w-3" />
                                <span className="truncate">UID: {adm.id}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(adm.id);
                                    setStatusMessage({
                                      text:
                                        language === "en"
                                          ? "UID copied!"
                                          : "UID কপি হয়েছে!",
                                      type: "success",
                                    });
                                  }}
                                  title={
                                    language === "en"
                                      ? "Copy ID"
                                      : "আইডি কপি করুন"
                                  }
                                  className="text-slate-300 hover:text-slate-500 hover:underline cursor-pointer"
                                >
                                  [Copy]
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                              <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  {language === "en"
                                    ? "Date Added"
                                    : "যুক্ত হওয়ার তারিখ"}
                                </p>
                                <p className="text-xs font-bold text-slate-600">
                                  {new Date(
                                    adm.created_at || "",
                                  ).toLocaleDateString(
                                    language === "bn" ? "bn-BD" : "en-US",
                                  )}
                                </p>
                              </div>

                              {adm.email ===
                              "careers.growthexpress@gmail.com" ? (
                                <div
                                  className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300"
                                  title={
                                    language === "en"
                                      ? "Primary Owner"
                                      : "মূল মালিক"
                                  }
                                >
                                  <Shield className="w-4 h-4 text-amber-500" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteAdmin(adm.id, adm.email)
                                  }
                                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-all flex items-center justify-center shadow-sm border border-rose-100 hover:scale-105 active:scale-95 cursor-pointer"
                                  title={
                                    language === "en"
                                      ? "Remove Access"
                                      : "অ্যাক্সেস বাতিল করুন"
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === "customers" ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                  {/* Google Sheets Webhook and Sync Configuration */}
                  <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight mb-2">
                      {language === "en"
                        ? "Google Sheets Sync API & Webhook"
                        : "গুগল শিট সিঙ্ক এবং ওয়েব হুক সেটিংস"}
                    </h4>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-black mb-6">
                      {language === "en"
                        ? "Sync your registered customers automatically with Google Sheets"
                        : "নিবন্ধনকৃত কাস্টমারদের তথ্য স্বয়ংক্রিয়ভাবে গুগল শিট বা স্প্রেডশিটে আপডেট করুন"}
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const url = (
                          form.elements.namedItem(
                            "webhookUrl",
                          ) as HTMLInputElement
                        ).value;
                        const enabled = (
                          form.elements.namedItem(
                            "webhookEnabled",
                          ) as HTMLInputElement
                        ).checked;
                        const sheetsLink = (
                          form.elements.namedItem(
                            "googleSheetsLink",
                          ) as HTMLInputElement
                        ).value;
                        handleSaveWebhookSettings(url, enabled, sheetsLink);
                      }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div className="space-y-2 md:col-span-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {language === "en"
                              ? "Google Sheets Apps Script Web URL / Webhook URL"
                              : "গুগল শিট অ্যাপস স্ক্রিপ্ট ওয়েব ইউআরএল"}
                          </label>
                          <input
                            name="webhookUrl"
                            type="url"
                            placeholder="https://script.google.com/macros/s/..."
                            defaultValue={
                              siteSettings.companyInfo?.googleSheetsWebhook ||
                              ""
                            }
                            className="w-full bg-white border border-slate-150 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="col-span-1 flex items-center justify-between border border-slate-150 bg-white rounded-2xl p-4 h-[52px]">
                          <span className="text-xs font-bold text-slate-500">
                            {language === "en" ? "Enabled" : "সচল"}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              name="webhookEnabled"
                              type="checkbox"
                              defaultChecked={
                                !!siteSettings.companyInfo
                                  ?.googleSheetsWebhookEnabled
                              }
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {language === "en"
                            ? "Google Sheet Spreadsheet URL (For easy viewing from Admin)"
                            : "গুগল শিট স্প্রেডশিট লিংক (এডমিন থেকে সহজে দেখার জন্য)"}
                        </label>
                        <input
                          name="googleSheetsLink"
                          type="url"
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          defaultValue={
                            siteSettings.companyInfo?.googleSheetsLink ||
                            ""
                          }
                          className="w-full bg-white border border-slate-150 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="submit"
                          className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {language === "en"
                            ? "Save Webhook Configuration"
                            : "সেটিংস সংরক্ষণ করুন"}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            const form = e.currentTarget.form;
                            if (form) {
                              const url = (
                                form.elements.namedItem(
                                  "webhookUrl",
                                ) as HTMLInputElement
                              ).value;
                              handleTestWebhook(url);
                            }
                          }}
                          className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-102 active:scale-98 transition-all cursor-pointer"
                        >
                          {testingWebhook
                            ? "..."
                            : language === "en"
                              ? "Test Send Webhook"
                              : "টেস্ট ডাটা পাঠান"}
                        </button>
                      </div>
                    </form>

                    {/* Interactive Apps Script Setup instructions guide */}
                    <div className="mt-8 bg-amber-50/50 border border-amber-100 rounded-2xl p-6">
                      <h5 className="font-black text-amber-900 text-xs uppercase tracking-wider mb-2">
                        💡{" "}
                        {language === "en"
                          ? "How to connect YummyDash to your Google Sheet:"
                          : "কিভাবে ইয়াম্মিড্যাশ কাস্টমার ডাটা গুগল শিটে যুক্ত করবেন:"}
                      </h5>
                      <ol className="list-decimal list-inside text-xs space-y-2 text-slate-600 font-medium">
                        <li>
                          {language === "en"
                            ? "Create a new Google Sheet."
                            : "একটি নতুন গুগল শিট তৈরি করুন।"}
                        </li>
                        <li>
                          {language === "en"
                            ? "Click Extensions > Apps Script in your Google Sheet menu."
                            : 'আপনার গুগল শিট মেনু থেকে "Extensions > Apps Script" এ ক্লিক করুন।'}
                        </li>
                        <li>
                          {language === "en"
                            ? "Clear any code inside Editor, and paste the code below:"
                            : "এডিটর এর ভেতরের কোড মুছে নিচের কোডটি পেস্ট করুন:"}
                        </li>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre my-2 select-all leading-relaxed">
                          {`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.event_type === 'order_placement') {
      var sheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Serial Number", "Order ID", "Order Date", "Order Time", 
          "Customer Name", "Phone", "Email", "Address", "City", "Area", 
          "Items Summary", "Total Quantity", "Total Amount", "Payment Method", "Transaction ID", "Status", "Synced At"
        ]);
        sheet.getRange(1, 1, 1, 17).setFontWeight("bold").setBackground("#FFF2CC");
      }
      sheet.appendRow([
        data.serial_number || "",
        data.order_id || "",
        data.order_date || "",
        data.order_time || "",
        data.customer_name || "",
        data.customer_phone || "",
        data.customer_email || "",
        data.customer_address || "",
        data.customer_city || "",
        data.customer_area || "",
        data.items_summary || "",
        data.total_quantity || 0,
        data.total_amount || 0,
        data.payment_method || "",
        data.transaction_id || "",
        data.status || "",
        new Date()
      ]);
    } else if (data.event_type === 'visit_log') {
      var sheet = ss.getSheetByName("Visits") || ss.insertSheet("Visits");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Visit ID", "IP Address", "Device Info", "Path", "Referrer", "Country", "City", "Visited At"]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#D9EAD3");
      }
      sheet.appendRow([
        data.id || "",
        data.ip || "",
        data.userAgent || "",
        data.path || "",
        data.referrer || "",
        data.country || "",
        data.city || "",
        data.visited_at || new Date()
      ]);
    } else {
      // Default: Customer accounts
      var sheet = ss.getSheetByName("Customers") || ss.insertSheet("Customers");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Name", "Email", "Phone", "Address", "City", "Area", "Bio", "Synced At"]);
        sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#D0E0E3");
      }
      sheet.appendRow([
        data.id || "",
        data.name || "",
        data.email || "",
        data.phone || "",
        data.address || "",
        data.city || "",
        data.area || "",
        data.bio || "",
        data.updated_at || new Date()
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "error": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                        </pre>
                        <li>
                          {language === "en"
                            ? 'Click Deploy > New Deployment. Select "Web app". Set "Execute as: Me", and "Who has access: Anyone".'
                            : "Deploy > New Deployment এ ক্লিক করুন। Web app সিলেট করুন। Execute as: Me এবং Who has access: Anyone সিলেক্ট করুন।"}
                        </li>
                        <li>
                          {language === "en"
                            ? "Deploy, authorize access permissions, copy the Web app URL, and paste it into the Webhook URL field above!"
                            : "Deploy সম্পূর্ণ করে Authorization Permissions অ্যালাউ করুন, এবং প্রাপ্ত Web App URL-টি কপি করে উপরের ফীল্ডে পেস্ট করুন!"}
                        </li>
                      </ol>
                    </div>
                  </div>

                  {/* Customer Account Management Quick Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add Customer Account Widget */}
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                            {language === "en"
                              ? "Create New Customer"
                              : "নতুন কাস্টমার একাউন্ট তৈরি"}
                          </h4>
                          <span className="px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-100 text-[9px] font-black uppercase tracking-wide rounded-full">
                            {language === "en" ? "Active" : "সক্রিয়"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-6 leading-relaxed">
                          {language === "en"
                            ? "Easily register a new customer profile with name, phone, and delivery address details."
                            : "কাস্টমারের নাম, মোবাইল নম্বর এবং অর্ডারের ডেলিভারি লোকেশন দিয়ে দ্রুত কাস্টমার একাউন্ট তৈরি করুন।"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-4 h-4 text-slate-500" />
                        {showCreateForm 
                          ? (language === "en" ? "Hide Access Form" : "ফর্মটি লুকান")
                          : (language === "en" ? "Open Account Creation Form" : "অ্যাকাউন্ট তৈরি ফরম খুলুন")
                        }
                      </button>
                    </div>

                    {/* Impersonation Lookup Widget */}
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                            {language === "en"
                              ? "Instant Impersonation"
                              : "কাস্টমার একাউন্টের ভেতরে প্রবেশ (ইন-পারসোনেট)"}
                          </h4>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black uppercase tracking-wide rounded-full">
                            {language === "en" ? "Secure" : "নিরাপদ"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-6 leading-relaxed">
                          {language === "en"
                            ? "Enter any registered customer's mobile number or email address to instantly log in as them."
                            : "নিবন্ধিত কাস্টমারের মোবাইল নাম্বার বা জিমেইল টাইপ করে সহজেই তাদের অ্যাকাউন্টে প্রবেশ করে অর্ডার এবং প্রোফাইল দেখতে পারবেন।"}
                        </p>
                      </div>

                      <form onSubmit={handleQuickImpersonate} className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <User className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            required
                            placeholder={
                              language === "en"
                                ? "Phone or email..."
                                : "মোবাইল নম্বর বা জিমেইল..."
                            }
                            value={quickImpersonateVal}
                            onChange={(e) => setQuickImpersonateVal(e.target.value)}
                            className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200/60 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold outline-none transition-colors"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-900/5 transition-all text-center whitespace-nowrap cursor-pointer h-[38px]"
                        >
                          {language === "en" ? "Impersonate" : "প্রবেশ করুন"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Create Customer Account Form Card */}
                  {showCreateForm && (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                          {language === "en"
                            ? "Fill New Customer Account Credentials"
                            : "নতুন কাস্টমারের অ্যাকাউন্ট রেজিস্টার করুন"}
                        </h4>
                        <button
                          onClick={() => setShowCreateForm(false)}
                          className="p-1 hover:bg-slate-100 rounded-full transition-colors font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleCreateCustomer} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "Full Name *" : "সম্পূর্ণ নাম *"}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Robin Khan"
                              value={newCustName}
                              onChange={(e) => setNewCustName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "Phone Number *" : "মোবাইল নম্বর *"}
                            </label>
                            <input
                              type="tel"
                              required
                              placeholder="e.g. 01712345678"
                              value={newCustPhone}
                              onChange={(e) => setNewCustPhone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "Email Address (Optional)" : "ইমেল এড্রেস (ঐচ্ছিক)"}
                            </label>
                            <input
                              type="email"
                              placeholder="e.g. customer@gmail.com"
                              value={newCustEmail}
                              onChange={(e) => setNewCustEmail(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "Target Login Password" : "লগইন পাসওয়ার্ড (ঐচ্ছিক)"}
                            </label>
                            <input
                              type="text"
                              placeholder="Default is 123456"
                              value={newCustPassword}
                              onChange={(e) => setNewCustPassword(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "City" : "শহর"}
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Dhaka"
                              value={newCustCity}
                              onChange={(e) => setNewCustCity(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "Area (Sub-area/Police station)" : "থানা বা এরিয়া"}
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Dhanmondi"
                              value={newCustArea}
                              onChange={(e) => setNewCustArea(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {language === "en" ? "Full Delivery Address" : "সম্পূর্ণ ডেলিভারি ঠিকানা"}
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. House 12, Road 4, Dhanmondi, Dhaka"
                              value={newCustAddress}
                              onChange={(e) => setNewCustAddress(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-900/10 hover:scale-102 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            {language === "en" ? "Create Customer Account" : "কাস্টমার অ্যাকাউন্ট তৈরি করুন"}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Customer Database List Card */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight">
                          {language === "en"
                            ? "Registered Customers"
                            : "নিবন্ধিত কাস্টমার ডাটা"}
                        </h4>
                        <p className="text-xs text-slate-400 font-bold mt-1">
                          {language === "en"
                            ? `Database & local synchronized customer list (${customers.length} total)`
                            : `আপনার স্টোরে সাইন-আপ/লগইন করা মোট গ্রাহক সংখ্যা (${customers.length} জন)`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={exportCustomersToCSV}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title={
                            language === "en"
                              ? "Export as Excel/CSV File"
                              : "এক্সেল বা CSV ফাইল ডাউনলোড"
                          }
                        >
                          <Download className="w-4 h-4" />
                          {language === "en" ? "Export CSV" : "CSV ডাউনলোড"}
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncAllCustomers}
                          disabled={syncingAll}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-900/10 hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                        >
                          <Database
                            className={`w-4 h-4 ${syncingAll ? "animate-bounce" : ""}`}
                          />
                          {syncingAll
                            ? language === "en"
                              ? "Syncing..."
                              : "সিঙ্ক হচ্ছে..."
                            : language === "en"
                              ? "Sync All to Sheets"
                              : "সবগুলো শিটে পাঠান"}
                        </button>

                        <button
                          type="button"
                          onClick={fetchCustomers}
                          disabled={customersLoading}
                          className="p-2.5 bg-white hover:bg-slate-100 border border-slate-150 rounded-xl transition-all text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer shadow-sm"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${customersLoading ? "animate-spin" : ""}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Search Box */}
                    <div className="p-6 border-b border-slate-50 bg-white/70">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                          <Users className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          placeholder={
                            language === "en"
                              ? "Search customers by name, phone or email..."
                              : "নাম, মোবাইল নম্বর বা ইমেল দিয়ে সার্চ করুন..."
                          }
                          value={customerSearchTerm}
                          onChange={(e) =>
                            setCustomerSearchTerm(e.target.value)
                          }
                          className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-150 rounded-2xl pl-11 pr-6 py-3.5 text-xs font-bold outline-none transition-all focus:border-slate-300"
                        />
                      </div>
                    </div>

                    {customersLoading ? (
                      <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        {language === "en"
                          ? "Loading customer accounts database..."
                          : "গ্রাহক তথ্য লোড হচ্ছে..."}
                      </div>
                    ) : customers.length === 0 ? (
                      <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        {language === "en"
                          ? "No customer accounts registered yet"
                          : "এখনো কোন গ্রাহক সাইন-আপ করেননি"}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en"
                                  ? "Customer Profile"
                                  : "কাস্টমার প্রোফাইল"}
                              </th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en"
                                  ? "Contact details"
                                  : "যোগাযোগ তথ্য"}
                              </th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en"
                                  ? "Location"
                                  : "ঠিকানা ও এরিয়া"}
                              </th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {language === "en"
                                  ? "Last Updated"
                                  : "সর্বশেষ আপডেট"}
                              </th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                                {language === "en" ? "Actions" : "অ্যাকশন"}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customers
                              .filter((cust) => {
                                if (!customerSearchTerm) return true;
                                const term = customerSearchTerm.toLowerCase();
                                return (
                                  (cust.name || "")
                                    .toLowerCase()
                                    .includes(term) ||
                                  (cust.phone || "")
                                    .toLowerCase()
                                    .includes(term) ||
                                  (cust.email || "")
                                    .toLowerCase()
                                    .includes(term) ||
                                  (cust.address || "")
                                    .toLowerCase()
                                    .includes(term) ||
                                  (cust.city || "")
                                    .toLowerCase()
                                    .includes(term) ||
                                  (cust.area || "").toLowerCase().includes(term)
                                );
                              })
                              .map((cust) => (
                                <tr
                                  key={cust.id}
                                  className="hover:bg-slate-50/50 transition-colors"
                                >
                                  <td className="px-6 py-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                                        {cust.name
                                          ? cust.name.charAt(0).toUpperCase()
                                          : "?"}
                                      </div>
                                      <div className="space-y-0.5">
                                        <h5 className="font-bold text-slate-800 text-sm">
                                          {cust.name}
                                        </h5>
                                        <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                                          <span>
                                            UID: {cust.id.substring(0, 12)}...
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(
                                                cust.id,
                                              );
                                              setStatusMessage({
                                                text:
                                                  language === "en"
                                                    ? "UID copied!"
                                                    : "UID কপি হয়েছে!",
                                                type: "success",
                                              });
                                            }}
                                            className="hover:text-amber-600 hover:underline cursor-pointer"
                                          >
                                            [Copy]
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 space-y-1">
                                    {cust.phone ? (
                                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                        <PhoneIcon className="w-3" />
                                        {cust.phone}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-slate-400 font-medium italic">
                                        No phone
                                      </p>
                                    )}
                                    {cust.email ? (
                                      <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate max-w-[180px]">
                                        <Mail className="w-3" />
                                        {cust.email}
                                      </p>
                                    ) : (
                                      <p className="text-[11px] text-slate-400 font-medium italic">
                                        No email
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-6 py-5 space-y-1">
                                    {cust.address ? (
                                      <p
                                        className="text-xs font-semibold text-slate-750 truncate max-w-[200px]"
                                        title={cust.address}
                                      >
                                        {cust.address}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-slate-400 font-medium italic">
                                        No address specified
                                      </p>
                                    )}
                                    {cust.city || cust.area ? (
                                      <p className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-500 font-bold inline-block max-w-[150px] truncate">
                                        {cust.area ? `${cust.area}, ` : ""}
                                        {cust.city || ""}
                                      </p>
                                    ) : null}
                                  </td>
                                  <td className="px-6 py-5 text-xs font-medium text-slate-500">
                                    {new Date(cust.updated_at).toLocaleString(
                                      language === "bn" ? "bn-BD" : "en-US",
                                    )}
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleImpersonateCustomer(cust)}
                                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white transition-all rounded-lg border border-amber-100 hover:scale-105 active:scale-95 text-xs font-bold cursor-pointer"
                                        title={
                                          language === "en"
                                            ? "Impersonate Customer Account"
                                            : "কাস্টমার একাউন্টে প্রবেশ"
                                        }
                                      >
                                        {language === "en" ? "Impersonate" : "প্রবেশ করুন"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const {
                                              syncCustomerToGoogleSheets,
                                            } = await import("../lib/webhook");
                                            await syncCustomerToGoogleSheets(
                                              cust,
                                            );
                                            setStatusMessage({
                                              text:
                                                language === "en"
                                                  ? "Dispatched sync for this customer!"
                                                  : "সিঙ্ক ਰিকোয়েস্ট পাঠানো হয়েছে!",
                                              type: "success",
                                            });
                                          } catch (err) {
                                            console.error(
                                              "Individual sync error:",
                                              err,
                                            );
                                            alert("Failed to execute sync.");
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-all rounded-lg border border-slate-100 hover:border-amber-100 hover:scale-105 active:scale-95 text-xs font-bold cursor-pointer"
                                        title={
                                          language === "en"
                                            ? "Sync to Google Sheets"
                                            : "গুগল শিটে পাঠান"
                                        }
                                      >
                                        {language === "en" ? "Sync" : "সিঙ্ক"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCustomer(cust.id)
                                        }
                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-all rounded-lg border border-rose-100 hover:scale-105 active:scale-95 cursor-pointer"
                                        title={
                                          language === "en"
                                            ? "Delete Customer"
                                            : "মুছে ফেলুন"
                                        }
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Live Website Visitors Tracking & Traffic Intelligence Card */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm mt-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                          <h4 className="font-black text-slate-900 uppercase tracking-tight">
                            {language === 'en' ? 'Website Visitor Logs & Live Traffic' : 'ওয়েবসাইট লাইভ ভিজিটর ও ট্রাফিক রিপোর্ট'}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 font-bold mt-1">
                          {language === 'en'
                            ? 'Real-time customer visits, sessions, geo-location insights and referral entries'
                            : 'গ্রাহক বা উইজারদের ওয়েবসাইট ভিজিট, সেশন, অপারেটিং সিস্টেম ও লোকেশন ডাটা ট্র্যাকিং'
                          }
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={exportVisitorsToCSV}
                          className="px-4 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          title={language === 'en' ? 'Export Visitors list as CSV' : 'ভিজিটর ডাটা এক্সেল/CSV হিসেবে ডাউনলোড করুন'}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {language === 'en' ? 'Export CSV' : 'রিপোর্ট ডাউনলোড'}
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncAllVisitsToSheets}
                          disabled={syncingAllVisits}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title={language === 'en' ? 'Sync traffic events with Google Sheet Webhook' : 'সকল ভিজিটর ডাটা গুগল স্প্রেডশিটে পাঠান'}
                        >
                          <Database className="w-3.5 h-3.5 text-amber-500" />
                          {syncingAllVisits
                            ? (language === 'en' ? 'Syncing...' : 'সিঙ্ক হচ্ছে...')
                            : (language === 'en' ? 'Sync to Google Sheets' : 'শিটে পাঠান')
                          }
                        </button>

                        <button
                          type="button"
                          onClick={handleClearVisitorLogs}
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          title={language === 'en' ? 'Clear traffic records' : 'সকল ডাটা মুছে দিন'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {language === 'en' ? 'Clear Logs' : 'লগ মুছুন'}
                        </button>

                        <button
                          type="button"
                          onClick={fetchVisitorLogs}
                          disabled={visitorsLoading}
                          className="p-2.5 bg-white hover:bg-slate-100 border border-slate-150 rounded-xl transition-all text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer shadow-sm"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${visitorsLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Traffic Analytics Summary Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/10">
                      <div className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          {language === 'en' ? 'Total Traffic Hits' : 'মোট পেজ ভিউ / ক্লিক'}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-slate-800 tracking-tight">{visitorLogs.length}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{language === 'en' ? 'Views' : 'বার'}</span>
                        </div>
                      </div>

                      <div className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          {language === 'en' ? 'Unique Visitors' : 'ইউনিক ভিজিটর সংখ্যা'}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-slate-800 tracking-tight">
                            {new Set(visitorLogs.map(v => v.visitor_id)).size}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{language === 'en' ? 'Uniques' : 'জন'}</span>
                        </div>
                      </div>

                      <div className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          {language === 'en' ? 'Session Split' : 'ট্রাফিক ক্যাটাগরি ফ্লো'}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-slate-700">
                            {visitorLogs.filter(v => v.visitor_name !== 'Guest Visitor').length} <span className="text-[10px] text-slate-400 font-bold">User</span>
                          </span>
                          <span className="text-slate-300 font-light">/</span>
                          <span className="text-lg font-black text-slate-500">
                            {visitorLogs.filter(v => v.visitor_name === 'Guest Visitor').length} <span className="text-[10px] text-slate-400 font-bold">Guest</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Search and filter UI */}
                    <div className="p-6 border-b border-slate-50 bg-white/70">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          placeholder={language === 'en' ? 'Search live visits by page name, user details, IP country or operating system...' : 'ভিজিট লোকেশন, পেজের নাম, উইজার বা অপারেটিং সিস্টেম দিয়ে খুঁজুন...'}
                          value={visitorSearchTerm}
                          onChange={(e) => setVisitorSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-150 rounded-2xl pl-11 pr-6 py-3.5 text-xs font-bold outline-none transition-all focus:border-slate-300"
                        />
                      </div>
                    </div>

                    {visitorsLoading && visitorLogs.length === 0 ? (
                      <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        {language === 'en' ? 'Accessing live traffic database records...' : 'লাইভ ট্রাফিক ডাটা এক্সেস করা হচ্ছে...'}
                      </div>
                    ) : visitorLogs.length === 0 ? (
                      <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        {language === 'en' ? 'Waiting for first client session log...' : 'ভিজিটর বা গ্রাহকের ভিজিট করার অপেক্ষায়...'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Visitor Base / ID' : 'গ্রাহক / ভিজিটর প্রোফাইল'}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Page Visited' : 'কোন পেজ ভিজিট করেছে'}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'IP & Geo Location' : 'আইপি এবং জিও লোকেশন'}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Device & Referrer' : 'ডিভাইস ও রেফারার'}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Visit Timestamp' : 'ভিজিটের সময়'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {visitorLogs
                              .filter(visit => {
                                if (!visitorSearchTerm) return true;
                                const term = visitorSearchTerm.toLowerCase();
                                return (
                                  (visit.visitor_name || '').toLowerCase().includes(term) ||
                                  (visit.visitor_id || '').toLowerCase().includes(term) ||
                                  (visit.page_viewed || '').toLowerCase().includes(term) ||
                                  (visit.ip || '').toLowerCase().includes(term) ||
                                  (visit.location || '').toLowerCase().includes(term) ||
                                  (visit.device || '').toLowerCase().includes(term) ||
                                  (visit.referrer || '').toLowerCase().includes(term)
                                );
                              })
                              .map((visit) => {
                                const isGuest = visit.visitor_name === 'Guest Visitor';
                                return (
                                  <tr key={visit.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isGuest ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                          {isGuest ? 'G' : 'U'}
                                        </div>
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <h5 className="font-bold text-slate-800 text-xs">{visit.visitor_name}</h5>
                                            {!isGuest && (
                                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-bold rounded-md">
                                                {language === 'en' ? 'Customer' : 'কাস্টমার'}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                                            <span>{visit.visitor_id}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(visit.visitor_id);
                                                setStatusMessage({ 
                                                  text: language === 'en' ? 'Visitor ID copied!' : 'ভিজিটর আইডি কপি হয়েছে!', 
                                                  type: 'success' 
                                                });
                                              }}
                                              className="hover:text-amber-600 cursor-pointer text-[8px]"
                                            >
                                              [Copy]
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-6 py-5">
                                      <div className="flex items-center gap-1.5 max-w-[200px]">
                                        <span className="p-1 bg-slate-100 text-slate-600 rounded">
                                          <ExternalLink className="w-3 h-3" />
                                        </span>
                                        <span className="text-xs font-semibold text-slate-700 truncate" title={visit.page_viewed}>
                                          {visit.page_viewed}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="px-6 py-5 space-y-0.5">
                                      <p className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                                        <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                                        {visit.ip}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mr-2 leading-tight">
                                        <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                                        <span className="truncate max-w-[150px]" title={visit.location}>{visit.location}</span>
                                      </p>
                                    </td>

                                    <td className="px-6 py-5 space-y-1">
                                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-150 rounded-md text-[10px] text-slate-600 font-bold">
                                        {visit.device}
                                      </span>
                                      <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]" title={visit.referrer}>
                                        Referrer: <span className="font-semibold text-slate-500">{visit.referrer}</span>
                                      </p>
                                    </td>

                                    <td className="px-6 py-5 text-xs font-medium text-slate-500 whitespace-nowrap font-mono">
                                      {new Date(visit.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Analytics Terminal */
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Total Units
                      </p>
                      <div className="text-4xl font-black text-slate-900">
                        {products.length}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Package className="w-3 h-3 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-none">
                          Healthy Stock
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Categories
                      </p>
                      <div className="text-4xl font-black text-slate-900">
                        {[...new Set(products.map((p) => p.category))].length}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Layout className="w-3 h-3 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">
                          Segments
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Avg. Price
                      </p>
                      <div className="text-4xl font-black text-slate-900">
                        ৳
                        {products.length > 0
                          ? (
                              products.reduce((acc, p) => acc + p.price, 0) /
                              products.length
                            ).toFixed(2)
                          : "0"}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest leading-none">
                          Market Level
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Active Offers
                      </p>
                      <div className="text-4xl font-black text-slate-900">
                        {products.filter((p) => p.isOffer).length}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none">
                          On Promotion
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Category Distribution */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 flex flex-col h-[450px]">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="font-black text-slate-900 uppercase tracking-tight">
                            Category Mix
                          </h4>
                          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mt-1">
                            Inventory Weightage
                          </p>
                        </div>
                        <PieIcon className="w-5 h-5 text-slate-300" />
                      </div>
                      <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(
                                products.reduce(
                                  (acc, p) => ({
                                    ...acc,
                                    [p.category]: (acc[p.category] || 0) + 1,
                                  }),
                                  {} as Record<string, number>,
                                ),
                              ).map(([name, value]) => ({ name, value }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {[
                                ...new Set(products.map((p) => p.category)),
                              ].map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    [
                                      "#f59e0b",
                                      "#10b981",
                                      "#3b82f6",
                                      "#ef4444",
                                      "#8b5cf6",
                                    ][index % 5]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                borderRadius: "1rem",
                                border: "none",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                fontSize: "10px",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Price Range Distribution */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 flex flex-col h-[450px]">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="font-black text-slate-900 uppercase tracking-tight">
                            Price Segments
                          </h4>
                          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mt-1">
                            Product Count by Price
                          </p>
                        </div>
                        <BarChart2 className="w-5 h-5 text-slate-300" />
                      </div>
                      <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                range: "৳0-50",
                                count: products.filter((p) => p.price <= 50)
                                  .length,
                              },
                              {
                                range: "৳51-100",
                                count: products.filter(
                                  (p) => p.price > 50 && p.price <= 100,
                                ).length,
                              },
                              {
                                range: "৳101-200",
                                count: products.filter(
                                  (p) => p.price > 100 && p.price <= 200,
                                ).length,
                              },
                              {
                                range: "৳200+",
                                count: products.filter((p) => p.price > 200)
                                  .length,
                              },
                            ]}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#f1f5f9"
                            />
                            <XAxis
                              dataKey="range"
                              axisLine={false}
                              tickLine={false}
                              tick={{
                                fontSize: 10,
                                fontWeight: 700,
                                fill: "#94a3b8",
                              }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{
                                fontSize: 10,
                                fontWeight: 700,
                                fill: "#94a3b8",
                              }}
                            />
                            <Tooltip
                              cursor={{ fill: "#f8fafc" }}
                              contentStyle={{
                                borderRadius: "1rem",
                                border: "none",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                fontSize: "10px",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                              }}
                            />
                            <Bar
                              dataKey="count"
                              fill="#334155"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
