import { Injectable } from "@nestjs/common";
import {
  CommerceConnectorCredentials,
  CommerceCustomerData,
  CommerceOrderData,
  CommerceProductData,
  CommerceProvider,
} from "./commerce-provider.interface";

@Injectable()
export class ShopifyCommerceProvider implements CommerceProvider {
  readonly providerName = "shopify" as const;

  async listCustomers(
    credentials: CommerceConnectorCredentials,
  ): Promise<CommerceCustomerData[]> {
    const query = `
      query {
        customers(first: 50) {
          edges {
            node {
              id
              email
              firstName
              lastName
              totalSpent
              ordersCount
              updatedAt
            }
          }
        }
      }
    `;
    const data = await this.graphql(credentials, query);
    return (data.customers?.edges || []).map((edge: any) => ({
      externalId: edge.node.id,
      email: edge.node.email,
      firstName: edge.node.firstName,
      lastName: edge.node.lastName,
      totalSpent: parseFloat(edge.node.totalSpent),
      ordersCount: edge.node.ordersCount,
      lastOrderDate: new Date(edge.node.updatedAt),
      metadata: edge.node,
    }));
  }

  async listOrders(
    credentials: CommerceConnectorCredentials,
  ): Promise<CommerceOrderData[]> {
    const query = `
      query {
        orders(first: 50) {
          edges {
            node {
              id
              name
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              createdAt
              displayFinancialStatus
              customer {
                id
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql(credentials, query);
    return (data.orders?.edges || []).map((edge: any) => ({
      externalId: edge.node.id,
      orderNumber: edge.node.name,
      totalPrice: parseFloat(edge.node.totalPriceSet.shopMoney.amount),
      customerExternalId: edge.node.customer?.id,
      createdAt: new Date(edge.node.createdAt),
      status: edge.node.displayFinancialStatus,
      metadata: edge.node,
    }));
  }

  async listProducts(
    credentials: CommerceConnectorCredentials,
  ): Promise<CommerceProductData[]> {
    const query = `
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              descriptionHtml
              status
              variants(first: 1) {
                edges {
                  node {
                    sku
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql(credentials, query);
    return (data.products?.edges || []).map((edge: any) => ({
      externalId: edge.node.id,
      title: edge.node.title,
      description: edge.node.descriptionHtml,
      status: edge.node.status,
      sku: edge.node.variants?.edges?.[0]?.node?.sku,
      metadata: edge.node,
    }));
  }

  async test(credentials: CommerceConnectorCredentials) {
    const query = `{ shop { name } }`;
    try {
      const data = await this.graphql(credentials, query);
      return { ok: true, storeName: data.shop.name, rawResponse: data };
    } catch (error) {
      return {
        ok: false,
        rawResponse:
          error instanceof Error ? error.message : "Shopify test failed",
      };
    }
  }

  private async graphql(
    credentials: CommerceConnectorCredentials,
    query: string,
  ): Promise<any> {
    const { accessToken, storeName } = credentials;
    const url = `https://${storeName}.myshopify.com/admin/api/2024-01/graphql.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query }),
    });

    const payload = (await response.json()) as { data?: any; errors?: unknown };
    if (!response.ok || payload.errors) {
      const detail = payload.errors
        ? JSON.stringify(payload.errors)
        : await response.text();
      throw new Error(`Shopify GraphQL error: ${response.status} ${detail}`);
    }

    return payload.data;
  }
}
