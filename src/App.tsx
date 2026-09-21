import React, { useState, useEffect } from 'react';
import { AnnouncementStrip, BookingInquiry, DepartureCity, Trip } from './types';
import { TopAnnouncementStrip } from './components/TopAnnouncementStrip';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { TripHighlightsGrid } from './components/TripHighlightsGrid';
import { DepartureCitiesSelector } from './components/DepartureCitiesSelector';
import { VerticalItineraryTimeline } from './components/VerticalItineraryTimeline';
import { GallerySection } from './components/GallerySection';
import { InclusionsExclusions } from './components/InclusionsExclusions';
import { ThingsToCarry } from './components/ThingsToCarry';
import { OtherTripsSection } from './components/OtherTripsSection';
import { ReviewsSection } from './components/ReviewsSection';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal, OWNER_EMAIL } from './components/AdminLoginModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { AIChatModal } from './components/AIChatModal';
import { WhatsAppButton } from './components/WhatsAppButton';
import { WhatsAppIcon } from './components/WhatsAppIcon';
import { MobileStickyBookingBar } from './components/MobileStickyBookingBar';
import { BookingLogo } from './components/BookingLogo';
import { Logo } from './components/Logo';
import {
  Mountain,
  Phone,
  Mail,
  MapPin,
  Heart,
  ShieldCheck,
  Compass,
  Sparkles,
  Lock,
  LogOut,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTripId, setActiveTripId] = useState<string>('');

  const [announcements, setAnnouncements] = useState<AnnouncementStrip[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementStrip | null>(null);

  // Inquiries State (PII protected: populated strictly for authenticated admin)
  const [inquiries, setInquiries] = useState<BookingInquiry[]>([]);
  const [lastSubmittedInquiry, setLastSubmittedInquiry] = useState<BookingInquiry | null>(null);

  // Admin Authentication & Session Token
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('roamx_admin_email') || OWNER_EMAIL;
    } catch {
      return OWNER_EMAIL;
    }
  });

  // Modals & Widgets
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);

  // Helper to obtain authorization header
  const getAuthHeaders = (): Record<string, string> => {
    try {
      const token = localStorage.getItem('roamx_admin_token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  // Derive Hero trip dynamically from database
  const featuredTrip = trips.find(
    (t: any) => t.is_featured === true || t.isFeatured === true
  );
  const defaultHeroTrip =
    featuredTrip ||
    trips.find((t) => t.isLive) ||
    trips.find((t) => t.status === 'published') ||
    trips[0] ||
    null;

  const activeTrip: Trip | null =
    trips.find((t) => t.id === activeTripId) || defaultHeroTrip;

  const [selectedCity, setSelectedCity] = useState<DepartureCity>({
    city: 'Dehradun',
    price: 7499,
  });
  const [selectedBatchDate, setSelectedBatchDate] = useState<string>('');

  // Validate admin token against backend on mount
  useEffect(() => {
    const verifyAdminSession = async () => {
      try {
        const token = localStorage.getItem('roamx_admin_token');
        if (!token) {
          setIsAdminAuthenticated(false);
          return;
        }

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setIsAdminAuthenticated(true);
            setAdminEmail(data.user.email || OWNER_EMAIL);
            // Fetch inquiries securely once admin status is verified
            fetchInquiries(token);
            return;
          }
        }

        // Token invalid or expired
        localStorage.removeItem('roamx_admin_token');
        localStorage.removeItem('roamx_admin_auth');
        setIsAdminAuthenticated(false);
      } catch {
        setIsAdminAuthenticated(false);
      }
    };

    verifyAdminSession();
  }, []);

  const fetchInquiries = async (token?: string) => {
    const authHeaders = token
      ? { Authorization: `Bearer ${token}` }
      : getAuthHeaders();

    if (!authHeaders.Authorization) return;

    try {
      const res = await fetch('/api/inquiries', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setInquiries(data.data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch inquiries:', err);
    }
  };

  // Admin Open Gatekeeper
  const handleOpenAdminTrigger = () => {
    if (isAdminAuthenticated) {
      setIsAdminOpen(true);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleLoginSuccess = (email: string) => {
    setIsAdminAuthenticated(true);
    setAdminEmail(email);
    setIsLoginModalOpen(false);
    setIsAdminOpen(true);
    fetchInquiries();
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('roamx_admin_token');
    localStorage.removeItem('roamx_admin_auth');
    localStorage.removeItem('roamx_admin_email');
    setIsAdminAuthenticated(false);
    setIsAdminOpen(false);
    setInquiries([]);
  };

  // Keyboard shortcut (Ctrl + Shift + A) and URL param detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        handleOpenAdminTrigger();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (typeof window !== 'undefined' && window.location.search.includes('admin=true')) {
      handleOpenAdminTrigger();
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminAuthenticated]);

  // Reset selected city and batch when active trip changes
  useEffect(() => {
    if (activeTrip) {
      if (activeTrip.departureCities && activeTrip.departureCities.length > 0) {
        setSelectedCity(activeTrip.departureCities[0]);
      }
      if (activeTrip.batches && activeTrip.batches.length > 0 && activeTrip.batches[0].dates.length > 0) {
        setSelectedBatchDate(activeTrip.batches[0].dates[0]);
      }
    }
  }, [activeTrip?.id]);

  // Fetch initial data exclusively from Supabase API (Single Source of Truth)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingTrips(true);
      setLoadError(null);
      try {
        const [activeAnnRes, allAnnRes, tripsRes] = await Promise.all([
          fetch('/api/announcements/active').catch(() => null),
          fetch('/api/announcements').catch(() => null),
          fetch('/api/trips').catch(() => null),
        ]);

        if (activeAnnRes && activeAnnRes.ok) {
          const json = await activeAnnRes.json();
          if (json.success) setActiveAnnouncement(json.data);
        }
        if (allAnnRes && allAnnRes.ok) {
          const json = await allAnnRes.json();
          if (json.success && Array.isArray(json.data)) setAnnouncements(json.data);
        }
        if (tripsRes && tripsRes.ok) {
          const json = await tripsRes.json();
          if (json.success && Array.isArray(json.data)) {
            setTrips(json.data);
            if (json.data.length > 0) {
              const featured = json.data.find(
                (t: any) => t.is_featured === true || t.isFeatured === true
              );
              const fallbackHero =
                featured ||
                json.data.find((t: Trip) => t.isLive) ||
                json.data.find((t: Trip) => t.status === 'published') ||
                json.data[0];

              if (fallbackHero) {
                setActiveTripId(fallbackHero.id);
                if (fallbackHero.departureCities?.[0]) {
                  setSelectedCity(fallbackHero.departureCities[0]);
                }
              }
            }
          }
        } else {
          setLoadError('Unable to connect to expeditions database. Please verify your connection.');
        }
      } catch (err: any) {
        console.error('Error fetching expeditions:', err);
        setLoadError(err.message || 'Failed to load expeditions from database');
      } finally {
        setIsLoadingTrips(false);
      }
    };

    fetchData();
  }, []);

  // Admin Action: Toggle Active Banner
  const handleToggleActiveBanner = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}/toggle`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.all || []);
        setActiveAnnouncement(data.data?.is_active || data.data?.isActive ? data.data : null);
      }
    } catch (err) {
      console.error('Failed to toggle banner:', err);
    }
  };

  // Admin Action: Create New Banner
  const handleCreateBanner = async (newBanner: Partial<AnnouncementStrip>) => {
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newBanner),
      });
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.all || []);
        if (newBanner.isActive) {
          setActiveAnnouncement(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to create banner:', err);
    }
  };

  // Admin Action: Delete Banner
  const handleDeleteBanner = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.data || []);
        const nextActive = (data.data || []).find((a: AnnouncementStrip) => a.isActive) || null;
        setActiveAnnouncement(nextActive);
      }
    } catch (err) {
      console.error('Failed to delete banner:', err);
    }
  };

  // Admin Action: Update Trip
  const handleUpdateTrip = async (updatedFields: Partial<Trip>) => {
    if (!activeTrip) return;
    try {
      const res = await fetch(`/api/trips/${activeTrip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatedFields),
      });
      const data = await res.json();
      if (data.success) {
        setTrips((prev) =>
          prev.map((t) => (t.id === activeTrip.id ? { ...t, ...data.data } : t))
        );
        if (data.data.departureCities && data.data.departureCities.length > 0) {
          const matchingCity = data.data.departureCities.find(
            (c: DepartureCity) => c.city === selectedCity.city
          );
          if (matchingCity) {
            setSelectedCity(matchingCity);
          } else {
            setSelectedCity(data.data.departureCities[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to update trip:', err);
    }
  };

  // Admin Action: Set Live / Featured Trip on Homepage
  const handleSetLiveTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/set-live`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.all)) {
        setTrips(data.all);
      }
      setActiveTripId(tripId);
    } catch (err) {
      console.error('Failed to set live trip on backend:', err);
    }
  };

  // Admin Action: Set Hero Image
  const handleSetHeroImage = async (tripId: string, imageUrl: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/hero`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ heroImage: imageUrl }),
      });
      const data = await res.json();
      if (data.success && data.all) {
        setTrips(data.all);
      }
    } catch (err) {
      console.error('Failed to set hero image:', err);
    }
  };

  // Admin Action: Create New Expedition
  const handleCreateTrip = (newTrip: Trip) => {
    setTrips((prev) => {
      const exists = prev.some((t) => t.id === newTrip.id);
      return exists ? prev.map((t) => (t.id === newTrip.id ? newTrip : t)) : [newTrip, ...prev];
    });
    setActiveTripId(newTrip.id);
    if (newTrip.departureCities?.[0]) {
      setSelectedCity(newTrip.departureCities[0]);
    }
    if (newTrip.batches?.[0]?.dates?.[0]) {
      setSelectedBatchDate(newTrip.batches[0].dates[0]);
    }
  };

  // Admin Action: Duplicate Expedition
  const handleDuplicateTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/duplicate`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTrips((prev) => [data.data, ...prev]);
        setActiveTripId(data.data.id);
        if (data.data.departureCities?.[0]) {
          setSelectedCity(data.data.departureCities[0]);
        }
      }
    } catch (err) {
      console.error('Failed to duplicate trip:', err);
    }
  };

  // Admin Action: Delete Expedition
  const handleDeleteTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (data.success) {
        const remainingTrips = (data.data || []).filter((t: Trip) => t.id !== tripId);
        setTrips(remainingTrips);
        if (remainingTrips.length > 0) {
          const nextActive = remainingTrips.find((t: Trip) => t.isLive) || remainingTrips[0];
          setActiveTripId(nextActive.id);
          if (nextActive.departureCities?.[0]) {
            setSelectedCity(nextActive.departureCities[0]);
          }
        } else {
          setActiveTripId('');
        }
      }
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  };

  // Admin Action: Delete Gallery Image
  const handleDeleteGalleryImage = async (imageUrl: string, tripId?: string) => {
    const targetTripId = tripId || activeTrip?.id;
    if (!targetTripId) return;
    try {
      const res = await fetch(`/api/trips/${targetTripId}/gallery`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTrips((prev) => prev.map((t) => (t.id === targetTripId ? { ...t, ...data.data } : t)));
      }
    } catch (err) {
      console.error('Failed to delete gallery image:', err);
    }
  };

  // Admin Action: Upload / Add Image to Gallery or Hero
  const handleUploadImage = async (imageUrl: string, makeHero: boolean) => {
    if (!activeTrip) return;
    try {
      const res = await fetch(`/api/trips/${activeTrip.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ imageUrl, makeHero }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTrips((prev) =>
          prev.map((t) => (t.id === activeTrip.id ? { ...t, ...data.data } : t))
        );
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
    }
  };

  // Inquiry Submission Handler
  const handleInquirySubmitted = (inquiry: BookingInquiry) => {
    setInquiries((prev) => [inquiry, ...prev]);
    setLastSubmittedInquiry(inquiry);
  };

  // Inquiry Status Updater (Admin Only)
  const handleUpdateInquiryStatus = async (id: string, status: BookingInquiry['status']) => {
    try {
      const res = await fetch(`/api/inquiries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success && data.all) {
        setInquiries(data.all);
      }
    } catch (err) {
      console.error('Failed to update inquiry status:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1E293B] antialiased selection:bg-[#FF6B35] selection:text-white overflow-x-hidden w-full max-w-full">
      
      {/* 1. Live Sticky Top Announcement Strip */}
      <TopAnnouncementStrip
        announcement={activeAnnouncement}
        onOpenAdmin={isAdminAuthenticated ? () => setIsAdminOpen(true) : undefined}
        onDismiss={() => setActiveAnnouncement(null)}
      />

      {/* 2. Main Navigation Bar */}
      <Navbar
        trips={trips}
        activeTrip={activeTrip}
        onSelectTrip={(id) => setActiveTripId(id)}
        onOpenAdmin={handleOpenAdminTrigger}
        onOpenAIChat={() => setIsAiChatOpen(true)}
        inquiriesCount={inquiries.length}
        isAdminAuthenticated={isAdminAuthenticated}
        adminEmail={adminEmail}
        onLogout={handleAdminLogout}
      />

      {/* Main Content Area */}
      <main className="w-full max-w-full overflow-hidden">
        {isLoadingTrips ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-white p-8">
            <Loader2 className="w-10 h-10 text-[#004E64] animate-spin" />
            <div className="text-center">
              <h3 className="font-bold text-gray-800 text-lg">Loading RoamX Expeditions...</h3>
              <p className="text-xs text-gray-500 mt-1">Connecting to live database</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-white p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">Database Connection Notice</h3>
            <p className="text-xs text-gray-600 max-w-md">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-bold bg-[#004E64] text-white px-5 py-2.5 rounded-xl hover:bg-[#003b4c] transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : !activeTrip ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-white p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#FF6B35] flex items-center justify-center mx-auto">
              <Compass className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">No Live Expeditions Found</h3>
            <p className="text-xs text-gray-500 max-w-md">
              There are currently no published expeditions in the database. As an administrator, you can log in to create and publish your first expedition.
            </p>
            <button
              onClick={handleOpenAdminTrigger}
              className="mt-2 text-xs font-bold bg-[#FF6B35] text-white px-5 py-2.5 rounded-xl hover:bg-[#e05624] transition-colors"
            >
              Open Admin Portal
            </button>
          </div>
        ) : (
          <div className="bg-white">
            {/* 3. Hero Section with overlay & Floating Sidebar Booking Form */}
            <HeroSection
              trip={activeTrip}
              selectedCity={selectedCity}
              selectedBatchDate={selectedBatchDate}
              onSelectBatchDate={(d) => setSelectedBatchDate(d)}
              onInquirySubmitted={handleInquirySubmitted}
              allTrips={trips}
              onSelectTrip={(id) => setActiveTripId(id)}
            />

            {/* 4. Trip Highlights Grid with live verified booking badges */}
            <TripHighlightsGrid trip={activeTrip} inquiries={inquiries} />

            {/* 5. Interactive Departure Cities Transport Matrix */}
            <DepartureCitiesSelector
              trip={activeTrip}
              selectedCity={selectedCity}
              onSelectCity={(city) => setSelectedCity(city)}
            />

            {/* 6. Comprehensive Day-Wise Himalayan Itinerary Timeline */}
            <VerticalItineraryTimeline trip={activeTrip} />

            {/* 7. High-Resolution Expedition Gallery */}
            <GallerySection trip={activeTrip} />

            {/* 8. Clear Transparency: Inclusions vs Exclusions */}
            <InclusionsExclusions trip={activeTrip} />

            {/* 9. Mountain Gear Checklist: Things to Carry */}
            <ThingsToCarry trip={activeTrip} />

            {/* 10. More Himalayan Expeditions & Adventures */}
            <OtherTripsSection
              trips={trips}
              activeTripId={activeTripId}
              onSelectTrip={(id) => setActiveTripId(id)}
            />

            {/* 11. Verified Trekker Reviews with Star Filter & Modal */}
            <ReviewsSection trip={activeTrip} allTrips={trips} />
          </div>
        )}
      </main>

      {/* 12. Footer with Contact Channels & Brand Credibility */}
      <footer className="bg-[#003443] text-white pt-16 pb-28 md:pb-12 border-t border-[#004E64]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12">
            
            {/* Column 1: Brand & Bio */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Logo size="lg" variant="light" />
              </div>
              <p className="text-xs text-blue-100/80 leading-relaxed">
                India's premier youth adventure community. Handcrafted high-altitude expeditions, certified mountain leaders, hygienic basecamps, and life-changing summit journeys.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-xs px-3 py-1 rounded-full border border-white/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B35]" />
                  <span>BMC / WFR Certified Leaders</span>
                </span>
              </div>
            </div>

            {/* Column 2: Live Expeditions Quick Links */}
            <div>
              <h4 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
                Popular Expeditions
              </h4>
              <ul className="space-y-2.5 text-xs text-blue-100/70">
                {trips.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setActiveTripId(t.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:text-white transition-colors cursor-pointer text-left"
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Trust & Safety Pillars */}
            <div>
              <h4 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
                The RoamX Standard
              </h4>
              <ul className="space-y-2.5 text-xs text-blue-100/70">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"></span>
                  <span>Strict 18 - 35 Youth Age Curation</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"></span>
                  <span>Separate Male & Female Tents</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"></span>
                  <span>Microspikes & Gaiters Included</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"></span>
                  <span>Daily Hot Mountain Buffet Meals</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"></span>
                  <span>₹500 Advance Token Booking Guarantee</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact & WhatsApp Speed Dial */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
                Connect With Basecamp
              </h4>
              <div className="space-y-2 text-xs text-blue-100/80">
                <a
                  href="https://wa.me/916205054837?text=Hi%20RoamX,%20I%20have%20an%20inquiry%20about%20your%20expeditions."
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-white hover:text-emerald-400 transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                  <strong>+91 6205054837 (WhatsApp Support)</strong>
                </a>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-200" />
                  <span>support@roamx.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-200" />
                  <span>Basecamp Sankri / Dehradun Hub, India</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                {isAdminAuthenticated ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAdminOpen(true)}
                      className="text-[11px] font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-500/40 cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Admin Section</span>
                    </button>
                    <button
                      onClick={handleAdminLogout}
                      className="text-[11px] font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 px-2.5 py-1.5 rounded-lg border border-rose-800/40 cursor-pointer transition-colors flex items-center gap-1"
                      title="Log Out Administrator"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="text-[11px] font-semibold bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 cursor-pointer transition-colors flex items-center gap-1.5"
                    title="Restricted access for site owner"
                  >
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>Staff & Owner Login</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          <div className="pt-8 border-t border-gray-700/60 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
            <p>© {new Date().getFullYear()} RoamX Expeditions Private Limited. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs">
              <span>Terms of Service</span>
              <span>Privacy Policy</span>
              <span>Cancellation & Refund</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Action Controls: WhatsApp Speed Dial */}
      {activeTrip && <WhatsAppButton activeTrip={activeTrip} />}

      {/* Gemini AI Expedition Guide Modal */}
      {activeTrip && (
        <AIChatModal
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          activeTrip={activeTrip}
          onSelectTrip={(tripId) => {
            setActiveTripId(tripId);
            setIsAiChatOpen(false);
          }}
        />
      )}

      {/* Admin Login Modal (Restricted access gate) */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Panel Modal */}
      {isAdminOpen && (
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          announcements={announcements}
          onToggleActiveBanner={handleToggleActiveBanner}
          onCreateBanner={handleCreateBanner}
          onDeleteBanner={handleDeleteBanner}
          activeTrip={activeTrip || trips[0] || null}
          allTrips={trips}
          onSelectTrip={(id) => {
            setActiveTripId(id);
            const t = trips.find((item) => item.id === id);
            if (t?.departureCities?.[0]) setSelectedCity(t.departureCities[0]);
          }}
          onSetLiveTrip={handleSetLiveTrip}
          onSetHeroImage={handleSetHeroImage}
          onCreateTrip={handleCreateTrip}
          onUpdateTrip={handleUpdateTrip}
          onDeleteTrip={handleDeleteTrip}
          onDuplicateTrip={handleDuplicateTrip}
          onUploadImage={handleUploadImage}
          onDeleteGalleryImage={handleDeleteGalleryImage}
          inquiries={inquiries}
          onUpdateInquiryStatus={handleUpdateInquiryStatus}
          adminEmail={adminEmail}
          onLogout={handleAdminLogout}
        />
      )}

      {/* Floating Mobile Sticky 'Book Now' Bar */}
      {activeTrip && (
        <MobileStickyBookingBar
          trip={activeTrip}
          selectedCity={selectedCity}
        />
      )}

      {/* Booking Confirmation Modal */}
      <ConfirmationModal
        inquiry={lastSubmittedInquiry}
        onClose={() => setLastSubmittedInquiry(null)}
      />

    </div>
  );
}
