import { Router } from "express";
import { authenticateJWT } from "../../middleware/autenticateJWT";
import * as authController from "../../controllers/fisioterapisti/authController";
import * as profileController from "../../controllers/fisioterapisti/profileController";
import * as patientController from "../../controllers/fisioterapisti/patientController";
import * as chatController from "../../controllers/fisioterapisti/chatController";
import * as exerciseController from "../../controllers/fisioterapisti/exerciseController";
import * as appointmentController from "../../controllers/fisioterapisti/appointmentController";
import * as trainingCardController from "../../controllers/fisioterapisti/trainingCardController";
import * as trainingSessionController from "../../controllers/fisioterapisti/trainingSessionController";

export const fisioterapistaRouter = Router();

// gestione autenticazione fisioterapista
fisioterapistaRouter.post("/register", authController.handleRegister);
fisioterapistaRouter.post("/login", authController.handleLogin);
fisioterapistaRouter.post("/logout", authController.handleLogout);
fisioterapistaRouter.post("/refreshToken", authController.handleRefreshToken);
fisioterapistaRouter.post(
    "/changePassword",
    authenticateJWT,
    authController.handleChangePassword
);

// gestione profilo fisioterapista
fisioterapistaRouter.get(
    "/profile",
    authenticateJWT,
    profileController.handleGetProfile
);
fisioterapistaRouter.patch(
    "/profile",
    authenticateJWT,
    profileController.handleUpdateProfile
);

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
fisioterapistaRouter.patch(
    "/patient/:id",
    authenticateJWT,
    patientController.handleUpdatePatient
);
fisioterapistaRouter.delete(
    "/patient/:id",
    authenticateJWT,
    patientController.handleEndTreatment
);

// gestione esercizi
fisioterapistaRouter.post(
    "/exercise",
    authenticateJWT,
    exerciseController.handleCreateExercise
);
fisioterapistaRouter.get(
    "/exercise/:id?",
    authenticateJWT,
    exerciseController.handleGetExercises
);
fisioterapistaRouter.patch(
    "/exercise/:id",
    authenticateJWT,
    exerciseController.handleUpdateExercise
);
fisioterapistaRouter.delete(
    "/exercise/:id",
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
fisioterapistaRouter.post(
    "/appointment/:id/confirm",
    authenticateJWT,
    appointmentController.handleConfirmAppointment
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
fisioterapistaRouter.get(
    "/trainingCard/:id",
    authenticateJWT,
    trainingCardController.handleGetTrainingCards
);
fisioterapistaRouter.get(
    "/trainingCard/full/:id",
    authenticateJWT,
    trainingCardController.handleGetFullTrainingCard
);
fisioterapistaRouter.post(
    "/trainingCard/:id",
    authenticateJWT,
    trainingCardController.handleCreateTrainingCard
);
fisioterapistaRouter.patch(
    "/trainingCard/:id",
    authenticateJWT,
    trainingCardController.handleUpdateTrainingCard
);
fisioterapistaRouter.delete(
    "/trainingCard/:id",
    authenticateJWT,
    trainingCardController.handleDeleteTrainingCard
);
// aggiunta di un esercizio alla scheda di allenamento
fisioterapistaRouter.post(
    "/trainingCard/:id/exercise",
    authenticateJWT,
    trainingCardController.handleAddExerciseToTrainingCard
);

fisioterapistaRouter.get(
    "/trainingCard/:id/exercise",
    authenticateJWT,
    trainingCardController.handleGetExercisesFromTrainingCard
);

// eliminazione di un esercizio dalla scheda di allenamento
fisioterapistaRouter.delete(
    "/trainingCard/:id/exercise/:exerciseId",
    authenticateJWT,
    trainingCardController.handleDeleteExerciseFromTrainingCard
);
fisioterapistaRouter.patch(
    "/trainingCard/:id/exercise",
    authenticateJWT,
    trainingCardController.handleUpdateExerciseFromTrainingCard
);

fisioterapistaRouter.get(
    "/trainingSession/:trainingCardId",
    authenticateJWT,
    trainingSessionController.handleGetTrainingSessions
);

fisioterapistaRouter.get(
    "/trainingSession/:sessionId",
    authenticateJWT,
    trainingSessionController.handleGetTrainingSession
);
// api per dati sondaggi
// api per i dati della sessione
