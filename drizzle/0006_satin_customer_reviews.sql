CREATE TABLE product_reviews (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX product_reviews_product_idx ON product_reviews(product_id,created_at);
--> statement-breakpoint
CREATE TABLE digital_files (id TEXT PRIMARY KEY NOT NULL, rule_id TEXT NOT NULL, object_key TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
