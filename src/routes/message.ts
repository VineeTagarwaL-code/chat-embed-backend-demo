import { Router } from "express";
import messageHandler from "../handler/message";
const messageRouter = Router();

messageRouter.post("/message", messageHandler);

export default messageRouter;