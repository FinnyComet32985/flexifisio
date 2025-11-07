import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// create appointment
export const handleCreateAppointment = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const paziente_id = req.params.id;
        const { data_appuntamento, ora_appuntamento } = req.body;

        // Validazione dei parametri di input
        if (!data_appuntamento || !ora_appuntamento) {
            return res.status(400).json({
                message:
                    "Parametri mancanti: data_appuntamento e ora_appuntamento sono obbligatori.",
            });
        }

        // Cerca un trattamento (attivo o terminato) tra il fisioterapista e il paziente
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id, in_corso FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, paziente_id]
        );

        // Se non esiste alcun trattamento (né attivo né terminato)
        if (trattamenti.length === 0) {
            return res.status(404).json({
                message: "Nessun trattamento trovato per questo paziente.",
            });
        }

        // Se il trattamento esiste ma è terminato, l'accesso è proibito
        if (trattamenti[0].in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento per questo paziente è terminato, impossibile creare nuovi appuntamenti.",
            });
        }

        // Inserisce il nuovo appuntamento nel database
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO appuntamenti (data_appuntamento, ora_appuntamento, stato_conferma, trattamento_id) VALUES (?,?,'Confermato',?);",
            [data_appuntamento, ora_appuntamento, trattamenti[0].id]
        );

        // Verifica se l'inserimento ha avuto successo
        if (result.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile creare l'appuntamento.",
            });
        }

        return res
            .status(201)
            .json({ message: "Appuntamento creato con successo." });
    } catch (error) {
        console.error("Errore in handleCreateAppointment:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la creazione dell'appuntamento: " +
                err.message,
        });
    }
};

// confirm appointment
export const handleConfirmAppointment = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const appuntamento_id = req.params.id;

        // Verifica che l'appuntamento esista e che il fisioterapista abbia i permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            "SELECT trattamenti.fisioterapista_id, trattamenti.in_corso FROM trattamenti JOIN appuntamenti ON trattamenti.id = appuntamenti.trattamento_id WHERE appuntamenti.id = ?;",
            [appuntamento_id]
        );

        if (checkResult.length === 0) {
            return res
                .status(404)
                .json({ message: "Appuntamento non trovato." });
        }

        const datiAppuntamento = checkResult[0];

        // Controllo permessi: il fisioterapista deve essere quello associato al trattamento
        if (datiAppuntamento.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non hai i permessi per confermare questo appuntamento.",
            });
        }

        // Controllo stato: il trattamento deve essere in corso
        if (datiAppuntamento.in_corso !== 1) {
            return res.status(403).json({
                message:
                    "Il trattamento non è più in corso, impossibile confermare l'appuntamento.",
            });
        }

        // Aggiorna lo stato dell'appuntamento a 'Confermato'
        const [updateResult] = await pool.query<ResultSetHeader>(
            "UPDATE appuntamenti SET stato_conferma = 'Confermato' WHERE id = ?; ",
            [appuntamento_id]
        );

        // Verifica se l'aggiornamento ha avuto successo
        if (updateResult.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile confermare l'appuntamento.",
            });
        }

        return res
            .status(200)
            .json({ message: "Appuntamento confermato con successo." });
    } catch (error) {
        console.error("Errore in handleConfirmAppointment:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la conferma dell'appuntamento: " +
                err.message,
        });
    }
};

// update appointment
export const handleUpdateAppointment = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const appuntamento_id = req.params.id;
        const { data_appuntamento, ora_appuntamento } = req.body;

        // Validazione dei parametri di input
        if (!data_appuntamento || !ora_appuntamento) {
            return res.status(400).json({
                message:
                    "Parametri mancanti: data_appuntamento e ora_appuntamento sono obbligatori per l'aggiornamento.",
            });
        }

        // Verifica che l'appuntamento esista e che il fisioterapista abbia i permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            "SELECT trattamenti.fisioterapista_id, trattamenti.in_corso FROM trattamenti join appuntamenti on trattamenti.id = appuntamenti.trattamento_id WHERE appuntamenti.id=?;",
            [appuntamento_id]
        );

        if (checkResult.length === 0) {
            return res
                .status(404)
                .json({ message: "Appuntamento non trovato." });
        }

        const datiAppuntamento = checkResult[0];

        // Controllo permessi: il fisioterapista deve essere quello associato al trattamento
        if (datiAppuntamento.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non hai i permessi per modificare questo appuntamento.",
            });
        }

        // Controllo stato: il trattamento deve essere in corso
        if (datiAppuntamento.in_corso !== 1) {
            return res.status(403).json({
                message:
                    "Il trattamento non è più in corso, impossibile modificare l'appuntamento.",
            });
        }

        // Aggiorna data e ora dell'appuntamento
        const [updateResult] = await pool.query<ResultSetHeader>(
            "UPDATE appuntamenti SET data_appuntamento = ?, ora_appuntamento = ? WHERE id = ?; ",
            [data_appuntamento, ora_appuntamento, appuntamento_id]
        );

        // Verifica se l'aggiornamento ha avuto successo
        if (updateResult.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile modificare l'appuntamento.",
            });
        }

        return res
            .status(200)
            .json({ message: "Appuntamento modificato con successo." });
    } catch (error) {
        console.error("Errore in handleUpdateAppointment:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la modifica dell'appuntamento: " +
                err.message,
        });
    }
};

// delete appointment
export const handleDeleteAppointments = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const appuntamento_id = req.params.id;

        // Verifica che l'appuntamento esista e che il fisioterapista abbia i permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            "SELECT trattamenti.fisioterapista_id, trattamenti.in_corso FROM trattamenti JOIN appuntamenti ON trattamenti.id = appuntamenti.trattamento_id WHERE appuntamenti.id = ?;",
            [appuntamento_id]
        );

        if (checkResult.length === 0) {
            return res
                .status(404)
                .json({ message: "Appuntamento non trovato." });
        }

        const datiAppuntamento = checkResult[0];

        // Controllo permessi: il fisioterapista deve essere quello associato al trattamento
        if (datiAppuntamento.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non hai i permessi per eliminare questo appuntamento.",
            });
        }

        // Controllo stato: il trattamento deve essere in corso
        if (datiAppuntamento.in_corso !== 1) {
            return res.status(403).json({
                message:
                    "Il trattamento non è più in corso, impossibile eliminare l'appuntamento.",
            });
        }

        // Elimina l'appuntamento dal database
        const [deleteResult] = await pool.query<ResultSetHeader>(
            "DELETE FROM appuntamenti WHERE id = ?;",
            [appuntamento_id]
        );

        // Verifica se l'eliminazione ha avuto successo
        if (deleteResult.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile eliminare l'appuntamento.",
            });
        }

        return res
            .status(200)
            .json({ message: "Appuntamento eliminato con successo." });
    } catch (error) {
        console.error("Errore in handleDeleteAppointments:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante l'eliminazione dell'appuntamento: " +
                err.message,
        });
    }
};

// get appointment
export const handleGetAppointments = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const paziente_id = req.params.id;

        // Caso 1: Recupera tutti gli appuntamenti per tutti i pazienti del fisioterapista
        if (paziente_id === undefined) {
            // Trova tutti i trattamenti in corso del fisioterapista
            const [trattamenti] = await pool.query<RowDataPacket[]>(
                "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND in_corso = 1;",
                [fisioterapistaId]
            );

            if (trattamenti.length === 0) {
                // Nessun trattamento in corso, quindi nessun appuntamento da mostrare
                return res.status(204).json({
                    message:
                        "Nessun trattamento in corso trovato per il fisioterapista.",
                });
            }

            const trattamentoIds = trattamenti.map(
                (trattamento) => trattamento.id
            );

            // Recupera tutti gli appuntamenti per i trattamenti trovati
            const [appointments] = await pool.query<RowDataPacket[]>(
                "SELECT appuntamenti.id, appuntamenti.data_appuntamento, appuntamenti.ora_appuntamento, appuntamenti.stato_conferma, trattamenti.paziente_id, pazienti.nome, pazienti.cognome FROM appuntamenti JOIN trattamenti ON appuntamenti.trattamento_id = trattamenti.id JOIN pazienti ON trattamenti.paziente_id = pazienti.id WHERE trattamento_id IN (?);",
                [trattamentoIds]
            );

            if (appointments.length === 0) {
                return res.status(204).json({
                    message:
                        "Nessun appuntamento trovato per i trattamenti in corso.",
                });
            }

            return res.status(200).json(appointments);
        }
        // Caso 2: Recupera gli appuntamenti per un paziente specifico
        else {
            // Verifica l'associazione del paziente al fisioterapista e lo stato del trattamento
            const [patientTreatment] = await pool.query<RowDataPacket[]>(
                "SELECT id, fisioterapista_id, in_corso FROM trattamenti WHERE paziente_id = ?;",
                [paziente_id]
            );

            if (patientTreatment.length === 0) {
                return res.status(404).json({
                    message:
                        "Nessun trattamento trovato per il paziente specificato.",
                });
            }

            // Controllo permessi e stato del trattamento
            if (
                patientTreatment[0].in_corso === 0 ||
                patientTreatment[0].fisioterapista_id !== fisioterapistaId
            ) {
                return res.status(403).json({
                    message:
                        "Il paziente non è associato a un trattamento in corso da questo fisioterapista o il trattamento è terminato.",
                });
            }

            // Recupera gli appuntamenti per il trattamento specifico
            const [appuntamenti] = await pool.query<RowDataPacket[]>(
                "SELECT appuntamenti.id, appuntamenti.data_appuntamento, appuntamenti.ora_appuntamento, appuntamenti.stato_conferma, pazienti.nome, pazienti.cognome FROM appuntamenti JOIN trattamenti ON appuntamenti.trattamento_id = trattamenti.id JOIN pazienti ON trattamenti.paziente_id = pazienti.id WHERE trattamenti.id = ?;",
                [patientTreatment[0].id]
            );

            if (appuntamenti.length === 0) {
                return res.status(204).json({
                    message: "Nessun appuntamento trovato per questo paziente.",
                });
            }

            return res.status(200).json(appuntamenti);
        }
    } catch (error) {
        console.error("Errore in handleGetAppointments:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero degli appuntamenti: " +
                err.message,
        });
    }
};
