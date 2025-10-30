DROP DATABASE IF EXISTS flexifisio_db;
CREATE DATABASE IF NOT EXISTS flexifisio_db;

USE flexifisio_db;

SET GLOBAL event_scheduler = ON; -- Mi serve per la pulizia automatica della tabella refresh token

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

-- Ho creato questa tablella per avere una gestione dei refresh token unica per entrambi gli utenti
-- Nel caso vedi come l'ho usata io nell'authController pazienti e se qualcosa chiedimi.

-- Tabella refresh token
CREATE TABLE refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT,
  token_hash VARCHAR(512) NOT NULL UNIQUE,
  id_user INT NOT NULL,
  user_type ENUM('P','F') NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY(id)
);

CREATE EVENT IF NOT EXISTS cleanup_expired_refresh_tokens
ON SCHEDULE EVERY 1 HOUR
DO
DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = 1;

--

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
    DECLARE id_appuntamento INT;

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
    WHERE data_appuntamento = NEW.data_appuntamento AND ora_appuntamento = NEW.ora_appuntamento AND id != OLD.id;

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
    immagine VARCHAR(255),
    video VARCHAR(255),
    fisioterapista_id INT NOT NULL,
    FOREIGN KEY (fisioterapista_id) REFERENCES Fisioterapisti(id)
);

-- Tabella relazionale scheda-allenamento-esercizi
CREATE TABLE SchedaEsercizi (
    scheda_id INT NOT NULL,
    esercizio_id INT NOT NULL,
    ripetizioni INT NOT NULL,
    serie INT NOT NULL,
    PRIMARY KEY (scheda_id, esercizio_id),
    FOREIGN KEY (scheda_id) REFERENCES SchedeAllenamento(id) ON DELETE CASCADE,
    FOREIGN KEY (esercizio_id) REFERENCES Esercizi(id)
);

-- sessioni di allenamento
CREATE TABLE SessioniAllenamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paziente_id INT NOT NULL,
    fisioterapista_id INT NOT NULL,
    scheda_id INT NOT NULL,
    data_sessione DATETIME DEFAULT CURRENT_TIMESTAMP,
    sondaggio JSON, -- contiene le risposte del paziente alla fine
    FOREIGN KEY (paziente_id) REFERENCES Pazienti(id),
    FOREIGN KEY (fisioterapista_id) REFERENCES Fisioterapisti(id),
    FOREIGN KEY (scheda_id) REFERENCES SchedeAllenamento(id)
);

-- esercizi svolti durante la sessione
CREATE TABLE SessioneEsercizi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sessione_id INT NOT NULL,
    esercizio_id INT NOT NULL,
    ripetizioni_effettive INT,
    serie_effettive INT,
    note TEXT,
    FOREIGN KEY (sessione_id) REFERENCES SessioniAllenamento(id) ON DELETE CASCADE,
    FOREIGN KEY (esercizio_id) REFERENCES Esercizi(id)
);