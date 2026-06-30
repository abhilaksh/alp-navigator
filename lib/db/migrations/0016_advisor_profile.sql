CREATE TABLE IF NOT EXISTS advisor_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL UNIQUE,
  display_name VARCHAR(100),
  agency_name VARCHAR(150),
  tagline VARCHAR(255),
  email VARCHAR(255),
  whatsapp_number VARCHAR(30),
  fora_advisor_id VARCHAR(100),
  virtuoso_membership VARCHAR(100),
  iata_number VARCHAR(30),
  quote_footer TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id)
);
