import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState, setChannelState } from "@/lib/state";
import {
  applyBiomeChange,
  getBiomeStatus,
  processBiomeTick,
} from "@/lib/biome-engine";
import { findBiome } from "@/lib/data";
import { text, error, parseQuery } from "@/lib/api-helpers";

export default async function handler(req, res) {
  return res.json({
    headers: req.headers,
    context: getChannelContext(req),
  });
}
