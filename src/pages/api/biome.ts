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

import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).send("OK");
}

  /* 🔥 SINGLE SOURCE OF TRUTH TICK */
  const result = await processBiomeTick(state, Date.now() - state.lastTickAt);

  await setChannelState(result.state);

  return text(res, getBiomeStatus(result.state));
}
