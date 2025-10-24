import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// ricerca paziente
export const handleGetPatient = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;

    const pazienteId = req.params.id;
    if (pazienteId === undefined) {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT Pazienti.id, Pazienti.nome, Pazienti.cognome FROM Trattamenti JOIN Pazienti ON Trattamenti.paziente_id = Pazienti.id WHERE Trattamenti.fisioterapista_id = ? AND Trattamenti.in_corso=1;",
            [fisioterapistaId]
        );
        if (rows.length === 0) {
            res.status(404).json({ message: "Nessun paziente trovato" });
        } else {
            res.status(200).json(rows);
        }
    } else {
        const [rows_trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT in_corso FROM Trattamenti WHERE paziente_id = ? AND fisioterapista_id = ?;",
            [pazienteId, fisioterapistaId]
        );
        if (rows_trattamenti.length === 0) {
            res.status(404).json({ message: "Nessun paziente trovato" });
        } else {
            if (rows_trattamenti[0].in_corso === 0) {
                res.status(404).json({ message: "Il trattamento è terminato" });
            } else {
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
                res.status(200).json(rows);
            }
        }
    }
};

// fine trattamento
export const handleEndTreatment = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const pazienteId = parseInt(req.params.id);
    try {
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Trattamenti SET data_fine = CURRENT_DATE, in_corso = FALSE WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, pazienteId]
        );

        if (result.affectedRows === 0) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else {
            res.status(200).json({ message: "Trattamento terminato" });
        }
    } catch (error) {
        res.status(500).json({
            message: "Errore nell'aggiornamento del trattamento",
        });
    }
};

// inizia trattamento
export const handleNewPatient = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const email = req.body.email;

    const { nome, cognome, data_nascita, genere, altezza, peso, diagnosi } =
        req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT Pazienti.id FROM Pazienti WHERE Pazienti.email = ?;",
        [email]
    );
    if (rows.length === 0) {
        // se il paziente non esiste lo creo
        const [result] = await pool.query<ResultSetHeader>(
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
        if (result.affectedRows === 0) {
            res.status(500).json({
                message: "Errore durante la registrazione",
            });
        } else {
            // trovo l'id del paziente appena creato
            const [newPaziente] = await pool.query<RowDataPacket[]>(
                "SELECT Pazienti.id FROM Pazienti WHERE Pazienti.email = ?;",
                [email]
            );
            // creo un trattamento con l'id del paziente appena creato
            const [trattamento] = await pool.query<ResultSetHeader>(
                "INSERT INTO Trattamenti (fisioterapista_id, paziente_id, data_inizio) VALUES (?,?, CURRENT_DATE);",
                [fisioterapistaId, newPaziente[0].id]
            );
            if (trattamento.affectedRows === 0) {
                res.status(500).json({
                    message: "Errore durante la registrazione",
                });
            } else {
                res.status(200).json({ message: "Utente registrato" });
            }
        }
    } else {
        // creo il nuovo trattamento
        try {
            await pool.query<ResultSetHeader>(
                "INSERT INTO Trattamenti (fisioterapista_id, paziente_id, data_inizio) VALUES (?,?, CURRENT_DATE);",
                [fisioterapistaId, rows[0].id]
            );

            // altrimenti faccio un update dei dati
            const [update] = await pool.query<ResultSetHeader>(
                "UPDATE Pazienti SET altezza = ?, peso = ?, diagnosi = ? WHERE id = ?;",
                [altezza, peso, diagnosi, rows[0].id]
            );
            if (update.affectedRows === 0) {
                res.status(500).json({
                    message: "Errore durante la registrazione",
                });
            } else {
                res.status(200).json({ message: "Utente registrato" });
            }
        } catch (error) {
            const err = error as Error;

            res.status(500).json({
                message: "Errore durante la registrazione, " + err.message,
            });
        }
    }
};

export const handleUpdatePatient = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const pazienteId = parseInt(req.params.id);
    const { altezza, peso, diagnosi } = req.body;

    // Controllo: serve almeno un parametro
    if (altezza === undefined && peso === undefined && diagnosi === undefined) {
        return res
            .status(400)
            .json({ message: "Nessun parametro da modificare" });
    }

    try {
        // Verifica che il trattamento sia in corso
        const [rows_trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT in_corso FROM Trattamenti WHERE paziente_id = ? AND fisioterapista_id = ?;",
            [pazienteId, fisioterapistaId]
        );

        if (!rows_trattamenti.length) {
            return res
                .status(404)
                .json({ message: "Paziente non trovato o non associato" });
        }

        if (rows_trattamenti[0].in_corso === 0) {
            return res
                .status(400)
                .json({ message: "Il trattamento è terminato" });
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

        const [update] = await pool.query<ResultSetHeader>(updateQuery, values);

        if (update.affectedRows === 0) {
            return res.status(404).json({ message: "Paziente non trovato" });
        }

        res.status(200).json({ message: "Paziente modificato" });
    } catch (error) {
        const err = error as Error;
        res.status(500).json({
            message: "Errore durante la modifica. " + err.message,
        });
    }
};
