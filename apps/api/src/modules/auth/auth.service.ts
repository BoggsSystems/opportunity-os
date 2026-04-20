import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthenticationSessionStatus,
  VerificationTokenType,
  prisma,
} from '@opportunity-os/db';
import { getConfig } from '@opportunity-os/config';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_HOURS,
  REFRESH_TOKEN_TTL_DAYS,
  VERIFICATION_TOKEN_TTL_HOURS,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/signup.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly config = getConfig();

  constructor(
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async signUp(dto: SignUpDto) {
    const email = this.normalizeEmail(dto.email);

    const existingIdentity = await prisma.authenticationIdentity.findUnique({
      where: {
        emailNormalized: email,
      },
    });

    if (existingIdentity) {
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const verificationToken = this.tokenService.generateOpaqueToken();
    const verificationTokenHash = this.tokenService.hashOpaqueToken(verificationToken);
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
          credentialType: 'password',
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
          clientType: 'api',
          refreshTokenHash,
          expiresAt: sessionExpiresAt,
          lastUsedAt: new Date(),
        },
      });

      if (dto.guestSessionId) {
        await tx.goal.updateMany({
          where: { guestSessionId: dto.guestSessionId, userId: null },
          data: { userId: user.id },
        });

        await tx.strategicCampaign.updateMany({
          where: { guestSessionId: dto.guestSessionId, userId: null },
          data: { userId: user.id },
        });

        await tx.aIConversation.updateMany({
          where: { guestSessionId: dto.guestSessionId, userId: null },
          data: { userId: user.id },
        });
      }

      return {
        user,
        identity,
        session,
      };
    });

    return this.buildAuthResponse(result.user, result.identity.id, result.session.id, refreshToken, {
      ...(this.isNonProduction() ? { verificationToken } : {}),
    });
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordCredential = identity.credentials.find(
      (credential) => credential.credentialType === 'password' && credential.passwordHash,
    );

    if (!passwordCredential?.passwordHash) {
      throw new UnauthorizedException('Password sign-in is not configured for this account');
    }

    const passwordMatches = await this.passwordService.verifyPassword(dto.password, passwordCredential.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = this.tokenService.generateOpaqueToken();
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const sessionExpiresAt = this.addDays(REFRESH_TOKEN_TTL_DAYS);

    const session = await prisma.authenticationSession.create({
      data: {
        userId: identity.user.id,
        authenticationIdentityId: identity.id,
        clientType: 'api',
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

    return this.buildAuthResponse(identity.user, identity.id, session.id, refreshToken);
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
      throw new UnauthorizedException('Refresh token is invalid or expired');
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
      throw new UnauthorizedException('No active session to revoke');
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
      throw new UnauthorizedException('No authenticated user found');
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
      throw new UnauthorizedException('No authenticated user found');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        plan: {
          include: {
            planFeatures: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
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
    const token = await this.findActiveVerificationToken(dto.token, VerificationTokenType.password_reset);
    if (!token.authenticationIdentityId) {
      throw new BadRequestException('Password reset token is not associated with an identity');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.newPassword);

    await prisma.$transaction(async (tx) => {
      const existingCredential = await tx.credential.findFirst({
        where: {
          authenticationIdentityId: token.authenticationIdentityId!,
          credentialType: 'password',
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
            credentialType: 'password',
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
    const token = await this.findActiveVerificationToken(dto.token, VerificationTokenType.email_verify);
    if (!token.userId || !token.authenticationIdentityId) {
      throw new BadRequestException('Verification token is not associated with a user identity');
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
    const claims = this.tokenService.verifyAccessToken(accessToken);
    const session = await prisma.authenticationSession.findUnique({
      where: { id: claims.sid },
      include: {
        user: true,
      },
    });

    if (
      !session ||
      session.userId !== claims.sub ||
      !session.user.isActive ||
      session.status !== AuthenticationSessionStatus.active ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    return {
      id: session.userId,
      email: claims.email,
      sessionId: session.id,
      authenticationIdentityId: session.authenticationIdentityId ?? undefined,
    };
  }

  private async findActiveVerificationToken(rawToken: string, tokenType: VerificationTokenType) {
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
      throw new BadRequestException('Token is invalid or expired');
    }

    return token;
  }

  private buildAuthResponse(
    user: { id: string; email: string; fullName: string | null; timezone: string | null; emailVerifiedAt: Date | null; isActive: boolean },
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

  private isNonProduction(): boolean {
    return this.config.NODE_ENV !== 'production';
  }
}
