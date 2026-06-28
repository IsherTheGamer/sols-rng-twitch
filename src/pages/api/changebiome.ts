import type { NextApiRequest, NextApiResponse } from "next";
import biomeHandler from "./biome";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  req.query.action = "change";
  return biomeHandler(req, res);
}
