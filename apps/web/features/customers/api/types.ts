export type AddressLabel = "home" | "work" | "other";

export type CustomerAddress = {
  id: string;
  label: AddressLabel;
  line1: string;
  line2?: string;
  locality: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  /** Manual entry now; map/geocode-ready for website orders later. */
  latitude?: number;
  longitude?: number;
  is_primary: boolean;
};

export type Customer = {
  id: string;
  outlet_id: string;
  name: string;
  /** Unique per outlet. */
  phone: string;
  alternate_phone?: string;
  email?: string;
  tags: string[];
  notes?: string;
  is_active: boolean;
  addresses: CustomerAddress[];
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type CustomerWithDerived = Customer & {
  orders_count: number;
  total_spent_paise: number;
  last_order_at?: string;
  primary_address?: CustomerAddress;
};

export type AddressPayload = Partial<
  Omit<CustomerAddress, "id" | "is_primary">
> & {
  is_primary?: boolean;
};

export type CustomerPayload = Partial<
  Omit<Customer, "id" | "created_at" | "updated_at" | "version" | "deleted_at" | "addresses">
> &
  Pick<Customer, "name" | "phone"> & {
    addresses?: AddressPayload[];
  };

export type CustomerFilters = {
  search?: string;
  tag?: string;
  is_active?: boolean;
  outlet_id?: string;
};
