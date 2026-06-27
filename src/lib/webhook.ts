import { supabase } from './supabase';

export interface CustomerData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  area?: string;
  bio?: string;
  updated_at: string;
}

export interface VisitorLog {
  id: string; // Unique visit record id
  visitor_id: string; // Long-term browser tracking ID
  visitor_name: string;
  email?: string;
  phone?: string;
  device: string;
  ip?: string;
  location?: string;
  page_viewed: string;
  referrer: string;
  timestamp: string;
}

export function saveLocalUserBackup(userData: CustomerData) {
  try {
    const backupStr = localStorage.getItem('yummydash_custom_users');
    let list: CustomerData[] = [];
    if (backupStr) {
      try {
        list = JSON.parse(backupStr);
        if (!Array.isArray(list)) list = [];
      } catch (e) {
        list = [];
      }
    }
    // Remove duplication
    list = list.filter((u) => u.id !== userData.id);
    list.push(userData);
    localStorage.setItem('yummydash_custom_users', JSON.stringify(list));
  } catch (err) {
    console.error('Error saving local user backup:', err);
  }
}

// Robust webhook dispatcher that supports both query string (e.parameter) and JSON body (e.postData.contents) compatibility.
async function dispatchWebhook(webhookUrl: string, payload: any): Promise<void> {
  try {
    let targetUrl = webhookUrl;
    const urlParams = new URLSearchParams();
    
    Object.entries(payload).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        urlParams.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
    });
    
    if (targetUrl.includes('?')) {
      targetUrl += '&' + urlParams.toString();
    } else {
      targetUrl += '?' + urlParams.toString();
    }

    // Send with no-cors. Using text/plain ensures that the raw body is preserved and not altered by the browser
    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn('Google Sheets Webhook dispatch failed:', error);
  }
}

export async function syncCustomerToGoogleSheets(customer: CustomerData) {
  try {
    let googleSheetsWebhook = '';
    let googleSheetsWebhookEnabled = false;

    if (supabase) {
      const { data, error } = await supabase
        .from('settings')
        .select('companyInfo')
        .eq('id', 'global')
        .maybeSingle();
      if (!error && data?.companyInfo) {
        googleSheetsWebhook = data.companyInfo.googleSheetsWebhook || '';
        googleSheetsWebhookEnabled = !!data.companyInfo.googleSheetsWebhookEnabled;
      }
    } else {
      const localSettingsStr = localStorage.getItem('yummydash_custom_settings');
      if (localSettingsStr) {
        try {
          const localSettings = JSON.parse(localSettingsStr);
          googleSheetsWebhook = localSettings?.companyInfo?.googleSheetsWebhook || '';
          googleSheetsWebhookEnabled = !!localSettings?.companyInfo?.googleSheetsWebhookEnabled;
        } catch (e) {
          console.error('Error reading local settings for webhook:', e);
        }
      }
    }

    if (!googleSheetsWebhookEnabled || !googleSheetsWebhook) {
      return;
    }

    console.log('Sending customer data to Sheets webhook:', customer);
    
    // We parse the properties cleanly to avoid sending unwanted metadata
    const payload = {
      event_type: 'customer_registration',
      id: customer.id,
      name: customer.name,
      customer_name: customer.name,
      customerName: customer.name,
      email: customer.email || '',
      customer_email: customer.email || '',
      customerEmail: customer.email || '',
      phone: customer.phone || '',
      customer_phone: customer.phone || '',
      customerPhone: customer.phone || '',
      address: customer.address || '',
      customer_address: customer.address || '',
      customerAddress: customer.address || '',
      city: customer.city || '',
      customer_city: customer.city || '',
      customerCity: customer.city || '',
      area: customer.area || '',
      customer_area: customer.area || '',
      customerArea: customer.area || '',
      bio: customer.bio || '',
      customer_bio: customer.bio || '',
      customerBio: customer.bio || '',
      updated_at: customer.updated_at,

      // Bangla Translation/Phonetic Keys
      আইডি: customer.id,
      কাস্টমার_নাম: customer.name,
      নাম: customer.name,
      ইমেইল: customer.email || '',
      মোবাইল: customer.phone || '',
      ফোন: customer.phone || '',
      ঠিকানা: customer.address || '',
      শহর: customer.city || '',
      এলাকা: customer.area || '',
      পরিচিতি: customer.bio || '',
      আপডেট_সময়: customer.updated_at
    };

    // Dispatch utilizing robust dual-compatibility method
    await dispatchWebhook(googleSheetsWebhook, payload);
    console.log('Webhook dispatched successfully for customer:', customer.id);
  } catch (error) {
    console.warn('Google Sheets Sync webhook invocation failed (this is non-critical):', error);
  }
}

// Generates or retrieves a persistent browser unique visitor tracking ID
export function getOrCreateVisitorId(): string {
  let vid = localStorage.getItem('yummydash_visitor_id');
  if (!vid) {
    vid = 'V-' + Math.random().toString(36).substring(2, 11).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    localStorage.setItem('yummydash_visitor_id', vid);
  }
  return vid;
}

// Fetch visitor IP and location info asynchronously
async function fetchIpAndLocation(): Promise<{ ip: string; location: string }> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      const ip = data.ip || 'Unknown';
      const loc = `${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.replace(/^,\s*/, '').trim() || 'Unknown Location';
      return { ip, location: loc };
    }
  } catch (e) {
    console.warn('Failed to fetch IP and location from ipapi:', e);
  }
  return { ip: 'Unavailable', location: 'Unavailable' };
}

// Tracks of a new website visit/page loading
export async function registerVisitorVisit(currentPage: string, loggedInUser?: { name: string; email?: string; phone?: string }) {
  try {
    const visitorId = getOrCreateVisitorId();
    const visitId = 'VISIT-' + Math.random().toString(36).substring(2, 11).toUpperCase() + '-' + Date.now().toString().substring(8);
    
    // Determine Device type
    const width = window.innerWidth;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const deviceType = isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop';
    
    // Parse simplified user agent / OS info
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    const referrerRaw = document.referrer || '';
    let referrer = 'Direct Visit';
    if (referrerRaw) {
      try {
        const urlObj = new URL(referrerRaw);
        referrer = urlObj.hostname;
      } catch (err) {
        referrer = referrerRaw;
      }
    }

    // Capture initial visit
    const visitRecord: VisitorLog = {
      id: visitId,
      visitor_id: visitorId,
      visitor_name: loggedInUser?.name || 'Guest Visitor',
      email: loggedInUser?.email || '',
      phone: loggedInUser?.phone || '',
      device: `${deviceType} (${os})`,
      ip: 'Loading...',
      location: 'Loading...',
      page_viewed: currentPage || 'Home Index',
      referrer: referrer,
      timestamp: new Date().toISOString()
    };

    // Store instantly in local records
    const localLogsStr = localStorage.getItem('yummydash_visitor_logs');
    let logs: VisitorLog[] = [];
    if (localLogsStr) {
      try {
        logs = JSON.parse(localLogsStr);
        if (!Array.isArray(logs)) logs = [];
      } catch (vErr) {
        logs = [];
      }
    }

    // Keep the log count limited to the last 400 entries to prevent local storage quota exceeded error
    logs = logs.slice(0, 400);
    logs.unshift(visitRecord);
    localStorage.setItem('yummydash_visitor_logs', JSON.stringify(logs));
    window.dispatchEvent(new Event('yummydash_new_visit_logged'));

    // Fetch IP and Location asynchronously, updating the record once loaded
    fetchIpAndLocation().then(async ({ ip, location }) => {
      visitRecord.ip = ip;
      visitRecord.location = location;

      // Update in localStorage
      const updatedLogsStr = localStorage.getItem('yummydash_visitor_logs');
      if (updatedLogsStr) {
        try {
          const loadedLogs: VisitorLog[] = JSON.parse(updatedLogsStr);
          const foundIdx = loadedLogs.findIndex(l => l.id === visitId);
          if (foundIdx !== -1) {
            loadedLogs[foundIdx].ip = ip;
            loadedLogs[foundIdx].location = location;
            localStorage.setItem('yummydash_visitor_logs', JSON.stringify(loadedLogs));
            window.dispatchEvent(new Event('yummydash_new_visit_logged'));
          }
        } catch (err) {}
      }

      // If Supabase is available, attempt to post to a visits table (optional, doesn't throw if absent)
      if (supabase) {
        try {
          await supabase.from('visitor_logs').insert({
            id: visitRecord.id,
            visitor_id: visitRecord.visitor_id,
            visitor_name: visitRecord.visitor_name,
            email: visitRecord.email,
            phone: visitRecord.phone,
            device: visitRecord.device,
            ip: visitRecord.ip,
            location: visitRecord.location,
            page_viewed: visitRecord.page_viewed,
            referrer: visitRecord.referrer,
            timestamp: visitRecord.timestamp
          });
        } catch (suppErr) {
          // Soft ignore since schema might not have this custom table yet
        }
      }

      // Automatically dispatch to Google Sheets webhook as a traffic log event if configured and enabled
      await syncVisitToGoogleSheets(visitRecord);
    });

  } catch (err) {
    console.error('Error tracking visitor visit details:', err);
  }
}

// Sends traffic log payload to the Google Sheets integration URL if enabled
export async function syncVisitToGoogleSheets(visit: VisitorLog) {
  try {
    let googleSheetsWebhook = '';
    let googleSheetsWebhookEnabled = false;

    if (supabase) {
      const { data, error } = await supabase
        .from('settings')
        .select('companyInfo')
        .eq('id', 'global')
        .maybeSingle();
      if (!error && data?.companyInfo) {
        googleSheetsWebhook = data.companyInfo.googleSheetsWebhook || '';
        googleSheetsWebhookEnabled = !!data.companyInfo.googleSheetsWebhookEnabled;
      }
    } else {
      const localSettingsStr = localStorage.getItem('yummydash_custom_settings');
      if (localSettingsStr) {
        try {
          const localSettings = JSON.parse(localSettingsStr);
          googleSheetsWebhook = localSettings?.companyInfo?.googleSheetsWebhook || '';
          googleSheetsWebhookEnabled = !!localSettings?.companyInfo?.googleSheetsWebhookEnabled;
        } catch (e) {
          console.error('Error reading local settings for webhook:', e);
        }
      }
    }

    if (!googleSheetsWebhookEnabled || !googleSheetsWebhook) {
      return;
    }

    const payload = {
      event_type: 'visitor_traffic',
      id: visit.id,
      visitor_id: visit.visitor_id,
      visitorId: visit.visitor_id,
      name: visit.visitor_name,
      visitor_name: visit.visitor_name,
      visitorName: visit.visitor_name,
      email: visit.email || '',
      phone: visit.phone || '',
      device: visit.device,
      ip: visit.ip || '',
      location: visit.location || '',
      page_viewed: visit.page_viewed,
      pageViewed: visit.page_viewed,
      referrer: visit.referrer,
      updated_at: visit.timestamp,

      // Bangla Translation/Phonetic Keys
      আইডি: visit.id,
      ভিজিটর_আইডি: visit.visitor_id,
      ভিজিটর_নাম: visit.visitor_name,
      নাম: visit.visitor_name,
      ইমেইল: visit.email || '',
      মোবাইল: visit.phone || '',
      ডিভাইস: visit.device,
      আইপি: visit.ip || '',
      লোকেশন: visit.location || '',
      পেজ: visit.page_viewed,
      রেফারার: visit.referrer,
      সময়: visit.timestamp
    };

    await dispatchWebhook(googleSheetsWebhook, payload);
  } catch (error) {
    console.warn('Failed syncing visit log to sheet webhook (non-critical):', error);
  }
}

// Sends order information payload to the Google Sheets integration URL if enabled
export async function syncOrderToGoogleSheets(order: any): Promise<boolean> {
  try {
    let googleSheetsWebhook = '';
    let googleSheetsWebhookEnabled = false;

    if (supabase) {
      const { data, error } = await supabase
        .from('settings')
        .select('companyInfo')
        .eq('id', 'global')
        .maybeSingle();
      if (!error && data?.companyInfo) {
        googleSheetsWebhook = data.companyInfo.googleSheetsWebhook || '';
        googleSheetsWebhookEnabled = !!data.companyInfo.googleSheetsWebhookEnabled;
      }
    } else {
      const localSettingsStr = localStorage.getItem('yummydash_custom_settings');
      if (localSettingsStr) {
        try {
          const localSettings = JSON.parse(localSettingsStr);
          googleSheetsWebhook = localSettings?.companyInfo?.googleSheetsWebhook || '';
          googleSheetsWebhookEnabled = !!localSettings?.companyInfo?.googleSheetsWebhookEnabled;
        } catch (e) {
          console.error('Error reading local settings for webhook:', e);
        }
      }
    }

    if (!googleSheetsWebhookEnabled || !googleSheetsWebhook) {
      return false;
    }

    const itemsList = order.items || [];
    const itemsSummary = itemsList.map((item: any) => {
      const q = item.quantity || 1;
      const name = item.name || item.nameBn || 'Item';
      const price = item.price || 0;
      return `${q}x ${name} (৳${price})`;
    }).join(', ');

    const totalQuantity = itemsList.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

    // Calculate formatted local date and time beautifully
    const dateObj = order.created_at ? new Date(order.created_at) : new Date();
    const orderDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
    const orderTime = dateObj.toTimeString().split(' ')[0]; // HH:MM:SS
    const serialNumber = order.id ? `#${order.id.slice(-6).toUpperCase()}` : `#${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Standard fields for easy reuse
    const customerFirstName = order.customer?.firstName || '';
    const customerLastName = order.customer?.lastName || '';
    const customerFullName = `${customerFirstName} ${customerLastName}`.trim() || 'Guest Customer';
    const customerPhone = order.customer?.phone || '';
    const customerEmail = order.customer?.email || '';
    const customerAddress = order.customer?.address || '';
    const customerCity = order.customer?.city || '';
    const customerArea = order.customer?.area || '';
    const customerNote = order.customer?.note || '';
    const paymentMethod = order.customer?.paymentMethod || 'Cash';
    const transactionId = order.customer?.transactionId || '';
    const totalAmount = order.total || 0;
    const orderStatus = order.status || 'pending';
    const deliveryDate = order.customer?.deliveryDate || '';
    const deliveryTime = order.customer?.deliveryTime || '';

    const payload = {
      event_type: 'order_placement',
      
      // Order Identifiers
      order_id: order.id || '',
      id: order.id || '',
      orderId: order.id || '',
      order_number: order.id || '',
      orderNumber: order.id || '',
      serial_number: serialNumber,
      serialNumber: serialNumber,
      
      // Delivery Schedule
      delivery_date: deliveryDate,
      deliveryDate: deliveryDate,
      delivery_time: deliveryTime,
      deliveryTime: deliveryTime,
      preferred_delivery_date: deliveryDate,
      preferred_delivery_time: deliveryTime,
      
      // Customer Info - Aliases for maximum spreadsheet/script column compatibility
      customer_name: customerFullName,
      customerName: customerFullName,
      customer_fullname: customerFullName,
      name: customerFullName,
      Name: customerFullName,
      firstName: customerFirstName,
      lastName: customerLastName,
      
      customer_phone: customerPhone,
      customerPhone: customerPhone,
      phone: customerPhone,
      Phone: customerPhone,
      mobile: customerPhone,
      Mobile: customerPhone,
      
      customer_email: customerEmail,
      customerEmail: customerEmail,
      email: customerEmail,
      Email: customerEmail,
      
      customer_address: customerAddress,
      customerAddress: customerAddress,
      address: customerAddress,
      Address: customerAddress,
      
      customer_city: customerCity,
      customerCity: customerCity,
      city: customerCity,
      City: customerCity,
      
      customer_area: customerArea,
      customerArea: customerArea,
      area: customerArea,
      Area: customerArea,
      
      customer_note: customerNote,
      customerNote: customerNote,
      note: customerNote,
      Note: customerNote,
      notes: customerNote,
      Notes: customerNote,
      
      // Order details
      payment_method: paymentMethod,
      paymentMethod: paymentMethod,
      payment: paymentMethod,
      Payment: paymentMethod,
      
      transaction_id: transactionId,
      transactionId: transactionId,
      transaction: transactionId,
      Transaction: transactionId,
      
      items_summary: itemsSummary,
      itemsSummary: itemsSummary,
      items: itemsSummary,
      Items: itemsSummary,
      products: itemsSummary,
      Products: itemsSummary,
      
      total_quantity: totalQuantity,
      totalQuantity: totalQuantity,
      quantity: totalQuantity,
      Quantity: totalQuantity,
      
      total_amount: totalAmount,
      totalAmount: totalAmount,
      total: totalAmount,
      Total: totalAmount,
      amount: totalAmount,
      Amount: totalAmount,
      
      status: orderStatus,
      Status: orderStatus,
      
      order_date: orderDate,
      orderDate: orderDate,
      date: orderDate,
      Date: orderDate,
      
      order_time: orderTime,
      orderTime: orderTime,
      time: orderTime,
      Time: orderTime,
      
      created_at: order.created_at || new Date().toISOString(),
      updated_at: order.updated_at || new Date().toISOString(),

      // Bangla Translation/Phonetic Keys so that if Google sheet has Bangla column headers, it matches instantly!
      অর্ডার_আইডি: order.id || '',
      অর্ডার_নম্বর: order.id || '',
      সিরিয়াল_নম্বর: serialNumber,
      কাস্টমারের_নাম: customerFullName,
      কাস্টমার_নাম: customerFullName,
      নাম: customerFullName,
      মোবাইল: customerPhone,
      মোবাইল_নম্বর: customerPhone,
      ফোন: customerPhone,
      ইমেইল: customerEmail,
      ঠিকানা: customerAddress,
      শহর: customerCity,
      এলাকা: customerArea,
      মন্তব্য: customerNote,
      পেমেন্ট_মেথড: paymentMethod,
      ট্রানজেকশন_আইডি: transactionId,
      পণ্যের_বিবরণ: itemsSummary,
      পণ্য: itemsSummary,
      মোট_পরিমাণ: totalQuantity,
      মোট_টাকা: totalAmount,
      টাকা: totalAmount,
      বিল: totalAmount,
      তারিখ: orderDate,
      সময়: orderTime,
      ডেলিভারির_তারিখ: deliveryDate,
      ডেলিভারি_তারিখ: deliveryDate,
      ডেলিভারির_সময়: deliveryTime,
      ডেলিভারি_সময়: deliveryTime,
      অবস্থা: orderStatus
    };

    console.log('Sending order data to Sheets webhook:', payload);

    await dispatchWebhook(googleSheetsWebhook, payload);

    console.log('Order webhook dispatched successfully:', order.id);
    return true;
  } catch (error) {
    console.warn('Failed syncing order to sheet webhook (non-critical):', error);
    return false;
  }
}

