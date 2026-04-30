import { Injectable } from '@nestjs/common';
import {
  SocialConnectorCredentials,
  SocialProvider,
  TechnicalProfileData,
} from './social-provider.interface';

@Injectable()
export class GithubProvider implements SocialProvider {
  readonly providerName = 'github' as const;

  async getProfile(credentials: SocialConnectorCredentials): Promise<TechnicalProfileData> {
    const accessToken = this.requireAccessToken(credentials);
    
    // 1. Get User Profile
    const userResp = await fetch('https://api.github.com/user', {
      headers: { 
        Authorization: `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Opportunity-OS'
      },
    });
    const user = await this.readJson(userResp);
    if (!userResp.ok) throw new Error(this.errorMessage('GitHub profile fetch failed', userResp.status, user));

    // 2. Get Repos for Language Analysis
    const reposResp = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: { 
        Authorization: `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Opportunity-OS'
      },
    });
    const repos = await this.readJson(reposResp);
    
    // 3. Get Star count (approximate via starred list)
    const starredResp = await fetch('https://api.github.com/user/starred?per_page=1', {
      headers: { 
        Authorization: `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Opportunity-OS'
      },
    });
    // GitHub returns total in Link header for pagination, but for now we'll just use a basic check
    const starCount = parseInt(starredResp.headers.get('link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '0');

    const languages = this.aggregateLanguages(repos);

    return {
      externalId: String(user.id),
      username: user.login,
      bio: user.bio,
      languages,
      totalStars: starCount,
      totalRepos: user.public_repos + (user.total_private_repos || 0),
      metadata: {
        company: user.company,
        location: user.location,
        blog: user.blog,
        twitter_username: user.twitter_username,
        followers: user.followers,
        following: user.following,
      },
    };
  }

  async test(credentials: SocialConnectorCredentials) {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://api.github.com/user', {
      headers: { 
        Authorization: `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Opportunity-OS'
      },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('GitHub connector test failed', response.status, payload));
    }
    return { ok: true, username: payload.login, rawResponse: payload };
  }

  private aggregateLanguages(repos: any[]): string[] {
    const langMap = new Map<string, number>();
    for (const repo of repos || []) {
      if (repo.language) {
        langMap.set(repo.language, (langMap.get(repo.language) || 0) + 1);
      }
    }
    // Sort by frequency
    return Array.from(langMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);
  }

  private requireAccessToken(credentials: SocialConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('GitHub connector is missing an access token');
    }
    return credentials.accessToken;
  }

  private async readJson(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private errorMessage(prefix: string, status: number, payload: any) {
    const detail = payload?.message ?? JSON.stringify(payload);
    return `${prefix}: ${status}${detail ? ` ${detail}` : ''}`;
  }
}
