import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly apiKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TAVILY_API_KEY');
  }

  async search(query: string, options: { maxResults?: number; searchDepth?: 'basic' | 'advanced' } = {}): Promise<SearchResult[]> {
    if (!this.apiKey) {
      this.logger.warn('TAVILY_API_KEY is not configured. Search will return empty results.');
      return [];
    }

    try {
      this.logger.log(`Performing web search for: "${query}"`);
      
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query,
          search_depth: options.searchDepth ?? 'basic',
          max_results: options.maxResults ?? 5,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Tavily API error: ${response.status} - ${error}`);
        return [];
      }

      const data = await response.json() as any;
      const results: SearchResult[] = (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      }));

      this.logger.log(`Search completed: ${results.length} results found.`);
      return results;
    } catch (error) {
      this.logger.error('Failed to perform web search', error);
      return [];
    }
  }

  /**
   * Specifically optimized for finding recruiters or job opportunities
   */
  async searchOpportunities(mission: string): Promise<SearchResult[]> {
    const searchQuery = `${mission} recruiters hiring greenfield 2024 2025`;
    return this.search(searchQuery, { searchDepth: 'advanced', maxResults: 10 });
  }
}
