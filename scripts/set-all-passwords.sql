-- Migration: Set all user passwords to NombreApellido (no spaces)
-- Generated: 2026-02-09
-- Passwords are bcrypt hashed with 10 salt rounds
--
-- USAGE: Run this SQL against the production Neon database
-- via Railway console or Neon SQL Editor
--
-- Password format: First name + Last name, no spaces
-- Example: "Omar Navarro" -> password is "OmarNavarro"
-- Special case: "Admin" -> password is "AdminAdmin"

BEGIN;

-- Admin -> password: AdminAdmin
UPDATE users SET password = '$2b$10$zXFptbJKRyqAW79mmq6MRuV96KENCcQp2aFfzZffmA6vuds5/fHqq' WHERE id = 1;

-- Daniel Martinez -> password: DanielMartinez
UPDATE users SET password = '$2b$10$NNnjnltwCt9qPR1bKwARTeRQeKUFXD5505BpZM7L.gDn/I9Bmi.22' WHERE id = 23;

-- Test User -> password: TestUser
UPDATE users SET password = '$2b$10$tm0CKzXolqX5W6k3v9jxHuM3.wlDBWkfc6PXezfLoyc7Ko.oPSKTm' WHERE id = 22;

-- Mario Reynoso -> password: MarioReynoso
UPDATE users SET password = '$2b$10$SBV/Z1Db.qPT0ol7RnWfj.2UKIeQ5BGTYc.i/HP55tXwRcK78neBm' WHERE id = 12;

-- Omar Navarro -> password: OmarNavarro
UPDATE users SET password = '$2b$10$tTudavIZ2HkEDcvF0nDok.e/mWLkKxpH0qfPoimNPHTe9n65Jf54e' WHERE id = 4;

-- Guillermo Galindo -> password: GuillermoGalindo
UPDATE users SET password = '$2b$10$l3/9jaF9yQg5P4U7iJNc2uB5VKYYFjWc/iwaBXKbK/kHUBm2sRcwu' WHERE id = 10;

-- Miranda de Koster -> password: MirandadeKoster
UPDATE users SET password = '$2b$10$zQ0fAPD1KOeJBOI767jcse3SJl3cwtcyVzB/MciKOJfGt/Mo68OZy' WHERE id = 8;

-- Test Usuario Corregido -> password: TestUsuarioCorregido
UPDATE users SET password = '$2b$10$F4.4z4g2M2VKEGpNtVvjvOrxv8wxeV4mprnPTsNyes6TY1G4yI9Z.' WHERE id = 24;

-- Alejandra Palomera -> password: AlejandraPalomera
UPDATE users SET password = '$2b$10$Pw0omUih59bGagcQP65bHeBLaNpUZabBDmquwdWtNFMEl2tUJAIX2' WHERE id = 21;

-- Jesus Daniel Marquez -> password: JesusDanielMarquez
UPDATE users SET password = '$2b$10$LNah86GrszNjvewX1D3a/OVcWA5CrKNMAd0T5iUlPe8ee8SxsZPN2' WHERE id = 7;

-- Dolores Navarro -> password: DoloresNavarro
UPDATE users SET password = '$2b$10$mkyRIvL5bXLrvowFSdt9feJb19jKNilj2kHF6p0bJZ/Ocj7FiFzIa' WHERE id = 6;

-- Andrea Navarro -> password: AndreaNavarro
UPDATE users SET password = '$2b$10$h5NV7b9JR50RcdrrX4IdkO2bfu1p5Ml9Or2d.k4BHlQXBliFocY0e' WHERE id = 7;

-- Julio Martell -> password: JulioMartell
UPDATE users SET password = '$2b$10$9R4YtiP8SgzK.iSZMfc0Ye6Jr/D1BBnQIqWHH5Y6/6twEX2mdKO7G' WHERE id = 11;

-- Jesus Espinoza -> password: JesusEspinoza
UPDATE users SET password = '$2b$10$oMNbFp0ChyThrGLIAUON6.63wUnPo9epbvV5nGKG/Ia3IxDl31jx6' WHERE id = 9;

COMMIT;
