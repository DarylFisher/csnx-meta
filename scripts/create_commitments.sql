CREATE TABLE IF NOT EXISTS pmopt.commitments (
    commitment_id   INTEGER NOT NULL PRIMARY KEY,
    description     TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    resource_count  INTEGER NOT NULL,
    color           TEXT
);
