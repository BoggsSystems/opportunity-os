export interface SocialConnectorCredentials {
  accessToken: string;
}

export interface TechnicalProfileData {
  externalId: string;
  username: string;
  bio?: string;
  languages: string[];
  totalStars: number;
  totalRepos: number;
  contributionDensity?: number;
  metadata?: any;
}

export interface SocialProvider {
  readonly providerName: string;
  getProfile(credentials: SocialConnectorCredentials): Promise<TechnicalProfileData>;
  test(credentials: SocialConnectorCredentials): Promise<{ ok: boolean; username?: string; rawResponse?: any }>;
}
