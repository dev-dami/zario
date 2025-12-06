import express, { Request, Response, NextFunction } from "express";
import { Logger, ConsoleTransport } from "../src";

const logger = new Logger({
    prefix: "[ExpressServer]",
    transports: [new ConsoleTransport()],
});

const app = express();
declare global {
    namespace Express {
        interface Request {
            logger: Logger;
        }
    }
}

app.use((req: Request, res: Response, next: NextFunction) => {
    req.logger = logger.createChild({
        prefix: `[${req.method} ${req.url}]`,
    });

    req.logger.info("Request received");
    next();
});

app.get("/", (req: Request, res: Response) => {
    req.logger.info("Handling home route");
    res.send("Hello with Zario logging!");
});

app.get("/users", (req: Request, res: Response) => {
    req.logger.warn("This is a restricted route", { user: "guest" });
    res.send("User list");
});

app.listen(3000, () => {
    logger.info("Server started on http://localhost:3000");
});