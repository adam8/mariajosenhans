DROP TABLE IF EXISTS Pics;
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

CREATE TABLE Pics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL,                       -- which Page this picture belongs to (gallery)
    filename TEXT NOT NULL,                         -- path or filename of the picture (e.g. "/static/img/xyz.jpg" or "xyz.jpg")
    caption TEXT DEFAULT NULL,                      -- optional caption
    sequence INTEGER DEFAULT 0,                     -- ordering within the gallery
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES Pages(id) ON DELETE CASCADE
);

INSERT INTO Pages (id, title, content, slug, sequence) VALUES 
    (1, 'Alfreds Futterkiste', 'Maria Anders', 'maria', 1), 
    (4, 'Around the Horn', 'Thomas Hardy', 'thomas', 2), 
    (11, 'Bs Beverages', 'Victoria Ashworth', 'victoria', 3), 
    (13, 'Bs Beverages', 'Random Name', 'random', 4);

INSERT INTO Pics (page_id, filename, alt, caption, sequence) VALUES
    (1,  'static/img/maria-1.jpg', 'Portrait of Maria', 1),
    (1,  'static/img/maria-2.jpg', 'At a workshop', 2),
    (4,  'static/img/thomas-1.jpg', 'Cover image', 1),
    (11, 'static/img/victoria-1.jpg', 'Headshot', 1);
