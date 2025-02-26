DROP DATABASE IF EXISTS flexifisio_db;
CREATE DATABASE IF NOT EXISTS flexifisio_db;

USE flexifisio_db;

-- Tabella pazienti
CREATE TABLE Pazienti (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    cognome VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    data_nascita DATE NOT NULL,
    password VARCHAR(255),
    genere ENUM('M', 'F', 'Altro'),
    altezza DECIMAL(4,1),
    peso DECIMAL(5,2),
    diagnosi TEXT
);

-- Tabella fisioterapisti
CREATE TABLE Fisioterapisti (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    cognome VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    refreshToken VARCHAR(255) UNIQUE NULL
);


-- Tabella trattamenti
CREATE TABLE Trattamenti (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paziente_id INT NOT NULL,
    fisioterapista_id INT NOT NULL,
    data_inizio DATE NOT NULL,
    data_fine DATE,
    in_corso BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (paziente_id) REFERENCES Pazienti(id),
    FOREIGN KEY (fisioterapista_id) REFERENCES Fisioterapisti(id),
    CHECK (data_fine IS NULL OR data_fine > data_inizio)
);


DELIMITER //
    
    CREATE TRIGGER check_trattamento
    BEFORE INSERT ON Trattamenti
    FOR EACH ROW
    BEGIN
        DECLARE existing_trattamento INT;
        DECLARE trattamento_in_corso BOOLEAN;
        
        SELECT COUNT(*) INTO existing_trattamento
        FROM Trattamenti
        WHERE paziente_id = NEW.paziente_id AND data_fine IS NULL;
        
        IF existing_trattamento > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Il trattamento precedente non è ancora terminato';
        ELSEIF (SELECT COUNT(*) FROM Trattamenti WHERE paziente_id = NEW.paziente_id AND data_fine > NEW.data_inizio) > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La data di inizio del nuovo trattamento non è compatibile con la data di termine del trattamento precedente';
        END IF;
    END;//
    
    DELIMITER ;


-- Tabella messaggi
CREATE TABLE Messaggi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    testo TEXT NOT NULL,
    data_invio DATETIME NOT NULL,
    trattamento_id INT NOT NULL,
    mittente ENUM('Paziente', 'Fisioterapista') NOT NULL,
    FOREIGN KEY (trattamento_id) REFERENCES Trattamenti(id)
);

DELIMITER //

CREATE TRIGGER check_trattamento_in_corso_messaggio
BEFORE INSERT ON Messaggi
FOR EACH ROW
BEGIN
    DECLARE trattamento_in_corso BOOLEAN;
    IF NEW.data_invio < CURRENT_DATE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La data del messaggio non può essere anteriore alla data corrente';
    END IF;
    SELECT in_corso INTO trattamento_in_corso
    FROM Trattamenti
    WHERE id = NEW.trattamento_id;
    
    IF trattamento_in_corso IS NULL OR trattamento_in_corso = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Il trattamento non è in corso';
    END IF;
END;//

DELIMITER ;

-- Tabella appuntamenti
CREATE TABLE Appuntamenti (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_appuntamento DATE NOT NULL,
    ora_appuntamento TIME NOT NULL,
    stato_conferma ENUM('Confermato', 'Non Confermato') DEFAULT 'Non Confermato',
    trattamento_id INT NOT NULL,
    FOREIGN KEY (trattamento_id) REFERENCES Trattamenti(id)
    
);

DELIMITER //

CREATE TRIGGER check_trattamento_in_corso_appuntamento
BEFORE INSERT ON Appuntamenti
FOR EACH ROW
BEGIN
    DECLARE trattamento_in_corso BOOLEAN;

    SELECT in_corso INTO trattamento_in_corso
    FROM Trattamenti
    WHERE id = NEW.trattamento_id;
    


    IF trattamento_in_corso IS NULL OR trattamento_in_corso = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Il trattamento non è in corso';
    END IF;
    
    IF (NEW.data_appuntamento < CURRENT_DATE) OR (NEW.data_appuntamento = CURRENT_DATE AND NEW.ora_appuntamento <= CURRENT_TIME()) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = "L\'appuntamento deve essere successivo alla data e ora attuale";
    END IF;
    
    IF id_appuntamento IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La data e l\'ora dell\'appuntamento sono gia state prese';
    END IF;
END;//

DELIMITER ;

DELIMITER //
CREATE TRIGGER check_data_occupata_appuntamento
BEFORE INSERT ON Appuntamenti
FOR EACH ROW
BEGIN
    DECLARE id_appuntamento INT;

    SELECT id INTO id_appuntamento
    FROM appuntamenti
    WHERE data_appuntamento=NEW.data_appuntamento AND ora_appuntamento=NEW.ora_appuntamento;

    IF id_appuntamento IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La data e l\'ora dell\'appuntamento sono gia state prese';
    END IF;
END;//    

DELIMITER //
CREATE TRIGGER check_data_occupata_appuntamento_update
BEFORE UPDATE ON Appuntamenti
FOR EACH ROW
BEGIN
    DECLARE id_appuntamento INT;

    SELECT id INTO id_appuntamento
    FROM appuntamenti
    WHERE data_appuntamento=NEW.data_appuntamento AND ora_appuntamento=NEW.ora_appuntamento;

    IF id_appuntamento IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La data e l\'ora dell\'appuntamento sono gia state prese';
    END IF;
END;//  


DELIMITER //
CREATE TRIGGER check_trattamento_in_corso_appuntamento_update
BEFORE UPDATE ON Appuntamenti
FOR EACH ROW
BEGIN
    DECLARE trattamento_in_corso BOOLEAN;
    
    SELECT in_corso INTO trattamento_in_corso
    FROM Trattamenti
    WHERE id = NEW.trattamento_id;
    
    IF trattamento_in_corso = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Il trattamento non è in corso';
    END IF;
    
    IF (NEW.data_appuntamento < CURRENT_DATE) OR (NEW.data_appuntamento = CURRENT_DATE AND NEW.ora_appuntamento <= CURRENT_TIME()) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = "L\'appuntamento deve essere successivo alla data e ora attuale";
    END IF;
    
END;//

DELIMITER ;

-- Tabella schede di allenamento
CREATE TABLE SchedeAllenamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trattamento_id INT NOT NULL,
    nome VARCHAR(50) NOT NULL,
    tipo_scheda ENUM('Clinica', 'Casa') NOT NULL,
    note VARCHAR(255),
    FOREIGN KEY (trattamento_id) REFERENCES Trattamenti(id)
);

DELIMITER //

CREATE TRIGGER check_trattamento_in_corso_scheda_allenamento_insert
BEFORE INSERT ON SchedeAllenamento
FOR EACH ROW
BEGIN
    DECLARE trattamento_in_corso BOOLEAN;
    
    SELECT in_corso INTO trattamento_in_corso
    FROM Trattamenti
    WHERE id = NEW.trattamento_id;
    
    IF trattamento_in_corso IS NULL OR trattamento_in_corso = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Il trattamento non è in corso';
    END IF;
END;//

DELIMITER ;

DELIMITER //

CREATE TRIGGER check_trattamento_in_corso_scheda_allenamento_update
BEFORE UPDATE ON SchedeAllenamento
FOR EACH ROW
BEGIN
    DECLARE trattamento_in_corso BOOLEAN;
    
    SELECT in_corso INTO trattamento_in_corso
    FROM Trattamenti
    WHERE id = NEW.trattamento_id;
    
    IF trattamento_in_corso IS NULL OR trattamento_in_corso = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Il trattamento non è in corso';
    END IF;
END;//

DELIMITER ;

-- Tabella esercizi
CREATE TABLE Esercizi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    descrizione TEXT NOT NULL,
    descrizione_svolgimento TEXT NOT NULL,
    consigli_svolgimento TEXT NOT NULL,
    video VARCHAR(255),
    fisioterapista_id INT NOT NULL,
    FOREIGN KEY (fisioterapista_id) REFERENCES Fisioterapisti(id)
);

-- Tabella relazionale scheda-allenamento-esercizi
CREATE TABLE SchedaEsercizi (
    scheda_id INT NOT NULL,
    esercizio_id INT NOT NULL,
    PRIMARY KEY (scheda_id, esercizio_id),
    FOREIGN KEY (scheda_id) REFERENCES SchedeAllenamento(id),
    FOREIGN KEY (esercizio_id) REFERENCES Esercizi(id)
);

INSERT INTO Fisioterapisti (nome, cognome, email, password)
VALUES
( 'Mario', 'Rossi', 'mario.rossi@example.com', 'password'),
( 'Luigi', 'Verdi', 'luigi.verdi@example.com', 'password');

INSERT INTO Pazienti ( nome, cognome, email, data_nascita, password, genere, altezza, peso, diagnosi)
VALUES
('Giorgio', 'Bianchi', 'giorgio.bianchi@example.com', '1990-01-01', 'password', 'M', 1.8, 70.0, 'Diagnosi esempio'),
( 'Marco', 'Neri', 'marco.neri@example.com', '1995-06-01', 'password', 'M', 1.7, 60.0, 'Diagnosi esempio');

-- Un paziente seguito da un fisioterapista
INSERT INTO Trattamenti (paziente_id, fisioterapista_id, data_inizio)
VALUES
(1, 1, '2023-01-01');

-- Lo stesso paziente non può essere seguito da un altro fisioterapista nello stesso periodo
-- Questa insert dovrebbe fallire a causa del trigger `before_insert_trattamento`
INSERT INTO Trattamenti (paziente_id, fisioterapista_id, data_inizio)
VALUES
(1, 2, '2023-01-01');

-- Aggiorna l'istanza con id paziente 1
UPDATE Trattamenti
SET data_fine = CURRENT_DATE, in_corso = FALSE
WHERE paziente_id = 1 AND fisioterapista_id = 1;

-- Crea una nuova istanza con fisioterapista 2 e data odierna
INSERT INTO Trattamenti (paziente_id, fisioterapista_id, data_inizio)
VALUES (1, 2, CURRENT_DATE);


-- Un fisioterapista può seguire più pazienti nello stesso periodo
INSERT INTO Trattamenti (paziente_id, fisioterapista_id, data_inizio)
VALUES
(2, 1, '2023-01-01');

select Pazienti.nome, Pazienti.cognome, Fisioterapisti.nome, Fisioterapisti.cognome, Trattamenti.*
from Pazienti join Trattamenti on Pazienti.id = Trattamenti.paziente_id join Fisioterapisti on Trattamenti.fisioterapista_id = Fisioterapisti.id;

insert into appuntamenti (data_appuntamento, ora_appuntamento,trattamento_id)
values ('2023-01-01', '15:00', 1);