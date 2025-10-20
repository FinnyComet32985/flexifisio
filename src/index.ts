import express from "express";
import cors from "cors";
import { fisioterapistaRouter } from "./routes/fisioterapisti/fisioterapistaRoutes";
import { pazientiRouter } from "./routes/pazienti/pazientiRoutes";
import cookieParser from "cookie-parser";
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({
        message: "Benvenuto nella API di Fisioterapia! Usa i percorsi /fisioterapista e /pazienti per accedere alle risorse.",
        endpoints: {
            fisioterapista: "/fisioterapista",
            pazienti: "/pazienti"
        }
    });
});

app.use("/fisioterapista", fisioterapistaRouter);
app.use("/pazienti", pazientiRouter)

app.listen(1337, () => {
    console.log("http://localhost:1337");
});
