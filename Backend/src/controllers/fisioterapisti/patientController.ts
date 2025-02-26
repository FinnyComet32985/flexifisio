import pool from "database/connection";
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
            res.status(404).json({ message: "Nessun paziente trovato" }).send();
        } else {
            res.status(200).json(rows).send();
        }
    } else {
        const [rows_trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT in_corso FROM Trattamenti WHERE paziente_id = ? AND fisioterapista_id = ?;",
            [pazienteId, fisioterapistaId]
        );
        if (rows_trattamenti.length === 0) {
            res.status(404).json({ message: "Nessun paziente trovato" }).send();
        } else {
            if (rows_trattamenti[0].in_corso === 0) {
                res.status(404)
                    .json({ message: "Il trattamento è terminato" })
                    .send();
            } else {
                const [rows] = await pool.query<RowDataPacket[]>(
                    "SELECT Pazienti.id, Pazienti.nome, Pazienti.cognome, Pazienti.data_nascita, Pazienti.genere, Pazienti.altezza, Pazienti.peso, Pazienti.diagnosi FROM Trattamenti JOIN Pazienti ON Trattamenti.paziente_id = Pazienti.id WHERE Trattamenti.fisioterapista_id = ? AND Pazienti.id = ?;",
                    [fisioterapistaId, pazienteId]
                );
                res.status(200).json(rows).send();
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
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            res.status(200).json({ message: "Trattamento terminato" }).send();
        }
    } catch (error) {
        res.status(500)
            .json({ message: "Errore nell'aggiornamento del trattamento" })
            .send();
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
            res.status(500)
                .json({ message: "Errore durante la registrazione" })
                .send();
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
                res.status(500)
                    .json({ message: "Errore durante la registrazione" })
                    .send();
            } else {
                res.status(200).json({ message: "Utente registrato" }).send();
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
                res.status(500)
                    .json({ message: "Errore durante la registrazione" })
                    .send();
            } else {
                res.status(200).json({ message: "Utente registrato" }).send();
            }
        } catch (error) {
            const err = error as Error;

            res.status(500).json({
                message: "Errore durante la registrazione, " + err.message,
            });
        }
    }
};
