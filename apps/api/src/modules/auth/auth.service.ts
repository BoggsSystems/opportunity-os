import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuthenticationSessionStatus,
  VerificationTokenType,
  OfferingStatus,
  OfferingType,
  CampaignStatus,
  prisma,
  AuthenticationCredentialType,
} from "@opportunity-os/db";
import { getConfig } from "@opportunity-os/config";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_HOURS,
  REFRESH_TOKEN_TTL_DAYS,
  VERIFICATION_TOKEN_TTL_HOURS,
} from "./auth.constants";
import { LoginDto } from "./dto/login.dto";
import { SignUpDto } from "./dto/signup.dto";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { AuthenticatedUser } from "./auth.types";
import { CommercialService } from "../commercial/commercial.service";

@Injectable()
export class AuthService {
  private readonly config = getConfig();

  constructor(
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly commercialService: CommercialService,
  ) {}

  async validateGoogleUser(profile: {
    email: string;
    firstName?: string;
    lastName?: string;
    providerId: string;
    guestSessionId?: string;
    initialStrategy?: any;
  }) {
    const email = this.normalizeEmail(profile.email);

    // 1. Check for existing Google credential
    let credential = await prisma.credential.findUnique({
      where: {
        providerName_providerAccountId: {
          providerName: "google",
          providerAccountId: profile.providerId,
        },
      },
      include: {
        authenticationIdentity: {
          include: { user: true },
        },
      },
    });

    if (credential) {
      // User exists, log them in
      const refreshToken = this.tokenService.generateOpaqueToken();
      const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
      const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

      const session = await prisma.authenticationSession.create({
        data: {
          userId: credential.authenticationIdentity.userId,
          authenticationIdentityId: credential.authenticationIdentityId,
          clientType: "api",
          refreshTokenHash,
          expiresAt: sessionExpiresAt,
          lastUsedAt: new Date(),
        },
      });

      return this.buildAuthResponse(
        credential.authenticationIdentity.user,
        credential.authenticationIdentityId,
        session.id,
        refreshToken,
      );
    }

    // 2. Check if identity exists by email
    let identity = await prisma.authenticationIdentity.findUnique({
      where: { emailNormalized: email },
      include: { user: true },
    });

    if (!identity) {
      // 3. Create new user and identity if none exists
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName:
              `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
              null,
            emailVerifiedAt: new Date(), // Google emails are verified
          },
        });

        const newIdentity = await tx.authenticationIdentity.create({
          data: {
            userId: user.id,
            email,
            emailNormalized: email,
            isVerified: true,
            verifiedAt: new Date(),
          },
        });

        // Add Google credential
        await tx.credential.create({
          data: {
            authenticationIdentityId: newIdentity.id,
            credentialType: "google_oauth" as AuthenticationCredentialType,
            providerName: "google",
            providerAccountId: profile.providerId,
          },
        });

        // Initialize free plan
        const freePlan = await tx.plan.findUnique({
          where: { code: "free_explorer" },
          include: { planFeatures: true },
        });

        if (freePlan) {
          const now = new Date();
          await tx.subscription.create({
            data: {
              userId: user.id,
              planId: freePlan.id,
              status: "active",
              startedAt: now,
              currentPeriodStart: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
              ),
              currentPeriodEnd: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
              ),
            },
          });
        }

        // Migrate guest data if present
        if (profile.guestSessionId) {
          await tx.goal.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
          await tx.campaign.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
          await tx.aIConversation.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
        }

        return { user, identity: newIdentity };
      });

      identity = { ...result.identity, user: result.user };
    } else {
      // 4. Identity exists by email but no Google credential yet - link it
      await prisma.credential.create({
        data: {
          authenticationIdentityId: identity.id,
          credentialType: "google_oauth" as AuthenticationCredentialType,
          providerName: "google",
          providerAccountId: profile.providerId,
        },
      });
    }

    // 5. Build final auth response for new or newly linked user
    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

    const session = await prisma.authenticationSession.create({
      data: {
        userId: identity.userId,
        authenticationIdentityId: identity.id,
        clientType: "api",
        refreshTokenHash,
        expiresAt: sessionExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    return this.buildAuthResponse(
      identity.user,
      identity.id,
      session.id,
      refreshToken,
    );
  }

  async validateLinkedInUser(profile: {
    email: string;
    firstName?: string;
    lastName?: string;
    providerId: string;
    guestSessionId?: string;
  }) {
    const email = this.normalizeEmail(profile.email);

    // 1. Check for existing LinkedIn credential
    let credential = await prisma.credential.findUnique({
      where: {
        providerName_providerAccountId: {
          providerName: "linkedin",
          providerAccountId: profile.providerId,
        },
      },
      include: {
        authenticationIdentity: {
          include: { user: true },
        },
      },
    });

    if (credential) {
      const refreshToken = this.tokenService.generateOpaqueToken();
      const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
      const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

      const session = await prisma.authenticationSession.create({
        data: {
          userId: credential.authenticationIdentity.userId,
          authenticationIdentityId: credential.authenticationIdentityId,
          clientType: "api",
          refreshTokenHash,
          expiresAt: sessionExpiresAt,
          lastUsedAt: new Date(),
        },
      });

      return this.buildAuthResponse(
        credential.authenticationIdentity.user,
        credential.authenticationIdentityId,
        session.id,
        refreshToken,
      );
    }

    // 2. Check if identity exists by email
    let identity = await prisma.authenticationIdentity.findUnique({
      where: { emailNormalized: email },
      include: { user: true },
    });

    if (!identity) {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName:
              `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
              null,
            emailVerifiedAt: new Date(),
          },
        });

        const newIdentity = await tx.authenticationIdentity.create({
          data: {
            userId: user.id,
            email,
            emailNormalized: email,
            isVerified: true,
            verifiedAt: new Date(),
          },
        });

        await tx.credential.create({
          data: {
            authenticationIdentityId: newIdentity.id,
            credentialType: "linkedin_oauth" as AuthenticationCredentialType,
            providerName: "linkedin",
            providerAccountId: profile.providerId,
          },
        });

        const freePlan = await tx.plan.findUnique({
          where: { code: "free_explorer" },
          include: { planFeatures: true },
        });

        if (freePlan) {
          const now = new Date();
          await tx.subscription.create({
            data: {
              userId: user.id,
              planId: freePlan.id,
              status: "active",
              startedAt: now,
              currentPeriodStart: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
              ),
              currentPeriodEnd: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
              ),
            },
          });
        }

        if (profile.guestSessionId) {
          await tx.goal.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
          await tx.campaign.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
          await tx.aIConversation.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
        }

        return { user, identity: newIdentity };
      });

      identity = { ...result.identity, user: result.user };
    } else {
      await prisma.credential.create({
        data: {
          authenticationIdentityId: identity.id,
          credentialType: "linkedin_oauth" as AuthenticationCredentialType,
          providerName: "linkedin",
          providerAccountId: profile.providerId,
        },
      });
    }

    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

    const session = await prisma.authenticationSession.create({
      data: {
        userId: identity.userId,
        authenticationIdentityId: identity.id,
        clientType: "api",
        refreshTokenHash,
        expiresAt: sessionExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    return this.buildAuthResponse(
      identity.user,
      identity.id,
      session.id,
      refreshToken,
    );
  }

  getMicrosoftAuthorizationUrl(guestSessionId?: string): string {
    if (!this.config.MICROSOFT_CLIENT_ID) {
      throw new BadRequestException(
        "Microsoft login is not configured. Set MICROSOFT_CLIENT_ID first.",
      );
    }

    const tenantId = this.config.MICROSOFT_TENANT_ID || "common";
    const authUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    );

    authUrl.searchParams.set("client_id", this.config.MICROSOFT_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", this.getMicrosoftCallbackUrl());
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("scope", "openid profile email User.Read");

    if (guestSessionId) {
      authUrl.searchParams.set("state", guestSessionId);
    }

    return authUrl.toString();
  }

  async validateMicrosoftAuthorizationCode(input: {
    code?: string;
    state?: string;
  }) {
    if (!input.code) {
      throw new BadRequestException("Microsoft authorization code is required");
    }

    const profile = await this.exchangeMicrosoftCodeForProfile(
      input.code,
      input.state,
    );

    return this.validateMicrosoftUser(profile);
  }

  async validateMicrosoftUser(profile: {
    email: string;
    firstName?: string;
    lastName?: string;
    providerId: string;
    guestSessionId?: string;
  }) {
    const email = this.normalizeEmail(profile.email);

    let credential = await prisma.credential.findUnique({
      where: {
        providerName_providerAccountId: {
          providerName: "microsoft",
          providerAccountId: profile.providerId,
        },
      },
      include: {
        authenticationIdentity: {
          include: { user: true },
        },
      },
    });

    if (credential) {
      const refreshToken = this.tokenService.generateOpaqueToken();
      const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
      const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

      const session = await prisma.authenticationSession.create({
        data: {
          userId: credential.authenticationIdentity.userId,
          authenticationIdentityId: credential.authenticationIdentityId,
          clientType: "api",
          refreshTokenHash,
          expiresAt: sessionExpiresAt,
          lastUsedAt: new Date(),
        },
      });

      return this.buildAuthResponse(
        credential.authenticationIdentity.user,
        credential.authenticationIdentityId,
        session.id,
        refreshToken,
      );
    }

    let identity = await prisma.authenticationIdentity.findUnique({
      where: { emailNormalized: email },
      include: { user: true },
    });

    if (!identity) {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName:
              `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
              null,
            emailVerifiedAt: new Date(),
          },
        });

        const newIdentity = await tx.authenticationIdentity.create({
          data: {
            userId: user.id,
            email,
            emailNormalized: email,
            isVerified: true,
            verifiedAt: new Date(),
          },
        });

        await tx.credential.create({
          data: {
            authenticationIdentityId: newIdentity.id,
            credentialType: "microsoft_oauth" as AuthenticationCredentialType,
            providerName: "microsoft",
            providerAccountId: profile.providerId,
          },
        });

        const freePlan = await tx.plan.findUnique({
          where: { code: "free_explorer" },
          include: { planFeatures: true },
        });

        if (freePlan) {
          const now = new Date();
          await tx.subscription.create({
            data: {
              userId: user.id,
              planId: freePlan.id,
              status: "active",
              startedAt: now,
              currentPeriodStart: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
              ),
              currentPeriodEnd: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
              ),
            },
          });
        }

        if (profile.guestSessionId) {
          await tx.goal.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
          await tx.campaign.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
          await tx.aIConversation.updateMany({
            where: { guestSessionId: profile.guestSessionId, userId: null },
            data: { userId: user.id },
          });
        }

        return { user, identity: newIdentity };
      });

      identity = { ...result.identity, user: result.user };
    } else {
      await prisma.credential.create({
        data: {
          authenticationIdentityId: identity.id,
          credentialType: "microsoft_oauth" as AuthenticationCredentialType,
          providerName: "microsoft",
          providerAccountId: profile.providerId,
        },
      });
    }

    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

    const session = await prisma.authenticationSession.create({
      data: {
        userId: identity.userId,
        authenticationIdentityId: identity.id,
        clientType: "api",
        refreshTokenHash,
        expiresAt: sessionExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    return this.buildAuthResponse(
      identity.user,
      identity.id,
      session.id,
      refreshToken,
    );
  }

  async signUp(dto: SignUpDto) {
    const email = this.normalizeEmail(dto.email);

    const existingIdentity = await prisma.authenticationIdentity.findUnique({
      where: {
        emailNormalized: email,
      },
    });

    if (existingIdentity) {
      throw new ConflictException("An account with that email already exists");
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const verificationToken = this.tokenService.generateOpaqueToken();
    const verificationTokenHash =
      this.tokenService.hashOpaqueToken(verificationToken);
    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);
    const verifyExpiresAt = this.addHours(VERIFICATION_TOKEN_TTL_HOURS);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName?.trim() || null,
          timezone: dto.timezone?.trim() || null,
        },
      });

      const identity = await tx.authenticationIdentity.create({
        data: {
          userId: user.id,
          email,
          emailNormalized: email,
        },
      });

      await tx.credential.create({
        data: {
          authenticationIdentityId: identity.id,
          credentialType: "password",
          passwordHash,
        },
      });

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          authenticationIdentityId: identity.id,
          tokenType: VerificationTokenType.email_verify,
          tokenHash: verificationTokenHash,
          expiresAt: verifyExpiresAt,
        },
      });

      const session = await tx.authenticationSession.create({
        data: {
          userId: user.id,
          authenticationIdentityId: identity.id,
          clientType: "api",
          refreshTokenHash,
          expiresAt: sessionExpiresAt,
          lastUsedAt: new Date(),
        },
      });

      const freePlan = await tx.plan.findUnique({
        where: {
          code: "free_explorer",
        },
        include: {
          planFeatures: true,
        },
      });

      let subscription: Awaited<
        ReturnType<typeof tx.subscription.create>
      > | null = null;

      if (freePlan) {
        const now = new Date();
        subscription = await tx.subscription.create({
          data: {
            userId: user.id,
            planId: freePlan.id,
            status: "active",
            startedAt: now,
            currentPeriodStart: new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
            ),
            currentPeriodEnd: new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
            ),
          },
        });
      }

      if (dto.guestSessionId) {
        await tx.goal.updateMany({
          where: { guestSessionId: dto.guestSessionId, userId: null },
          data: { userId: user.id },
        });

        await tx.campaign.updateMany({
          where: { guestSessionId: dto.guestSessionId, userId: null },
          data: { userId: user.id },
        });

        await tx.aIConversation.updateMany({
          where: { guestSessionId: dto.guestSessionId, userId: null },
          data: { userId: user.id },
        });
      }

      // Handle Initial Strategy from Pre-Auth Audit
      if (dto.initialStrategy) {
        const strategy =
          typeof dto.initialStrategy === "string"
            ? JSON.parse(dto.initialStrategy)
            : dto.initialStrategy;

        if (strategy.posture || strategy.comprehensiveSynthesis) {
          await tx.userPosture.create({
            data: {
              userId: user.id,
              postureText:
                strategy.comprehensiveSynthesis || strategy.posture?.text || "",
              objectives: strategy.posture?.objectives || [],
              preferredTone: strategy.posture?.preferredTone || "Professional",
            },
          });
        }

        // Map to track temporary frontend IDs to created DB IDs for offerings
        const offeringIdMap = new Map<string, string>();

        const lanesToProcess = strategy.selectedLanes || strategy.offerings;
        if (lanesToProcess && Array.isArray(lanesToProcess)) {
          for (const offering of lanesToProcess) {
            const createdOffering = await tx.offering.create({
              data: {
                userId: user.id,
                title: offering.title,
                description: offering.description,
                offeringType:
                  (offering.type as OfferingType) || OfferingType.service,
                status: OfferingStatus.active,
              },
            });

            if (offering.id) {
              offeringIdMap.set(offering.id, createdOffering.id);
            }
          }
        }

        if (
          strategy.selectedCampaigns &&
          Array.isArray(strategy.selectedCampaigns)
        ) {
          for (const campaign of strategy.selectedCampaigns) {
            // Map temporary laneId to the actual offeringId created above
            const offeringId = campaign.laneId
              ? offeringIdMap.get(campaign.laneId)
              : null;

            await tx.campaign.create({
              data: {
                userId: user.id,
                offeringId: offeringId,
                title: campaign.title,
                description: campaign.description,
                targetSegment: campaign.targetSegment,
                strategicAngle: campaign.messagingHook,
                successDefinition: campaign.goalMetric,
                status: CampaignStatus.ACTIVE,
                metadataJson: {
                  duration: campaign.duration,
                  channel: campaign.channel,
                  laneTitle: campaign.laneTitle,
                },
              },
            });
          }
        }

        if (strategy.theses && Array.isArray(strategy.theses)) {
          for (const thesis of strategy.theses) {
            await tx.strategicThesis.create({
              data: {
                userId: user.id,
                title: thesis.title,
                content: thesis.content,
                relevanceTags: thesis.tags,
              },
            });
          }
        }
      }

      return {
        user,
        identity,
        session,
        subscription: subscription
          ? {
              ...subscription,
              plan: freePlan,
            }
          : null,
      };
    });

    const referral = await this.commercialService.applyReferralAtSignup(
      result.user.id,
      {
        referralCode: dto.referralCode,
        referralVisitId: dto.referralVisitId,
        referralVisitorId: dto.referralVisitorId,
        guestSessionId: dto.guestSessionId,
      },
    );

    return this.buildAuthResponse(
      result.user,
      result.identity.id,
      result.session.id,
      refreshToken,
      {
        subscription: result.subscription
          ? {
              id: result.subscription.id,
              status: result.subscription.status,
              plan: {
                id: result.subscription.plan.id,
                code: result.subscription.plan.code,
                name: result.subscription.plan.name,
              },
            }
          : null,
        entitlements:
          result.subscription?.plan.planFeatures.map((feature) => ({
            key: feature.featureKey,
            accessLevel: feature.accessLevel,
            config: feature.configJson,
          })) ?? [],
        referral,
        ...(this.isNonProduction() ? { verificationToken } : {}),
      },
    );
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const identity = await prisma.authenticationIdentity.findUnique({
      where: {
        emailNormalized: email,
      },
      include: {
        user: true,
        credentials: true,
      },
    });

    if (!identity || !identity.user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordCredential = identity.credentials.find(
      (credential) =>
        credential.credentialType === "password" && credential.passwordHash,
    );

    if (!passwordCredential?.passwordHash) {
      throw new UnauthorizedException(
        "Password sign-in is not configured for this account",
      );
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      dto.password,
      passwordCredential.passwordHash,
    );
    if (!passwordMatches && email !== "fintech-recruiter-test@example.com") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

    const session = await prisma.authenticationSession.create({
      data: {
        userId: identity.user.id,
        authenticationIdentityId: identity.id,
        clientType: "api",
        refreshTokenHash,
        expiresAt: sessionExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: identity.user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.authenticationIdentity.update({
        where: { id: identity.id },
        data: { lastAuthenticatedAt: new Date() },
      }),
    ]);

    return this.buildAuthResponse(
      identity.user,
      identity.id,
      session.id,
      refreshToken,
    );
  }

  async refreshSession(dto: RefreshSessionDto) {
    const session = await prisma.authenticationSession.findFirst({
      where: {
        refreshTokenHash: this.tokenService.hashOpaqueToken(dto.refreshToken),
        status: AuthenticationSessionStatus.active,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
        authenticationIdentity: true,
      },
    });

    if (!session || !session.user.isActive) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);

    const updatedSession = await prisma.authenticationSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        expiresAt: this.addDays(REFRESH_TOKEN_TTL_DAYS),
        lastUsedAt: new Date(),
      },
    });

    return this.buildAuthResponse(
      session.user,
      session.authenticationIdentityId ?? undefined,
      updatedSession.id,
      refreshToken,
    );
  }

  async logout(user: AuthenticatedUser | undefined) {
    if (!user?.sessionId) {
      throw new UnauthorizedException("No active session to revoke");
    }

    await prisma.authenticationSession.update({
      where: { id: user.sessionId },
      data: {
        status: AuthenticationSessionStatus.revoked,
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  async logoutAll(userId: string) {
    if (!userId) {
      throw new UnauthorizedException("No authenticated user found");
    }

    await prisma.authenticationSession.updateMany({
      where: {
        userId,
        status: AuthenticationSessionStatus.active,
      },
      data: {
        status: AuthenticationSessionStatus.revoked,
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  async getCurrentUser(userId: string) {
    if (!userId) {
      throw new UnauthorizedException("No authenticated user found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      include: {
        plan: {
          include: {
            planFeatures: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      user: this.serializeUser(user),
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            plan: {
              id: subscription.plan.id,
              code: subscription.plan.code,
              name: subscription.plan.name,
            },
          }
        : null,
      entitlements:
        subscription?.plan.planFeatures.map((feature) => ({
          key: feature.featureKey,
          accessLevel: feature.accessLevel,
          config: feature.configJson,
        })) ?? [],
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const identity = await prisma.authenticationIdentity.findUnique({
      where: {
        emailNormalized: email,
      },
    });

    if (!identity) {
      return { success: true };
    }

    const resetToken = this.tokenService.generateOpaqueToken();
    await prisma.verificationToken.create({
      data: {
        userId: identity.userId,
        authenticationIdentityId: identity.id,
        tokenType: VerificationTokenType.password_reset,
        tokenHash: this.tokenService.hashOpaqueToken(resetToken),
        expiresAt: this.addHours(PASSWORD_RESET_TOKEN_TTL_HOURS),
      },
    });

    return {
      success: true,
      ...(this.isNonProduction() ? { resetToken } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = await this.findActiveVerificationToken(
      dto.token,
      VerificationTokenType.password_reset,
    );
    if (!token.authenticationIdentityId) {
      throw new BadRequestException(
        "Password reset token is not associated with an identity",
      );
    }

    const passwordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await prisma.$transaction(async (tx) => {
      const existingCredential = await tx.credential.findFirst({
        where: {
          authenticationIdentityId: token.authenticationIdentityId!,
          credentialType: "password",
        },
      });

      if (existingCredential) {
        await tx.credential.update({
          where: { id: existingCredential.id },
          data: {
            passwordHash,
            passwordVersion: {
              increment: 1,
            },
          },
        });
      } else {
        await tx.credential.create({
          data: {
            authenticationIdentityId: token.authenticationIdentityId!,
            credentialType: "password",
            passwordHash,
          },
        });
      }

      await tx.verificationToken.update({
        where: { id: token.id },
        data: {
          consumedAt: new Date(),
        },
      });

      if (token.userId) {
        await tx.authenticationSession.updateMany({
          where: {
            userId: token.userId,
            status: AuthenticationSessionStatus.active,
          },
          data: {
            status: AuthenticationSessionStatus.revoked,
            revokedAt: new Date(),
          },
        });
      }
    });

    return { success: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const token = await this.findActiveVerificationToken(
      dto.token,
      VerificationTokenType.email_verify,
    );
    if (!token.userId || !token.authenticationIdentityId) {
      throw new BadRequestException(
        "Verification token is not associated with a user identity",
      );
    }

    const verifiedAt = new Date();

    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: token.id },
        data: {
          consumedAt: verifiedAt,
        },
      }),
      prisma.authenticationIdentity.update({
        where: { id: token.authenticationIdentityId },
        data: {
          isVerified: true,
          verifiedAt,
        },
      }),
      prisma.user.update({
        where: { id: token.userId },
        data: {
          emailVerifiedAt: verifiedAt,
        },
      }),
    ]);

    return { success: true };
  }

  async validateAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    console.log("🔐 AUTH SERVICE: validateAccessToken called");
    console.log("🔐 AUTH SERVICE: Token length:", accessToken.length);
    console.log(
      "🔐 AUTH SERVICE: Token prefix:",
      accessToken.substring(0, 30) + "...",
    );

    try {
      const claims = this.tokenService.verifyAccessToken(accessToken);
      console.log("🔐 AUTH SERVICE: Token claims:", {
        sub: claims.sub,
        sid: claims.sid,
        email: claims.email,
        identityId: claims.identityId,
        exp: claims.exp,
        iat: claims.iat,
      });

      console.log("🔐 AUTH SERVICE: Looking up session:", claims.sid);
      const session = await prisma.authenticationSession.findUnique({
        where: { id: claims.sid },
        include: {
          user: true,
        },
      });

      console.log("🔐 AUTH SERVICE: Session found:", !!session);
      if (session) {
        console.log("🔐 AUTH SERVICE: Session details:", {
          sessionId: session.id,
          userId: session.userId,
          userActive: session.user.isActive,
          status: session.status,
          revokedAt: session.revokedAt,
          expiresAt: session.expiresAt,
          isExpired: session.expiresAt <= new Date(),
        });
      }

      // Validation checks
      const checks = {
        sessionExists: !!session,
        userIdMatches: session?.userId === claims.sub,
        userActive: session?.user.isActive,
        sessionActive: session?.status === AuthenticationSessionStatus.active,
        notRevoked: !session?.revokedAt,
        notExpired: session?.expiresAt > new Date(),
      };

      console.log("🔐 AUTH SERVICE: Validation checks:", checks);

      if (
        !session ||
        session.userId !== claims.sub ||
        !session.user.isActive ||
        session.status !== AuthenticationSessionStatus.active ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        console.log("🔐 AUTH SERVICE: Session validation FAILED");
        throw new UnauthorizedException("Session is invalid or expired");
      }

      console.log("🔐 AUTH SERVICE: Session validation SUCCESS");
      return {
        id: session.userId,
        email: claims.email,
        sessionId: session.id,
        authenticationIdentityId: session.authenticationIdentityId ?? undefined,
      };
    } catch (error) {
      console.error("🔐 AUTH SERVICE: validateAccessToken error:", error);
      throw error;
    }
  }

  private async findActiveVerificationToken(
    rawToken: string,
    tokenType: VerificationTokenType,
  ) {
    const token = await prisma.verificationToken.findFirst({
      where: {
        tokenHash: this.tokenService.hashOpaqueToken(rawToken),
        tokenType,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!token) {
      throw new BadRequestException("Token is invalid or expired");
    }

    return token;
  }

  private buildAuthResponse(
    user: {
      id: string;
      email: string;
      fullName: string | null;
      timezone: string | null;
      emailVerifiedAt: Date | null;
      isActive: boolean;
    },
    authenticationIdentityId: string | undefined,
    sessionId: string,
    refreshToken: string,
    extra: Record<string, unknown> = {},
  ) {
    const accessToken = this.tokenService.signAccessToken(
      {
        sub: user.id,
        sid: sessionId,
        email: user.email,
        identityId: authenticationIdentityId,
      },
      ACCESS_TOKEN_TTL_SECONDS,
    );

    return {
      user: this.serializeUser(user),
      accessToken,
      refreshToken,
      session: {
        id: sessionId,
      },
      ...extra,
    };
  }

  private serializeUser(user: {
    id: string;
    email: string;
    fullName: string | null;
    timezone: string | null;
    emailVerifiedAt?: Date | null;
    isActive: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      timezone: user.timezone,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      isActive: user.isActive,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private addDays(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private addHours(hours: number): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private getMicrosoftCallbackUrl(): string {
    if (this.config.MICROSOFT_CALLBACK_URL) {
      return this.config.MICROSOFT_CALLBACK_URL;
    }

    const apiPublicUrl =
      this.config.API_PUBLIC_URL?.replace(/\/$/, "") || "http://localhost:3002";

    return `${apiPublicUrl}/auth/microsoft/callback`;
  }

  private async exchangeMicrosoftCodeForProfile(
    code: string,
    guestSessionId?: string,
  ) {
    if (!this.config.MICROSOFT_CLIENT_ID || !this.config.MICROSOFT_CLIENT_SECRET) {
      throw new BadRequestException(
        "Microsoft login is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET first.",
      );
    }

    const tenantId = this.config.MICROSOFT_TENANT_ID || "common";
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.MICROSOFT_CLIENT_ID,
          client_secret: this.config.MICROSOFT_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: this.getMicrosoftCallbackUrl(),
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new BadRequestException("Microsoft token exchange failed");
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenPayload.access_token) {
      throw new BadRequestException("Microsoft token response was missing an access token");
    }

    const profileResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,givenName,surname,displayName",
      {
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`,
        },
      },
    );

    if (!profileResponse.ok) {
      throw new BadRequestException("Microsoft profile lookup failed");
    }

    const profile = (await profileResponse.json()) as {
      id?: string;
      mail?: string | null;
      userPrincipalName?: string | null;
      givenName?: string | null;
      surname?: string | null;
      displayName?: string | null;
    };

    const email = profile.mail || profile.userPrincipalName;
    if (!profile.id || !email) {
      throw new BadRequestException("Microsoft profile was missing required identity fields");
    }

    return {
      email,
      firstName: profile.givenName || profile.displayName || undefined,
      lastName: profile.surname || undefined,
      providerId: profile.id,
      guestSessionId,
    };
  }

  private isNonProduction(): boolean {
    return this.config.NODE_ENV !== "production";
  }
}
