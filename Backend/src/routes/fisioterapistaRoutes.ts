import { Router } from "express";
import { authenticateJWT } from "middleware/autenticateJWT";
import * as fisioterapistaController from "../controllers/fisioterapisti/fisioterapistaController";

export const fisioterapistaRouter = Router();

// gestione autenticazione fisioterapista
fisioterapistaRouter.post("/register", fisioterapistaController.handleRegister);
fisioterapistaRouter.post("/login", fisioterapistaController.handleLogin);
fisioterapistaRouter.post("/logout", fisioterapistaController.handleLogout);
fisioterapistaRouter.post(
    "/refreshToken",
    fisioterapistaController.handleRefreshToken
);

// gestione pazienti
fisioterapistaRouter.get(
    "/patient/:id?",
    authenticateJWT,
    fisioterapistaController.handleGetPatient
);
fisioterapistaRouter.post(
    "/patient",
    authenticateJWT,
    fisioterapistaController.handleNewPatient
);
fisioterapistaRouter.delete(
    "/patient/:id",
    authenticateJWT,
    fisioterapistaController.handleEndTreatment
);

// gestione esercizi
fisioterapistaRouter.post(
    "/excercise",
    authenticateJWT,
    fisioterapistaController.handleCreateExcercise
);
fisioterapistaRouter.get(
    "/excercise/:id?",
    authenticateJWT,
    fisioterapistaController.handleGetExercises
);
