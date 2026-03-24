export type UserRole = "admin" | "as_staff" | "as_service" | "as_stock" | "se_staff";

export type Database = {
  public: {
    Tables: {
      // ---- AUTH / USER ----
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["user_profiles"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["user_profiles"]["Insert"]
        >;
      };

      // ---- AS MODULE ----
      customers: {
        Row: {
          id: string;
          code: string;
          name: string;
          hospital_type: string | null;
          address: string | null;
          province: string | null;
          phone: string | null;
          email: string | null;
          contact_person: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["customers"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };

      stock_items: {
        Row: {
          id: string;
          code: string;
          name: string;
          category: string | null;
          unit: string | null;
          qty_in_stock: number;
          min_qty: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["stock_items"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["stock_items"]["Insert"]>;
      };

      stock_transactions: {
        Row: {
          id: string;
          stock_item_id: string;
          type: "in" | "out";
          qty: number;
          reference: string | null;
          note: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["stock_transactions"]["Row"],
          "id" | "created_at"
        >;
        Update: never;
      };

      service_requests: {
        Row: {
          id: string;
          ticket_no: string;
          customer_id: string;
          equipment_name: string | null;
          serial_no: string | null;
          issue_description: string;
          status: "open" | "in_progress" | "resolved" | "closed";
          priority: "low" | "medium" | "high" | "urgent";
          assigned_to: string | null;
          resolved_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["service_requests"]["Row"],
          "id" | "ticket_no" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["service_requests"]["Insert"]
        >;
      };

      // ---- SE MODULE ----
      deals: {
        Row: {
          id: string;
          deal_no: string;
          customer_id: string;
          title: string;
          stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
          value: number | null;
          probability: number | null;
          expected_close_date: string | null;
          assigned_to: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["deals"]["Row"],
          "id" | "deal_no" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
      };

      activities: {
        Row: {
          id: string;
          deal_id: string;
          type: "call" | "email" | "meeting" | "demo" | "other";
          subject: string;
          note: string | null;
          activity_date: string;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["activities"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
      };

      followups: {
        Row: {
          id: string;
          deal_id: string | null;
          customer_id: string | null;
          subject: string;
          due_date: string;
          status: "pending" | "done" | "cancelled";
          note: string | null;
          assigned_to: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["followups"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["followups"]["Insert"]>;
      };

      quotations: {
        Row: {
          id: string;
          quotation_no: string;
          deal_id: string | null;
          customer_id: string;
          items: QuotationItem[];
          total_amount: number;
          status: "draft" | "sent" | "approved" | "rejected";
          valid_until: string | null;
          note: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["quotations"]["Row"],
          "id" | "quotation_no" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["quotations"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
  };
};

export type QuotationItem = {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
};

// Convenience types
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type StockItem = Database["public"]["Tables"]["stock_items"]["Row"];
export type StockTransaction = Database["public"]["Tables"]["stock_transactions"]["Row"];
export type ServiceRequest = Database["public"]["Tables"]["service_requests"]["Row"];
export type Deal = Database["public"]["Tables"]["deals"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Followup = Database["public"]["Tables"]["followups"]["Row"];
export type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
