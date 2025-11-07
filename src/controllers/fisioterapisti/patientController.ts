import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// ricerca paziente
export const handleGetPatient = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const pazienteId = req.params.id;

        // Caso 1: Recupera tutti i pazienti associati al fisioterapista con trattamenti in corso
        if (pazienteId === undefined) {
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT Pazienti.id, Pazienti.nome, Pazienti.cognome FROM Trattamenti JOIN Pazienti ON Trattamenti.paziente_id = Pazienti.id WHERE Trattamenti.fisioterapista_id = ? AND Trattamenti.in_corso=1;",
                [fisioterapistaId]
            );
            if (rows.length === 0) {
                // Nessun paziente trovato, ma la richiesta è valida (lista vuota)
                return res.status(204).send();
            } else {
                return res.status(200).json(rows);
            }
        }
        // Caso 2: Recupera un paziente specifico per ID
        else {
            // Verifica che esista un trattamento (attivo o terminato) per il paziente e il fisioterapista
            const [rows_trattamenti] = await pool.query<RowDataPacket[]>(
                "SELECT in_corso FROM Trattamenti WHERE paziente_id = ? AND fisioterapista_id = ?;",
                [pazienteId, fisioterapistaId]
            );

            if (rows_trattamenti.length === 0) {
                // Paziente non trovato o non associato al fisioterapista
                return res.status(404).json({
                    message:
                        "Paziente non trovato o non associato a questo fisioterapista.",
                });
            }

            if (rows_trattamenti[0].in_corso === 0) {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT 
                        Pazienti.id, Pazienti.email, Pazienti.nome, Pazienti.cognome, Pazienti.data_nascita, Pazienti.genere, Pazienti.altezza, Pazienti.peso, Pazienti.diagnosi, 
                        Trattamenti.data_inizio, Trattamenti.data_fine,
                        COUNT(CASE WHEN Appuntamenti.data_appuntamento < CURRENT_DATE THEN 1 ELSE NULL END) as sedute_effettuate
                    FROM Trattamenti 
                    JOIN Pazienti ON Trattamenti.paziente_id = Pazienti.id 
                    LEFT JOIN Appuntamenti ON Trattamenti.id = Appuntamenti.trattamento_id
                    WHERE Trattamenti.fisioterapista_id = ? AND Pazienti.id = ?
                    GROUP BY Pazienti.id, Trattamenti.id;`,
                    [fisioterapistaId, pazienteId]
                );
                if (rows.length === 0) {
                    return res.status(404).json({
                        message: "Dettagli paziente non trovati",
                    });
                }

                return res.status(200).json(rows[0]);
            }

            // Recupera i dettagli completi del paziente
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT 
                        Pazienti.id, Pazienti.email, Pazienti.nome, Pazienti.cognome, Pazienti.data_nascita, Pazienti.genere, Pazienti.altezza, Pazienti.peso, Pazienti.diagnosi, 
                        Trattamenti.data_inizio,
                        COUNT(CASE WHEN Appuntamenti.data_appuntamento < CURRENT_DATE THEN 1 ELSE NULL END) as sedute_effettuate
                    FROM Trattamenti 
                    JOIN Pazienti ON Trattamenti.paziente_id = Pazienti.id 
                    LEFT JOIN Appuntamenti ON Trattamenti.id = Appuntamenti.trattamento_id
                    WHERE Trattamenti.fisioterapista_id = ? AND Pazienti.id = ? AND Trattamenti.in_corso = 1 
                    GROUP BY Pazienti.id, Trattamenti.id;`,
                [fisioterapistaId, pazienteId]
            );

            if (rows.length === 0) {
                // Questo caso dovrebbe essere raro se i controlli precedenti sono passati, ma per sicurezza
                return res.status(404).json({
                    message:
                        "Dettagli paziente non trovati nonostante il trattamento in corso.",
                });
            }

            return res.status(200).json(rows[0]); // Restituisce il primo (e unico) risultato
        }
    } catch (error) {
        console.error("Errore in handleGetPatient:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la ricerca del paziente: " +
                err.message,
        });
    }
};

// fine trattamento
export const handleEndTreatment = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const pazienteId = parseInt(req.params.id);

        // Aggiorna lo stato del trattamento nel database
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Trattamenti SET data_fine = CURRENT_DATE, in_corso = FALSE WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, pazienteId]
        );

        if (result.affectedRows === 0) {
            // Nessun trattamento corrispondente trovato per l'aggiornamento
            return res.status(404).json({
                message:
                    "Nessun trattamento attivo trovato per questo paziente e fisioterapista.",
            });
        }

        return res
            .status(200)
            .json({ message: "Trattamento terminato con successo." });
    } catch (error) {
        console.error("Errore in handleEndTreatment:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la terminazione del trattamento: " +
                err.message,
        });
    }
};

// inizia trattamento
export const handleNewPatient = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const {
            nome,
            cognome,
            email,
            data_nascita,
            genere,
            altezza,
            peso,
            diagnosi,
        } = req.body;

        // Validazione dei parametri obbligatori
        if (!nome || !cognome || !email || !data_nascita || !genere) {
            return res.status(400).json({
                message:
                    "Parametri obbligatori mancanti: nome, cognome, email, data_nascita, genere.",
            });
        }

        // Cerca se il paziente esiste già tramite email
        const [existingPatients] = await pool.query<RowDataPacket[]>(
            "SELECT Pazienti.id FROM Pazienti WHERE Pazienti.email = ?;",
            [email]
        );

        let currentPazienteId: number;

        if (existingPatients.length === 0) {
            // Il paziente non esiste, lo creiamo
            const [insertPatientResult] = await pool.query<ResultSetHeader>(
                "INSERT INTO Pazienti (nome, cognome, email, data_nascita, genere, altezza, peso, diagnosi) VALUES (?,?,?,?,?,?,?,?);",
                [
                    nome,
                    cognome,
                    email,
                    data_nascita,
                    genere,
                    altezza,
                    peso,
                    diagnosi,
                ]
            );

            if (insertPatientResult.affectedRows === 0) {
                return res.status(500).json({
                    message:
                        "Errore interno del server: impossibile registrare il nuovo paziente.",
                });
            }
            currentPazienteId = insertPatientResult.insertId;

            // Crea un nuovo trattamento per il paziente appena creato
            const [insertTreatmentResult] = await pool.query<ResultSetHeader>(
                "INSERT INTO Trattamenti (fisioterapista_id, paziente_id, data_inizio) VALUES (?,?, CURRENT_DATE);",
                [fisioterapistaId, currentPazienteId]
            );

            if (insertTreatmentResult.affectedRows === 0) {
                return res.status(500).json({
                    message:
                        "Errore interno del server: impossibile avviare il trattamento per il nuovo paziente.",
                });
            }

            return res.status(201).json({
                message:
                    "Nuovo paziente registrato e trattamento avviato con successo.",
            });
        } else {
            // Il paziente esiste già, creiamo un nuovo trattamento e aggiorniamo i suoi dati
            currentPazienteId = existingPatients[0].id;

            // Verifica se esiste già un trattamento in corso tra questo fisioterapista e questo paziente
            const [existingTreatment] = await pool.query<RowDataPacket[]>(
                "SELECT id FROM Trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
                [fisioterapistaId, currentPazienteId]
            );

            if (existingTreatment.length > 0) {
                return res.status(409).json({
                    message:
                        "Esiste già un trattamento in corso per questo paziente con te.",
                });
            }

            // Crea un nuovo trattamento
            await pool.query<ResultSetHeader>(
                "INSERT INTO Trattamenti (fisioterapista_id, paziente_id, data_inizio) VALUES (?,?, CURRENT_DATE);",
                [fisioterapistaId, currentPazienteId]
            );

            // Aggiorna i dati del paziente (altezza, peso, diagnosi)
            const [update] = await pool.query<ResultSetHeader>(
                "UPDATE Pazienti SET altezza = ?, peso = ?, diagnosi = ? WHERE id = ?;",
                [altezza, peso, diagnosi, currentPazienteId]
            );

            return res.status(200).json({
                message:
                    "Trattamento avviato e dati paziente aggiornati con successo.",
            });
        }
    } catch (error) {
        console.error("Errore in handleNewPatient:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante l'inizio del trattamento o la registrazione del paziente: " +
                err.message,
        });
    }
};

// update dati del paziente
export const handleUpdatePatient = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const pazienteId = parseInt(req.params.id);
        const { altezza, peso, diagnosi } = req.body;

        // Controllo: serve almeno un parametro da modificare
        if (
            altezza === undefined &&
            peso === undefined &&
            diagnosi === undefined
        ) {
            return res
                .status(400)
                .json({ message: "Nessun parametro da modificare fornito." });
        }

        // Verifica che esista un trattamento (attivo o terminato) per il paziente e il fisioterapista
        const [rows_trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT in_corso FROM Trattamenti WHERE paziente_id = ? AND fisioterapista_id = ?;",
            [pazienteId, fisioterapistaId]
        );

        if (!rows_trattamenti.length) {
            // Paziente non trovato o non associato al fisioterapista
            return res.status(404).json({
                message:
                    "Paziente non trovato o non associato a questo fisioterapista.",
            });
        }

        if (rows_trattamenti[0].in_corso === 0) {
            // Il trattamento è terminato, non è possibile aggiornare i dati in questo contesto
            return res.status(403).json({
                message:
                    "Il trattamento per questo paziente è terminato, impossibile aggiornare i dati.",
            });
        }

        // Costruzione query dinamica
        const fields: string[] = [];
        const values: any[] = [];

        if (altezza !== undefined) {
            fields.push("altezza = ?");
            values.push(altezza);
        }
        if (peso !== undefined) {
            fields.push("peso = ?");
            values.push(peso);
        }
        if (diagnosi !== undefined) {
            fields.push("diagnosi = ?");
            values.push(diagnosi);
        }

        values.push(pazienteId);

        const updateQuery = `
            UPDATE pazienti
            SET ${fields.join(", ")}
            WHERE id = ?;
        `;

        const [updateResult] = await pool.query<ResultSetHeader>(
            updateQuery,
            values
        );

        if (updateResult.affectedRows === 0) {
            // Se affectedRows è 0, potrebbe significare che i dati forniti erano identici a quelli esistenti
            return res.status(200).json({
                message:
                    "Nessuna modifica effettuata: i dati forniti sono identici a quelli esistenti.",
            });
        }

        return res
            .status(200)
            .json({ message: "Dati paziente modificati con successo." });
    } catch (error) {
        console.error("Errore in handleUpdatePatient:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la modifica dei dati del paziente: " +
                err.message,
        });
    }
};

// visualizza i pazienti con cui ha terminato il trattamento
export const handleGetTerminatedPatients = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;

        // Seleziona i pazienti associati al fisioterapista con trattamenti non più in corso
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT P.id, P.nome, P.cognome, T.data_fine
             FROM Pazienti P
             JOIN Trattamenti T ON P.id = T.paziente_id
             WHERE T.fisioterapista_id = ? AND T.in_corso = 0;`,
            [fisioterapistaId]
        );

        if (rows.length === 0) {
            // La richiesta è valida, ma non ci sono pazienti con trattamenti terminati
            return res.status(204).send();
        }

        return res.status(200).json(rows);
    } catch (error) {
        console.error("Errore in handleGetTerminatedPatients:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero dei pazienti con trattamenti terminati: " +
                err.message,
        });
    }
};
