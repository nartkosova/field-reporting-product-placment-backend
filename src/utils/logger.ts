import { Request, Response, NextFunction } from "express";
import chalk from "chalk";

const logger = (req: Request, res: Response, next: NextFunction): void => {
  const now = new Date().toISOString();

  console.log(
    `${chalk.gray(`[${now}]`)} ${chalk.cyan(req.method)} ${chalk.yellow(
      req.originalUrl
    )}`
  );

  if (Object.keys(req.query).length > 0) {
    console.log(chalk.magenta("Query:"), req.query);
  }

  if (Object.keys(req.body).length > 0) {
    console.log(chalk.green("Body:"), req.body);
  }

  res.on("finish", () => {
    const now = new Date().toISOString();
    console.log(
      `${chalk.gray(`[${now}]`)} ${chalk.cyan(req.method)} ${chalk.yellow(
        req.originalUrl
      )} ${chalk.blue(res.statusCode.toString())}`
    );
  });

  next();
};

export default logger;
