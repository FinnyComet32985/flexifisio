import pool from "database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRETE;
if (!refreshTokenSecret) {
    throw new Error("REFRESH_TOKEN_SECRET environment variable is not set");
}
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRETE;
if (!accessTokenSecret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
}

// register
export const handleRegister = async (req: Request, res: Response) => {
    const { nome, cognome, email, password } = req.body;
    if (!nome || !cognome || !email || !password) {
        res.sendStatus(400).json({
            message: "nome, cognome, email e password sono obbligatori",
        });
        res.send();
    }

    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM Fisioterapisti WHERE email = ?",
        [email]
    );

    if (rows.length > 0) {
        res.sendStatus(409).json({ message: "Email già registrata" });
        res.send();
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Fisioterapisti (nome, cognome, email, password) VALUES (?, ?, ?, ?)",
            [nome, cognome, email, hashedPassword]
        );
        if (result.affectedRows === 0) {
            res.sendStatus(500);
        }
        res.sendStatus(201);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
};
// login
export const handleLogin = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400)
            .json({
                message: "Email e password sono obbligatori",
            })
            .send();
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM Fisioterapisti WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            res.status(401).json({ message: "Utente non trovato" }).send();
        } else {
            const match = await bcrypt.compare(password, rows[0].password);
            if (match) {
                // create JWTs
                const accessToken = jwt.sign(
                    { id: rows[0].id },
                    accessTokenSecret,
                    { expiresIn: "15m" }
                );
                const refreshToken = jwt.sign(
                    { id: rows[0].id },
                    refreshTokenSecret,
                    { expiresIn: "1d" }
                );
                // Saving refreshToken with current user
                const [result] = await pool.query<ResultSetHeader>(
                    "UPDATE Fisioterapisti SET refreshToken = ? WHERE email = ?",
                    [refreshToken, rows[0].email]
                );
                if (result.affectedRows === 0) {
                    res.sendStatus(500);
                }
                res.cookie("jwt", refreshToken, {
                    httpOnly: true,
                    sameSite: false,
                    secure: true,
                    maxAge: 24 * 60 * 60 * 1000,
                });
                res.status(200).json({ accessToken }).send();
            } else {
                res.status(401).json({ message: "Password errata" }).send();
            }
        }
    }
};

// refresh token
export const handleRefreshToken = async (req: Request, res: Response) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        res.sendStatus(401);
    } else {
        const refreshToken = cookies.jwt;
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM Fisioterapisti WHERE refreshToken = ?",
            [refreshToken]
        );

        if (rows.length === 0) {
            res.sendStatus(403);
        }
        // evaluate jwt
        jwt.verify(
            refreshToken,
            refreshTokenSecret,
            (err: jwt.VerifyErrors | null, decoded: any) => {
                if (err || rows[0].id !== decoded.id) {
                    res.sendStatus(403);
                }
                const accessToken = jwt.sign(
                    { id: decoded.id },
                    accessTokenSecret,
                    { expiresIn: "15m" }
                );
                res.json({ accessToken }).send();
            }
        );
    }
};

// logout
export const handleLogout = async (req: Request, res: Response) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        res.sendStatus(204);
    } else {
        const refreshToken = cookies.jwt;
        const [rows] = await pool.query<RowDataPacket[]>(
            " SELECT * FROM Fisioterapisti WHERE refreshToken = ?",
            [refreshToken]
        );
        if (rows.length === 0) {
            res.clearCookie("jwt", {
                httpOnly: true,
                sameSite: false,
                secure: true,
            });
            res.sendStatus(204);
        }
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Fisioterapisti SET refreshToken = NULL WHERE email = ?",
            [rows[0].email]
        );
        if (result.affectedRows === 0) {
            res.sendStatus(500);
        }
        res.clearCookie("jwt", {
            httpOnly: true,
            sameSite: false,
            secure: true,
        });
        res.sendStatus(204);
    }
};

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

// crea esercizio
export const handleCreateExcercise = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;

    const {
        nome,
        descrizione,
        descrizione_svolgimento,
        consigli_svolgimento,
        video,
    } = req.body;

    if (
        !nome ||
        !descrizione ||
        !descrizione_svolgimento ||
        !consigli_svolgimento
    ) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Esercizi (nome, descrizione, descrizione_svolgimento, consigli_svolgimento, video, fisioterapista_id) VALUES (?,?,?,?,?,?);",
            [
                nome,
                descrizione,
                descrizione_svolgimento,
                consigli_svolgimento,
                video,
                fisioterapistaId,
            ]
        );

        if (result.affectedRows === 0) {
            res.status(500)
                .json({ message: "Errore durante la registrazione" })
                .send();
        } else {
            res.status(200).json({ message: "Allenamento creato" }).send();
        }
    }
};
// ricerca esercizi
export const handleGetExercises = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const id = req.params.id;

    if (!id) {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT nome, descrizione, descrizione_svolgimento, consigli_svolgimento, video  FROM Esercizi WHERE fisioterapista_id = ?;",
            [fisioterapistaId]
        );

        if (rows.length === 0) {
            res.status(404)
                .json({ message: "Nessun allenamento trovato" })
                .send();
        } else {
            res.status(200).json(rows).send();
        }
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT nome, descrizione, descrizione_svolgimento, consigli_svolgimento, video FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
            [fisioterapistaId, id]
        );

        if (rows.length === 0) {
            res.status(404)
                .json({ message: "Nessun allenamento trovato" })
                .send();
        } else {
            res.status(200).json(rows).send();
        }
    }
};
// cancella esercizio
export const handleDeleteExercises = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const id = req.params.id;

    if (!id) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [result] = await pool.query<ResultSetHeader>(
            "DELETE FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
            [fisioterapistaId, id]
        );

        if (result.affectedRows === 0) {
            res.status(500).json({
                message: "Errore durante la cancellazione",
            });
        } else {
            res.status(200).json({ message: "Allenamento cancellato" }).send();
        }
    }
};

// visualizza chat
export const handleGetChat = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    if (paziente_id === undefined) {
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT trattamento_id FROM messaggi WHERE trattamento_id IN (SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND in_corso = 1);",
            [fisioterapistaId]
        );
        if (trattamenti.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const trattamentoIds = trattamenti.map(
                (trattamento) => trattamento.trattamento_id
            );
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT pazienti.id, pazienti.nome, pazienti.cognome FROM Pazienti JOIN trattamenti ON pazienti.id = trattamenti.paziente_id WHERE trattamenti.id IN (?)",
                [trattamentoIds]
            );
            if (rows.length === 0) {
                res.status(404)
                    .json({ message: "Nessun trattamento trovato" })
                    .send();
            } else {
                res.status(200).json(rows).send();
            }
        }
    } else {
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamento.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const trattamentoId = trattamento[0].id;
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT id, testo, data_invio, mittente FROM messaggi WHERE trattamento_id = ?;",
                [trattamentoId]
            );
            if (rows.length === 0) {
                res.status(404)
                    .json({ message: "Nessun messaggio trovato" })
                    .send();
            } else {
                res.status(200).json(rows).send();
            }
        }
    }
};
// invia messaggio
export const handleSendMessage = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const testo = req.body.testo;
    if (!testo) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamento.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const [result] = await pool.query<ResultSetHeader>(
                "INSERT INTO messaggi (trattamento_id, testo, mittente, data_invio) VALUES (?,?,?,?);",
                [trattamento[0].id, testo, "fisioterapista", new Date()]
            );
            if (result.affectedRows === 0) {
                res.status(500)
                    .json({ message: "Errore durante l'invio" })
                    .send();
            } else {
                res.status(200).json({ message: "Messaggio inviato" }).send();
            }
        }
    }
};

// crea appuntamento
export const handleCreateAppointment = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const { data_appuntamento, ora_appuntamento } = req.body;
    if (!data_appuntamento || !ora_appuntamento) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamenti.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            try {
                const [result] = await pool.query<ResultSetHeader>(
                    "INSERT INTO appuntamenti (data_appuntamento, ora_appuntamento, stato_conferma, trattamento_id) VALUES (?,?,'Confermato',?);",
                    [data_appuntamento, ora_appuntamento, trattamenti[0].id]
                );
                if (result.affectedRows === 0) {
                    res.status(500)
                        .json({
                            message:
                                "Errore durante la creazione dell'appuntamento",
                        })
                        .send();
                } else {
                    res.status(200)
                        .json({ message: "Appuntamento creato con successo" })
                        .send();
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
