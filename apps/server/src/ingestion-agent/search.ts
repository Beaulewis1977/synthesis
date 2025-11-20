export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    metatags?: Array<{ [key: string]: string }>;
  };
}

interface GoogleSearchResponse {
  items?: SearchResult[];
  error?: {
    code: number;
    message: string;
  };
}

export async function searchGoogle(query: string, limit = 10): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    throw new Error(
      'Google Search configuration missing (GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX)'
    );
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('cx', cx);
  url.searchParams.append('q', query);
  url.searchParams.append('num', Math.min(limit, 10).toString()); // API max is 10

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Search API failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as GoogleSearchResponse;

    if (data.error) {
      throw new Error(`Google Search API error: ${data.error.message}`);
    }

    return data.items || [];
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}
