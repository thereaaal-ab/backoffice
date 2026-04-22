import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { sessionMiddleware } from "../server/auth";
import { registerRoutes } from "../server/routes";
import { seedDatabase } from "../server/seed";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

let appInitPromise: Promise<express.Express> | null = null;

async function getApp() {
  if (!appInitPromise) {
    appInitPromise = (async () => {
      const app = express();
      const httpServer = createServer(app);

      // Required in serverless environments to correctly handle secure cookies.
      app.set("trust proxy", 1);

      app.use(
        express.json({
          verify: (req, _res, buf) => {
            req.rawBody = buf;
          },
        }),
      );
      app.use(express.urlencoded({ extended: false }));
      app.use(sessionMiddleware);

      await registerRoutes(httpServer, app);
      await seedDatabase();

      app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        console.error("Internal Server Error:", err);
        if (res.headersSent) return next(err);
        return res.status(status).json({ message });
      });

      return app;
    })();
  }

  return appInitPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return app(req, res);
}
