import { NextFunction, Router } from "express";
import { authenticateJWT } from "middleware/autenticateJWT";
import * as authController from "../controllers/fisioterapisti/authController";
import * as patientController from "../controllers/fisioterapisti/patientController";
import * as chatController from "../controllers/fisioterapisti/chatController";
import * as exerciseController from "../controllers/fisioterapisti/exerciseController";
import * as appointmentController from "../controllers/fisioterapisti/appointmentController";
import * as trainingCardController from "../controllers/fisioterapisti/trainingCardController";

export const fisioterapistaRouter = Router();

// gestione autenticazione fisioterapista
fisioterapistaRouter.post("/register", authController.handleRegister);
fisioterapistaRouter.post("/login", authController.handleLogin);
fisioterapistaRouter.post("/logout", authController.handleLogout);
fisioterapistaRouter.post("/refreshToken", authController.handleRefreshToken);

// gestione pazienti
fisioterapistaRouter.get(
    "/patient/:id?",
    authenticateJWT,
    patientController.handleGetPatient
);
fisioterapistaRouter.post(
    "/patient",
    authenticateJWT,
    patientController.handleNewPatient
);
fisioterapistaRouter.delete(
    "/patient/:id",
    authenticateJWT,
    patientController.handleEndTreatment
);

// gestione esercizi
fisioterapistaRouter.post(
    "/excercise",
    authenticateJWT,
    exerciseController.handleCreateExcercise
);
fisioterapistaRouter.get(
    "/excercise/:id?",
    authenticateJWT,
    exerciseController.handleGetExercises
);
fisioterapistaRouter.delete(
    "/excercise/:id",
    authenticateJWT,
    exerciseController.handleDeleteExercises
);

// chat
fisioterapistaRouter.get(
    "/chat/:id?",
    authenticateJWT,
    chatController.handleGetChat
);
fisioterapistaRouter.post(
    "/message/:id",
    authenticateJWT,
    chatController.handleSendMessage
);

// appuntamenti
fisioterapistaRouter.post(
    "/appointment/:id",
    authenticateJWT,
    appointmentController.handleCreateAppointment
);
fisioterapistaRouter.patch(
    "/appointment/:id",
    authenticateJWT,
    appointmentController.handleUpdateAppointment
);
fisioterapistaRouter.delete(
    "/appointment/:id",
    authenticateJWT,
    appointmentController.handleDeleteAppointments
);
fisioterapistaRouter.get(
    "/appointment/:id?",
    authenticateJWT,
    appointmentController.handleGetAppointments
);

// gestione schede di allenamento
fisioterapistaRouter.post(
    "/trainingCard/:id",
    authenticateJWT,
    trainingCardController.handleCreateTrainingCard
);
fisioterapistaRouter.get(
    "/trainingCard/:id",
    authenticateJWT,
    trainingCardController.handleGetTrainingCards
);
fisioterapistaRouter.delete(
    "/trainingCard/:id/:schedaId",
    authenticateJWT,
    trainingCardController.handleDeleteTrainingCard
);
