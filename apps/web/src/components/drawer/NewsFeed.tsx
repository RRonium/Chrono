export type NewsItem = { id: string; title: string; publishedAt: string };

export function NewsFeed({ items = [] }: { items?: NewsItem[] }) {
  return <section aria-label="News feed"><ul>{items.map((item) => <li key={item.id}>{item.title}</li>)}</ul></section>;
}
