import type { NextApiRequest, NextApiResponse } from "next";
import biomeHandler from "./biome";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const token = req.query.token;

  if (token !== process.env.API_SECRET_TOKEN) {
    return res.status(403).json({
      error: "Invalid token"
    });
  }

  req.query.action = "change";

  return biomeHandler(req, res);
}
