// Chrono MongoDB indexes.
db.news.createIndex({ publishedAt: -1 });
db.news.createIndex({ countryCode: 1 });
