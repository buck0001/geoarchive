import type { Category } from "./photo";

export type PhotoRow = {
  id: string;
  place_id: string;
  contribution_id: string | null;
  user_id: string;
  title: string;
  description: string;
  category: Category;
  image_path: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string;
  location_precision: "exact" | "approximate" | "none";
  visibility: "private" | "public";
  created_at: string;
};

export type ReviewRow = {
  id: string;
  place_id: string;
  contribution_id: string | null;
  photo_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type PlaceRow = {
  id: string;
  created_by: string | null;
  name: string;
  category: Category;
  latitude: number | null;
  longitude: number | null;
  location_name: string;
  description: string;
  visibility: "private" | "public";
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      photos: {
        Row: PhotoRow;
        Insert: {
          id?: string;
          place_id: string;
          contribution_id?: string | null;
          user_id: string;
          title: string;
          description?: string;
          category?: Category;
          image_path: string;
          latitude?: number | null;
          longitude?: number | null;
          location_name?: string;
          location_precision?: "exact" | "approximate" | "none";
          visibility?: "private" | "public";
          created_at?: string;
        };
        Update: {
          place_id?: string;
          title?: string;
          description?: string;
          category?: Category;
          image_path?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_name?: string;
          location_precision?: "exact" | "approximate" | "none";
          visibility?: "private" | "public";
        };
        Relationships: [];
      };
      places: {
        Row: PlaceRow;
        Insert: {
          id?: string;
          created_by?: string | null;
          name: string;
          category?: Category;
          latitude?: number | null;
          longitude?: number | null;
          location_name?: string;
          description?: string;
          visibility?: "private" | "public";
          created_at?: string;
        };
        Update: {
          name?: string;
          category?: Category;
          latitude?: number | null;
          longitude?: number | null;
          location_name?: string;
          description?: string;
          visibility?: "private" | "public";
        };
        Relationships: [];
      };
      contributions: {
        Row: {
          id: string;
          place_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          place_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      account_contacts: {
        Row: {
          user_id: string;
          email: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email?: string | null;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: ReviewRow;
        Insert: {
          id?: string;
          place_id: string;
          contribution_id?: string | null;
          photo_id?: string | null;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          place_id?: string;
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      nearby_photos: {
        Args: {
          center_latitude: number;
          center_longitude: number;
          radius_meters: number;
        };
        Returns: PhotoRow[];
      };
      nearby_places: {
        Args: {
          center_latitude: number;
          center_longitude: number;
          radius_meters: number;
        };
        Returns: PlaceRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
