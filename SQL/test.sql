INSERT INTO Pazienti ( nome, cognome, email, data_nascita, password, genere, altezza, peso, diagnosi)
VALUES
('Mario', 'Neri', 'mario.neri@example.com', '1993-01-01', 'password', 'M', 1.75, 67.0, 'Diagnosi esempio'),
('Carlo', 'Bianchi', 'carlo.bianchi@example.com', '1996-03-01', 'password', 'M', 1.8, 62.0, 'Diagnosi esempio');

INSERT INTO Trattamenti (paziente_id, fisioterapista_id, data_inizio)
VALUES
(3, 3, '2023-01-01');
(4, 3, '2023-01-01');