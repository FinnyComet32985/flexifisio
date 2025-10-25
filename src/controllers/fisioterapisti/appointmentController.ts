import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// crea appuntamento
export const handleCreateAppointment = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const { data_appuntamento, ora_appuntamento } = req.body;
    if (!data_appuntamento || !ora_appuntamento) {
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamenti.length === 0) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else {
            try {
                const [result] = await pool.query<ResultSetHeader>(
                    "INSERT INTO appuntamenti (data_appuntamento, ora_appuntamento, stato_conferma, trattamento_id) VALUES (?,?,'Confermato',?);",
                    [data_appuntamento, ora_appuntamento, trattamenti[0].id]
                );
                if (result.affectedRows === 0) {
                    res.status(500).json({
                        message:
                            "Errore durante la creazione dell'appuntamento",
                    });
                } else {
                    res.status(200).json({
                        message: "Appuntamento creato con successo",
                    });
                }
            } catch (error) {
                const err = error as Error;

                res.status(500).json({
                    message: "Errore durante l'inserimento. " + err.message,
                });
            }
        }
    }
};

export const handleConfirmAppointment = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const appuntamento_id = req.params.id;

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.fisioterapista_id, trattamenti.in_corso FROM trattamenti join appuntamenti on trattamenti.id = appuntamenti.trattamento_id WHERE appuntamenti.id=?;",
        [appuntamento_id]
    );
    if (!result) {
        res.status(404).json({ message: "Nessun trattamento trovato" });
    } else if (
        result[0].fisioterapista_id !== fisioterapistaId ||
        result[0].in_corso !== 1
    ) {
        res.status(403).json({
            message: "Il paziente è trattato da un altro fisioterapista",
        });
    } else {
        try {
            const [result] = await pool.query<ResultSetHeader>(
                "UPDATE appuntamenti SET stato_conferma='Confermato' WHERE id = ?; ",
                [appuntamento_id]
            );
            if (result.affectedRows === 0) {
                res.status(500).json({
                    message: "Errore durante la conferma dell'appuntamento",
                });
            } else {
                res.status(200).json({
                    message: "Appuntamento confermato con successo",
                });
            }
        } catch (error) {
            const err = error as Error;
            res.status(500).json({
                message: "Errore durante la conferma. " + err.message,
            });
        }
    }
};

// update appuntamento
export const handleUpdateAppointment = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const appuntamento_id = req.params.id;
    const { data_appuntamento, ora_appuntamento } = req.body;
    if (!data_appuntamento || !ora_appuntamento) {
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        const [result] = await pool.query<RowDataPacket[]>(
            "SELECT trattamenti.fisioterapista_id, trattamenti.in_corso FROM trattamenti join appuntamenti on trattamenti.id = appuntamenti.trattamento_id WHERE appuntamenti.id=?;",
            [appuntamento_id]
        );
        if (!result) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else if (
            result[0].fisioterapista_id !== fisioterapistaId ||
            result[0].in_corso !== 1
        ) {
            res.status(403).json({
                message: "Il paziente è trattato da un altro fisioterapista",
            });
        } else {
            try {
                const [result] = await pool.query<ResultSetHeader>(
                    "UPDATE appuntamenti SET data_appuntamento = ?, ora_appuntamento = ? WHERE id = ?; ",
                    [data_appuntamento, ora_appuntamento, appuntamento_id]
                );

                if (result.affectedRows === 0) {
                    res.status(500).json({
                        message: "Errore durante la modifica dell'appuntamento",
                    });
                } else {
                    res.status(200).json({
                        message: "Appuntamento modificato con successo",
                    });
                }
            } catch (error) {
                const err = error as Error;

                res.status(500).json({
                    message: "Errore durante la modifica. " + err.message,
                });
            }
        }
    }
};
// elimina appuntamento
export const handleDeleteAppointments = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const appuntamento_id = req.params.id;
    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.fisioterapista_id, trattamenti.in_corso FROM trattamenti join appuntamenti on trattamenti.id = appuntamenti.trattamento_id WHERE appuntamenti.id=?;",
        [appuntamento_id]
    );
    if (!result) {
        res.status(404).json({ message: "Nessun trattamento trovato" });
    } else if (
        result[0].fisioterapista_id !== fisioterapistaId ||
        result[0].in_corso !== 1
    ) {
        res.status(403).json({
            message: "Il paziente é trattato da un altro fisioterapista",
        });
    } else {
        const [del] = await pool.query<ResultSetHeader>(
            "DELETE FROM appuntamenti WHERE id = ?;",
            [appuntamento_id]
        );
        if (del.affectedRows === 0) {
            res.status(500).json({
                message: "Errore durante la cancellazione",
            });
        } else {
            res.status(200).json({
                message: "Appuntamento cancellato con successo",
            });
        }
    }
};
// mostra appuntamenti
export const handleGetAppointments = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;

    if (paziente_id === undefined) {
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id =? AND in_corso=1;",
            [fisioterapistaId]
        );
        if (trattamenti.length === 0) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else {
            const trattamentoIds = trattamenti.map(
                (trattamento) => trattamento.id
            );
            const [result] = await pool.query<RowDataPacket[]>(
                "SELECT appuntamenti.id, appuntamenti.data_appuntamento, appuntamenti.ora_appuntamento, appuntamenti.stato_conferma, trattamenti.paziente_id, pazienti.nome, pazienti.cognome FROM appuntamenti join trattamenti on appuntamenti.trattamento_id=trattamenti.id JOIN pazienti on trattamenti.paziente_id=pazienti.id WHERE trattamento_id IN (?);",
                [trattamentoIds]
            );
            if (result.length === 0) {
                res.status(404).json({
                    message: "Nessun appuntamento trovato",
                });
            } else {
                res.status(200).json(result);
            }
        }
    } else {
        const [result] = await pool.query<RowDataPacket[]>(
            "SELECT id, fisioterapista_id, in_corso FROM trattamenti WHERE paziente_id=?;",
            [paziente_id]
        );
        if (result.length === 0) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else if (
            result[0].in_corso === 0 ||
            result[0].fisioterapista_id !== fisioterapistaId
        ) {
            res.status(403).json({
                message:
                    "Il paziente non è associato a un trattamento in corso da questo fisioterapista",
            });
        } else {
            const [appuntamenti] = await pool.query<RowDataPacket[]>(
                "SELECT appuntamenti.id, appuntamenti.data_appuntamento, appuntamenti.ora_appuntamento, appuntamenti.stato_conferma, pazienti.nome, pazienti.cognome FROM appuntamenti JOIN trattamenti on appuntamenti.trattamento_id=trattamenti.id JOIN pazienti on trattamenti.paziente_id=pazienti.id WHERE trattamenti.id=?;",
                [result[0].id]
            );
            if (appuntamenti.length === 0) {
                res.status(404).json({
                    message: "Nessun appuntamento trovato",
                });
            } else {
                res.status(200).json(appuntamenti);
            }
        }
    }
};
