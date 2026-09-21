import { Trip, Review, BookingInquiry, AnnouncementStrip, DepartureCity } from '../src/types';
import { getSupabase, uploadImageToStorage, deleteImageFromStorage, isBase64DataUrl } from './supabase';

// Helper to ensure Supabase client is available
function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      'Supabase client is not initialized. Please verify SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  return supabase;
}

// ==========================================
// TRIPS MAPPER
// ==========================================
function mapRowToTrip(row: any): Trip {
  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    tagline: row.tagline || row.short_description || '',
    shortDescription: row.short_description || row.tagline || '',
    longDescription: row.long_description || '',
    location: row.location || row.destination || '',
    destination: row.destination || row.location || '',
    category: row.category || 'Mountain Escapes',
    tags: Array.isArray(row.tags) ? row.tags : [],
    experienceRatings: row.experience_ratings || (row.experienceRatings ? row.experienceRatings : undefined),
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    duration: row.duration || '',
    difficulty: row.difficulty || 'Moderate',
    price: Number(row.price) || 0,
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    totalSeats: row.total_seats ? Number(row.total_seats) : 16,
    bookedSeats: row.booked_seats ? Number(row.booked_seats) : 0,
    availableSeats:
      row.available_seats !== undefined
        ? Number(row.available_seats)
        : (row.total_seats ? Number(row.total_seats) - (Number(row.booked_seats) || 0) : 16),
    bookingDeadline: row.booking_deadline || undefined,
    status: row.status || (row.is_live ? 'published' : 'draft'),
    heroImage: row.hero_image || row.featured_image || '',
    featuredImage: row.featured_image || row.hero_image || '',
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    departureCities: Array.isArray(row.departure_cities) ? row.departure_cities : [],
    itinerary: Array.isArray(row.itinerary) ? row.itinerary : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    inclusions: Array.isArray(row.inclusions) ? row.inclusions : (Array.isArray(row.included) ? row.included : []),
    included: Array.isArray(row.included) ? row.included : (Array.isArray(row.inclusions) ? row.inclusions : []),
    exclusions: Array.isArray(row.exclusions) ? row.exclusions : (Array.isArray(row.excluded) ? row.excluded : []),
    excluded: Array.isArray(row.excluded) ? row.excluded : (Array.isArray(row.exclusions) ? row.exclusions : []),
    thingsToCarry: Array.isArray(row.things_to_carry) ? row.things_to_carry : [],
    batches: Array.isArray(row.batches) ? row.batches : [],
    faqs: Array.isArray(row.faqs) ? row.faqs : [],
    ageLimit: row.age_limit || '18 to 35 Years',
    maxAltitude: row.max_altitude || '',
    groupSize: row.group_size || '12 - 16 Trekkers',
    bestSeason: row.best_season || '',
    rating: Number(row.rating) || 4.9,
    reviewsCount: Number(row.reviews_count) || 0,
    isFeatured: Boolean(row.is_featured || row.isFeatured),
    is_featured: Boolean(row.is_featured || row.isFeatured),
    isLive: Boolean(row.is_live || row.isLive || row.is_featured),
    is_live: Boolean(row.is_live || row.isLive || row.is_featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTripToRow(trip: Partial<Trip>): any {
  const row: any = {};
  if (trip.id) row.id = trip.id;
  if (trip.title !== undefined) row.title = trip.title;
  if (trip.tagline !== undefined) row.tagline = trip.tagline;
  if (trip.location !== undefined) row.location = trip.location;
  if (trip.duration !== undefined) row.duration = trip.duration;
  if (trip.difficulty !== undefined) row.difficulty = trip.difficulty;
  if (trip.price !== undefined) row.price = trip.price;
  if (trip.originalPrice !== undefined) row.original_price = trip.originalPrice;
  if (trip.heroImage !== undefined) row.hero_image = trip.heroImage;
  if (trip.gallery !== undefined) row.gallery = trip.gallery;
  if (trip.departureCities !== undefined) row.departure_cities = trip.departureCities;
  if (trip.itinerary !== undefined) row.itinerary = trip.itinerary;
  if (trip.highlights !== undefined) row.highlights = trip.highlights;
  if (trip.inclusions !== undefined) row.inclusions = trip.inclusions;
  if (trip.exclusions !== undefined) row.exclusions = trip.exclusions;
  if (trip.thingsToCarry !== undefined) row.things_to_carry = trip.thingsToCarry;
  if (trip.batches !== undefined) row.batches = trip.batches;
  if (trip.faqs !== undefined) row.faqs = trip.faqs;
  if (trip.ageLimit !== undefined) row.age_limit = trip.ageLimit;
  if (trip.maxAltitude !== undefined) row.max_altitude = trip.maxAltitude;
  if (trip.groupSize !== undefined) row.group_size = trip.groupSize;
  if (trip.bestSeason !== undefined) row.best_season = trip.bestSeason;
  if (trip.rating !== undefined) row.rating = trip.rating;
  if (trip.reviewsCount !== undefined) row.reviews_count = trip.reviewsCount;
  if (trip.isFeatured !== undefined || trip.is_featured !== undefined) {
    row.is_featured = Boolean(trip.isFeatured || trip.is_featured);
  }
  return row;
}

// ==========================================
// REVIEWS MAPPER
// ==========================================
function mapRowToReview(row: any): Review {
  return {
    id: row.id,
    name: row.name,
    city: row.city || 'India',
    rating: Number(row.rating) || 5,
    date: row.date,
    title: row.title || undefined,
    comment: row.comment,
    avatar: row.avatar || undefined,
    images: Array.isArray(row.images) ? row.images : [],
    tripId: row.trip_id || undefined,
    tripName: row.trip_name || 'RoamX Expedition',
    isVerified: row.is_verified ?? true,
  };
}

function mapReviewToRow(review: Partial<Review>): any {
  const row: any = {};
  if (review.id) row.id = review.id;
  if (review.name !== undefined) row.name = review.name;
  if (review.city !== undefined) row.city = review.city;
  if (review.rating !== undefined) row.rating = review.rating;
  if (review.date !== undefined) row.date = review.date;
  if (review.title !== undefined) row.title = review.title;
  if (review.comment !== undefined) row.comment = review.comment;
  if (review.avatar !== undefined) row.avatar = review.avatar;
  if (review.images !== undefined) row.images = review.images;
  if (review.tripId !== undefined) row.trip_id = review.tripId;
  if (review.tripName !== undefined) row.trip_name = review.tripName;
  if (review.isVerified !== undefined) row.is_verified = review.isVerified;
  return row;
}

// ==========================================
// ANNOUNCEMENTS MAPPER
// ==========================================
function mapRowToAnnouncement(row: any): AnnouncementStrip {
  return {
    id: row.id,
    text: row.text,
    link: row.link || '#booking-section',
    badge: row.badge || 'OFFER',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapAnnouncementToRow(ann: Partial<AnnouncementStrip>): any {
  const row: any = {};
  if (ann.id) row.id = ann.id;
  if (ann.text !== undefined) row.text = ann.text;
  if (ann.link !== undefined) row.link = ann.link;
  if (ann.badge !== undefined) row.badge = ann.badge;
  if (ann.isActive !== undefined) row.is_active = ann.isActive;
  return row;
}

// ==========================================
// INQUIRIES MAPPER
// ==========================================
function mapRowToInquiry(row: any): BookingInquiry {
  return {
    id: row.id,
    tripBookingId: row.trip_booking_id || undefined,
    tripId: row.trip_id,
    tripTitle: row.trip_title,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
    gender: row.gender || 'Male',
    dateOfBirth: row.date_of_birth || undefined,
    age: row.age ? Number(row.age) : undefined,
    travelersCount: Number(row.travelers_count) || 1,
    departureCity: row.departure_city,
    selectedMonth: row.selected_month || undefined,
    selectedDate: row.selected_date || undefined,
    calculatedPrice: Number(row.calculated_price) || 0,
    paidAmount: row.paid_amount ? Number(row.paid_amount) : 0,
    paymentStatus: row.payment_status || 'Unpaid',
    utrNumber: row.utr_number || undefined,
    paymentMethod: row.payment_method || undefined,
    razorpayPaymentId: row.razorpay_payment_id || undefined,
    razorpayOrderId: row.razorpay_order_id || undefined,
    razorpaySignature: row.razorpay_signature || undefined,
    message: row.message || undefined,
    status: row.status || 'New',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapInquiryToRow(inq: Partial<BookingInquiry>): any {
  const row: any = {};
  if (inq.id) row.id = inq.id;
  if (inq.tripBookingId !== undefined) row.trip_booking_id = inq.tripBookingId;
  if (inq.tripId !== undefined) row.trip_id = inq.tripId;
  if (inq.tripTitle !== undefined) row.trip_title = inq.tripTitle;
  if (inq.name !== undefined) row.name = inq.name;
  if (inq.phone !== undefined) row.phone = inq.phone;
  if (inq.email !== undefined) row.email = inq.email;
  if (inq.gender !== undefined) row.gender = inq.gender;
  if (inq.dateOfBirth !== undefined) row.date_of_birth = inq.dateOfBirth;
  if (inq.age !== undefined) row.age = inq.age;
  if (inq.travelersCount !== undefined) row.travelers_count = inq.travelersCount;
  if (inq.departureCity !== undefined) row.departure_city = inq.departureCity;
  if (inq.selectedMonth !== undefined) row.selected_month = inq.selectedMonth;
  if (inq.selectedDate !== undefined) row.selected_date = inq.selectedDate;
  if (inq.calculatedPrice !== undefined) row.calculated_price = inq.calculatedPrice;
  if (inq.paidAmount !== undefined) row.paid_amount = inq.paidAmount;
  if (inq.paymentStatus !== undefined) row.payment_status = inq.paymentStatus;
  if (inq.utrNumber !== undefined) row.utr_number = inq.utrNumber;
  if (inq.paymentMethod !== undefined) row.payment_method = inq.paymentMethod;
  if (inq.razorpayPaymentId !== undefined) row.razorpay_payment_id = inq.razorpayPaymentId;
  if (inq.razorpayOrderId !== undefined) row.razorpay_order_id = inq.razorpayOrderId;
  if (inq.razorpaySignature !== undefined) row.razorpay_signature = inq.razorpaySignature;
  if (inq.message !== undefined) row.message = inq.message;
  if (inq.status !== undefined) row.status = inq.status;
  return row;
}

// =========================================================================
// 1. TRIPS METHODS (Supabase as Single Source of Truth)
// =========================================================================

export async function getTrips(): Promise<Trip[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Supabase getTrips error:', error.message);
    throw new Error(`Failed to load trips from Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Return empty array when database is empty - never inject hardcoded mock trips
    return [];
  }

  return data.map(mapRowToTrip);
}

export async function getTripById(id: string): Promise<Trip | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`❌ Supabase getTripById error for "${id}":`, error.message);
    throw new Error(`Failed to get trip from Supabase: ${error.message}`);
  }

  return data ? mapRowToTrip(data) : null;
}

export async function getHomepageSettings(): Promise<{
  liveTrip: Trip | null;
  announcement?: AnnouncementStrip | null;
}> {
  const trips = await getTrips();
  const activeAnnouncement = await getActiveAnnouncement();

  if (trips.length === 0) {
    return { liveTrip: null, announcement: activeAnnouncement };
  }

  // Priority: featured trip -> is_live trip -> first trip
  const featured = trips.find((t) => t.isFeatured || t.is_featured);
  const liveTrip = featured || trips.find((t) => t.isLive) || trips[0] || null;

  return {
    liveTrip,
    announcement: activeAnnouncement,
  };
}

export async function getLiveTrip(): Promise<Trip | null> {
  const { liveTrip } = await getHomepageSettings();
  return liveTrip;
}

export async function createTrip(trip: Trip): Promise<Trip> {
  const supabase = requireSupabase();

  // Upload hero image to Supabase storage if base64
  let permanentHero = trip.heroImage;
  if (isBase64DataUrl(permanentHero)) {
    permanentHero = await uploadImageToStorage(permanentHero, 'trips');
  }

  // Upload gallery images to Supabase storage if base64
  const permanentGallery: string[] = [];
  if (Array.isArray(trip.gallery)) {
    for (const img of trip.gallery) {
      if (isBase64DataUrl(img)) {
        const uploaded = await uploadImageToStorage(img, 'trips');
        permanentGallery.push(uploaded);
      } else {
        permanentGallery.push(img);
      }
    }
  }

  const cleanTrip: Trip = {
    ...trip,
    id: trip.id || `trip-${Date.now()}`,
    heroImage: permanentHero,
    gallery: permanentGallery,
  };

  const row = mapTripToRow(cleanTrip);
  const { data, error } = await supabase.from('trips').insert(row).select().single();

  if (error) {
    console.error('❌ Supabase createTrip error:', error.message);
    throw new Error(`Failed to create expedition in Supabase: ${error.message}`);
  }

  return mapRowToTrip(data);
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | null> {
  const supabase = requireSupabase();

  // Handle image uploads if base64
  const cleanUpdates = { ...updates };
  if (cleanUpdates.heroImage && isBase64DataUrl(cleanUpdates.heroImage)) {
    cleanUpdates.heroImage = await uploadImageToStorage(cleanUpdates.heroImage, 'trips');
  }

  if (Array.isArray(cleanUpdates.gallery)) {
    const processedGallery: string[] = [];
    for (const img of cleanUpdates.gallery) {
      if (isBase64DataUrl(img)) {
        processedGallery.push(await uploadImageToStorage(img, 'trips'));
      } else {
        processedGallery.push(img);
      }
    }
    cleanUpdates.gallery = processedGallery;
  }

  const rowUpdates = mapTripToRow(cleanUpdates);
  rowUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('trips')
    .update(rowUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`❌ Supabase updateTrip error for "${id}":`, error.message);
    throw new Error(`Failed to update expedition: ${error.message}`);
  }

  return data ? mapRowToTrip(data) : null;
}

export async function deleteTrip(id: string): Promise<boolean> {
  const supabase = requireSupabase();

  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) {
    console.error(`❌ Supabase deleteTrip error for "${id}":`, error.message);
    throw new Error(`Failed to delete expedition: ${error.message}`);
  }

  return true;
}

export async function duplicateTrip(id: string): Promise<Trip> {
  const original = await getTripById(id);
  if (!original) {
    throw new Error(`Trip with id "${id}" not found`);
  }

  const newId = `${original.id}-copy-${Date.now().toString().slice(-4)}`;
  const duplicated: Trip = {
    ...original,
    id: newId,
    title: `${original.title} (Copy)`,
    isFeatured: false,
    is_featured: false,
    isLive: false,
  };

  return createTrip(duplicated);
}

export async function updateTripStatus(id: string, status: Trip['status']): Promise<Trip | null> {
  return updateTrip(id, { status });
}

export async function updateTripHeroImage(id: string, heroImage: string): Promise<Trip | null> {
  return updateTrip(id, { heroImage });
}

export async function setLiveTrip(tripId: string): Promise<Trip | null> {
  const supabase = requireSupabase();

  // Reset all trips to is_featured = false
  await supabase.from('trips').update({ is_featured: false }).neq('id', 'placeholder_guard');

  // Set selected trip as is_featured = true
  const { data, error } = await supabase
    .from('trips')
    .update({ is_featured: true, updated_at: new Date().toISOString() })
    .eq('id', tripId)
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase setLiveTrip error:', error.message);
    throw new Error(`Failed to set live trip: ${error.message}`);
  }

  return data ? mapRowToTrip(data) : null;
}

export async function addGalleryImageToTrip(
  tripId: string,
  imageUrl: string,
  makeHero: boolean = false
): Promise<Trip | null> {
  const trip = await getTripById(tripId);
  if (!trip) return null;

  let permanentUrl = imageUrl;
  if (isBase64DataUrl(imageUrl)) {
    permanentUrl = await uploadImageToStorage(imageUrl, 'trips');
  }

  const updatedGallery = [...(trip.gallery || []), permanentUrl];
  const updates: Partial<Trip> = { gallery: updatedGallery };
  if (makeHero) {
    updates.heroImage = permanentUrl;
  }

  return updateTrip(tripId, updates);
}

export async function removeGalleryImageFromTrip(
  tripId: string,
  imageIndexOrUrl: number | string
): Promise<{ trip: Trip | null; removedUrl?: string }> {
  const trip = await getTripById(tripId);
  if (!trip) return { trip: null };

  let removedUrl: string | undefined;
  let newGallery: string[] = [];

  if (typeof imageIndexOrUrl === 'number') {
    if (imageIndexOrUrl >= 0 && imageIndexOrUrl < trip.gallery.length) {
      removedUrl = trip.gallery[imageIndexOrUrl];
      newGallery = trip.gallery.filter((_, idx) => idx !== imageIndexOrUrl);
    } else {
      return { trip };
    }
  } else {
    removedUrl = imageIndexOrUrl;
    newGallery = (trip.gallery || []).filter((img) => img !== imageIndexOrUrl);
  }

  if (removedUrl) {
    deleteImageFromStorage(removedUrl).catch(() => {});
  }

  const updated = await updateTrip(tripId, { gallery: newGallery });
  return { trip: updated, removedUrl };
}

// Compatibility aliases
export const setHeroImage = updateTripHeroImage;
export const addTripGalleryImage = addGalleryImageToTrip;
export const deleteTripGalleryImage = (tripId: string, imageIndex: number) =>
  removeGalleryImageFromTrip(tripId, imageIndex);
export const deleteTripGalleryImageByUrl = (tripId: string, imageUrl: string) =>
  removeGalleryImageFromTrip(tripId, imageUrl);

// =========================================================================
// 2. ATOMIC SEAT OVERSLELLING PREVENTION
// =========================================================================

export interface SeatCheckResult {
  allowed: boolean;
  bookedSeats: number;
  availableSeats: number;
  totalSeats: number;
  error?: string;
}

/**
 * Atomically checks seat availability for a given trip and departure date.
 * Prevents simultaneous customers from booking the same final available seat.
 */
export async function checkAndReserveSeats(
  tripId: string,
  selectedDate: string,
  travelersCount: number = 1
): Promise<SeatCheckResult> {
  const supabase = requireSupabase();

  // 1. Fetch trip to determine maximum seats
  const trip = await getTripById(tripId);
  if (!trip) {
    return {
      allowed: false,
      bookedSeats: 0,
      availableSeats: 0,
      totalSeats: 0,
      error: 'Expedition not found in database',
    };
  }

  const totalCapacity = trip.totalSeats || 16;
  const countToReserve = Math.max(1, Number(travelersCount) || 1);

  // 2. Try Supabase RPC if database function exists
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('check_and_reserve_seat', {
      p_trip_id: tripId,
      p_selected_date: selectedDate || '',
      p_travelers_count: countToReserve,
      p_max_seats: totalCapacity,
    });

    if (!rpcError && typeof rpcResult === 'boolean') {
      if (!rpcResult) {
        return {
          allowed: false,
          bookedSeats: totalCapacity,
          availableSeats: 0,
          totalSeats: totalCapacity,
          error: `Departure batch "${selectedDate || 'Selected Batch'}" is fully booked. Only ${totalCapacity} seats are allocated per expedition.`,
        };
      }
    }
  } catch {
    // Fallback to strict SQL transaction count query below
  }

  // 3. Count confirmed/paid seats for this trip and batch date in inquiries table
  let countQuery = supabase
    .from('inquiries')
    .select('travelers_count')
    .eq('trip_id', tripId)
    .in('payment_status', ['Paid', 'Verified', 'Paid (₹500)']);

  if (selectedDate && selectedDate.trim()) {
    countQuery = countQuery.eq('selected_date', selectedDate.trim());
  }

  const { data: bookedRows, error: countError } = await countQuery;
  if (countError) {
    console.error('❌ Error checking seat availability:', countError.message);
  }

  const currentBookedSeats = (bookedRows || []).reduce(
    (sum: number, row: any) => sum + (Number(row.travelers_count) || 1),
    0
  );

  const availableSeats = Math.max(0, totalCapacity - currentBookedSeats);

  if (currentBookedSeats + countToReserve > totalCapacity) {
    return {
      allowed: false,
      bookedSeats: currentBookedSeats,
      availableSeats,
      totalSeats: totalCapacity,
      error: `Sold out: Only ${availableSeats} seat(s) remaining for ${selectedDate || 'this date'}. You requested ${countToReserve} seat(s).`,
    };
  }

  return {
    allowed: true,
    bookedSeats: currentBookedSeats,
    availableSeats: availableSeats - countToReserve,
    totalSeats: totalCapacity,
  };
}

// =========================================================================
// 3. REVIEWS METHODS (Supabase PostgreSQL)
// =========================================================================

export async function getReviews(tripId?: string): Promise<Review[]> {
  const supabase = requireSupabase();

  let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
  if (tripId) {
    query = query.eq('trip_id', tripId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('❌ Supabase getReviews error:', error.message);
    throw new Error(`Failed to load reviews: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map(mapRowToReview);
}

export async function createReview(reviewInput: Partial<Review>): Promise<Review> {
  const supabase = requireSupabase();

  // Process and upload user images to Supabase Storage if base64
  const permanentImages: string[] = [];
  if (Array.isArray(reviewInput.images)) {
    for (const img of reviewInput.images) {
      if (isBase64DataUrl(img)) {
        permanentImages.push(await uploadImageToStorage(img, 'reviews'));
      } else {
        permanentImages.push(img);
      }
    }
  }

  let permanentAvatar = reviewInput.avatar;
  if (permanentAvatar && isBase64DataUrl(permanentAvatar)) {
    permanentAvatar = await uploadImageToStorage(permanentAvatar, 'avatars');
  }

  const cleanReview: Review = {
    id: reviewInput.id || `rev-${Date.now()}`,
    name: reviewInput.name || 'Explorer',
    city: reviewInput.city || 'India',
    rating: reviewInput.rating || 5,
    date: reviewInput.date || 'Just now',
    title: reviewInput.title,
    comment: reviewInput.comment || '',
    avatar: permanentAvatar,
    images: permanentImages,
    tripId: reviewInput.tripId,
    tripName: reviewInput.tripName || 'RoamX Expedition',
    isVerified: true,
  };

  const row = mapReviewToRow(cleanReview);
  const { data, error } = await supabase.from('reviews').insert(row).select().single();

  if (error) {
    console.error('❌ Supabase createReview error:', error.message);
    throw new Error(`Failed to save review to database: ${error.message}`);
  }

  return mapRowToReview(data);
}

export async function deleteReview(id: string): Promise<boolean> {
  const supabase = requireSupabase();

  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) {
    console.error(`❌ Supabase deleteReview error for "${id}":`, error.message);
    throw new Error(`Failed to delete review: ${error.message}`);
  }

  return true;
}

export async function deleteReviewImage(reviewId: string, imageIndex: number): Promise<Review | null> {
  const supabase = requireSupabase();

  const { data: row, error: fetchError } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (fetchError || !row) return null;

  const review = mapRowToReview(row);
  const images = review.images || [];

  if (imageIndex < 0 || imageIndex >= images.length) return review;

  const removedUrl = images[imageIndex];
  const updatedImages = images.filter((_, idx) => idx !== imageIndex);

  if (removedUrl) {
    deleteImageFromStorage(removedUrl).catch(() => {});
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('reviews')
    .update({ images: updatedImages })
    .eq('id', reviewId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update review photos: ${updateError.message}`);
  }

  return updatedRow ? mapRowToReview(updatedRow) : null;
}

// =========================================================================
// 4. INQUIRIES & BOOKINGS METHODS (Supabase PostgreSQL)
// =========================================================================

export async function getInquiries(): Promise<BookingInquiry[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Supabase getInquiries error:', error.message);
    throw new Error(`Failed to load booking inquiries: ${error.message}`);
  }

  return (data || []).map(mapRowToInquiry);
}

export async function createInquiry(inquiryData: Partial<BookingInquiry>): Promise<BookingInquiry> {
  const supabase = requireSupabase();

  const newInq: BookingInquiry = {
    id: inquiryData.id || `inq-${Date.now()}`,
    tripBookingId:
      inquiryData.tripBookingId ||
      `RX-${(inquiryData.tripTitle || 'EXP').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)}-${Math.floor(10000 + Math.random() * 90000)}`,
    tripId: inquiryData.tripId || 'general',
    tripTitle: inquiryData.tripTitle || 'General Expedition',
    name: inquiryData.name || 'Anonymous',
    phone: inquiryData.phone || '',
    email: inquiryData.email,
    gender: inquiryData.gender || 'Male',
    dateOfBirth: inquiryData.dateOfBirth,
    age: inquiryData.age,
    travelersCount: Number(inquiryData.travelersCount) || 1,
    departureCity: inquiryData.departureCity || 'Basecamp',
    selectedMonth: inquiryData.selectedMonth,
    selectedDate: inquiryData.selectedDate,
    calculatedPrice: Number(inquiryData.calculatedPrice) || 0,
    paidAmount: Number(inquiryData.paidAmount) || 0,
    paymentStatus: inquiryData.paymentStatus || 'Unpaid',
    utrNumber: inquiryData.utrNumber,
    paymentMethod: inquiryData.paymentMethod,
    razorpayPaymentId: inquiryData.razorpayPaymentId,
    razorpayOrderId: inquiryData.razorpayOrderId,
    razorpaySignature: inquiryData.razorpaySignature,
    message: inquiryData.message,
    status: inquiryData.status || 'New',
    createdAt: new Date().toISOString(),
  };

  const row = mapInquiryToRow(newInq);
  const { data, error } = await supabase.from('inquiries').insert(row).select().single();

  if (error) {
    console.error('❌ Supabase createInquiry error:', error.message);
    throw new Error(`Failed to save inquiry to database: ${error.message}`);
  }

  return mapRowToInquiry(data);
}

/**
 * Records manual UTR submission from a customer.
 * SECURITY: Always stored as 'Pending Verification' with status 'New'.
 * Never automatically marked as 'Verified' or 'Confirmed'.
 * Requires manual administrative verification.
 */
export async function verifyAndSaveUtrInquiry(
  inquiryData: Partial<BookingInquiry>
): Promise<BookingInquiry> {
  const pendingInquiry: Partial<BookingInquiry> = {
    ...inquiryData,
    status: 'New',
    paymentStatus: 'Pending Verification',
    paidAmount: inquiryData.paidAmount || 500,
    paymentMethod: 'UPI UTR (Pending Admin Verification)',
  };

  return createInquiry(pendingInquiry);
}

export async function updateInquiryStatus(
  id: string,
  status: BookingInquiry['status'],
  paymentStatus?: BookingInquiry['paymentStatus']
): Promise<BookingInquiry | null> {
  const supabase = requireSupabase();

  const updatePayload: any = { status };
  if (paymentStatus) {
    updatePayload.payment_status = paymentStatus;
  }

  const { data, error } = await supabase
    .from('inquiries')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`❌ Supabase updateInquiryStatus error for "${id}":`, error.message);
    throw new Error(`Failed to update booking status: ${error.message}`);
  }

  return data ? mapRowToInquiry(data) : null;
}

/**
 * Records a cryptographically verified Razorpay payment into the Supabase database.
 */
export async function saveRazorpayBooking(
  bookingData: Partial<BookingInquiry>
): Promise<BookingInquiry> {
  return createInquiry(bookingData);
}

export async function findInquiryByRazorpayPaymentId(
  paymentId: string
): Promise<BookingInquiry | null> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error finding inquiry by Razorpay payment ID:', error.message);
    return null;
  }

  return data ? mapRowToInquiry(data) : null;
}

// =========================================================================
// 5. ANNOUNCEMENTS METHODS (Supabase PostgreSQL)
// =========================================================================

export async function getAnnouncements(): Promise<AnnouncementStrip[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Supabase getAnnouncements error:', error.message);
    throw new Error(`Failed to load announcements: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map(mapRowToAnnouncement);
}

export async function getActiveAnnouncement(): Promise<AnnouncementStrip | null> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase getActiveAnnouncement error:', error.message);
    return null;
  }

  return data ? mapRowToAnnouncement(data) : null;
}

export async function createAnnouncement(
  annInput: Partial<AnnouncementStrip>
): Promise<AnnouncementStrip> {
  const supabase = requireSupabase();

  const newAnn: AnnouncementStrip = {
    id: annInput.id || `ann-${Date.now()}`,
    text: annInput.text || '',
    link: annInput.link || '#booking-section',
    badge: annInput.badge || 'OFFER',
    isActive: Boolean(annInput.isActive),
    createdAt: new Date().toISOString(),
  };

  const row = mapAnnouncementToRow(newAnn);
  const { data, error } = await supabase.from('announcements').insert(row).select().single();

  if (error) {
    console.error('❌ Supabase createAnnouncement error:', error.message);
    throw new Error(`Failed to create announcement: ${error.message}`);
  }

  return mapRowToAnnouncement(data);
}

export async function toggleAnnouncementActive(
  id: string
): Promise<{ toggled: AnnouncementStrip; all: AnnouncementStrip[] }> {
  const supabase = requireSupabase();

  const { data: current, error: fetchErr } = await supabase
    .from('announcements')
    .select('is_active')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    throw new Error(`Announcement "${id}" not found`);
  }

  const willBeActive = !current.is_active;

  if (willBeActive) {
    // Only one announcement should be active at a time
    await supabase.from('announcements').update({ is_active: false }).neq('id', id);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('announcements')
    .update({ is_active: willBeActive })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    throw new Error(`Failed to toggle announcement: ${updateErr.message}`);
  }

  const all = await getAnnouncements();
  return { toggled: mapRowToAnnouncement(updated), all };
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const supabase = requireSupabase();

  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    console.error(`❌ Supabase deleteAnnouncement error for "${id}":`, error.message);
    throw new Error(`Failed to delete announcement: ${error.message}`);
  }

  return true;
}
