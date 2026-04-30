export interface CommerceConnectorCredentials {
  accessToken: string;
  storeName: string; // e.g., 'my-cool-store'
}

export interface CommerceCustomerData {
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  totalSpent?: number;
  ordersCount?: number;
  lastOrderDate?: Date;
  metadata?: any;
}

export interface CommerceOrderData {
  externalId: string;
  orderNumber: string;
  totalPrice: number;
  customerExternalId: string;
  createdAt: Date;
  status: string;
  metadata?: any;
}

export interface CommerceProductData {
  externalId: string;
  title: string;
  description?: string;
  status: string;
  sku?: string;
  metadata?: any;
}

export interface CommerceProvider {
  readonly providerName: string;
  listCustomers(credentials: CommerceConnectorCredentials): Promise<CommerceCustomerData[]>;
  listOrders(credentials: CommerceConnectorCredentials): Promise<CommerceOrderData[]>;
  listProducts(credentials: CommerceConnectorCredentials): Promise<CommerceProductData[]>;
  test(credentials: CommerceConnectorCredentials): Promise<{ ok: boolean; storeName?: string; rawResponse?: any }>;
}
