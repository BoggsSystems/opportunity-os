import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ActivityType,
  CapabilityExecutionStatus,
  CapabilityType,
  ConnectorStatus,
  Prisma,
  prisma,
} from "@opportunity-os/db";
import { createHash, randomBytes } from "crypto";
import { SetupEmailConnectorDto } from "./dto/setup-email-connector.dto";
import { SetupStorageConnectorDto } from "./dto/setup-storage-connector.dto";
import { SetupCalendarConnectorDto } from "./dto/setup-calendar-connector.dto";
import {
  EmailProvider,
  EmailSendInput,
  SyncedEmailMessage,
} from "./email/email-provider.interface";
import { GmailEmailProvider } from "./email/gmail-email.provider";
import { OutlookEmailProvider } from "./email/outlook-email.provider";
import { GoogleDriveProvider } from "./storage/google-drive.provider";
import { OneDriveProvider } from "./storage/onedrive.provider";
import { DropboxProvider } from "./storage/dropbox.provider";
import { StorageProvider } from "./storage/storage-provider.interface";
import { GoogleCalendarProvider } from "./calendar/google-calendar.provider";
import { OutlookCalendarProvider } from "./calendar/outlook-calendar.provider";
import { ICloudCalendarProvider } from "./calendar/icloud-calendar.provider";
import { CalendarProvider } from "./calendar/calendar-provider.interface";
import { SetupSocialConnectorDto } from "./dto/setup-social-connector.dto";
import { SetupCommerceConnectorDto } from "./dto/setup-commerce-connector.dto";
import { GithubProvider } from "./social/github.provider";
import { SocialProvider } from "./social/social-provider.interface";
import { ShopifyCommerceProvider } from "./commerce/shopify-commerce.provider";
import { CommerceProvider } from "./commerce/commerce-provider.interface";

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly gmailProvider: GmailEmailProvider,
    private readonly outlookProvider: OutlookEmailProvider,
    private readonly googleDriveProvider: GoogleDriveProvider,
    private readonly oneDriveProvider: OneDriveProvider,
    private readonly dropboxProvider: DropboxProvider,
    private readonly googleCalendarProvider: GoogleCalendarProvider,
    private readonly outlookCalendarProvider: OutlookCalendarProvider,
    private readonly icloudCalendarProvider: ICloudCalendarProvider,
    private readonly githubProvider: GithubProvider,
    private readonly shopifyProvider: ShopifyCommerceProvider,
  ) {}

  async listConnectors(userId: string) {
    // 1. Get existing UserConnectors
    const existingConnectors = await prisma.userConnector.findMany({
      where: { userId },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: {
          select: {
            expiresAt: true,
            lastRefreshedAt: true,
            refreshStatus: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 2. Check for "Login Credentials" that could be bridged (Google/Microsoft)
    const existingProviders = new Set(existingConnectors.map(c => c.capabilityProvider.providerName));
    
    // Find auth credentials for this user
    const authCredentials = await prisma.credential.findMany({
      where: {
        authenticationIdentity: { userId },
        providerName: { in: ['google', 'microsoft'] },
        accessToken: { not: null }
      }
    });

    for (const cred of authCredentials) {
      const providerName = cred.providerName === 'google' ? 'gmail' : 'outlook';
      if (existingProviders.has(providerName)) continue;

      // Auto-bridge: Create a UserConnector for this login
      try {
        const capabilityType = cred.providerName === 'google' ? CapabilityType.email : CapabilityType.email; // Simplified
        const capability = await prisma.capability.findFirst({ where: { capabilityType } });
        const provider = await prisma.capabilityProvider.findFirst({ 
          where: { providerName, capabilityId: capability?.id } 
        });

        if (capability && provider) {
          const connector = await prisma.userConnector.create({
            data: {
              userId,
              capabilityId: capability.id,
              capabilityProviderId: provider.id,
              status: ConnectorStatus.connected,
              connectorName: provider.displayName,
              enabledFeaturesJson: this.toJson(["send", "sync", "reply_detection"]),
              enabledRoles: ["IDENTITY", "SIGNAL"],
              lastSuccessAt: new Date(),
            }
          });

          await this.saveCredentials(connector.id, {
            accessToken: cred.accessToken,
            refreshToken: cred.refreshToken,
            expiresAt: cred.expiresAt
          });

          // Add to the list we return
          const refreshed = await prisma.userConnector.findUnique({
            where: { id: connector.id },
            include: { capability: true, capabilityProvider: true, connectorCredentials: true }
          });
          if (refreshed) existingConnectors.push(refreshed);
        }
      } catch (e) {
        console.error(`Failed to auto-bridge ${cred.providerName} connector:`, e);
      }
    }

    return existingConnectors.map((connector) => this.toConnectorSummary(connector));
  }

  async getEmailReadiness(userId: string) {
    const connector = await this.findConnectedEmailConnector(userId);
    if (!connector) {
      return {
        ready: false,
        blocked: true,
        reason: "missing_email_connector",
        upgradeHint: "Connect Gmail or Outlook before sending real outreach.",
        providers: ["gmail", "outlook"],
      };
    }

    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );
    const hasAccessToken = Boolean(credentials.accessToken);
    return {
      ready: hasAccessToken,
      blocked: !hasAccessToken,
      reason: hasAccessToken ? null : "missing_access_token",
      upgradeHint: hasAccessToken
        ? null
        : "Reconnect this email account with a valid access token.",
      connector: this.toConnectorSummary(connector),
    };
  }

  async setupEmailConnector(userId: string, dto: SetupEmailConnectorDto) {
    const { capability, provider } = await this.ensureEmailProvider(
      dto.providerName,
    );
    const credentials = {
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      emailAddress: dto.emailAddress,
      expiresAt: dto.expiresAt,
    };

    const connector = await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName: dto.connectorName?.trim() || provider.displayName,
        status: dto.accessToken
          ? ConnectorStatus.connected
          : ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson([
          "send",
          "sync",
          "reply_detection",
          "thread_summary",
        ]),
        enabledRoles: [
          "IDENTITY",
          "SIGNAL",
          "STRATEGIC",
          "DAILY_ACTION",
          "EXECUTION",
          "VERIFICATION",
          "MOMENTUM",
        ],
        metadataJson: this.toJson({ emailAddress: dto.emailAddress }),
      },
      update: {
        capabilityProviderId: provider.id,
        connectorName: dto.connectorName?.trim() || provider.displayName,
        status: dto.accessToken
          ? ConnectorStatus.connected
          : ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson([
          "send",
          "sync",
          "reply_detection",
          "thread_summary",
        ]),
        enabledRoles: [
          "IDENTITY",
          "SIGNAL",
          "STRATEGIC",
          "DAILY_ACTION",
          "EXECUTION",
          "VERIFICATION",
          "MOMENTUM",
        ],
        metadataJson: this.toJson({ emailAddress: dto.emailAddress }),
        errorMessage: null,
      },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: "oauth2_token",
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: dto.accessToken ? "ready" : "missing_access_token",
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        lastRefreshedAt: new Date(),
        refreshStatus: dto.accessToken ? "ready" : "missing_access_token",
      },
    });

    return this.getEmailReadiness(userId);
  }

  async setupStorageConnector(userId: string, dto: SetupStorageConnectorDto) {
    const { capability, provider } = await this.ensureStorageProvider(
      dto.providerName,
    );
    const credentials = {
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      expiresAt: dto.expiresAt,
    };

    const connector = await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName:
          dto.providerName === "google_drive"
            ? "Google Drive"
            : dto.providerName === "onedrive"
              ? "OneDrive"
              : "Dropbox",
        status: ConnectorStatus.connected,
        enabledFeaturesJson: this.toJson(["list", "download", "sync"]),
        enabledRoles: ["IDENTITY", "STRATEGIC"],
      },
      update: {
        capabilityProviderId: provider.id,
        status: ConnectorStatus.connected,
        enabledRoles: ["IDENTITY", "STRATEGIC"],
        errorMessage: null,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: "oauth2_token",
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: "ready",
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: "ready",
      },
    });

    return { success: true, connector: this.toConnectorSummary(connector) };
  }

  async setupCalendarConnector(userId: string, dto: SetupCalendarConnectorDto) {
    const { capability, provider } = await this.ensureCalendarProvider(
      dto.providerName,
    );
    const credentials = {
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      expiresAt: dto.expiresAt,
      emailAddress: dto.emailAddress,
    };

    const connector = await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName:
          dto.providerName === "google_calendar"
            ? "Google Calendar"
            : dto.providerName === "outlook"
              ? "Outlook Calendar"
              : "iCloud Calendar",
        status: ConnectorStatus.connected,
        enabledFeaturesJson: this.toJson(["list", "sync"]),
        enabledRoles: ["DAILY_ACTION", "VERIFICATION"],
      },
      update: {
        capabilityProviderId: provider.id,
        status: ConnectorStatus.connected,
        enabledRoles: ["DAILY_ACTION", "VERIFICATION"],
        errorMessage: null,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: "oauth2_token",
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: "ready",
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: "ready",
      },
    });

    return { success: true, connector: this.toConnectorSummary(connector) };
  }

  async setupSocialConnector(userId: string, dto: SetupSocialConnectorDto) {
    const { capability, provider } = await this.ensureSocialProvider(
      dto.providerName,
    );
    const credentials = { accessToken: dto.accessToken };
    const testResult = await this.socialProviderFor(dto.providerName).test(
      credentials,
    );
    if (!testResult.ok)
      throw new BadRequestException("Failed to verify social credentials");

    const connector = await prisma.userConnector.upsert({
      where: { userId_capabilityId: { userId, capabilityId: capability.id } },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName:
          dto.providerName === "github" ? "GitHub" : "Social Connector",
        status: ConnectorStatus.connected,
        enabledFeaturesJson: this.toJson(["profile_sync", "signal_sensing"]),
        enabledRoles: ["IDENTITY", "SIGNAL", "STRATEGIC"],
      },
      update: {
        capabilityProviderId: provider.id,
        status: ConnectorStatus.connected,
        enabledRoles: ["IDENTITY", "SIGNAL", "STRATEGIC"],
        errorMessage: null,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: "oauth2_token",
        encryptedData: JSON.stringify(credentials),
        refreshStatus: "ready",
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        refreshStatus: "ready",
      },
    });

    // Immediate sync
    await this.syncTechnicalProfile(userId, connector.id, dto.providerName);

    return { success: true, connector: this.toConnectorSummary(connector) };
  }

  async setupCommerceConnector(userId: string, dto: SetupCommerceConnectorDto) {
    const { capability, provider } = await this.ensureCommerceProvider(
      dto.providerName,
    );
    const credentials = {
      accessToken: dto.accessToken,
      storeName: dto.storeName,
    };
    const testResult = await this.commerceProviderFor(dto.providerName).test(
      credentials,
    );
    if (!testResult.ok)
      throw new BadRequestException("Failed to verify commerce credentials");

    const connector = await prisma.userConnector.upsert({
      where: { userId_capabilityId: { userId, capabilityId: capability.id } },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName:
          dto.connectorName ||
          (dto.providerName === "shopify" ? "Shopify" : "Commerce"),
        status: ConnectorStatus.connected,
        enabledFeaturesJson: this.toJson([
          "customer_sync",
          "order_sync",
          "product_sync",
        ]),
        enabledRoles: ["IDENTITY", "SIGNAL", "STRATEGIC", "MOMENTUM"],
      },
      update: {
        capabilityProviderId: provider.id,
        status: ConnectorStatus.connected,
        enabledRoles: ["IDENTITY", "SIGNAL", "STRATEGIC", "MOMENTUM"],
        errorMessage: null,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: "api_key",
        encryptedData: JSON.stringify(credentials),
        refreshStatus: "ready",
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        refreshStatus: "ready",
      },
    });

    // Immediate sync
    await this.syncCommerceData(userId, connector.id, dto.providerName);

    return { success: true, connector: this.toConnectorSummary(connector) };
  }

  private async syncCommerceData(
    userId: string,
    userConnectorId: string,
    providerName: string,
  ) {
    const connector = await prisma.userConnector.findUnique({
      where: { id: userConnectorId },
      include: { connectorCredentials: true },
    });
    if (!connector) return;

    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );
    const provider = this.commerceProviderFor(providerName);

    // 1. Sync Products -> Offerings
    const products = await provider.listProducts(credentials);
    for (const prod of products) {
      await prisma.offering.upsert({
        where: { id: prod.externalId }, // We assume Shopify IDs are unique strings
        create: {
          id: prod.externalId,
          userId,
          title: prod.title,
          description: prod.description,
          offeringType: "product",
          status: "active",
          externalId: prod.externalId,
          source: providerName,
        },
        update: {
          title: prod.title,
          description: prod.description,
        },
      });
    }

    // 2. Sync Customers -> People
    const customers = await provider.listCustomers(credentials);
    for (const cust of customers) {
      await prisma.person.upsert({
        where: { id: cust.externalId },
        create: {
          id: cust.externalId,
          userId,
          fullName:
            `${cust.firstName || ""} ${cust.lastName || ""}`.trim() ||
            "Shopify Customer",
          firstName: cust.firstName,
          lastName: cust.lastName,
          email: cust.email,
          contactSource: providerName,
        },
        update: {
          email: cust.email,
        },
      });
    }

    // 3. Sync Orders -> Activities
    const orders = await provider.listOrders(credentials);
    for (const order of orders) {
      await prisma.activity.upsert({
        where: { id: order.externalId },
        create: {
          id: order.externalId,
          userId,
          personId: order.customerExternalId, // Links to the Person created above
          activityType: ActivityType.purchase,
          subject: `Shopify Order ${order.orderNumber}`,
          bodySummary: `Total: ${order.totalPrice}`,
          occurredAt: order.createdAt,
          metadataJson: this.toJson(order.metadata),
        },
        update: {
          bodySummary: `Total: ${order.totalPrice}`,
          occurredAt: order.createdAt,
        },
      });
    }
  }

  private async syncTechnicalProfile(
    userId: string,
    userConnectorId: string,
    providerName: string,
  ) {
    const connector = await prisma.userConnector.findUnique({
      where: { id: userConnectorId },
      include: { connectorCredentials: true },
    });
    if (!connector) return;

    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );
    const profileData =
      await this.socialProviderFor(providerName).getProfile(credentials);

    await prisma.technicalProfile.upsert({
      where: { userId_providerName: { userId, providerName } },
      create: {
        userId,
        providerName,
        externalId: profileData.externalId,
        username: profileData.username,
        bio: profileData.bio,
        languagesJson: this.toJson(profileData.languages),
        totalStars: profileData.totalStars,
        totalRepos: profileData.totalRepos,
        metadataJson: this.toJson(profileData.metadata),
      },
      update: {
        username: profileData.username,
        bio: profileData.bio,
        languagesJson: this.toJson(profileData.languages),
        totalStars: profileData.totalStars,
        totalRepos: profileData.totalRepos,
        metadataJson: this.toJson(profileData.metadata),
      },
    });
  }

  async startEmailOAuth(
    userId: string,
    providerName: "outlook" | "gmail",
    returnTo?: string,
  ) {
    if (providerName !== "outlook" && providerName !== "gmail") {
      throw new BadRequestException(
        "OAuth flow is currently implemented for Outlook and Gmail only.",
      );
    }

    if (providerName === "gmail") {
      const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
      if (!clientId) {
        throw new BadRequestException(
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID first.",
        );
      }

      const { capability, provider } = await this.ensureEmailProvider(providerName);
      const state = randomBytes(24).toString("hex");
      const codeVerifier = randomBytes(48).toString("base64url");
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
      const redirectUri = this.googleRedirectUri();
      const scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "openid",
      ];

      await prisma.userConnector.upsert({
        where: { userId_capabilityId: { userId, capabilityId: capability.id } },
        create: {
          userId,
          capabilityId: capability.id,
          capabilityProviderId: provider.id,
          connectorName: provider.displayName,
          status: ConnectorStatus.pending_setup,
          enabledFeaturesJson: this.toJson(["send", "sync", "reply_detection", "thread_summary"]),
          metadataJson: this.toJson({
            oauthState: state,
            oauthCodeVerifier: codeVerifier,
            oauthReturnTo: returnTo,
            oauthProvider: providerName,
          }),
        },
        update: {
          capabilityProviderId: provider.id,
          connectorName: provider.displayName,
          status: ConnectorStatus.pending_setup,
          errorMessage: null,
          metadataJson: this.toJson({
            oauthState: state,
            oauthCodeVerifier: codeVerifier,
            oauthReturnTo: returnTo,
            oauthProvider: providerName,
          }),
        },
      });

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");

      return { providerName, authUrl: authUrl.toString(), state };
    }

    const clientId = this.configService.get<string>("MICROSOFT_CLIENT_ID");
    if (!clientId) {
      throw new BadRequestException(
        "Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID first.",
      );
    }

    const { capability, provider } =
      await this.ensureEmailProvider(providerName);
    const state = randomBytes(24).toString("hex");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const redirectUri = this.microsoftRedirectUri();
    const tenantId =
      this.configService.get<string>("MICROSOFT_TENANT_ID") || "common";
    const scopes = [
      "offline_access",
      "openid",
      "profile",
      "email",
      "User.Read",
      "Mail.Send",
      "Mail.Read",
    ];

    await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName: provider.displayName,
        status: ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson([
          "send",
          "sync",
          "reply_detection",
          "thread_summary",
        ]),
        metadataJson: this.toJson({
          oauthState: state,
          oauthCodeVerifier: codeVerifier,
          oauthReturnTo: returnTo,
          oauthProvider: providerName,
        }),
      },
      update: {
        capabilityProviderId: provider.id,
        connectorName: provider.displayName,
        status: ConnectorStatus.pending_setup,
        errorMessage: null,
        metadataJson: this.toJson({
          oauthState: state,
          oauthCodeVerifier: codeVerifier,
          oauthReturnTo: returnTo,
          oauthProvider: providerName,
        }),
      },
    });

    const authUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    );
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return { providerName, authUrl: authUrl.toString(), state };
  }

  async startSocialOAuth(
    userId: string,
    providerName: "linkedin" | "hubspot" | "shopify" | "salesforce",
    returnTo?: string,
  ) {
    if (providerName === "linkedin") {
      const clientId = this.configService.get<string>("LINKEDIN_CLIENT_ID");
      if (!clientId) {
        throw new BadRequestException(
          "LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID first.",
        );
      }

      const { capability, provider } = await this.ensureSocialProvider(providerName);
      const state = randomBytes(24).toString("hex");
      const redirectUri = this.linkedinRedirectUri();
      const scopes = ["openid", "profile", "email"];

      await prisma.userConnector.upsert({
        where: { userId_capabilityId: { userId, capabilityId: capability.id } },
        create: {
          userId,
          capabilityId: capability.id,
          capabilityProviderId: provider.id,
          connectorName: provider.displayName,
          status: ConnectorStatus.pending_setup,
          metadataJson: this.toJson({
            oauthState: state,
            oauthReturnTo: returnTo,
            oauthProvider: providerName,
          }),
        },
        update: {
          capabilityProviderId: provider.id,
          connectorName: provider.displayName,
          status: ConnectorStatus.pending_setup,
          errorMessage: null,
          metadataJson: this.toJson({
            oauthState: state,
            oauthReturnTo: returnTo,
            oauthProvider: providerName,
          }),
        },
      });

      const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("state", state);

      return { providerName, authUrl: authUrl.toString(), state };
    }

    throw new BadRequestException(`Provider ${providerName} not yet supported for social OAuth.`);
  }

  private linkedinRedirectUri() {
    return `${this.configService.get<string>("API_BASE_URL")}/connectors/callback/linkedin`;
  }

  async completeEmailOAuth(input: {
    state?: string;
    code?: string;
    error?: string;
    errorDescription?: string;
  }) {
    if (input.error) {
      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: input.errorDescription || input.error,
      });
    }
    if (!input.state || !input.code) {
      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: "Missing OAuth state or authorization code.",
      });
    }

    const connector = await prisma.userConnector.findFirst({
      where: {
        metadataJson: { path: ["oauthState"], equals: input.state },
      },
      include: {
        capabilityProvider: true,
        connectorCredentials: true,
      },
    });

    if (!connector) {
      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: "OAuth session was not found or has expired.",
      });
    }

    try {
      const metadata = this.jsonObject(connector.metadataJson);
      const codeVerifier =
        typeof metadata["oauthCodeVerifier"] === "string"
          ? metadata["oauthCodeVerifier"]
          : "";
      const returnTo =
        typeof metadata["oauthReturnTo"] === "string"
          ? metadata["oauthReturnTo"]
          : undefined;
      const providerName =
        typeof metadata["oauthProvider"] === "string"
          ? (metadata["oauthProvider"] as "outlook" | "gmail")
          : "outlook";

      if (!codeVerifier) {
        throw new Error("Missing PKCE verifier for OAuth completion.");
      }

      let credentials;
      let testResult;

      if (providerName === "gmail") {
        const tokenResult = await this.exchangeGoogleCode(input.code, codeVerifier);
        credentials = {
          accessToken: tokenResult.access_token,
          refreshToken: tokenResult.refresh_token,
          expiresAt: tokenResult.expires_in
            ? new Date(Date.now() + tokenResult.expires_in * 1000).toISOString()
            : undefined,
        };
        testResult = await this.gmailProvider.test({
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
        });
      } else {
        const tokenResult = await this.exchangeMicrosoftCode(input.code, codeVerifier);
        credentials = {
          accessToken: tokenResult.access_token,
          refreshToken: tokenResult.refresh_token,
          expiresAt: tokenResult.expires_in
            ? new Date(Date.now() + tokenResult.expires_in * 1000).toISOString()
            : undefined,
        };
        testResult = await this.outlookProvider.test({
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
        });
      }

      await prisma.connectorCredential.upsert({
        where: { userConnectorId: connector.id },
        create: {
          userConnectorId: connector.id,
          credentialType: "oauth2_token",
          encryptedData: JSON.stringify(credentials),
          expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
          refreshStatus: "ready",
        },
        update: {
          encryptedData: JSON.stringify(credentials),
          expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
          lastRefreshedAt: new Date(),
          refreshStatus: "ready",
        },
      });

      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.connected,
          lastSuccessAt: new Date(),
          errorMessage: null,
          metadataJson: this.toJson({
            emailAddress: testResult.emailAddress,
            oauthProvider: providerName,
          }),
        },
      });

      return this.oauthResultHtml({
        success: true,
        provider: providerName,
        emailAddress: testResult.emailAddress ?? undefined,
        returnTo,
      });
    } catch (error) {
      const connectorMetadata = this.jsonObject(connector.metadataJson);
      await prisma.userConnector
        .update({
          where: { id: connector.id },
          data: {
            status: ConnectorStatus.error,
            errorMessage:
              error instanceof Error
                ? error.message
                : "OAuth completion failed",
          },
        })
        .catch(() => null);

      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error:
          error instanceof Error ? error.message : "OAuth completion failed",
        returnTo:
          typeof connectorMetadata["oauthReturnTo"] === "string"
            ? connectorMetadata["oauthReturnTo"]
            : undefined,
      });
    }
  }

  async completeSocialOAuth(input: {
    provider: "linkedin" | "hubspot" | "shopify" | "salesforce";
    state?: string;
    code?: string;
    error?: string;
    errorDescription?: string;
  }) {
    if (input.error) {
      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: input.errorDescription || input.error,
      });
    }
    if (!input.state || !input.code) {
      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: "Missing OAuth state or authorization code.",
      });
    }

    const connector = await prisma.userConnector.findFirst({
      where: {
        metadataJson: { path: ["oauthState"], equals: input.state },
      },
      include: {
        capabilityProvider: true,
        connectorCredentials: true,
      },
    });

    if (!connector) {
      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: "OAuth session was not found or has expired.",
      });
    }

    const connectorMetadata = this.jsonObject(connector.metadataJson);

    try {
      let credentials;
      let testResult;

      if (input.provider === "linkedin") {
        const tokenResult = await this.exchangeLinkedInCode(input.code);
        credentials = {
          accessToken: tokenResult.access_token,
          refreshToken: tokenResult.refresh_token,
          expiresAt: tokenResult.expires_in
            ? new Date(Date.now() + tokenResult.expires_in * 1000).toISOString()
            : undefined,
        };
        // LinkedIn Profile verification
        const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        });
        const profile = (await profileRes.json()) as any;
        testResult = { 
          emailAddress: profile.email || profile.sub,
          fullName: profile.name || `${profile.given_name} ${profile.family_name}`.trim()
        };

        // Update User Profile with LinkedIn Name
        // Update User Profile with LinkedIn Name ONLY if not already set
        if (testResult.fullName) {
          const currentUser = await prisma.user.findUnique({
            where: { id: connector.userId },
            select: { fullName: true }
          });
          
          if (!currentUser?.fullName) {
            await prisma.user.update({
              where: { id: connector.userId },
              data: { fullName: testResult.fullName },
            });
          }
        }
      } else {
        throw new Error(`Provider ${input.provider} callback not yet implemented.`);
      }

      await this.saveCredentials(connector.id, credentials);

      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.connected,
          lastSuccessAt: new Date(),
          errorMessage: null,
          metadataJson: this.toJson({
            ...connectorMetadata,
            emailAddress: testResult.emailAddress,
          }),
        },
      });

      return this.oauthResultHtml({
        success: true,
        provider: "outlook",
        emailAddress: testResult.emailAddress,
        fullName: testResult.fullName,
        returnTo:
          typeof connectorMetadata["oauthReturnTo"] === "string"
            ? connectorMetadata["oauthReturnTo"]
            : undefined,
      });
    } catch (error) {
      console.error(`Social OAuth completion error (${input.provider}):`, error);

      await prisma.userConnector
        .update({
          where: { id: connector.id },
          data: {
            status: ConnectorStatus.error,
            errorMessage:
              error instanceof Error ? error.message : "OAuth completion failed",
          },
        })
        .catch(() => null);

      return this.oauthResultHtml({
        success: false,
        provider: "outlook",
        error: error instanceof Error ? error.message : "OAuth completion failed",
        returnTo:
          typeof connectorMetadata["oauthReturnTo"] === "string"
            ? connectorMetadata["oauthReturnTo"]
            : undefined,
      });
    }
  }

  async testConnector(userId: string, connectorId: string) {
    const connector = await this.findConnector(userId, connectorId);
    const provider = this.emailProviderFor(
      connector.capabilityProvider.providerName,
    );
    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );

    try {
      const result = await provider.test(credentials);
      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.connected,
          lastSuccessAt: new Date(),
          errorMessage: null,
          metadataJson: this.toJson({
            ...((connector.metadataJson as object) ?? {}),
            emailAddress: result.emailAddress,
          }),
        },
      });
      await this.logExecution(
        connector.id,
        "connector.test",
        CapabilityExecutionStatus.succeeded,
        {},
        result,
      );
      return { success: true, result };
    } catch (error) {
      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.error,
          errorMessage:
            error instanceof Error ? error.message : "Connector test failed",
        },
      });
      await this.logExecution(
        connector.id,
        "connector.test",
        CapabilityExecutionStatus.failed,
        {},
        { error: String(error) },
      );
      throw error;
    }
  }

  async sendEmail(
    userId: string,
    input: EmailSendInput & {
      opportunityId?: string;
      companyId?: string;
      personId?: string;
    },
  ) {
    const connector = await this.findConnectedEmailConnector(userId);
    if (!connector) {
      throw new BadRequestException(
        "Connect Gmail or Outlook before sending real outreach.",
      );
    }
    const provider = this.emailProviderFor(
      connector.capabilityProvider.providerName,
    );
    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );
    const result = await provider.send(input, credentials);
    await prisma.userConnector.update({
      where: { id: connector.id },
      data: { lastSuccessAt: new Date(), errorMessage: null },
    });
    await this.logExecution(
      connector.id,
      "email.send",
      CapabilityExecutionStatus.succeeded,
      input,
      result,
      input.opportunityId,
    );
    return { connector, result };
  }

  async syncEmail(userId: string) {
    const connector = await this.findConnectedEmailConnector(userId);
    if (!connector) {
      throw new BadRequestException(
        "Connect Gmail or Outlook before syncing email.",
      );
    }
    const provider = this.emailProviderFor(
      connector.capabilityProvider.providerName,
    );
    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );
    const syncState = await prisma.connectorSyncState.findUnique({
      where: {
        userConnectorId_syncType: {
          userConnectorId: connector.id,
          syncType: "email_inbox",
        },
      },
    });

    const result = await provider.sync(credentials, syncState?.providerCursor);
    const linked = await this.linkReplies(userId, result.messages);

    await prisma.connectorSyncState.upsert({
      where: {
        userConnectorId_syncType: {
          userConnectorId: connector.id,
          syncType: "email_inbox",
        },
      },
      create: {
        userConnectorId: connector.id,
        syncType: "email_inbox",
        providerCursor: result.nextCursor,
        lastSyncAt: new Date(),
        syncStatus: "succeeded",
        itemsSynced: result.messages.length,
      },
      update: {
        providerCursor: result.nextCursor,
        lastSyncAt: new Date(),
        syncStatus: "succeeded",
        itemsSynced: { increment: result.messages.length },
        errorDetailsJson: undefined,
      },
    });

    await prisma.userConnector.update({
      where: { id: connector.id },
      data: {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
        errorMessage: null,
      },
    });
    await this.logExecution(
      connector.id,
      "email.sync",
      CapabilityExecutionStatus.succeeded,
      {},
      { count: result.messages.length },
    );

    return {
      success: true,
      synced: result.messages.length,
      linkedReplies: linked.length,
      replies: linked,
    };
  }

  async syncStorage(userId: string) {
    const connector = await this.findConnectedConnector(
      userId,
      CapabilityType.storage,
    );
    if (!connector) {
      throw new BadRequestException(
        "Connect Google Drive before syncing storage.",
      );
    }
    const provider = this.storageProviderFor(
      connector.capabilityProvider.providerName,
    );
    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );

    const files = await provider.listFiles(credentials);
    const created = [];

    for (const file of files) {
      const existingAsset = await prisma.userAsset.findFirst({
        where: {
          userConnectorId: connector.id,
          externalId: file.externalId,
        },
      });
      const asset = existingAsset
        ? await prisma.userAsset.update({
            where: { id: existingAsset.id },
            data: {
              displayName: file.displayName,
              fileName: file.fileName,
              fileUrl: file.webViewLink || "",
              mimeType: file.mimeType,
              versionToken: file.versionToken,
            },
          })
        : await prisma.userAsset.create({
            data: {
              userId,
              userConnectorId: connector.id,
              externalProvider: connector.capabilityProvider.providerName,
              externalId: file.externalId,
              displayName: file.displayName,
              fileName: file.fileName,
              fileUrl: file.webViewLink || "",
              mimeType: file.mimeType,
              versionToken: file.versionToken,
              category: "other", // Default, logic can be smarter later
            },
          });
      created.push(asset);
    }

    await prisma.userConnector.update({
      where: { id: connector.id },
      data: {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
        errorMessage: null,
      },
    });

    await this.logExecution(
      connector.id,
      "storage.sync",
      CapabilityExecutionStatus.succeeded,
      {},
      { count: files.length },
    );

    return { success: true, count: files.length, assets: created };
  }

  async syncCalendar(userId: string) {
    const connector = await this.findConnectedConnector(
      userId,
      CapabilityType.calendar,
    );
    if (!connector) {
      throw new BadRequestException("Connect Google Calendar before syncing.");
    }
    const provider = this.calendarProviderFor(
      connector.capabilityProvider.providerName,
    );
    const credentials = this.parseCredentials(
      connector.connectorCredentials?.encryptedData,
    );

    const events = await provider.listEvents(credentials);
    const created = [];

    for (const event of events) {
      const dbEvent = await prisma.calendarEvent.upsert({
        where: {
          userConnectorId_externalId: {
            userConnectorId: connector.id,
            externalId: event.externalId,
          },
        },
        create: {
          userId,
          userConnectorId: connector.id,
          externalId: event.externalId,
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          location: event.location,
          meetingUrl: event.meetingUrl,
          status: event.status,
          isAllDay: event.isAllDay,
          attendeesJson: this.toJson(event.attendees),
          syncMetadataJson: this.toJson({
            providerName: connector.capabilityProvider.providerName,
          }),
        },
        update: {
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          location: event.location,
          meetingUrl: event.meetingUrl,
          status: event.status,
          isAllDay: event.isAllDay,
          attendeesJson: this.toJson(event.attendees),
        },
      });
      created.push(dbEvent);
    }

    await prisma.userConnector.update({
      where: { id: connector.id },
      data: {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
        errorMessage: null,
      },
    });

    await this.logExecution(
      connector.id,
      "calendar.sync",
      CapabilityExecutionStatus.succeeded,
      {},
      { count: events.length },
    );

    return { success: true, count: events.length, events: created };
  }

  async summarizeThread(userId: string, opportunityId: string) {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      include: {
        company: true,
        primaryPerson: true,
        activities: {
          where: { activityType: ActivityType.email },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    if (!opportunity) {
      throw new NotFoundException("Opportunity not found");
    }

    const inbound = opportunity.activities.filter(
      (activity) => (activity.metadataJson as any)?.direction === "inbound",
    );
    const outbound = opportunity.activities.filter(
      (activity) => (activity.metadataJson as any)?.direction !== "inbound",
    );
    const last = opportunity.activities.at(-1);
    return {
      opportunityId,
      companyName: opportunity.company.name,
      contactName: opportunity.primaryPerson?.fullName ?? null,
      messageCount: opportunity.activities.length,
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      lastActivityAt: last?.occurredAt ?? null,
      summary:
        inbound.length > 0
          ? `A reply has been detected from ${opportunity.primaryPerson?.fullName ?? opportunity.company.name}. Review the latest inbound message and continue the conversation.`
          : "No replies have been detected yet. Continue monitoring or create a follow-up when appropriate.",
      latestMessage: last
        ? {
            subject: last.subject,
            bodySummary: last.bodySummary,
            occurredAt: last.occurredAt,
            direction: (last.metadataJson as any)?.direction ?? "outbound",
          }
        : null,
    };
  }

  private async linkReplies(userId: string, messages: SyncedEmailMessage[]) {
    const linked = [];
    for (const message of messages) {
      const person = message.fromEmail
        ? await prisma.person.findFirst({
            where: {
              userId,
              email: { equals: message.fromEmail, mode: "insensitive" },
            },
            include: {
              primaryOpportunities: { orderBy: { updatedAt: "desc" }, take: 1 },
            },
          })
        : null;
      const opportunity = person?.primaryOpportunities?.[0];
      if (!person || !opportunity) continue;

      const existing = await prisma.activity.findFirst({
        where: {
          userId,
          activityType: ActivityType.email,
          metadataJson: {
            path: ["providerMessageId"],
            equals: message.providerMessageId,
          },
        },
      });
      if (existing) continue;

      const activity = await prisma.activity.create({
        data: {
          userId,
          opportunityId: opportunity.id,
          companyId: opportunity.companyId,
          personId: person.id,
          activityType: ActivityType.email,
          subject: message.subject,
          bodySummary:
            message.bodyPreview ??
            message.snippet ??
            "Inbound email reply detected.",
          occurredAt: message.receivedAt,
          metadataJson: this.toJson({
            direction: "inbound",
            providerMessageId: message.providerMessageId,
            providerThreadId: message.providerThreadId,
            replyDetected: true,
          }),
        },
      });

      await prisma.opportunity.update({
        where: { id: opportunity.id },
        data: {
          stage: "conversation_started",
          nextAction: "Review reply and continue the conversation.",
          nextActionDate: new Date(),
        },
      });
      linked.push(activity);
    }
    return linked;
  }

  private async ensureEmailProvider(providerName: "gmail" | "outlook") {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.email },
      create: {
        capabilityType: CapabilityType.email,
        name: "Email",
        description: "Send and sync email through connected providers.",
        supportedFeaturesJson: this.toJson([
          "send",
          "sync",
          "reply_detection",
          "thread_summary",
        ]),
        workflowRoles: [
          "IDENTITY",
          "SIGNAL",
          "STRATEGIC",
          "DAILY_ACTION",
          "EXECUTION",
          "VERIFICATION",
          "MOMENTUM",
        ],
      },
      update: {
        workflowRoles: [
          "IDENTITY",
          "SIGNAL",
          "STRATEGIC",
          "DAILY_ACTION",
          "EXECUTION",
          "VERIFICATION",
          "MOMENTUM",
        ],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName: providerName === "gmail" ? "Gmail" : "Outlook",
        description:
          providerName === "gmail"
            ? "Google Gmail integration"
            : "Microsoft Outlook integration",
        authType: "oauth2",
        requiredScopesJson: this.toJson(
          providerName === "gmail"
            ? [
                "https://www.googleapis.com/auth/gmail.send",
                "https://www.googleapis.com/auth/gmail.readonly",
              ]
            : [
                "https://graph.microsoft.com/Mail.Send",
                "https://graph.microsoft.com/Mail.Read",
              ],
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async ensureStorageProvider(
    providerName: "google_drive" | "onedrive" | "dropbox",
  ) {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.storage },
      create: {
        capabilityType: CapabilityType.storage,
        name: "Storage",
        description: "Ingest strategic assets from cloud storage.",
        supportedFeaturesJson: this.toJson(["list", "download", "sync"]),
        workflowRoles: ["IDENTITY", "STRATEGIC"],
      },
      update: {
        workflowRoles: ["IDENTITY", "STRATEGIC"],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName:
          providerName === "google_drive"
            ? "Google Drive"
            : providerName === "onedrive"
              ? "OneDrive"
              : "Dropbox",
        description:
          providerName === "google_drive"
            ? "Google Drive storage integration"
            : providerName === "onedrive"
              ? "Microsoft OneDrive storage integration"
              : "Dropbox storage integration",
        authType: "oauth2",
        requiredScopesJson: this.toJson(
          providerName === "google_drive"
            ? ["https://www.googleapis.com/auth/drive.readonly"]
            : providerName === "onedrive"
              ? ["https://graph.microsoft.com/Files.Read"]
              : [],
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async ensureCalendarProvider(
    providerName: "google_calendar" | "outlook" | "icloud",
  ) {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.calendar },
      create: {
        capabilityType: CapabilityType.calendar,
        name: "Calendar",
        description: "Sync meetings and availability.",
        supportedFeaturesJson: this.toJson(["list", "sync"]),
        workflowRoles: ["DAILY_ACTION", "VERIFICATION"],
      },
      update: {
        workflowRoles: ["DAILY_ACTION", "VERIFICATION"],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName:
          providerName === "google_calendar"
            ? "Google Calendar"
            : providerName === "outlook"
              ? "Outlook Calendar"
              : "iCloud Calendar",
        description:
          providerName === "google_calendar"
            ? "Google Calendar integration"
            : providerName === "outlook"
              ? "Microsoft Outlook Calendar integration"
              : "Apple iCloud Calendar integration",
        authType: providerName === "icloud" ? "basic" : "oauth2",
        requiredScopesJson: this.toJson(
          providerName === "google_calendar"
            ? ["https://www.googleapis.com/auth/calendar.readonly"]
            : providerName === "outlook"
              ? ["https://graph.microsoft.com/Calendars.Read"]
              : [],
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async ensureSocialProvider(providerName: "github" | "linkedin") {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.social },
      create: {
        capabilityType: CapabilityType.social,
        name: "Social & Professional Networks",
        description: "Connect and sync professional network data.",
        supportedFeaturesJson: this.toJson([
          "sync",
          "profile",
          "connections",
          "signal_sensing",
        ]),
        workflowRoles: ["IDENTITY", "SIGNAL", "STRATEGIC"],
      },
      update: {
        workflowRoles: ["IDENTITY", "SIGNAL", "STRATEGIC"],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName: providerName === "github" ? "GitHub" : "LinkedIn",
        description:
          providerName === "github"
            ? "GitHub developer network integration"
            : "LinkedIn professional network integration",
        authType: "oauth2",
        requiredScopesJson: this.toJson(
          providerName === "github"
            ? ["read:user", "repo"]
            : ["openid", "profile", "email"],
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async ensureCommerceProvider(providerName: "shopify") {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.commerce },
      create: {
        capabilityType: CapabilityType.commerce,
        name: "Commerce & Customer Operations",
        description:
          "Ingest orders, customers, and products to drive repeat revenue.",
        supportedFeaturesJson: this.toJson([
          "customer_sync",
          "order_sync",
          "product_sync",
        ]),
        workflowRoles: ["IDENTITY", "SIGNAL", "STRATEGIC", "MOMENTUM"],
      },
      update: {
        workflowRoles: ["IDENTITY", "SIGNAL", "STRATEGIC", "MOMENTUM"],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName:
          providerName === "shopify" ? "Shopify" : "Commerce Provider",
        description:
          providerName === "shopify"
            ? "Shopify GraphQL Admin integration"
            : "Commerce integration",
        authType: "api_key",
        requiredScopesJson: this.toJson(
          providerName === "shopify"
            ? ["read_customers", "read_orders", "read_products"]
            : [],
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async findConnectedEmailConnector(userId: string) {
    return prisma.userConnector.findFirst({
      where: {
        userId,
        capability: { capabilityType: CapabilityType.email },
        status: ConnectorStatus.connected,
      },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async findConnector(userId: string, connectorId: string) {
    const connector = await prisma.userConnector.findFirst({
      where: { id: connectorId, userId },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true,
      },
    });
    if (!connector) {
      throw new NotFoundException("Connector not found");
    }
    return connector;
  }

  private emailProviderFor(providerName: string): EmailProvider {
    if (providerName === "gmail") return this.gmailProvider;
    if (providerName === "outlook") return this.outlookProvider;
    throw new BadRequestException(
      `Unsupported email provider: ${providerName}`,
    );
  }

  private storageProviderFor(providerName: string): StorageProvider {
    if (providerName === "google_drive") return this.googleDriveProvider;
    if (providerName === "onedrive") return this.oneDriveProvider;
    if (providerName === "dropbox") return this.dropboxProvider;
    throw new BadRequestException(
      `Unsupported storage provider: ${providerName}`,
    );
  }

  private calendarProviderFor(providerName: string): CalendarProvider {
    if (providerName === "google_calendar") return this.googleCalendarProvider;
    if (providerName === "outlook") return this.outlookCalendarProvider;
    if (providerName === "icloud") return this.icloudCalendarProvider;
    throw new BadRequestException(
      `Unsupported calendar provider: ${providerName}`,
    );
  }

  private socialProviderFor(providerName: string): SocialProvider {
    if (providerName === "github") return this.githubProvider;
    throw new BadRequestException(
      `Unsupported social provider: ${providerName}`,
    );
  }

  private commerceProviderFor(providerName: string): CommerceProvider {
    if (providerName === "shopify") return this.shopifyProvider;
    throw new BadRequestException(
      `Unsupported commerce provider: ${providerName}`,
    );
  }

  private async findConnectedConnector(
    userId: string,
    capabilityType: CapabilityType,
  ) {
    return prisma.userConnector.findFirst({
      where: {
        userId,
        capability: { capabilityType },
        status: ConnectorStatus.connected,
      },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private parseCredentials(raw?: string | null) {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private async saveCredentials(userConnectorId: string, credentials: any) {
    const expiresAt = credentials.expires_in 
      ? new Date(Date.now() + credentials.expires_in * 1000)
      : (credentials.expiresAt ? new Date(credentials.expiresAt) : null);

    await prisma.connectorCredential.upsert({
      where: { userConnectorId },
      create: {
        userConnectorId,
        credentialType: "oauth2_token",
        encryptedData: JSON.stringify(credentials),
        expiresAt,
        refreshStatus: "ready",
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt,
        lastRefreshedAt: new Date(),
        refreshStatus: "ready",
      },
    });
  }

  private jsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private googleRedirectUri() {
    const configured = this.configService.get<string>("GOOGLE_CALLBACK_URL");
    if (configured) return configured;
    
    const base = this.configService.get<string>("API_BASE_URL") || "http://localhost:3002";
    return `${base.replace(/\/$/, "")}/connectors/callback/linkedin`; // Use an authorized one if we can
  }

  private microsoftRedirectUri() {
    const configured = this.configService.get<string>("MICROSOFT_CALLBACK_URL");
    if (configured) return configured;
    
    const base = this.configService.get<string>("API_BASE_URL") || "http://localhost:3002";
    return `${base.replace(/\/$/, "")}/auth/microsoft/callback`;
  }

  private async exchangeGoogleCode(code: string, codeVerifier: string) {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    if (!clientId) {
      throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID first.");
    }
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");
    if (!clientSecret) {
      throw new Error("Google OAuth secret is not configured. Set GOOGLE_CLIENT_SECRET first.");
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.googleRedirectUri(),
      code_verifier: codeVerifier,
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, any> | null;
    if (!response.ok) {
      throw new Error((payload as any)?.error_description || (payload as any)?.error || "Google code exchange failed");
    }

    return payload as { access_token: string; refresh_token: string; expires_in: number };
  }

  private async exchangeMicrosoftCode(code: string, codeVerifier: string) {
    const clientId = this.configService.get<string>("MICROSOFT_CLIENT_ID");
    if (!clientId) {
      throw new Error(
        "Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID first.",
      );
    }
    const clientSecret = this.configService.get<string>(
      "MICROSOFT_CLIENT_SECRET",
    );
    const tenantId =
      this.configService.get<string>("MICROSOFT_TENANT_ID") || "common";

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.microsoftRedirectUri(),
      code_verifier: codeVerifier,
    });
    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok) {
      const detail =
        payload?.["error_description"] ??
        payload?.["error"] ??
        `HTTP ${response.status}`;
      throw new Error(`Microsoft token exchange failed: ${detail}`);
    }
    return payload as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
  }

  private async exchangeLinkedInCode(code: string) {
    const clientId = this.configService.get<string>("LINKEDIN_CLIENT_ID");
    if (!clientId) {
      throw new Error("LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID first.");
    }
    const clientSecret = this.configService.get<string>("LINKEDIN_CLIENT_SECRET");
    if (!clientSecret) {
      throw new Error("LinkedIn OAuth secret is not configured. Set LINKEDIN_CLIENT_SECRET first.");
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.linkedinRedirectUri(),
    });

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, any> | null;
    if (!response.ok) {
      throw new Error((payload as any)?.error_description || (payload as any)?.error || "LinkedIn code exchange failed");
    }

    return payload as { access_token: string; refresh_token: string; expires_in: number };
  }

  private oauthResultHtml(input: {
    success: boolean;
    provider: "outlook" | "gmail" | "linkedin" | "hubspot" | "shopify" | "salesforce";
    emailAddress?: string;
    fullName?: string;
    error?: string;
    returnTo?: string;
  }) {
    const payload = JSON.stringify({
      type: "opportunity-os-oauth",
      provider: input.provider,
      success: input.success,
      emailAddress: input.emailAddress ?? null,
      fullName: input.fullName ?? null,
      error: input.error ?? null,
    });

    const title = input.success ? "Connector connected" : "Connector failed";
    const message = input.success
      ? `Outlook is now connected${input.emailAddress ? ` for ${input.emailAddress}` : ""}.`
      : (input.error ?? "The Outlook connection failed.");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${this.escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fb; color: #1f2937; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      .card { background: white; border: 1px solid #dbe4f0; border-radius: 12px; padding: 24px; width: min(460px, calc(100vw - 32px)); box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; line-height: 1.5; color: #475569; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${this.escapeHtml(title)}</h1>
      <p>${this.escapeHtml(message)}</p>
    </div>
    <script>
      (function () {
        var payload = ${payload};
        var targetOrigin = ${JSON.stringify(input.returnTo ?? "*")};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin);
          } else if (${JSON.stringify(Boolean(input.returnTo))}) {
            var returnUrl = new URL(${JSON.stringify(input.returnTo ?? "")});
            returnUrl.searchParams.set('oauthProvider', payload.provider);
            returnUrl.searchParams.set('oauthSuccess', payload.success ? 'true' : 'false');
            window.setTimeout(function () { window.location.replace(returnUrl.toString()); }, 900);
          }
        } catch (error) {}
        setTimeout(function () { window.close(); }, 600);
      }());
    </script>
  </body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private async logExecution(
    userConnectorId: string,
    executionType: string,
    executionStatus: CapabilityExecutionStatus,
    input: unknown,
    output: unknown,
    linkedEntityId?: string,
  ) {
    return prisma.capabilityExecutionLog.create({
      data: {
        userConnectorId,
        executionType,
        executionStatus,
        inputPayloadJson: this.toJson(input),
        outputPayloadJson: this.toJson(output),
        linkedEntityType: linkedEntityId ? "opportunity" : undefined,
        linkedEntityId,
      },
    });
  }

  private toConnectorSummary(connector: any) {
    return {
      id: connector.id,
      connectorName: connector.connectorName,
      capabilityType: connector.capability?.capabilityType,
      providerName: connector.capabilityProvider?.providerName,
      providerDisplayName: connector.capabilityProvider?.displayName,
      status: connector.status,
      enabledFeatures: connector.enabledFeaturesJson ?? [],
      enabledRoles: connector.enabledRoles ?? [],
      supportedRoles: connector.capability?.workflowRoles ?? [],
      lastSyncAt: connector.lastSyncAt,
      lastSuccessAt: connector.lastSuccessAt,
      errorMessage: connector.errorMessage,
      metadata: connector.metadataJson ?? {},
      credential: connector.connectorCredentials
        ? {
            expiresAt: connector.connectorCredentials.expiresAt,
            lastRefreshedAt: connector.connectorCredentials.lastRefreshedAt,
            refreshStatus: connector.connectorCredentials.refreshStatus,
          }
        : null,
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }
}
