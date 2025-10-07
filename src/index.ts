import express from "express";
import cors from "cors";
import { fisioterapistaRouter } from "./routes/fisioterapisti/fisioterapistaRoutes";
import { pazientiRouter } from "routes/pazienti/pazientiRoutes";
import cookieParser from "cookie-parser";
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/fisioterapista", fisioterapistaRouter);
app.use("/pazienti", pazientiRouter)

app.listen(1337, () => {
    console.log("http://localhost:1337");
});
