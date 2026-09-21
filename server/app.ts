import express from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  getTrips,
  getTripById,
  getHomepageSettings,
  getLiveTrip,
  createTrip,
  setLiveTrip,
  setHeroImage,
  updateTrip,
  deleteTrip,
  duplicateTrip,
  updateTripStatus,
  addTripGalleryImage,
  deleteTripGalleryImage,
  deleteTripGalleryImageByUrl,
  getReviews,
  createReview,
  deleteReview,
  deleteReviewImage,
  getInquiries,
  createInquiry,
  findInquiryByRazorpayPaymentId,
  saveRazorpayBooking,
  verifyAndSaveUtrInquiry,
  updateInquiryStatus,
  getAnnouncements,
  getActiveAnnouncement,
  createAnnouncement,
  toggleAnnouncementActive,
  deleteAnnouncement,
  checkAndReserveSeats,
} from './db.js';
import {
  getSupabase,
  validateSupabaseConfig,
  uploadImageToStorage,
  deleteImageFromStorage,
  isBase64DataUrl,
} from './supabase.js';
import {
  getRazorpayKeyId,
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayPaymentWithAPI,
  isRazorpayConfigured,
} from './razorpay.js';
import {
  requireAdminAuth,
  ensureAdminUserExists,
  isAuthorizedAdminEmail,
  AuthenticatedRequest,
} from './auth.js';
import { validateServerEnv, getServerConfig } from './config/env.js';

export function createExpressApp() {
  const app = express();

  // Validate server environment on startup
  validateServerEnv();

  // Ensure primary administrator account is present in Supabase Auth
  ensureAdminUserExists().catch((err) => {
    console.warn('⚠️ Notice verifying admin account in Supabase Auth:', err.message);
  });

  // Middleware with body limit to support high-resolution photo uploads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Lazy initialize Gemini AI client
  let geminiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (geminiClient) return geminiClient;
    const apiKey = getServerConfig().GEMINI_API_KEY;
    if (apiKey) {
      geminiClient = new GoogleGenAI({ apiKey });
    }
    return geminiClient;
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const config = getServerConfig();
    res.json({
      status: 'ok',
      service: 'roamx-expeditions-api',
      timestamp: new Date().toISOString(),
      supabaseConfigured: Boolean(config.SUPABASE_URL && config.SUPABASE_KEY),
      razorpayConfigured: isRazorpayConfigured(),
      appUrl: config.APP_URL,
      environment: config.NODE_ENV,
    });
  });

  // Public Configuration endpoint
  app.get('/api/config', (req, res) => {
    const config = getServerConfig();
    res.json({
      appUrl: config.APP_URL,
      razorpayKeyId: config.RAZORPAY_KEY_ID,
      supabaseConfigured: Boolean(config.SUPABASE_URL && config.SUPABASE_KEY),
      razorpayConfigured: isRazorpayConfigured(),
    });
  });

  // ====================================================
  // AUTHENTICATION ENDPOINTS (Supabase Auth)
  // ====================================================

  /**
   * Admin Login using Supabase Auth
   * Authenticates administrator credentials and returns session token
   */
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required for administrator sign in',
        });
      }

      const supabase = getSupabase();
      if (!supabase) {
        return res.status(503).json({
          success: false,
          error: 'Database authentication service is currently unavailable',
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if email is in the authorized admin list
      if (!isAuthorizedAdminEmail(cleanEmail)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: User is not authorized as a RoamX administrator.',
        });
      }

      // Authenticate via Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.trim(),
      });

      if (error || !data.session) {
        console.warn(`❌ Failed admin login attempt for ${cleanEmail}:`, error?.message);
        return res.status(401).json({
          success: false,
          error: 'Invalid administrator credentials. Please check your password.',
        });
      }

      const user = data.user;
      console.log(`✅ Admin logged in successfully: ${user.email}`);

      return res.json({
        success: true,
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          id: user.id,
          email: user.email,
          role: 'admin',
        },
      });
    } catch (err: any) {
      console.error('❌ Exception during admin login:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Internal server error during authentication',
      });
    }
  });

  /**
   * Verify Active Admin Session
   */
  app.get('/api/auth/me', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    return res.json({
      success: true,
      user: req.adminUser,
    });
  });

  // ====================================================
  // 1. Storage & Media Upload Endpoint (Admin Only)
  // ====================================================
  app.post('/api/upload', requireAdminAuth, async (req, res) => {
    try {
      const { image, folder = 'trips' } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: 'No image provided in request body' });
      }

      const publicUrl = await uploadImageToStorage(image, folder as any);
      res.json({
        success: true,
        url: publicUrl,
        message: 'Image uploaded to Supabase Storage successfully',
      });
    } catch (err: any) {
      console.error('❌ Upload error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to upload image' });
    }
  });

  // ====================================================
  // 2. Announcements Endpoints
  // ====================================================
  app.get('/api/announcements', async (req, res) => {
    try {
      const announcements = await getAnnouncements();
      res.json({ success: true, data: announcements });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/announcements/active', async (req, res) => {
    try {
      const active = await getActiveAnnouncement();
      res.json({ success: true, data: active });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Create Announcement
  app.post('/api/announcements', requireAdminAuth, async (req, res) => {
    try {
      const { text, link, badge, isActive } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, error: 'Announcement text is required' });
      }

      const created = await createAnnouncement({ text, link, badge, isActive });
      const all = await getAnnouncements();
      res.status(201).json({ success: true, data: created, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Toggle Active Announcement
  app.patch('/api/announcements/:id/toggle', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await toggleAnnouncementActive(id);
      res.json({ success: true, data: result.toggled, all: result.all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Delete Announcement
  app.delete('/api/announcements/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteAnnouncement(id);
      const all = await getAnnouncements();
      res.json({ success: true, message: 'Announcement deleted successfully', data: all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ====================================================
  // 3. Trips & Expeditions Endpoints
  // ====================================================
  app.get('/api/trips', async (req, res) => {
    try {
      const trips = await getTrips();
      res.json({ success: true, data: trips });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/trips/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const trip = await getTripById(id);
      if (!trip) {
        return res.status(404).json({ success: false, error: 'Expedition not found' });
      }
      res.json({ success: true, data: trip });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/homepage', async (req, res) => {
    try {
      const homepageData = await getHomepageSettings();
      res.json({ success: true, data: homepageData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Create Trip
  app.post('/api/trips', requireAdminAuth, async (req, res) => {
    try {
      const tripData = req.body;
      if (!tripData.title || !tripData.price) {
        return res.status(400).json({ success: false, error: 'Trip title and price are required' });
      }

      const created = await createTrip(tripData);
      const all = await getTrips();
      res.status(201).json({ success: true, data: created, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Update Trip
  app.patch('/api/trips/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await updateTrip(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Expedition not found' });
      }

      const all = await getTrips();
      res.json({ success: true, data: updated, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Update Trip Status
  app.patch('/api/trips/:id/status', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await updateTripStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Expedition not found' });
      }

      const all = await getTrips();
      res.json({ success: true, data: updated, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Set Live Expedition
  app.patch('/api/trips/:id/set-live', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await setLiveTrip(id);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Expedition not found' });
      }

      const all = await getTrips();
      res.json({ success: true, data: updated, all, message: `"${updated.title}" is now the live featured expedition.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Update Hero Image
  app.patch('/api/trips/:id/hero', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { heroImage } = req.body;
      if (!heroImage) {
        return res.status(400).json({ success: false, error: 'heroImage URL is required' });
      }

      const updated = await setHeroImage(id, heroImage);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Expedition not found' });
      }

      const all = await getTrips();
      res.json({ success: true, data: updated, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Duplicate Trip
  app.post('/api/trips/:id/duplicate', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const duplicated = await duplicateTrip(id);
      const all = await getTrips();
      res.status(201).json({ success: true, data: duplicated, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Delete Trip
  app.delete('/api/trips/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteTrip(id);
      const all = await getTrips();
      res.json({ success: true, message: 'Expedition deleted permanently from Supabase', data: all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Add Gallery Image
  app.post('/api/trips/:id/gallery', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { imageUrl, makeHero = false } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ success: false, error: 'imageUrl is required' });
      }

      const updated = await addTripGalleryImage(id, imageUrl, makeHero);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Expedition not found' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Delete Gallery Image by URL
  app.delete('/api/trips/:tripId/gallery', requireAdminAuth, async (req, res) => {
    try {
      const { tripId } = req.params;
      const { imageUrl } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ success: false, error: 'imageUrl is required' });
      }

      const result = await deleteTripGalleryImageByUrl(tripId, imageUrl);
      if (!result.trip) {
        return res.status(404).json({ success: false, error: 'Expedition or image not found' });
      }

      res.json({ success: true, data: result.trip, removedImage: result.removedUrl });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Delete Gallery Image by Index
  app.delete('/api/trips/:tripId/gallery/:imageIndex', requireAdminAuth, async (req, res) => {
    try {
      const { tripId, imageIndex } = req.params;
      const idx = parseInt(imageIndex, 10);
      if (isNaN(idx)) {
        return res.status(400).json({ success: false, error: 'Invalid image index' });
      }

      const result = await deleteTripGalleryImage(tripId, idx);
      if (!result.trip) {
        return res.status(404).json({ success: false, error: 'Trip or image not found' });
      }

      res.json({
        success: true,
        data: result.trip,
        removedImage: result.removedUrl,
        message: 'Gallery photo deleted permanently',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ====================================================
  // 4. Inquiries & Bookings Endpoints (PII Protected)
  // ====================================================

  /**
   * Get all inquiries & bookings (PROTECTED: Admin Only)
   * Prevents customer PII (names, phones, emails, DOB) from being exposed to public users
   */
  app.get('/api/inquiries', requireAdminAuth, async (req, res) => {
    try {
      const inqs = await getInquiries();
      res.json({ success: true, data: inqs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public: Submit pre-booking inquiry
  app.post('/api/inquiries', async (req, res) => {
    try {
      const { name, phone, tripTitle } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ success: false, error: 'Name and Phone number are required' });
      }

      const newInquiry = await createInquiry(req.body);
      res.status(201).json({ success: true, data: newInquiry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Update Inquiry Status (Admin Only)
  app.patch('/api/inquiries/:id/status', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, paymentStatus } = req.body;
      const updated = await updateInquiryStatus(id, status, paymentStatus);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Inquiry not found' });
      }
      const all = await getInquiries();
      res.json({ success: true, data: updated, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ====================================================
  // 5. Razorpay Payment Gateway Endpoints
  // ====================================================

  // Get Razorpay public config (Safe for frontend)
  app.get('/api/payment/config', (req, res) => {
    const keyId = getRazorpayKeyId();
    res.json({
      success: true,
      keyId,
      currency: 'INR',
      configured: isRazorpayConfigured(),
    });
  });

  /**
   * Create server-side Razorpay order
   * - NEVER trusts frontend amounts: calculates verified price from database
   * - ATOMIC SEAT CHECK: verifies seats are available before creating payment order
   * - Rejects with configuration error if keys are missing
   */
  app.post('/api/payment/create-order', async (req, res) => {
    try {
      const {
        tripId,
        customerName,
        customerPhone,
        customerEmail,
        departureCity,
        selectedMonth,
        selectedDate,
        travelersCount = 1,
        paymentType = 'token',
      } = req.body;

      if (!tripId) {
        return res.status(400).json({ success: false, error: 'tripId is required to create a payment order' });
      }

      // 1. Fetch trip from DB to get verified price
      const trip = await getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ success: false, error: 'Trip not found in database' });
      }

      const count = Math.max(1, Number(travelersCount) || 1);

      // 2. Atomic seat availability check to prevent overselling
      const seatCheck = await checkAndReserveSeats(tripId, selectedDate || '', count);
      if (!seatCheck.allowed) {
        return res.status(409).json({
          success: false,
          error: seatCheck.error || 'The selected departure batch is fully booked.',
        });
      }

      // 3. Calculate unit price based on departure city
      let unitPrice = trip.price;
      if (departureCity && trip.departureCities && trip.departureCities.length > 0) {
        const matchedCity = trip.departureCities.find(
          (c) =>
            c.city.toLowerCase() === departureCity.toLowerCase() ||
            c.city.toLowerCase().includes(departureCity.toLowerCase())
        );
        if (matchedCity && matchedCity.price) {
          unitPrice = matchedCity.price;
        }
      }

      const fullTotalPrice = unitPrice * count;
      const payableAmount = paymentType === 'full' ? fullTotalPrice : 500 * count;
      const amountInPaise = Math.round(payableAmount * 100);

      const receipt = `rx_rcpt_${Date.now().toString().slice(-8)}_${Math.floor(Math.random() * 1000)}`;

      // 4. Create official Razorpay order (disables payment with clear error if keys missing)
      const order = await createRazorpayOrder({
        amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          tripId: trip.id,
          tripTitle: trip.title,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          paymentType,
          travelersCount: String(count),
          departureCity: departureCity || '',
          selectedDate: selectedDate || '',
        },
      });

      return res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        payableAmount,
        fullTotalPrice,
        currency: order.currency,
        keyId: getRazorpayKeyId(),
        trip: {
          id: trip.id,
          title: trip.title,
          price: unitPrice,
        },
      });
    } catch (err: any) {
      console.error('❌ Error creating Razorpay order:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to create Razorpay payment order',
      });
    }
  });

  /**
   * Verify Razorpay Payment Signature & Confirm Booking
   * Full cryptographic verification and API validation
   */
  app.post('/api/payment/verify', async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        tripId,
        tripTitle,
        name,
        phone,
        email,
        gender,
        dateOfBirth,
        age,
        travelersCount = 1,
        departureCity,
        selectedMonth,
        selectedDate,
        paymentType = 'token',
        message,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required payment verification parameters (order ID, payment ID, or signature)',
        });
      }

      // Reject any simulated/fake IDs in production
      if (
        razorpay_order_id.startsWith('order_sim_') ||
        razorpay_payment_id.startsWith('pay_sim_') ||
        razorpay_signature.startsWith('sig_sim_')
      ) {
        return res.status(400).json({
          success: false,
          error: 'Simulated payment IDs are not accepted in production',
        });
      }

      // 1. Verify HMAC SHA-256 signature
      const isSignatureValid = verifyRazorpayPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isSignatureValid) {
        console.error('❌ Razorpay signature verification failed for payment:', razorpay_payment_id);
        return res.status(400).json({
          success: false,
          error: 'Payment signature verification failed. Transaction cannot be validated.',
        });
      }

      // 2. Prevent duplicate booking insertion
      const existing = await findInquiryByRazorpayPaymentId(razorpay_payment_id);
      if (existing) {
        return res.json({
          success: true,
          verified: true,
          data: existing,
          message: 'Payment has already been verified and booking confirmed.',
        });
      }

      // 3. Re-verify trip details and calculate expected amount
      const trip = await getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ success: false, error: 'Expedition not found for booking' });
      }

      let unitPrice = trip.price;
      if (departureCity && trip.departureCities) {
        const match = trip.departureCities.find(
          (c) =>
            c.city.toLowerCase() === departureCity.toLowerCase() ||
            c.city.toLowerCase().includes(departureCity.toLowerCase())
        );
        if (match && match.price) unitPrice = match.price;
      }

      const count = Math.max(1, Number(travelersCount) || 1);
      const calculatedPrice = unitPrice * count;
      const expectedPaidAmount = paymentType === 'full' ? calculatedPrice : 500 * count;
      const expectedAmountInPaise = Math.round(expectedPaidAmount * 100);

      // 4. Verify payment with Razorpay REST API (status, amount, currency, order association)
      const apiCheck = await verifyRazorpayPaymentWithAPI({
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        expectedAmountInPaise,
        expectedCurrency: 'INR',
      });

      if (!apiCheck.isValid) {
        console.error('❌ Razorpay API verification check failed:', apiCheck.error);
        return res.status(400).json({
          success: false,
          error: apiCheck.error || 'Failed to verify payment details with Razorpay',
        });
      }

      // 5. Atomic Seat Availability Check
      const seatCheck = await checkAndReserveSeats(trip.id, selectedDate || '', count);
      if (!seatCheck.allowed) {
        console.warn('⚠️ Seat capacity exceeded during payment confirmation for:', trip.id);
      }

      // Generate Unique Expedition Booking ID
      const prefix = (trip.title || tripTitle || 'EXP')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3) || 'EXP';
      const tripBookingId = `RX-${prefix}-${Math.floor(10000 + Math.random() * 90000)}`;

      // 6. Record verified booking in Supabase
      const confirmedBooking = await saveRazorpayBooking({
        tripBookingId,
        tripId: trip.id,
        tripTitle: trip.title,
        name: name || 'Trekker',
        phone: phone || '',
        email: email || '',
        gender: gender || 'Male',
        dateOfBirth: dateOfBirth || '',
        age: age ? Number(age) : undefined,
        travelersCount: count,
        departureCity: departureCity || 'Dehradun',
        selectedMonth: selectedMonth || '',
        selectedDate: selectedDate || '',
        calculatedPrice,
        paidAmount: expectedPaidAmount,
        paymentStatus: 'Paid',
        paymentMethod: 'Razorpay Checkout',
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        message: message || '',
        status: 'Confirmed',
      });

      console.log('✅ Razorpay payment verified & confirmed in Supabase:', confirmedBooking.tripBookingId);

      return res.status(201).json({
        success: true,
        verified: true,
        data: confirmedBooking,
        message: 'Payment verified and expedition seat officially reserved!',
      });
    } catch (err: any) {
      console.error('❌ Exception in /api/payment/verify:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Payment verification failed',
      });
    }
  });

  /**
   * UTR Submission Flow
   * When a customer submits a UTR, it is recorded with paymentStatus 'Pending Verification'
   * Never automatically marked as 'Verified' or 'Confirmed'.
   * Requires manual administrator verification.
   */
  app.post('/api/inquiries/verify-utr', async (req, res) => {
    try {
      const {
        tripBookingId,
        utrNumber,
        tripId,
        tripTitle,
        name,
        phone,
        email,
        gender,
        dateOfBirth,
        travelersCount,
        departureCity,
        selectedMonth,
        selectedDate,
        calculatedPrice,
        paidAmount,
        message,
      } = req.body;

      if (!utrNumber || typeof utrNumber !== 'string' || utrNumber.trim().length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 12-digit UTR / UPI Transaction Reference Number from your payment receipt.',
        });
      }

      // Check atomic seat availability
      const count = Math.max(1, Number(travelersCount) || 1);
      const seatCheck = await checkAndReserveSeats(tripId || '', selectedDate || '', count);
      if (!seatCheck.allowed) {
        return res.status(409).json({
          success: false,
          error: seatCheck.error || 'The selected departure batch is fully booked.',
        });
      }

      // Save inquiry as Pending Verification (Never automatically confirmed)
      const pendingRecord = await verifyAndSaveUtrInquiry({
        tripBookingId: tripBookingId || `RX-EXP-${Math.floor(10000 + Math.random() * 90000)}`,
        tripId: tripId || 'general',
        tripTitle: tripTitle || 'Expedition',
        name: name || 'Trekker',
        phone: phone || '',
        email: email || '',
        gender: gender || 'Male',
        dateOfBirth: dateOfBirth || '',
        travelersCount: count,
        departureCity: departureCity || 'Basecamp',
        selectedMonth: selectedMonth || '',
        selectedDate: selectedDate || '',
        calculatedPrice: Number(calculatedPrice) || 8499,
        paidAmount: Number(paidAmount) || 500,
        utrNumber: utrNumber.trim(),
        message: message || '',
      });

      res.status(201).json({
        success: true,
        data: pendingRecord,
        verified: false,
        pending: true,
        message:
          'Your UPI UTR reference has been submitted. Our team will manually verify the transaction and confirm your pass within 2 hours.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ====================================================
  // 6. Reviews Endpoints
  // ====================================================
  app.get('/api/reviews', async (req, res) => {
    try {
      const tripId = typeof req.query.tripId === 'string' ? req.query.tripId : undefined;
      const reviews = await getReviews(tripId);
      res.json({ success: true, data: reviews });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const { name, city, rating, comment, title, images, avatar, tripId, tripName } = req.body;
      if (!name || !comment || !rating) {
        return res.status(400).json({ success: false, error: 'Name, comment, and rating are required' });
      }

      const created = await createReview({
        name,
        city,
        rating: Number(rating),
        comment,
        title,
        images,
        avatar,
        tripId,
        tripName,
      });

      const all = await getReviews();
      res.status(201).json({ success: true, data: created, all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Delete Review (Admin Only)
  app.delete('/api/reviews/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteReview(id);
      const all = await getReviews();
      res.json({ success: true, message: 'Review deleted permanently from Supabase', data: all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected: Delete Review Photo (Admin Only)
  app.delete('/api/reviews/:id/images/:imageIndex', requireAdminAuth, async (req, res) => {
    try {
      const { id, imageIndex } = req.params;
      const idx = parseInt(imageIndex, 10);
      if (isNaN(idx)) {
        return res.status(400).json({ success: false, error: 'Invalid image index' });
      }

      const updated = await deleteReviewImage(id, idx);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Review or image not found' });
      }

      res.json({ success: true, data: updated, message: 'Review photo deleted permanently' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ====================================================
  // 7. Gemini AI Expedition Guide Endpoint
  // ====================================================
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history = [], tripContext } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const allTrips = await getTrips();
      const activeTripData = tripContext || allTrips[0] || {};
      const ai = getGeminiClient();

      const systemInstruction = `You are the RoamX Chief AI Expedition Captain & Mountain Guide.
RoamX is India's leading youth trekking and adventure expeditions community (Support & Booking: Chat with Us at +91 6205054837).

Current Active Expedition in View:
- Title: ${activeTripData.title || 'Himalayan Expedition'}
- Tagline: ${activeTripData.tagline || 'Mountain Adventure'}
- Base Location: ${activeTripData.location || 'India'}
- Duration: ${activeTripData.duration || '5 Days'} | Difficulty: ${activeTripData.difficulty || 'Moderate'}
- Base Price: ₹${activeTripData.price?.toLocaleString()}
- Key Highlights: ${(activeTripData.highlights || []).slice(0, 4).join(', ')}

RoamX Highlights & Booking Policies:
- ₹500 Token Deposit: Trekkers can lock their seat with a ₹500 token booking via Razorpay or direct chat.
- 1 Seat per Booking: To ensure fair youth allocation, each booking is limited to 1 seat per transaction.
- Age & Eligibility: Curated for youth aged 18 to 35 years. Separate curated tents/homestay wings for male and female explorers.
- Safety First: WFR & BMC certified mountain leaders, microspikes, gaiters, oxygen cylinders, pulse oximeters, and medical kits.
- Inclusions: Triple/double sharing cozy mountain tents/homestays, all hot mountain meals, permits, transport from pickup hub.
- Support Contact: "Chat with Us" (+91 6205054837).

Tone & Rules:
- Be inspiring, knowledgeable, warm, and safety-conscious like a seasoned Himalayan guide. Supports Hindi, English, and Hinglish.
- Format responses cleanly with concise paragraphs and bullet points for readability.`;

      if (ai) {
        try {
          const contents: any[] = [];
          if (Array.isArray(history)) {
            for (const h of history.slice(-6)) {
              if (h.role && h.text) {
                contents.push({
                  role: h.role === 'user' ? 'user' : 'model',
                  parts: [{ text: h.text }],
                });
              }
            }
          }
          contents.push({
            role: 'user',
            parts: [{ text: message }],
          });

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: { systemInstruction },
          });

          const replyText = response.text || '';
          if (replyText.trim()) {
            return res.json({
              success: true,
              reply: replyText,
              source: 'gemini-ai',
            });
          }
        } catch (geminiError) {
          console.warn('Gemini API call failed, using intelligent fallback:', geminiError);
        }
      }

      // Domain-specific fallback
      const reply = `Hey explorer! 🏔️ Welcome to **RoamX Expeditions**.\n\nFor **${activeTripData.title || 'our expeditions'}**, here is key information:\n- **Duration & Location**: ${activeTripData.duration || 'Multi-day'} at ${activeTripData.location || 'Himalayas'}\n- **Starting Price**: ₹${activeTripData.price?.toLocaleString()} with certified trek leaders and hot mountain meals included.\n- **Instant Seat Reservation**: Lock your batch slot via Razorpay checkout or click 'Chat with Us' on WhatsApp (+91 6205054837).\n- **Eligibility**: Curated for youth aged **18 to 35 years**.`;

      return res.json({
        success: true,
        reply,
        source: 'roamx-knowledge-base',
      });
    } catch (err: any) {
      console.error('Error in /api/ai/chat:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return app;
}
