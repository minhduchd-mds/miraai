export interface WeatherData {
  city: string;
  temp: number;
  desc: string;
  emoji: string;
  wind: number;
  humidity: number;
}

export interface ResultCardData {
  title: string;
  body?: string;
  eyebrow?: string;
  meta?: string[];
}

export interface ResultListData {
  title: string;
  items: Array<{ title: string; subtitle?: string }>;
}

/** Generic visual output contract between skills and the product Result Surface. */
export type ResultView =
  | { kind: 'weather'; data: WeatherData }
  | { kind: 'image'; data: { prompt: string; url: string } }
  | { kind: 'card'; data: ResultCardData }
  | { kind: 'list'; data: ResultListData };
