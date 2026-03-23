export interface Trip {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  total_days: number | null;
  total_nights: number | null;
  route_summary: string | null;
  currency: string;
  exchange_rate: number;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: number;
  trip_id: number;
  name: string;
  country: string | null;
  country_flag: string | null;
  checkin_date: string | null;
  checkout_date: string | null;
  nights: number | null;
  latitude: number | null;
  longitude: number | null;
  visit_order: number | null;
  name_en: string | null;
  short_code: string | null;
}

export interface ItineraryItem {
  id: number;
  trip_id: number;
  city_id: number | null;
  day_number: number;
  date: string | null;
  time: string | null;
  spot_name: string;
  category: string | null;
  duration: string | null;
  memo: string | null;
  latitude: number | null;
  longitude: number | null;
  cost_eur: number;
  cost_krw: number;
}

export interface Accommodation {
  id: number;
  trip_id: number;
  city_id: number | null;
  name: string;
  source: string | null;
  tag: string | null;
  star_rating: number | null;
  review_score: number | null;
  review_count: number;
  price_per_night_eur: number | null;
  price_per_night_krw: number | null;
  total_price_eur: number | null;
  total_price_krw: number | null;
  checkin_date: string | null;
  checkout_date: string | null;
  nights: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string | null;
  thumbnail_url: string | null;
  booking_url: string | null;
  cancellation_policy: string | null;
  breakfast_included: number;
  note: string | null;
  is_booked: number;
  booked_at: string | null;
  created_at: string;
  checkin_time: string | null;
  checkout_time: string | null;
}

export interface Transfer {
  id: number;
  trip_id: number;
  from_city_id: number | null;
  to_city_id: number | null;
  date: string | null;
  transport_type: string | null;
  operator: string | null;
  duration: string | null;
  cost_eur: number;
  cost_krw: number;
  booking_url: string | null;
  is_booked: number;
  note: string | null;
}

export interface BudgetItem {
  id: number;
  trip_id: number;
  category: string;
  item_name: string | null;
  cost_eur: number;
  cost_krw: number;
  is_fixed: number;
  note: string | null;
}

// Supabase Database type (simplified)
export interface Database {
  travel: {
    Tables: {
      trips: { Row: Trip; Insert: Partial<Trip>; Update: Partial<Trip> };
      cities: { Row: City; Insert: Partial<City>; Update: Partial<City> };
      itinerary: { Row: ItineraryItem; Insert: Partial<ItineraryItem>; Update: Partial<ItineraryItem> };
      accommodations: { Row: Accommodation; Insert: Partial<Accommodation>; Update: Partial<Accommodation> };
      transfers: { Row: Transfer; Insert: Partial<Transfer>; Update: Partial<Transfer> };
      budget: { Row: BudgetItem; Insert: Partial<BudgetItem>; Update: Partial<BudgetItem> };
    };
  };
}
