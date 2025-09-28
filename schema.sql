DROP TABLE IF EXISTS Pages;
CREATE TABLE Pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    sequence INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO Pages (id, title, content, slug, sequence) VALUES 
    (1, 'Alfreds Futterkiste', 'Maria Anders', 'maria', 1), 
    (4, 'Around the Horn', 'Thomas Hardy', 'thomas', 2), 
    (11, 'Bs Beverages', 'Victoria Ashworth', 'victoria', 3), 
    (13, 'Bs Beverages', 'Random Name', 'random', 4);
