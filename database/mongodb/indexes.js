// Chrono MongoDB indexes for DB3 (chrono_news)
db = db.getSiblingDB("chrono_news");

db.news_articles.createIndex({ headline: "text", body: "text" });
db.news_articles.createIndex({ iso_code: 1, published_at: -1 });
